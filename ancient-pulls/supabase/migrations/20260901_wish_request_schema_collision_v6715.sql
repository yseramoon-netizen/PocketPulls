-- Ancient Pulls V67.15
-- Hotfixes installations where an older, incompatible table already owns the
-- player_wish_requests name. V67.15 deliberately uses a new versioned result
-- table, leaving unknown legacy data untouched, then replaces the public wish
-- RPC so it can never resolve against the incompatible relation again.
--
-- Security properties retained:
-- - the caller must be authenticated;
-- - one wish is spent atomically on the server;
-- - rarity and card selection remain server-authoritative;
-- - physical stock changes fulfilment, never draw probability;
-- - repeated request UUIDs return the original award without spending twice;
-- - suspended accounts cannot call the RPC directly to bypass the player UI.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null
     or to_regclass('public.player_wallets') is null then
    raise exception 'Player account tables are missing. Run the player-system and registration migrations first.';
  end if;

  if to_regclass('public.player_legal_consents') is null then
    raise exception 'public.player_legal_consents is missing. Run the V38 consent migration first.';
  end if;

  if to_regclass('public.player_wishes') is null
     or to_regclass('public.player_inventory') is null
     or to_regclass('public.inventory') is null
     or to_regclass('public.pokemon_cards') is null then
    raise exception 'Core wish and inventory tables are missing.';
  end if;

  if to_regclass('public.wish_rarity_tiers') is null
     or to_regclass('public.wish_pool_cards') is null
     or to_regclass('public.wish_fulfilment_obligations') is null then
    raise exception 'The V21 virtual wish-pool tables are missing.';
  end if;

  if to_regprocedure('public.complete_player_registration()') is null then
    raise exception 'public.complete_player_registration() is missing. Run the V61 registration migration first.';
  end if;

  if not exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.player_profiles'::regclass
      and attribute.attname = 'is_banned'
      and not attribute.attisdropped
  ) then
    raise exception 'player_profiles.is_banned is missing. Run the account hardening migrations first.';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.player_legal_consents'::regclass
      and constraint_row.conname = 'player_legal_consents_pkey'
      and constraint_row.contype = 'p'
  ) then
    raise exception 'player_legal_consents_pkey is missing.';
  end if;
end;
$preflight$;

-- `consent_version` is also an output-column variable in PL/pgSQL. Naming the
-- target constraint removes the 42702 ambiguity completely.
create or replace function public.accept_player_purchase_consent(
  p_age_18 boolean,
  p_random_physical_card boolean,
  p_terms boolean
)
returns table (
  accepted boolean,
  consent_version text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to save this acknowledgement.';
  end if;

  if p_age_18 is not true
     or p_random_physical_card is not true
     or p_terms is not true then
    raise exception using
      errcode = '22023',
      message = 'All account and purchase acknowledgements must be accepted.';
  end if;

  insert into public.player_legal_consents (
    user_id,
    consent_version,
    age_18_confirmed,
    random_physical_card_ack,
    terms_ack,
    source,
    accepted_at
  )
  values (
    v_user_id,
    '2026-09-01-v2',
    true,
    true,
    true,
    'existing_account_gate',
    v_accepted_at
  )
  on conflict on constraint player_legal_consents_pkey
  do update set
    age_18_confirmed = true,
    random_physical_card_ack = true,
    terms_ack = true,
    source = excluded.source,
    accepted_at = excluded.accepted_at;

  return query
  select
    true,
    '2026-09-01-v2'::text,
    v_accepted_at;
end;
$function$;

revoke all on function public.accept_player_purchase_consent(boolean, boolean, boolean) from public;
grant execute on function public.accept_player_purchase_consent(boolean, boolean, boolean) to authenticated;

-- Durable response storage makes every wish request repeat-safe. Players use
-- the RPC and cannot read or mutate this table directly.
create table if not exists public.player_wish_results_v6715 (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  wish_id text not null,
  card_id text not null,
  name text not null,
  set_name text not null,
  card_no text,
  rarity text not null,
  market_value numeric not null default 0,
  image_url text,
  wish_balance integer not null check (wish_balance >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index if not exists player_wish_results_v6715_created_idx
  on public.player_wish_results_v6715 (created_at);

alter table public.player_wish_results_v6715 enable row level security;
revoke all on table public.player_wish_results_v6715 from public, anon, authenticated;
grant all on table public.player_wish_results_v6715 to service_role;

-- Remove every stale one-argument overload before installing the public
-- release engine. This is the exact overload used by the current Wish page.
drop function if exists public.make_player_wish(text);
drop function if exists public.make_player_wish(uuid);

create function public.make_player_wish(
  p_idempotency_key uuid
)
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
  v_user_id uuid := auth.uid();
  v_existing public.player_wish_results_v6715%rowtype;
  v_current_balance integer;
  v_new_balance integer;
  v_rarity_tier text;
  v_random double precision;
  v_selected_card_id text;

  v_inventory_id text;
  v_inventory_id_type text;
  v_wish_card_id_type text;
  v_player_card_id_type text;
  v_wish_id text;
  v_remaining_quantity integer;
  v_player_inventory_updated integer;
  v_fulfilment_status text := 'source_needed';

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
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to make a wish.';
  end if;

  if p_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'A wish request key is required.';
  end if;

  -- One player lock covers retries and two different requests arriving at the
  -- same instant. It also closes the collection-row insert race.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text, 671400)
  );

  select request_row.*
  into v_existing
  from public.player_wish_results_v6715 as request_row
  where request_row.user_id = v_user_id
    and request_row.idempotency_key = p_idempotency_key;

  if found then
    select greatest(coalesce(wallet.wish_balance, v_existing.wish_balance), 0)
    into v_current_balance
    from public.player_wallets as wallet
    where wallet.user_id = v_user_id;

    return query
    select
      v_existing.wish_id,
      v_existing.card_id,
      v_existing.name,
      v_existing.set_name,
      v_existing.card_no,
      v_existing.rarity,
      v_existing.market_value,
      v_existing.image_url,
      coalesce(v_current_balance, v_existing.wish_balance);
    return;
  end if;

  -- Repair only accounts whose normal signup/bootstrap was interrupted. The
  -- shared function is idempotent and does not confer Founder entitlements.
  if not exists (
    select 1
    from public.player_profiles as profile
    where profile.user_id = v_user_id
  ) or not exists (
    select 1
    from public.player_wallets as wallet
    where wallet.user_id = v_user_id
  ) then
    perform * from public.complete_player_registration();
  end if;

  if exists (
    select 1
    from public.player_profiles as profile
    where profile.user_id = v_user_id
      and coalesce(profile.is_banned, false) = true
  ) then
    raise exception using
      errcode = '42501',
      message = 'This player account is suspended.';
  end if;

  select greatest(coalesce(wallet.wish_balance, 0), 0)
  into v_current_balance
  from public.player_wallets as wallet
  where wallet.user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Your wish wallet could not be prepared. Sign out and sign in again.';
  end if;

  if v_current_balance < 1 then
    raise exception using
      errcode = 'P0001',
      message = 'You do not have enough wishes.';
  end if;

  -- Weighted rarity draw. Card count inside a tier never changes tier odds.
  select candidate.rarity_tier
  into v_rarity_tier
  from (
    select tiers.rarity_tier, tiers.weight
    from public.wish_rarity_tiers as tiers
    where tiers.enabled = true
      and tiers.weight > 0
      and exists (
        select 1
        from public.wish_pool_cards as pool
        where pool.rarity_tier = tiers.rarity_tier
          and pool.enabled = true
      )
  ) as candidate
  order by -ln(greatest(random(), 0.0000001)) / candidate.weight
  limit 1;

  if v_rarity_tier is null then
    raise exception using message = 'The wish catalogue is currently empty.';
  end if;

  v_random := random();

  select pool.card_id
  into v_selected_card_id
  from public.wish_pool_cards as pool
  where pool.rarity_tier = v_rarity_tier
    and pool.enabled = true
    and pool.draw_key >= v_random
  order by pool.draw_key asc
  limit 1;

  if v_selected_card_id is null then
    select pool.card_id
    into v_selected_card_id
    from public.wish_pool_cards as pool
    where pool.rarity_tier = v_rarity_tier
      and pool.enabled = true
    order by pool.draw_key asc
    limit 1;
  end if;

  if v_selected_card_id is null then
    raise exception using message = 'No summonable card could be selected.';
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
  where cards.id::text = v_selected_card_id
  limit 1;

  if not found then
    raise exception using message = 'The selected wish-pool card is missing from pokemon_cards.';
  end if;

  -- Physical stock affects fulfilment only, never probability.
  select stock.id::text
  into v_inventory_id
  from public.inventory as stock
  where stock.card_id::text = v_selected_card_id
    and coalesce(stock.quantity, 0) > 0
  order by stock.quantity desc, stock.id::text asc
  limit 1
  for update skip locked;

  if v_inventory_id is not null then
    execute $stock_update$
      update public.inventory
      set quantity = quantity - 1
      where id::text = $1
        and quantity > 0
      returning quantity
    $stock_update$
    into v_remaining_quantity
    using v_inventory_id;

    if v_remaining_quantity is not null then
      v_fulfilment_status := 'ready';
    else
      v_inventory_id := null;
    end if;
  end if;

  update public.player_wallets as wallet
  set
    wish_balance = wallet.wish_balance - 1,
    lifetime_wishes_spent = coalesce(wallet.lifetime_wishes_spent, 0) + 1,
    updated_at = now()
  where wallet.user_id = v_user_id
  returning wallet.wish_balance
  into v_new_balance;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_wish_card_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.player_wishes'::regclass
    and attribute.attname = 'card_id'
    and not attribute.attisdropped;

  if v_wish_card_id_type is null then
    raise exception using message = 'player_wishes.card_id is missing.';
  end if;

  v_insert_columns := 'user_id, card_id, market_value_at_wish';
  v_insert_values :=
    '$1, ' ||
    quote_literal(v_selected_card_id) ||
    '::' ||
    v_wish_card_id_type ||
    ', $2';

  if v_inventory_id is not null then
    select format_type(attribute.atttypid, attribute.atttypmod)
    into v_inventory_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.player_wishes'::regclass
      and attribute.attname = 'inventory_id'
      and not attribute.attisdropped;

    if v_inventory_id_type is not null then
      v_insert_columns := v_insert_columns || ', inventory_id';
      v_insert_values :=
        v_insert_values ||
        ', ' ||
        quote_literal(v_inventory_id) ||
        '::' ||
        v_inventory_id_type;
    end if;
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

  insert into public.wish_fulfilment_obligations (
    wish_id,
    user_id,
    card_id,
    status,
    physical_inventory_id
  )
  values (
    v_wish_id,
    v_user_id,
    v_selected_card_id,
    v_fulfilment_status,
    v_inventory_id
  );

  execute $player_inventory_update$
    update public.player_inventory
    set quantity = coalesce(quantity, 0) + 1
    where user_id = $1
      and card_id::text = $2
  $player_inventory_update$
  using v_user_id, v_selected_card_id;

  get diagnostics v_player_inventory_updated = row_count;

  if v_player_inventory_updated = 0 then
    select format_type(attribute.atttypid, attribute.atttypmod)
    into v_player_card_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.player_inventory'::regclass
      and attribute.attname = 'card_id'
      and not attribute.attisdropped;

    if v_player_card_id_type is null then
      raise exception using message = 'player_inventory.card_id is missing.';
    end if;

    v_sql :=
      'insert into public.player_inventory ' ||
      '(user_id, card_id, quantity, reserved_quantity) values ($1, ' ||
      quote_literal(v_selected_card_id) ||
      '::' ||
      v_player_card_id_type ||
      ', 1, 0)';

    execute v_sql using v_user_id;
  end if;

  insert into public.player_wish_results_v6715 (
    user_id,
    idempotency_key,
    wish_id,
    card_id,
    name,
    set_name,
    card_no,
    rarity,
    market_value,
    image_url,
    wish_balance
  )
  values (
    v_user_id,
    p_idempotency_key,
    v_wish_id,
    v_selected_card_id,
    coalesce(v_name, 'Mystery card'),
    coalesce(v_set_name, 'Unknown set'),
    v_card_no,
    coalesce(v_rarity, 'Unlisted rarity'),
    coalesce(v_market_value, 0),
    v_image_url,
    v_new_balance
  );

  return query
  select
    v_wish_id,
    v_selected_card_id,
    coalesce(v_name, 'Mystery card'),
    coalesce(v_set_name, 'Unknown set'),
    v_card_no,
    coalesce(v_rarity, 'Unlisted rarity'),
    coalesce(v_market_value, 0),
    v_image_url,
    v_new_balance;
end;
$function$;

revoke all on function public.make_player_wish(uuid) from public, anon, authenticated;
grant execute on function public.make_player_wish(uuid) to authenticated;

-- The unversioned legacy overload is no longer a player entry point. Keeping
-- it service-role-only avoids breaking operator tooling while preventing a
-- caller from bypassing request idempotency.
do $legacy_overload$
begin
  if to_regprocedure('public.make_player_wish()') is not null then
    execute 'revoke all on function public.make_player_wish() from public, anon, authenticated';
    execute 'grant execute on function public.make_player_wish() to service_role';
  end if;
end;
$legacy_overload$;

comment on function public.make_player_wish(uuid) is
  'V67.15 public wish engine: authenticated, idempotent, server-authoritative, and independent of pre-release registration lists.';

notify pgrst, 'reload schema';

commit;
