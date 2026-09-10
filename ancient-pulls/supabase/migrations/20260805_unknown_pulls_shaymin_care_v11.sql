begin;

create extension if not exists pgcrypto;

create table if not exists public.shaymin_care_state (
  id smallint primary key default 1,
  affection smallint not null default 60,
  fullness smallint not null default 70,
  energy smallint not null default 75,
  comfort smallint not null default 80,
  last_decay_at timestamptz not null default now(),
  last_action text,
  last_item text,
  last_actor_name text,
  last_actor_email text,
  last_action_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint shaymin_care_singleton check (id = 1),
  constraint shaymin_care_affection_range check (affection between 0 and 100),
  constraint shaymin_care_fullness_range check (fullness between 0 and 100),
  constraint shaymin_care_energy_range check (energy between 0 and 100),
  constraint shaymin_care_comfort_range check (comfort between 0 and 100)
);

alter table public.shaymin_care_state
  add column if not exists affection smallint not null default 60,
  add column if not exists fullness smallint not null default 70,
  add column if not exists energy smallint not null default 75,
  add column if not exists comfort smallint not null default 80,
  add column if not exists last_decay_at timestamptz not null default now(),
  add column if not exists last_action text,
  add column if not exists last_item text,
  add column if not exists last_actor_name text,
  add column if not exists last_actor_email text,
  add column if not exists last_action_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

insert into public.shaymin_care_state (
  id,
  affection,
  fullness,
  energy,
  comfort
)
values (
  1,
  60,
  70,
  75,
  80
)
on conflict (id) do nothing;

create table if not exists public.shaymin_care_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  item text,
  note text,
  actor_name text not null,
  actor_email text not null,
  affection_delta smallint not null default 0,
  fullness_delta smallint not null default 0,
  energy_delta smallint not null default 0,
  comfort_delta smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint shaymin_care_event_action check (
    action in (
      'pat',
      'feed',
      'play',
      'groom',
      'nap',
      'talk',
      'boop',
      'cheer'
    )
  ),
  constraint shaymin_care_event_note_length check (
    note is null or char_length(note) <= 180
  )
);

create index if not exists shaymin_care_events_created_at_idx
  on public.shaymin_care_events (created_at desc);

create index if not exists shaymin_care_events_actor_date_idx
  on public.shaymin_care_events (actor_email, created_at desc);

alter table public.shaymin_care_state enable row level security;
alter table public.shaymin_care_events enable row level security;

revoke all on table public.shaymin_care_state from anon, authenticated;
revoke all on table public.shaymin_care_events from anon, authenticated;

grant select, insert, update, delete on table public.shaymin_care_state to service_role;
grant select, insert, update, delete on table public.shaymin_care_events to service_role;

create or replace function public.refresh_shaymin_care_state()
returns table (
  affection smallint,
  fullness smallint,
  energy smallint,
  comfort smallint,
  last_action text,
  last_item text,
  last_actor_name text,
  last_actor_email text,
  last_action_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_row public.shaymin_care_state%rowtype;
  v_elapsed_hours numeric := 0;
  v_fullness_loss integer := 0;
  v_comfort_loss integer := 0;
  v_affection_loss integer := 0;
  v_energy_gain integer := 0;
begin
  insert into public.shaymin_care_state (id)
  values (1)
  on conflict (id) do nothing;

  select *
  into v_row
  from public.shaymin_care_state
  where id = 1
  for update;

  v_elapsed_hours := greatest(
    0,
    extract(epoch from (v_now - coalesce(v_row.last_decay_at, v_now))) / 3600.0
  );

  -- Gentle virtual-pet decay. The system should invite care, never punish absence.
  v_fullness_loss := floor(v_elapsed_hours / 4.0)::integer * 2;
  v_comfort_loss := floor(v_elapsed_hours / 12.0)::integer * 2;
  v_affection_loss := floor(v_elapsed_hours / 48.0)::integer;
  v_energy_gain := floor(v_elapsed_hours / 3.0)::integer * 3;

  update public.shaymin_care_state as state
  set
    affection = greatest(0, least(100, state.affection - v_affection_loss)),
    fullness = greatest(0, least(100, state.fullness - v_fullness_loss)),
    energy = greatest(0, least(100, state.energy + v_energy_gain)),
    comfort = greatest(0, least(100, state.comfort - v_comfort_loss)),
    last_decay_at = v_now,
    updated_at = case
      when v_fullness_loss <> 0
        or v_comfort_loss <> 0
        or v_affection_loss <> 0
        or v_energy_gain <> 0
      then v_now
      else state.updated_at
    end
  where state.id = 1;

  return query
  select
    state.affection,
    state.fullness,
    state.energy,
    state.comfort,
    state.last_action,
    state.last_item,
    state.last_actor_name,
    state.last_actor_email,
    state.last_action_at,
    state.updated_at
  from public.shaymin_care_state as state
  where state.id = 1;
end;
$function$;

create or replace function public.care_for_shaymin(
  p_action text,
  p_item text default null,
  p_note text default null,
  p_actor_email text default '',
  p_actor_name text default 'Keeper'
)
returns table (
  affection smallint,
  fullness smallint,
  energy smallint,
  comfort smallint,
  last_action text,
  last_item text,
  last_actor_name text,
  last_actor_email text,
  last_action_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_item text := lower(trim(coalesce(p_item, '')));
  v_note text := nullif(left(trim(coalesce(p_note, '')), 180), '');
  v_actor_email text := lower(trim(coalesce(p_actor_email, '')));
  v_actor_name text := left(trim(coalesce(p_actor_name, 'Keeper')), 80);
  v_affection_delta integer := 0;
  v_fullness_delta integer := 0;
  v_energy_delta integer := 0;
  v_comfort_delta integer := 0;
begin
  if v_action not in (
    'pat',
    'feed',
    'play',
    'groom',
    'nap',
    'talk',
    'boop',
    'cheer'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Unknown Shaymin care action.';
  end if;

  if v_actor_email = '' then
    raise exception using
      errcode = '22023',
      message = 'A verified administrator email is required.';
  end if;

  if v_action = 'feed' and v_item not in ('berry', 'poffin', 'tea') then
    raise exception using
      errcode = '22023',
      message = 'Choose berry, poffin or tea.';
  end if;

  if v_action = 'talk' and v_note is null then
    raise exception using
      errcode = '22023',
      message = 'A tiny care note is required.';
  end if;

  perform * from public.refresh_shaymin_care_state();

  if v_action = 'pat' then
    v_affection_delta := 4;
    v_energy_delta := 1;
    v_comfort_delta := 2;
  elsif v_action = 'boop' then
    v_affection_delta := 1;
    v_comfort_delta := 1;
  elsif v_action = 'play' then
    v_affection_delta := 8;
    v_fullness_delta := -3;
    v_energy_delta := -10;
    v_comfort_delta := 5;
  elsif v_action = 'groom' then
    v_affection_delta := 4;
    v_comfort_delta := 18;
  elsif v_action = 'nap' then
    v_fullness_delta := -4;
    v_energy_delta := 28;
    v_comfort_delta := 6;
  elsif v_action = 'talk' then
    v_affection_delta := 3;
    v_comfort_delta := 4;
  elsif v_action = 'cheer' then
    v_affection_delta := 2;
    v_energy_delta := 4;
  elsif v_action = 'feed' and v_item = 'berry' then
    v_affection_delta := 2;
    v_fullness_delta := 18;
  elsif v_action = 'feed' and v_item = 'poffin' then
    v_affection_delta := 7;
    v_fullness_delta := 12;
    v_comfort_delta := 3;
  elsif v_action = 'feed' and v_item = 'tea' then
    v_fullness_delta := 6;
    v_energy_delta := 5;
    v_comfort_delta := 14;
  end if;

  update public.shaymin_care_state as state
  set
    affection = greatest(0, least(100, state.affection + v_affection_delta)),
    fullness = greatest(0, least(100, state.fullness + v_fullness_delta)),
    energy = greatest(0, least(100, state.energy + v_energy_delta)),
    comfort = greatest(0, least(100, state.comfort + v_comfort_delta)),
    last_action = v_action,
    last_item = nullif(v_item, ''),
    last_actor_name = v_actor_name,
    last_actor_email = v_actor_email,
    last_action_at = v_now,
    last_decay_at = v_now,
    updated_at = v_now
  where state.id = 1;

  insert into public.shaymin_care_events (
    action,
    item,
    note,
    actor_name,
    actor_email,
    affection_delta,
    fullness_delta,
    energy_delta,
    comfort_delta,
    created_at
  )
  values (
    v_action,
    nullif(v_item, ''),
    v_note,
    v_actor_name,
    v_actor_email,
    v_affection_delta,
    v_fullness_delta,
    v_energy_delta,
    v_comfort_delta,
    v_now
  );

  return query
  select
    state.affection,
    state.fullness,
    state.energy,
    state.comfort,
    state.last_action,
    state.last_item,
    state.last_actor_name,
    state.last_actor_email,
    state.last_action_at,
    state.updated_at
  from public.shaymin_care_state as state
  where state.id = 1;
end;
$function$;

revoke all on function public.refresh_shaymin_care_state() from public, anon, authenticated;
revoke all on function public.care_for_shaymin(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.refresh_shaymin_care_state() to service_role;
grant execute on function public.care_for_shaymin(text, text, text, text, text) to service_role;

comment on table public.shaymin_care_state is
  'Shared persistent companion-care meters for the PocketPulls administrators.';

comment on table public.shaymin_care_events is
  'Shared care history for Lukas, Skye and any future authorised administrator.';

commit;
