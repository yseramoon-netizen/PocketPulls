begin;

create table if not exists public.shared_tree_state (
  id smallint primary key default 1,
  high_water_score bigint not null default 0,
  visit_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_visited_at timestamptz,
  constraint shared_tree_state_single_row check (id = 1),
  constraint shared_tree_state_non_negative_score check (high_water_score >= 0),
  constraint shared_tree_state_non_negative_visits check (visit_count >= 0)
);

insert into public.shared_tree_state (
  id,
  high_water_score,
  visit_count
)
values (
  1,
  0,
  0
)
on conflict (id) do nothing;

alter table public.shared_tree_state enable row level security;

revoke all on table public.shared_tree_state from public;
revoke all on table public.shared_tree_state from anon;
revoke all on table public.shared_tree_state from authenticated;
grant all on table public.shared_tree_state to service_role;

create or replace function public.record_shared_tree_growth(
  p_score bigint,
  p_count_visit boolean default false
)
returns table (
  high_water_score bigint,
  visit_count bigint,
  last_visited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.shared_tree_state (
    id,
    high_water_score,
    visit_count,
    last_visited_at,
    updated_at
  )
  values (
    1,
    greatest(0, coalesce(p_score, 0)),
    case when coalesce(p_count_visit, false) then 1 else 0 end,
    case when coalesce(p_count_visit, false) then now() else null end,
    now()
  )
  on conflict (id) do update
  set
    high_water_score = greatest(
      public.shared_tree_state.high_water_score,
      greatest(0, coalesce(excluded.high_water_score, 0))
    ),
    visit_count = public.shared_tree_state.visit_count +
      case when coalesce(p_count_visit, false) then 1 else 0 end,
    last_visited_at = case
      when coalesce(p_count_visit, false) then now()
      else public.shared_tree_state.last_visited_at
    end,
    updated_at = now();

  return query
  select
    state.high_water_score,
    state.visit_count,
    state.last_visited_at
  from public.shared_tree_state as state
  where state.id = 1;
end;
$function$;

revoke all on function public.record_shared_tree_growth(bigint, boolean) from public;
revoke all on function public.record_shared_tree_growth(bigint, boolean) from anon;
revoke all on function public.record_shared_tree_growth(bigint, boolean) from authenticated;
grant execute on function public.record_shared_tree_growth(bigint, boolean) to service_role;

comment on table public.shared_tree_state is
  'Private high-water growth state for Lukas and Skye''s hidden shared tree. The score never decreases when live stock changes.';

comment on function public.record_shared_tree_growth(bigint, boolean) is
  'Records the tree growth high-water mark and optionally counts a real hidden-garden visit. Callable only by the service role.';

commit;
