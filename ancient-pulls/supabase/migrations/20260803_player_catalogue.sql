-- PocketPulls player catalogue
--
-- Adds persistent account favourites and two read-only catalogue RPCs.
-- Existing card and inventory tables are not modified.
--
-- Expected existing columns:
-- pokemon_cards(id, name, set_name, card_no, rarity, market_value, image_url)
-- inventory(card_id, quantity)

create table if not exists public.player_favourite_cards (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  card_id text not null,

  created_at timestamptz not null
    default now(),

  primary key (user_id, card_id)
);

create index if not exists
  player_favourite_cards_card_id_idx
on public.player_favourite_cards(card_id);

alter table public.player_favourite_cards
enable row level security;

drop policy if exists
  "Players can read their catalogue favourites"
on public.player_favourite_cards;

create policy
  "Players can read their catalogue favourites"
on public.player_favourite_cards
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists
  "Players can add catalogue favourites"
on public.player_favourite_cards;

create policy
  "Players can add catalogue favourites"
on public.player_favourite_cards
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists
  "Players can remove catalogue favourites"
on public.player_favourite_cards;

create policy
  "Players can remove catalogue favourites"
on public.player_favourite_cards
for delete
to authenticated
using (auth.uid() = user_id);

revoke all
on table public.player_favourite_cards
from public;

grant select, insert, delete
on table public.player_favourite_cards
to authenticated;

create or replace function public.get_catalogue_overview()
returns table (
  sets jsonb,
  rarities jsonb,
  total_cards bigint,
  in_stock_cards bigint,
  physical_units bigint,
  favourite_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with inventory_totals as (
    select
      stock.card_id::text as card_id,
      sum(greatest(coalesce(stock.quantity, 0), 0))::bigint
        as stock_quantity
    from public.inventory as stock
    where stock.card_id is not null
    group by stock.card_id::text
  )
  select
    coalesce(
      (
        select jsonb_agg(options.set_name order by options.set_name)
        from (
          select distinct cards.set_name
          from public.pokemon_cards as cards
          where cards.set_name is not null
            and btrim(cards.set_name) <> ''
        ) as options
      ),
      '[]'::jsonb
    ) as sets,

    coalesce(
      (
        select jsonb_agg(options.rarity order by options.rarity)
        from (
          select distinct cards.rarity
          from public.pokemon_cards as cards
          where cards.rarity is not null
            and btrim(cards.rarity) <> ''
        ) as options
      ),
      '[]'::jsonb
    ) as rarities,

    (
      select count(*)::bigint
      from public.pokemon_cards
    ) as total_cards,

    (
      select count(*)::bigint
      from inventory_totals
      where stock_quantity > 0
    ) as in_stock_cards,

    coalesce(
      (
        select sum(stock_quantity)::bigint
        from inventory_totals
      ),
      0::bigint
    ) as physical_units,

    (
      select count(*)::bigint
      from public.player_favourite_cards as favourite
      where favourite.user_id = auth.uid()
    ) as favourite_count;
$function$;

create or replace function public.get_catalogue_cards(
  p_search text,
  p_set_name text,
  p_rarity text,
  p_stock_filter text,
  p_favourites_only boolean,
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
  stock_quantity bigint,
  is_favourite boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with inventory_totals as (
    select
      stock.card_id::text as card_id,
      sum(greatest(coalesce(stock.quantity, 0), 0))::bigint
        as stock_quantity
    from public.inventory as stock
    where stock.card_id is not null
    group by stock.card_id::text
  ),

  filtered as (
    select
      cards.id::text as card_id,
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card')
        as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set')
        as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common')
        as rarity,
      greatest(
        coalesce(cards.market_value, 0)::numeric,
        0::numeric
      ) as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      coalesce(stock.stock_quantity, 0::bigint)
        as stock_quantity,
      (favourite.card_id is not null) as is_favourite
    from public.pokemon_cards as cards

    left join inventory_totals as stock
      on stock.card_id = cards.id::text

    left join public.player_favourite_cards as favourite
      on favourite.user_id = auth.uid()
      and favourite.card_id = cards.id::text

    where (
      coalesce(btrim(p_search), '') = ''
      or coalesce(cards.name, '') ilike
        '%' || btrim(p_search) || '%'
      or coalesce(cards.set_name, '') ilike
        '%' || btrim(p_search) || '%'
      or coalesce(cards.card_no, '') ilike
        '%' || btrim(p_search) || '%'
    )

    and (
      coalesce(btrim(p_set_name), '') = ''
      or cards.set_name = p_set_name
    )

    and (
      coalesce(btrim(p_rarity), '') = ''
      or cards.rarity = p_rarity
    )

    and (
      coalesce(p_stock_filter, 'all') = 'all'
      or (
        p_stock_filter = 'in_stock'
        and coalesce(stock.stock_quantity, 0) > 0
      )
      or (
        p_stock_filter = 'out_of_stock'
        and coalesce(stock.stock_quantity, 0) = 0
      )
    )

    and (
      coalesce(p_favourites_only, false) = false
      or favourite.card_id is not null
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
    counted.stock_quantity,
    counted.is_favourite,
    counted.total_count
  from counted

  order by
    case
      when p_sort = 'value_desc'
      then counted.market_value
    end desc nulls last,

    case
      when p_sort = 'value_asc'
      then counted.market_value
    end asc nulls last,

    case
      when p_sort = 'stock_desc'
      then counted.stock_quantity
    end desc nulls last,

    case
      when p_sort = 'name_asc'
        or p_sort is null
        or p_sort not in (
          'value_desc',
          'value_asc',
          'stock_desc'
        )
      then lower(counted.name)
    end asc nulls last,

    lower(counted.name) asc,
    counted.set_name asc,
    counted.card_no asc nulls last,
    counted.card_id asc

  limit greatest(1, least(coalesce(p_page_size, 24), 60))

  offset (
    greatest(1, coalesce(p_page, 1)) - 1
  ) * greatest(
    1,
    least(coalesce(p_page_size, 24), 60)
  );
$function$;

revoke all
on function public.get_catalogue_overview()
from public;

revoke all
on function public.get_catalogue_cards(
  text,
  text,
  text,
  text,
  boolean,
  text,
  integer,
  integer
)
from public;

grant execute
on function public.get_catalogue_overview()
to authenticated;

grant execute
on function public.get_catalogue_cards(
  text,
  text,
  text,
  text,
  boolean,
  text,
  integer,
  integer
)
to authenticated;

comment on table public.player_favourite_cards is
  'Cards saved by each PocketPulls player from the read-only catalogue.';

comment on function public.get_catalogue_overview() is
  'Returns player catalogue filter options and headline statistics.';

comment on function public.get_catalogue_cards(
  text,
  text,
  text,
  text,
  boolean,
  text,
  integer,
  integer
) is
  'Returns a filtered and paginated read-only catalogue with live stock and player favourite status.';

notify pgrst, 'reload schema';
