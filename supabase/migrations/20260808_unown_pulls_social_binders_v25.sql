-- Unown Pulls V25: private friend discovery, trainer IDs, custom binders,
-- persistent binder ordering and friend profile binders.

begin;

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception 'public.player_profiles is missing.';
  end if;
  if to_regclass('public.player_profile_details') is null then
    raise exception 'public.player_profile_details is missing.';
  end if;
  if to_regclass('public.player_friendships') is null then
    raise exception 'public.player_friendships is missing.';
  end if;
  if to_regclass('public.player_inventory') is null then
    raise exception 'public.player_inventory is missing.';
  end if;
  if to_regclass('public.pokemon_cards') is null then
    raise exception 'public.pokemon_cards is missing.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- PUBLIC TRAINER ID
-- ---------------------------------------------------------------------------

alter table public.player_profiles
add column if not exists trainer_code text;

update public.player_profiles
set trainer_code =
  'UP-' ||
  upper(substr(replace(user_id::text, '-', ''), 1, 4)) || '-' ||
  upper(substr(replace(user_id::text, '-', ''), 5, 4)) || '-' ||
  upper(substr(replace(user_id::text, '-', ''), 9, 4))
where trainer_code is null or btrim(trainer_code) = '';

create unique index if not exists player_profiles_trainer_code_key
on public.player_profiles (upper(trainer_code));

create or replace function public.ensure_player_trainer_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.trainer_code is null or btrim(new.trainer_code) = '' then
    new.trainer_code :=
      'UP-' ||
      upper(substr(replace(new.user_id::text, '-', ''), 1, 4)) || '-' ||
      upper(substr(replace(new.user_id::text, '-', ''), 5, 4)) || '-' ||
      upper(substr(replace(new.user_id::text, '-', ''), 9, 4));
  end if;

  return new;
end;
$function$;

drop trigger if exists player_profiles_trainer_code_trigger
on public.player_profiles;

create trigger player_profiles_trainer_code_trigger
before insert or update of user_id, trainer_code
on public.player_profiles
for each row
execute function public.ensure_player_trainer_code();

-- ---------------------------------------------------------------------------
-- BINDER SETTINGS + POSITION LEDGER
-- ---------------------------------------------------------------------------

create table if not exists public.player_binder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_key text not null default 'classic',
  updated_at timestamptz not null default now(),
  constraint player_binder_theme_key_check check (
    theme_key in (
      'classic', 'midnight', 'ancient', 'arcane',
      'frostbite', 'sunset', 'shadow', 'forest'
    )
  )
);

create table if not exists public.player_binder_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  position integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id),
  constraint player_binder_position_positive check (position > 0),
  constraint player_binder_position_unique unique (user_id, position)
);

create index if not exists player_binder_positions_order_idx
on public.player_binder_positions(user_id, position);

alter table public.player_binder_settings enable row level security;
alter table public.player_binder_positions enable row level security;

drop policy if exists player_binder_settings_read_own on public.player_binder_settings;
create policy player_binder_settings_read_own
on public.player_binder_settings
for select to authenticated
using (user_id = auth.uid());

drop policy if exists player_binder_positions_read_own on public.player_binder_positions;
create policy player_binder_positions_read_own
on public.player_binder_positions
for select to authenticated
using (user_id = auth.uid());

grant select on public.player_binder_settings to authenticated;
grant select on public.player_binder_positions to authenticated;

-- Backfill every currently-owned unique card without disturbing existing order.
with current_max as (
  select user_id, coalesce(max(position), 0) as max_position
  from public.player_binder_positions
  group by user_id
),
missing as (
  select
    inventory.user_id,
    inventory.card_id::text as card_id,
    coalesce(current_max.max_position, 0)
      + row_number() over (
          partition by inventory.user_id
          order by inventory.card_id::text
        ) as next_position
  from public.player_inventory as inventory
  left join current_max
    on current_max.user_id = inventory.user_id
  left join public.player_binder_positions as positions
    on positions.user_id = inventory.user_id
   and positions.card_id = inventory.card_id::text
  where coalesce(inventory.quantity, 0) > 0
    and positions.card_id is null
)
insert into public.player_binder_positions(user_id, card_id, position)
select user_id, card_id, next_position::integer
from missing
on conflict (user_id, card_id) do nothing;

create or replace function public.maintain_player_binder_position()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_card_id text;
  v_quantity integer;
  v_next integer;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_card_id := old.card_id::text;
    delete from public.player_binder_positions
    where user_id = v_user_id and card_id = v_card_id;
    return old;
  end if;

  v_user_id := new.user_id;
  v_card_id := new.card_id::text;
  v_quantity := coalesce(new.quantity, 0);

  if v_quantity <= 0 then
    delete from public.player_binder_positions
    where user_id = v_user_id and card_id = v_card_id;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if not exists (
    select 1 from public.player_binder_positions
    where user_id = v_user_id and card_id = v_card_id
  ) then
    select coalesce(max(position), 0) + 1
    into v_next
    from public.player_binder_positions
    where user_id = v_user_id;

    insert into public.player_binder_positions(user_id, card_id, position)
    values (v_user_id, v_card_id, v_next)
    on conflict (user_id, card_id) do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists player_inventory_binder_position_trigger
on public.player_inventory;

create trigger player_inventory_binder_position_trigger
after insert or update or delete
on public.player_inventory
for each row
execute function public.maintain_player_binder_position();

create or replace function public.sync_player_binder_positions()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_max integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  delete from public.player_binder_positions as positions
  where positions.user_id = v_user_id
    and not exists (
      select 1
      from public.player_inventory as inventory
      where inventory.user_id = v_user_id
        and inventory.card_id::text = positions.card_id
        and coalesce(inventory.quantity, 0) > 0
    );

  select coalesce(max(position), 0)
  into v_max
  from public.player_binder_positions
  where user_id = v_user_id;

  insert into public.player_binder_positions(user_id, card_id, position)
  select
    v_user_id,
    missing.card_id,
    (v_max + row_number() over (order by missing.card_id))::integer
  from (
    select inventory.card_id::text as card_id
    from public.player_inventory as inventory
    left join public.player_binder_positions as positions
      on positions.user_id = inventory.user_id
     and positions.card_id = inventory.card_id::text
    where inventory.user_id = v_user_id
      and coalesce(inventory.quantity, 0) > 0
      and positions.card_id is null
  ) as missing
  on conflict (user_id, card_id) do nothing;
end;
$function$;

create or replace function public.get_player_binder_settings()
returns table(theme_key text)
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

  insert into public.player_binder_settings(user_id, theme_key)
  values (v_user_id, 'classic')
  on conflict (user_id) do nothing;

  return query
  select settings.theme_key
  from public.player_binder_settings as settings
  where settings.user_id = v_user_id;
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

  insert into public.player_binder_settings(user_id, theme_key, updated_at)
  values (v_user_id, v_theme, now())
  on conflict (user_id)
  do update set theme_key = excluded.theme_key, updated_at = now();
end;
$function$;

create or replace function public.get_player_binder_position(p_card_id text)
returns table(binder_position integer)
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

  perform public.sync_player_binder_positions();

  return query
  select positions.position
  from public.player_binder_positions as positions
  where positions.user_id = v_user_id
    and positions.card_id = p_card_id
  limit 1;
end;
$function$;

create or replace function public.swap_player_binder_positions(
  p_first_card_id text,
  p_second_card_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_first integer;
  v_second integer;
  v_temp integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if p_first_card_id is null or p_second_card_id is null or p_first_card_id = p_second_card_id then
    raise exception using errcode = '22023', message = 'Choose two different cards.';
  end if;

  perform public.sync_player_binder_positions();
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select position into v_first
  from public.player_binder_positions
  where user_id = v_user_id and card_id = p_first_card_id
  for update;

  select position into v_second
  from public.player_binder_positions
  where user_id = v_user_id and card_id = p_second_card_id
  for update;

  if v_first is null or v_second is null then
    raise exception using errcode = 'P0001', message = 'Both cards must be in your collection.';
  end if;

  select coalesce(max(position), 0) + 1000000
  into v_temp
  from public.player_binder_positions
  where user_id = v_user_id;

  update public.player_binder_positions
  set position = v_temp, updated_at = now()
  where user_id = v_user_id and card_id = p_first_card_id;

  update public.player_binder_positions
  set position = v_first, updated_at = now()
  where user_id = v_user_id and card_id = p_second_card_id;

  update public.player_binder_positions
  set position = v_second, updated_at = now()
  where user_id = v_user_id and card_id = p_first_card_id;
end;
$function$;

-- Keep the existing collection return type. Only the ordering changes.
create or replace function public.get_player_collection(
  p_search text,
  p_set_name text,
  p_rarity text,
  p_availability text,
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
  quantity bigint,
  reserved_quantity bigint,
  available_quantity bigint,
  owned_value numeric,
  is_signature boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with owned as (
    select
      inventory.card_id::text as card_id,
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card') as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint as quantity,
      least(
        greatest(coalesce(inventory.reserved_quantity, 0), 0),
        greatest(coalesce(inventory.quantity, 0), 0)
      )::bigint as reserved_quantity,
      (details.signature_card_id::text = inventory.card_id::text) as is_signature,
      positions.position as binder_position
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    left join public.player_profile_details as details
      on details.user_id = inventory.user_id
    left join public.player_binder_positions as positions
      on positions.user_id = inventory.user_id
     and positions.card_id = inventory.card_id::text
    where inventory.user_id = auth.uid()
      and coalesce(inventory.quantity, 0) > 0
  ),
  filtered as (
    select
      owned.*,
      owned.quantity - owned.reserved_quantity as available_quantity,
      owned.quantity * owned.market_value as owned_value
    from owned
    where (
      coalesce(btrim(p_search), '') = ''
      or owned.name ilike '%' || btrim(p_search) || '%'
      or owned.set_name ilike '%' || btrim(p_search) || '%'
      or coalesce(owned.card_no, '') ilike '%' || btrim(p_search) || '%'
    )
    and (coalesce(btrim(p_set_name), '') = '' or owned.set_name = p_set_name)
    and (coalesce(btrim(p_rarity), '') = '' or owned.rarity = p_rarity)
    and (
      coalesce(p_availability, 'all') = 'all'
      or (p_availability = 'available' and owned.quantity - owned.reserved_quantity > 0)
      or (p_availability = 'reserved' and owned.reserved_quantity > 0)
      or (p_availability = 'duplicates' and owned.quantity > 1)
    )
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
    counted.quantity,
    counted.reserved_quantity,
    counted.available_quantity,
    counted.owned_value,
    counted.is_signature,
    counted.total_count
  from counted
  order by
    case when p_sort = 'binder' then coalesce(counted.binder_position, 2147483647) end asc,
    case when p_sort = 'value_desc' then counted.owned_value end desc nulls last,
    case when p_sort = 'value_asc' then counted.owned_value end asc nulls last,
    case when p_sort = 'quantity_desc' then counted.quantity end desc nulls last,
    case when p_sort = 'newest' then counted.card_id end desc nulls last,
    counted.is_signature desc,
    lower(counted.name) asc,
    counted.set_name asc,
    counted.card_no asc nulls last
  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (greatest(1, coalesce(p_page, 1)) - 1)
    * greatest(1, least(coalesce(p_page_size, 24), 60));
$function$;

-- ---------------------------------------------------------------------------
-- FRIEND PROFILE + FRIEND BINDER
-- ---------------------------------------------------------------------------

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

create or replace function public.get_friend_binder(
  p_target_user_id uuid,
  p_page integer default 1,
  p_page_size integer default 24
)
returns table (
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  quantity bigint,
  is_signature boolean,
  binder_position integer,
  total_count bigint
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
  binder as (
    select
      inventory.card_id::text as card_id,
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card') as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set') as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common') as rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint as quantity,
      (details.signature_card_id::text = inventory.card_id::text) as is_signature,
      positions.position as binder_position
    from allowed
    join public.player_inventory as inventory
      on inventory.user_id = allowed.target_id
    join public.player_binder_positions as positions
      on positions.user_id = inventory.user_id
     and positions.card_id = inventory.card_id::text
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    left join public.player_profile_details as details
      on details.user_id = inventory.user_id
    where coalesce(inventory.quantity, 0) > 0
  )
  select
    binder.card_id,
    binder.name,
    binder.set_name,
    binder.card_no,
    binder.rarity,
    binder.market_value,
    binder.image_url,
    binder.quantity,
    binder.is_signature,
    binder.binder_position,
    count(*) over()::bigint as total_count
  from binder
  order by binder.binder_position asc
  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (greatest(1, coalesce(p_page, 1)) - 1)
    * greatest(1, least(coalesce(p_page_size, 24), 60));
$function$;

grant execute on function public.sync_player_binder_positions() to authenticated;
grant execute on function public.get_player_binder_settings() to authenticated;
grant execute on function public.set_player_binder_theme(text) to authenticated;
grant execute on function public.get_player_binder_position(text) to authenticated;
grant execute on function public.swap_player_binder_positions(text, text) to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;
grant execute on function public.get_friend_binder(uuid, integer, integer) to authenticated;

commit;
