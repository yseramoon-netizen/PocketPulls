-- Unknown Pulls registration repair verification

select
  public.unknown_pulls_registration_health()
    as registration_health;

select
  trigger_row.tgname,
  pg_get_triggerdef(
    trigger_row.oid,
    true
  ) as trigger_definition

from pg_trigger as trigger_row

join pg_class as table_row
  on table_row.oid =
    trigger_row.tgrelid

join pg_namespace as schema_row
  on schema_row.oid =
    table_row.relnamespace

where schema_row.nspname = 'auth'
  and table_row.relname = 'users'
  and not trigger_row.tgisinternal

order by trigger_row.tgname;

select
  p.oid::regprocedure::text
    as function_signature

from pg_proc as p

join pg_namespace as n
  on n.oid = p.pronamespace

where n.nspname = 'public'
  and p.proname in (
    'check_player_username_available',
    'complete_player_registration',
    'unknown_pulls_registration_health',
    'unknown_pulls_handle_new_auth_user'
  )

order by p.proname;

notify pgrst, 'reload schema';
