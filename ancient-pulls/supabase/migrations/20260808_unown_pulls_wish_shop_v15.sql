-- Unown Pulls Wish Shop V15
-- Server-authoritative wish pricing, first recharge reservation and idempotent crediting.

begin;

do $preflight$
begin
  if to_regclass('public.player_wallets') is null then
    raise exception 'public.player_wallets is missing. Apply the existing player-wallet migrations first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_wallets'
      and column_name = 'wish_balance'
  ) then
    raise exception 'public.player_wallets.wish_balance is missing.';
  end if;
end;
$preflight$;

create table if not exists public.wish_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  wishes integer not null check (wishes > 0),
  base_amount_pence integer not null check (base_amount_pence > 0),
  discount_pence integer not null default 0 check (discount_pence >= 0),
  amount_pence integer not null check (amount_pence > 0),
  currency text not null default 'gbp' check (currency = 'gbp'),
  first_recharge boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed', 'refunded')),
  stripe_checkout_session_id text,
  stripe_checkout_session_url text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists wish_purchase_orders_checkout_session_unique
  on public.wish_purchase_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists wish_purchase_orders_user_created_idx
  on public.wish_purchase_orders (user_id, created_at desc);

create index if not exists wish_purchase_orders_status_idx
  on public.wish_purchase_orders (status, created_at desc);

-- Only one active/paid first-recharge reservation may exist for a player.
-- Stripe Checkout sessions are created with a roughly 31-minute expiry; its signed webhook releases abandoned reservations.
create unique index if not exists wish_purchase_orders_first_recharge_guard
  on public.wish_purchase_orders (user_id)
  where first_recharge = true and status in ('pending', 'paid');

alter table public.wish_purchase_orders enable row level security;

revoke all on table public.wish_purchase_orders from anon, authenticated;

create or replace function public.complete_wish_purchase(
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order public.wish_purchase_orders%rowtype;
  v_balance integer;
begin
  if p_order_id is null or nullif(trim(p_checkout_session_id), '') is null then
    raise exception 'Wish purchase completion requires an order and checkout session.';
  end if;

  select *
  into v_order
  from public.wish_purchase_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Wish purchase order was not found.';
  end if;

  if v_order.stripe_checkout_session_id is null then
    raise exception 'Wish purchase order has no Stripe checkout session.';
  end if;

  if v_order.stripe_checkout_session_id <> p_checkout_session_id then
    raise exception 'Stripe checkout session does not match the wish order.';
  end if;

  -- Stripe can retry webhooks. Paid orders are deliberately idempotent.
  if v_order.status = 'paid' then
    select coalesce(wish_balance, 0)
    into v_balance
    from public.player_wallets
    where user_id = v_order.user_id;

    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'order_id', v_order.id,
      'wishes', v_order.wishes,
      'wish_balance', coalesce(v_balance, 0)
    );
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Wish purchase order cannot be completed from status %.', v_order.status;
  end if;

  update public.wish_purchase_orders
  set
    status = 'paid',
    stripe_payment_intent_id = nullif(trim(coalesce(p_payment_intent_id, '')), ''),
    paid_at = now(),
    updated_at = now()
  where id = v_order.id;

  update public.player_wallets
  set
    wish_balance = coalesce(wish_balance, 0) + v_order.wishes,
    updated_at = now()
  where user_id = v_order.user_id
  returning wish_balance into v_balance;

  if not found then
    insert into public.player_wallets (
      user_id,
      wish_balance,
      lifetime_wishes_spent,
      updated_at
    ) values (
      v_order.user_id,
      v_order.wishes,
      0,
      now()
    )
    returning wish_balance into v_balance;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'order_id', v_order.id,
    'wishes', v_order.wishes,
    'wish_balance', coalesce(v_balance, 0)
  );
end;
$function$;

revoke all on function public.complete_wish_purchase(uuid, text, text) from public;
grant execute on function public.complete_wish_purchase(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
