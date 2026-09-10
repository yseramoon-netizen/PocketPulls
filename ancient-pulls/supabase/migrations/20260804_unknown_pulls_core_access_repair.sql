-- Unknown Pulls core access repair
-- Generated 2026-08-04
--
-- This migration fixes three systems together:
--
-- 1. Explicit Shaymin admin access for pullspocket@gmail.com.
-- 2. Read-only admin test pulls that never mutate physical inventory.
-- 3. Player signup without any custom auth.users trigger.
--
-- Existing inventory, catalogue, player collections, wallets and real player
-- wish history are preserved.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- PLAYER ACCOUNT TABLE FOUNDATION
-- ---------------------------------------------------------------------------

create table if not exists public.player_profiles (
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  username text,
  display_name text,
  avatar_url text,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

alter table public.player_profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz
    not null default now(),
  add column if not exists updated_at timestamptz
    not null default now();

create table if not exists public.player_wallets (
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  wish_balance integer
    not null default 0,

  lifetime_wishes_spent integer
    not null default 0,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

alter table public.player_wallets
  add column if not exists wish_balance integer
    not null default 0,
  add column if not exists lifetime_wishes_spent integer
    not null default 0,
  add column if not exists created_at timestamptz
    not null default now(),
  add column if not exists updated_at timestamptz
    not null default now();

update public.player_wallets
set
  wish_balance =
    greatest(
      coalesce(wish_balance, 0),
      0
    ),

  lifetime_wishes_spent =
    greatest(
      coalesce(
        lifetime_wishes_spent,
        0
      ),
      0
    );

-- Repair historical duplicate usernames before enforcing case-insensitive
-- uniqueness.
with ranked_usernames as (
  select
    profile.user_id,
    profile.username,

    row_number() over (
      partition by
        lower(
          btrim(profile.username)
        )

      order by
        profile.user_id
    )
      as duplicate_position

  from public.player_profiles
    as profile

  where profile.username is not null
    and btrim(profile.username) <> ''
)
update public.player_profiles
  as profile

set username =
  left(
    regexp_replace(
      lower(
        btrim(profile.username)
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    ),
    11
  ) ||
  '_' ||
  left(
    replace(
      profile.user_id::text,
      '-',
      ''
    ),
    12
  )

from ranked_usernames
  as ranked

where ranked.user_id =
    profile.user_id
  and ranked.duplicate_position > 1;

create unique index if not exists
  player_profiles_username_lower_unique
on public.player_profiles (
  lower(username)
)
where username is not null
  and btrim(username) <> '';

alter table public.player_profiles
  enable row level security;

alter table public.player_wallets
  enable row level security;

drop policy if exists
  "Players can read own profile"
on public.player_profiles;

create policy
  "Players can read own profile"
on public.player_profiles
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Players can update own profile"
on public.player_profiles;

create policy
  "Players can update own profile"
on public.player_profiles
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Players can read own wallet"
on public.player_wallets;

create policy
  "Players can read own wallet"
on public.player_wallets
for select
to authenticated
using (
  auth.uid() = user_id
);

grant select, update
on public.player_profiles
to authenticated;

grant select
on public.player_wallets
to authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN ALLOWLIST
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
  is_active
)
values (
  'pullspocket@gmail.com',
  'PocketPulls Admin',
  true
)
on conflict (email)
do update set
  display_name =
    excluded.display_name,

  is_active = true,

  updated_at = now();

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
  lower(administrator.email);

alter table public.admin_users
  enable row level security;

revoke all
on public.admin_users
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN INVENTORY AUDIT
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

alter table
  public.admin_inventory_events
enable row level security;

revoke all
on public.admin_inventory_events
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ARCHIVE AND REMOVE EVERY CUSTOM auth.users TRIGGER
-- ---------------------------------------------------------------------------
--
-- Player setup must not run inside the Supabase Auth INSERT transaction.
-- Any failing side effect there rolls back the whole signup and produces:
--
--   500 unexpected_failure
--   Database error saving new user
--
-- Unknown Pulls now completes player setup after a valid session exists.

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
      'Removed from auth.users so player setup cannot abort Supabase signup.'
);

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

do $archive_and_remove_auth_user_triggers$
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
$archive_and_remove_auth_user_triggers$;

drop function if exists
  public.unknown_pulls_handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- USERNAME AVAILABILITY
-- ---------------------------------------------------------------------------

create or replace function
public.check_player_username_available(
  p_username text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_username text;
begin
  v_username :=
    lower(
      regexp_replace(
        btrim(
          coalesce(
            p_username,
            ''
          )
        ),
        '[^a-z0-9_]+',
        '',
        'g'
      )
    );

  if char_length(
    v_username
  ) < 3
    or char_length(
      v_username
    ) > 24 then
    return false;
  end if;

  return not exists (
    select 1
    from public.player_profiles
      as profile

    where lower(
      profile.username
    ) = v_username
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- POST-AUTHENTICATION PLAYER SETUP
-- ---------------------------------------------------------------------------

create or replace function
public.complete_player_registration()
returns table (
  username text,
  display_name text,
  wish_balance integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_email text;
  v_metadata jsonb;

  v_username text;
  v_display_name text;
  v_avatar_url text;

  v_suffix text;
  v_existing_username text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message =
        'You must be signed in to complete registration.';
  end if;

  select
    auth_user.email::text,

    coalesce(
      auth_user.raw_user_meta_data,
      '{}'::jsonb
    )

  into
    v_email,
    v_metadata

  from auth.users
    as auth_user

  where auth_user.id =
    v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'The authenticated Supabase user could not be found.';
  end if;

  v_username :=
    lower(
      regexp_replace(
        coalesce(
          nullif(
            btrim(
              v_metadata ->> 'username'
            ),
            ''
          ),

          nullif(
            split_part(
              coalesce(
                v_email,
                ''
              ),
              '@',
              1
            ),
            ''
          ),

          'trainer'
        ),
        '[^a-z0-9_]+',
        '_',
        'g'
      )
    );

  v_username :=
    regexp_replace(
      v_username,
      '_+',
      '_',
      'g'
    );

  v_username :=
    regexp_replace(
      v_username,
      '^_+|_+$',
      '',
      'g'
    );

  v_username :=
    left(
      v_username,
      24
    );

  if char_length(
    v_username
  ) < 3 then
    v_username :=
      'trainer';
  end if;

  v_suffix :=
    left(
      replace(
        v_user_id::text,
        '-',
        ''
      ),
      12
    );

  perform pg_advisory_xact_lock(
    hashtext(
      lower(v_username)
    )
  );

  select
    profile.username

  into
    v_existing_username

  from public.player_profiles
    as profile

  where profile.user_id =
    v_user_id;

  if coalesce(
    btrim(
      v_existing_username
    ),
    ''
  ) <> '' then
    v_username :=
      v_existing_username;

  elsif exists (
    select 1
    from public.player_profiles
      as profile

    where lower(
      profile.username
    ) =
      lower(v_username)

      and profile.user_id <>
        v_user_id
  ) then
    v_username :=
      left(
        v_username,
        11
      ) ||
      '_' ||
      v_suffix;
  end if;

  v_display_name :=
    left(
      coalesce(
        nullif(
          btrim(
            v_metadata
              ->> 'display_name'
          ),
          ''
        ),

        nullif(
          btrim(
            v_metadata
              ->> 'full_name'
          ),
          ''
        ),

        nullif(
          split_part(
            coalesce(
              v_email,
              ''
            ),
            '@',
            1
          ),
          ''
        ),

        'Unknown Trainer'
      ),
      60
    );

  v_avatar_url :=
    nullif(
      btrim(
        coalesce(
          v_metadata
            ->> 'avatar_url',

          v_metadata
            ->> 'picture',

          ''
        )
      ),
      ''
    );

  insert into
    public.player_profiles (
      user_id,
      username,
      display_name,
      avatar_url,
      updated_at
    )
  values (
    v_user_id,
    v_username,
    v_display_name,
    v_avatar_url,
    now()
  )
  on conflict (user_id)
  do update set
    username =
      case
        when coalesce(
          btrim(
            player_profiles.username
          ),
          ''
        ) = ''
          then excluded.username

        else
          player_profiles.username
      end,

    display_name =
      case
        when coalesce(
          btrim(
            player_profiles.display_name
          ),
          ''
        ) = ''
          then excluded.display_name

        else
          player_profiles.display_name
      end,

    avatar_url =
      coalesce(
        player_profiles.avatar_url,
        excluded.avatar_url
      ),

    updated_at =
      now();

  insert into
    public.player_wallets (
      user_id,
      wish_balance,
      lifetime_wishes_spent,
      updated_at
    )
  values (
    v_user_id,
    0,
    0,
    now()
  )
  on conflict (user_id)
  do nothing;

  return query
  select
    profile.username::text,
    profile.display_name::text,

    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer

  from public.player_profiles
    as profile

  left join public.player_wallets
    as wallet
    on wallet.user_id =
      profile.user_id

  where profile.user_id =
    v_user_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- HEALTH AND DIAGNOSTICS
-- ---------------------------------------------------------------------------

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

    'test_pull_mode',
      'read-only server SELECT',

    'inventory_test_mutation',
      false
  );
$function$;

revoke all
on function
  public.check_player_username_available(
    text
  )
from public;

revoke all
on function
  public.complete_player_registration()
from public;

revoke all
on function
  public.unknown_pulls_registration_health()
from public;

revoke all
on function
  public.unknown_pulls_admin_health()
from public;

grant execute
on function
  public.check_player_username_available(
    text
  )
to anon, authenticated;

grant execute
on function
  public.complete_player_registration()
to authenticated;

grant execute
on function
  public.unknown_pulls_registration_health()
to anon, authenticated;

grant execute
on function
  public.unknown_pulls_admin_health()
to authenticated;

comment on function
  public.complete_player_registration()
is
  'Creates or repairs the signed-in Unknown Pulls player profile and wish wallet after Supabase Auth has completed successfully.';

comment on table
  public.admin_users
is
  'Server-side allowlist for the Shaymin administration site.';

comment on table
  public.admin_inventory_events
is
  'Audit history for real admin inventory changes. Read-only test pulls never write to this table or inventory.';

notify pgrst, 'reload schema';
