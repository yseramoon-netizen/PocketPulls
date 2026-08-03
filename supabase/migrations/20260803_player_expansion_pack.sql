-- PocketPulls Player Expansion Pack
-- Generated 2026-08-03
--
-- Adds:
-- - Collection and wish-history RPCs
-- - Public player leaderboard RPC
-- - Extended player profile details
-- - Daily Jirachi reward streaks
-- - Persistent achievements
-- - A complete isolated player shipping workflow
--
-- This migration is additive. Existing PocketPulls card, wish, wallet,
-- profile and inventory records are not removed.

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception
      'public.player_profiles is missing. Run the player-system migration first.';
  end if;

  if to_regclass('public.player_wallets') is null then
    raise exception
      'public.player_wallets is missing. Run the player-system migration first.';
  end if;

  if to_regclass('public.player_inventory') is null then
    raise exception
      'public.player_inventory is missing. Run the player-system migration first.';
  end if;

  if to_regclass('public.player_wishes') is null then
    raise exception
      'public.player_wishes is missing. Run the player-system migration first.';
  end if;

  if to_regclass('public.pokemon_cards') is null then
    raise exception
      'public.pokemon_cards is missing.';
  end if;
end;
$preflight$;

-- ================================================================
-- PROFILE DETAILS
-- ================================================================

create table if not exists public.player_profile_details (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  bio text not null default '',
  favourite_pokemon text not null default '',
  location_label text not null default '',
  signature_card_id text,
  profile_public boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_profile_details_bio_length
    check (char_length(bio) <= 280),

  constraint player_profile_details_favourite_length
    check (char_length(favourite_pokemon) <= 40),

  constraint player_profile_details_location_length
    check (char_length(location_label) <= 80)
);

alter table public.player_profile_details
enable row level security;

drop policy if exists
  "Players read their profile details"
on public.player_profile_details;

create policy
  "Players read their profile details"
on public.player_profile_details
for select
to authenticated
using (
  auth.uid() = user_id
  or profile_public = true
);

drop policy if exists
  "Players insert their profile details"
on public.player_profile_details;

create policy
  "Players insert their profile details"
on public.player_profile_details
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists
  "Players update their profile details"
on public.player_profile_details;

create policy
  "Players update their profile details"
on public.player_profile_details
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update
on public.player_profile_details
to authenticated;

-- ================================================================
-- DAILY REWARDS
-- ================================================================

create table if not exists public.player_daily_rewards (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  last_claim_date date,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  total_claims integer not null default 0,
  total_wishes_awarded integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_daily_rewards_current_streak_nonnegative
    check (current_streak >= 0),

  constraint player_daily_rewards_longest_streak_nonnegative
    check (longest_streak >= 0),

  constraint player_daily_rewards_total_claims_nonnegative
    check (total_claims >= 0),

  constraint player_daily_rewards_total_awarded_nonnegative
    check (total_wishes_awarded >= 0)
);

alter table public.player_daily_rewards
enable row level security;

drop policy if exists
  "Players read their reward streak"
on public.player_daily_rewards;

create policy
  "Players read their reward streak"
on public.player_daily_rewards
for select
to authenticated
using (auth.uid() = user_id);

grant select
on public.player_daily_rewards
to authenticated;

-- ================================================================
-- ACHIEVEMENTS
-- ================================================================

create table if not exists public.player_achievements (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  achievement_key text not null,
  unlocked_at timestamptz not null default now(),

  primary key (user_id, achievement_key)
);

create index if not exists
  player_achievements_unlocked_at_idx
on public.player_achievements(unlocked_at desc);

alter table public.player_achievements
enable row level security;

drop policy if exists
  "Players read their achievements"
on public.player_achievements;

create policy
  "Players read their achievements"
on public.player_achievements
for select
to authenticated
using (auth.uid() = user_id);

grant select
on public.player_achievements
to authenticated;

-- ================================================================
-- SHIPPING
-- ================================================================

create table if not exists public.player_shipping_config (
  id smallint primary key default 1,
  free_shipping_card_threshold integer not null default 100,
  updated_at timestamptz not null default now(),

  constraint player_shipping_config_singleton
    check (id = 1),

  constraint player_shipping_config_threshold_positive
    check (free_shipping_card_threshold > 0)
);

insert into public.player_shipping_config (
  id,
  free_shipping_card_threshold
)
values (1, 100)
on conflict (id) do nothing;

create table if not exists public.player_shipping_addresses_v2 (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  label text not null default 'Home',
  recipient_name text not null,
  address_line_1 text not null,
  address_line_2 text not null default '',
  city text not null,
  county text not null default '',
  postcode text not null,
  country_code text not null default 'GB',
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_shipping_address_label_length
    check (char_length(label) between 1 and 40),

  constraint player_shipping_address_name_length
    check (char_length(recipient_name) between 1 and 120),

  constraint player_shipping_address_line1_length
    check (char_length(address_line_1) between 1 and 160),

  constraint player_shipping_address_line2_length
    check (char_length(address_line_2) <= 160),

  constraint player_shipping_address_city_length
    check (char_length(city) between 1 and 100),

  constraint player_shipping_address_county_length
    check (char_length(county) <= 100),

  constraint player_shipping_address_postcode_length
    check (char_length(postcode) between 2 and 20),

  constraint player_shipping_address_country_length
    check (char_length(country_code) = 2)
);

create index if not exists
  player_shipping_addresses_user_idx
on public.player_shipping_addresses_v2(user_id);

create unique index if not exists
  player_shipping_addresses_one_default_idx
on public.player_shipping_addresses_v2(user_id)
where is_default = true;

create table if not exists public.player_shipping_shipments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  address_id uuid
    references public.player_shipping_addresses_v2(id)
    on delete set null,

  status text not null default 'requested',
  card_count integer not null,
  tracking_number text,
  tracking_url text,
  notes text not null default '',

  requested_at timestamptz not null default now(),
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,

  constraint player_shipping_shipment_status
    check (
      status in (
        'requested',
        'packing',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),

  constraint player_shipping_shipment_card_count_positive
    check (card_count > 0)
);

create index if not exists
  player_shipping_shipments_user_idx
on public.player_shipping_shipments(
  user_id,
  requested_at desc
);

create unique index if not exists
  player_shipping_one_active_shipment_idx
on public.player_shipping_shipments(user_id)
where status in ('requested', 'packing');

create table if not exists public.player_shipping_shipment_items (
  shipment_id uuid not null
    references public.player_shipping_shipments(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  card_id text not null,
  quantity integer not null,

  primary key (shipment_id, card_id),

  constraint player_shipping_item_quantity_positive
    check (quantity > 0)
);

create index if not exists
  player_shipping_items_user_idx
on public.player_shipping_shipment_items(user_id);

alter table public.player_shipping_addresses_v2
enable row level security;

alter table public.player_shipping_shipments
enable row level security;

alter table public.player_shipping_shipment_items
enable row level security;

drop policy if exists
  "Players manage their shipping addresses"
on public.player_shipping_addresses_v2;

create policy
  "Players manage their shipping addresses"
on public.player_shipping_addresses_v2
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists
  "Players read their shipments"
on public.player_shipping_shipments;

create policy
  "Players read their shipments"
on public.player_shipping_shipments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists
  "Players read their shipment items"
on public.player_shipping_shipment_items;

create policy
  "Players read their shipment items"
on public.player_shipping_shipment_items
for select
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete
on public.player_shipping_addresses_v2
to authenticated;

grant select
on public.player_shipping_shipments
to authenticated;

grant select
on public.player_shipping_shipment_items
to authenticated;

grant select
on public.player_shipping_config
to authenticated;

-- ================================================================
-- COLLECTION
-- ================================================================

create or replace function public.get_player_collection_overview()
returns table (
  total_cards bigint,
  unique_cards bigint,
  available_cards bigint,
  reserved_cards bigint,
  collection_value numeric,
  sets jsonb,
  rarities jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with owned as (
    select
      inventory.card_id::text as card_id,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint
        as quantity,
      least(
        greatest(coalesce(inventory.reserved_quantity, 0), 0),
        greatest(coalesce(inventory.quantity, 0), 0)
      )::bigint as reserved_quantity,
      cards.set_name,
      cards.rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric
        as market_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    where inventory.user_id = auth.uid()
      and coalesce(inventory.quantity, 0) > 0
  )
  select
    coalesce(sum(owned.quantity), 0)::bigint,
    count(*)::bigint,
    coalesce(
      sum(owned.quantity - owned.reserved_quantity),
      0
    )::bigint,
    coalesce(sum(owned.reserved_quantity), 0)::bigint,
    coalesce(
      sum(owned.quantity * owned.market_value),
      0
    )::numeric,
    coalesce(
      jsonb_agg(distinct owned.set_name)
        filter (
          where owned.set_name is not null
            and btrim(owned.set_name) <> ''
        ),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(distinct owned.rarity)
        filter (
          where owned.rarity is not null
            and btrim(owned.rarity) <> ''
        ),
      '[]'::jsonb
    )
  from owned;
$function$;

create or replace function public.get_player_collection(
  p_search text,
  p_set_name text,
  p_rarity text,
  p_availability text,
  p_sort text,
  p_page integer,
  p_page_size integer
)
returns table (
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  quantity bigint,
  reserved_quantity bigint,
  available_quantity bigint,
  owned_value numeric,
  is_signature boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with owned as (
    select
      inventory.card_id::text as card_id,
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card')
        as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set')
        as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common')
        as rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric
        as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint
        as quantity,
      least(
        greatest(coalesce(inventory.reserved_quantity, 0), 0),
        greatest(coalesce(inventory.quantity, 0), 0)
      )::bigint as reserved_quantity,
      (
        details.signature_card_id = inventory.card_id::text
      ) as is_signature
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    left join public.player_profile_details as details
      on details.user_id = inventory.user_id
    where inventory.user_id = auth.uid()
      and coalesce(inventory.quantity, 0) > 0
  ),
  filtered as (
    select
      owned.*,
      owned.quantity - owned.reserved_quantity
        as available_quantity,
      owned.quantity * owned.market_value
        as owned_value
    from owned
    where (
      coalesce(btrim(p_search), '') = ''
      or owned.name ilike '%' || btrim(p_search) || '%'
      or owned.set_name ilike '%' || btrim(p_search) || '%'
      or coalesce(owned.card_no, '') ilike
        '%' || btrim(p_search) || '%'
    )
    and (
      coalesce(btrim(p_set_name), '') = ''
      or owned.set_name = p_set_name
    )
    and (
      coalesce(btrim(p_rarity), '') = ''
      or owned.rarity = p_rarity
    )
    and (
      coalesce(p_availability, 'all') = 'all'
      or (
        p_availability = 'available'
        and owned.quantity - owned.reserved_quantity > 0
      )
      or (
        p_availability = 'reserved'
        and owned.reserved_quantity > 0
      )
      or (
        p_availability = 'duplicates'
        and owned.quantity > 1
      )
    )
  ),
  counted as (
    select
      filtered.*,
      count(*) over()::bigint as total_count
    from filtered
  )
  select
    counted.card_id,
    counted.name,
    counted.set_name,
    counted.card_no,
    counted.rarity,
    counted.market_value,
    counted.image_url,
    counted.quantity,
    counted.reserved_quantity,
    counted.available_quantity,
    counted.owned_value,
    counted.is_signature,
    counted.total_count
  from counted
  order by
    counted.is_signature desc,

    case
      when p_sort = 'value_desc'
      then counted.owned_value
    end desc nulls last,

    case
      when p_sort = 'value_asc'
      then counted.owned_value
    end asc nulls last,

    case
      when p_sort = 'quantity_desc'
      then counted.quantity
    end desc nulls last,

    case
      when p_sort = 'newest'
      then counted.card_id
    end desc nulls last,

    lower(counted.name) asc,
    counted.set_name asc,
    counted.card_no asc nulls last

  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (
    greatest(1, coalesce(p_page, 1)) - 1
  ) * greatest(
    1,
    least(coalesce(p_page_size, 24), 60)
  );
$function$;

create or replace function public.set_player_signature_card(
  p_card_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.player_inventory as inventory
    where inventory.user_id = v_user_id
      and inventory.card_id::text = p_card_id
      and coalesce(inventory.quantity, 0) > 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You can only choose a card that you own.';
  end if;

  insert into public.player_profile_details (
    user_id,
    signature_card_id,
    updated_at
  )
  values (
    v_user_id,
    p_card_id,
    now()
  )
  on conflict (user_id)
  do update set
    signature_card_id = excluded.signature_card_id,
    updated_at = now();
end;
$function$;

-- ================================================================
-- WISH HISTORY
-- ================================================================

create or replace function public.get_player_wish_history(
  p_search text,
  p_rarity text,
  p_sort text,
  p_page integer,
  p_page_size integer
)
returns table (
  wish_id text,
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  image_url text,
  value_at_wish numeric,
  current_market_value numeric,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with history as (
    select
      wishes.id::text as wish_id,
      wishes.card_id::text as card_id,
      coalesce(nullif(btrim(cards.name), ''), 'Mystery card')
        as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set')
        as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common')
        as rarity,
      nullif(btrim(cards.image_url), '') as image_url,
      greatest(
        coalesce(wishes.market_value_at_wish, 0),
        0
      )::numeric as value_at_wish,
      greatest(
        coalesce(cards.market_value, 0),
        0
      )::numeric as current_market_value,
      wishes.created_at
    from public.player_wishes as wishes
    left join public.pokemon_cards as cards
      on cards.id::text = wishes.card_id::text
    where wishes.user_id = auth.uid()
  ),
  filtered as (
    select *
    from history
    where (
      coalesce(btrim(p_search), '') = ''
      or history.name ilike '%' || btrim(p_search) || '%'
      or history.set_name ilike '%' || btrim(p_search) || '%'
      or coalesce(history.card_no, '') ilike
        '%' || btrim(p_search) || '%'
    )
    and (
      coalesce(btrim(p_rarity), '') = ''
      or history.rarity = p_rarity
    )
  ),
  counted as (
    select
      filtered.*,
      count(*) over()::bigint as total_count
    from filtered
  )
  select
    counted.wish_id,
    counted.card_id,
    counted.name,
    counted.set_name,
    counted.card_no,
    counted.rarity,
    counted.image_url,
    counted.value_at_wish,
    counted.current_market_value,
    counted.created_at,
    counted.total_count
  from counted
  order by
    case
      when p_sort = 'oldest'
      then counted.created_at
    end asc nulls last,

    case
      when p_sort = 'value_desc'
      then counted.value_at_wish
    end desc nulls last,

    case
      when p_sort = 'value_asc'
      then counted.value_at_wish
    end asc nulls last,

    counted.created_at desc nulls last

  limit greatest(1, least(coalesce(p_page_size, 30), 80))
  offset (
    greatest(1, coalesce(p_page, 1)) - 1
  ) * greatest(
    1,
    least(coalesce(p_page_size, 30), 80)
  );
$function$;

-- ================================================================
-- LEADERBOARD
-- ================================================================

create or replace function public.get_player_leaderboard(
  p_limit integer default 100
)
returns table (
  rank_position bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_cards bigint,
  unique_cards bigint,
  collection_value numeric,
  lifetime_wishes bigint,
  score bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with inventory_totals as (
    select
      inventory.user_id,
      coalesce(
        sum(greatest(coalesce(inventory.quantity, 0), 0)),
        0
      )::bigint as total_cards,
      count(*) filter (
        where coalesce(inventory.quantity, 0) > 0
      )::bigint as unique_cards,
      coalesce(
        sum(
          greatest(coalesce(inventory.quantity, 0), 0)
          * greatest(coalesce(cards.market_value, 0), 0)
        ),
        0
      )::numeric as collection_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    group by inventory.user_id
  ),
  ranked_source as (
    select
      profiles.user_id,
      coalesce(
        nullif(btrim(profiles.username), ''),
        'trainer_' || left(replace(profiles.user_id::text, '-', ''), 8)
      ) as username,
      coalesce(
        nullif(btrim(profiles.display_name), ''),
        'Pokemon Trainer'
      ) as display_name,
      nullif(btrim(profiles.avatar_url), '') as avatar_url,
      coalesce(inventory.total_cards, 0)::bigint
        as total_cards,
      coalesce(inventory.unique_cards, 0)::bigint
        as unique_cards,
      coalesce(inventory.collection_value, 0)::numeric
        as collection_value,
      greatest(
        coalesce(wallets.lifetime_wishes_spent, 0),
        0
      )::bigint as lifetime_wishes,
      (
        round(
          coalesce(inventory.collection_value, 0) * 100
        )
        + coalesce(inventory.total_cards, 0) * 25
        + coalesce(inventory.unique_cards, 0) * 15
        + greatest(
            coalesce(wallets.lifetime_wishes_spent, 0),
            0
          ) * 10
      )::bigint as score
    from public.player_profiles as profiles
    left join inventory_totals as inventory
      on inventory.user_id = profiles.user_id
    left join public.player_wallets as wallets
      on wallets.user_id = profiles.user_id
    left join public.player_profile_details as details
      on details.user_id = profiles.user_id
    where coalesce(details.profile_public, true) = true
      or profiles.user_id = auth.uid()
  ),
  ranked as (
    select
      dense_rank() over (
        order by
          ranked_source.score desc,
          ranked_source.collection_value desc,
          ranked_source.total_cards desc,
          ranked_source.username asc
      )::bigint as rank_position,
      ranked_source.*
    from ranked_source
  )
  select
    ranked.rank_position,
    ranked.user_id,
    ranked.username,
    ranked.display_name,
    ranked.avatar_url,
    ranked.total_cards,
    ranked.unique_cards,
    ranked.collection_value,
    ranked.lifetime_wishes,
    ranked.score,
    ranked.user_id = auth.uid()
  from ranked
  where ranked.rank_position <= greatest(
    10,
    least(coalesce(p_limit, 100), 500)
  )
  or ranked.user_id = auth.uid()
  order by ranked.rank_position asc;
$function$;

-- ================================================================
-- PROFILE DASHBOARD AND UPDATE
-- ================================================================

create or replace function public.get_player_profile_dashboard()
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  favourite_pokemon text,
  location_label text,
  signature_card_id text,
  profile_public boolean,
  joined_at timestamptz,
  wish_balance bigint,
  lifetime_wishes bigint,
  total_cards bigint,
  unique_cards bigint,
  collection_value numeric,
  signature_name text,
  signature_set_name text,
  signature_card_no text,
  signature_rarity text,
  signature_market_value numeric,
  signature_image_url text
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  with inventory_totals as (
    select
      inventory.user_id,
      coalesce(
        sum(greatest(coalesce(inventory.quantity, 0), 0)),
        0
      )::bigint as total_cards,
      count(*) filter (
        where coalesce(inventory.quantity, 0) > 0
      )::bigint as unique_cards,
      coalesce(
        sum(
          greatest(coalesce(inventory.quantity, 0), 0)
          * greatest(coalesce(cards.market_value, 0), 0)
        ),
        0
      )::numeric as collection_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    where inventory.user_id = auth.uid()
    group by inventory.user_id
  )
  select
    profiles.user_id,
    users.email::text,
    coalesce(profiles.username, ''),
    coalesce(profiles.display_name, ''),
    profiles.avatar_url,
    coalesce(details.bio, ''),
    coalesce(details.favourite_pokemon, ''),
    coalesce(details.location_label, ''),
    details.signature_card_id,
    coalesce(details.profile_public, true),
    users.created_at,
    greatest(coalesce(wallets.wish_balance, 0), 0)::bigint,
    greatest(
      coalesce(wallets.lifetime_wishes_spent, 0),
      0
    )::bigint,
    coalesce(inventory.total_cards, 0)::bigint,
    coalesce(inventory.unique_cards, 0)::bigint,
    coalesce(inventory.collection_value, 0)::numeric,
    signature.name,
    signature.set_name,
    signature.card_no,
    signature.rarity,
    greatest(
      coalesce(signature.market_value, 0),
      0
    )::numeric,
    signature.image_url
  from public.player_profiles as profiles
  join auth.users as users
    on users.id = profiles.user_id
  left join public.player_wallets as wallets
    on wallets.user_id = profiles.user_id
  left join inventory_totals as inventory
    on inventory.user_id = profiles.user_id
  left join public.player_profile_details as details
    on details.user_id = profiles.user_id
  left join public.pokemon_cards as signature
    on signature.id::text = details.signature_card_id
  where profiles.user_id = auth.uid();
$function$;

create or replace function public.update_player_profile(
  p_username text,
  p_display_name text,
  p_avatar_url text,
  p_bio text,
  p_favourite_pokemon text,
  p_location_label text,
  p_profile_public boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using
      errcode = 'P0001',
      message =
        'Username must be 3-24 characters using letters, numbers and underscores.';
  end if;

  if char_length(v_display_name) < 1
    or char_length(v_display_name) > 60 then
    raise exception using
      errcode = 'P0001',
      message = 'Display name must be between 1 and 60 characters.';
  end if;

  if exists (
    select 1
    from public.player_profiles as profiles
    where lower(profiles.username) = v_username
      and profiles.user_id <> v_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'That username is already taken.';
  end if;

  update public.player_profiles
  set
    username = v_username,
    display_name = v_display_name,
    avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), '')
  where user_id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Your player profile does not exist.';
  end if;

  insert into public.player_profile_details (
    user_id,
    bio,
    favourite_pokemon,
    location_label,
    profile_public,
    updated_at
  )
  values (
    v_user_id,
    left(btrim(coalesce(p_bio, '')), 280),
    left(btrim(coalesce(p_favourite_pokemon, '')), 40),
    left(btrim(coalesce(p_location_label, '')), 80),
    coalesce(p_profile_public, true),
    now()
  )
  on conflict (user_id)
  do update set
    bio = excluded.bio,
    favourite_pokemon = excluded.favourite_pokemon,
    location_label = excluded.location_label,
    profile_public = excluded.profile_public,
    updated_at = now();
end;
$function$;

-- ================================================================
-- DAILY REWARD FUNCTIONS
-- ================================================================

create or replace function public.get_daily_reward_status()
returns table (
  claimed_today boolean,
  current_streak integer,
  longest_streak integer,
  total_claims integer,
  total_wishes_awarded integer,
  cycle_day integer,
  reward_today integer,
  reward_tomorrow integer,
  wish_balance integer,
  last_claim_date date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with reward as (
    select
      daily.last_claim_date,
      case
        when daily.last_claim_date is null then 0
        when daily.last_claim_date >= current_date - 1
          then greatest(daily.current_streak, 0)
        else 0
      end as effective_streak,
      greatest(daily.longest_streak, 0)
        as longest_streak,
      greatest(daily.total_claims, 0)
        as total_claims,
      greatest(daily.total_wishes_awarded, 0)
        as total_wishes_awarded
    from public.player_daily_rewards as daily
    where daily.user_id = auth.uid()
  ),
  values_row as (
    select
      reward.last_claim_date,
      reward.effective_streak,
      reward.longest_streak,
      reward.total_claims,
      reward.total_wishes_awarded
    from reward

    union all

    select
      null::date,
      0,
      0,
      0,
      0
    where not exists (select 1 from reward)
  )
  select
    values_row.last_claim_date = current_date,
    values_row.effective_streak,
    values_row.longest_streak,
    values_row.total_claims,
    values_row.total_wishes_awarded,
    (
      (values_row.effective_streak % 7) + 1
    )::integer,
    (
      (array[1, 1, 1, 2, 2, 3, 5])
      [
        (values_row.effective_streak % 7) + 1
      ]
    )::integer,
    (
      (array[1, 1, 1, 2, 2, 3, 5])
      [
        ((values_row.effective_streak + 1) % 7) + 1
      ]
    )::integer,
    greatest(coalesce(wallets.wish_balance, 0), 0),
    values_row.last_claim_date
  from values_row
  left join public.player_wallets as wallets
    on wallets.user_id = auth.uid()
  limit 1;
$function$;

create or replace function public.claim_daily_reward()
returns table (
  awarded_wishes integer,
  wish_balance integer,
  current_streak integer,
  longest_streak integer,
  total_claims integer,
  cycle_day integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_last_claim date;
  v_old_streak integer := 0;
  v_longest integer := 0;
  v_total_claims integer := 0;
  v_new_streak integer;
  v_reward integer;
  v_new_balance integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  insert into public.player_daily_rewards (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select
    daily.last_claim_date,
    daily.current_streak,
    daily.longest_streak,
    daily.total_claims
  into
    v_last_claim,
    v_old_streak,
    v_longest,
    v_total_claims
  from public.player_daily_rewards as daily
  where daily.user_id = v_user_id
  for update;

  if v_last_claim = current_date then
    raise exception using
      errcode = 'P0001',
      message = 'Jirachi has already given you today''s gift.';
  end if;

  if v_last_claim = current_date - 1 then
    v_new_streak := greatest(v_old_streak, 0) + 1;
  else
    v_new_streak := 1;
  end if;

  v_reward := (
    (array[1, 1, 1, 2, 2, 3, 5])
    [
      ((v_new_streak - 1) % 7) + 1
    ]
  )::integer;

  update public.player_wallets as wallets
  set wish_balance =
    greatest(coalesce(wallets.wish_balance, 0), 0)
    + v_reward
  where wallets.user_id = v_user_id
  returning wallets.wish_balance
  into v_new_balance;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Your wish wallet does not exist.';
  end if;

  update public.player_daily_rewards as daily
  set
    last_claim_date = current_date,
    current_streak = v_new_streak,
    longest_streak = greatest(v_longest, v_new_streak),
    total_claims = greatest(v_total_claims, 0) + 1,
    total_wishes_awarded =
      greatest(daily.total_wishes_awarded, 0)
      + v_reward,
    updated_at = now()
  where daily.user_id = v_user_id;

  return query
  select
    v_reward,
    v_new_balance,
    v_new_streak,
    greatest(v_longest, v_new_streak),
    greatest(v_total_claims, 0) + 1,
    ((v_new_streak - 1) % 7) + 1;
end;
$function$;

-- ================================================================
-- ACHIEVEMENT FUNCTIONS
-- ================================================================

create or replace function public.sync_player_achievements()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_wishes bigint := 0;
  v_cards bigint := 0;
  v_available bigint := 0;
  v_value numeric := 0;
  v_streak integer := 0;
  v_threshold integer := 100;
  v_inserted integer := 0;
  v_rows integer := 0;
begin
  if v_user_id is null then
    return 0;
  end if;

  select
    greatest(coalesce(wallets.lifetime_wishes_spent, 0), 0)
  into v_wishes
  from public.player_wallets as wallets
  where wallets.user_id = v_user_id;

  select
    coalesce(
      sum(greatest(coalesce(inventory.quantity, 0), 0)),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        * greatest(coalesce(cards.market_value, 0), 0)
      ),
      0
    )::numeric
  into
    v_cards,
    v_available,
    v_value
  from public.player_inventory as inventory
  left join public.pokemon_cards as cards
    on cards.id::text = inventory.card_id::text
  where inventory.user_id = v_user_id;

  select
    case
      when rewards.last_claim_date >= current_date - 1
        then greatest(rewards.current_streak, 0)
      else 0
    end
  into v_streak
  from public.player_daily_rewards as rewards
  where rewards.user_id = v_user_id;

  select config.free_shipping_card_threshold
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  v_wishes := coalesce(v_wishes, 0);
  v_cards := coalesce(v_cards, 0);
  v_available := coalesce(v_available, 0);
  v_value := coalesce(v_value, 0);
  v_streak := coalesce(v_streak, 0);
  v_threshold := greatest(coalesce(v_threshold, 100), 1);

  insert into public.player_achievements (
    user_id,
    achievement_key
  )
  select
    v_user_id,
    unlocked.achievement_key
  from (
    values
      ('first_wish', v_wishes >= 1),
      ('wish_apprentice', v_wishes >= 10),
      ('wish_master', v_wishes >= 100),
      ('constellation_keeper', v_wishes >= 50),
      ('first_card', v_cards >= 1),
      ('collector_25', v_cards >= 25),
      ('collector_100', v_cards >= 100),
      ('treasure_10', v_value >= 10),
      ('treasure_100', v_value >= 100),
      ('streak_3', v_streak >= 3),
      ('streak_7', v_streak >= 7),
      ('streak_30', v_streak >= 30),
      (
        'shipping_ready',
        v_available >= greatest(v_threshold, 1)
      )
  ) as unlocked(achievement_key, achieved)
  where unlocked.achieved
  on conflict (user_id, achievement_key) do nothing;

  get diagnostics v_rows = row_count;
  v_inserted := v_inserted + v_rows;

  return v_inserted;
end;
$function$;

create or replace function public.get_player_achievements()
returns table (
  achievement_key text,
  title text,
  description text,
  category text,
  icon text,
  current_value numeric,
  target_value numeric,
  progress_percent numeric,
  unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_wishes bigint := 0;
  v_cards bigint := 0;
  v_available bigint := 0;
  v_value numeric := 0;
  v_streak integer := 0;
  v_threshold integer := 100;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  perform public.sync_player_achievements();

  select
    greatest(coalesce(wallets.lifetime_wishes_spent, 0), 0)
  into v_wishes
  from public.player_wallets as wallets
  where wallets.user_id = v_user_id;

  select
    coalesce(
      sum(greatest(coalesce(inventory.quantity, 0), 0)),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        * greatest(coalesce(cards.market_value, 0), 0)
      ),
      0
    )::numeric
  into
    v_cards,
    v_available,
    v_value
  from public.player_inventory as inventory
  left join public.pokemon_cards as cards
    on cards.id::text = inventory.card_id::text
  where inventory.user_id = v_user_id;

  select
    case
      when rewards.last_claim_date >= current_date - 1
        then greatest(rewards.current_streak, 0)
      else 0
    end
  into v_streak
  from public.player_daily_rewards as rewards
  where rewards.user_id = v_user_id;

  select config.free_shipping_card_threshold
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  v_wishes := coalesce(v_wishes, 0);
  v_cards := coalesce(v_cards, 0);
  v_available := coalesce(v_available, 0);
  v_value := coalesce(v_value, 0);
  v_streak := coalesce(v_streak, 0);
  v_threshold := greatest(coalesce(v_threshold, 100), 1);

  return query
  with definitions as (
    select *
    from (
      values
        (
          'first_wish',
          'First Light',
          'Complete your first wish.',
          'Wishes',
          '★',
          v_wishes::numeric,
          1::numeric
        ),
        (
          'wish_apprentice',
          'Wish Apprentice',
          'Complete 10 wishes.',
          'Wishes',
          '✦',
          v_wishes::numeric,
          10::numeric
        ),
        (
          'wish_master',
          'Wish Master',
          'Complete 100 wishes.',
          'Wishes',
          '✧',
          v_wishes::numeric,
          100::numeric
        ),
        (
          'constellation_keeper',
          'Constellation Keeper',
          'Place 50 memories in your sky.',
          'Wishes',
          '☄',
          v_wishes::numeric,
          50::numeric
        ),
        (
          'first_card',
          'The First Card',
          'Own your first physical card.',
          'Collection',
          '◆',
          v_cards::numeric,
          1::numeric
        ),
        (
          'collector_25',
          'Growing Collection',
          'Own 25 physical cards.',
          'Collection',
          '◇',
          v_cards::numeric,
          25::numeric
        ),
        (
          'collector_100',
          'Hundred Card Archive',
          'Own 100 physical cards.',
          'Collection',
          '▣',
          v_cards::numeric,
          100::numeric
        ),
        (
          'treasure_10',
          'Pocket Treasure',
          'Build a collection worth £10.',
          'Value',
          '£',
          v_value,
          10::numeric
        ),
        (
          'treasure_100',
          'Vault of Starlight',
          'Build a collection worth £100.',
          'Value',
          '♢',
          v_value,
          100::numeric
        ),
        (
          'streak_3',
          'Three Nights',
          'Claim gifts for 3 consecutive days.',
          'Streak',
          '☾',
          v_streak::numeric,
          3::numeric
        ),
        (
          'streak_7',
          'Week of Wishes',
          'Claim gifts for 7 consecutive days.',
          'Streak',
          '☀',
          v_streak::numeric,
          7::numeric
        ),
        (
          'streak_30',
          'Jirachi''s Chosen',
          'Claim gifts for 30 consecutive days.',
          'Streak',
          '♛',
          v_streak::numeric,
          30::numeric
        ),
        (
          'shipping_ready',
          'Ready for the Journey',
          'Unlock free shipping.',
          'Shipping',
          '⌂',
          v_available::numeric,
          greatest(v_threshold, 1)::numeric
        )
    ) as values_table(
      achievement_key,
      title,
      description,
      category,
      icon,
      current_value,
      target_value
    )
  )
  select
    definitions.achievement_key,
    definitions.title,
    definitions.description,
    definitions.category,
    definitions.icon,
    definitions.current_value,
    definitions.target_value,
    least(
      100::numeric,
      greatest(
        0::numeric,
        case
          when definitions.target_value <= 0 then 100
          else
            definitions.current_value
            / definitions.target_value
            * 100
        end
      )
    ),
    achievements.unlocked_at
  from definitions
  left join public.player_achievements as achievements
    on achievements.user_id = v_user_id
    and achievements.achievement_key =
      definitions.achievement_key
  order by
    (achievements.unlocked_at is not null) desc,
    definitions.category,
    definitions.target_value;
end;
$function$;

-- ================================================================
-- SHIPPING FUNCTIONS
-- ================================================================

create or replace function public.get_player_shipping_eligibility()
returns table (
  threshold integer,
  total_cards bigint,
  available_cards bigint,
  reserved_cards bigint,
  progress_percent numeric,
  unlocked boolean,
  active_shipment_id uuid,
  active_status text,
  active_card_count integer,
  active_requested_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with totals as (
    select
      coalesce(
        sum(greatest(coalesce(inventory.quantity, 0), 0)),
        0
      )::bigint as total_cards,
      coalesce(
        sum(
          greatest(coalesce(inventory.quantity, 0), 0)
          - least(
              greatest(
                coalesce(inventory.reserved_quantity, 0),
                0
              ),
              greatest(coalesce(inventory.quantity, 0), 0)
            )
        ),
        0
      )::bigint as available_cards,
      coalesce(
        sum(
          least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
        ),
        0
      )::bigint as reserved_cards
    from public.player_inventory as inventory
    where inventory.user_id = auth.uid()
  ),
  config as (
    select
      greatest(
        shipping.free_shipping_card_threshold,
        1
      ) as threshold
    from public.player_shipping_config as shipping
    where shipping.id = 1
  ),
  active as (
    select
      shipments.id,
      shipments.status,
      shipments.card_count,
      shipments.requested_at
    from public.player_shipping_shipments as shipments
    where shipments.user_id = auth.uid()
      and shipments.status in ('requested', 'packing')
    order by shipments.requested_at desc
    limit 1
  )
  select
    config.threshold,
    totals.total_cards,
    totals.available_cards,
    totals.reserved_cards,
    least(
      100::numeric,
      (
        totals.available_cards::numeric
        / config.threshold::numeric
      ) * 100
    ),
    totals.available_cards >= config.threshold,
    active.id,
    active.status,
    active.card_count,
    active.requested_at
  from totals
  cross join config
  left join active on true;
$function$;

create or replace function public.save_player_shipping_address(
  p_address_id uuid,
  p_label text,
  p_recipient_name text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_city text,
  p_county text,
  p_postcode text,
  p_country_code text,
  p_is_default boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_should_default boolean;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if btrim(coalesce(p_recipient_name, '')) = ''
    or btrim(coalesce(p_address_line_1, '')) = ''
    or btrim(coalesce(p_city, '')) = ''
    or btrim(coalesce(p_postcode, '')) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'Name, first address line, city and postcode are required.';
  end if;

  v_should_default :=
    coalesce(p_is_default, false)
    or not exists (
      select 1
      from public.player_shipping_addresses_v2
      where user_id = v_user_id
    );

  if v_should_default then
    update public.player_shipping_addresses_v2
    set
      is_default = false,
      updated_at = now()
    where user_id = v_user_id
      and is_default = true;
  end if;

  if p_address_id is null then
    insert into public.player_shipping_addresses_v2 (
      user_id,
      label,
      recipient_name,
      address_line_1,
      address_line_2,
      city,
      county,
      postcode,
      country_code,
      is_default
    )
    values (
      v_user_id,
      left(
        coalesce(nullif(btrim(p_label), ''), 'Home'),
        40
      ),
      left(btrim(p_recipient_name), 120),
      left(btrim(p_address_line_1), 160),
      left(btrim(coalesce(p_address_line_2, '')), 160),
      left(btrim(p_city), 100),
      left(btrim(coalesce(p_county, '')), 100),
      upper(left(btrim(p_postcode), 20)),
      upper(
        left(
          coalesce(nullif(btrim(p_country_code), ''), 'GB'),
          2
        )
      ),
      v_should_default
    )
    returning id into v_address_id;
  else
    update public.player_shipping_addresses_v2
    set
      label = left(
        coalesce(nullif(btrim(p_label), ''), 'Home'),
        40
      ),
      recipient_name = left(btrim(p_recipient_name), 120),
      address_line_1 = left(btrim(p_address_line_1), 160),
      address_line_2 =
        left(btrim(coalesce(p_address_line_2, '')), 160),
      city = left(btrim(p_city), 100),
      county = left(btrim(coalesce(p_county, '')), 100),
      postcode = upper(left(btrim(p_postcode), 20)),
      country_code = upper(
        left(
          coalesce(nullif(btrim(p_country_code), ''), 'GB'),
          2
        )
      ),
      is_default = v_should_default,
      updated_at = now()
    where id = p_address_id
      and user_id = v_user_id
    returning id into v_address_id;

    if v_address_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'That shipping address was not found.';
    end if;
  end if;

  return v_address_id;
end;
$function$;

create or replace function public.delete_player_shipping_address(
  p_address_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_was_default boolean := false;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  select addresses.is_default
  into v_was_default
  from public.player_shipping_addresses_v2 as addresses
  where addresses.id = p_address_id
    and addresses.user_id = v_user_id;

  delete from public.player_shipping_addresses_v2
  where id = p_address_id
    and user_id = v_user_id;

  if v_was_default then
    update public.player_shipping_addresses_v2
    set
      is_default = true,
      updated_at = now()
    where id = (
      select addresses.id
      from public.player_shipping_addresses_v2 as addresses
      where addresses.user_id = v_user_id
      order by addresses.created_at asc
      limit 1
    );
  end if;
end;
$function$;

create or replace function public.request_player_shipment(
  p_address_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_threshold integer;
  v_available bigint;
  v_shipment_id uuid;
  v_item record;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  perform 1
  from public.player_shipping_addresses_v2 as addresses
  where addresses.id = p_address_id
    and addresses.user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Choose a valid shipping address.';
  end if;

  if exists (
    select 1
    from public.player_shipping_shipments as shipments
    where shipments.user_id = v_user_id
      and shipments.status in ('requested', 'packing')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You already have a shipment being prepared.';
  end if;

  select config.free_shipping_card_threshold
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  perform 1
  from public.player_inventory as inventory
  where inventory.user_id = v_user_id
  for update;

  select
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ),
      0
    )::bigint
  into v_available
  from public.player_inventory as inventory
  where inventory.user_id = v_user_id;

  if v_available < greatest(v_threshold, 1) then
    raise exception using
      errcode = 'P0001',
      message =
        'You have not reached the free-shipping threshold yet.';
  end if;

  insert into public.player_shipping_shipments (
    user_id,
    address_id,
    status,
    card_count
  )
  values (
    v_user_id,
    p_address_id,
    'requested',
    v_available::integer
  )
  returning id into v_shipment_id;

  for v_item in
    select
      inventory.card_id::text as card_id,
      (
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      )::integer as available_quantity
    from public.player_inventory as inventory
    where inventory.user_id = v_user_id
      and (
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(
              coalesce(inventory.reserved_quantity, 0),
              0
            ),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ) > 0
    for update
  loop
    insert into public.player_shipping_shipment_items (
      shipment_id,
      user_id,
      card_id,
      quantity
    )
    values (
      v_shipment_id,
      v_user_id,
      v_item.card_id,
      v_item.available_quantity
    );

    update public.player_inventory
    set reserved_quantity =
      least(
        greatest(coalesce(quantity, 0), 0),
        greatest(coalesce(reserved_quantity, 0), 0)
        + v_item.available_quantity
      )
    where user_id = v_user_id
      and card_id::text = v_item.card_id;
  end loop;

  perform public.sync_player_achievements();

  return v_shipment_id;
end;
$function$;

create or replace function public.cancel_player_shipment(
  p_shipment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_item record;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  perform 1
  from public.player_shipping_shipments as shipments
  where shipments.id = p_shipment_id
    and shipments.user_id = v_user_id
    and shipments.status = 'requested'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'Only a newly requested shipment can be cancelled.';
  end if;

  for v_item in
    select
      items.card_id,
      items.quantity
    from public.player_shipping_shipment_items as items
    where items.shipment_id = p_shipment_id
      and items.user_id = v_user_id
  loop
    update public.player_inventory
    set reserved_quantity = greatest(
      0,
      coalesce(reserved_quantity, 0)
      - v_item.quantity
    )
    where user_id = v_user_id
      and card_id::text = v_item.card_id;
  end loop;

  update public.player_shipping_shipments
  set
    status = 'cancelled',
    cancelled_at = now()
  where id = p_shipment_id
    and user_id = v_user_id;
end;
$function$;

-- ================================================================
-- FUNCTION PERMISSIONS
-- ================================================================

revoke all
on function public.get_player_collection_overview()
from public;

revoke all
on function public.get_player_collection(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer
)
from public;

revoke all
on function public.set_player_signature_card(text)
from public;

revoke all
on function public.get_player_wish_history(
  text,
  text,
  text,
  integer,
  integer
)
from public;

revoke all
on function public.get_player_leaderboard(integer)
from public;

revoke all
on function public.get_player_profile_dashboard()
from public;

revoke all
on function public.update_player_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from public;

revoke all
on function public.get_daily_reward_status()
from public;

revoke all
on function public.claim_daily_reward()
from public;

revoke all
on function public.sync_player_achievements()
from public;

revoke all
on function public.get_player_achievements()
from public;

revoke all
on function public.get_player_shipping_eligibility()
from public;

revoke all
on function public.save_player_shipping_address(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from public;

revoke all
on function public.delete_player_shipping_address(uuid)
from public;

revoke all
on function public.request_player_shipment(uuid)
from public;

revoke all
on function public.cancel_player_shipment(uuid)
from public;

grant execute
on function public.get_player_collection_overview()
to authenticated;

grant execute
on function public.get_player_collection(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer
)
to authenticated;

grant execute
on function public.set_player_signature_card(text)
to authenticated;

grant execute
on function public.get_player_wish_history(
  text,
  text,
  text,
  integer,
  integer
)
to authenticated;

grant execute
on function public.get_player_leaderboard(integer)
to authenticated;

grant execute
on function public.get_player_profile_dashboard()
to authenticated;

grant execute
on function public.update_player_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated;

grant execute
on function public.get_daily_reward_status()
to authenticated;

grant execute
on function public.claim_daily_reward()
to authenticated;

grant execute
on function public.sync_player_achievements()
to authenticated;

grant execute
on function public.get_player_achievements()
to authenticated;

grant execute
on function public.get_player_shipping_eligibility()
to authenticated;

grant execute
on function public.save_player_shipping_address(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated;

grant execute
on function public.delete_player_shipping_address(uuid)
to authenticated;

grant execute
on function public.request_player_shipment(uuid)
to authenticated;

grant execute
on function public.cancel_player_shipment(uuid)
to authenticated;

notify pgrst, 'reload schema';
