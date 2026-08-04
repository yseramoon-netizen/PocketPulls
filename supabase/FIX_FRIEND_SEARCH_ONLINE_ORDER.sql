-- Unknown Pulls friend search ORDER BY repair
-- Fixes: ERROR 42703 column "online" does not exist
--
-- Safe to run after a failed attempt at the main repair migration.

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
