-- ============================================================================
-- Cosmic Nebu: a permanent, independently rolled legendary mascot discovery.
-- This is intentionally attached to a completed player_wishes insert so it
-- never changes the card-selection/rarity system or the wish price.
-- ============================================================================

create sequence if not exists public.cosmic_nebu_issue_number_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create table if not exists public.cosmic_nebu_ownerships (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  issue_number bigint not null unique
    default nextval('public.cosmic_nebu_issue_number_seq'::regclass),
  discovery_pull_id uuid not null unique
    references public.player_wishes(id)
    on delete restrict,
  discovered_at timestamptz not null default now(),
  constraint cosmic_nebu_issue_number_positive check (issue_number > 0)
);

create table if not exists public.cosmic_nebu_rolls (
  pull_id uuid primary key
    references public.player_wishes(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  roll_value integer not null,
  won boolean not null default false,
  rolled_at timestamptz not null default now(),
  constraint cosmic_nebu_roll_value_range check (roll_value between 1 and 100000)
);

create index if not exists cosmic_nebu_ownerships_discovered_at_idx
  on public.cosmic_nebu_ownerships (discovered_at asc);

create index if not exists cosmic_nebu_rolls_user_id_idx
  on public.cosmic_nebu_rolls (user_id, rolled_at desc);

alter table public.cosmic_nebu_ownerships enable row level security;
alter table public.cosmic_nebu_rolls enable row level security;

drop policy if exists "Players can read their own Cosmic Nebu ownership" on public.cosmic_nebu_ownerships;
create policy "Players can read their own Cosmic Nebu ownership"
  on public.cosmic_nebu_ownerships
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read their own Cosmic Nebu rolls" on public.cosmic_nebu_rolls;
create policy "Players can read their own Cosmic Nebu rolls"
  on public.cosmic_nebu_rolls
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.roll_cosmic_nebu_after_wish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_roll integer;
begin
  -- Serialise concurrent wishes for this player so a discovered owner never
  -- receives another roll, even when two requests complete at the same time.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 910001));

  if exists (
    select 1
    from public.cosmic_nebu_ownerships
    where user_id = new.user_id
  ) then
    return new;
  end if;

  -- Exactly one independent 1-in-100,000 roll for this completed pull.
  v_roll := 1 + floor(random() * 100000)::integer;

  insert into public.cosmic_nebu_rolls (pull_id, user_id, roll_value, won)
  values (new.id, new.user_id, v_roll, v_roll = 1)
  on conflict (pull_id) do nothing;

  if v_roll = 1 then
    insert into public.cosmic_nebu_ownerships (user_id, discovery_pull_id)
    values (new.user_id, new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists player_wishes_roll_cosmic_nebu on public.player_wishes;
create trigger player_wishes_roll_cosmic_nebu
  after insert on public.player_wishes
  for each row
  execute function public.roll_cosmic_nebu_after_wish();

-- Public profile surfaces receive only the immutable number, never the roll
-- history or timestamps. The caller controls no redirects or gameplay state.
create or replace function public.get_public_cosmic_nebu_holders(
  p_user_ids uuid[]
)
returns table (
  user_id uuid,
  issue_number bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select ownerships.user_id, ownerships.issue_number
  from public.cosmic_nebu_ownerships as ownerships
  where ownerships.user_id = any(coalesce(p_user_ids, '{}'::uuid[]));
$function$;

grant execute on function public.get_public_cosmic_nebu_holders(uuid[]) to authenticated;
grant execute on function public.get_public_cosmic_nebu_holders(uuid[]) to anon;

comment on table public.cosmic_nebu_ownerships is
  'Permanent Cosmic Nebu discoveries. Issue numbers are chronological and never recycled.';
comment on table public.cosmic_nebu_rolls is
  'Immutable audit trail for the independent 1 in 100,000 Cosmic Nebu roll attached to each eligible completed wish.';
