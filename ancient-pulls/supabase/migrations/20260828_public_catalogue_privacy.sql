begin;

-- Player-facing catalogue RPCs deliberately omit inventory quantities and
-- pricing. Stock remains an operational concern for founders/admins and is
-- never serialised into the public catalogue response.
create or replace function public.get_public_catalogue_facets()
returns table (
  sets jsonb,
  rarities jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with canonical as (
    select distinct
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity
    from public.pokemon_cards as cards
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
    );
$function$;

create or replace function public.get_public_catalogue_cards(
  p_search text,
  p_set_name text,
  p_rarity text,
  p_favourites_only boolean,
  p_page integer,
  p_page_size integer
)
returns table (
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  image_url text,
  is_favourite boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with card_rows as (
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
      nullif(btrim(cards.image_url), '') as image_url,
      (favourite.card_id is not null) as is_favourite
    from public.pokemon_cards as cards
    left join public.player_favourite_cards as favourite
      on favourite.user_id = auth.uid()
      and favourite.card_id = cards.id::text
  ),
  canonical as (
    select
      (array_agg(card_id order by is_favourite desc, (image_url is null), card_id))[1]
        as card_id,
      min(name) as name,
      min(set_name) as set_name,
      min(card_no) as card_no,
      min(rarity) as rarity,
      (array_agg(image_url order by (image_url is null), is_favourite desc, card_id))[1]
        as image_url,
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
    counted.image_url,
    counted.is_favourite,
    counted.total_count
  from counted
  order by
    lower(counted.name),
    counted.set_name,
    counted.card_no nulls last,
    counted.card_id
  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (greatest(1, coalesce(p_page, 1)) - 1)
    * greatest(1, least(coalesce(p_page_size, 24), 60));
$function$;

revoke all on function public.get_public_catalogue_facets() from public, anon;
grant execute on function public.get_public_catalogue_facets() to authenticated;

revoke all on function public.get_public_catalogue_cards(
  text, text, text, boolean, integer, integer
) from public, anon;
grant execute on function public.get_public_catalogue_cards(
  text, text, text, boolean, integer, integer
) to authenticated;

-- Close the legacy player RPCs as well. Hiding their fields in React would
-- still leave quantities and values visible to an authenticated network
-- client, so only the service role may retain access to those old endpoints.
revoke execute on function public.get_catalogue_overview()
  from authenticated, anon;
grant execute on function public.get_catalogue_overview()
  to service_role;

revoke execute on function public.get_catalogue_cards(
  text, text, text, text, boolean, text, integer, integer
) from authenticated, anon;
grant execute on function public.get_catalogue_cards(
  text, text, text, text, boolean, text, integer, integer
) to service_role;

comment on function public.get_public_catalogue_facets() is
  'Player catalogue filters with no inventory or pricing statistics.';
comment on function public.get_public_catalogue_cards(
  text, text, text, boolean, integer, integer
) is 'Player catalogue rows with card identity and artwork only; stock and pricing are intentionally omitted.';

notify pgrst, 'reload schema';

commit;
