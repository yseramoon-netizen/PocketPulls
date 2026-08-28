begin;

-- The Universe needs rank and Cosmic Nebu identity together. Returning both
-- in one authenticated call avoids a second mobile round trip on page load.
create or replace function public.get_nebula_universe(
  p_limit integer default 100
)
returns table (
  rank_position bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_cards bigint,
  unique_cards bigint,
  collection_value numeric,
  lifetime_wishes bigint,
  score bigint,
  is_current_user boolean,
  cosmic_issue_number bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    rankings.rank_position,
    rankings.user_id,
    rankings.username,
    rankings.display_name,
    rankings.avatar_url,
    rankings.total_cards,
    rankings.unique_cards,
    rankings.collection_value,
    rankings.lifetime_wishes,
    rankings.score,
    rankings.is_current_user,
    cosmic.issue_number as cosmic_issue_number
  from public.get_player_leaderboard(p_limit) as rankings
  left join public.cosmic_nebu_ownerships as cosmic
    on cosmic.user_id = rankings.user_id
  where auth.uid() is not null
  order by rankings.rank_position asc;
$function$;

revoke all on function public.get_nebula_universe(integer) from public;
grant execute on function public.get_nebula_universe(integer) to authenticated;

comment on function public.get_nebula_universe(integer) is
  'Returns public player galaxies, stable rank order and optional Cosmic Nebu issue in one mobile-efficient call.';

-- Public constellations power the interactive Nebula Universe. Only profiles
-- already visible in the public Atlas can be opened. The function exposes wish
-- stars and catalogue presentation data; it never exposes email, address,
-- payment, stock-source, or private profile fields.
create or replace function public.get_public_player_constellation(
  p_target_user_id uuid
)
returns table (
  owner_user_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_url text,
  zodiac_sign text,
  wish_id text,
  card_id text,
  card_name text,
  set_name text,
  card_no text,
  rarity text,
  image_url text,
  value_at_wish numeric,
  current_market_value numeric,
  wished_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with owner as (
    select
      profiles.user_id,
      coalesce(
        nullif(btrim(profiles.username), ''),
        'trainer_' || left(replace(profiles.user_id::text, '-', ''), 8)
      ) as username,
      coalesce(
        nullif(btrim(profiles.display_name), ''),
        'Star Trainer'
      ) as display_name,
      nullif(btrim(profiles.avatar_url), '') as avatar_url,
      nullif(lower(btrim(profiles.zodiac_sign)), '') as zodiac_sign
    from public.player_profiles as profiles
    left join public.player_profile_details as details
      on details.user_id = profiles.user_id
    where profiles.user_id = p_target_user_id
      and auth.uid() is not null
      and (
        profiles.user_id = auth.uid()
        or coalesce(details.profile_public, true) = true
      )
  ),
  recent_stars as (
    select *
    from (
      select
        wishes.id::text as wish_id,
        wishes.card_id::text as card_id,
        coalesce(nullif(btrim(cards.name), ''), 'Unknown card') as card_name,
        coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
        nullif(btrim(cards.card_no), '') as card_no,
        coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity,
        nullif(btrim(cards.image_url), '') as image_url,
        greatest(coalesce(wishes.market_value_at_wish, 0), 0)::numeric
          as value_at_wish,
        greatest(coalesce(cards.market_value, 0), 0)::numeric
          as current_market_value,
        wishes.created_at as wished_at
      from public.player_wishes as wishes
      left join public.pokemon_cards as cards
        on cards.id::text = wishes.card_id::text
      where wishes.user_id = p_target_user_id
      order by wishes.created_at desc, wishes.id desc
      limit 1600
    ) as limited
  )
  select
    owner.user_id,
    owner.username,
    owner.display_name,
    owner.avatar_url,
    owner.zodiac_sign,
    stars.wish_id,
    stars.card_id,
    stars.card_name,
    stars.set_name,
    stars.card_no,
    stars.rarity,
    stars.image_url,
    stars.value_at_wish,
    stars.current_market_value,
    stars.wished_at
  from owner
  left join recent_stars as stars on true
  order by stars.wished_at asc nulls first, stars.wish_id asc nulls first;
$function$;

revoke all on function public.get_public_player_constellation(uuid) from public;
grant execute on function public.get_public_player_constellation(uuid) to authenticated;

comment on function public.get_public_player_constellation(uuid) is
  'Returns the public wish-star constellation for one profile-visible Atlas player.';

commit;
