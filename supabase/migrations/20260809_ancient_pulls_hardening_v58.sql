-- Ancient Pulls v58 hardening
--
-- 1. Reasserts server-side profile validation.
-- 2. Presents duplicate catalogue records as one canonical card without
--    deleting or rewriting any source card, stock, wish or favourite data.

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
        'Username must be 3-24 lowercase letters, numbers or underscores.';
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
      sum(greatest(coalesce(stock.quantity, 0), 0))::bigint as stock_quantity
    from public.inventory as stock
    where stock.card_id is not null
    group by stock.card_id::text
  ),
  card_rows as (
    select
      lower(coalesce(nullif(btrim(cards.name), ''), 'unknown card')) as name_key,
      lower(coalesce(nullif(btrim(cards.set_name), ''), 'unknown set')) as set_key,
      lower(coalesce(nullif(btrim(cards.card_no), ''), '')) as number_key,
      lower(coalesce(nullif(btrim(cards.rarity), ''), 'common')) as rarity_key,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity,
      coalesce(stock.stock_quantity, 0::bigint) as stock_quantity,
      (favourite.card_id is not null) as is_favourite
    from public.pokemon_cards as cards
    left join inventory_totals as stock
      on stock.card_id = cards.id::text
    left join public.player_favourite_cards as favourite
      on favourite.user_id = auth.uid()
      and favourite.card_id = cards.id::text
  ),
  canonical as (
    select
      name_key,
      set_key,
      number_key,
      rarity_key,
      min(set_name) as set_name,
      min(rarity) as rarity,
      sum(stock_quantity)::bigint as stock_quantity,
      bool_or(is_favourite) as is_favourite
    from card_rows
    group by name_key, set_key, number_key, rarity_key
  )
  select
    coalesce(
      (select jsonb_agg(options.set_name order by options.set_name)
       from (select distinct set_name from canonical) as options),
      '[]'::jsonb
    ),
    coalesce(
      (select jsonb_agg(options.rarity order by options.rarity)
       from (select distinct rarity from canonical) as options),
      '[]'::jsonb
    ),
    (select count(*)::bigint from canonical),
    (select count(*)::bigint from canonical where stock_quantity > 0),
    coalesce((select sum(stock_quantity)::bigint from canonical), 0::bigint),
    (select count(*)::bigint from canonical where is_favourite);
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
      sum(greatest(coalesce(stock.quantity, 0), 0))::bigint as stock_quantity
    from public.inventory as stock
    where stock.card_id is not null
    group by stock.card_id::text
  ),
  card_rows as (
    select
      cards.id::text as card_id,
      lower(coalesce(nullif(btrim(cards.name), ''), 'unknown card')) as name_key,
      lower(coalesce(nullif(btrim(cards.set_name), ''), 'unknown set')) as set_key,
      lower(coalesce(nullif(btrim(cards.card_no), ''), '')) as number_key,
      lower(coalesce(nullif(btrim(cards.rarity), ''), 'common')) as rarity_key,
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card') as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity,
      nullif(greatest(coalesce(cards.market_value, 0)::numeric, 0::numeric), 0::numeric)
        as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      coalesce(stock.stock_quantity, 0::bigint) as stock_quantity,
      (favourite.card_id is not null) as is_favourite
    from public.pokemon_cards as cards
    left join inventory_totals as stock
      on stock.card_id = cards.id::text
    left join public.player_favourite_cards as favourite
      on favourite.user_id = auth.uid()
      and favourite.card_id = cards.id::text
  ),
  canonical as (
    select
      (array_agg(card_id order by is_favourite desc, stock_quantity desc, market_value desc nulls last, card_id))[1]
        as card_id,
      (array_agg(name order by is_favourite desc, stock_quantity desc, market_value desc nulls last, card_id))[1]
        as name,
      (array_agg(set_name order by is_favourite desc, stock_quantity desc, market_value desc nulls last, card_id))[1]
        as set_name,
      (array_agg(card_no order by is_favourite desc, stock_quantity desc, market_value desc nulls last, card_id))[1]
        as card_no,
      (array_agg(rarity order by is_favourite desc, stock_quantity desc, market_value desc nulls last, card_id))[1]
        as rarity,
      max(market_value) as market_value,
      (array_agg(image_url order by (image_url is null), stock_quantity desc, market_value desc nulls last, card_id))[1]
        as image_url,
      sum(stock_quantity)::bigint as stock_quantity,
      bool_or(is_favourite) as is_favourite
    from card_rows
    group by name_key, set_key, number_key, rarity_key
  ),
  filtered as (
    select *
    from canonical
    where (
      coalesce(btrim(p_search), '') = ''
      or name ilike '%' || btrim(p_search) || '%'
      or set_name ilike '%' || btrim(p_search) || '%'
      or coalesce(card_no, '') ilike '%' || btrim(p_search) || '%'
    )
    and (coalesce(btrim(p_set_name), '') = '' or set_name = p_set_name)
    and (coalesce(btrim(p_rarity), '') = '' or rarity = p_rarity)
    and (
      coalesce(p_stock_filter, 'all') = 'all'
      or (p_stock_filter = 'in_stock' and stock_quantity > 0)
      or (p_stock_filter = 'out_of_stock' and stock_quantity = 0)
    )
    and (coalesce(p_favourites_only, false) = false or is_favourite)
  ),
  counted as (
    select filtered.*, count(*) over()::bigint as total_count
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
    case when p_sort = 'value_desc' then counted.market_value end desc nulls last,
    case when p_sort = 'value_asc' then counted.market_value end asc nulls last,
    case when p_sort = 'stock_desc' then counted.stock_quantity end desc nulls last,
    case
      when p_sort = 'name_asc'
        or p_sort is null
        or p_sort not in ('value_desc', 'value_asc', 'stock_desc')
      then lower(counted.name)
    end asc nulls last,
    lower(counted.name) asc,
    counted.set_name asc,
    counted.card_no asc nulls last,
    counted.card_id asc
  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (greatest(1, coalesce(p_page, 1)) - 1)
    * greatest(1, least(coalesce(p_page_size, 24), 60));
$function$;

revoke all on function public.update_player_profile(
  text, text, text, text, text, text, boolean
) from public;
grant execute on function public.update_player_profile(
  text, text, text, text, text, text, boolean
) to authenticated;

revoke all on function public.get_catalogue_overview() from public;
grant execute on function public.get_catalogue_overview() to authenticated;

revoke all on function public.get_catalogue_cards(
  text, text, text, text, boolean, text, integer, integer
) from public;
grant execute on function public.get_catalogue_cards(
  text, text, text, text, boolean, text, integer, integer
) to authenticated;

comment on function public.get_catalogue_overview() is
  'Returns canonical catalogue statistics without deleting duplicate source rows.';
comment on function public.get_catalogue_cards(
  text, text, text, text, boolean, text, integer, integer
) is 'Returns one canonical display row per normalised card identity.';

notify pgrst, 'reload schema';
