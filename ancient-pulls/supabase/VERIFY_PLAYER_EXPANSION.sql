-- PocketPulls Player Expansion Pack verification

select
  to_regclass('public.player_profile_details')
    as player_profile_details,
  to_regclass('public.player_daily_rewards')
    as player_daily_rewards,
  to_regclass('public.player_achievements')
    as player_achievements,
  to_regclass('public.player_shipping_addresses_v2')
    as shipping_addresses,
  to_regclass('public.player_shipping_shipments')
    as shipping_shipments;

select
  p.oid::regprocedure::text as function_signature
from pg_proc as p
join pg_namespace as n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_player_collection_overview',
    'get_player_collection',
    'set_player_signature_card',
    'get_player_wish_history',
    'get_player_leaderboard',
    'get_player_profile_dashboard',
    'update_player_profile',
    'get_daily_reward_status',
    'claim_daily_reward',
    'sync_player_achievements',
    'get_player_achievements',
    'get_player_shipping_eligibility',
    'save_player_shipping_address',
    'delete_player_shipping_address',
    'request_player_shipment',
    'cancel_player_shipment'
  )
order by p.proname;

notify pgrst, 'reload schema';
