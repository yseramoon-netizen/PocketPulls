begin;

alter table public.pokemon_cards
  add column if not exists justtcg_checked_at timestamptz,
  add column if not exists justtcg_price_usd numeric,
  add column if not exists justtcg_card_id text,
  add column if not exists justtcg_variant_id text,
  add column if not exists justtcg_error text;

create index if not exists pokemon_cards_justtcg_fallback_idx
  on public.pokemon_cards (
    justtcg_checked_at asc nulls first,
    id
  )
  where coalesce(market_value, 0) <= 0;

drop function if exists public.get_unpriced_justtcg_candidates(integer);

create function public.get_unpriced_justtcg_candidates(
  p_limit integer default 1
)
returns table (
  card_id text,
  api_id text,
  name text,
  set_name text,
  card_no text,
  rarity text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    cards.id::text,
    cards.api_id,
    cards.name,
    cards.set_name,
    cards.card_no,
    cards.rarity
  from public.pokemon_cards as cards
  where coalesce(cards.market_value, 0) <= 0
    and coalesce(btrim(cards.name), '') <> ''
    and coalesce(btrim(cards.card_no), '') <> ''
    and (
      cards.justtcg_checked_at is null
      or cards.justtcg_checked_at < now() - interval '7 days'
    )
  order by
    cards.justtcg_checked_at asc nulls first,
    cards.price_checked_at asc nulls first,
    cards.id
  limit greatest(1, least(coalesce(p_limit, 1), 20));
$function$;

drop function if exists public.get_unpriced_justtcg_count();

create function public.get_unpriced_justtcg_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select count(*)::bigint
  from public.pokemon_cards as cards
  where coalesce(cards.market_value, 0) <= 0
    and coalesce(btrim(cards.name), '') <> ''
    and coalesce(btrim(cards.card_no), '') <> ''
    and (
      cards.justtcg_checked_at is null
      or cards.justtcg_checked_at < now() - interval '7 days'
    );
$function$;

revoke all on function public.get_unpriced_justtcg_candidates(integer) from public;
revoke all on function public.get_unpriced_justtcg_count() from public;

grant execute on function public.get_unpriced_justtcg_candidates(integer) to service_role;
grant execute on function public.get_unpriced_justtcg_count() to service_role;

notify pgrst, 'reload schema';

commit;
