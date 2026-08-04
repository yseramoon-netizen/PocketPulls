-- Unknown Pulls friends and trading verification
-- Run after:
-- 20260804_unknown_pulls_friends_trading.sql

select jsonb_build_object(
  'friendships_table',
    to_regclass(
      'public.player_friendships'
    ) is not null,

  'trades_table',
    to_regclass(
      'public.player_trades'
    ) is not null,

  'trade_items_table',
    to_regclass(
      'public.player_trade_items'
    ) is not null,

  'presence_column',
    exists (
      select 1

      from information_schema.columns

      where table_schema =
          'public'

        and table_name =
          'player_profiles'

        and column_name =
          'last_seen_at'
    ),

  'friend_dashboard',
    to_regprocedure(
      'public.get_player_friend_dashboard()'
    ) is not null,

  'friend_search',
    to_regprocedure(
      'public.search_player_friends(text,integer)'
    ) is not null,

  'create_trade',
    to_regprocedure(
      'public.create_player_trade(uuid)'
    ) is not null,

  'trade_summary',
    to_regprocedure(
      'public.get_player_trade_summary(uuid)'
    ) is not null,

  'trade_complete',
    to_regprocedure(
      'public.set_player_trade_ready(uuid)'
    ) is not null
)
  as unknown_pulls_social_health;

select
  routine_name,
  routine_type

from information_schema.routines

where routine_schema =
    'public'

  and routine_name in (
    'touch_player_presence',
    'search_player_friends',
    'get_player_friend_dashboard',
    'send_friend_request',
    'respond_friend_request',
    'cancel_friend_request',
    'remove_friend',
    'block_player',
    'unblock_player',
    'create_player_trade',
    'get_player_trade_inbox',
    'get_player_trade_summary',
    'get_player_trade_items',
    'get_player_trade_inventory',
    'add_player_trade_card',
    'remove_player_trade_card',
    'set_player_trade_locked',
    'set_player_trade_ready',
    'cancel_player_trade'
  )

order by
  routine_name;

notify pgrst, 'reload schema';
