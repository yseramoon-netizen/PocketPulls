-- Unknown Pulls player testing and Shaymin account management
-- Generated 2026-08-04
--
-- Fixes:
-- 1. Friend search now includes every Auth account by backfilling missing
--    player profiles and searching username, display name and email prefix.
-- 2. Jirachi wishes are read-only tests. The existing UI and cinematic stay
--    unchanged, but no inventory, wallet, collection or history row changes.
-- 3. Shaymin administrators can manage player bans, wishes and cards.
--
-- Run this in Supabase SQL Editor after the existing player, account gateway
-- and friends/trading migrations.

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass(
    'public.player_profiles'
  ) is null then
    raise exception
      'public.player_profiles is missing. Run the player account migration first.';
  end if;

  if to_regclass(
    'public.player_wallets'
  ) is null then
    raise exception
      'public.player_wallets is missing. Run the player account migration first.';
  end if;

  if to_regclass(
    'public.player_inventory'
  ) is null then
    raise exception
      'public.player_inventory is missing. Run the player inventory migration first.';
  end if;

  if to_regclass(
    'public.pokemon_cards'
  ) is null then
    raise exception
      'public.pokemon_cards is missing. Run the card database migration first.';
  end if;

  if to_regclass(
    'public.inventory'
  ) is null then
    raise exception
      'public.inventory is missing. Run the physical inventory migration first.';
  end if;

  if to_regclass(
    'public.admin_users'
  ) is null then
    raise exception
      'public.admin_users is missing. Run the core access migration first.';
  end if;

  if to_regclass(
    'public.player_friendships'
  ) is null then
    raise exception
      'public.player_friendships is missing. Run the friends and trading migration first.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- PLAYER BAN FIELDS
-- ---------------------------------------------------------------------------

alter table
  public.player_profiles

add column if not exists
  is_banned boolean
    not null
    default false,

add column if not exists
  ban_reason text,

add column if not exists
  banned_at timestamptz,

add column if not exists
  banned_by uuid
    references auth.users(id)
    on delete set null,

add column if not exists
  last_seen_at timestamptz;

create index if not exists
  player_profiles_ban_idx

on public.player_profiles(
  is_banned,
  updated_at desc
);

-- ---------------------------------------------------------------------------
-- BACKFILL EVERY AUTH ACCOUNT INTO THE PLAYER SYSTEM
-- ---------------------------------------------------------------------------

insert into
  public.player_profiles (
    user_id,
    username,
    display_name,
    avatar_url,
    created_at,
    updated_at
  )

select
  account.id,

  left(
    regexp_replace(
      lower(
        coalesce(
          nullif(
            btrim(
              account.raw_user_meta_data
                ->> 'username'
            ),
            ''
          ),

          nullif(
            split_part(
              coalesce(
                account.email,
                ''
              ),
              '@',
              1
            ),
            ''
          ),

          'trainer'
        )
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    ),
    11
  )
  ||
  '_'
  ||
  left(
    replace(
      account.id::text,
      '-',
      ''
    ),
    12
  )
    as username,

  left(
    coalesce(
      nullif(
        btrim(
          account.raw_user_meta_data
            ->> 'display_name'
        ),
        ''
      ),

      nullif(
        btrim(
          account.raw_user_meta_data
            ->> 'full_name'
        ),
        ''
      ),

      nullif(
        split_part(
          coalesce(
            account.email,
            ''
          ),
          '@',
          1
        ),
        ''
      ),

      'Unknown Trainer'
    ),
    60
  )
    as display_name,

  nullif(
    btrim(
      coalesce(
        account.raw_user_meta_data
          ->> 'avatar_url',

        account.raw_user_meta_data
          ->> 'picture',

        ''
      )
    ),
    ''
  )
    as avatar_url,

  coalesce(
    account.created_at,
    now()
  ),

  now()

from auth.users
  as account

left join public.player_profiles
  as profile

  on profile.user_id =
    account.id

where profile.user_id
  is null

on conflict (
  user_id
)

do nothing;

update public.player_profiles
  as profile

set
  username =
    left(
      regexp_replace(
        lower(
          coalesce(
            nullif(
              split_part(
                coalesce(
                  account.email,
                  ''
                ),
                '@',
                1
              ),
              ''
            ),
            'trainer'
          )
        ),
        '[^a-z0-9_]+',
        '_',
        'g'
      ),
      11
    )
    ||
    '_'
    ||
    left(
      replace(
        profile.user_id::text,
        '-',
        ''
      ),
      12
    ),

  display_name =
    coalesce(
      nullif(
        btrim(
          profile.display_name
        ),
        ''
      ),

      nullif(
        split_part(
          coalesce(
            account.email,
            ''
          ),
          '@',
          1
        ),
        ''
      ),

      'Unknown Trainer'
    ),

  updated_at =
    now()

from auth.users
  as account

where account.id =
    profile.user_id

  and (
    profile.username is null

    or

    btrim(
      profile.username
    ) = ''

    or

    profile.display_name
      is null

    or

    btrim(
      profile.display_name
    ) = ''
  );

insert into
  public.player_wallets (
    user_id,
    wish_balance,
    lifetime_wishes_spent,
    created_at,
    updated_at
  )

select
  account.id,
  0,
  0,
  coalesce(
    account.created_at,
    now()
  ),
  now()

from auth.users
  as account

left join public.player_wallets
  as wallet

  on wallet.user_id =
    account.id

where wallet.user_id
  is null

on conflict (
  user_id
)

do nothing;

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ---------------------------------------------------------------------------

create table if not exists
public.admin_player_events (
  id uuid
    primary key
    default gen_random_uuid(),

  admin_user_id uuid,
  admin_email text
    not null,

  player_user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  event_type text
    not null,

  amount integer,

  card_id text,

  reason text,

  before_state jsonb
    not null
    default '{}'::jsonb,

  after_state jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now()
);

create index if not exists
  admin_player_events_player_idx

on public.admin_player_events(
  player_user_id,
  created_at desc
);

create index if not exists
  admin_player_events_admin_idx

on public.admin_player_events(
  admin_email,
  created_at desc
);

alter table
  public.admin_player_events
enable row level security;

revoke all
on public.admin_player_events
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- FRIEND SEARCH REPAIR
-- ---------------------------------------------------------------------------

drop function if exists
public.search_player_friends(
  text,
  integer
);

create function
public.search_player_friends(
  p_query text,
  p_limit integer
    default 20
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  relationship_status text,
  direction text,
  friendship_id uuid,
  online boolean,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  auth,
  pg_temp
as $function$
  with cleaned as (
    select
      lower(
        btrim(
          coalesce(
            p_query,
            ''
          )
        )
      )
        as query
  )
  select
    profile.user_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,

    case
      when friendship.id
        is null
        then 'none'
      else friendship.status
    end
      as relationship_status,

    case
      when friendship.id
        is null
        then 'none'

      when friendship.status =
          'accepted'
        then 'accepted'

      when friendship.status =
          'blocked'
        and friendship.blocked_by =
          auth.uid()
        then 'blocked'

      when friendship.requester_id =
          auth.uid()
        then 'outgoing'

      else 'incoming'
    end
      as direction,

    friendship.id
      as friendship_id,

    coalesce(
      profile.last_seen_at >
        now() -
        interval '5 minutes',
      false
    )
      as online,

    profile.last_seen_at

  from public.player_profiles
    as profile

  join auth.users
    as account

    on account.id =
      profile.user_id

  cross join cleaned

  left join lateral (
    select
      relation.*

    from public.player_friendships
      as relation

    where least(
      relation.requester_id,
      relation.addressee_id
    ) =
      least(
        auth.uid(),
        profile.user_id
      )

      and greatest(
        relation.requester_id,
        relation.addressee_id
      ) =
        greatest(
          auth.uid(),
          profile.user_id
        )

    limit 1
  )
    as friendship
    on true

  where auth.uid()
    is not null

    and profile.user_id <>
      auth.uid()

    and not coalesce(
      profile.is_banned,
      false
    )

    and cleaned.query <> ''

    and (
      lower(
        coalesce(
          profile.username,
          ''
        )
      )
        like
          '%' ||
          cleaned.query ||
          '%'

      or

      lower(
        coalesce(
          profile.display_name,
          ''
        )
      )
        like
          '%' ||
          cleaned.query ||
          '%'

      or

      lower(
        split_part(
          coalesce(
            account.email,
            ''
          ),
          '@',
          1
        )
      )
        like
          '%' ||
          cleaned.query ||
          '%'
    )

    and not (
      friendship.status =
        'blocked'

      and friendship.blocked_by <>
        auth.uid()
    )

  order by
    online desc,
    profile.username

  limit greatest(
    1,
    least(
      coalesce(
        p_limit,
        20
      ),
      50
    )
  );
$function$;

drop function if exists
public.get_player_friend_dashboard();

create function
public.get_player_friend_dashboard()
returns table (
  friendship_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  relationship_status text,
  direction text,
  blocked_by_me boolean,
  online boolean,
  last_seen_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $function$
  select
    friendship.id
      as friendship_id,

    other_profile.user_id
      as other_user_id,

    other_profile.username,
    other_profile.display_name,
    other_profile.avatar_url,

    friendship.status
      as relationship_status,

    case
      when friendship.status =
          'accepted'
        then 'accepted'

      when friendship.status =
          'blocked'
        then 'blocked'

      when friendship.requester_id =
          auth.uid()
        then 'outgoing'

      else 'incoming'
    end
      as direction,

    friendship.status =
      'blocked'

      and

    friendship.blocked_by =
      auth.uid()
      as blocked_by_me,

    coalesce(
      other_profile.last_seen_at >
        now() -
        interval '5 minutes',
      false
    )
      as online,

    other_profile.last_seen_at,
    friendship.created_at

  from public.player_friendships
    as friendship

  join public.player_profiles
    as other_profile

    on other_profile.user_id =
      case
        when friendship.requester_id =
            auth.uid()
          then friendship.addressee_id
        else friendship.requester_id
      end

  where auth.uid()
    is not null

    and not coalesce(
      other_profile.is_banned,
      false
    )

    and (
      friendship.requester_id =
        auth.uid()

      or

      friendship.addressee_id =
        auth.uid()
    )

    and not (
      friendship.status =
        'blocked'

      and friendship.blocked_by <>
        auth.uid()
    )

  order by
    case friendship.status
      when 'pending'
        then 0
      when 'accepted'
        then 1
      else 2
    end,

    online desc,
    other_profile.username;
$function$;

revoke all
on function
  public.search_player_friends(text, integer)
from public;

revoke all
on function
  public.get_player_friend_dashboard()
from public;

grant execute
on function
  public.search_player_friends(text, integer)
to authenticated;

grant execute
on function
  public.get_player_friend_dashboard()
to authenticated;

-- ---------------------------------------------------------------------------
-- JIRACHI READ-ONLY TEST PULL
-- ---------------------------------------------------------------------------

create or replace function
public.make_player_wish()
returns table (
  wish_id text,
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  wish_balance integer
)
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_balance integer;

  v_card_id text;
  v_name text;
  v_set_name text;
  v_card_no text;
  v_rarity text;
  v_market_value numeric;
  v_image_url text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message =
        'You must be signed in to make a wish.';
  end if;

  if exists (
    select 1

    from public.player_profiles
      as profile

    where profile.user_id =
        v_user_id

      and profile.is_banned
  ) then
    raise exception using
      errcode = '42501',
      message =
        'This trainer account is suspended.';
  end if;

  select
    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer

  into v_balance

  from public.player_wallets
    as wallet

  where wallet.user_id =
    v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'Your wish wallet does not exist.';
  end if;

  select
    card.id::text,
    card.name,
    card.set_name,
    card.card_no,
    card.rarity,
    coalesce(
      card.market_value,
      0
    )::numeric,
    card.image_url

  into
    v_card_id,
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url

  from public.inventory
    as stock

  join public.pokemon_cards
    as card

    on card.id::text =
      stock.card_id::text

  where coalesce(
      stock.quantity,
      0
    ) > 0

    and stock.card_id
      is not null

  order by
    -ln(
      greatest(
        random(),
        0.0000001
      )
    )
    /
    greatest(
      coalesce(
        stock.quantity,
        0
      ),
      1
    )

  limit 1;

  if v_card_id is null then
    raise exception using
      errcode = 'P0001',
      message =
        'There are no positive-quantity cards available in the test pool.';
  end if;

  /*
   * READ-ONLY TEST GUARANTEE
   *
   * No UPDATE, INSERT or DELETE is performed.
   *
   * - Physical inventory is unchanged.
   * - Wish balance is unchanged.
   * - Lifetime wishes spent is unchanged.
   * - Player inventory is unchanged.
   * - Player wish history is unchanged.
   */
  return query

  select
    'test-' ||
      gen_random_uuid()::text,

    v_card_id,
    coalesce(
      v_name,
      'Unknown card'
    ),

    coalesce(
      v_set_name,
      'Unknown set'
    ),

    coalesce(
      v_card_no,
      ''
    ),

    coalesce(
      v_rarity,
      'Unknown rarity'
    ),

    coalesce(
      v_market_value,
      0
    ),

    v_image_url,
    v_balance;
end;
$function$;

revoke all
on function
  public.make_player_wish()
from public;

grant execute
on function
  public.make_player_wish()
to authenticated;

comment on function
  public.make_player_wish()
is
  'Read-only Jirachi testing pull. Returns a weighted physical-stock card without mutating stock, wallets, collections or wish history.';

-- ---------------------------------------------------------------------------
-- SHAYMIN ADMIN READ MODELS
-- ---------------------------------------------------------------------------

drop function if exists
public.admin_search_player_accounts(
  text,
  integer
);

create function
public.admin_search_player_accounts(
  p_query text,
  p_limit integer
    default 100
)
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  wish_balance integer,
  lifetime_wishes_spent integer,
  total_cards bigint,
  reserved_cards bigint,
  collection_value numeric,
  is_banned boolean,
  ban_reason text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  auth,
  pg_temp
as $function$
  with cleaned as (
    select
      lower(
        btrim(
          coalesce(
            p_query,
            ''
          )
        )
      )
        as query
  )
  select
    account.id
      as user_id,

    account.email::text
      as email,

    profile.username,
    profile.display_name,
    profile.avatar_url,

    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer
      as wish_balance,

    greatest(
      coalesce(
        wallet.lifetime_wishes_spent,
        0
      ),
      0
    )::integer
      as lifetime_wishes_spent,

    coalesce(
      inventory_totals.total_cards,
      0
    )::bigint
      as total_cards,

    coalesce(
      inventory_totals.reserved_cards,
      0
    )::bigint
      as reserved_cards,

    coalesce(
      inventory_totals.collection_value,
      0
    )::numeric
      as collection_value,

    coalesce(
      profile.is_banned,
      false
    )
      as is_banned,

    profile.ban_reason,
    account.created_at,
    account.last_sign_in_at,
    profile.last_seen_at

  from auth.users
    as account

  join public.player_profiles
    as profile

    on profile.user_id =
      account.id

  left join public.player_wallets
    as wallet

    on wallet.user_id =
      account.id

  left join lateral (
    select
      sum(
        greatest(
          coalesce(
            inventory.quantity,
            0
          ),
          0
        )
      )::bigint
        as total_cards,

      sum(
        greatest(
          coalesce(
            inventory.reserved_quantity,
            0
          ),
          0
        )
      )::bigint
        as reserved_cards,

      sum(
        greatest(
          coalesce(
            inventory.quantity,
            0
          ),
          0
        )
        *
        coalesce(
          card.market_value,
          0
        )
      )::numeric
        as collection_value

    from public.player_inventory
      as inventory

    left join public.pokemon_cards
      as card

      on card.id::text =
        inventory.card_id::text

    where inventory.user_id =
      account.id
  )
    as inventory_totals
    on true

  cross join cleaned

  where cleaned.query = ''

    or

    lower(
      coalesce(
        account.email,
        ''
      )
    )
      like
        '%' ||
        cleaned.query ||
        '%'

    or

    lower(
      coalesce(
        profile.username,
        ''
      )
    )
      like
        '%' ||
        cleaned.query ||
        '%'

    or

    lower(
      coalesce(
        profile.display_name,
        ''
      )
    )
      like
        '%' ||
        cleaned.query ||
        '%'

  order by
    profile.is_banned desc,
    account.created_at desc

  limit greatest(
    1,
    least(
      coalesce(
        p_limit,
        100
      ),
      250
    )
  );
$function$;

drop function if exists
public.admin_get_player_account(uuid);

create function
public.admin_get_player_account(
  p_user_id uuid
)
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  wish_balance integer,
  lifetime_wishes_spent integer,
  total_cards bigint,
  reserved_cards bigint,
  collection_value numeric,
  is_banned boolean,
  ban_reason text,
  banned_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  auth,
  pg_temp
as $function$
  select
    account.id
      as user_id,

    account.email::text
      as email,

    profile.username,
    profile.display_name,
    profile.avatar_url,

    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer
      as wish_balance,

    greatest(
      coalesce(
        wallet.lifetime_wishes_spent,
        0
      ),
      0
    )::integer
      as lifetime_wishes_spent,

    coalesce(
      inventory_totals.total_cards,
      0
    )::bigint
      as total_cards,

    coalesce(
      inventory_totals.reserved_cards,
      0
    )::bigint
      as reserved_cards,

    coalesce(
      inventory_totals.collection_value,
      0
    )::numeric
      as collection_value,

    coalesce(
      profile.is_banned,
      false
    )
      as is_banned,

    profile.ban_reason,
    profile.banned_at,
    account.created_at,
    account.last_sign_in_at,
    profile.last_seen_at

  from auth.users
    as account

  join public.player_profiles
    as profile

    on profile.user_id =
      account.id

  left join public.player_wallets
    as wallet

    on wallet.user_id =
      account.id

  left join lateral (
    select
      sum(
        greatest(
          coalesce(
            inventory.quantity,
            0
          ),
          0
        )
      )::bigint
        as total_cards,

      sum(
        greatest(
          coalesce(
            inventory.reserved_quantity,
            0
          ),
          0
        )
      )::bigint
        as reserved_cards,

      sum(
        greatest(
          coalesce(
            inventory.quantity,
            0
          ),
          0
        )
        *
        coalesce(
          card.market_value,
          0
        )
      )::numeric
        as collection_value

    from public.player_inventory
      as inventory

    left join public.pokemon_cards
      as card

      on card.id::text =
        inventory.card_id::text

    where inventory.user_id =
      account.id
  )
    as inventory_totals
    on true

  where account.id =
    p_user_id

  limit 1;
$function$;

drop function if exists
public.admin_get_player_inventory(uuid);

create function
public.admin_get_player_inventory(
  p_user_id uuid
)
returns table (
  card_id text,
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text
)
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $function$
  select
    inventory.card_id::text
      as card_id,

    greatest(
      coalesce(
        inventory.quantity,
        0
      ),
      0
    )::integer
      as quantity,

    greatest(
      coalesce(
        inventory.reserved_quantity,
        0
      ),
      0
    )::integer
      as reserved_quantity,

    greatest(
      coalesce(
        inventory.quantity,
        0
      )
      -
      coalesce(
        inventory.reserved_quantity,
        0
      ),
      0
    )::integer
      as available_quantity,

    coalesce(
      card.name,
      'Unknown card'
    )
      as name,

    card.set_name,
    card.card_no,
    card.rarity,

    coalesce(
      card.market_value,
      0
    )::numeric
      as market_value,

    card.image_url

  from public.player_inventory
    as inventory

  left join public.pokemon_cards
    as card

    on card.id::text =
      inventory.card_id::text

  where inventory.user_id =
    p_user_id

    and coalesce(
      inventory.quantity,
      0
    ) > 0

  order by
    coalesce(
      card.market_value,
      0
    ) desc,
    card.name;
$function$;

-- ---------------------------------------------------------------------------
-- SHAYMIN ADMIN ACTIONS
-- ---------------------------------------------------------------------------

create or replace function
public.admin_adjust_player_wishes(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_admin_user_id uuid,
  p_admin_email text
)
returns integer
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_before integer;
  v_after integer;
begin
  if p_user_id is null then
    raise exception
      'Choose a player account.';
  end if;

  if p_delta is null
    or p_delta = 0 then
    raise exception
      'Wish adjustment cannot be zero.';
  end if;

  if abs(p_delta) > 100000 then
    raise exception
      'Wish adjustment is too large.';
  end if;

  insert into
    public.player_wallets (
      user_id,
      wish_balance,
      lifetime_wishes_spent,
      created_at,
      updated_at
    )

  values (
    p_user_id,
    0,
    0,
    now(),
    now()
  )

  on conflict (
    user_id
  )

  do nothing;

  select
    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer

  into v_before

  from public.player_wallets
    as wallet

  where wallet.user_id =
      p_user_id

  for update;

  v_after :=
    greatest(
      0,
      v_before +
      p_delta
    );

  update public.player_wallets
  set
    wish_balance =
      v_after,

    updated_at =
      now()

  where user_id =
    p_user_id;

  insert into
    public.admin_player_events (
      admin_user_id,
      admin_email,
      player_user_id,
      event_type,
      amount,
      reason,
      before_state,
      after_state
    )

  values (
    p_admin_user_id,
    coalesce(
      nullif(
        btrim(
          p_admin_email
        ),
        ''
      ),
      'unknown-admin'
    ),
    p_user_id,
    'wish_adjustment',
    p_delta,
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    ),
    jsonb_build_object(
      'wish_balance',
      v_before
    ),
    jsonb_build_object(
      'wish_balance',
      v_after
    )
  );

  return v_after;
end;
$function$;

create or replace function
public.admin_adjust_player_card(
  p_user_id uuid,
  p_card_id text,
  p_delta integer,
  p_reason text,
  p_admin_user_id uuid,
  p_admin_email text
)
returns integer
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_card_id text :=
    btrim(
      coalesce(
        p_card_id,
        ''
      )
    );

  v_card_type text;

  v_before integer :=
    0;

  v_reserved integer :=
    0;

  v_after integer :=
    0;

  v_row_exists boolean :=
    false;

  v_sql text;
begin
  if p_user_id is null then
    raise exception
      'Choose a player account.';
  end if;

  if v_card_id = '' then
    raise exception
      'Choose a card.';
  end if;

  if p_delta is null
    or p_delta = 0 then
    raise exception
      'Card adjustment cannot be zero.';
  end if;

  if abs(p_delta) > 10000 then
    raise exception
      'Card adjustment is too large.';
  end if;

  if not exists (
    select 1

    from public.pokemon_cards
      as card

    where card.id::text =
      v_card_id
  ) then
    raise exception
      'That card does not exist in the master database.';
  end if;

  select
    greatest(
      coalesce(
        inventory.quantity,
        0
      ),
      0
    )::integer,

    greatest(
      coalesce(
        inventory.reserved_quantity,
        0
      ),
      0
    )::integer

  into
    v_before,
    v_reserved

  from public.player_inventory
    as inventory

  where inventory.user_id =
      p_user_id

    and inventory.card_id::text =
      v_card_id

  for update;

  if found then
    v_row_exists :=
      true;
  else
    v_before :=
      0;

    v_reserved :=
      0;
  end if;

  if p_delta < 0
    and abs(p_delta) >
      greatest(
        v_before -
        v_reserved,
        0
      ) then

    raise exception
      'Only % unreserved copies can be removed.',
      greatest(
        v_before -
        v_reserved,
        0
      );
  end if;

  v_after :=
    greatest(
      0,
      v_before +
      p_delta
    );

  if v_row_exists then
    update public.player_inventory
    set quantity =
      v_after

    where user_id =
        p_user_id

      and card_id::text =
        v_card_id;

  elsif p_delta > 0 then
    select
      format_type(
        attribute.atttypid,
        attribute.atttypmod
      )

    into v_card_type

    from pg_attribute
      as attribute

    where attribute.attrelid =
        'public.player_inventory'::regclass

      and attribute.attname =
        'card_id'

      and not attribute.attisdropped;

    if v_card_type is null then
      raise exception
        'player_inventory.card_id is missing.';
    end if;

    v_sql :=
      'insert into public.player_inventory ' ||
      '(user_id, card_id, quantity, reserved_quantity) ' ||
      'values ($1, ' ||
      quote_literal(
        v_card_id
      ) ||
      '::' ||
      v_card_type ||
      ', $2, 0)';

    execute v_sql
    using
      p_user_id,
      v_after;
  end if;

  if v_after = 0
    and v_reserved = 0 then

    delete from
      public.player_inventory

    where user_id =
        p_user_id

      and card_id::text =
        v_card_id;
  end if;

  insert into
    public.admin_player_events (
      admin_user_id,
      admin_email,
      player_user_id,
      event_type,
      amount,
      card_id,
      reason,
      before_state,
      after_state
    )

  values (
    p_admin_user_id,
    coalesce(
      nullif(
        btrim(
          p_admin_email
        ),
        ''
      ),
      'unknown-admin'
    ),
    p_user_id,
    'card_adjustment',
    p_delta,
    v_card_id,
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    ),
    jsonb_build_object(
      'quantity',
      v_before,
      'reserved_quantity',
      v_reserved
    ),
    jsonb_build_object(
      'quantity',
      v_after,
      'reserved_quantity',
      least(
        v_reserved,
        v_after
      )
    )
  );

  return v_after;
end;
$function$;

create or replace function
public.admin_set_player_ban(
  p_user_id uuid,
  p_banned boolean,
  p_reason text,
  p_admin_user_id uuid,
  p_admin_email text
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_before boolean;
  v_reason text :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );
begin
  if p_user_id is null then
    raise exception
      'Choose a player account.';
  end if;

  if exists (
    select 1

    from public.admin_users
      as administrator

    where administrator.user_id =
        p_user_id

      and administrator.is_active
  ) then
    raise exception
      'An active Shaymin administrator cannot be banned here.';
  end if;

  select
    coalesce(
      profile.is_banned,
      false
    )

  into v_before

  from public.player_profiles
    as profile

  where profile.user_id =
      p_user_id

  for update;

  if not found then
    raise exception
      'That player profile does not exist.';
  end if;

  update public.player_profiles
  set
    is_banned =
      coalesce(
        p_banned,
        false
      ),

    ban_reason =
      case
        when coalesce(
          p_banned,
          false
        )
          then coalesce(
            v_reason,
            'Suspended by an administrator.'
          )
        else null
      end,

    banned_at =
      case
        when coalesce(
          p_banned,
          false
        )
          then now()
        else null
      end,

    banned_by =
      case
        when coalesce(
          p_banned,
          false
        )
          then p_admin_user_id
        else null
      end,

    updated_at =
      now()

  where user_id =
    p_user_id;

  insert into
    public.admin_player_events (
      admin_user_id,
      admin_email,
      player_user_id,
      event_type,
      reason,
      before_state,
      after_state
    )

  values (
    p_admin_user_id,
    coalesce(
      nullif(
        btrim(
          p_admin_email
        ),
        ''
      ),
      'unknown-admin'
    ),
    p_user_id,
    case
      when coalesce(
        p_banned,
        false
      )
        then 'player_banned'
      else 'player_unbanned'
    end,
    v_reason,
    jsonb_build_object(
      'is_banned',
      v_before
    ),
    jsonb_build_object(
      'is_banned',
      coalesce(
        p_banned,
        false
      )
    )
  );

  return coalesce(
    p_banned,
    false
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- SERVICE ROLE PERMISSIONS
-- ---------------------------------------------------------------------------

revoke all
on function
  public.admin_search_player_accounts(text, integer)
from public;

revoke all
on function
  public.admin_get_player_account(uuid)
from public;

revoke all
on function
  public.admin_get_player_inventory(uuid)
from public;

revoke all
on function
  public.admin_adjust_player_wishes(uuid, integer, text, uuid, text)
from public;

revoke all
on function
  public.admin_adjust_player_card(uuid, text, integer, text, uuid, text)
from public;

revoke all
on function
  public.admin_set_player_ban(uuid, boolean, text, uuid, text)
from public;

grant execute
on function
  public.admin_search_player_accounts(text, integer)
to service_role;

grant execute
on function
  public.admin_get_player_account(uuid)
to service_role;

grant execute
on function
  public.admin_get_player_inventory(uuid)
to service_role;

grant execute
on function
  public.admin_adjust_player_wishes(uuid, integer, text, uuid, text)
to service_role;

grant execute
on function
  public.admin_adjust_player_card(uuid, text, integer, text, uuid, text)
to service_role;

grant execute
on function
  public.admin_set_player_ban(uuid, boolean, text, uuid, text)
to service_role;

notify pgrst, 'reload schema';
