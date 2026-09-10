-- Unown Pulls V28
-- - binder name support
-- - binder theme unlocks tied to easy achievements
-- - locked theme enforcement in SQL
-- - friend profile exposes binder name

begin;

alter table public.player_binder_settings
add column if not exists binder_name text;

update public.player_binder_settings
set binder_name = 'My Binder'
where binder_name is null or btrim(binder_name) = '';

alter table public.player_binder_settings
alter column binder_name set default 'My Binder';

alter table public.player_binder_settings
alter column binder_name set not null;

do $check$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_binder_name_length_check'
      and conrelid = 'public.player_binder_settings'::regclass
  ) then
    alter table public.player_binder_settings
    add constraint player_binder_name_length_check
    check (char_length(btrim(binder_name)) between 1 and 40);
  end if;
end;
$check$;

drop function if exists public.get_player_binder_settings();
create or replace function public.get_player_binder_settings()
returns table(
  theme_key text,
  binder_name text,
  unlocked_theme_keys text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  insert into public.player_binder_settings(user_id, theme_key, binder_name)
  values (v_user_id, 'classic', 'My Binder')
  on conflict (user_id) do update
    set binder_name = coalesce(nullif(btrim(public.player_binder_settings.binder_name), ''), 'My Binder');

  return query
  with unlocked as (
    select 'classic'::text as theme_key
    union all
    select 'midnight'::text
    union all
    select 'ancient'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'collector_25'
        and unlocked_at is not null
    )
    union all
    select 'arcane'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'rare_first'
        and unlocked_at is not null
    )
    union all
    select 'frostbite'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'streak_3'
        and unlocked_at is not null
    )
    union all
    select 'sunset'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'treasure_10'
        and unlocked_at is not null
    )
    union all
    select 'shadow'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'shipping_ready'
        and unlocked_at is not null
    )
    union all
    select 'forest'::text
    where exists (
      select 1
      from public.player_achievements
      where user_id = v_user_id
        and achievement_key = 'unique_10'
        and unlocked_at is not null
    )
  )
  select
    settings.theme_key,
    settings.binder_name,
    array_agg(distinct unlocked.theme_key order by unlocked.theme_key)::text[] as unlocked_theme_keys
  from public.player_binder_settings as settings
  cross join unlocked
  where settings.user_id = v_user_id
  group by settings.theme_key, settings.binder_name;
end;
$function$;

create or replace function public.set_player_binder_name(p_binder_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := coalesce(nullif(btrim(p_binder_name), ''), 'My Binder');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if char_length(v_name) > 40 then
    raise exception using errcode = '22023', message = 'Binder names must be 40 characters or fewer.';
  end if;

  insert into public.player_binder_settings(user_id, theme_key, binder_name, updated_at)
  values (v_user_id, 'classic', v_name, now())
  on conflict (user_id)
  do update set binder_name = excluded.binder_name, updated_at = now();
end;
$function$;

create or replace function public.set_player_binder_theme(p_theme_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_theme text := lower(coalesce(btrim(p_theme_key), ''));
  v_allowed text[];
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if v_theme not in (
    'classic', 'midnight', 'ancient', 'arcane',
    'frostbite', 'sunset', 'shadow', 'forest'
  ) then
    raise exception using errcode = '22023', message = 'That binder style does not exist.';
  end if;

  select unlocked_theme_keys
  into v_allowed
  from public.get_player_binder_settings()
  limit 1;

  if v_allowed is null or not (v_theme = any(v_allowed)) then
    raise exception using errcode = '42501', message = 'That binder style is still locked.';
  end if;

  insert into public.player_binder_settings(user_id, theme_key, binder_name, updated_at)
  values (v_user_id, v_theme, 'My Binder', now())
  on conflict (user_id)
  do update set theme_key = excluded.theme_key, updated_at = now();
end;
$function$;

drop function if exists public.get_friend_profile(uuid);
create or replace function public.get_friend_profile(p_target_user_id uuid)
returns table (
  user_id uuid,
  trainer_code text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  favourite_pokemon text,
  location_label text,
  joined_at timestamptz,
  lifetime_wishes bigint,
  total_cards bigint,
  unique_cards bigint,
  collection_value numeric,
  signature_card_id text,
  signature_name text,
  signature_set_name text,
  signature_card_no text,
  signature_rarity text,
  signature_market_value numeric,
  signature_image_url text,
  binder_theme_key text,
  binder_name text,
  online boolean,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with allowed as (
    select p_target_user_id as target_id
    where auth.uid() is not null
      and p_target_user_id is not null
      and (
        p_target_user_id = auth.uid()
        or exists (
          select 1
          from public.player_friendships as friendship
          where friendship.status = 'accepted'
            and (
              (friendship.requester_id = auth.uid() and friendship.addressee_id = p_target_user_id)
              or
              (friendship.addressee_id = auth.uid() and friendship.requester_id = p_target_user_id)
            )
        )
      )
  ),
  inventory_totals as (
    select
      inventory.user_id,
      coalesce(sum(greatest(coalesce(inventory.quantity, 0), 0)), 0)::bigint as total_cards,
      count(*) filter (where coalesce(inventory.quantity, 0) > 0)::bigint as unique_cards,
      coalesce(sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        * greatest(coalesce(cards.market_value, 0), 0)
      ), 0)::numeric as collection_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    join allowed on allowed.target_id = inventory.user_id
    group by inventory.user_id
  )
  select
    profiles.user_id,
    profiles.trainer_code,
    profiles.username,
    profiles.display_name,
    profiles.avatar_url,
    coalesce(details.bio, ''),
    coalesce(details.favourite_pokemon, ''),
    coalesce(details.location_label, ''),
    profiles.created_at,
    greatest(coalesce(wallets.lifetime_wishes_spent, 0), 0)::bigint,
    coalesce(inventory.total_cards, 0)::bigint,
    coalesce(inventory.unique_cards, 0)::bigint,
    coalesce(inventory.collection_value, 0)::numeric,
    details.signature_card_id::text,
    signature.name,
    signature.set_name,
    signature.card_no,
    coalesce(signature.rarity, 'Common'),
    greatest(coalesce(signature.market_value, 0), 0)::numeric,
    signature.image_url,
    coalesce(settings.theme_key, 'classic'),
    coalesce(nullif(btrim(settings.binder_name), ''), coalesce(profiles.display_name, profiles.username, 'Trainer') || '''s Binder'),
    coalesce(profiles.last_seen_at > now() - interval '5 minutes', false),
    profiles.last_seen_at
  from allowed
  join public.player_profiles as profiles
    on profiles.user_id = allowed.target_id
  left join public.player_profile_details as details
    on details.user_id = profiles.user_id
  left join public.player_wallets as wallets
    on wallets.user_id = profiles.user_id
  left join inventory_totals as inventory
    on inventory.user_id = profiles.user_id
  left join public.pokemon_cards as signature
    on signature.id::text = details.signature_card_id::text
  left join public.player_binder_settings as settings
    on settings.user_id = profiles.user_id
  where coalesce(profiles.is_banned, false) = false;
$function$;

grant execute on function public.get_player_binder_settings() to authenticated;
grant execute on function public.set_player_binder_name(text) to authenticated;
grant execute on function public.set_player_binder_theme(text) to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;

commit;
