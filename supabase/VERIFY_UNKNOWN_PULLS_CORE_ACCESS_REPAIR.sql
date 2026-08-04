-- Unknown Pulls core access repair verification
-- Run after:
-- 20260804_unknown_pulls_core_access_repair.sql

select
  public.unknown_pulls_registration_health()
    as registration_health;

select
  public.unknown_pulls_admin_health()
    as admin_health;

-- This must return zero rows.
select
  trigger_row.tgname
    as active_custom_trigger,

  function_schema.nspname
    as function_schema,

  function_row.proname
    as function_name,

  pg_get_triggerdef(
    trigger_row.oid,
    true
  )
    as trigger_definition

from pg_trigger
  as trigger_row

join pg_class
  as table_row
  on table_row.oid =
    trigger_row.tgrelid

join pg_namespace
  as table_schema
  on table_schema.oid =
    table_row.relnamespace

join pg_proc
  as function_row
  on function_row.oid =
    trigger_row.tgfoid

join pg_namespace
  as function_schema
  on function_schema.oid =
    function_row.pronamespace

where table_schema.nspname =
    'auth'
  and table_row.relname =
    'users'
  and not trigger_row.tgisinternal

order by
  trigger_row.tgname;

-- Confirms the authorised founder email.
select
  administrator.email,
  administrator.user_id,
  administrator.is_active,
  administrator.last_verified_at

from public.admin_users
  as administrator

where lower(
  administrator.email
) =
  'pullspocket@gmail.com';

-- Shows removed custom signup triggers, if any.
select
  archive.id,
  archive.archived_at,
  archive.trigger_name,
  archive.function_schema,
  archive.function_name

from public.auth_user_trigger_archive
  as archive

order by
  archive.archived_at desc,
  archive.id desc;

-- Diagnostic only: constraints remain owned by Supabase.
-- If signup still returns "Database error saving new user" after the trigger
-- list is empty, copy this result together with the Auth/Postgres log entry.
select
  constraint_row.conname
    as constraint_name,

  constraint_row.contype
    as constraint_type,

  pg_get_constraintdef(
    constraint_row.oid,
    true
  )
    as constraint_definition

from pg_constraint
  as constraint_row

join pg_class
  as table_row
  on table_row.oid =
    constraint_row.conrelid

join pg_namespace
  as schema_row
  on schema_row.oid =
    table_row.relnamespace

where schema_row.nspname =
    'auth'
  and table_row.relname =
    'users'

order by
  constraint_row.conname;

notify pgrst, 'reload schema';
