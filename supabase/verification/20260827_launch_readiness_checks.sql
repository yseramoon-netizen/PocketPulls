-- Ancient Pulls V66 read-only production verification.
-- Run after the migration. Every boolean in the first result should be true.

select
  to_regclass('public.launch_control_settings') is not null as launch_control_installed,
  to_regclass('public.operations_events') is not null as operations_ledger_installed,
  to_regclass('public.admin_audit_events') is not null as admin_audit_installed,
  to_regclass('public.stripe_webhook_events') is not null as stripe_journal_installed,
  to_regclass('public.support_tickets') is not null as support_installed,
  to_regprocedure('public.admin_add_inventory_idempotent(uuid,text,text,integer,text,text,text,text,text,text)') is not null as atomic_intake_installed,
  to_regprocedure('public.make_player_wish(uuid)') is not null as repeat_safe_wishes_installed,
  to_regprocedure('public.create_guarded_wish_purchase_order(uuid,text,text,integer,integer,integer,text)') is not null as guarded_checkout_installed;

select
  settings.beta_mode,
  settings.maintenance_mode,
  settings.purchases_enabled,
  settings.inventory_backed_wishes,
  settings.scanner_auto_write_enabled,
  settings.scanner_release_status,
  settings.legal_review_status,
  settings.updated_at
from public.launch_control_settings as settings
where settings.id = 1;

select
  (select coalesce(sum(greatest(quantity, 0)), 0) from public.inventory) as physical_units,
  (select count(*) from public.wish_pool_cards where enabled) as enabled_wish_designs,
  (select count(*) from public.wish_fulfilment_obligations where status in ('source_needed', 'source_requested')) as sourcing_debt,
  (select count(*) from public.stripe_webhook_events where processing_status in ('failed', 'processing')) as webhook_exceptions,
  (select count(*) from public.support_tickets where status in ('open', 'waiting_admin', 'waiting_player')) as open_support,
  (select count(*) from public.player_shipping_shipments where status in ('requested', 'packing', 'shipped')) as active_shipments;

select *
from public.scanner_release_benchmarks
order by recorded_at desc
limit 5;
