-- Ancient Pulls V66.6
-- Cosmic Binder: an independent permanent 1-in-50,000 wish discovery.
-- The roll happens only after a player_wishes row is committed by the existing
-- wish transaction. It does not participate in card selection or Cosmic Nebu.

begin;

create sequence if not exists public.cosmic_binder_issue_number_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create table if not exists public.cosmic_binder_ownerships (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  issue_number bigint not null unique
    default nextval('public.cosmic_binder_issue_number_seq'::regclass),
  discovery_pull_id uuid not null unique
    references public.player_wishes(id)
    on delete cascade,
  discovered_at timestamptz not null default now(),
  constraint cosmic_binder_issue_number_positive check (issue_number > 0)
);

create table if not exists public.cosmic_binder_rolls (
  pull_id uuid primary key
    references public.player_wishes(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  roll_value integer not null,
  won boolean not null default false,
  rolled_at timestamptz not null default now(),
  constraint cosmic_binder_roll_value_range check (roll_value between 1 and 50000),
  constraint cosmic_binder_roll_result_check check (won = (roll_value = 1))
);

create index if not exists cosmic_binder_ownerships_discovered_at_idx
  on public.cosmic_binder_ownerships (discovered_at asc);

create index if not exists cosmic_binder_rolls_user_id_idx
  on public.cosmic_binder_rolls (user_id, rolled_at desc);

alter table public.cosmic_binder_ownerships enable row level security;
alter table public.cosmic_binder_rolls enable row level security;

drop policy if exists "Players can read their own Cosmic Binder ownership" on public.cosmic_binder_ownerships;
create policy "Players can read their own Cosmic Binder ownership"
  on public.cosmic_binder_ownerships
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read their own Cosmic Binder rolls" on public.cosmic_binder_rolls;
create policy "Players can read their own Cosmic Binder rolls"
  on public.cosmic_binder_rolls
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.cosmic_binder_ownerships from anon, authenticated;
revoke insert, update, delete on public.cosmic_binder_rolls from anon, authenticated;
grant select on public.cosmic_binder_ownerships to authenticated;
grant select on public.cosmic_binder_rolls to authenticated;

-- Extend the guarded binder setting to include the entitlement-backed style.
alter table public.player_binder_settings
  drop constraint if exists player_binder_theme_key_check;

alter table public.player_binder_settings
  add constraint player_binder_theme_key_check check (
    theme_key in (
      'classic', 'midnight', 'ancient', 'arcane',
      'frostbite', 'sunset', 'shadow', 'forest', 'cosmic_binder'
    )
  );

-- Drop the optional theme-list wrapper first in case an earlier deployment
-- created it as a SQL dependency of get_player_binder_settings().
drop function if exists public.get_player_binder_themes();
drop function if exists public.get_player_binder_settings();
create or replace function public.get_player_binder_settings()
returns table(
  theme_key text,
  binder_name text,
  unlocked_theme_keys text[],
  cosmic_binder_issue_number bigint
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
    set binder_name = coalesce(
      nullif(btrim(public.player_binder_settings.binder_name), ''),
      'My Binder'
    );

  return query
  with unlocked as (
    select 'classic'::text as unlocked_key
    union all select 'midnight'::text
    union all
    select 'ancient'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'collector_25'
        and achievements.unlocked_at is not null
    )
    union all
    select 'arcane'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'rare_first'
        and achievements.unlocked_at is not null
    )
    union all
    select 'frostbite'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'streak_3'
        and achievements.unlocked_at is not null
    )
    union all
    select 'sunset'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'treasure_10'
        and achievements.unlocked_at is not null
    )
    union all
    select 'shadow'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'shipping_ready'
        and achievements.unlocked_at is not null
    )
    union all
    select 'forest'::text
    where exists (
      select 1
      from public.player_achievements as achievements
      where achievements.user_id = v_user_id
        and achievements.achievement_key = 'unique_10'
        and achievements.unlocked_at is not null
    )
    union all
    select 'cosmic_binder'::text
    where exists (
      select 1
      from public.cosmic_binder_ownerships as ownerships
      where ownerships.user_id = v_user_id
    )
  )
  select
    settings.theme_key,
    settings.binder_name,
    array_agg(distinct unlocked.unlocked_key order by unlocked.unlocked_key)::text[],
    ownerships.issue_number
  from public.player_binder_settings as settings
  cross join unlocked
  left join public.cosmic_binder_ownerships as ownerships
    on ownerships.user_id = settings.user_id
  where settings.user_id = v_user_id
  group by settings.theme_key, settings.binder_name, ownerships.issue_number;
end;
$function$;

drop function if exists public.get_player_binder_themes();
create or replace function public.get_player_binder_themes()
returns table(
  theme_key text,
  unlocked boolean,
  achievement_title text,
  requirement text
)
language sql
security definer
set search_path = public, pg_temp
as $function$
  with theme_definitions(theme_key, achievement_title, requirement, sort_order) as (
    values
      ('classic'::text, 'Included'::text, 'Available to every trainer.'::text, 1),
      ('midnight'::text, 'Included'::text, 'Available to every trainer.'::text, 2),
      ('ancient'::text, 'Collector'::text, 'Own 25 cards.'::text, 3),
      ('arcane'::text, 'Rare discovery'::text, 'Discover your first rare card.'::text, 4),
      ('frostbite'::text, 'Wish streak'::text, 'Reach a 3-day streak.'::text, 5),
      ('sunset'::text, 'Treasure hunter'::text, 'Collect 10 treasure finds.'::text, 6),
      ('shadow'::text, 'Shipping ready'::text, 'Prepare a shipment.'::text, 7),
      ('forest'::text, 'Growing collection'::text, 'Own 10 unique cards.'::text, 8),
      ('cosmic_binder'::text, 'Legendary discovery'::text, 'Independent 1 in 50,000 wish drop.'::text, 9)
  ),
  binder_settings as (
    select settings.unlocked_theme_keys
    from public.get_player_binder_settings() as settings
    limit 1
  )
  select
    definitions.theme_key,
    definitions.theme_key = any(binder_settings.unlocked_theme_keys),
    definitions.achievement_title,
    definitions.requirement
  from theme_definitions as definitions
  cross join binder_settings
  order by definitions.sort_order;
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
    'frostbite', 'sunset', 'shadow', 'forest', 'cosmic_binder'
  ) then
    raise exception using errcode = '22023', message = 'That binder style does not exist.';
  end if;

  select settings.unlocked_theme_keys
  into v_allowed
  from public.get_player_binder_settings() as settings
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

create or replace function public.roll_cosmic_binder_after_wish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_roll integer;
  v_won boolean;
begin
  -- Separate lock namespace from Cosmic Nebu. The two awards never gate or
  -- influence each other, while concurrent wishes for one player stay safe.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 910002));

  if exists (
    select 1
    from public.cosmic_binder_ownerships as ownerships
    where ownerships.user_id = new.user_id
  ) then
    return new;
  end if;

  v_roll := 1 + floor(random() * 50000)::integer;

  insert into public.cosmic_binder_rolls (pull_id, user_id, roll_value, won)
  values (new.id, new.user_id, v_roll, v_roll = 1)
  on conflict (pull_id) do nothing
  returning won into v_won;

  -- A retried trigger cannot roll the same completed wish twice.
  if v_won is distinct from true then
    return new;
  end if;

  insert into public.cosmic_binder_ownerships (user_id, discovery_pull_id)
  values (new.user_id, new.id)
  on conflict (user_id) do nothing;

  if found then
    -- Like a newly discovered Nebu form, the artifact equips once on discovery.
    -- The owner can switch away and re-equip it later from their binder page.
    insert into public.player_binder_settings(user_id, theme_key, binder_name, updated_at)
    values (new.user_id, 'cosmic_binder', 'My Binder', now())
    on conflict (user_id)
    do update set theme_key = excluded.theme_key, updated_at = now();
  end if;

  return new;
end;
$function$;

drop trigger if exists player_wishes_roll_cosmic_binder on public.player_wishes;
create trigger player_wishes_roll_cosmic_binder
  after insert on public.player_wishes
  for each row
  execute function public.roll_cosmic_binder_after_wish();

revoke all on function public.get_player_binder_settings() from public;
revoke all on function public.get_player_binder_themes() from public;
revoke all on function public.set_player_binder_theme(text) from public;
grant execute on function public.get_player_binder_settings() to authenticated;
grant execute on function public.get_player_binder_themes() to authenticated;
grant execute on function public.set_player_binder_theme(text) to authenticated;

comment on table public.cosmic_binder_ownerships is
  'Permanent, uniquely numbered Cosmic Binder discoveries. One can be owned per account.';
comment on table public.cosmic_binder_rolls is
  'Immutable audit trail for the independent 1 in 50,000 Cosmic Binder roll on eligible completed wishes.';

commit;
