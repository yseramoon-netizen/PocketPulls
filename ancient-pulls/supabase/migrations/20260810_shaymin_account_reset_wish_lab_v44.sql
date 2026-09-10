-- Ancient Pulls V44
-- Protected gameplay reset for Shaymin and an audited live rarity-odds editor.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null
    or to_regclass('public.player_wallets') is null
    or to_regclass('public.player_inventory') is null
    or to_regclass('public.player_wishes') is null
    or to_regclass('public.admin_player_events') is null
    or to_regclass('public.wish_rarity_tiers') is null
    or to_regclass('public.wish_pool_cards') is null then
    raise exception
      'V44 needs the player system, Shaymin player manager and virtual wish pool migrations first.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- LIVE ODDS AUDIT
-- ---------------------------------------------------------------------------

create table if not exists public.admin_wish_odds_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text not null,
  reason text,
  before_state jsonb not null default '[]'::jsonb,
  after_state jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_wish_odds_events_created_idx
  on public.admin_wish_odds_events (created_at desc);

alter table public.admin_wish_odds_events enable row level security;
revoke all on table public.admin_wish_odds_events from public, anon, authenticated;
grant select, insert on table public.admin_wish_odds_events to service_role;

create or replace function public.admin_update_wish_rarity_odds(
  p_tiers jsonb,
  p_admin_user_id uuid,
  p_admin_email text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item jsonb;
  v_key text;
  v_weight numeric;
  v_enabled boolean;
  v_expected integer;
  v_seen integer := 0;
  v_enabled_total numeric := 0;
  v_before jsonb;
  v_after jsonb;
begin
  if jsonb_typeof(p_tiers) is distinct from 'array' then
    raise exception using message = 'Rarity odds must be supplied as an array.';
  end if;

  select count(*)::integer
  into v_expected
  from public.wish_rarity_tiers;

  if jsonb_array_length(p_tiers) <> v_expected then
    raise exception using message = 'Every rarity tier must be included exactly once.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rarityTier', tiers.rarity_tier,
        'displayName', tiers.display_name,
        'weight', tiers.weight,
        'enabled', tiers.enabled
      )
      order by tiers.sort_order, tiers.display_name
    ),
    '[]'::jsonb
  )
  into v_before
  from public.wish_rarity_tiers as tiers;

  for v_item in
    select value from jsonb_array_elements(p_tiers)
  loop
    v_key := btrim(coalesce(v_item ->> 'rarityTier', ''));

    begin
      v_weight := (v_item ->> 'weight')::numeric;
    exception when others then
      raise exception using message = 'Every rarity tier needs a valid numeric weight.';
    end;

    v_enabled := coalesce((v_item ->> 'enabled')::boolean, true);

    if v_key = '' or v_weight is null or v_weight <= 0 or v_weight > 1000000 then
      raise exception using message = 'Each rarity tier needs a positive weight.';
    end if;

    update public.wish_rarity_tiers as tiers
    set
      weight = v_weight,
      enabled = v_enabled,
      updated_at = now()
    where tiers.rarity_tier = v_key;

    if not found then
      raise exception using message = 'An unknown rarity tier was supplied.';
    end if;

    v_seen := v_seen + 1;
  end loop;

  if v_seen <> v_expected
    or (select count(distinct value ->> 'rarityTier') from jsonb_array_elements(p_tiers)) <> v_expected then
    raise exception using message = 'Every rarity tier must be included exactly once.';
  end if;

  select coalesce(sum(tiers.weight), 0)::numeric
  into v_enabled_total
  from public.wish_rarity_tiers as tiers
  where tiers.enabled = true;

  if abs(v_enabled_total - 100) > 0.01 then
    raise exception using message =
      format('Enabled rarity chances must total 100%%. They currently total %s%%.', round(v_enabled_total, 2));
  end if;

  if not exists (
    select 1
    from public.wish_rarity_tiers as tiers
    where tiers.enabled = true
      and tiers.weight > 0
      and exists (
        select 1
        from public.wish_pool_cards as pool
        where pool.rarity_tier = tiers.rarity_tier
          and pool.enabled = true
      )
  ) then
    raise exception using message = 'At least one rarity with cards in its pool must stay enabled.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rarityTier', tiers.rarity_tier,
        'displayName', tiers.display_name,
        'weight', tiers.weight,
        'enabled', tiers.enabled
      )
      order by tiers.sort_order, tiers.display_name
    ),
    '[]'::jsonb
  )
  into v_after
  from public.wish_rarity_tiers as tiers;

  insert into public.admin_wish_odds_events (
    admin_user_id,
    admin_email,
    reason,
    before_state,
    after_state
  ) values (
    p_admin_user_id,
    coalesce(nullif(btrim(p_admin_email), ''), 'unknown-admin'),
    nullif(btrim(coalesce(p_reason, '')), ''),
    v_before,
    v_after
  );

  return v_after;
end;
$function$;

revoke all on function public.admin_update_wish_rarity_odds(jsonb, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_wish_rarity_odds(jsonb, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- FRESH GAMEPLAY RESET
-- Keeps Auth identity, email/password, username, trainer code, legal consent,
-- payment records, admin access and private-account entitlements.
-- ---------------------------------------------------------------------------

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

  perform 1
  from auth.users as account
  where account.id = p_user_id;

  if not found then
    raise exception using message = 'That Supabase Auth account does not exist.';
  end if;

  if exists (
    select 1
    from public.player_shipping_shipments as shipment
    where shipment.user_id = p_user_id
      and shipment.status in ('requested', 'packing')
  ) or exists (
    select 1
    from public.shipping_requests as request
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

  select coalesce(promotion.wishes, 0)::integer
  into v_starting_balance
  from public.player_promotions as promotion
  where promotion.promotion_key = 'tester_signup_10_v1'
    and promotion.enabled = true
    and now() >= promotion.starts_at
    and (promotion.ends_at is null or now() < promotion.ends_at)
  limit 1;

  v_starting_balance := coalesce(v_starting_balance, 0);

  -- Release every reservation belonging to an open trade, including offers
  -- made by the other trainer in a trade with the reset account.
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
  where trade.initiator_id = p_user_id
     or trade.recipient_id = p_user_id;

  delete from public.player_friendships as friendship
  where friendship.requester_id = p_user_id
     or friendship.addressee_id = p_user_id
     or friendship.blocked_by = p_user_id;

  -- Return unshipped physical allocations to warehouse stock before removing
  -- the player's fulfilment ledger.
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

  -- Both generations of shipping tables are cleared only after the active
  -- shipment guard above. Paid order records remain untouched.
  delete from public.player_shipping_shipment_items as item
  where item.user_id = p_user_id;

  delete from public.player_shipping_shipments as shipment
  where shipment.user_id = p_user_id;

  delete from public.player_shipping_addresses_v2 as address
  where address.user_id = p_user_id;

  delete from public.shipping_request_items as item
  using public.shipping_requests as request
  where item.shipping_request_id = request.id
    and request.user_id = p_user_id;

  delete from public.shipping_requests as request
  where request.user_id = p_user_id;

  delete from public.shipping_addresses as address
  where address.user_id = p_user_id;

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
      case
        when v_starting_balance > v_before_balance then 'admin_credit'
        else 'admin_debit'
      end,
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
      'wishesMade', v_wish_count
    ),
    jsonb_build_object(
      'wishBalance', v_starting_balance,
      'cards', 0,
      'wishesMade', 0,
      'warehouseCardsReturned', v_returned_stock
    )
  );

  return jsonb_build_object(
    'startingWishBalance', v_starting_balance,
    'removedCards', v_card_count,
    'removedWishes', v_wish_count,
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
