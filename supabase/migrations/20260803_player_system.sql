-- ============================================================
-- PocketPulls player system
-- Jirachi wishes, player profiles, collections, leaderboard,
-- orders and free shipping at 100 cards.
-- ============================================================

begin;

-- ============================================================
-- Shared updated_at trigger
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Player profiles
-- ============================================================

create table if not exists public.player_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  username text not null,
  display_name text not null,

  avatar_url text,

  favourite_card_id bigint
    references public.pokemon_cards(id)
    on delete set null,

  bio text not null default '',

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint player_profiles_username_length
    check (
      char_length(username)
      between 3 and 24
    ),

  constraint player_profiles_username_format
    check (
      username ~ '^[A-Za-z0-9_]+$'
    ),

  constraint player_profiles_display_name_length
    check (
      char_length(display_name)
      between 1 and 40
    ),

  constraint player_profiles_bio_length
    check (
      char_length(bio) <= 240
    )
);

create unique index if not exists
  player_profiles_username_lower_key
on public.player_profiles (
  lower(username)
);

drop trigger if exists
  player_profiles_set_updated_at
on public.player_profiles;

create trigger
  player_profiles_set_updated_at
before update
on public.player_profiles
for each row
execute function public.set_updated_at();

-- ============================================================
-- Wish wallets
-- ============================================================

create table if not exists public.player_wallets (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  wish_balance integer
    not null
    default 0,

  lifetime_wishes_received integer
    not null
    default 0,

  lifetime_wishes_spent integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint player_wallets_balance_non_negative
    check (
      wish_balance >= 0
    ),

  constraint player_wallets_received_non_negative
    check (
      lifetime_wishes_received >= 0
    ),

  constraint player_wallets_spent_non_negative
    check (
      lifetime_wishes_spent >= 0
    )
);

drop trigger if exists
  player_wallets_set_updated_at
on public.player_wallets;

create trigger
  player_wallets_set_updated_at
before update
on public.player_wallets
for each row
execute function public.set_updated_at();

-- ============================================================
-- Orders and customer spending
-- Payments will later be written by the server/payment webhook.
-- ============================================================

create table if not exists public.player_orders (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  status text not null
    default 'pending',

  currency text not null
    default 'GBP',

  amount_pence bigint not null
    default 0,

  wishes_granted integer not null
    default 0,

  payment_provider text,

  payment_reference text,

  created_at timestamptz
    not null
    default now(),

  paid_at timestamptz,

  constraint player_orders_status_valid
    check (
      status in (
        'pending',
        'paid',
        'failed',
        'cancelled',
        'refunded',
        'partially_refunded'
      )
    ),

  constraint player_orders_currency_valid
    check (
      currency ~ '^[A-Z]{3}$'
    ),

  constraint player_orders_amount_non_negative
    check (
      amount_pence >= 0
    ),

  constraint player_orders_wishes_non_negative
    check (
      wishes_granted >= 0
    )
);

create index if not exists
  player_orders_user_created_idx
on public.player_orders (
  user_id,
  created_at desc
);

create unique index if not exists
  player_orders_payment_reference_key
on public.player_orders (
  payment_reference
)
where payment_reference is not null;

-- ============================================================
-- Wish wallet ledger
-- Every balance change receives an immutable ledger row.
-- ============================================================

create table if not exists public.wish_transactions (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  balance_change integer not null,

  transaction_type text not null,

  order_id uuid
    references public.player_orders(id)
    on delete set null,

  description text not null
    default '',

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint wish_transactions_change_not_zero
    check (
      balance_change <> 0
    ),

  constraint wish_transactions_type_valid
    check (
      transaction_type in (
        'purchase',
        'wish_spent',
        'refund',
        'promotion',
        'admin_credit',
        'admin_debit'
      )
    )
);

create index if not exists
  wish_transactions_user_created_idx
on public.wish_transactions (
  user_id,
  created_at desc
);

-- ============================================================
-- Wish results
-- source_inventory_id connects a wish to admin physical stock.
-- No FK is added yet so this remains compatible with the
-- current inventory ID implementation.
-- ============================================================

create table if not exists public.player_wishes (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  card_id bigint not null
    references public.pokemon_cards(id)
    on delete restrict,

  source_inventory_id bigint,

  wish_cost integer not null
    default 1,

  market_value_at_wish numeric(12, 2)
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  constraint player_wishes_cost_positive
    check (
      wish_cost > 0
    ),

  constraint player_wishes_value_non_negative
    check (
      market_value_at_wish >= 0
    )
);

create index if not exists
  player_wishes_user_created_idx
on public.player_wishes (
  user_id,
  created_at desc
);

-- ============================================================
-- Player collection
--
-- Admin inventory = physical PocketPulls warehouse stock.
-- Player inventory = ownership rights for customer cards.
--
-- reserved_quantity is used while cards are inside an active
-- shipping request.
-- ============================================================

create table if not exists public.player_inventory (
  id bigint generated by default
    as identity
    primary key,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  card_id bigint not null
    references public.pokemon_cards(id)
    on delete restrict,

  quantity integer not null
    default 1,

  reserved_quantity integer not null
    default 0,

  acquired_via text not null
    default 'wish',

  first_acquired_at timestamptz
    not null
    default now(),

  last_acquired_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint player_inventory_quantity_positive
    check (
      quantity > 0
    ),

  constraint player_inventory_reserved_valid
    check (
      reserved_quantity >= 0
      and reserved_quantity <= quantity
    ),

  constraint player_inventory_acquired_via_valid
    check (
      acquired_via in (
        'wish',
        'promotion',
        'gift',
        'admin'
      )
    ),

  constraint player_inventory_user_card_unique
    unique (
      user_id,
      card_id
    )
);

create index if not exists
  player_inventory_user_idx
on public.player_inventory (
  user_id
);

create index if not exists
  player_inventory_card_idx
on public.player_inventory (
  card_id
);

drop trigger if exists
  player_inventory_set_updated_at
on public.player_inventory;

create trigger
  player_inventory_set_updated_at
before update
on public.player_inventory
for each row
execute function public.set_updated_at();

-- ============================================================
-- Shipping configuration
-- ============================================================

create table if not exists public.shipping_settings (
  id smallint primary key
    default 1,

  free_shipping_card_threshold integer
    not null
    default 100,

  updated_at timestamptz
    not null
    default now(),

  constraint shipping_settings_single_row
    check (
      id = 1
    ),

  constraint shipping_settings_threshold_positive
    check (
      free_shipping_card_threshold > 0
    )
);

insert into public.shipping_settings (
  id,
  free_shipping_card_threshold
)
values (
  1,
  100
)
on conflict (id)
do update set
  free_shipping_card_threshold =
    excluded.free_shipping_card_threshold;

drop trigger if exists
  shipping_settings_set_updated_at
on public.shipping_settings;

create trigger
  shipping_settings_set_updated_at
before update
on public.shipping_settings
for each row
execute function public.set_updated_at();

-- ============================================================
-- Player shipping addresses
-- ============================================================

create table if not exists public.shipping_addresses (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  recipient_name text not null,

  line_1 text not null,
  line_2 text,

  city text not null,
  county text,

  postcode text not null,
  country_code text not null
    default 'GB',

  phone text,

  is_default boolean not null
    default false,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint shipping_addresses_country_code_valid
    check (
      country_code ~ '^[A-Z]{2}$'
    )
);

create index if not exists
  shipping_addresses_user_idx
on public.shipping_addresses (
  user_id
);

drop trigger if exists
  shipping_addresses_set_updated_at
on public.shipping_addresses;

create trigger
  shipping_addresses_set_updated_at
before update
on public.shipping_addresses
for each row
execute function public.set_updated_at();

-- ============================================================
-- Shipping requests
-- ============================================================

create table if not exists public.shipping_requests (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  address_id uuid not null
    references public.shipping_addresses(id)
    on delete restrict,

  status text not null
    default 'submitted',

  card_count integer not null,

  shipping_fee_pence bigint not null
    default 0,

  tracking_provider text,
  tracking_number text,

  requested_at timestamptz
    not null
    default now(),

  processing_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,

  admin_notes text not null
    default '',

  constraint shipping_requests_status_valid
    check (
      status in (
        'submitted',
        'processing',
        'packed',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),

  constraint shipping_requests_card_count_positive
    check (
      card_count > 0
    ),

  constraint shipping_requests_fee_non_negative
    check (
      shipping_fee_pence >= 0
    )
);

create index if not exists
  shipping_requests_user_created_idx
on public.shipping_requests (
  user_id,
  requested_at desc
);

create index if not exists
  shipping_requests_status_idx
on public.shipping_requests (
  status
);

-- ============================================================
-- Cards reserved inside each shipment
-- ============================================================

create table if not exists public.shipping_request_items (
  id bigint generated by default
    as identity
    primary key,

  shipping_request_id uuid not null
    references public.shipping_requests(id)
    on delete cascade,

  player_inventory_id bigint not null
    references public.player_inventory(id)
    on delete restrict,

  card_id bigint not null
    references public.pokemon_cards(id)
    on delete restrict,

  quantity integer not null,

  created_at timestamptz
    not null
    default now(),

  constraint shipping_request_items_quantity_positive
    check (
      quantity > 0
    ),

  constraint shipping_request_items_inventory_unique
    unique (
      shipping_request_id,
      player_inventory_id
    )
);

create index if not exists
  shipping_request_items_request_idx
on public.shipping_request_items (
  shipping_request_id
);

-- ============================================================
-- Automatically create player records for new auth users
-- ============================================================

create or replace function public.create_player_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
  generated_display_name text;
begin
  generated_username :=
    'trainer_' ||
    substr(
      replace(
        new.id::text,
        '-',
        ''
      ),
      1,
      8
    );

  generated_display_name :=
    coalesce(
      nullif(
        trim(
          new.raw_user_meta_data
            ->> 'display_name'
        ),
        ''
      ),
      nullif(
        split_part(
          coalesce(
            new.email,
            ''
          ),
          '@',
          1
        ),
        ''
      ),
      'Pokemon Trainer'
    );

  insert into public.player_profiles (
    user_id,
    username,
    display_name
  )
  values (
    new.id,
    generated_username,
    generated_display_name
  )
  on conflict (user_id)
  do nothing;

  insert into public.player_wallets (
    user_id
  )
  values (
    new.id
  )
  on conflict (user_id)
  do nothing;

  return new;
end;
$$;

drop trigger if exists
  create_player_after_auth_signup
on auth.users;

create trigger
  create_player_after_auth_signup
after insert
on auth.users
for each row
execute function public.create_player_for_new_user();

-- Backfill existing auth users.

insert into public.player_profiles (
  user_id,
  username,
  display_name
)
select
  users.id,

  'trainer_' ||
  substr(
    replace(
      users.id::text,
      '-',
      ''
    ),
    1,
    8
  ),

  coalesce(
    nullif(
      trim(
        users.raw_user_meta_data
          ->> 'display_name'
      ),
      ''
    ),

    nullif(
      split_part(
        coalesce(
          users.email,
          ''
        ),
        '@',
        1
      ),
      ''
    ),

    'Pokemon Trainer'
  )
from auth.users as users
on conflict (user_id)
do nothing;

insert into public.player_wallets (
  user_id
)
select
  users.id
from auth.users as users
on conflict (user_id)
do nothing;

-- ============================================================
-- Safe public leaderboard
--
-- Score formula:
--   card market value in pennies
--   + 25 points per owned card
--   + 10 points per completed wish
--
-- This formula is intentionally transparent and can later be
-- adjusted without rewriting player data.
-- ============================================================

create or replace view public.player_leaderboard
as
with inventory_stats as (
  select
    player_inventory.user_id,

    coalesce(
      sum(
        player_inventory.quantity
      ),
      0
    )::bigint
      as total_cards,

    coalesce(
      sum(
        player_inventory.quantity *
        coalesce(
          pokemon_cards.market_value,
          0
        )
      ),
      0
    )::numeric(14, 2)
      as inventory_market_value

  from public.player_inventory

  join public.pokemon_cards
    on pokemon_cards.id =
       player_inventory.card_id

  group by
    player_inventory.user_id
),

wish_stats as (
  select
    player_wishes.user_id,

    count(*)::bigint
      as total_wishes

  from public.player_wishes

  group by
    player_wishes.user_id
),

spending_stats as (
  select
    player_orders.user_id,

    coalesce(
      sum(
        player_orders.amount_pence
      ),
      0
    )::bigint
      as amount_spent_pence

  from public.player_orders

  where
    player_orders.status =
      'paid'

  group by
    player_orders.user_id
),

scored_players as (
  select
    player_profiles.user_id,
    player_profiles.username,
    player_profiles.display_name,
    player_profiles.avatar_url,
    player_profiles.favourite_card_id,

    favourite_card.name
      as favourite_card_name,

    favourite_card.image_url
      as favourite_card_image_url,

    coalesce(
      inventory_stats.total_cards,
      0
    )::bigint
      as total_cards,

    coalesce(
      inventory_stats.inventory_market_value,
      0
    )::numeric(14, 2)
      as inventory_market_value,

    coalesce(
      spending_stats.amount_spent_pence,
      0
    )::bigint
      as amount_spent_pence,

    coalesce(
      wish_stats.total_wishes,
      0
    )::bigint
      as total_wishes,

    (
      round(
        coalesce(
          inventory_stats.inventory_market_value,
          0
        ) * 100
      )::bigint

      +

      (
        coalesce(
          inventory_stats.total_cards,
          0
        ) * 25
      )

      +

      (
        coalesce(
          wish_stats.total_wishes,
          0
        ) * 10
      )
    )::bigint
      as leaderboard_score,

    player_profiles.created_at

  from public.player_profiles

  left join inventory_stats
    on inventory_stats.user_id =
       player_profiles.user_id

  left join wish_stats
    on wish_stats.user_id =
       player_profiles.user_id

  left join spending_stats
    on spending_stats.user_id =
       player_profiles.user_id

  left join public.pokemon_cards
    as favourite_card
    on favourite_card.id =
       player_profiles.favourite_card_id
)

select
  dense_rank() over (
    order by
      scored_players.leaderboard_score desc,
      scored_players.created_at asc
  )::bigint
    as leaderboard_rank,

  scored_players.user_id,
  scored_players.username,
  scored_players.display_name,
  scored_players.avatar_url,

  scored_players.favourite_card_id,
  scored_players.favourite_card_name,
  scored_players.favourite_card_image_url,

  scored_players.total_cards,
  scored_players.inventory_market_value,
  scored_players.amount_spent_pence,
  scored_players.total_wishes,
  scored_players.leaderboard_score

from scored_players;

-- ============================================================
-- Player shipping eligibility
-- ============================================================

create or replace view public.player_shipping_eligibility
as
with collection_totals as (
  select
    player_inventory.user_id,

    coalesce(
      sum(
        player_inventory.quantity
      ),
      0
    )::bigint
      as total_cards,

    coalesce(
      sum(
        player_inventory.reserved_quantity
      ),
      0
    )::bigint
      as reserved_cards,

    coalesce(
      sum(
        player_inventory.quantity -
        player_inventory.reserved_quantity
      ),
      0
    )::bigint
      as available_cards

  from public.player_inventory

  group by
    player_inventory.user_id
)

select
  player_profiles.user_id,

  coalesce(
    collection_totals.total_cards,
    0
  )::bigint
    as total_cards,

  coalesce(
    collection_totals.reserved_cards,
    0
  )::bigint
    as reserved_cards,

  coalesce(
    collection_totals.available_cards,
    0
  )::bigint
    as available_cards,

  shipping_settings
    .free_shipping_card_threshold,

  greatest(
    shipping_settings
      .free_shipping_card_threshold
      -
    coalesce(
      collection_totals.available_cards,
      0
    ),

    0
  )::bigint
    as cards_until_free_shipping,

  (
    coalesce(
      collection_totals.available_cards,
      0
    )
    >=
    shipping_settings
      .free_shipping_card_threshold
  )
    as qualifies_for_free_shipping

from public.player_profiles

cross join public.shipping_settings

left join collection_totals
  on collection_totals.user_id =
     player_profiles.user_id;

-- ============================================================
-- Secure free-shipping request RPC
--
-- Current behaviour:
-- - Requires at least 100 available cards.
-- - Ships all currently available cards.
-- - Reserves those quantities immediately.
-- - Costs £0.
-- ============================================================

create or replace function public.request_free_shipping(
  p_address_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  required_cards integer;
  available_card_count integer;
  new_request_id uuid;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required.';
  end if;

  select
    shipping_settings
      .free_shipping_card_threshold
  into
    required_cards
  from public.shipping_settings
  where
    shipping_settings.id = 1;

  if required_cards is null then
    raise exception
      'Shipping settings are unavailable.';
  end if;

  perform 1
  from public.shipping_addresses
  where
    shipping_addresses.id =
      p_address_id
    and
    shipping_addresses.user_id =
      current_user_id;

  if not found then
    raise exception
      'Shipping address not found.';
  end if;

  -- Lock all available player inventory rows before counting.

  perform
    player_inventory.id
  from public.player_inventory
  where
    player_inventory.user_id =
      current_user_id
    and
    player_inventory.quantity >
      player_inventory.reserved_quantity
  for update;

  select
    coalesce(
      sum(
        player_inventory.quantity -
        player_inventory.reserved_quantity
      ),
      0
    )::integer
  into
    available_card_count
  from public.player_inventory
  where
    player_inventory.user_id =
      current_user_id
    and
    player_inventory.quantity >
      player_inventory.reserved_quantity;

  if
    available_card_count <
    required_cards
  then
    raise exception
      'You need % available cards for free shipping. You currently have %.',
      required_cards,
      available_card_count;
  end if;

  insert into public.shipping_requests (
    user_id,
    address_id,
    status,
    card_count,
    shipping_fee_pence
  )
  values (
    current_user_id,
    p_address_id,
    'submitted',
    available_card_count,
    0
  )
  returning id
  into new_request_id;

  insert into public.shipping_request_items (
    shipping_request_id,
    player_inventory_id,
    card_id,
    quantity
  )
  select
    new_request_id,

    player_inventory.id,

    player_inventory.card_id,

    (
      player_inventory.quantity -
      player_inventory.reserved_quantity
    )

  from public.player_inventory

  where
    player_inventory.user_id =
      current_user_id
    and
    player_inventory.quantity >
      player_inventory.reserved_quantity;

  update public.player_inventory
  set
    reserved_quantity =
      quantity,

    updated_at =
      now()

  where
    player_inventory.user_id =
      current_user_id
    and
    player_inventory.quantity >
      player_inventory.reserved_quantity;

  return new_request_id;
end;
$$;

-- ============================================================
-- Allow player to cancel only before admin processing starts.
-- ============================================================

create or replace function public.cancel_shipping_request(
  p_shipping_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_status text;
  shipping_item record;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required.';
  end if;

  select
    shipping_requests.status
  into
    current_status
  from public.shipping_requests
  where
    shipping_requests.id =
      p_shipping_request_id
    and
    shipping_requests.user_id =
      current_user_id
  for update;

  if current_status is null then
    raise exception
      'Shipping request not found.';
  end if;

  if current_status <> 'submitted' then
    raise exception
      'This shipping request can no longer be cancelled.';
  end if;

  for shipping_item in
    select
      shipping_request_items
        .player_inventory_id,

      shipping_request_items
        .quantity

    from public.shipping_request_items

    where
      shipping_request_items
        .shipping_request_id =
      p_shipping_request_id
  loop
    update public.player_inventory
    set
      reserved_quantity =
        greatest(
          reserved_quantity -
          shipping_item.quantity,
          0
        ),

      updated_at =
        now()

    where
      player_inventory.id =
        shipping_item.player_inventory_id

      and

      player_inventory.user_id =
        current_user_id;
  end loop;

  update public.shipping_requests
  set
    status =
      'cancelled',

    cancelled_at =
      now()

  where
    shipping_requests.id =
      p_shipping_request_id;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.player_profiles
  enable row level security;

alter table public.player_wallets
  enable row level security;

alter table public.player_orders
  enable row level security;

alter table public.wish_transactions
  enable row level security;

alter table public.player_wishes
  enable row level security;

alter table public.player_inventory
  enable row level security;

alter table public.shipping_settings
  enable row level security;

alter table public.shipping_addresses
  enable row level security;

alter table public.shipping_requests
  enable row level security;

alter table public.shipping_request_items
  enable row level security;

alter table public.pokemon_cards
  enable row level security;

-- Catalogue

drop policy if exists
  "Catalogue cards are publicly readable"
on public.pokemon_cards;

create policy
  "Catalogue cards are publicly readable"
on public.pokemon_cards
for select
to anon, authenticated
using (true);

-- Profiles

drop policy if exists
  "Player profiles are publicly readable"
on public.player_profiles;

create policy
  "Player profiles are publicly readable"
on public.player_profiles
for select
to anon, authenticated
using (true);

drop policy if exists
  "Players update their own profile"
on public.player_profiles;

create policy
  "Players update their own profile"
on public.player_profiles
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

-- Wallets

drop policy if exists
  "Players view their own wallet"
on public.player_wallets;

create policy
  "Players view their own wallet"
on public.player_wallets
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Orders

drop policy if exists
  "Players view their own orders"
on public.player_orders;

create policy
  "Players view their own orders"
on public.player_orders
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Wish ledger

drop policy if exists
  "Players view their own wish transactions"
on public.wish_transactions;

create policy
  "Players view their own wish transactions"
on public.wish_transactions
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Wish results

drop policy if exists
  "Players view their own wishes"
on public.player_wishes;

create policy
  "Players view their own wishes"
on public.player_wishes
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Collection

drop policy if exists
  "Players view their own collection"
on public.player_inventory;

create policy
  "Players view their own collection"
on public.player_inventory
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Shipping settings

drop policy if exists
  "Shipping settings are readable"
on public.shipping_settings;

create policy
  "Shipping settings are readable"
on public.shipping_settings
for select
to anon, authenticated
using (true);

-- Addresses

drop policy if exists
  "Players view their own addresses"
on public.shipping_addresses;

create policy
  "Players view their own addresses"
on public.shipping_addresses
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Players create their own addresses"
on public.shipping_addresses;

create policy
  "Players create their own addresses"
on public.shipping_addresses
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Players update their own addresses"
on public.shipping_addresses;

create policy
  "Players update their own addresses"
on public.shipping_addresses
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Players delete their own addresses"
on public.shipping_addresses;

create policy
  "Players delete their own addresses"
on public.shipping_addresses
for delete
to authenticated
using (
  auth.uid() = user_id
);

-- Shipping requests

drop policy if exists
  "Players view their own shipping requests"
on public.shipping_requests;

create policy
  "Players view their own shipping requests"
on public.shipping_requests
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Shipping request items

drop policy if exists
  "Players view their own shipping request items"
on public.shipping_request_items;

create policy
  "Players view their own shipping request items"
on public.shipping_request_items
for select
to authenticated
using (
  exists (
    select 1
    from public.shipping_requests

    where
      shipping_requests.id =
        shipping_request_items
          .shipping_request_id

      and

      shipping_requests.user_id =
        auth.uid()
  )
);

-- ============================================================
-- Grants
-- ============================================================

grant select
on public.pokemon_cards
to anon, authenticated;

grant select
on public.player_profiles
to anon, authenticated;

grant update (
  username,
  display_name,
  avatar_url,
  favourite_card_id,
  bio
)
on public.player_profiles
to authenticated;

grant select
on public.player_wallets
to authenticated;

grant select
on public.player_orders
to authenticated;

grant select
on public.wish_transactions
to authenticated;

grant select
on public.player_wishes
to authenticated;

grant select
on public.player_inventory
to authenticated;

grant select
on public.shipping_settings
to anon, authenticated;

grant select, insert, update, delete
on public.shipping_addresses
to authenticated;

grant select
on public.shipping_requests
to authenticated;

grant select
on public.shipping_request_items
to authenticated;

grant select
on public.player_leaderboard
to anon, authenticated;

grant select
on public.player_shipping_eligibility
to authenticated;

grant execute
on function public.request_free_shipping(uuid)
to authenticated;

grant execute
on function public.cancel_shipping_request(uuid)
to authenticated;

commit;s