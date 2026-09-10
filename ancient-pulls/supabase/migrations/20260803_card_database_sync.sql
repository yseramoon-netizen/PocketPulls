-- PocketPulls complete card database and pricing sync
-- Adds source metadata, finish-specific prices and sync tracking.
--
-- Existing cards and inventory are preserved.

alter table public.pokemon_cards
  add column if not exists api_id text,
  add column if not exists set_id text,
  add column if not exists set_series text,
  add column if not exists set_release_date date,
  add column if not exists source_updated_at timestamptz,
  add column if not exists image_url_large text,
  add column if not exists supertype text,
  add column if not exists subtypes jsonb not null default '[]'::jsonb,
  add column if not exists artist text,
  add column if not exists national_pokedex_numbers integer[],
  add column if not exists tcgplayer_url text,
  add column if not exists tcgplayer_updated_at date,
  add column if not exists cardmarket_url text,
  add column if not exists cardmarket_updated_at date,
  add column if not exists price_normal_usd numeric,
  add column if not exists price_holo_usd numeric,
  add column if not exists price_reverse_holo_usd numeric,
  add column if not exists price_cardmarket_eur numeric,
  add column if not exists price_reverse_holo_eur numeric,
  add column if not exists market_value_normal_gbp numeric,
  add column if not exists market_value_holo_gbp numeric,
  add column if not exists market_value_reverse_holo_gbp numeric,
  add column if not exists price_source text,
  add column if not exists price_updated_at timestamptz,
  add column if not exists database_synced_at timestamptz;

create index if not exists pokemon_cards_api_id_idx
  on public.pokemon_cards(api_id);

create index if not exists pokemon_cards_set_id_idx
  on public.pokemon_cards(set_id);

create index if not exists pokemon_cards_price_updated_idx
  on public.pokemon_cards(price_updated_at);

create table if not exists public.card_sync_settings (
  id smallint primary key default 1,
  usd_to_gbp numeric,
  eur_to_gbp numeric,
  fx_date date,
  last_full_sync_at timestamptz,
  last_price_sync_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint card_sync_settings_singleton
    check (id = 1)
);

insert into public.card_sync_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.card_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_by uuid references auth.users(id) on delete set null,
  mode text not null default 'full',
  status text not null default 'running',
  current_page integer not null default 0,
  total_pages integer,
  cards_received integer not null default 0,
  cards_inserted integer not null default 0,
  cards_updated integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint card_sync_runs_mode_check
    check (mode in ('full', 'prices')),

  constraint card_sync_runs_status_check
    check (status in ('running', 'completed', 'failed', 'cancelled'))
);

create index if not exists card_sync_runs_started_at_idx
  on public.card_sync_runs(started_at desc);

alter table public.card_sync_settings enable row level security;
alter table public.card_sync_runs enable row level security;

drop policy if exists
  "Authenticated users can read card sync settings"
on public.card_sync_settings;

create policy
  "Authenticated users can read card sync settings"
on public.card_sync_settings
for select
to authenticated
using (true);

drop policy if exists
  "Authenticated users can read card sync runs"
on public.card_sync_runs;

create policy
  "Authenticated users can read card sync runs"
on public.card_sync_runs
for select
to authenticated
using (true);

grant select on public.card_sync_settings to authenticated;
grant select on public.card_sync_runs to authenticated;

create or replace function public.merge_pokemon_card_sync_batch(
  p_cards jsonb
)
returns table (
  received_count integer,
  inserted_count integer,
  updated_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_received integer := 0;
  v_existing integer := 0;
  v_inserted integer := 0;
begin
  if p_cards is null
    or jsonb_typeof(p_cards) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Card sync payload must be a JSON array.';
  end if;

  select count(*)
  into v_received
  from jsonb_array_elements(p_cards);

  select count(*)
  into v_existing
  from public.pokemon_cards as cards
  where cards.api_id in (
    select payload.api_id
    from jsonb_to_recordset(p_cards) as payload(
      api_id text
    )
    where payload.api_id is not null
      and btrim(payload.api_id) <> ''
  );

  with payload as (
    select *
    from jsonb_to_recordset(p_cards) as incoming(
      api_id text,
      name text,
      rarity text,
      set_name text,
      card_no text,
      image_url text,
      image_url_large text,
      market_value numeric,
      set_id text,
      set_series text,
      set_release_date date,
      source_updated_at timestamptz,
      supertype text,
      subtypes jsonb,
      artist text,
      national_pokedex_numbers integer[],
      tcgplayer_url text,
      tcgplayer_updated_at date,
      cardmarket_url text,
      cardmarket_updated_at date,
      price_normal_usd numeric,
      price_holo_usd numeric,
      price_reverse_holo_usd numeric,
      price_cardmarket_eur numeric,
      price_reverse_holo_eur numeric,
      market_value_normal_gbp numeric,
      market_value_holo_gbp numeric,
      market_value_reverse_holo_gbp numeric,
      price_source text,
      price_updated_at timestamptz,
      database_synced_at timestamptz
    )
  )
  update public.pokemon_cards as cards
  set
    name = coalesce(payload.name, cards.name),
    rarity = coalesce(payload.rarity, cards.rarity),
    set_name = coalesce(payload.set_name, cards.set_name),
    card_no = coalesce(payload.card_no, cards.card_no),
    image_url = coalesce(payload.image_url, cards.image_url),
    image_url_large = coalesce(
      payload.image_url_large,
      cards.image_url_large
    ),
    market_value = coalesce(
      payload.market_value,
      cards.market_value
    ),
    set_id = coalesce(payload.set_id, cards.set_id),
    set_series = coalesce(
      payload.set_series,
      cards.set_series
    ),
    set_release_date = coalesce(
      payload.set_release_date,
      cards.set_release_date
    ),
    source_updated_at = coalesce(
      payload.source_updated_at,
      cards.source_updated_at
    ),
    supertype = coalesce(
      payload.supertype,
      cards.supertype
    ),
    subtypes = coalesce(
      payload.subtypes,
      cards.subtypes,
      '[]'::jsonb
    ),
    artist = coalesce(payload.artist, cards.artist),
    national_pokedex_numbers = coalesce(
      payload.national_pokedex_numbers,
      cards.national_pokedex_numbers
    ),
    tcgplayer_url = coalesce(
      payload.tcgplayer_url,
      cards.tcgplayer_url
    ),
    tcgplayer_updated_at = coalesce(
      payload.tcgplayer_updated_at,
      cards.tcgplayer_updated_at
    ),
    cardmarket_url = coalesce(
      payload.cardmarket_url,
      cards.cardmarket_url
    ),
    cardmarket_updated_at = coalesce(
      payload.cardmarket_updated_at,
      cards.cardmarket_updated_at
    ),
    price_normal_usd = payload.price_normal_usd,
    price_holo_usd = payload.price_holo_usd,
    price_reverse_holo_usd =
      payload.price_reverse_holo_usd,
    price_cardmarket_eur =
      payload.price_cardmarket_eur,
    price_reverse_holo_eur =
      payload.price_reverse_holo_eur,
    market_value_normal_gbp =
      payload.market_value_normal_gbp,
    market_value_holo_gbp =
      payload.market_value_holo_gbp,
    market_value_reverse_holo_gbp =
      payload.market_value_reverse_holo_gbp,
    price_source = payload.price_source,
    price_updated_at = payload.price_updated_at,
    database_synced_at =
      payload.database_synced_at
  from payload
  where cards.api_id = payload.api_id;

  with payload as (
    select *
    from jsonb_to_recordset(p_cards) as incoming(
      api_id text,
      name text,
      rarity text,
      set_name text,
      card_no text,
      image_url text,
      image_url_large text,
      market_value numeric,
      set_id text,
      set_series text,
      set_release_date date,
      source_updated_at timestamptz,
      supertype text,
      subtypes jsonb,
      artist text,
      national_pokedex_numbers integer[],
      tcgplayer_url text,
      tcgplayer_updated_at date,
      cardmarket_url text,
      cardmarket_updated_at date,
      price_normal_usd numeric,
      price_holo_usd numeric,
      price_reverse_holo_usd numeric,
      price_cardmarket_eur numeric,
      price_reverse_holo_eur numeric,
      market_value_normal_gbp numeric,
      market_value_holo_gbp numeric,
      market_value_reverse_holo_gbp numeric,
      price_source text,
      price_updated_at timestamptz,
      database_synced_at timestamptz
    )
  )
  insert into public.pokemon_cards (
    api_id,
    name,
    rarity,
    set_name,
    card_no,
    image_url,
    image_url_large,
    market_value,
    set_id,
    set_series,
    set_release_date,
    source_updated_at,
    supertype,
    subtypes,
    artist,
    national_pokedex_numbers,
    tcgplayer_url,
    tcgplayer_updated_at,
    cardmarket_url,
    cardmarket_updated_at,
    price_normal_usd,
    price_holo_usd,
    price_reverse_holo_usd,
    price_cardmarket_eur,
    price_reverse_holo_eur,
    market_value_normal_gbp,
    market_value_holo_gbp,
    market_value_reverse_holo_gbp,
    price_source,
    price_updated_at,
    database_synced_at
  )
  select
    payload.api_id,
    coalesce(payload.name, 'Unknown card'),
    payload.rarity,
    payload.set_name,
    payload.card_no,
    payload.image_url,
    payload.image_url_large,
    coalesce(payload.market_value, 0),
    payload.set_id,
    payload.set_series,
    payload.set_release_date,
    payload.source_updated_at,
    payload.supertype,
    coalesce(payload.subtypes, '[]'::jsonb),
    payload.artist,
    payload.national_pokedex_numbers,
    payload.tcgplayer_url,
    payload.tcgplayer_updated_at,
    payload.cardmarket_url,
    payload.cardmarket_updated_at,
    payload.price_normal_usd,
    payload.price_holo_usd,
    payload.price_reverse_holo_usd,
    payload.price_cardmarket_eur,
    payload.price_reverse_holo_eur,
    payload.market_value_normal_gbp,
    payload.market_value_holo_gbp,
    payload.market_value_reverse_holo_gbp,
    payload.price_source,
    payload.price_updated_at,
    payload.database_synced_at
  from payload
  where payload.api_id is not null
    and btrim(payload.api_id) <> ''
    and not exists (
      select 1
      from public.pokemon_cards as existing
      where existing.api_id = payload.api_id
    );

  get diagnostics v_inserted = row_count;

  return query
  select
    v_received,
    v_inserted,
    greatest(v_existing, 0);
end;
$function$;

create or replace function public.get_card_database_sync_stats()
returns table (
  total_cards bigint,
  cards_with_api_id bigint,
  cards_with_prices bigint,
  cards_without_prices bigint,
  cards_without_images bigint,
  stale_price_cards bigint,
  last_full_sync_at timestamptz,
  last_price_sync_at timestamptz,
  usd_to_gbp numeric,
  eur_to_gbp numeric,
  fx_date date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    count(*)::bigint,
    count(*) filter (
      where cards.api_id is not null
        and btrim(cards.api_id) <> ''
    )::bigint,
    count(*) filter (
      where coalesce(cards.market_value, 0) > 0
    )::bigint,
    count(*) filter (
      where coalesce(cards.market_value, 0) <= 0
    )::bigint,
    count(*) filter (
      where cards.image_url is null
        or btrim(cards.image_url) = ''
    )::bigint,
    count(*) filter (
      where cards.price_updated_at is null
        or cards.price_updated_at <
          now() - interval '7 days'
    )::bigint,
    settings.last_full_sync_at,
    settings.last_price_sync_at,
    settings.usd_to_gbp,
    settings.eur_to_gbp,
    settings.fx_date
  from public.pokemon_cards as cards
  cross join public.card_sync_settings as settings
  where settings.id = 1
  group by
    settings.last_full_sync_at,
    settings.last_price_sync_at,
    settings.usd_to_gbp,
    settings.eur_to_gbp,
    settings.fx_date;
$function$;

revoke all
on function public.merge_pokemon_card_sync_batch(jsonb)
from public;

revoke all
on function public.get_card_database_sync_stats()
from public;

grant execute
on function public.merge_pokemon_card_sync_batch(jsonb)
to service_role;

grant execute
on function public.get_card_database_sync_stats()
to authenticated;

notify pgrst, 'reload schema';
