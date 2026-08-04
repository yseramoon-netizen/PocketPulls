-- Unknown Pulls speed, auth callback and friend search verification

select jsonb_build_object(
  'auth_accounts',
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
  as unknown_pulls_repair_health;

-- Must return zero.
select count(*)
  as auth_accounts_missing_profiles

from auth.users
  as account

left join public.player_profiles
  as profile

  on profile.user_id =
    account.id

where profile.user_id
  is null;

notify pgrst, 'reload schema';
