-- Unknown Pulls persistent test pull verification
-- Run after 20260804_unknown_pulls_persistent_test_pulls.sql

select jsonb_build_object(
  'wish_function',
    to_regprocedure(
      'public.make_player_wish()'
    ) is not null,

  'test_history_column',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'player_wishes'
        and column_name = 'is_test'
    ),

  'authenticated_can_execute',
    has_function_privilege(
      'authenticated',
      'public.make_player_wish()',
      'EXECUTE'
    )
)
  as persistent_test_pull_health;

-- Expected positions:
-- physical_inventory_update_position = 0
-- wallet_update_position > 0
-- collection_update_position > 0
-- history_insert_position > 0
-- test_history_marker_position > 0
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
    'update public.player_inventory'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as collection_update_position,

  position(
    'insert into public.player_wishes'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as history_insert_position,

  position(
    'is_test'
    in lower(
      pg_get_functiondef(
        'public.make_player_wish()'::regprocedure
      )
    )
  )
    as test_history_marker_position;

select
  count(*) filter (
    where is_test
  )
    as recorded_test_pulls,

  count(*) filter (
    where not is_test
  )
    as recorded_non_test_pulls

from public.player_wishes;

notify pgrst, 'reload schema';
