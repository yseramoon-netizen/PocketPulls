-- Unknown Pulls complete stabilisation V6
-- Re-applies account-scoped collection/profile functions.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception 'public.player_profiles is missing.';
  end if;

  if to_regclass('public.player_inventory') is null then
    raise exception 'public.player_inventory is missing.';
  end if;

  if to_regclass('public.player_profile_details') is null then
    raise exception 'public.player_profile_details is missing. Run the player expansion migration first.';
  end if;

  if to_regclass('public.pokemon_cards') is null then
    raise exception 'public.pokemon_cards is missing.';
  end if;
end;
$preflight$;

create unique index if not exists
  player_profile_details_user_id_unique
on public.player_profile_details(user_id);

create or replace function public.get_player_collection_overview()
returns table (
  total_cards bigint,
  unique_cards bigint,
  available_cards bigint,
  reserved_cards bigint,
  collection_value numeric,
  sets jsonb,
  rarities jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with owned as (
    select
      inventory.card_id::text as card_id,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint
        as quantity,
      least(
        greatest(coalesce(inventory.reserved_quantity, 0), 0),
        greatest(coalesce(inventory.quantity, 0), 0)
      )::bigint as reserved_quantity,
      cards.set_name,
      cards.rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric
        as market_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    where inventory.user_id = auth.uid()
      and coalesce(inventory.quantity, 0) > 0
  )
  select
    coalesce(sum(owned.quantity), 0)::bigint,
    count(*)::bigint,
    coalesce(
      sum(owned.quantity - owned.reserved_quantity),
      0
    )::bigint,
    coalesce(sum(owned.reserved_quantity), 0)::bigint,
    coalesce(
      sum(owned.quantity * owned.market_value),
      0
    )::numeric,
    coalesce(
      jsonb_agg(distinct owned.set_name)
        filter (
          where owned.set_name is not null
            and btrim(owned.set_name) <> ''
        ),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(distinct owned.rarity)
        filter (
          where owned.rarity is not null
            and btrim(owned.rarity) <> ''
        ),
      '[]'::jsonb
    )
  from owned;
$function$;

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
      coalesce(nullif(btrim(cards.name), ''), 'Unknown card')
        as name,
      coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set')
        as set_name,
      nullif(btrim(cards.card_no), '') as card_no,
      coalesce(nullif(btrim(cards.rarity), ''), 'Common')
        as rarity,
      greatest(coalesce(cards.market_value, 0), 0)::numeric
        as market_value,
      nullif(btrim(cards.image_url), '') as image_url,
      greatest(coalesce(inventory.quantity, 0), 0)::bigint
        as quantity,
      least(
        greatest(coalesce(inventory.reserved_quantity, 0), 0),
        greatest(coalesce(inventory.quantity, 0), 0)
      )::bigint as reserved_quantity,
      (
        details.signature_card_id::text = inventory.card_id::text
      ) as is_signature
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    left join public.player_profile_details as details
      on details.user_id = inventory.user_id
    where inventory.user_id = auth.uid()
      and coalesce(inventory.quantity, 0) > 0
  ),
  filtered as (
    select
      owned.*,
      owned.quantity - owned.reserved_quantity
        as available_quantity,
      owned.quantity * owned.market_value
        as owned_value
    from owned
    where (
      coalesce(btrim(p_search), '') = ''
      or owned.name ilike '%' || btrim(p_search) || '%'
      or owned.set_name ilike '%' || btrim(p_search) || '%'
      or coalesce(owned.card_no, '') ilike
        '%' || btrim(p_search) || '%'
    )
    and (
      coalesce(btrim(p_set_name), '') = ''
      or owned.set_name = p_set_name
    )
    and (
      coalesce(btrim(p_rarity), '') = ''
      or owned.rarity = p_rarity
    )
    and (
      coalesce(p_availability, 'all') = 'all'
      or (
        p_availability = 'available'
        and owned.quantity - owned.reserved_quantity > 0
      )
      or (
        p_availability = 'reserved'
        and owned.reserved_quantity > 0
      )
      or (
        p_availability = 'duplicates'
        and owned.quantity > 1
      )
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
    counted.quantity,
    counted.reserved_quantity,
    counted.available_quantity,
    counted.owned_value,
    counted.is_signature,
    counted.total_count
  from counted
  order by
    counted.is_signature desc,

    case
      when p_sort = 'value_desc'
      then counted.owned_value
    end desc nulls last,

    case
      when p_sort = 'value_asc'
      then counted.owned_value
    end asc nulls last,

    case
      when p_sort = 'quantity_desc'
      then counted.quantity
    end desc nulls last,

    case
      when p_sort = 'newest'
      then counted.card_id
    end desc nulls last,

    lower(counted.name) asc,
    counted.set_name asc,
    counted.card_no asc nulls last

  limit greatest(1, least(coalesce(p_page_size, 24), 60))
  offset (
    greatest(1, coalesce(p_page, 1)) - 1
  ) * greatest(
    1,
    least(coalesce(p_page_size, 24), 60)
  );
$function$;

create or replace function public.set_player_signature_card(
  p_card_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.player_inventory as inventory
    where inventory.user_id = v_user_id
      and inventory.card_id::text = p_card_id
      and coalesce(inventory.quantity, 0) > 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You can only choose a card that you own.';
  end if;

  insert into public.player_profile_details (
    user_id,
    signature_card_id,
    updated_at
  )
  values (
    v_user_id,
    p_card_id,
    now()
  )
  on conflict (user_id)
  do update set
    signature_card_id = excluded.signature_card_id,
    updated_at = now();
end;
$function$;

create or replace function public.get_player_profile_dashboard()
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  favourite_pokemon text,
  location_label text,
  signature_card_id text,
  profile_public boolean,
  joined_at timestamptz,
  wish_balance bigint,
  lifetime_wishes bigint,
  total_cards bigint,
  unique_cards bigint,
  collection_value numeric,
  signature_name text,
  signature_set_name text,
  signature_card_no text,
  signature_rarity text,
  signature_market_value numeric,
  signature_image_url text
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  with inventory_totals as (
    select
      inventory.user_id,
      coalesce(
        sum(greatest(coalesce(inventory.quantity, 0), 0)),
        0
      )::bigint as total_cards,
      count(*) filter (
        where coalesce(inventory.quantity, 0) > 0
      )::bigint as unique_cards,
      coalesce(
        sum(
          greatest(coalesce(inventory.quantity, 0), 0)
          * greatest(coalesce(cards.market_value, 0), 0)
        ),
        0
      )::numeric as collection_value
    from public.player_inventory as inventory
    left join public.pokemon_cards as cards
      on cards.id::text = inventory.card_id::text
    where inventory.user_id = auth.uid()
    group by inventory.user_id
  )
  select
    profiles.user_id,
    users.email::text,
    coalesce(profiles.username, ''),
    coalesce(profiles.display_name, ''),
    profiles.avatar_url,
    coalesce(details.bio, ''),
    coalesce(details.favourite_pokemon, ''),
    coalesce(details.location_label, ''),
    details.signature_card_id::text,
    coalesce(details.profile_public, true),
    users.created_at,
    greatest(coalesce(wallets.wish_balance, 0), 0)::bigint,
    greatest(
      coalesce(wallets.lifetime_wishes_spent, 0),
      0
    )::bigint,
    coalesce(inventory.total_cards, 0)::bigint,
    coalesce(inventory.unique_cards, 0)::bigint,
    coalesce(inventory.collection_value, 0)::numeric,
    signature.name,
    signature.set_name,
    signature.card_no,
    signature.rarity,
    greatest(
      coalesce(signature.market_value, 0),
      0
    )::numeric,
    signature.image_url
  from public.player_profiles as profiles
  join auth.users as users
    on users.id = profiles.user_id
  left join public.player_wallets as wallets
    on wallets.user_id = profiles.user_id
  left join inventory_totals as inventory
    on inventory.user_id = profiles.user_id
  left join public.player_profile_details as details
    on details.user_id = profiles.user_id
  left join public.pokemon_cards as signature
    on signature.id::text = details.signature_card_id::text
  where profiles.user_id = auth.uid();
$function$;

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
        'Username must be 3-24 characters using letters, numbers and underscores.';
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

revoke all
on function public.get_player_collection_overview()
from public;

grant execute
on function public.get_player_collection_overview()
to authenticated;

revoke all
on function public.get_player_collection(
  text, text, text, text, text, integer, integer
)
from public;

grant execute
on function public.get_player_collection(
  text, text, text, text, text, integer, integer
)
to authenticated;

revoke all
on function public.set_player_signature_card(text)
from public;

grant execute
on function public.set_player_signature_card(text)
to authenticated;

revoke all
on function public.get_player_profile_dashboard()
from public;

grant execute
on function public.get_player_profile_dashboard()
to authenticated;

revoke all
on function public.update_player_profile(
  text, text, text, text, text, text, boolean
)
from public;

grant execute
on function public.update_player_profile(
  text, text, text, text, text, text, boolean
)
to authenticated;

commit;

