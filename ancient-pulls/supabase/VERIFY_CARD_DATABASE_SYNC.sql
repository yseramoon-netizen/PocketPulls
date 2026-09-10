-- PocketPulls card database sync verification

select
  to_regclass('public.card_sync_settings')
    as card_sync_settings,
  to_regclass('public.card_sync_runs')
    as card_sync_runs;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pokemon_cards'
  and column_name in (
    'api_id',
    'market_value',
    'market_value_normal_gbp',
    'market_value_holo_gbp',
    'market_value_reverse_holo_gbp',
    'price_source',
    'price_updated_at',
    'database_synced_at'
  )
order by column_name;

select
  p.oid::regprocedure::text as function_signature
from pg_proc as p
join pg_namespace as n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'merge_pokemon_card_sync_batch',
    'get_card_database_sync_stats'
  )
order by p.proname;

select *
from public.get_card_database_sync_stats();

notify pgrst, 'reload schema';
