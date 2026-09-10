-- Unknown Pulls Auth transaction repair verification
--
-- Run after:
-- 20260804_unknown_pulls_auth_transaction_repair.sql

select
  public.unknown_pulls_auth_signup_diagnostics()
    as auth_signup_diagnostics;

-- Must return zero rows.
select
  table_row.relname
    as auth_table,

  trigger_row.tgname
    as custom_trigger,

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
  and not trigger_row.tgisinternal

order by
  table_row.relname,
  trigger_row.tgname;

-- Every returned owner should normally be supabase_auth_admin.
select
  case relation_row.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'S' then 'sequence'
    when 'f' then 'foreign table'
    else relation_row.relkind::text
  end
    as object_type,

  relation_row.relname
    as object_name,

  owner_role.rolname
    as owner

from pg_class
  as relation_row

join pg_namespace
  as schema_row
  on schema_row.oid =
    relation_row.relnamespace

join pg_roles
  as owner_role
  on owner_role.oid =
    relation_row.relowner

where schema_row.nspname =
    'auth'
  and relation_row.relkind
    in (
      'r',
      'p',
      'v',
      'm',
      'S',
      'f'
    )

order by
  object_type,
  object_name;

-- Constraints are diagnostic only. Do not drop one without the matching
-- Postgres log line.
select
  table_row.relname
    as auth_table,

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
  and table_row.relname
    in (
      'users',
      'identities'
    )

order by
  table_row.relname,
  constraint_row.conname;

-- Shows everything removed by Unknown Pulls, including triggers attached to
-- identities or other Auth transaction tables.
select
  archive.id,
  archive.archived_at,
  archive.table_schema,
  archive.table_name,
  archive.trigger_name,
  archive.function_schema,
  archive.function_name,
  archive.removed_by_migration

from public.auth_user_trigger_archive
  as archive

order by
  archive.archived_at desc,
  archive.id desc;

notify pgrst, 'reload schema';
