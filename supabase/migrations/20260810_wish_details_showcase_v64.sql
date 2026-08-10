-- Ancient Pulls V64
-- Read-only player showcase for the five highest-value enabled wish cards.
-- This does not modify the wish pool, rarity weights, stock or pull engine.

create or replace function public.get_player_wish_chase_cards(
  p_limit integer default 5
)
returns table (
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  rarity_tier text,
  rarity_display_name text,
  market_value numeric,
  image_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    cards.id::text as card_id,
    coalesce(nullif(btrim(cards.name), ''), 'Mystery card') as name,
    coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
    nullif(btrim(cards.card_no), '') as card_no,
    coalesce(nullif(btrim(cards.rarity), ''), tiers.display_name) as rarity,
    pool.rarity_tier,
    tiers.display_name as rarity_display_name,
    greatest(coalesce(cards.market_value, 0), 0)::numeric as market_value,
    nullif(btrim(cards.image_url), '') as image_url
  from public.wish_pool_cards as pool
  join public.wish_rarity_tiers as tiers
    on tiers.rarity_tier = pool.rarity_tier
  join public.pokemon_cards as cards
    on cards.id::text = pool.card_id
  where pool.enabled = true
    and tiers.enabled = true
    and tiers.weight > 0
  order by
    greatest(coalesce(cards.market_value, 0), 0) desc,
    cards.name asc,
    cards.id::text asc
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$function$;

revoke all on function public.get_player_wish_chase_cards(integer) from public;
grant execute on function public.get_player_wish_chase_cards(integer) to authenticated;

comment on function public.get_player_wish_chase_cards(integer) is
  'Returns up to five highest-market-value card designs currently enabled in the summon catalogue. Read-only; physical stock quantity does not affect rarity odds.';
