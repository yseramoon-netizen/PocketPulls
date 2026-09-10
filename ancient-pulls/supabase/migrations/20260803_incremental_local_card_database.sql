-- PocketPulls incremental local card database
--
-- Replaces repeated full-card API walks with:
-- 1. A locally downloaded copy of PokemonTCG/pokemon-tcg-data.
-- 2. Per-file Git blob SHA tracking.
-- 3. Per-card source hash tracking.
-- 4. A separate price queue that processes only missing or stale cards.
--
-- Existing cards, inventory, wishes and prices are preserved.

do $preflight$
begin
  if to_regclass('public.pokemon_cards') is null then
    raise exception 'public.pokemon_cards is missing.';
  end if;

  if to_regclass('public.card_sync_settings') is null
    or to_regclass('public.card_sync_runs') is null then
    raise exception
      'Run the previous Card Database Sync migration before this incremental upgrade.';
  end if;
end;
$preflight$;

alter table public.pokemon_cards
  add column if not exists source_record_hash text,
  add column if not exists source_file_path text,
  add column if not exists source_commit_sha text,
  add column if not exists price_checked_at timestamptz,
  add column if not exists price_status text default 'unknown',
  add column if not exists price_error text,
  add column if not exists price_retry_after timestamptz;

update public.pokemon_cards
set price_status = case
  when coalesce(market_value, 0) > 0 then 'priced'
  else 'unknown'
end
where price_status is null
   or btrim(price_status) = '';

alter table public.pokemon_cards
  alter column price_status set default 'unknown';

alter table public.pokemon_cards
  alter column price_status set not null;

alter table public.pokemon_cards
  drop constraint if exists pokemon_cards_price_status_check;

alter table public.pokemon_cards
  add constraint pokemon_cards_price_status_check
  check (
    price_status in (
      'unknown',
      'priced',
      'unpriced',
      'failed'
    )
  );

create index if not exists pokemon_cards_source_hash_idx
  on public.pokemon_cards(source_record_hash);

create index if not exists pokemon_cards_source_file_idx
  on public.pokemon_cards(source_file_path);

create index if not exists pokemon_cards_price_queue_idx
  on public.pokemon_cards(price_checked_at, price_status)
  where api_id is not null;

alter table public.card_sync_settings
  add column if not exists local_source_commit_sha text,
  add column if not exists local_source_path text,
  add column if not exists local_source_file_count integer not null default 0,
  add column if not exists last_local_sync_at timestamptz,
  add column if not exists last_local_check_at timestamptz;

alter table public.card_sync_runs
  add column if not exists cards_skipped integer not null default 0;

alter table public.card_sync_runs
  drop constraint if exists card_sync_runs_mode_check;

alter table public.card_sync_runs
  add constraint card_sync_runs_mode_check
  check (mode in ('full', 'local', 'prices'));

create table if not exists public.card_sync_files (
  source text not null,
  file_path text not null,
  remote_sha text not null,
  local_sha256 text not null,
  source_commit_sha text not null,
  card_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  last_error text,
  last_synced_at timestamptz not null default now(),

  primary key (source, file_path),

  constraint card_sync_files_card_count_nonnegative
    check (card_count >= 0),
  constraint card_sync_files_inserted_nonnegative
    check (inserted_count >= 0),
  constraint card_sync_files_updated_nonnegative
    check (updated_count >= 0),
  constraint card_sync_files_skipped_nonnegative
    check (skipped_count >= 0)
);

create index if not exists card_sync_files_last_synced_idx
  on public.card_sync_files(last_synced_at desc);

alter table public.card_sync_files enable row level security;

drop policy if exists
  "Authenticated users can read card sync files"
on public.card_sync_files;

create policy
  "Authenticated users can read card sync files"
on public.card_sync_files
for select
to authenticated
using (true);

grant select on public.card_sync_files to authenticated;

create or replace function public.merge_local_pokemon_card_batch(
  p_cards jsonb,
  p_source_file_path text,
  p_source_commit_sha text
)
returns table (
  received_count integer,
  inserted_count integer,
  updated_count integer,
  skipped_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_card record;
  v_existing_id text;
  v_existing_hash text;
  v_received integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  if p_cards is null
    or jsonb_typeof(p_cards) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Local card sync payload must be a JSON array.';
  end if;

  if coalesce(btrim(p_source_file_path), '') = '' then
    raise exception using
      errcode = '22023',
      message = 'Source file path is required.';
  end if;

  for v_card in
    select *
    from jsonb_to_recordset(p_cards) as incoming(
      api_id text,
      name text,
      rarity text,
      set_name text,
      card_no text,
      image_url text,
      image_url_large text,
      set_id text,
      set_series text,
      set_release_date date,
      source_updated_at timestamptz,
      supertype text,
      subtypes jsonb,
      artist text,
      national_pokedex_numbers integer[],
      source_record_hash text
    )
  loop
    v_received := v_received + 1;
    v_existing_id := null;
    v_existing_hash := null;

    select cards.id::text, cards.source_record_hash
    into v_existing_id, v_existing_hash
    from public.pokemon_cards as cards
    where cards.api_id = v_card.api_id
    order by cards.id::text
    limit 1;

    if v_existing_id is null then
      select cards.id::text, cards.source_record_hash
      into v_existing_id, v_existing_hash
      from public.pokemon_cards as cards
      where cards.api_id is null
        and lower(coalesce(cards.name, '')) =
          lower(coalesce(v_card.name, ''))
        and lower(coalesce(cards.set_name, '')) =
          lower(coalesce(v_card.set_name, ''))
        and coalesce(cards.card_no, '') =
          coalesce(v_card.card_no, '')
      order by cards.id::text
      limit 1;
    end if;

    if v_existing_id is null then
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
        source_record_hash,
        source_file_path,
        source_commit_sha,
        database_synced_at,
        price_status
      )
      values (
        v_card.api_id,
        coalesce(v_card.name, 'Unknown card'),
        v_card.rarity,
        v_card.set_name,
        v_card.card_no,
        v_card.image_url,
        v_card.image_url_large,
        0,
        v_card.set_id,
        v_card.set_series,
        v_card.set_release_date,
        v_card.source_updated_at,
        v_card.supertype,
        coalesce(v_card.subtypes, '[]'::jsonb),
        v_card.artist,
        v_card.national_pokedex_numbers,
        v_card.source_record_hash,
        p_source_file_path,
        p_source_commit_sha,
        now(),
        'unknown'
      );

      v_inserted := v_inserted + 1;
    elsif v_existing_hash is distinct from v_card.source_record_hash then
      update public.pokemon_cards as cards
      set
        api_id = coalesce(v_card.api_id, cards.api_id),
        name = coalesce(v_card.name, cards.name),
        rarity = coalesce(v_card.rarity, cards.rarity),
        set_name = coalesce(v_card.set_name, cards.set_name),
        card_no = coalesce(v_card.card_no, cards.card_no),
        image_url = coalesce(v_card.image_url, cards.image_url),
        image_url_large = coalesce(v_card.image_url_large, cards.image_url_large),
        set_id = coalesce(v_card.set_id, cards.set_id),
        set_series = coalesce(v_card.set_series, cards.set_series),
        set_release_date = coalesce(v_card.set_release_date, cards.set_release_date),
        source_updated_at = coalesce(v_card.source_updated_at, cards.source_updated_at),
        supertype = coalesce(v_card.supertype, cards.supertype),
        subtypes = coalesce(v_card.subtypes, cards.subtypes, '[]'::jsonb),
        artist = coalesce(v_card.artist, cards.artist),
        national_pokedex_numbers = coalesce(
          v_card.national_pokedex_numbers,
          cards.national_pokedex_numbers
        ),
        source_record_hash = v_card.source_record_hash,
        source_file_path = p_source_file_path,
        source_commit_sha = p_source_commit_sha,
        database_synced_at = now()
      where cards.id::text = v_existing_id;

      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return query
  select v_received, v_inserted, v_updated, v_skipped;
end;
$function$;

create or replace function public.get_due_price_card_ids(
  p_limit integer default 10,
  p_force boolean default false
)
returns table (api_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select cards.api_id
  from public.pokemon_cards as cards
  where cards.api_id is not null
    and btrim(cards.api_id) <> ''
    and (
      coalesce(p_force, false)
      or cards.price_checked_at is null
      or cards.price_checked_at < now() - interval '7 days'
      or (
        cards.price_status = 'failed'
        and (
          cards.price_retry_after is null
          or cards.price_retry_after <= now()
        )
      )
    )
  order by cards.price_checked_at asc nulls first, cards.api_id asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$function$;

create or replace function public.get_card_database_tracker_stats()
returns table (
  total_cards bigint,
  local_files_tracked bigint,
  local_cards_tracked bigint,
  priced_cards bigint,
  unpriced_cards bigint,
  failed_price_cards bigint,
  due_price_cards bigint,
  last_local_sync_at timestamptz,
  last_local_check_at timestamptz,
  local_source_commit_sha text,
  local_source_path text,
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
    (
      select count(*)::bigint
      from public.card_sync_files as files
      where files.source = 'pokemon-tcg-data'
    ),
    count(*) filter (
      where cards.source_record_hash is not null
    )::bigint,
    count(*) filter (
      where cards.price_status = 'priced'
        and coalesce(cards.market_value, 0) > 0
    )::bigint,
    count(*) filter (
      where cards.price_status in ('unknown', 'unpriced')
    )::bigint,
    count(*) filter (
      where cards.price_status = 'failed'
    )::bigint,
    count(*) filter (
      where cards.api_id is not null
        and (
          cards.price_checked_at is null
          or cards.price_checked_at < now() - interval '7 days'
          or (
            cards.price_status = 'failed'
            and (
              cards.price_retry_after is null
              or cards.price_retry_after <= now()
            )
          )
        )
    )::bigint,
    settings.last_local_sync_at,
    settings.last_local_check_at,
    settings.local_source_commit_sha,
    settings.local_source_path,
    settings.last_price_sync_at,
    settings.usd_to_gbp,
    settings.eur_to_gbp,
    settings.fx_date
  from public.pokemon_cards as cards
  cross join public.card_sync_settings as settings
  where settings.id = 1
  group by
    settings.last_local_sync_at,
    settings.last_local_check_at,
    settings.local_source_commit_sha,
    settings.local_source_path,
    settings.last_price_sync_at,
    settings.usd_to_gbp,
    settings.eur_to_gbp,
    settings.fx_date;
$function$;

revoke all
on function public.merge_local_pokemon_card_batch(jsonb, text, text)
from public;

revoke all
on function public.get_due_price_card_ids(integer, boolean)
from public;

revoke all
on function public.get_card_database_tracker_stats()
from public;

grant execute
on function public.merge_local_pokemon_card_batch(jsonb, text, text)
to service_role;

grant execute
on function public.get_due_price_card_ids(integer, boolean)
to service_role;

grant execute
on function public.get_card_database_tracker_stats()
to authenticated;

notify pgrst, 'reload schema';
