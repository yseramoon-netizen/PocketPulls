-- Unknown Pulls fast price refresh verification

select
  settings.price_pass_status,
  settings.price_pass_started_at,
  settings.price_pass_updated_at,
  settings.price_pass_completed_at,
  settings.price_pass_total,
  settings.price_pass_processed,
  settings.price_pass_priced,
  settings.price_pass_unpriced,
  settings.price_pass_failed,
  settings.last_price_sync_at

from public.card_sync_settings
  as settings

where settings.id = 1;

select
  public.get_due_price_card_count()
    as distinct_prices_due;

select
  p.oid::regprocedure::text
    as installed_function

from pg_proc as p

join pg_namespace as n
  on n.oid = p.pronamespace

where n.nspname = 'public'
  and p.proname in (
    'apply_price_refresh_batch',
    'get_due_price_card_count',
    'get_due_price_card_ids'
  )

order by p.proname;

select
  indexname,
  indexdef

from pg_indexes

where schemaname = 'public'
  and indexname =
    'pokemon_cards_price_due_fast_idx';

notify pgrst, 'reload schema';
