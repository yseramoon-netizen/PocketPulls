-- Unknown Pulls admin, registration and set-filter verification
--
-- Run after:
-- 20260804_unknown_pulls_admin_set_build_repair.sql

select
  public.unknown_pulls_registration_health()
    as registration_health;

select
  public.unknown_pulls_admin_health()
    as admin_health;

-- Confirms the set dropdown can load the complete catalogue.
select
  count(*)::integer
    as available_set_count,

  sum(card_count)::bigint
    as cards_across_sets

from public.get_pokemon_card_sets();

-- Preview the first 25 set options.
select
  set_name,
  card_count

from public.get_pokemon_card_sets()

limit 25;

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

-- Confirms the founder account.
select
  administrator.email,
  administrator.user_id,
  administrator.is_active,
  administrator.last_verified_at,

  exists (
    select 1
    from auth.users
      as auth_user

    where auth_user.id =
      administrator.user_id
  )
    as bound_auth_user_exists

from public.admin_users
  as administrator

where lower(
  administrator.email
) =
  'pullspocket@gmail.com';

-- Shows custom signup triggers removed by the repair.
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

notify pgrst, 'reload schema';
