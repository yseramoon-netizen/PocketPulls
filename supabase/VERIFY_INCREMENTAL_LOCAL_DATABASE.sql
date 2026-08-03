-- PocketPulls incremental local database verification

select
  to_regclass('public.card_sync_files') as card_sync_files,
  to_regclass('public.card_sync_settings') as card_sync_settings,
  to_regclass('public.card_sync_runs') as card_sync_runs;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pokemon_cards'
  and column_name in (
    'source_record_hash',
    'source_file_path',
    'source_commit_sha',
    'price_checked_at',
    'price_status',
    'price_error',
    'price_retry_after'
  )
order by column_name;

select
  p.oid::regprocedure::text as function_signature
from pg_proc as p
join pg_namespace as n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'merge_local_pokemon_card_batch',
    'get_due_price_card_ids',
    'get_card_database_tracker_stats'
  )
order by p.proname;

select *
from public.get_card_database_tracker_stats();

notify pgrst, 'reload schema';
