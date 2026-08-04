-- Unknown Pulls admin, registration, build and set-filter repair
--
-- Run this after the earlier Unknown Pulls migrations.
--
-- Repairs:
-- 1. Missing public.unknown_pulls_admin_health().
-- 2. Explicit admin access for pullspocket@gmail.com.
-- 3. Remaining custom auth.users triggers that can abort signup.
-- 4. Complete distinct Pokemon set catalogue for the Shaymin Add Cards page.
--
-- Safe to run repeatedly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ADMIN ALLOWLIST FOUNDATION
-- ---------------------------------------------------------------------------

create table if not exists public.admin_users (
  email text primary key,

  user_id uuid
    unique
    references auth.users(id)
    on delete set null,

  display_name text,

  is_active boolean
    not null default true,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  last_verified_at timestamptz
);

alter table public.admin_users
  add column if not exists user_id uuid,
  add column if not exists display_name text,
  add column if not exists is_active boolean
    not null default true,
  add column if not exists created_at timestamptz
    not null default now(),
  add column if not exists updated_at timestamptz
    not null default now(),
  add column if not exists last_verified_at timestamptz;

create unique index if not exists
  admin_users_user_id_unique
on public.admin_users(user_id)
where user_id is not null;

insert into public.admin_users (
  email,
  display_name,
  is_active,
  updated_at
)
values (
  'pullspocket@gmail.com',
  'Unknown Pulls Founder',
  true,
  now()
)
on conflict (email)
do update set
  display_name =
    excluded.display_name,

  is_active =
    true,

  updated_at =
    now();

update public.admin_users
  as administrator

set
  user_id =
    auth_user.id,

  last_verified_at =
    now(),

  updated_at =
    now()

from auth.users
  as auth_user

where lower(
    coalesce(
      auth_user.email,
      ''
    )
  ) =
  lower(
    administrator.email
  );

alter table public.admin_users
  enable row level security;

revoke all
on public.admin_users
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN INVENTORY AUDIT FOUNDATION
-- ---------------------------------------------------------------------------

create table if not exists
public.admin_inventory_events (
  id uuid
    primary key
    default gen_random_uuid(),

  admin_user_id uuid,
  admin_email text not null,

  inventory_id text,
  card_id text not null,
  finish text,

  quantity_delta integer
    not null default 0,

  final_quantity integer
    not null default 0,

  event_type text
    not null,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now()
);

alter table public.admin_inventory_events
  add column if not exists admin_user_id uuid,
  add column if not exists admin_email text,
  add column if not exists inventory_id text,
  add column if not exists card_id text,
  add column if not exists finish text,
  add column if not exists quantity_delta integer
    not null default 0,
  add column if not exists final_quantity integer
    not null default 0,
  add column if not exists event_type text,
  add column if not exists metadata jsonb
    not null default '{}'::jsonb,
  add column if not exists created_at timestamptz
    not null default now();

create index if not exists
  admin_inventory_events_created_idx
on public.admin_inventory_events(
  created_at desc
);

create index if not exists
  admin_inventory_events_card_idx
on public.admin_inventory_events(
  card_id,
  created_at desc
);

alter table public.admin_inventory_events
  enable row level security;

revoke all
on public.admin_inventory_events
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ARCHIVE AND REMOVE CUSTOM auth.users TRIGGERS
-- ---------------------------------------------------------------------------
--
-- Player setup is completed after authentication by:
--
--   public.complete_player_registration()
--
-- It must not run inside the auth.users INSERT transaction.

create table if not exists
public.auth_user_trigger_archive (
  id bigint
    generated always as identity
    primary key,

  archived_at timestamptz
    not null default now(),

  trigger_name text not null,
  trigger_enabled_state text not null,
  trigger_definition text not null,

  function_schema text,
  function_name text,
  function_identity_arguments text,
  function_definition text,

  archive_reason text
    not null default
      'Removed from auth.users so custom player setup cannot abort Supabase signup.'
);

create index if not exists
  auth_user_trigger_archive_name_idx
on public.auth_user_trigger_archive(
  trigger_name,
  archived_at desc
);

alter table public.auth_user_trigger_archive
  enable row level security;

revoke all
on public.auth_user_trigger_archive
from anon, authenticated;

do $archive_and_remove_custom_auth_triggers$
declare
  v_trigger record;
begin
  for v_trigger in
    select
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
      and table_row.relname =
        'users'
      and not trigger_row.tgisinternal

    order by
      trigger_row.tgname
  loop
    insert into
      public.auth_user_trigger_archive (
        trigger_name,
        trigger_enabled_state,
        trigger_definition,
        function_schema,
        function_name,
        function_identity_arguments,
        function_definition
      )
    values (
      v_trigger.trigger_name,
      v_trigger.trigger_enabled_state,
      v_trigger.trigger_definition,
      v_trigger.function_schema,
      v_trigger.function_name,
      v_trigger.function_identity_arguments,
      v_trigger.function_definition
    );

    execute format(
      'drop trigger if exists %I on auth.users',
      v_trigger.trigger_name
    );

    raise notice
      'Archived and removed auth.users trigger: %',
      v_trigger.trigger_name;
  end loop;
end;
$archive_and_remove_custom_auth_triggers$;

drop function if exists
  public.unknown_pulls_handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- COMPLETE SET CATALOGUE
-- ---------------------------------------------------------------------------

create or replace function
public.get_pokemon_card_sets()
returns table (
  set_name text,
  card_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    btrim(
      cards.set_name
    )::text
      as set_name,

    count(*)::bigint
      as card_count

  from public.pokemon_cards
    as cards

  where cards.set_name is not null
    and btrim(cards.set_name) <> ''

  group by
    btrim(cards.set_name)

  order by
    btrim(cards.set_name);
$function$;

revoke all
on function
  public.get_pokemon_card_sets()
from public;

grant execute
on function
  public.get_pokemon_card_sets()
to authenticated;

comment on function
  public.get_pokemon_card_sets()
is
  'Returns every distinct Pokemon set and its local card count for the Shaymin inventory intake filter.';

-- ---------------------------------------------------------------------------
-- HEALTH FUNCTIONS
-- ---------------------------------------------------------------------------

create or replace function
public.unknown_pulls_admin_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'ok',
      exists (
        select 1
        from public.admin_users
          as administrator

        where lower(
          administrator.email
        ) =
          'pullspocket@gmail.com'

          and administrator.is_active
      )

      and to_regclass(
        'public.admin_inventory_events'
      ) is not null

      and to_regprocedure(
        'public.get_pokemon_card_sets()'
      ) is not null,

    'admin_email',
      'pullspocket@gmail.com',

    'allowlisted',
      exists (
        select 1
        from public.admin_users
          as administrator

        where lower(
          administrator.email
        ) =
          'pullspocket@gmail.com'

          and administrator.is_active
      ),

    'admin_auth_account_exists',
      exists (
        select 1
        from auth.users
          as auth_user

        where lower(
          coalesce(
            auth_user.email,
            ''
          )
        ) =
          'pullspocket@gmail.com'
      ),

    'admin_email_confirmed',
      coalesce(
        (
          select
            auth_user.email_confirmed_at
              is not null

          from auth.users
            as auth_user

          where lower(
            coalesce(
              auth_user.email,
              ''
            )
          ) =
            'pullspocket@gmail.com'

          order by
            auth_user.created_at

          limit 1
        ),
        false
      ),

    'bound_user_id',
      (
        select
          administrator.user_id

        from public.admin_users
          as administrator

        where lower(
          administrator.email
        ) =
          'pullspocket@gmail.com'

        limit 1
      ),

    'set_filter_function',
      to_regprocedure(
        'public.get_pokemon_card_sets()'
      ) is not null,

    'test_pull_mode',
      'read-only server SELECT',

    'inventory_test_mutation',
      false
  );
$function$;

create or replace function
public.unknown_pulls_registration_health()
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
          trigger_row.tgname
          order by
            trigger_row.tgname
        )
          filter (
            where trigger_row.tgname
              is not null
          ),
        '[]'::jsonb
      )
        as trigger_names

    from pg_trigger
      as trigger_row

    join pg_class
      as table_row
      on table_row.oid =
        trigger_row.tgrelid

    join pg_namespace
      as schema_row
      on schema_row.oid =
        table_row.relnamespace

    where schema_row.nspname =
        'auth'
      and table_row.relname =
        'users'
      and not trigger_row.tgisinternal
  )
  select jsonb_build_object(
    'ok',
      to_regclass(
        'public.player_profiles'
      ) is not null

      and to_regclass(
        'public.player_wallets'
      ) is not null

      and to_regprocedure(
        'public.check_player_username_available(text)'
      ) is not null

      and to_regprocedure(
        'public.complete_player_registration()'
      ) is not null

      and custom_triggers.trigger_count = 0,

    'profiles_table',
      to_regclass(
        'public.player_profiles'
      ) is not null,

    'wallets_table',
      to_regclass(
        'public.player_wallets'
      ) is not null,

    'username_function',
      to_regprocedure(
        'public.check_player_username_available(text)'
      ) is not null,

    'registration_function',
      to_regprocedure(
        'public.complete_player_registration()'
      ) is not null,

    'active_custom_auth_user_triggers',
      custom_triggers.trigger_count,

    'active_custom_auth_user_trigger_names',
      custom_triggers.trigger_names,

    'player_setup_mode',
      'post-authentication RPC'
  )
  from custom_triggers;
$function$;

revoke all
on function
  public.unknown_pulls_admin_health()
from public;

revoke all
on function
  public.unknown_pulls_registration_health()
from public;

grant execute
on function
  public.unknown_pulls_admin_health()
to authenticated;

grant execute
on function
  public.unknown_pulls_registration_health()
to anon, authenticated;

notify pgrst, 'reload schema';
