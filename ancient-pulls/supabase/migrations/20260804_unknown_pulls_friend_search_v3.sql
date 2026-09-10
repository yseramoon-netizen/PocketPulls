-- Unknown Pulls friend search repair V3
-- Generated 2026-08-04
--
-- This version avoids joining auth.users during every player search.
-- It stores a searchable email prefix on player_profiles and searches only
-- the public player table at runtime.
--
-- Safe to run after the previous friend-search migrations.

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
      'public.player_friendships is missing.';
  end if;
end;
$preflight$;

alter table
  public.player_profiles

add column if not exists
  search_email text,

add column if not exists
  last_seen_at timestamptz,

add column if not exists
  is_banned boolean
    not null
    default false;

-- Create missing profiles for every Auth account.
insert into
  public.player_profiles (
    user_id,
    username,
    display_name,
    avatar_url,
    search_email,
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

  lower(
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
    )
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

-- Repair old profiles and populate search_email.
update public.player_profiles
  as profile

set
  username =
    case
      when profile.username
        is null

        or

        btrim(
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

  search_email =
    lower(
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
      )
    ),

  updated_at =
    now()

from auth.users
  as account

where account.id =
  profile.user_id;

create index if not exists
  player_profiles_username_lower_idx

on public.player_profiles(
  lower(username)
);

create index if not exists
  player_profiles_display_name_lower_idx

on public.player_profiles(
  lower(display_name)
);

create index if not exists
  player_profiles_search_email_lower_idx

on public.player_profiles(
  lower(search_email)
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

    -- A trainer cannot add their own account.
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
        coalesce(
          profile.search_email,
          ''
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

      when cleaned.query <> ''

        and lower(
          coalesce(
            profile.display_name,
            ''
          )
        )
          like
            cleaned.query ||
            '%'
      then 2

      else 3
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
