-- Unknown Pulls friends and protected card trading
-- Generated 2026-08-04
--
-- Features:
-- - Player search, friend requests, accept, decline, cancel and remove
-- - Block and unblock
-- - Five-minute online presence
-- - Protected friend-only card trades
-- - Inventory reservations while cards are offered
-- - Two-sided offer locking
-- - Three-second safety countdown
-- - Both players must press Trade
-- - Atomic collection transfer
--
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass(
    'public.player_profiles'
  ) is null then
    raise exception
      'public.player_profiles is missing. Run the player system migration first.';
  end if;

  if to_regclass(
    'public.player_inventory'
  ) is null then
    raise exception
      'public.player_inventory is missing. Run the player system migration first.';
  end if;

  if to_regclass(
    'public.pokemon_cards'
  ) is null then
    raise exception
      'public.pokemon_cards is missing. Run the card database migration first.';
  end if;
end;
$preflight$;

alter table
  public.player_profiles

add column if not exists
  last_seen_at timestamptz;

create index if not exists
  player_profiles_last_seen_idx

on public.player_profiles(
  last_seen_at desc
);

-- ---------------------------------------------------------------------------
-- FRIENDSHIPS
-- ---------------------------------------------------------------------------

create table if not exists
public.player_friendships (
  id uuid
    primary key
    default gen_random_uuid(),

  requester_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  addressee_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  status text
    not null
    default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'blocked'
      )
    ),

  blocked_by uuid
    references auth.users(id)
    on delete cascade,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  accepted_at timestamptz,

  constraint
    player_friendships_not_self
  check (
    requester_id <>
    addressee_id
  )
);

create unique index if not exists
  player_friendships_pair_unique

on public.player_friendships (
  least(
    requester_id,
    addressee_id
  ),

  greatest(
    requester_id,
    addressee_id
  )
);

create index if not exists
  player_friendships_requester_idx

on public.player_friendships(
  requester_id,
  status,
  updated_at desc
);

create index if not exists
  player_friendships_addressee_idx

on public.player_friendships(
  addressee_id,
  status,
  updated_at desc
);

alter table
  public.player_friendships
enable row level security;

drop policy if exists
  "Players can read their friendships"
on public.player_friendships;

create policy
  "Players can read their friendships"

on public.player_friendships
for select
to authenticated

using (
  auth.uid() =
    requester_id

  or

  auth.uid() =
    addressee_id
);

revoke insert, update, delete
on public.player_friendships
from anon, authenticated;

grant select
on public.player_friendships
to authenticated;

-- ---------------------------------------------------------------------------
-- TRADES
-- ---------------------------------------------------------------------------

create table if not exists
public.player_trades (
  id uuid
    primary key
    default gen_random_uuid(),

  initiator_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  recipient_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  status text
    not null
    default 'open'
    check (
      status in (
        'open',
        'countdown',
        'completed',
        'cancelled'
      )
    ),

  initiator_locked boolean
    not null
    default false,

  recipient_locked boolean
    not null
    default false,

  initiator_ready boolean
    not null
    default false,

  recipient_ready boolean
    not null
    default false,

  countdown_started_at
    timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  completed_at timestamptz,

  cancelled_at timestamptz,

  last_action_by uuid
    references auth.users(id)
    on delete set null,

  revision integer
    not null
    default 0,

  constraint
    player_trades_not_self
  check (
    initiator_id <>
    recipient_id
  )
);

create unique index if not exists
  player_trades_active_pair_unique

on public.player_trades (
  least(
    initiator_id,
    recipient_id
  ),

  greatest(
    initiator_id,
    recipient_id
  )
)

where status in (
  'open',
  'countdown'
);

create index if not exists
  player_trades_initiator_idx

on public.player_trades(
  initiator_id,
  status,
  updated_at desc
);

create index if not exists
  player_trades_recipient_idx

on public.player_trades(
  recipient_id,
  status,
  updated_at desc
);

create table if not exists
public.player_trade_items (
  id uuid
    primary key
    default gen_random_uuid(),

  trade_id uuid
    not null
    references public.player_trades(id)
    on delete cascade,

  owner_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  card_id text
    not null,

  quantity integer
    not null
    default 1
    check (
      quantity > 0
    ),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    trade_id,
    owner_id,
    card_id
  )
);

create index if not exists
  player_trade_items_trade_idx

on public.player_trade_items(
  trade_id,
  owner_id
);

alter table
  public.player_trades
enable row level security;

alter table
  public.player_trade_items
enable row level security;

drop policy if exists
  "Players can read their trades"
on public.player_trades;

create policy
  "Players can read their trades"

on public.player_trades
for select
to authenticated

using (
  auth.uid() =
    initiator_id

  or

  auth.uid() =
    recipient_id
);

drop policy if exists
  "Players can read their trade items"
on public.player_trade_items;

create policy
  "Players can read their trade items"

on public.player_trade_items
for select
to authenticated

using (
  exists (
    select 1

    from public.player_trades
      as trade

    where trade.id =
        player_trade_items.trade_id

      and (
        trade.initiator_id =
          auth.uid()

        or

        trade.recipient_id =
          auth.uid()
      )
  )
);

revoke insert, update, delete
on public.player_trades
from anon, authenticated;

revoke insert, update, delete
on public.player_trade_items
from anon, authenticated;

grant select
on public.player_trades
to authenticated;

grant select
on public.player_trade_items
to authenticated;

-- ---------------------------------------------------------------------------
-- PRESENCE
-- ---------------------------------------------------------------------------

create or replace function
public.touch_player_presence()
returns timestamptz
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_now timestamptz :=
    now();
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  update public.player_profiles
  set last_seen_at =
    v_now
  where user_id =
    v_user_id;

  return v_now;
end;
$function$;

-- ---------------------------------------------------------------------------
-- FRIEND SEARCH AND DASHBOARD
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
  pg_temp
as $function$
  select
    profile.user_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,

    case
      when friendship.id is null
        then 'none'
      else friendship.status
    end
      as relationship_status,

    case
      when friendship.id is null
        then 'none'

      when friendship.status =
          'accepted'
        then 'accepted'

      when friendship.status =
          'blocked'
        and friendship.blocked_by =
          auth.uid()
        then 'blocked'

      when friendship.status =
          'blocked'
        then 'blocked_by_other'

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

    and (
      coalesce(
        btrim(p_query),
        ''
      ) = ''

      or

      profile.username
        ilike
          '%' ||
          btrim(p_query) ||
          '%'

      or

      coalesce(
        profile.display_name,
        ''
      )
        ilike
          '%' ||
          btrim(p_query) ||
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

-- ---------------------------------------------------------------------------
-- FRIEND ACTIONS
-- ---------------------------------------------------------------------------

create or replace function
public.send_friend_request(
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_existing
    public.player_friendships%rowtype;

  v_id uuid;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  if p_target_user_id is null
    or p_target_user_id =
      v_user_id then
    raise exception
      'Choose another trainer.';
  end if;

  if not exists (
    select 1

    from public.player_profiles
      as profile

    where profile.user_id =
      p_target_user_id
  ) then
    raise exception
      'That trainer does not exist.';
  end if;

  select
    friendship.*

  into v_existing

  from public.player_friendships
    as friendship

  where least(
    friendship.requester_id,
    friendship.addressee_id
  ) =
    least(
      v_user_id,
      p_target_user_id
    )

    and greatest(
      friendship.requester_id,
      friendship.addressee_id
    ) =
      greatest(
        v_user_id,
        p_target_user_id
      )

  for update;

  if found then
    if v_existing.status =
        'blocked' then
      raise exception
        'A block must be removed before sending a friend request.';
    end if;

    if v_existing.status =
        'accepted' then
      return v_existing.id;
    end if;

    if v_existing.requester_id =
        p_target_user_id

      and v_existing.addressee_id =
        v_user_id then

      update public.player_friendships
      set
        status =
          'accepted',

        accepted_at =
          now(),

        updated_at =
          now()

      where id =
        v_existing.id;

      return v_existing.id;
    end if;

    return v_existing.id;
  end if;

  insert into
    public.player_friendships (
      requester_id,
      addressee_id,
      status,
      created_at,
      updated_at
    )

  values (
    v_user_id,
    p_target_user_id,
    'pending',
    now(),
    now()
  )

  returning id
  into v_id;

  return v_id;
end;
$function$;

create or replace function
public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_friendship
    public.player_friendships%rowtype;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  select
    friendship.*

  into v_friendship

  from public.player_friendships
    as friendship

  where friendship.id =
      p_friendship_id

  for update;

  if not found
    or v_friendship.status <>
      'pending'

    or v_friendship.addressee_id <>
      v_user_id then

    raise exception
      'That incoming friend request is no longer available.';
  end if;

  if coalesce(
    p_accept,
    false
  ) then
    update public.player_friendships
    set
      status =
        'accepted',

      accepted_at =
        now(),

      updated_at =
        now()

    where id =
      p_friendship_id;
  else
    delete from
      public.player_friendships

    where id =
      p_friendship_id;
  end if;

  return true;
end;
$function$;

create or replace function
public.cancel_friend_request(
  p_friendship_id uuid
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
begin
  delete from
    public.player_friendships

  where id =
      p_friendship_id

    and status =
      'pending'

    and requester_id =
      auth.uid();

  if not found then
    raise exception
      'That sent friend request is no longer available.';
  end if;

  return true;
end;
$function$;

create or replace function
public.remove_friend(
  p_friendship_id uuid
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
begin
  delete from
    public.player_friendships

  where id =
      p_friendship_id

    and status =
      'accepted'

    and (
      requester_id =
        auth.uid()

      or

      addressee_id =
        auth.uid()
    );

  if not found then
    raise exception
      'That friendship is no longer available.';
  end if;

  return true;
end;
$function$;

create or replace function
public.block_player(
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_friendship_id uuid;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  if p_target_user_id is null
    or p_target_user_id =
      v_user_id then
    raise exception
      'Choose another trainer.';
  end if;

  select
    friendship.id

  into v_friendship_id

  from public.player_friendships
    as friendship

  where least(
    friendship.requester_id,
    friendship.addressee_id
  ) =
    least(
      v_user_id,
      p_target_user_id
    )

    and greatest(
      friendship.requester_id,
      friendship.addressee_id
    ) =
      greatest(
        v_user_id,
        p_target_user_id
      )

  for update;

  if found then
    update public.player_friendships
    set
      status =
        'blocked',

      blocked_by =
        v_user_id,

      accepted_at =
        null,

      updated_at =
        now()

    where id =
      v_friendship_id;
  else
    insert into
      public.player_friendships (
        requester_id,
        addressee_id,
        status,
        blocked_by,
        created_at,
        updated_at
      )

    values (
      v_user_id,
      p_target_user_id,
      'blocked',
      v_user_id,
      now(),
      now()
    )

    returning id
    into v_friendship_id;
  end if;

  return v_friendship_id;
end;
$function$;

create or replace function
public.unblock_player(
  p_target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
begin
  delete from
    public.player_friendships

  where status =
      'blocked'

    and blocked_by =
      auth.uid()

    and least(
      requester_id,
      addressee_id
    ) =
      least(
        auth.uid(),
        p_target_user_id
      )

    and greatest(
      requester_id,
      addressee_id
    ) =
      greatest(
        auth.uid(),
        p_target_user_id
      );

  if not found then
    raise exception
      'That block is no longer available.';
  end if;

  return true;
end;
$function$;

-- ---------------------------------------------------------------------------
-- INTERNAL TRADE HELPERS
-- ---------------------------------------------------------------------------

create or replace function
public.unknown_pulls_release_trade_reservations(
  p_trade_id uuid
)
returns void
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
begin
  update public.player_inventory
    as inventory

  set reserved_quantity =
    greatest(
      0,
      coalesce(
        inventory.reserved_quantity,
        0
      ) -
      item.quantity
    )

  from public.player_trade_items
    as item

  where item.trade_id =
      p_trade_id

    and inventory.user_id =
      item.owner_id

    and inventory.card_id::text =
      item.card_id;
end;
$function$;

revoke all
on function
  public.unknown_pulls_release_trade_reservations(uuid)
from public;

-- ---------------------------------------------------------------------------
-- TRADE CREATION AND READ MODELS
-- ---------------------------------------------------------------------------

create or replace function
public.create_player_trade(
  p_friend_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade_id uuid;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  if p_friend_user_id is null
    or p_friend_user_id =
      v_user_id then
    raise exception
      'Choose an accepted friend.';
  end if;

  if not exists (
    select 1

    from public.player_friendships
      as friendship

    where friendship.status =
        'accepted'

      and least(
        friendship.requester_id,
        friendship.addressee_id
      ) =
        least(
          v_user_id,
          p_friend_user_id
        )

      and greatest(
        friendship.requester_id,
        friendship.addressee_id
      ) =
        greatest(
          v_user_id,
          p_friend_user_id
        )
  ) then
    raise exception
      'You can only trade with an accepted friend.';
  end if;

  select
    trade.id

  into v_trade_id

  from public.player_trades
    as trade

  where trade.status in (
      'open',
      'countdown'
    )

    and least(
      trade.initiator_id,
      trade.recipient_id
    ) =
      least(
        v_user_id,
        p_friend_user_id
      )

    and greatest(
      trade.initiator_id,
      trade.recipient_id
    ) =
      greatest(
        v_user_id,
        p_friend_user_id
      )

  order by
    trade.created_at desc

  limit 1;

  if v_trade_id
    is not null then
    return v_trade_id;
  end if;

  begin
    insert into
      public.player_trades (
        initiator_id,
        recipient_id,
        status,
        last_action_by,
        created_at,
        updated_at
      )

    values (
      v_user_id,
      p_friend_user_id,
      'open',
      v_user_id,
      now(),
      now()
    )

    returning id
    into v_trade_id;

  exception
    when unique_violation then
      select
        trade.id

      into v_trade_id

      from public.player_trades
        as trade

      where trade.status in (
          'open',
          'countdown'
        )

        and least(
          trade.initiator_id,
          trade.recipient_id
        ) =
          least(
            v_user_id,
            p_friend_user_id
          )

        and greatest(
          trade.initiator_id,
          trade.recipient_id
        ) =
          greatest(
            v_user_id,
            p_friend_user_id
          )

      order by
        trade.created_at desc

      limit 1;
  end;

  return v_trade_id;
end;
$function$;

drop function if exists
public.get_player_trade_inbox();

create function
public.get_player_trade_inbox()
returns table (
  trade_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  status text,
  self_locked boolean,
  other_locked boolean,
  self_ready boolean,
  other_ready boolean,
  countdown_started_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $function$
  select
    trade.id
      as trade_id,

    profile.user_id
      as other_user_id,

    profile.username,
    profile.display_name,
    profile.avatar_url,
    trade.status,

    case
      when trade.initiator_id =
          auth.uid()
        then trade.initiator_locked
      else trade.recipient_locked
    end
      as self_locked,

    case
      when trade.initiator_id =
          auth.uid()
        then trade.recipient_locked
      else trade.initiator_locked
    end
      as other_locked,

    case
      when trade.initiator_id =
          auth.uid()
        then trade.initiator_ready
      else trade.recipient_ready
    end
      as self_ready,

    case
      when trade.initiator_id =
          auth.uid()
        then trade.recipient_ready
      else trade.initiator_ready
    end
      as other_ready,

    trade.countdown_started_at,
    trade.updated_at

  from public.player_trades
    as trade

  join public.player_profiles
    as profile

    on profile.user_id =
      case
        when trade.initiator_id =
            auth.uid()
          then trade.recipient_id
        else trade.initiator_id
      end

  where auth.uid()
    is not null

    and (
      trade.initiator_id =
        auth.uid()

      or

      trade.recipient_id =
        auth.uid()
    )

    and trade.status in (
      'open',
      'countdown'
    )

  order by
    trade.updated_at desc;
$function$;

drop function if exists
public.get_player_trade_summary(uuid);

create function
public.get_player_trade_summary(
  p_trade_id uuid
)
returns table (
  trade_id uuid,
  status text,
  initiator_id uuid,
  recipient_id uuid,
  current_user_id uuid,
  initiator_username text,
  initiator_display_name text,
  initiator_avatar_url text,
  recipient_username text,
  recipient_display_name text,
  recipient_avatar_url text,
  initiator_locked boolean,
  recipient_locked boolean,
  initiator_ready boolean,
  recipient_ready boolean,
  countdown_started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $function$
  select
    trade.id
      as trade_id,

    trade.status,
    trade.initiator_id,
    trade.recipient_id,
    auth.uid()
      as current_user_id,

    initiator.username
      as initiator_username,

    initiator.display_name
      as initiator_display_name,

    initiator.avatar_url
      as initiator_avatar_url,

    recipient.username
      as recipient_username,

    recipient.display_name
      as recipient_display_name,

    recipient.avatar_url
      as recipient_avatar_url,

    trade.initiator_locked,
    trade.recipient_locked,
    trade.initiator_ready,
    trade.recipient_ready,
    trade.countdown_started_at,
    trade.completed_at,
    trade.updated_at

  from public.player_trades
    as trade

  join public.player_profiles
    as initiator

    on initiator.user_id =
      trade.initiator_id

  join public.player_profiles
    as recipient

    on recipient.user_id =
      trade.recipient_id

  where trade.id =
      p_trade_id

    and (
      trade.initiator_id =
        auth.uid()

      or

      trade.recipient_id =
        auth.uid()
    )

  limit 1;
$function$;

drop function if exists
public.get_player_trade_items(uuid);

create function
public.get_player_trade_items(
  p_trade_id uuid
)
returns table (
  owner_id uuid,
  card_id text,
  quantity integer,
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
    item.owner_id,
    item.card_id,
    item.quantity,

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
      as image_url

  from public.player_trade_items
    as item

  join public.player_trades
    as trade

    on trade.id =
      item.trade_id

  left join public.pokemon_cards
    as card

    on card.id::text =
      item.card_id

  where item.trade_id =
      p_trade_id

    and (
      trade.initiator_id =
        auth.uid()

      or

      trade.recipient_id =
        auth.uid()
    )

  order by
    item.created_at,
    item.id;
$function$;

drop function if exists
public.get_player_trade_inventory(uuid);

create function
public.get_player_trade_inventory(
  p_trade_id uuid
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
language plpgsql
stable
security definer
set search_path =
  public,
  pg_temp
as $function$
begin
  if not exists (
    select 1

    from public.player_trades
      as trade

    where trade.id =
        p_trade_id

      and (
        trade.initiator_id =
          auth.uid()

        or

        trade.recipient_id =
          auth.uid()
      )
  ) then
    raise exception
      'That trade is not available.';
  end if;

  return query

  select
    inventory.card_id::text
      as card_id,

    greatest(
      0,
      coalesce(
        inventory.quantity,
        0
      )
    )::integer
      as quantity,

    greatest(
      0,
      coalesce(
        inventory.reserved_quantity,
        0
      )
    )::integer
      as reserved_quantity,

    greatest(
      0,
      coalesce(
        inventory.quantity,
        0
      ) -
      coalesce(
        inventory.reserved_quantity,
        0
      )
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
      as image_url

  from public.player_inventory
    as inventory

  left join public.pokemon_cards
    as card

    on card.id::text =
      inventory.card_id::text

  where inventory.user_id =
      auth.uid()

    and (
      coalesce(
        inventory.quantity,
        0
      ) -
      coalesce(
        inventory.reserved_quantity,
        0
      )
    ) > 0

  order by
    coalesce(
      card.market_value,
      0
    ) desc,

    card.name

  limit 500;
end;
$function$;

-- ---------------------------------------------------------------------------
-- TRADE ITEM ACTIONS
-- ---------------------------------------------------------------------------

create or replace function
public.add_player_trade_card(
  p_trade_id uuid,
  p_card_id text
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade
    public.player_trades%rowtype;

  v_available integer;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  if coalesce(
    btrim(p_card_id),
    ''
  ) = '' then
    raise exception
      'Choose a card.';
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not found
    or v_trade.status not in (
      'open',
      'countdown'
    )

    or (
      v_trade.initiator_id <>
        v_user_id

      and

      v_trade.recipient_id <>
        v_user_id
    ) then

    raise exception
      'That trade is not available.';
  end if;

  if (
    v_trade.initiator_id =
      v_user_id

    and

    v_trade.initiator_locked
  )
  or
  (
    v_trade.recipient_id =
      v_user_id

    and

    v_trade.recipient_locked
  ) then
    raise exception
      'Unlock your offer before adding cards.';
  end if;

  select
    greatest(
      0,
      coalesce(
        inventory.quantity,
        0
      ) -
      coalesce(
        inventory.reserved_quantity,
        0
      )
    )::integer

  into v_available

  from public.player_inventory
    as inventory

  where inventory.user_id =
      v_user_id

    and inventory.card_id::text =
      btrim(p_card_id)

  for update;

  if coalesce(
    v_available,
    0
  ) <= 0 then
    raise exception
      'That card is no longer available.';
  end if;

  update public.player_inventory
  set reserved_quantity =
    coalesce(
      reserved_quantity,
      0
    ) + 1

  where user_id =
      v_user_id

    and card_id::text =
      btrim(p_card_id);

  insert into
    public.player_trade_items (
      trade_id,
      owner_id,
      card_id,
      quantity,
      created_at,
      updated_at
    )

  values (
    p_trade_id,
    v_user_id,
    btrim(p_card_id),
    1,
    now(),
    now()
  )

  on conflict (
    trade_id,
    owner_id,
    card_id
  )

  do update set
    quantity =
      public.player_trade_items.quantity +
      1,

    updated_at =
      now();

  update public.player_trades
  set
    status =
      'open',

    initiator_locked =
      false,

    recipient_locked =
      false,

    initiator_ready =
      false,

    recipient_ready =
      false,

    countdown_started_at =
      null,

    updated_at =
      now(),

    last_action_by =
      v_user_id,

    revision =
      revision + 1

  where id =
    p_trade_id;

  return true;
end;
$function$;

create or replace function
public.remove_player_trade_card(
  p_trade_id uuid,
  p_card_id text
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade
    public.player_trades%rowtype;

  v_quantity integer;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not found
    or v_trade.status not in (
      'open',
      'countdown'
    )

    or (
      v_trade.initiator_id <>
        v_user_id

      and

      v_trade.recipient_id <>
        v_user_id
    ) then

    raise exception
      'That trade is not available.';
  end if;

  if (
    v_trade.initiator_id =
      v_user_id

    and

    v_trade.initiator_locked
  )
  or
  (
    v_trade.recipient_id =
      v_user_id

    and

    v_trade.recipient_locked
  ) then
    raise exception
      'Unlock your offer before removing cards.';
  end if;

  select
    item.quantity

  into v_quantity

  from public.player_trade_items
    as item

  where item.trade_id =
      p_trade_id

    and item.owner_id =
      v_user_id

    and item.card_id =
      btrim(p_card_id)

  for update;

  if not found then
    raise exception
      'That card is not in your offer.';
  end if;

  update public.player_inventory
  set reserved_quantity =
    greatest(
      0,
      coalesce(
        reserved_quantity,
        0
      ) - 1
    )

  where user_id =
      v_user_id

    and card_id::text =
      btrim(p_card_id);

  if v_quantity <= 1 then
    delete from
      public.player_trade_items

    where trade_id =
        p_trade_id

      and owner_id =
        v_user_id

      and card_id =
        btrim(p_card_id);
  else
    update public.player_trade_items
    set
      quantity =
        quantity - 1,

      updated_at =
        now()

    where trade_id =
        p_trade_id

      and owner_id =
        v_user_id

      and card_id =
        btrim(p_card_id);
  end if;

  update public.player_trades
  set
    status =
      'open',

    initiator_locked =
      false,

    recipient_locked =
      false,

    initiator_ready =
      false,

    recipient_ready =
      false,

    countdown_started_at =
      null,

    updated_at =
      now(),

    last_action_by =
      v_user_id,

    revision =
      revision + 1

  where id =
    p_trade_id;

  return true;
end;
$function$;

-- ---------------------------------------------------------------------------
-- LOCKING, COUNTDOWN AND COMPLETION
-- ---------------------------------------------------------------------------

create or replace function
public.set_player_trade_locked(
  p_trade_id uuid,
  p_locked boolean
)
returns text
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade
    public.player_trades%rowtype;

  v_locked boolean :=
    coalesce(
      p_locked,
      false
    );
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not found
    or v_trade.status not in (
      'open',
      'countdown'
    )

    or (
      v_trade.initiator_id <>
        v_user_id

      and

      v_trade.recipient_id <>
        v_user_id
    ) then

    raise exception
      'That trade is not available.';
  end if;

  if not v_locked then
    update public.player_trades
    set
      status =
        'open',

      initiator_locked =
        false,

      recipient_locked =
        false,

      initiator_ready =
        false,

      recipient_ready =
        false,

      countdown_started_at =
        null,

      updated_at =
        now(),

      last_action_by =
        v_user_id,

      revision =
        revision + 1

    where id =
      p_trade_id;

    return 'open';
  end if;

  if v_trade.initiator_id =
      v_user_id then

    update public.player_trades
    set
      initiator_locked =
        true,

      initiator_ready =
        false,

      updated_at =
        now(),

      last_action_by =
        v_user_id

    where id =
      p_trade_id;
  else
    update public.player_trades
    set
      recipient_locked =
        true,

      recipient_ready =
        false,

      updated_at =
        now(),

      last_action_by =
        v_user_id

    where id =
      p_trade_id;
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if v_trade.initiator_locked
    and v_trade.recipient_locked then

    update public.player_trades
    set
      status =
        'countdown',

      countdown_started_at =
        now(),

      initiator_ready =
        false,

      recipient_ready =
        false,

      updated_at =
        now(),

      revision =
        revision + 1

    where id =
      p_trade_id;

    return 'countdown';
  end if;

  update public.player_trades
  set
    status =
      'open',

    countdown_started_at =
      null,

    revision =
      revision + 1

  where id =
    p_trade_id;

  return 'open';
end;
$function$;

create or replace function
public.set_player_trade_ready(
  p_trade_id uuid
)
returns text
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade
    public.player_trades%rowtype;

  v_item record;

  v_recipient_id uuid;

  v_updated integer;

  v_card_id_type text;

  v_sql text;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not found
    or v_trade.status <>
      'countdown'

    or (
      v_trade.initiator_id <>
        v_user_id

      and

      v_trade.recipient_id <>
        v_user_id
    ) then

    raise exception
      'That trade is not ready.';
  end if;

  if not (
    v_trade.initiator_locked

    and

    v_trade.recipient_locked
  ) then
    raise exception
      'Both offers must be locked.';
  end if;

  if v_trade.countdown_started_at
    is null

    or

    now() <
      v_trade.countdown_started_at +
      interval '3 seconds' then

    raise exception
      'The three-second safety countdown is still running.';
  end if;

  if v_trade.initiator_id =
      v_user_id then

    update public.player_trades
    set
      initiator_ready =
        true,

      updated_at =
        now(),

      last_action_by =
        v_user_id

    where id =
      p_trade_id;
  else
    update public.player_trades
    set
      recipient_ready =
        true,

      updated_at =
        now(),

      last_action_by =
        v_user_id

    where id =
      p_trade_id;
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not (
    v_trade.initiator_ready

    and

    v_trade.recipient_ready
  ) then
    return 'waiting';
  end if;

  select
    format_type(
      attribute.atttypid,
      attribute.atttypmod
    )

  into v_card_id_type

  from pg_attribute
    as attribute

  where attribute.attrelid =
      'public.player_inventory'::regclass

    and attribute.attname =
      'card_id'

    and not attribute.attisdropped;

  if v_card_id_type is null then
    raise exception
      'player_inventory.card_id is missing.';
  end if;

  for v_item in
    select
      item.owner_id,
      item.card_id,
      item.quantity

    from public.player_trade_items
      as item

    where item.trade_id =
      p_trade_id

    order by
      item.owner_id,
      item.card_id

  loop
    update public.player_inventory
    set
      quantity =
        coalesce(
          quantity,
          0
        ) -
        v_item.quantity,

      reserved_quantity =
        greatest(
          0,
          coalesce(
            reserved_quantity,
            0
          ) -
          v_item.quantity
        )

    where user_id =
        v_item.owner_id

      and card_id::text =
        v_item.card_id

      and coalesce(
        quantity,
        0
      ) >=
        v_item.quantity

      and coalesce(
        reserved_quantity,
        0
      ) >=
        v_item.quantity;

    get diagnostics
      v_updated =
        row_count;

    if v_updated <> 1 then
      raise exception
        'A reserved card is no longer available. The trade was not completed.';
    end if;

    v_recipient_id :=
      case
        when v_item.owner_id =
            v_trade.initiator_id
          then v_trade.recipient_id
        else v_trade.initiator_id
      end;

    update public.player_inventory
    set quantity =
      coalesce(
        quantity,
        0
      ) +
      v_item.quantity

    where user_id =
        v_recipient_id

      and card_id::text =
        v_item.card_id;

    get diagnostics
      v_updated =
        row_count;

    if v_updated = 0 then
      v_sql :=
        'insert into public.player_inventory ' ||
        '(user_id, card_id, quantity, reserved_quantity) ' ||
        'values ($1, ' ||
        quote_literal(
          v_item.card_id
        ) ||
        '::' ||
        v_card_id_type ||
        ', $2, 0)';

      execute v_sql
      using
        v_recipient_id,
        v_item.quantity;
    end if;
  end loop;

  update public.player_trades
  set
    status =
      'completed',

    completed_at =
      now(),

    updated_at =
      now(),

    last_action_by =
      v_user_id,

    revision =
      revision + 1

  where id =
    p_trade_id;

  return 'completed';
end;
$function$;

create or replace function
public.cancel_player_trade(
  p_trade_id uuid
)
returns boolean
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_trade
    public.player_trades%rowtype;
begin
  if v_user_id is null then
    raise exception
      'You must be signed in.';
  end if;

  select
    trade.*

  into v_trade

  from public.player_trades
    as trade

  where trade.id =
      p_trade_id

  for update;

  if not found
    or v_trade.status not in (
      'open',
      'countdown'
    )

    or (
      v_trade.initiator_id <>
        v_user_id

      and

      v_trade.recipient_id <>
        v_user_id
    ) then

    raise exception
      'That trade is not available.';
  end if;

  if (
    v_trade.initiator_id =
      v_user_id

    and

    v_trade.initiator_ready
  )
  or
  (
    v_trade.recipient_id =
      v_user_id

    and

    v_trade.recipient_ready
  ) then
    raise exception
      'You cannot cancel after pressing the final Trade button.';
  end if;

  perform
    public.unknown_pulls_release_trade_reservations(
      p_trade_id
    );

  update public.player_trades
  set
    status =
      'cancelled',

    cancelled_at =
      now(),

    updated_at =
      now(),

    last_action_by =
      v_user_id,

    revision =
      revision + 1

  where id =
    p_trade_id;

  return true;
end;
$function$;

-- ---------------------------------------------------------------------------
-- PERMISSIONS
-- ---------------------------------------------------------------------------

revoke all
on function
  public.touch_player_presence()
from public;

revoke all
on function
  public.search_player_friends(text, integer)
from public;

revoke all
on function
  public.get_player_friend_dashboard()
from public;

revoke all
on function
  public.send_friend_request(uuid)
from public;

revoke all
on function
  public.respond_friend_request(uuid, boolean)
from public;

revoke all
on function
  public.cancel_friend_request(uuid)
from public;

revoke all
on function
  public.remove_friend(uuid)
from public;

revoke all
on function
  public.block_player(uuid)
from public;

revoke all
on function
  public.unblock_player(uuid)
from public;

revoke all
on function
  public.create_player_trade(uuid)
from public;

revoke all
on function
  public.get_player_trade_inbox()
from public;

revoke all
on function
  public.get_player_trade_summary(uuid)
from public;

revoke all
on function
  public.get_player_trade_items(uuid)
from public;

revoke all
on function
  public.get_player_trade_inventory(uuid)
from public;

revoke all
on function
  public.add_player_trade_card(uuid, text)
from public;

revoke all
on function
  public.remove_player_trade_card(uuid, text)
from public;

revoke all
on function
  public.set_player_trade_locked(uuid, boolean)
from public;

revoke all
on function
  public.set_player_trade_ready(uuid)
from public;

revoke all
on function
  public.cancel_player_trade(uuid)
from public;

grant execute
on function
  public.touch_player_presence()
to authenticated;

grant execute
on function
  public.search_player_friends(text, integer)
to authenticated;

grant execute
on function
  public.get_player_friend_dashboard()
to authenticated;

grant execute
on function
  public.send_friend_request(uuid)
to authenticated;

grant execute
on function
  public.respond_friend_request(uuid, boolean)
to authenticated;

grant execute
on function
  public.cancel_friend_request(uuid)
to authenticated;

grant execute
on function
  public.remove_friend(uuid)
to authenticated;

grant execute
on function
  public.block_player(uuid)
to authenticated;

grant execute
on function
  public.unblock_player(uuid)
to authenticated;

grant execute
on function
  public.create_player_trade(uuid)
to authenticated;

grant execute
on function
  public.get_player_trade_inbox()
to authenticated;

grant execute
on function
  public.get_player_trade_summary(uuid)
to authenticated;

grant execute
on function
  public.get_player_trade_items(uuid)
to authenticated;

grant execute
on function
  public.get_player_trade_inventory(uuid)
to authenticated;

grant execute
on function
  public.add_player_trade_card(uuid, text)
to authenticated;

grant execute
on function
  public.remove_player_trade_card(uuid, text)
to authenticated;

grant execute
on function
  public.set_player_trade_locked(uuid, boolean)
to authenticated;

grant execute
on function
  public.set_player_trade_ready(uuid)
to authenticated;

grant execute
on function
  public.cancel_player_trade(uuid)
to authenticated;

notify pgrst, 'reload schema';
