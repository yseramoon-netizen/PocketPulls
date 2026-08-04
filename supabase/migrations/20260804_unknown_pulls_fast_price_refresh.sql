-- Unknown Pulls persistent fast price refresh
--
-- Upgrades the price tracker so:
-- 1. Progress survives page reloads, browser restarts and paused sessions.
-- 2. The UI resumes from the persisted completed count instead of showing 0.
-- 3. One Pokemon TCG API search request can refresh many card IDs.
-- 4. One database RPC applies an entire result batch transactionally.
--
-- Existing prices and card rows are preserved.

do $preflight$
begin
  if to_regclass(
    'public.pokemon_cards'
  ) is null then
    raise exception
      'public.pokemon_cards is missing. Run the card database migration first.';
  end if;

  if to_regclass(
    'public.card_sync_settings'
  ) is null then
    raise exception
      'public.card_sync_settings is missing. Run the incremental local card database migration first.';
  end if;

  if to_regprocedure(
    'public.get_card_database_tracker_stats()'
  ) is null then
    raise exception
      'public.get_card_database_tracker_stats() is missing. Run the incremental local card database migration first.';
  end if;
end;
$preflight$;

alter table public.card_sync_settings
  add column if not exists price_pass_status text
    not null default 'idle',
  add column if not exists price_pass_started_at timestamptz,
  add column if not exists price_pass_updated_at timestamptz,
  add column if not exists price_pass_completed_at timestamptz,
  add column if not exists price_pass_total integer
    not null default 0,
  add column if not exists price_pass_processed integer
    not null default 0,
  add column if not exists price_pass_priced integer
    not null default 0,
  add column if not exists price_pass_unpriced integer
    not null default 0,
  add column if not exists price_pass_failed integer
    not null default 0;

alter table public.card_sync_settings
  drop constraint if exists
    card_sync_settings_price_pass_status_check;

alter table public.card_sync_settings
  add constraint
    card_sync_settings_price_pass_status_check
  check (
    price_pass_status in (
      'idle',
      'running',
      'paused',
      'completed'
    )
  );

update public.card_sync_settings
set
  price_pass_status =
    coalesce(
      nullif(
        btrim(price_pass_status),
        ''
      ),
      'idle'
    ),
  price_pass_total =
    greatest(
      coalesce(price_pass_total, 0),
      0
    ),
  price_pass_processed =
    greatest(
      coalesce(price_pass_processed, 0),
      0
    ),
  price_pass_priced =
    greatest(
      coalesce(price_pass_priced, 0),
      0
    ),
  price_pass_unpriced =
    greatest(
      coalesce(price_pass_unpriced, 0),
      0
    ),
  price_pass_failed =
    greatest(
      coalesce(price_pass_failed, 0),
      0
    )
where id = 1;

-- Preserve progress from the old one-card-at-a-time refresher.
-- Cards whose current price check is still valid count as already processed,
-- so the first upgraded pass can display Resume at 500/... instead of 0/....
with card_state as (
  select
    count(
      distinct card.api_id
    )::integer
      as total_cards,

    count(
      distinct card.api_id
    ) filter (
      where
        card.price_checked_at
          is null

        or card.price_checked_at <
          now() - interval '7 days'

        or (
          card.price_status =
            'failed'

          and (
            card.price_retry_after
              is null

            or card.price_retry_after <=
              now()
          )
        )
    )::integer
      as due_cards,

    count(
      distinct card.api_id
    ) filter (
      where card.price_status =
          'priced'

        and card.price_checked_at
          is not null

        and card.price_checked_at >=
          now() - interval '7 days'
    )::integer
      as priced_cards,

    count(
      distinct card.api_id
    ) filter (
      where card.price_status =
          'unpriced'

        and card.price_checked_at
          is not null

        and card.price_checked_at >=
          now() - interval '7 days'
    )::integer
      as unpriced_cards,

    count(
      distinct card.api_id
    ) filter (
      where card.price_status =
          'failed'

        and card.price_retry_after >
          now()
    )::integer
      as deferred_cards

  from public.pokemon_cards
    as card

  where card.api_id is not null
    and btrim(card.api_id) <> ''
)
update public.card_sync_settings
  as settings
set
  price_pass_status = case
    when card_state.due_cards = 0
      then 'completed'
    else 'paused'
  end,

  price_pass_started_at =
    coalesce(
      settings.price_pass_started_at,
      now()
    ),

  price_pass_updated_at =
    now(),

  price_pass_completed_at =
    case
      when card_state.due_cards = 0
        then now()
      else null
    end,

  price_pass_total =
    card_state.total_cards,

  price_pass_processed =
    greatest(
      card_state.total_cards -
        card_state.due_cards,
      0
    ),

  price_pass_priced =
    card_state.priced_cards,

  price_pass_unpriced =
    card_state.unpriced_cards,

  price_pass_failed =
    card_state.deferred_cards,

  updated_at = now()

from card_state

where settings.id = 1
  and settings.price_pass_total = 0
  and settings.price_pass_processed = 0;

create index if not exists
  pokemon_cards_price_due_fast_idx
on public.pokemon_cards (
  price_checked_at asc nulls first,
  api_id asc
)
where api_id is not null
  and btrim(api_id) <> '';

create or replace function
public.get_due_price_card_ids(
  p_limit integer default 100,
  p_force boolean default false
)
returns table (
  api_id text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    card.api_id

  from public.pokemon_cards
    as card

  where card.api_id is not null
    and btrim(card.api_id) <> ''

    and (
      coalesce(p_force, false)

      or card.price_checked_at
        is null

      or card.price_checked_at <
        now() - interval '7 days'

      or (
        card.price_status =
          'failed'

        and (
          card.price_retry_after
            is null

          or card.price_retry_after <=
            now()
        )
      )
    )

  group by card.api_id

  order by
    min(
      card.price_checked_at
    ) asc nulls first,
    card.api_id asc

  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      250
    )
  );
$function$;

create or replace function
public.get_due_price_card_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select count(
    distinct card.api_id
  )::bigint

  from public.pokemon_cards
    as card

  where card.api_id is not null
    and btrim(card.api_id) <> ''

    and (
      card.price_checked_at
        is null

      or card.price_checked_at <
        now() - interval '7 days'

      or (
        card.price_status =
          'failed'

        and (
          card.price_retry_after
            is null

          or card.price_retry_after <=
            now()
        )
      )
    );
$function$;

revoke all
on function
  public.get_due_price_card_ids(
    integer,
    boolean
  )
from public;

revoke all
on function
  public.get_due_price_card_count()
from public;

grant execute
on function
  public.get_due_price_card_ids(
    integer,
    boolean
  )
to service_role;

grant execute
on function
  public.get_due_price_card_count()
to service_role;

create or replace function
public.apply_price_refresh_batch(
  p_updates jsonb
)
returns table (
  processed_count integer,
  priced_count integer,
  unpriced_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_processed integer := 0;
  v_priced integer := 0;
  v_unpriced integer := 0;
  v_failed integer := 0;
  v_now timestamptz := now();
begin
  if p_updates is null
    or jsonb_typeof(p_updates) <> 'array' then
    raise exception using
      errcode = '22023',
      message =
        'Price refresh payload must be a JSON array.';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(
      p_updates
    ) as update_row (
      api_id text,
      has_price boolean,
      market_value numeric,
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
      price_checked_at timestamptz,
      price_status text,
      price_error text,
      price_retry_after timestamptz,
      tcgplayer_url text,
      tcgplayer_updated_at date,
      cardmarket_url text,
      cardmarket_updated_at date
    )
  ),
  updated as (
    update public.pokemon_cards
      as card
    set
      market_value = case
        when incoming.has_price
          then incoming.market_value
        else card.market_value
      end,

      price_normal_usd = case
        when incoming.has_price
          then incoming.price_normal_usd
        else card.price_normal_usd
      end,

      price_holo_usd = case
        when incoming.has_price
          then incoming.price_holo_usd
        else card.price_holo_usd
      end,

      price_reverse_holo_usd = case
        when incoming.has_price
          then incoming.price_reverse_holo_usd
        else card.price_reverse_holo_usd
      end,

      price_cardmarket_eur = case
        when incoming.has_price
          then incoming.price_cardmarket_eur
        else card.price_cardmarket_eur
      end,

      price_reverse_holo_eur = case
        when incoming.has_price
          then incoming.price_reverse_holo_eur
        else card.price_reverse_holo_eur
      end,

      market_value_normal_gbp = case
        when incoming.has_price
          then incoming.market_value_normal_gbp
        else card.market_value_normal_gbp
      end,

      market_value_holo_gbp = case
        when incoming.has_price
          then incoming.market_value_holo_gbp
        else card.market_value_holo_gbp
      end,

      market_value_reverse_holo_gbp = case
        when incoming.has_price
          then incoming.market_value_reverse_holo_gbp
        else card.market_value_reverse_holo_gbp
      end,

      price_source = case
        when incoming.has_price
          then incoming.price_source
        else card.price_source
      end,

      price_updated_at = case
        when incoming.has_price
          then incoming.price_updated_at
        else card.price_updated_at
      end,

      price_checked_at =
        coalesce(
          incoming.price_checked_at,
          v_now
        ),

      price_status =
        coalesce(
          nullif(
            incoming.price_status,
            ''
          ),
          'unpriced'
        ),

      price_error =
        incoming.price_error,

      price_retry_after =
        incoming.price_retry_after,

      tcgplayer_url =
        coalesce(
          incoming.tcgplayer_url,
          card.tcgplayer_url
        ),

      tcgplayer_updated_at =
        coalesce(
          incoming.tcgplayer_updated_at,
          card.tcgplayer_updated_at
        ),

      cardmarket_url =
        coalesce(
          incoming.cardmarket_url,
          card.cardmarket_url
        ),

      cardmarket_updated_at =
        coalesce(
          incoming.cardmarket_updated_at,
          card.cardmarket_updated_at
        )

    from incoming

    where card.api_id =
      incoming.api_id

    returning
      card.api_id,
      card.price_status
  )
  select
    count(
      distinct updated.api_id
    )::integer,

    count(
      distinct updated.api_id
    ) filter (
      where updated.price_status =
        'priced'
    )::integer,

    count(
      distinct updated.api_id
    ) filter (
      where updated.price_status =
        'unpriced'
    )::integer,

    count(
      distinct updated.api_id
    ) filter (
      where updated.price_status =
        'failed'
    )::integer

  into
    v_processed,
    v_priced,
    v_unpriced,
    v_failed

  from updated;

  update public.card_sync_settings
  set
    price_pass_status =
      'running',

    price_pass_updated_at =
      v_now,

    price_pass_processed =
      least(
        greatest(
          coalesce(
            price_pass_total,
            0
          ),
          0
        ),
        greatest(
          coalesce(
            price_pass_processed,
            0
          ),
          0
        ) + v_processed
      ),

    price_pass_priced =
      greatest(
        coalesce(
          price_pass_priced,
          0
        ),
        0
      ) + v_priced,

    price_pass_unpriced =
      greatest(
        coalesce(
          price_pass_unpriced,
          0
        ),
        0
      ) + v_unpriced,

    price_pass_failed =
      greatest(
        coalesce(
          price_pass_failed,
          0
        ),
        0
      ) + v_failed,

    updated_at =
      v_now

  where id = 1;

  return query
  select
    v_processed,
    v_priced,
    v_unpriced,
    v_failed;
end;
$function$;

revoke all
on function
  public.apply_price_refresh_batch(
    jsonb
  )
from public;

grant execute
on function
  public.apply_price_refresh_batch(
    jsonb
  )
to service_role;

comment on function
  public.apply_price_refresh_batch(
    jsonb
  )
is
  'Applies one multi-card Pokemon TCG price response and advances the persistent Unknown Pulls price-pass counters.';

notify pgrst, 'reload schema';
