-- Unown Pulls V20: transparent live rarity odds.
-- This does NOT change the existing wish selection algorithm.
-- The current make_player_wish selection is proportional to physical quantity,
-- so grouping eligible quantity by rarity gives the real current rarity odds.

create or replace function public.get_player_wish_odds()
returns table (
  rarity text,
  cards_in_pool bigint,
  chance_percent numeric
)
language sql
security definer
set search_path = public
as $$
  with pool as (
    select
      coalesce(nullif(trim(cards.rarity), ''), 'Unlisted rarity') as rarity,
      sum(greatest(coalesce(stock.quantity, 0), 0))::bigint as cards_in_pool
    from public.inventory as stock
    join public.pokemon_cards as cards
      on cards.id::text = stock.card_id::text
    where coalesce(stock.quantity, 0) > 0
      and stock.card_id is not null
    group by 1
  ), totals as (
    select coalesce(sum(cards_in_pool), 0)::numeric as total_cards
    from pool
  )
  select
    pool.rarity,
    pool.cards_in_pool,
    case
      when totals.total_cards <= 0 then 0::numeric
      else round((pool.cards_in_pool::numeric / totals.total_cards) * 100, 4)
    end as chance_percent
  from pool
  cross join totals
  order by cards_in_pool desc, rarity asc;
$$;

revoke all on function public.get_player_wish_odds() from public;
grant execute on function public.get_player_wish_odds() to authenticated;

comment on function public.get_player_wish_odds() is
  'Returns live rarity-level wish odds from eligible physical inventory quantity. V20 transparency endpoint.';
