-- Unknown Pulls friend search and player performance repair
-- Generated 2026-08-04
--
-- Run after the existing player and friends/trading migrations.

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass(
    'public.player_profiles'
  ) is null then
    raise exception
      'public.player_profiles is missing.';
  end if;

  if to_regclass(
    'public.player_friendships'
  ) is null then
    raise exception
      'public.player_friendships is missing. Run the friends migration first.';
  end if;
end;
$preflight$;

alter table
  public.player_profiles

add column if not exists
  last_seen_at timestamptz,

add column if not exists
  is_banned boolean
    not null
    default false;

-- Backfill accounts that exist in Supabase Auth but have no player profile.
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
  ),

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
  ),

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
  ),

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

-- Repair empty names on older accounts.
update public.player_profiles
  as profile

set
  username =
    case
      when profile.username
        is null
        or btrim(
          profile.username
        ) = ''
      then
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
        )
      else profile.username
    end,

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
  profile.user_id;

create index if not exists
  player_profiles_username_search_idx

on public.player_profiles(
  lower(username)
);

create index if not exists
  player_profiles_display_name_search_idx

on public.player_profiles(
  lower(display_name)
);

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
    end,

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
    end,

    friendship.id,

    coalesce(
      profile.last_seen_at >
        now() -
        interval '5 minutes',
      false
    ),

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

    and (
      cleaned.query = ''

      or lower(
        coalesce(
          profile.username,
          ''
        )
      )
        like
          '%' ||
          cleaned.query ||
          '%'

      or lower(
        coalesce(
          profile.display_name,
          ''
        )
      )
        like
          '%' ||
          cleaned.query ||
          '%'

      or lower(
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
    case
      when cleaned.query <> ''
        and lower(
          coalesce(
            profile.username,
            ''
          )
        ) = cleaned.query
      then 0
      when cleaned.query <> ''
        and lower(
          coalesce(
            profile.username,
            ''
          )
        )
          like
            cleaned.query ||
            '%'
      then 1
      else 2
    end,

    coalesce(
      profile.last_seen_at >
        now() -
        interval '5 minutes',
      false
    ) desc,

    profile.created_at desc,
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

revoke all
on function
  public.search_player_friends(text, integer)
from public;

grant execute
on function
  public.search_player_friends(text, integer)
to authenticated;

notify pgrst, 'reload schema';
