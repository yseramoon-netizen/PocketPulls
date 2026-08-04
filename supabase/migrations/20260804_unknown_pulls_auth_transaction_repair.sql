-- Unknown Pulls Auth transaction repair
-- Generated 2026-08-04
--
-- This is a reversible, broader repair for:
--
--   500 unexpected_failure
--   Database error saving new user
--
-- The public Auth response does not expose the underlying Postgres exception.
-- Supabase documents the common causes as:
--
-- - custom triggers / trigger functions
-- - constraints on auth.users
-- - broken auth-schema ownership or permissions
-- - custom modifications such as forced RLS
--
-- This migration:
--
-- 1. Archives and removes every non-internal trigger from every auth table,
--    not only auth.users.
-- 2. Restores postgres-owned managed Auth objects to supabase_auth_admin.
-- 3. Restores supabase_auth_admin schema/table/sequence/function privileges.
-- 4. Does not drop constraints.
-- 5. Does not insert or update auth users directly.
-- 6. Adds a detailed diagnostics function for the remaining causes.
--
-- Safe to run repeatedly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- TRIGGER ARCHIVE
-- ---------------------------------------------------------------------------

create table if not exists
public.auth_user_trigger_archive (
  id bigint
    generated always as identity
    primary key,

  archived_at timestamptz
    not null default now(),

  trigger_name text not null,
  trigger_enabled_state text
    not null,
  trigger_definition text
    not null,

  function_schema text,
  function_name text,
  function_identity_arguments text,
  function_definition text,

  archive_reason text
    not null default
      'Removed from a managed Auth table so custom side effects cannot abort authentication.'
);

alter table
  public.auth_user_trigger_archive

  add column if not exists
    table_schema text,

  add column if not exists
    table_name text,

  add column if not exists
    removed_by_migration text;

create index if not exists
  auth_user_trigger_archive_name_idx
on public.auth_user_trigger_archive(
  trigger_name,
  archived_at desc
);

alter table
  public.auth_user_trigger_archive
enable row level security;

revoke all
on public.auth_user_trigger_archive
from anon, authenticated;

do $archive_and_remove_all_custom_auth_triggers$
declare
  v_trigger record;
begin
  for v_trigger in
    select
      table_schema.nspname
        as table_schema,

      table_row.relname
        as table_name,

      trigger_row.tgname
        as trigger_name,

      case
        when trigger_row.tgenabled = 'O'
          then 'origin'
        when trigger_row.tgenabled = 'D'
          then 'disabled'
        when trigger_row.tgenabled = 'R'
          then 'replica'
        when trigger_row.tgenabled = 'A'
          then 'always'
        else
          trigger_row.tgenabled::text
      end
        as trigger_enabled_state,

      pg_get_triggerdef(
        trigger_row.oid,
        true
      )
        as trigger_definition,

      function_schema.nspname
        as function_schema,

      function_row.proname
        as function_name,

      pg_get_function_identity_arguments(
        function_row.oid
      )
        as function_identity_arguments,

      pg_get_functiondef(
        function_row.oid
      )
        as function_definition

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
      trigger_row.tgname
  loop
    insert into
      public.auth_user_trigger_archive (
        table_schema,
        table_name,
        trigger_name,
        trigger_enabled_state,
        trigger_definition,
        function_schema,
        function_name,
        function_identity_arguments,
        function_definition,
        removed_by_migration
      )
    values (
      v_trigger.table_schema,
      v_trigger.table_name,
      v_trigger.trigger_name,
      v_trigger.trigger_enabled_state,
      v_trigger.trigger_definition,
      v_trigger.function_schema,
      v_trigger.function_name,
      v_trigger.function_identity_arguments,
      v_trigger.function_definition,
      '20260804_unknown_pulls_auth_transaction_repair.sql'
    );

    execute format(
      'drop trigger if exists %I on %I.%I',
      v_trigger.trigger_name,
      v_trigger.table_schema,
      v_trigger.table_name
    );

    raise notice
      'Archived and removed custom trigger %.% / %',
      v_trigger.table_schema,
      v_trigger.table_name,
      v_trigger.trigger_name;
  end loop;
end;
$archive_and_remove_all_custom_auth_triggers$;

-- ---------------------------------------------------------------------------
-- AUTH OBJECT OWNERSHIP
-- ---------------------------------------------------------------------------
--
-- Supabase Auth expects its managed objects to be owned by
-- supabase_auth_admin. The official troubleshooting guidance permits moving
-- postgres-owned Auth objects back to this role. Objects owned by
-- supabase_admin are only reported, not changed.

do $repair_auth_schema_owner$
declare
  v_owner text;
begin
  select owner_role.rolname
  into v_owner
  from pg_namespace
    as namespace_row
  join pg_roles
    as owner_role
    on owner_role.oid =
      namespace_row.nspowner
  where namespace_row.nspname =
    'auth';

  if v_owner = 'postgres' then
    execute
      'alter schema auth owner to supabase_auth_admin';

    raise notice
      'Restored auth schema owner to supabase_auth_admin.';
  end if;
end;
$repair_auth_schema_owner$;

do $repair_auth_relation_owners$
declare
  v_object record;
  v_statement text;
begin
  for v_object in
    select
      relation_row.relname
        as object_name,

      relation_row.relkind
        as object_kind

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
      and owner_role.rolname =
        'postgres'
      and relation_row.relkind in (
        'r',
        'p',
        'v',
        'm',
        'S',
        'f'
      )

    order by
      relation_row.relname
  loop
    v_statement :=
      case v_object.object_kind
        when 'r' then
          format(
            'alter table auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
        when 'p' then
          format(
            'alter table auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
        when 'v' then
          format(
            'alter view auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
        when 'm' then
          format(
            'alter materialized view auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
        when 'S' then
          format(
            'alter sequence auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
        when 'f' then
          format(
            'alter foreign table auth.%I owner to supabase_auth_admin',
            v_object.object_name
          )
      end;

    execute v_statement;

    raise notice
      'Restored owner for auth.%',
      v_object.object_name;
  end loop;
end;
$repair_auth_relation_owners$;

do $repair_auth_routine_owners$
declare
  v_routine record;
  v_statement text;
begin
  for v_routine in
    select
      routine_row.proname
        as routine_name,

      pg_get_function_identity_arguments(
        routine_row.oid
      )
        as identity_arguments,

      routine_row.prokind
        as routine_kind

    from pg_proc
      as routine_row

    join pg_namespace
      as schema_row
      on schema_row.oid =
        routine_row.pronamespace

    join pg_roles
      as owner_role
      on owner_role.oid =
        routine_row.proowner

    where schema_row.nspname =
        'auth'
      and owner_role.rolname =
        'postgres'

    order by
      routine_row.proname
  loop
    v_statement :=
      case v_routine.routine_kind
        when 'p' then
          format(
            'alter procedure auth.%I(%s) owner to supabase_auth_admin',
            v_routine.routine_name,
            v_routine.identity_arguments
          )
        when 'a' then
          format(
            'alter aggregate auth.%I(%s) owner to supabase_auth_admin',
            v_routine.routine_name,
            v_routine.identity_arguments
          )
        else
          format(
            'alter function auth.%I(%s) owner to supabase_auth_admin',
            v_routine.routine_name,
            v_routine.identity_arguments
          )
      end;

    execute v_statement;

    raise notice
      'Restored owner for auth routine %',
      v_routine.routine_name;
  end loop;
end;
$repair_auth_routine_owners$;

do $repair_auth_type_owners$
declare
  v_type record;
begin
  for v_type in
    select
      type_row.typname
        as type_name

    from pg_type
      as type_row

    join pg_namespace
      as schema_row
      on schema_row.oid =
        type_row.typnamespace

    join pg_roles
      as owner_role
      on owner_role.oid =
        type_row.typowner

    where schema_row.nspname =
        'auth'
      and owner_role.rolname =
        'postgres'
      and type_row.typrelid = 0
      and type_row.typtype in (
        'e',
        'c'
      )

    order by
      type_row.typname
  loop
    execute format(
      'alter type auth.%I owner to supabase_auth_admin',
      v_type.type_name
    );

    raise notice
      'Restored owner for auth type %',
      v_type.type_name;
  end loop;
end;
$repair_auth_type_owners$;

-- Explicitly restore the privileges Auth requires on its managed schema.
grant usage
on schema auth
to supabase_auth_admin;

grant all privileges
on all tables
in schema auth
to supabase_auth_admin;

grant all privileges
on all sequences
in schema auth
to supabase_auth_admin;

grant execute
on all functions
in schema auth
to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- DIAGNOSTICS
-- ---------------------------------------------------------------------------

create or replace function
public.unknown_pulls_auth_signup_diagnostics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with custom_triggers as (
    select
      count(*)::integer
        as trigger_count,

      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table',
              table_row.relname,
            'trigger',
              trigger_row.tgname,
            'function_schema',
              function_schema.nspname,
            'function',
              function_row.proname
          )
          order by
            table_row.relname,
            trigger_row.tgname
        )
          filter (
            where trigger_row.tgname
              is not null
          ),
        '[]'::jsonb
      )
        as trigger_details

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
  ),
  ownership_mismatches as (
    select
      count(*)::integer
        as mismatch_count,

      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'object_type',
              object_type,
            'object_name',
              object_name,
            'owner',
              owner_name
          )
          order by
            object_type,
            object_name
        ),
        '[]'::jsonb
      )
        as mismatch_details

    from (
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
          as owner_name

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
        and relation_row.relkind in (
          'r',
          'p',
          'v',
          'm',
          'S',
          'f'
        )
        and owner_role.rolname <>
          'supabase_auth_admin'

      union all

      select
        case routine_row.prokind
          when 'p' then 'procedure'
          when 'a' then 'aggregate'
          else 'function'
        end,
        routine_row.proname,
        owner_role.rolname

      from pg_proc
        as routine_row

      join pg_namespace
        as schema_row
        on schema_row.oid =
          routine_row.pronamespace

      join pg_roles
        as owner_role
        on owner_role.oid =
          routine_row.proowner

      where schema_row.nspname =
          'auth'
        and owner_role.rolname <>
          'supabase_auth_admin'
    )
      as mismatches
  ),
  suspicious_user_constraints as (
    select
      count(*)::integer
        as constraint_count,

      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name',
              constraint_row.conname,
            'type',
              constraint_row.contype,
            'definition',
              pg_get_constraintdef(
                constraint_row.oid,
                true
              )
          )
          order by
            constraint_row.conname
        ),
        '[]'::jsonb
      )
        as constraint_details

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
      and constraint_row.contype
        in (
          'c',
          'f',
          'x'
        )
  ),
  auth_table_flags as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table',
              table_row.relname,
            'rls_enabled',
              table_row.relrowsecurity,
            'force_rls',
              table_row.relforcerowsecurity,
            'owner',
              owner_role.rolname
          )
          order by
            table_row.relname
        ),
        '[]'::jsonb
      )
        as table_details,

      bool_or(
        table_row.relforcerowsecurity
      )
        as any_forced_rls

    from pg_class
      as table_row

    join pg_namespace
      as schema_row
      on schema_row.oid =
        table_row.relnamespace

    join pg_roles
      as owner_role
      on owner_role.oid =
        table_row.relowner

    where schema_row.nspname =
        'auth'
      and table_row.relname
        in (
          'users',
          'identities',
          'audit_log_entries',
          'sessions',
          'refresh_tokens'
        )
  )
  select jsonb_build_object(
    'ok',
      custom_triggers.trigger_count = 0

      and ownership_mismatches.mismatch_count = 0

      and not coalesce(
        auth_table_flags.any_forced_rls,
        false
      )

      and has_schema_privilege(
        'supabase_auth_admin',
        'auth',
        'USAGE'
      )

      and has_table_privilege(
        'supabase_auth_admin',
        'auth.users',
        'INSERT'
      ),

    'custom_auth_triggers',
      custom_triggers.trigger_count,

    'custom_auth_trigger_details',
      custom_triggers.trigger_details,

    'ownership_mismatches',
      ownership_mismatches.mismatch_count,

    'ownership_mismatch_details',
      ownership_mismatches.mismatch_details,

    'supabase_auth_admin_schema_usage',
      has_schema_privilege(
        'supabase_auth_admin',
        'auth',
        'USAGE'
      ),

    'supabase_auth_admin_users_insert',
      has_table_privilege(
        'supabase_auth_admin',
        'auth.users',
        'INSERT'
      ),

    'suspicious_auth_users_constraints',
      suspicious_user_constraints.constraint_count,

    'suspicious_auth_users_constraint_details',
      suspicious_user_constraints.constraint_details,

    'auth_table_flags',
      auth_table_flags.table_details,

    'forced_rls_detected',
      coalesce(
        auth_table_flags.any_forced_rls,
        false
      ),

    'next_step_if_500_remains',
      'Run the included Auth and Postgres queries in Dashboard > Logs > Log Explorer. The exact SQLSTATE and constraint/function/object name are required for the final surgical fix.'
  )
  from custom_triggers
  cross join ownership_mismatches
  cross join suspicious_user_constraints
  cross join auth_table_flags;
$function$;

revoke all
on function
  public.unknown_pulls_auth_signup_diagnostics()
from public;

grant execute
on function
  public.unknown_pulls_auth_signup_diagnostics()
to authenticated;

comment on function
  public.unknown_pulls_auth_signup_diagnostics()
is
  'Reports custom Auth triggers, managed-object ownership, critical privileges, constraints and forced RLS relevant to Supabase signup 500 errors.';

notify pgrst, 'reload schema';
