-- Unknown Pulls player testing and admin verification
-- Run after:
-- 20260804_unknown_pulls_player_testing_admin.sql

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

  'player_wallets',
    (
      select count(*)
      from public.player_wallets
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

  'missing_wallets',
    (
      select count(*)

      from auth.users
        as account

      left join public.player_wallets
        as wallet

        on wallet.user_id =
          account.id

      where wallet.user_id
        is null
    ),

  'friend_search_function',
    to_regprocedure(
      'public.search_player_friends(text,integer)'
    ) is not null,

  'test_pull_function',
    to_regprocedure(
      'public.make_player_wish()'
    ) is not null,

  'admin_player_search',
    to_regprocedure(
      'public.admin_search_player_accounts(text,integer)'
    ) is not null,

  'admin_wish_adjustment',
    to_regprocedure(
      'public.admin_adjust_player_wishes(uuid,integer,text,uuid,text)'
    ) is not null,

  'admin_card_adjustment',
    to_regprocedure(
      'public.admin_adjust_player_card(uuid,text,integer,text,uuid,text)'
    ) is not null,

  'admin_ban',
    to_regprocedure(
      'public.admin_set_player_ban(uuid,boolean,text,uuid,text)'
    ) is not null
)
  as player_testing_admin_health;

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

-- Must return zero.
select count(*)
  as auth_accounts_missing_wallets

from auth.users
  as account

left join public.player_wallets
  as wallet

  on wallet.user_id =
    account.id

where wallet.user_id
  is null;

-- Confirms the function source contains no data-changing statement.
select
  position(
    'update public.inventory'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as physical_inventory_update_position,

  position(
    'update public.player_wallets'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as wallet_update_position,

  position(
    'insert into public.player_inventory'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as collection_insert_position,

  position(
    'insert into public.player_wishes'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as wish_history_insert_position;

notify pgrst, 'reload schema';
