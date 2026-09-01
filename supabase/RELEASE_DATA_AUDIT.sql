-- Ancient Pulls V67.15 release data audit
-- Read-only: this file does not insert, update or delete anything.
-- Run in the Supabase SQL editor immediately before launch. Every issue query
-- should return zero rows unless the result has been reviewed and accepted.

-- 1. Summary counts. Keep as the release evidence snapshot.
select
  (select count(*) from public.pokemon_cards) as catalogue_rows,
  (select count(*) from public.inventory) as inventory_rows,
  (select coalesce(sum(greatest(coalesce(quantity, 0), 0)), 0) from public.inventory)
    as physical_units,
  (select count(*) from public.inventory where coalesce(quantity, 0) > 0)
    as stocked_inventory_rows;

-- 2. Canonical catalogue duplicates. Duplicate identity is deliberately aligned
-- with the player catalogue's name + set + number + rarity grouping.
select
  lower(coalesce(nullif(btrim(name), ''), 'unknown card')) as name_key,
  lower(coalesce(nullif(btrim(set_name), ''), 'unknown set')) as set_key,
  lower(coalesce(nullif(btrim(card_no), ''), '')) as number_key,
  lower(coalesce(nullif(btrim(rarity), ''), 'common')) as rarity_key,
  count(*) as duplicate_rows,
  array_agg(id order by id) as card_ids
from public.pokemon_cards
group by 1, 2, 3, 4
having count(*) > 1
order by duplicate_rows desc, name_key, set_key, number_key;

-- 3. Catalogue rows missing player-visible identity or artwork.
select id, name, set_name, card_no, rarity, image_url
from public.pokemon_cards
where nullif(btrim(coalesce(name, '')), '') is null
   or nullif(btrim(coalesce(set_name, '')), '') is null
   or nullif(btrim(coalesce(card_no, '')), '') is null
   or nullif(btrim(coalesce(rarity, '')), '') is null
   or nullif(btrim(coalesce(image_url, '')), '') is null
order by set_name nulls first, name nulls first, card_no nulls first;

-- 4. Stock that cannot be fulfilled safely.
select stock.id, stock.card_id, stock.quantity, stock.status, stock.location
from public.inventory as stock
left join public.pokemon_cards as cards on cards.id::text = stock.card_id::text
where cards.id is null
   or stock.quantity is null
   or stock.quantity < 0
order by stock.card_id, stock.id;

-- 5. Stocked cards with no usable GBP market value. Catalogue pages intentionally
-- hide commercial stock/pricing statistics, but the server-side wish pool still
-- needs reviewed values for tiering and fulfilment controls.
select
  cards.id,
  cards.name,
  cards.set_name,
  cards.card_no,
  cards.rarity,
  cards.market_value,
  sum(greatest(coalesce(stock.quantity, 0), 0)) as units
from public.inventory as stock
join public.pokemon_cards as cards on cards.id::text = stock.card_id::text
group by cards.id, cards.name, cards.set_name, cards.card_no, cards.rarity, cards.market_value
having sum(greatest(coalesce(stock.quantity, 0), 0)) > 0
   and coalesce(cards.market_value, 0) <= 0
order by units desc, cards.name;

-- 6. Commerce orders requiring operator attention before opening the shop.
select id, user_id, package_id, status, amount_pence, created_at, updated_at
from public.wish_purchase_orders
where (status = 'pending' and created_at < now() - interval '35 minutes')
   or (status = 'paid' and confirmation_sent_at is null)
order by created_at;

-- 7. Paid-order integrity. These must always be zero rows.
select id, user_id, package_id, wishes, amount_pence, stripe_checkout_session_id,
  paid_at, checkout_acknowledgement_version, checkout_acknowledged_at
from public.wish_purchase_orders
where status = 'paid'
  and (
    stripe_checkout_session_id is null
    or paid_at is null
    or checkout_acknowledgement_version is null
    or checkout_acknowledged_at is null
  )
order by created_at;

-- 8. Auth users missing either ordinary player-account row. The V67.14 app
-- repairs these on the next authenticated load; investigate any rows that
-- remain after those players have signed in again.
select
  auth_user.id as user_id,
  auth_user.created_at,
  (profile.user_id is null) as missing_profile,
  (wallet.user_id is null) as missing_wallet
from auth.users as auth_user
left join public.player_profiles as profile on profile.user_id = auth_user.id
left join public.player_wallets as wallet on wallet.user_id = auth_user.id
where profile.user_id is null or wallet.user_id is null
order by auth_user.created_at;

-- 9. Retired pre-release access checks must not survive in either player wish
-- overload. This should return zero rows.
select
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid) as arguments
from pg_proc as procedure
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname = 'make_player_wish'
  and lower(procedure.prosrc) like '%beta%';

-- 10. The consent RPC must target the named primary-key constraint rather
-- than the ambiguous output-variable/column pair. This should return zero.
select
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid) as arguments
from pg_proc as procedure
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname = 'accept_player_purchase_consent'
  and lower(pg_get_functiondef(procedure.oid))
    like '%on conflict (user_id, consent_version)%';

-- 11. The V67.15 collision-proof idempotency table must contain every result
-- field used by the wish RPC. This should return zero rows.
with required_columns(column_name) as (
  values
    ('user_id'),
    ('idempotency_key'),
    ('wish_id'),
    ('card_id'),
    ('name'),
    ('set_name'),
    ('card_no'),
    ('rarity'),
    ('market_value'),
    ('image_url'),
    ('wish_balance'),
    ('created_at')
)
select required_columns.column_name as missing_column
from required_columns
left join information_schema.columns as actual
  on actual.table_schema = 'public'
 and actual.table_name = 'player_wish_results_v6715'
 and actual.column_name = required_columns.column_name
where actual.column_name is null
order by required_columns.column_name;
