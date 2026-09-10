-- UNKNOWN PULLS V9
-- Shaymin mood state + reliable final trade completion
-- Run this complete file once in Supabase SQL Editor.

create table if not exists
public.shaymin_mood_state (
  id integer primary key,
  mode text not null default 'automatic'
    check (mode in ('automatic', 'manual')),
  mood text not null default 'content'
    check (
      mood in (
        'morning',
        'content',
        'busy',
        'gardener',
        'proud',
        'worried',
        'celebration',
        'sleeping',
        'seed',
        'golden',
        'together',
        'lukas',
        'skye'
      )
    ),
  note text not null default '',
  updated_by text not null default '',
  updated_by_email text not null default '',
  updated_at timestamptz not null default now(),
  constraint shaymin_mood_singleton check (id = 1),
  constraint shaymin_mood_note_length check (char_length(note) <= 180)
);

insert into public.shaymin_mood_state (
  id,
  mode,
  mood,
  note,
  updated_by,
  updated_by_email
)
values (
  1,
  'automatic',
  'content',
  '',
  '',
  ''
)
on conflict (id) do nothing;

alter table public.shaymin_mood_state
enable row level security;

revoke all on public.shaymin_mood_state
from anon, authenticated;

comment on table public.shaymin_mood_state is
  'Shared Lukas and Skye Shaymin mood. Read and written only by protected Shaymin server routes.';

-- -------------------------------------------------------------------------
-- Reliable, idempotent final trade confirmation
-- -------------------------------------------------------------------------

create or replace function
public.set_player_trade_ready(
  p_trade_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_trade public.player_trades%rowtype;
  v_item record;
  v_recipient_id uuid;
  v_updated integer;
  v_card_id_type text;
  v_source_quantity integer;
  v_source_reserved integer;
  v_sql text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select trade.*
  into v_trade
  from public.player_trades as trade
  where trade.id = p_trade_id
  for update;

  if not found then
    raise exception 'That trade does not exist.';
  end if;

  if v_trade.initiator_id <> v_user_id
     and v_trade.recipient_id <> v_user_id then
    raise exception 'That trade is not available to this account.';
  end if;

  -- Repeated final requests are safe. This is important when both clients
  -- refresh or retry at almost the same moment.
  if v_trade.status = 'completed' then
    return 'completed';
  end if;

  if v_trade.status <> 'countdown' then
    raise exception 'That trade is not ready.';
  end if;

  if not (
    v_trade.initiator_locked
    and v_trade.recipient_locked
  ) then
    raise exception 'Both offers must be locked.';
  end if;

  if v_trade.countdown_started_at is null
     or now() < v_trade.countdown_started_at + interval '3 seconds' then
    raise exception 'The three-second safety countdown is still running.';
  end if;

  if v_trade.initiator_id = v_user_id then
    update public.player_trades
    set
      initiator_ready = true,
      updated_at = now(),
      last_action_by = v_user_id,
      revision = revision + 1
    where id = p_trade_id;
  else
    update public.player_trades
    set
      recipient_ready = true,
      updated_at = now(),
      last_action_by = v_user_id,
      revision = revision + 1
    where id = p_trade_id;
  end if;

  select trade.*
  into v_trade
  from public.player_trades as trade
  where trade.id = p_trade_id
  for update;

  if not (
    v_trade.initiator_ready
    and v_trade.recipient_ready
  ) then
    return 'waiting';
  end if;

  if not exists (
    select 1
    from public.player_trade_items as item
    where item.trade_id = p_trade_id
      and item.owner_id = v_trade.initiator_id
  ) then
    raise exception 'The first trainer has not offered a card.';
  end if;

  if not exists (
    select 1
    from public.player_trade_items as item
    where item.trade_id = p_trade_id
      and item.owner_id = v_trade.recipient_id
  ) then
    raise exception 'The second trainer has not offered a card.';
  end if;

  select format_type(
    attribute.atttypid,
    attribute.atttypmod
  )
  into v_card_id_type
  from pg_attribute as attribute
  where attribute.attrelid =
      'public.player_inventory'::regclass
    and attribute.attname = 'card_id'
    and not attribute.attisdropped;

  if v_card_id_type is null then
    raise exception 'player_inventory.card_id is missing.';
  end if;

  -- Validate and lock every source row in one deterministic order before
  -- changing either collection. Any problem rolls back both confirmations.
  for v_item in
    select
      item.owner_id,
      item.card_id,
      item.quantity
    from public.player_trade_items as item
    where item.trade_id = p_trade_id
    order by item.owner_id, item.card_id
  loop
    v_source_quantity := null;
    v_source_reserved := null;

    select
      coalesce(inventory.quantity, 0),
      coalesce(inventory.reserved_quantity, 0)
    into
      v_source_quantity,
      v_source_reserved
    from public.player_inventory as inventory
    where inventory.user_id = v_item.owner_id
      and inventory.card_id::text = v_item.card_id
    for update;

    if not found
       or coalesce(v_source_quantity, 0) < v_item.quantity
       or coalesce(v_source_reserved, 0) < v_item.quantity then
      raise exception
        'A reserved card is no longer available. No cards were transferred.';
    end if;
  end loop;

  for v_item in
    select
      item.owner_id,
      item.card_id,
      item.quantity
    from public.player_trade_items as item
    where item.trade_id = p_trade_id
    order by item.owner_id, item.card_id
  loop
    update public.player_inventory
    set
      quantity = coalesce(quantity, 0) - v_item.quantity,
      reserved_quantity = greatest(
        0,
        coalesce(reserved_quantity, 0) - v_item.quantity
      )
    where user_id = v_item.owner_id
      and card_id::text = v_item.card_id
      and coalesce(quantity, 0) >= v_item.quantity
      and coalesce(reserved_quantity, 0) >= v_item.quantity;

    get diagnostics v_updated = row_count;

    if v_updated <> 1 then
      raise exception
        'A reserved card changed during completion. No cards were transferred.';
    end if;

    v_recipient_id := case
      when v_item.owner_id = v_trade.initiator_id
        then v_trade.recipient_id
      else v_trade.initiator_id
    end;

    update public.player_inventory
    set quantity = coalesce(quantity, 0) + v_item.quantity
    where user_id = v_recipient_id
      and card_id::text = v_item.card_id;

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
      v_sql :=
        'insert into public.player_inventory ' ||
        '(user_id, card_id, quantity, reserved_quantity) ' ||
        'values ($1, ' ||
        quote_literal(v_item.card_id) ||
        '::' || v_card_id_type ||
        ', $2, 0)';

      begin
        execute v_sql
        using v_recipient_id, v_item.quantity;
      exception
        when unique_violation then
          update public.player_inventory
          set quantity = coalesce(quantity, 0) + v_item.quantity
          where user_id = v_recipient_id
            and card_id::text = v_item.card_id;

          get diagnostics v_updated = row_count;

          if v_updated <> 1 then
            raise exception
              'The receiving collection could not be updated safely.';
          end if;
      end;
    end if;

    delete from public.player_inventory
    where user_id = v_item.owner_id
      and card_id::text = v_item.card_id
      and coalesce(quantity, 0) <= 0
      and coalesce(reserved_quantity, 0) <= 0;
  end loop;

  update public.player_trades
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now()),
    updated_at = now(),
    last_action_by = v_user_id,
    revision = revision + 1
  where id = p_trade_id;

  return 'completed';
end;
$function$;

revoke all
on function public.set_player_trade_ready(uuid)
from public;

grant execute
on function public.set_player_trade_ready(uuid)
to authenticated;

-- Realtime is an enhancement; polling in the page remains the fallback.
do $realtime$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'player_trades'
    ) then
      alter publication supabase_realtime
      add table public.player_trades;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'player_trade_items'
    ) then
      alter publication supabase_realtime
      add table public.player_trade_items;
    end if;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Realtime publication could not be changed; polling remains active.';
end;
$realtime$;

notify pgrst, 'reload schema';

select
  'V9 ready' as status,
  to_regclass('public.shaymin_mood_state') is not null
    as shaymin_mood_table_ready,
  to_regprocedure('public.set_player_trade_ready(uuid)') is not null
    as trade_completion_ready;
