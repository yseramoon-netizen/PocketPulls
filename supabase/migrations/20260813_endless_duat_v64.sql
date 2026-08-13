-- Ancient Pulls: Nebu and the Endless Duat
-- Server-authoritative active time, forge fragments, daily wish claim and cloud progress.

create table if not exists public.player_duat_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_seconds bigint not null default 0 check (active_seconds >= 0),
  forge_fragments integer not null default 0 check (forge_fragments between 0 and 10),
  claim_day date,
  claims_today integer not null default 0 check (claims_today >= 0),
  last_heartbeat_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_duat_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_duat_wish_claims (
  idempotency_key uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  wish_balance integer not null,
  claimed_at timestamptz not null default now()
);

create index if not exists player_duat_wish_claims_user_idx
  on public.player_duat_wish_claims(user_id, claimed_at desc);

alter table public.player_duat_accounts enable row level security;
alter table public.player_duat_progress enable row level security;
alter table public.player_duat_wish_claims enable row level security;

revoke all on table public.player_duat_accounts from anon, authenticated;
revoke all on table public.player_duat_progress from anon, authenticated;
revoke all on table public.player_duat_wish_claims from anon, authenticated;
grant all on table public.player_duat_accounts to service_role;
grant all on table public.player_duat_progress to service_role;
grant all on table public.player_duat_wish_claims to service_role;

create or replace function public.record_endless_duat_heartbeat(
  p_user_id uuid,
  p_elapsed_seconds integer
)
returns table("activeSeconds" bigint, fragments integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.player_duat_accounts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_wall_seconds integer;
  v_credit integer;
begin
  if p_user_id is null then raise exception 'A player is required.'; end if;

  insert into public.player_duat_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.player_duat_accounts
  where user_id = p_user_id
  for update;

  v_wall_seconds := case
    when v_account.last_heartbeat_at is null then 30
    else greatest(0, floor(extract(epoch from (v_now - v_account.last_heartbeat_at)))::integer)
  end;
  v_credit := least(greatest(coalesce(p_elapsed_seconds, 0), 0), 45, v_wall_seconds);

  update public.player_duat_accounts
  set active_seconds = active_seconds + v_credit,
      last_heartbeat_at = v_now,
      updated_at = v_now
  where user_id = p_user_id
  returning active_seconds, forge_fragments into "activeSeconds", fragments;

  return next;
end;
$$;

create or replace function public.forge_endless_duat_fragment(p_user_id uuid)
returns table("activeSeconds" bigint, fragments integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.player_duat_accounts%rowtype;
begin
  insert into public.player_duat_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.player_duat_accounts
  where user_id = p_user_id
  for update;

  if v_account.forge_fragments >= 10 then
    raise exception 'Your fragment constellation is already complete.';
  end if;
  if v_account.active_seconds < 720 then
    raise exception 'Each fragment needs 12 minutes of verified active play.';
  end if;

  update public.player_duat_accounts
  set active_seconds = active_seconds - 720,
      forge_fragments = forge_fragments + 1,
      updated_at = now()
  where user_id = p_user_id
  returning active_seconds, forge_fragments into "activeSeconds", fragments;

  return next;
end;
$$;

create or replace function public.claim_endless_duat_wish(
  p_user_id uuid,
  p_idempotency_key uuid
)
returns table("wishBalance" integer, fragments integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.player_duat_accounts%rowtype;
  v_existing public.player_duat_wish_claims%rowtype;
  v_balance integer;
  v_today date := (now() at time zone 'utc')::date;
begin
  select * into v_existing
  from public.player_duat_wish_claims
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id <> p_user_id then raise exception 'This claim key belongs to another player.'; end if;
    "wishBalance" := v_existing.wish_balance;
    select forge_fragments into fragments from public.player_duat_accounts where user_id = p_user_id;
    return next;
    return;
  end if;

  insert into public.player_duat_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.player_duat_accounts
  where user_id = p_user_id
  for update;

  if v_account.forge_fragments < 10 then raise exception 'Ten verified fragments are required.'; end if;
  if v_account.claim_day = v_today and v_account.claims_today >= 1 then
    raise exception 'The free-wish constellation reforms tomorrow.';
  end if;

  insert into public.player_wallets(user_id, wish_balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.player_wallets
  set wish_balance = wish_balance + 1,
      lifetime_wishes_received = lifetime_wishes_received + 1,
      updated_at = now()
  where user_id = p_user_id
  returning wish_balance into v_balance;

  update public.player_duat_accounts
  set forge_fragments = forge_fragments - 10,
      claim_day = v_today,
      claims_today = case when claim_day = v_today then claims_today + 1 else 1 end,
      updated_at = now()
  where user_id = p_user_id
  returning forge_fragments into fragments;

  insert into public.player_duat_wish_claims(idempotency_key, user_id, wish_balance)
  values (p_idempotency_key, p_user_id, v_balance);

  "wishBalance" := v_balance;
  return next;
end;
$$;

revoke all on function public.record_endless_duat_heartbeat(uuid, integer) from public, anon, authenticated;
revoke all on function public.forge_endless_duat_fragment(uuid) from public, anon, authenticated;
revoke all on function public.claim_endless_duat_wish(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_endless_duat_heartbeat(uuid, integer) to service_role;
grant execute on function public.forge_endless_duat_fragment(uuid) to service_role;
grant execute on function public.claim_endless_duat_wish(uuid, uuid) to service_role;
