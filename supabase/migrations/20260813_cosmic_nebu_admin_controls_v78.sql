-- Ancient Pulls V78
-- Shaymin-controlled Cosmic Nebu awards and reset-safe entitlement cleanup.

begin;

do $preflight$
begin
  if to_regclass('public.cosmic_nebu_ownerships') is null
    or to_regclass('public.cosmic_nebu_rolls') is null
    or to_regclass('public.player_wishes') is null
    or to_regclass('public.admin_player_events') is null then
    raise exception
      'V78 needs the Cosmic Nebu, player wishes and Shaymin player manager migrations first.';
  end if;
end;
$preflight$;

-- A Shaymin award is a real, numbered Cosmic Nebu entitlement, but it does not
-- pretend that a normal card pull discovered it.
alter table public.cosmic_nebu_ownerships
  alter column discovery_pull_id drop not null;

alter table public.cosmic_nebu_ownerships
  add column if not exists award_source text not null default 'wish',
  add column if not exists awarded_by_admin_user_id uuid,
  add column if not exists award_reason text;

update public.cosmic_nebu_ownerships
set award_source = 'wish'
where discovery_pull_id is not null;

alter table public.cosmic_nebu_ownerships
  drop constraint if exists cosmic_nebu_ownerships_award_source_check;

alter table public.cosmic_nebu_ownerships
  add constraint cosmic_nebu_ownerships_award_source_check
  check (award_source in ('wish', 'shaymin_admin'));

create or replace function public.admin_enable_cosmic_nebu(
  p_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_issue_number bigint;
  v_existing boolean := false;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_user_id is null then
    raise exception using message = 'Choose a player before enabling Cosmic Nebu.';
  end if;

  perform 1 from auth.users as account where account.id = p_user_id;
  if not found then
    raise exception using message = 'That Supabase Auth account does not exist.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 910001));

  select ownership.issue_number
  into v_issue_number
  from public.cosmic_nebu_ownerships as ownership
  where ownership.user_id = p_user_id
  for update;

  if found then
    v_existing := true;
  else
    insert into public.cosmic_nebu_ownerships (
      user_id,
      discovery_pull_id,
      award_source,
      awarded_by_admin_user_id,
      award_reason
    ) values (
      p_user_id,
      null,
      'shaymin_admin',
      p_admin_user_id,
      v_reason
    )
    returning issue_number into v_issue_number;

    insert into public.admin_player_events (
      admin_user_id,
      admin_email,
      player_user_id,
      event_type,
      reason,
      before_state,
      after_state
    ) values (
      p_admin_user_id,
      coalesce(nullif(btrim(p_admin_email), ''), 'unknown-admin'),
      p_user_id,
      'cosmic_nebu_enabled',
      v_reason,
      jsonb_build_object('cosmicNebu', false),
      jsonb_build_object(
        'cosmicNebu', true,
        'issueNumber', v_issue_number,
        'source', 'shaymin_admin'
      )
    );
  end if;

  return jsonb_build_object(
    'issueNumber', v_issue_number,
    'alreadyOwned', v_existing
  );
end;
$function$;

revoke all on function public.admin_enable_cosmic_nebu(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_enable_cosmic_nebu(uuid, uuid, text, text)
  to service_role;

-- Complete replacement of the V44 reset. Cosmic ownership and its immutable
-- roll history are now explicitly cleared in the same database transaction as
-- the rest of the fresh-account reset.
create or replace function public.admin_reset_player_account(
  p_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_before_balance integer := 0;
  v_starting_balance integer := 0;
  v_card_count bigint := 0;
  v_wish_count bigint := 0;
  v_cosmic_count bigint := 0;
  v_returned_stock bigint := 0;
  v_restored_count integer := 0;
  v_trade record;
  v_obligation record;
begin
  if p_user_id is null then
    raise exception using message = 'Choose a player account to reset.';
  end if;

  if p_admin_user_id = p_user_id then
    raise exception using message = 'You cannot reset the account currently running this Shaymin session.';
  end if;

  perform 1 from auth.users as account where account.id = p_user_id;
  if not found then
    raise exception using message = 'That Supabase Auth account does not exist.';
  end if;

  if exists (
    select 1 from public.player_shipping_shipments as shipment
    where shipment.user_id = p_user_id
      and shipment.status in ('requested', 'packing')
  ) or exists (
    select 1 from public.shipping_requests as request
    where request.user_id = p_user_id
      and request.status in ('submitted', 'processing', 'packed')
  ) then
    raise exception using message =
      'Finish or cancel this player''s active shipment before resetting the account.';
  end if;

  select greatest(coalesce(wallet.wish_balance, 0), 0)::integer
  into v_before_balance
  from public.player_wallets as wallet
  where wallet.user_id = p_user_id
  for update;

  v_before_balance := coalesce(v_before_balance, 0);

  select coalesce(sum(greatest(coalesce(owned.quantity, 0), 0)), 0)::bigint
  into v_card_count
  from public.player_inventory as owned
  where owned.user_id = p_user_id;

  select count(*)::bigint
  into v_wish_count
  from public.player_wishes as wish
  where wish.user_id = p_user_id;

  select count(*)::bigint
  into v_cosmic_count
  from public.cosmic_nebu_ownerships as ownership
  where ownership.user_id = p_user_id;

  select coalesce(promotion.wishes, 0)::integer
  into v_starting_balance
  from public.player_promotions as promotion
  where promotion.promotion_key = 'tester_signup_10_v1'
    and promotion.enabled = true
    and now() >= promotion.starts_at
    and (promotion.ends_at is null or now() < promotion.ends_at)
  limit 1;

  v_starting_balance := coalesce(v_starting_balance, 0);

  for v_trade in
    select trade.id
    from public.player_trades as trade
    where (trade.initiator_id = p_user_id or trade.recipient_id = p_user_id)
      and trade.status in ('open', 'countdown')
    for update
  loop
    perform public.unknown_pulls_release_trade_reservations(v_trade.id);
  end loop;

  delete from public.player_trades as trade
  where trade.initiator_id = p_user_id or trade.recipient_id = p_user_id;

  delete from public.player_friendships as friendship
  where friendship.requester_id = p_user_id
     or friendship.addressee_id = p_user_id
     or friendship.blocked_by = p_user_id;

  for v_obligation in
    select obligation.physical_inventory_id
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = p_user_id
      and obligation.physical_inventory_id is not null
      and obligation.status in ('ready', 'source_needed', 'source_requested', 'sourced', 'packed')
    for update
  loop
    execute $restore_stock$
      update public.inventory
      set quantity = greatest(coalesce(quantity, 0), 0) + 1
      where id::text = $1
    $restore_stock$
    using v_obligation.physical_inventory_id;

    get diagnostics v_restored_count = row_count;
    v_returned_stock := v_returned_stock + v_restored_count;
  end loop;

  delete from public.wish_fulfilment_obligations as obligation
  where obligation.user_id = p_user_id;

  delete from public.player_shipping_shipment_items as item
  where item.user_id = p_user_id;
  delete from public.player_shipping_shipments as shipment
  where shipment.user_id = p_user_id;
  delete from public.player_shipping_addresses_v2 as address
  where address.user_id = p_user_id;

  delete from public.shipping_request_items as item
  using public.shipping_requests as request
  where item.shipping_request_id = request.id and request.user_id = p_user_id;
  delete from public.shipping_requests as request where request.user_id = p_user_id;
  delete from public.shipping_addresses as address where address.user_id = p_user_id;

  delete from public.player_binder_positions where user_id = p_user_id;
  delete from public.player_binder_settings where user_id = p_user_id;
  delete from public.player_favourite_cards where user_id = p_user_id;
  delete from public.player_notification_reads where user_id = p_user_id;
  delete from public.player_onboarding_progress where user_id = p_user_id;
  delete from public.player_preferences where user_id = p_user_id;
  delete from public.player_achievements where user_id = p_user_id;
  delete from public.player_daily_rewards where user_id = p_user_id;
  delete from public.player_profile_details where user_id = p_user_id;
  delete from public.player_inventory where user_id = p_user_id;

  -- Ownership must be removed before its discovery wish because the original
  -- Cosmic Nebu schema deliberately protects that historical link.
  delete from public.cosmic_nebu_ownerships where user_id = p_user_id;
  delete from public.cosmic_nebu_rolls where user_id = p_user_id;
  delete from public.player_wishes where user_id = p_user_id;

  insert into public.player_wallets (
    user_id,
    wish_balance,
    lifetime_wishes_received,
    lifetime_wishes_spent,
    created_at,
    updated_at
  ) values (
    p_user_id,
    v_starting_balance,
    v_starting_balance,
    0,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    wish_balance = excluded.wish_balance,
    lifetime_wishes_received = excluded.lifetime_wishes_received,
    lifetime_wishes_spent = 0,
    updated_at = now();

  update public.player_profiles as profile
  set
    avatar_url = null,
    favourite_card_id = null,
    bio = '',
    last_seen_at = null,
    zodiac_sign = null,
    is_banned = false,
    ban_reason = null,
    banned_at = null,
    banned_by = null,
    updated_at = now()
  where profile.user_id = p_user_id;

  if not found then
    raise exception using message = 'That player profile does not exist.';
  end if;

  if v_starting_balance <> v_before_balance then
    insert into public.wish_transactions (
      user_id,
      balance_change,
      transaction_type,
      description,
      metadata
    ) values (
      p_user_id,
      v_starting_balance - v_before_balance,
      case when v_starting_balance > v_before_balance then 'admin_credit' else 'admin_debit' end,
      'Shaymin fresh-account reset',
      jsonb_build_object(
        'adminUserId', p_admin_user_id,
        'adminEmail', coalesce(p_admin_email, ''),
        'beforeBalance', v_before_balance,
        'startingBalance', v_starting_balance,
        'reason', nullif(btrim(coalesce(p_reason, '')), '')
      )
    );
  end if;

  insert into public.admin_player_events (
    admin_user_id,
    admin_email,
    player_user_id,
    event_type,
    amount,
    reason,
    before_state,
    after_state
  ) values (
    p_admin_user_id,
    coalesce(nullif(btrim(p_admin_email), ''), 'unknown-admin'),
    p_user_id,
    'fresh_account_reset',
    v_starting_balance - v_before_balance,
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'wishBalance', v_before_balance,
      'cards', v_card_count,
      'wishesMade', v_wish_count,
      'cosmicNebuOwnerships', v_cosmic_count
    ),
    jsonb_build_object(
      'wishBalance', v_starting_balance,
      'cards', 0,
      'wishesMade', 0,
      'cosmicNebuOwnerships', 0,
      'warehouseCardsReturned', v_returned_stock
    )
  );

  return jsonb_build_object(
    'startingWishBalance', v_starting_balance,
    'removedCards', v_card_count,
    'removedWishes', v_wish_count,
    'removedCosmicNebu', v_cosmic_count,
    'warehouseCardsReturned', v_returned_stock
  );
end;
$function$;

revoke all on function public.admin_reset_player_account(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_reset_player_account(uuid, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
