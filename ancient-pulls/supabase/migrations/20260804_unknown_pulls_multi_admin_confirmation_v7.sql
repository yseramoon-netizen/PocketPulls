-- Unknown Pulls multi-admin and confirmation-email repair V7
-- Generated 2026-08-04
--
-- Adds:
-- 1. Multiple independently authenticated Shaymin administrators.
-- 2. Admin-access audit records.
-- 3. A stable founder bootstrap account.
--
-- Player confirmation emails are sent by the protected server route through
-- Supabase Auth. No service-role key is exposed to the browser.

create extension if not exists pgcrypto;

create table if not exists
public.admin_users (
  email text
    primary key,

  user_id uuid
    unique
    references auth.users(id)
    on delete set null,

  display_name text,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  last_verified_at timestamptz
);

alter table
  public.admin_users

add column if not exists
  user_id uuid,

add column if not exists
  display_name text,

add column if not exists
  is_active boolean
    not null
    default true,

add column if not exists
  created_at timestamptz
    not null
    default now(),

add column if not exists
  updated_at timestamptz
    not null
    default now(),

add column if not exists
  last_verified_at timestamptz;

create unique index if not exists
  admin_users_user_id_unique

on public.admin_users(
  user_id
)

where user_id is not null;

insert into
  public.admin_users (
    email,
    display_name,
    is_active
  )

values (
  'pullspocket@gmail.com',
  'Lukas / PocketPulls',
  true
)

on conflict (email)
do update set
  is_active =
    true,

  display_name =
    coalesce(
      public.admin_users
        .display_name,
      excluded.display_name
    ),

  updated_at =
    now();

update public.admin_users
  as administrator

set
  user_id =
    account.id,

  last_verified_at =
    now(),

  updated_at =
    now()

from auth.users
  as account

where lower(
  coalesce(
    account.email,
    ''
  )
) =
lower(
  administrator.email
);

alter table
  public.admin_users

enable row level security;

revoke all
on public.admin_users
from anon, authenticated;

create table if not exists
public.admin_access_events (
  id uuid
    primary key
    default gen_random_uuid(),

  actor_user_id uuid,
  actor_email text
    not null,

  target_user_id uuid,
  target_email text
    not null,

  access_enabled boolean
    not null,

  reason text,

  created_at timestamptz
    not null
    default now()
);

create index if not exists
  admin_access_events_created_idx

on public.admin_access_events(
  created_at desc
);

create index if not exists
  admin_access_events_target_idx

on public.admin_access_events(
  target_user_id,
  created_at desc
);

alter table
  public.admin_access_events

enable row level security;

revoke all
on public.admin_access_events
from anon, authenticated;

create or replace function
public.unknown_pulls_multi_admin_health()
returns jsonb
language sql
stable
security definer
set search_path =
  public,
  auth,
  pg_temp
as $function$
  select jsonb_build_object(
    'active_admins',
    (
      select count(*)
      from public.admin_users
      where is_active
    ),

    'bound_admins',
    (
      select count(*)
      from public.admin_users
      where is_active
        and user_id is not null
    ),

    'founder_active',
    exists (
      select 1
      from public.admin_users
      where lower(email) =
          'pullspocket@gmail.com'
        and is_active
    ),

    'generated_at',
    now()
  );
$function$;

revoke all
on function
  public.unknown_pulls_multi_admin_health()
from public;

notify pgrst, 'reload schema';
