-- PocketPulls repeat-safe atomic wish engine
--
-- This migration:
-- 1. Removes an incompatible single-column UNIQUE rule from
--    player_wishes.inventory_id when one exists.
-- 2. Replaces make_player_wish() with a repeat-safe function.
-- 3. Reloads the PostgREST schema cache.

do $block$
declare
  v_inventory_attribute smallint;
  v_constraint record;
  v_index record;
begin
  if to_regclass('public.player_wishes') is null then
    return;
  end if;

  select attribute.attnum
  into v_inventory_attribute
  from pg_attribute as attribute
  where attribute.attrelid =
      'public.player_wishes'::regclass
    and attribute.attname = 'inventory_id'
    and not attribute.attisdropped;

  if v_inventory_attribute is null then
    return;
  end if;

  for v_constraint in
    select constraint_row.conname
    from pg_constraint as constraint_row
    where constraint_row.conrelid =
        'public.player_wishes'::regclass
      and constraint_row.contype = 'u'
      and constraint_row.conkey =
        array[v_inventory_attribute]::smallint[]
  loop
    execute format(
      'alter table public.player_wishes drop constraint %I',
      v_constraint.conname
    );
  end loop;

  for v_index in
    select
      index_namespace.nspname as schema_name,
      index_class.relname as index_name
    from pg_index as index_row
    join pg_class as index_class
      on index_class.oid = index_row.indexrelid
    join pg_namespace as index_namespace
      on index_namespace.oid =
        index_class.relnamespace
    where index_row.indrelid =
        'public.player_wishes'::regclass
      and index_row.indisunique
      and not index_row.indisprimary
      and index_row.indnatts = 1
      and index_row.indkey::text =
        v_inventory_attribute::text
  loop
    execute format(
      'drop index if exists %I.%I',
      v_index.schema_name,
      v_index.index_name
    );
  end loop;
end;
$block$;

create or replace function public.make_player_wish()
returns table (
  wish_id text,
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  wish_balance integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_current_balance integer;
  v_new_balance integer;

  v_inventory_id text;
  v_inventory_card_id text;
  v_inventory_id_type text;

  v_wish_card_id_type text;
  v_player_card_id_type text;

  v_wish_id text;
  v_remaining_quantity integer;
  v_player_inventory_updated integer;

  v_name text;
  v_set_name text;
  v_card_no text;
  v_rarity text;
  v_market_value numeric;
  v_image_url text;

  v_insert_columns text;
  v_insert_values text;
  v_sql text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message =
        'You must be signed in to make a wish.';
  end if;

  select coalesce(wallet.wish_balance, 0)
  into v_current_balance
  from public.player_wallets as wallet
  where wallet.user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Your wish wallet does not exist.';
  end if;

  if v_current_balance < 1 then
    raise exception using
      errcode = 'P0001',
      message = 'You do not have enough wishes.';
  end if;

  execute $inventory_pick$
    select
      stock.id::text,
      stock.card_id::text
    from public.inventory as stock
    where coalesce(stock.quantity, 0) > 0
      and stock.card_id is not null
    order by
      -ln(greatest(random(), 0.0000001))
      / greatest(stock.quantity, 1)
    limit 1
    for update skip locked
  $inventory_pick$
  into v_inventory_id, v_inventory_card_id;

  if
    v_inventory_id is null or
    v_inventory_card_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'There are no physical cards available in the wish pool.';
  end if;

  select
    cards.name,
    cards.set_name,
    cards.card_no,
    cards.rarity,
    coalesce(cards.market_value, 0),
    cards.image_url
  into
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url
  from public.pokemon_cards as cards
  where cards.id::text = v_inventory_card_id
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected stock item is not connected to a Pokemon card.';
  end if;

  execute $stock_update$
    update public.inventory
    set quantity = quantity - 1
    where id::text = $1
      and quantity > 0
    returning quantity
  $stock_update$
  into v_remaining_quantity
  using v_inventory_id;

  if v_remaining_quantity is null then
    raise exception using
      errcode = 'P0001',
      message =
        'That card was claimed by another player. Please try again.';
  end if;

  update public.player_wallets as wallet
  set
    wish_balance = wallet.wish_balance - 1,
    lifetime_wishes_spent =
      coalesce(
        wallet.lifetime_wishes_spent,
        0
      ) + 1
  where wallet.user_id = v_user_id
  returning wallet.wish_balance
  into v_new_balance;

  select format_type(
    attribute.atttypid,
    attribute.atttypmod
  )
  into v_wish_card_id_type
  from pg_attribute as attribute
  where attribute.attrelid =
      'public.player_wishes'::regclass
    and attribute.attname = 'card_id'
    and not attribute.attisdropped;

  if v_wish_card_id_type is null then
    raise exception using
      errcode = '42703',
      message =
        'player_wishes.card_id is missing.';
  end if;

  v_insert_columns :=
    'user_id, card_id, market_value_at_wish';

  v_insert_values :=
    '$1, ' ||
    quote_literal(v_inventory_card_id) ||
    '::' ||
    v_wish_card_id_type ||
    ', $2';

  select format_type(
    attribute.atttypid,
    attribute.atttypmod
  )
  into v_inventory_id_type
  from pg_attribute as attribute
  where attribute.attrelid =
      'public.player_wishes'::regclass
    and attribute.attname = 'inventory_id'
    and not attribute.attisdropped;

  if v_inventory_id_type is not null then
    v_insert_columns :=
      v_insert_columns || ', inventory_id';

    v_insert_values :=
      v_insert_values ||
      ', ' ||
      quote_literal(v_inventory_id) ||
      '::' ||
      v_inventory_id_type;
  end if;

  v_sql :=
    'insert into public.player_wishes (' ||
    v_insert_columns ||
    ') values (' ||
    v_insert_values ||
    ') returning id::text';

  execute v_sql
  into v_wish_id
  using v_user_id, v_market_value;

  execute $player_inventory_update$
    update public.player_inventory
    set quantity = coalesce(quantity, 0) + 1
    where user_id = $1
      and card_id::text = $2
  $player_inventory_update$
  using v_user_id, v_inventory_card_id;

  get diagnostics
    v_player_inventory_updated = row_count;

  if v_player_inventory_updated = 0 then
    select format_type(
      attribute.atttypid,
      attribute.atttypmod
    )
    into v_player_card_id_type
    from pg_attribute as attribute
    where attribute.attrelid =
        'public.player_inventory'::regclass
      and attribute.attname = 'card_id'
      and not attribute.attisdropped;

    if v_player_card_id_type is null then
      raise exception using
        errcode = '42703',
        message =
          'player_inventory.card_id is missing.';
    end if;

    v_sql :=
      'insert into public.player_inventory ' ||
      '(user_id, card_id, quantity, reserved_quantity) ' ||
      'values ($1, ' ||
      quote_literal(v_inventory_card_id) ||
      '::' ||
      v_player_card_id_type ||
      ', 1, 0)';

    execute v_sql using v_user_id;
  end if;

  return query
  select
    v_wish_id,
    v_inventory_card_id,
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url,
    v_new_balance;
end;
$function$;

revoke all
on function public.make_player_wish()
from public;

grant execute
on function public.make_player_wish()
to authenticated;

notify pgrst, 'reload schema';
