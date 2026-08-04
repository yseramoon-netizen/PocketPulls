-- Unknown Pulls friend search diagnostic
-- Run after the V4 migration.

select jsonb_build_object(
  'auth_users',
    (
      select count(*)
      from auth.users
    ),

  'player_profiles',
    (
      select count(*)
      from public.player_profiles
    ),

  'missing_profiles',
    (
      select count(*)

      from auth.users
        as account

      left join public.player_profiles
        as profile

        on profile.user_id =
          account.id

      where profile.user_id
        is null
    ),

  'blank_usernames',
    (
      select count(*)

      from public.player_profiles

      where username is null

        or btrim(username) = ''
    ),

  'missing_search_email',
    (
      select count(*)

      from public.player_profiles

      where search_email is null

        or btrim(search_email) = ''
    ),

  'friend_search_function',
    to_regprocedure(
      'public.search_player_friends(text,integer)'
    ) is not null,

  'authenticated_execute',
    has_function_privilege(
      'authenticated',
      'public.search_player_friends(text,integer)',
      'EXECUTE'
    )
)
  as friend_search_health;

select
  user_id,
  username,
  display_name,
  search_email,
  is_banned,
  created_at

from public.player_profiles

order by created_at desc

limit 50;

notify pgrst, 'reload schema';
