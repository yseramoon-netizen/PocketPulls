-- Ancient Pulls V66: production launch controls, exact fulfilment, support,
-- auditability and idempotent player operations.
--
-- This migration deliberately starts in Founder beta with paid orders closed.
-- Existing cards, wish history, balances, Cosmic Nebu ownership, trades and
-- shipments are preserved.

begin;

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass('public.player_wishes') is null
    or to_regclass('public.player_wallets') is null
    or to_regclass('public.player_inventory') is null
    or to_regclass('public.pokemon_cards') is null
    or to_regclass('public.inventory') is null
    or to_regclass('public.wish_pool_cards') is null
    or to_regclass('public.wish_rarity_tiers') is null
    or to_regclass('public.wish_fulfilment_obligations') is null
    or to_regclass('public.wish_purchase_orders') is null
    or to_regclass('public.player_shipping_config') is null
    or to_regclass('public.player_shipping_addresses_v2') is null
    or to_regclass('public.player_shipping_shipments') is null
    or to_regclass('public.player_shipping_shipment_items') is null
    or to_regclass('public.player_legal_consents') is null
    or to_regclass('public.player_trades') is null
    or to_regclass('public.player_trade_items') is null
    or to_regclass('public.admin_users') is null
    or to_regclass('public.admin_inventory_events') is null then
    raise exception using message =
      'V66 needs the existing player, wish-shop, virtual-pool and shipping migrations first.';
  end if;
end;
$preflight$;

-- -------------------------------------------------------------------------
-- PHYSICAL-CARD IDENTITY
-- -------------------------------------------------------------------------

alter table public.inventory
  add column if not exists card_condition text not null default 'near_mint',
  add column if not exists card_language text not null default 'English';

update public.inventory
set card_condition = case
  when lower(replace(btrim(coalesce(card_condition, '')), ' ', '_')) in
    ('mint', 'near_mint', 'excellent', 'good', 'played', 'poor')
    then lower(replace(btrim(card_condition), ' ', '_'))
  else 'near_mint'
end,
card_language = coalesce(nullif(btrim(card_language), ''), 'English');

alter table public.inventory
  drop constraint if exists inventory_card_condition_check;

alter table public.inventory
  add constraint inventory_card_condition_check check (
    card_condition in ('mint', 'near_mint', 'excellent', 'good', 'played', 'poor')
  );

alter table public.inventory
  drop constraint if exists inventory_card_language_length;

alter table public.inventory
  add constraint inventory_card_language_length check (
    char_length(card_language) between 2 and 40
  );

-- -------------------------------------------------------------------------
-- RELEASE CONTROLS AND FOUNDER BETA
-- -------------------------------------------------------------------------

create table if not exists public.launch_control_settings (
  id smallint primary key default 1,
  beta_mode boolean not null default true,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default '',
  purchases_enabled boolean not null default false,
  wishes_enabled boolean not null default true,
  trades_enabled boolean not null default true,
  shipping_enabled boolean not null default true,
  scanner_auto_write_enabled boolean not null default false,
  inventory_backed_wishes boolean not null default true,
  global_daily_revenue_limit_pence integer not null default 50000,
  default_daily_spend_limit_pence integer not null default 20000,
  default_daily_wish_limit integer not null default 250,
  legal_review_status text not null default 'pending',
  legal_review_reference text not null default '',
  legal_reviewed_at timestamptz,
  scanner_release_status text not null default 'shadow',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint launch_control_singleton check (id = 1),
  constraint launch_control_revenue_limit check (
    global_daily_revenue_limit_pence between 0 and 100000000
  ),
  constraint launch_control_spend_limit check (
    default_daily_spend_limit_pence between 0 and 10000000
  ),
  constraint launch_control_wish_limit check (
    default_daily_wish_limit between 1 and 10000
  ),
  constraint launch_control_legal_status check (
    legal_review_status in ('pending', 'approved', 'rejected', 'expired')
  ),
  constraint launch_control_scanner_status check (
    scanner_release_status in ('shadow', 'passed', 'blocked')
  ),
  constraint launch_control_maintenance_message_length check (
    char_length(maintenance_message) <= 500
  ),
  constraint launch_control_legal_reference_length check (
    char_length(legal_review_reference) <= 500
  )
);

insert into public.launch_control_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.launch_beta_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  active boolean not null default true,
  daily_spend_limit_pence integer,
  daily_wish_limit integer,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_beta_identity check (
    user_id is not null or nullif(btrim(coalesce(email, '')), '') is not null
  ),
  constraint launch_beta_email_length check (
    email is null or char_length(email) between 3 and 320
  ),
  constraint launch_beta_spend_limit check (
    daily_spend_limit_pence is null
    or daily_spend_limit_pence between 0 and 10000000
  ),
  constraint launch_beta_wish_limit check (
    daily_wish_limit is null or daily_wish_limit between 1 and 10000
  ),
  constraint launch_beta_notes_length check (char_length(notes) <= 500)
);

create unique index if not exists launch_beta_members_email_unique
  on public.launch_beta_members (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists launch_beta_members_active_idx
  on public.launch_beta_members (active, updated_at desc);

-- Every existing active administrator is a Founder beta member. This keeps
-- the current test accounts usable while new public accounts remain gated.
insert into public.launch_beta_members (user_id, email, active, notes)
select
  admins.user_id,
  lower(nullif(btrim(admins.email), '')),
  true,
  'Seeded from the active administrator list by V66.'
from public.admin_users as admins
where coalesce(admins.is_active, true) = true
  and (admins.user_id is not null or nullif(btrim(admins.email), '') is not null)
on conflict do nothing;

insert into public.launch_beta_members (email, active, notes)
values (
  'pullspocket@gmail.com',
  true,
  'Founder bootstrap account.'
)
on conflict do nothing;

alter table public.launch_control_settings enable row level security;
alter table public.launch_beta_members enable row level security;
revoke all on public.launch_control_settings from anon, authenticated;
revoke all on public.launch_beta_members from anon, authenticated;
grant all on public.launch_control_settings to service_role;

create or replace function public.get_player_launch_state()
returns table (
  maintenance_mode boolean,
  maintenance_message text,
  beta_mode boolean,
  purchases_enabled boolean,
  wishes_enabled boolean,
  trades_enabled boolean,
  shipping_enabled boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    settings.maintenance_mode,
    settings.maintenance_message,
    settings.beta_mode,
    settings.purchases_enabled,
    settings.wishes_enabled,
    settings.trades_enabled,
    settings.shipping_enabled
  from public.launch_control_settings as settings
  where settings.id = 1;
$function$;

revoke all on function public.get_player_launch_state() from public;
grant execute on function public.get_player_launch_state() to authenticated;

-- Materially changed inventory-backed terms require a fresh account-level
-- acknowledgement. Earlier consent rows remain as historical evidence.
create or replace function public.get_player_purchase_consent()
returns table (
  accepted boolean,
  consent_version text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    coalesce(
      consent.age_18_confirmed
      and consent.random_physical_card_ack
      and consent.terms_ack,
      false
    ),
    '2026-08-27-v2'::text,
    consent.accepted_at
  from (select auth.uid() as user_id) as current_player
  left join public.player_legal_consents as consent
    on consent.user_id = current_player.user_id
    and consent.consent_version = '2026-08-27-v2'
  limit 1;
$function$;

create or replace function public.accept_player_purchase_consent(
  p_age_18 boolean,
  p_random_physical_card boolean,
  p_terms boolean
)
returns table (
  accepted boolean,
  consent_version text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;
  if p_age_18 is not true
    or p_random_physical_card is not true
    or p_terms is not true then
    raise exception using message = 'All purchase acknowledgements must be accepted.';
  end if;

  insert into public.player_legal_consents (
    user_id, consent_version, age_18_confirmed,
    random_physical_card_ack, terms_ack, source, accepted_at
  ) values (
    v_user_id, '2026-08-27-v2', true, true, true,
    'inventory_backed_account_gate', v_accepted_at
  )
  on conflict (user_id, consent_version) do update set
    age_18_confirmed = true,
    random_physical_card_ack = true,
    terms_ack = true,
    source = excluded.source,
    accepted_at = excluded.accepted_at;

  return query select true, '2026-08-27-v2'::text, v_accepted_at;
end;
$function$;

revoke all on function public.get_player_purchase_consent() from public;
revoke all on function public.accept_player_purchase_consent(boolean, boolean, boolean) from public;
grant execute on function public.get_player_purchase_consent() to authenticated;
grant execute on function public.accept_player_purchase_consent(boolean, boolean, boolean) to authenticated;
grant all on public.launch_beta_members to service_role;

-- -------------------------------------------------------------------------
-- IMMUTABLE OPERATIONS AND ADMIN AUDIT LEDGERS
-- -------------------------------------------------------------------------

create table if not exists public.operations_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid,
  actor_email text,
  player_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  amount_pence integer,
  quantity integer,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operations_event_type_length check (
    char_length(event_type) between 3 and 100
  ),
  constraint operations_entity_type_length check (
    char_length(entity_type) between 2 and 80
  ),
  constraint operations_entity_id_length check (
    char_length(entity_id) between 1 and 300
  ),
  constraint operations_idempotency_length check (
    char_length(idempotency_key) between 3 and 500
  )
);

create index if not exists operations_events_created_idx
  on public.operations_events (created_at desc);
create index if not exists operations_events_player_idx
  on public.operations_events (player_user_id, created_at desc);
create index if not exists operations_events_entity_idx
  on public.operations_events (entity_type, entity_id, created_at desc);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_email_length check (
    char_length(admin_email) between 3 and 320
  ),
  constraint admin_audit_action_length check (
    char_length(action) between 3 and 100
  ),
  constraint admin_audit_target_length check (
    char_length(target_type) between 2 and 80
  )
);

create index if not exists admin_audit_events_created_idx
  on public.admin_audit_events (created_at desc);
create index if not exists admin_audit_events_actor_idx
  on public.admin_audit_events (admin_user_id, created_at desc);

alter table public.operations_events enable row level security;
alter table public.admin_audit_events enable row level security;
revoke all on public.operations_events from anon, authenticated;
revoke all on public.admin_audit_events from anon, authenticated;
grant insert, select on public.operations_events to service_role;
grant insert, select on public.admin_audit_events to service_role;

create or replace function public.prevent_immutable_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  raise exception using message = 'Operational audit records are immutable.';
end;
$function$;

drop trigger if exists operations_events_immutable on public.operations_events;
create trigger operations_events_immutable
  before update or delete on public.operations_events
  for each row execute function public.prevent_immutable_event_mutation();

drop trigger if exists admin_audit_events_immutable on public.admin_audit_events;
create trigger admin_audit_events_immutable
  before update or delete on public.admin_audit_events
  for each row execute function public.prevent_immutable_event_mutation();

-- -------------------------------------------------------------------------
-- STRIPE EVENT JOURNAL AND REPEAT-SAFE CHECKOUT REQUESTS
-- -------------------------------------------------------------------------

alter table public.wish_purchase_orders
  add column if not exists client_request_id text,
  add column if not exists failure_reason text,
  add column if not exists last_stripe_event_id text;

alter table public.wish_purchase_orders
  drop constraint if exists wish_purchase_orders_status_check;

alter table public.wish_purchase_orders
  add constraint wish_purchase_orders_status_check check (
    status in ('pending', 'paid', 'expired', 'failed', 'refunded', 'partially_refunded', 'disputed')
  );

create unique index if not exists wish_purchase_orders_client_request_unique
  on public.wish_purchase_orders (user_id, client_request_id)
  where client_request_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processing_status text not null default 'processing',
  attempt_count integer not null default 1,
  order_id uuid references public.wish_purchase_orders(id) on delete set null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint stripe_event_status_check check (
    processing_status in ('processing', 'processed', 'failed', 'ignored')
  ),
  constraint stripe_event_attempts_positive check (attempt_count > 0)
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (processing_status, received_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

create or replace function public.begin_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_event public.stripe_webhook_events%rowtype;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null
    or nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception using message = 'Stripe event ID and type are required.';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type)
  values (left(btrim(p_event_id), 255), left(btrim(p_event_type), 255))
  on conflict (event_id) do nothing;

  if found then
    return true;
  end if;

  select * into v_event
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if v_event.processing_status in ('processed', 'ignored') then
    return false;
  end if;

  if v_event.processing_status = 'processing'
    and v_event.updated_at > now() - interval '2 minutes' then
    return false;
  end if;

  update public.stripe_webhook_events
  set
    processing_status = 'processing',
    attempt_count = attempt_count + 1,
    error_message = null,
    updated_at = now()
  where event_id = p_event_id;

  return true;
end;
$function$;

revoke all on function public.begin_stripe_webhook_event(text, text)
  from public, anon, authenticated;
grant execute on function public.begin_stripe_webhook_event(text, text)
  to service_role;

-- One transaction owns scanner/manual intake, the quantity change and its
-- immutable audit row. A retried mobile request returns the first result.
alter table public.admin_inventory_events
  add column if not exists idempotency_key text;

create unique index if not exists admin_inventory_events_idempotency_unique
  on public.admin_inventory_events (idempotency_key)
  where idempotency_key is not null;

create or replace function public.admin_add_inventory_idempotent(
  p_admin_user_id uuid,
  p_admin_email text,
  p_card_id text,
  p_quantity integer,
  p_location text,
  p_finish text,
  p_card_condition text,
  p_card_language text,
  p_idempotency_key text,
  p_source text default 'manual'
)
returns table (
  inventory_id text,
  card_id text,
  card_name text,
  quantity_added integer,
  final_quantity integer,
  location text,
  finish text,
  card_condition text,
  card_language text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings public.launch_control_settings%rowtype;
  v_existing_event public.admin_inventory_events%rowtype;
  v_inventory_id text;
  v_current_quantity integer;
  v_final_quantity integer;
  v_card_name text;
  v_card_id_type text;
  v_has_added_by_user_id boolean;
  v_email text := lower(btrim(coalesce(p_admin_email, '')));
  v_location text := left(coalesce(nullif(btrim(p_location), ''), 'Main Inventory'), 160);
  v_finish text := lower(btrim(coalesce(p_finish, 'normal')));
  v_condition text := lower(replace(btrim(coalesce(p_card_condition, 'near_mint')), ' ', '_'));
  v_language text := left(coalesce(nullif(btrim(p_card_language), ''), 'English'), 40);
  v_request_key text := btrim(coalesce(p_idempotency_key, ''));
  v_source text := lower(btrim(coalesce(p_source, 'manual')));
begin
  if p_admin_user_id is null or v_email = '' then
    raise exception using message = 'A verified administrator is required.';
  end if;
  if nullif(btrim(coalesce(p_card_id, '')), '') is null then
    raise exception using message = 'Choose a catalogue card.';
  end if;
  if p_quantity not between 1 and 9999 then
    raise exception using message = 'Inventory quantity must be 1-9999.';
  end if;
  if v_finish not in ('normal', 'holo', 'reverse_holo') then
    raise exception using message = 'Choose a valid card finish.';
  end if;
  if v_condition not in ('mint', 'near_mint', 'excellent', 'good', 'played', 'poor') then
    raise exception using message = 'Choose a valid card condition.';
  end if;
  if v_request_key !~ '^[A-Za-z0-9:_-]{16,160}$' then
    raise exception using message = 'Inventory request ID is invalid.';
  end if;
  if v_source not in ('manual', 'scanner', 'scanner_review', 'import') then
    raise exception using message = 'Inventory source is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request_key, 660003));

  select events.* into v_existing_event
  from public.admin_inventory_events as events
  where events.idempotency_key = v_request_key
  limit 1;

  if found then
    return query select
      v_existing_event.inventory_id,
      v_existing_event.card_id,
      coalesce(v_existing_event.metadata->>'card_name', 'Unknown card'),
      v_existing_event.quantity_delta,
      v_existing_event.final_quantity,
      coalesce(v_existing_event.metadata->>'location', 'Main Inventory'),
      coalesce(v_existing_event.finish, 'normal'),
      coalesce(v_existing_event.metadata->>'card_condition', 'near_mint'),
      coalesce(v_existing_event.metadata->>'card_language', 'English');
    return;
  end if;

  if v_source = 'scanner' then
    select * into v_settings
    from public.launch_control_settings
    where id = 1
    for share;

    if not v_settings.scanner_auto_write_enabled
      or v_settings.scanner_release_status <> 'passed' then
      raise exception using message =
        'Scanner automatic inventory writes are locked until the release benchmark passes.';
    end if;
  end if;

  select coalesce(nullif(btrim(cards.name), ''), 'Unknown card')
  into v_card_name
  from public.pokemon_cards as cards
  where cards.id::text = p_card_id
  limit 1;

  if not found then
    raise exception using message = 'That card is not in the canonical catalogue.';
  end if;

  select stock.id::text, coalesce(stock.quantity, 0)
  into v_inventory_id, v_current_quantity
  from public.inventory as stock
  where stock.card_id::text = p_card_id
    and stock.finish = v_finish
    and stock.card_condition = v_condition
    and lower(stock.card_language) = lower(v_language)
    and stock.location = v_location
  order by stock.created_at asc, stock.id::text asc
  limit 1
  for update;

  if v_inventory_id is not null then
    v_final_quantity := v_current_quantity + p_quantity;
    update public.inventory as stock
    set
      quantity = v_final_quantity,
      status = 'in_stock',
      added_by = v_email,
      card_language = v_language
    where stock.id::text = v_inventory_id;
  else
    select format_type(attribute.atttypid, attribute.atttypmod)
    into v_card_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.inventory'::regclass
      and attribute.attname = 'card_id'
      and not attribute.attisdropped;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'inventory'
        and column_name = 'added_by_user_id'
    ) into v_has_added_by_user_id;

    v_final_quantity := p_quantity;
    if v_has_added_by_user_id then
      execute 'insert into public.inventory '
        || '(card_id, quantity, location, status, finish, card_condition, card_language, added_by, added_by_user_id) '
        || 'values ($1::' || v_card_id_type || ', $2, $3, ''in_stock'', $4, $5, $6, $7, $8) '
        || 'returning id::text'
      into v_inventory_id
      using p_card_id, p_quantity, v_location, v_finish, v_condition,
        v_language, v_email, p_admin_user_id;
    else
      execute 'insert into public.inventory '
        || '(card_id, quantity, location, status, finish, card_condition, card_language, added_by) '
        || 'values ($1::' || v_card_id_type || ', $2, $3, ''in_stock'', $4, $5, $6, $7) '
        || 'returning id::text'
      into v_inventory_id
      using p_card_id, p_quantity, v_location, v_finish, v_condition,
        v_language, v_email;
    end if;
  end if;

  insert into public.admin_inventory_events (
    admin_user_id, admin_email, inventory_id, card_id, finish,
    quantity_delta, final_quantity, event_type, idempotency_key, metadata
  ) values (
    p_admin_user_id, v_email, v_inventory_id, p_card_id, v_finish,
    p_quantity, v_final_quantity, 'inventory_add', v_request_key,
    jsonb_build_object(
      'card_name', v_card_name,
      'location', v_location,
      'card_condition', v_condition,
      'card_language', v_language,
      'source', v_source
    )
  );

  return query select
    v_inventory_id,
    p_card_id,
    v_card_name,
    p_quantity,
    v_final_quantity,
    v_location,
    v_finish,
    v_condition,
    v_language;
end;
$function$;

revoke all on function public.admin_add_inventory_idempotent(
  uuid, text, text, integer, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_add_inventory_idempotent(
  uuid, text, text, integer, text, text, text, text, text, text
) to service_role;

-- The checkout reservation and its spend-limit checks are one transaction.
create or replace function public.create_guarded_wish_purchase_order(
  p_user_id uuid,
  p_email text,
  p_package_id text,
  p_wishes integer,
  p_base_amount_pence integer,
  p_first_recharge_amount_pence integer,
  p_client_request_id text
)
returns table (
  order_id uuid,
  first_recharge boolean,
  amount_pence integer,
  existing_checkout_url text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings public.launch_control_settings%rowtype;
  v_member public.launch_beta_members%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_first boolean;
  v_amount integer;
  v_today_spend bigint;
  v_global_today bigint;
  v_user_limit integer;
  v_existing public.wish_purchase_orders%rowtype;
begin
  if p_user_id is null then
    raise exception using message = 'A verified player is required for checkout.';
  end if;

  if p_wishes < 1 or p_base_amount_pence < 1
    or p_first_recharge_amount_pence < 1 then
    raise exception using message = 'The selected wish package is invalid.';
  end if;

  if v_request_id !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception using message = 'Checkout request ID is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 660001));

  select * into v_existing
  from public.wish_purchase_orders as orders
  where orders.user_id = p_user_id
    and orders.client_request_id = v_request_id
  limit 1;

  if found then
    return query select
      v_existing.id,
      v_existing.first_recharge,
      v_existing.amount_pence,
      v_existing.stripe_checkout_session_url;
    return;
  end if;

  select * into v_settings
  from public.launch_control_settings
  where id = 1
  for update;

  if v_settings.maintenance_mode then
    raise exception using message = coalesce(
      nullif(v_settings.maintenance_message, ''),
      'Ancient Pulls is temporarily paused for maintenance.'
    );
  end if;

  if not v_settings.purchases_enabled then
    raise exception using message = 'Paid orders are currently closed by Launch Control.';
  end if;

  if v_settings.legal_review_status <> 'approved'
    or nullif(btrim(v_settings.legal_review_reference), '') is null then
    raise exception using message =
      'Paid orders remain closed until the independent legal review is recorded.';
  end if;

  if v_settings.scanner_release_status <> 'passed' then
    raise exception using message =
      'Paid orders remain closed until the scanner acceptance benchmark passes.';
  end if;

  select * into v_member
  from public.launch_beta_members as members
  where members.active = true
    and (
      members.user_id = p_user_id
      or (
        members.email is not null
        and lower(btrim(members.email)) = v_email
      )
    )
  order by (members.user_id = p_user_id) desc
  limit 1;

  if v_settings.beta_mode and v_member.id is null then
    raise exception using message = 'This account is not in the Founder beta yet.';
  end if;

  select not exists (
    select 1
    from public.wish_purchase_orders as orders
    where orders.user_id = p_user_id
      and (
        orders.status = 'paid'
        or (orders.first_recharge and orders.status = 'pending')
      )
  ) into v_first;

  v_amount := case
    when v_first then p_first_recharge_amount_pence
    else p_base_amount_pence
  end;

  v_user_limit := coalesce(
    v_member.daily_spend_limit_pence,
    v_settings.default_daily_spend_limit_pence
  );

  select coalesce(sum(orders.amount_pence), 0)::bigint
  into v_today_spend
  from public.wish_purchase_orders as orders
  where orders.user_id = p_user_id
    and orders.created_at >= date_trunc('day', now())
    and orders.status in ('pending', 'paid');

  if v_user_limit > 0 and v_today_spend + v_amount > v_user_limit then
    raise exception using message = 'This purchase would exceed the account daily spending limit.';
  end if;

  select coalesce(sum(orders.amount_pence), 0)::bigint
  into v_global_today
  from public.wish_purchase_orders as orders
  where orders.created_at >= date_trunc('day', now())
    and orders.status in ('pending', 'paid');

  if v_settings.global_daily_revenue_limit_pence > 0
    and v_global_today + v_amount > v_settings.global_daily_revenue_limit_pence then
    raise exception using message = 'Ancient Pulls has reached today''s controlled launch limit.';
  end if;

  insert into public.wish_purchase_orders (
    user_id,
    package_id,
    wishes,
    base_amount_pence,
    discount_pence,
    amount_pence,
    currency,
    first_recharge,
    status,
    client_request_id
  ) values (
    p_user_id,
    left(btrim(p_package_id), 80),
    p_wishes,
    p_base_amount_pence,
    greatest(0, p_base_amount_pence - v_amount),
    v_amount,
    'gbp',
    v_first,
    'pending',
    v_request_id
  )
  returning id into order_id;

  first_recharge := v_first;
  amount_pence := v_amount;
  existing_checkout_url := null;
  return next;
end;
$function$;

revoke all on function public.create_guarded_wish_purchase_order(
  uuid, text, text, integer, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.create_guarded_wish_purchase_order(
  uuid, text, text, integer, integer, integer, text
) to service_role;

-- -------------------------------------------------------------------------
-- REPEAT-SAFE, INVENTORY-BACKED WISHES
-- -------------------------------------------------------------------------

-- Older wish rows pre-date the physical fulfilment ledger. They are retained
-- but explicitly surfaced as reconciliation debt instead of being treated as
-- physically backed without evidence.
insert into public.wish_fulfilment_obligations (
  wish_id, user_id, card_id, status, physical_inventory_id
)
select
  wishes.id::text,
  wishes.user_id,
  wishes.card_id::text,
  'source_needed',
  null
from public.player_wishes as wishes
where not exists (
  select 1 from public.wish_fulfilment_obligations as obligation
  where obligation.wish_id = wishes.id::text
)
on conflict (wish_id) do nothing;

create table if not exists public.player_wish_requests (
  idempotency_key uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'processing',
  wish_id text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint player_wish_request_status_check check (
    status in ('processing', 'completed')
  )
);

create index if not exists player_wish_requests_user_idx
  on public.player_wish_requests (user_id, created_at desc);

alter table public.player_wish_requests enable row level security;
revoke all on public.player_wish_requests from anon, authenticated;
grant all on public.player_wish_requests to service_role;

create or replace function public.make_player_wish(
  p_idempotency_key uuid
)
returns table (
  wish_id text,
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  wish_balance integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_settings public.launch_control_settings%rowtype;
  v_member public.launch_beta_members%rowtype;
  v_current_balance integer;
  v_new_balance integer;
  v_daily_wishes integer;
  v_daily_limit integer;
  v_rarity_tier text;
  v_selected_card_id text;
  v_inventory_id text;
  v_inventory_id_type text;
  v_wish_card_id_type text;
  v_player_card_id_type text;
  v_wish_id text;
  v_remaining_quantity integer;
  v_player_inventory_updated integer;
  v_name text;
  v_set_name text;
  v_card_no text;
  v_rarity text;
  v_market_value numeric;
  v_image_url text;
  v_existing_wish_id text;
  v_insert_columns text;
  v_insert_values text;
  v_sql text;
  v_attempt integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in to make a wish.';
  end if;

  if p_idempotency_key is null then
    raise exception using message = 'A wish request ID is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 660002));

  select requests.wish_id
  into v_existing_wish_id
  from public.player_wish_requests as requests
  where requests.idempotency_key = p_idempotency_key
    and requests.user_id = v_user_id
    and requests.status = 'completed';

  if v_existing_wish_id is not null then
    return query
    select
      wishes.id::text,
      cards.id::text,
      coalesce(cards.name, 'Mystery card'),
      coalesce(cards.set_name, 'Unknown set'),
      cards.card_no,
      coalesce(cards.rarity, 'Common'),
      coalesce(wishes.market_value_at_wish, cards.market_value, 0)::numeric,
      cards.image_url,
      coalesce(wallet.wish_balance, 0)::integer
    from public.player_wishes as wishes
    join public.pokemon_cards as cards
      on cards.id::text = wishes.card_id::text
    join public.player_wallets as wallet
      on wallet.user_id = wishes.user_id
    where wishes.id::text = v_existing_wish_id
      and wishes.user_id = v_user_id
    limit 1;
    return;
  end if;

  insert into public.player_wish_requests (idempotency_key, user_id)
  values (p_idempotency_key, v_user_id)
  on conflict (idempotency_key) do nothing;

  if not found then
    raise exception using message = 'That wish request belongs to a different account or is incomplete.';
  end if;

  select lower(coalesce(users.email, ''))
  into v_email
  from auth.users as users
  where users.id = v_user_id;

  select * into v_settings
  from public.launch_control_settings
  where id = 1;

  if v_settings.maintenance_mode then
    raise exception using message = coalesce(
      nullif(v_settings.maintenance_message, ''),
      'Ancient Pulls is temporarily paused for maintenance.'
    );
  end if;

  if not v_settings.wishes_enabled then
    raise exception using message = 'Wishes are currently paused by Launch Control.';
  end if;

  if not v_settings.inventory_backed_wishes then
    raise exception using message = 'Inventory-backed wish protection must remain enabled.';
  end if;

  select * into v_member
  from public.launch_beta_members as members
  where members.active = true
    and (
      members.user_id = v_user_id
      or (members.email is not null and lower(btrim(members.email)) = v_email)
    )
  order by (members.user_id = v_user_id) desc
  limit 1;

  if v_settings.beta_mode and v_member.id is null then
    raise exception using message = 'This account is not in the Founder beta yet.';
  end if;

  v_daily_limit := coalesce(v_member.daily_wish_limit, v_settings.default_daily_wish_limit);

  select count(*)::integer
  into v_daily_wishes
  from public.player_wishes as wishes
  where wishes.user_id = v_user_id
    and wishes.created_at >= date_trunc('day', now());

  if v_daily_wishes >= v_daily_limit then
    raise exception using message = 'You have reached the controlled daily wish limit.';
  end if;

  select coalesce(wallet.wish_balance, 0)
  into v_current_balance
  from public.player_wallets as wallet
  where wallet.user_id = v_user_id
  for update;

  if not found then
    raise exception using message = 'Your wish wallet does not exist.';
  end if;

  if v_current_balance < 1 then
    raise exception using message = 'You do not have enough wishes.';
  end if;

  -- A concurrent wish can consume the final copy after rarity selection. Retry
  -- the complete selection a bounded number of times instead of allocating an
  -- unowned card or silently changing the selected result.
  while v_attempt < 8 and v_inventory_id is null loop
    v_attempt := v_attempt + 1;

    select candidate.rarity_tier
    into v_rarity_tier
    from (
      select tiers.rarity_tier, tiers.weight
      from public.wish_rarity_tiers as tiers
      where tiers.enabled = true
        and tiers.weight > 0
        and exists (
          select 1
          from public.wish_pool_cards as pool
          join public.inventory as stock
            on stock.card_id::text = pool.card_id
            and coalesce(stock.quantity, 0) > 0
          where pool.rarity_tier = tiers.rarity_tier
            and pool.enabled = true
        )
    ) as candidate
    order by -ln(greatest(random(), 0.0000001)) / candidate.weight
    limit 1;

    if v_rarity_tier is null then
      raise exception using message = 'No physically backed cards are currently available to wish for.';
    end if;

    select pool.card_id
    into v_selected_card_id
    from public.wish_pool_cards as pool
    where pool.rarity_tier = v_rarity_tier
      and pool.enabled = true
      and exists (
        select 1
        from public.inventory as stock
        where stock.card_id::text = pool.card_id
          and coalesce(stock.quantity, 0) > 0
      )
    order by random()
    limit 1;

    if v_selected_card_id is not null then
      select stock.id::text
      into v_inventory_id
      from public.inventory as stock
      where stock.card_id::text = v_selected_card_id
        and coalesce(stock.quantity, 0) > 0
      order by stock.quantity desc, stock.id::text asc
      limit 1
      for update skip locked;
    end if;
  end loop;

  if v_inventory_id is null or v_selected_card_id is null then
    raise exception using message = 'Physical stock changed during the wish. Try again; no wish was spent.';
  end if;

  select
    cards.name,
    cards.set_name,
    cards.card_no,
    cards.rarity,
    coalesce(cards.market_value, 0),
    cards.image_url
  into
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url
  from public.pokemon_cards as cards
  where cards.id::text = v_selected_card_id
  limit 1;

  if not found then
    raise exception using message = 'The selected card is missing from the canonical catalogue.';
  end if;

  execute $stock_update$
    update public.inventory
    set quantity = quantity - 1
    where id::text = $1 and quantity > 0
    returning quantity
  $stock_update$
  into v_remaining_quantity
  using v_inventory_id;

  if v_remaining_quantity is null then
    raise exception using message = 'Physical stock changed during the wish. Try again; no wish was spent.';
  end if;

  update public.player_wallets as wallet
  set
    wish_balance = wallet.wish_balance - 1,
    lifetime_wishes_spent = coalesce(wallet.lifetime_wishes_spent, 0) + 1,
    updated_at = now()
  where wallet.user_id = v_user_id
  returning wallet.wish_balance into v_new_balance;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_wish_card_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.player_wishes'::regclass
    and attribute.attname = 'card_id'
    and not attribute.attisdropped;

  v_insert_columns := 'user_id, card_id, market_value_at_wish';
  v_insert_values := '$1, ' || quote_literal(v_selected_card_id) || '::'
    || v_wish_card_id_type || ', $2';

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_inventory_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.player_wishes'::regclass
    and attribute.attname = 'inventory_id'
    and not attribute.attisdropped;

  if v_inventory_id_type is not null then
    v_insert_columns := v_insert_columns || ', inventory_id';
    v_insert_values := v_insert_values || ', ' || quote_literal(v_inventory_id)
      || '::' || v_inventory_id_type;
  end if;

  v_sql := 'insert into public.player_wishes (' || v_insert_columns
    || ') values (' || v_insert_values || ') returning id::text';
  execute v_sql into v_wish_id using v_user_id, v_market_value;

  insert into public.wish_fulfilment_obligations (
    wish_id,
    user_id,
    card_id,
    status,
    physical_inventory_id
  ) values (
    v_wish_id,
    v_user_id,
    v_selected_card_id,
    'ready',
    v_inventory_id
  );

  execute $player_inventory_update$
    update public.player_inventory
    set quantity = coalesce(quantity, 0) + 1
    where user_id = $1 and card_id::text = $2
  $player_inventory_update$
  using v_user_id, v_selected_card_id;

  get diagnostics v_player_inventory_updated = row_count;

  if v_player_inventory_updated = 0 then
    select format_type(attribute.atttypid, attribute.atttypmod)
    into v_player_card_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.player_inventory'::regclass
      and attribute.attname = 'card_id'
      and not attribute.attisdropped;

    v_sql := 'insert into public.player_inventory '
      || '(user_id, card_id, quantity, reserved_quantity) values ($1, '
      || quote_literal(v_selected_card_id) || '::' || v_player_card_id_type
      || ', 1, 0)';
    execute v_sql using v_user_id;
  end if;

  update public.player_wish_requests
  set status = 'completed', wish_id = v_wish_id, completed_at = now()
  where idempotency_key = p_idempotency_key and user_id = v_user_id;

  return query select
    v_wish_id,
    v_selected_card_id,
    coalesce(v_name, 'Mystery card'),
    coalesce(v_set_name, 'Unknown set'),
    v_card_no,
    coalesce(v_rarity, 'Common'),
    coalesce(v_market_value, 0),
    v_image_url,
    v_new_balance;
end;
$function$;

-- Compatibility wrapper for older clients. The production player page uses
-- the UUID overload so retries return the same completed wish.
create or replace function public.make_player_wish()
returns table (
  wish_id text,
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  market_value numeric,
  image_url text,
  wish_balance integer
)
language sql
security definer
set search_path = public, pg_temp
as $function$
  select * from public.make_player_wish(gen_random_uuid());
$function$;

revoke all on function public.make_player_wish(uuid) from public;
revoke all on function public.make_player_wish() from public;
grant execute on function public.make_player_wish(uuid) to authenticated;
grant execute on function public.make_player_wish() to authenticated;

-- Live odds and chase cards now describe only cards that can actually be
-- fulfilled from held physical inventory.
create or replace function public.get_player_wish_odds()
returns table (
  rarity text,
  cards_in_pool bigint,
  chance_percent numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with backed_cards as (
    select distinct pool.card_id, pool.rarity_tier
    from public.wish_pool_cards as pool
    join public.inventory as stock
      on stock.card_id::text = pool.card_id
      and coalesce(stock.quantity, 0) > 0
    where pool.enabled = true
  ), counts as (
    select backed.rarity_tier, count(*)::bigint as card_count
    from backed_cards as backed
    group by backed.rarity_tier
  ), active as (
    select tiers.display_name, tiers.weight, tiers.sort_order, counts.card_count
    from public.wish_rarity_tiers as tiers
    join counts on counts.rarity_tier = tiers.rarity_tier
    where tiers.enabled = true and tiers.weight > 0 and counts.card_count > 0
  ), totals as (
    select coalesce(sum(weight), 0)::numeric as total_weight from active
  )
  select
    active.display_name,
    active.card_count,
    case when totals.total_weight > 0
      then round((active.weight / totals.total_weight) * 100, 6)
      else 0::numeric
    end
  from active cross join totals
  order by active.sort_order, active.display_name;
$function$;

revoke all on function public.get_player_wish_odds() from public;
grant execute on function public.get_player_wish_odds() to authenticated;

create or replace function public.get_player_wish_chase_cards(
  p_limit integer default 5
)
returns table (
  card_id text,
  name text,
  set_name text,
  card_no text,
  rarity text,
  rarity_tier text,
  rarity_display_name text,
  market_value numeric,
  image_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    cards.id::text,
    coalesce(nullif(btrim(cards.name), ''), 'Mystery card'),
    coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set'),
    nullif(btrim(cards.card_no), ''),
    coalesce(nullif(btrim(cards.rarity), ''), tiers.display_name),
    pool.rarity_tier,
    tiers.display_name,
    greatest(coalesce(cards.market_value, 0), 0)::numeric,
    nullif(btrim(cards.image_url), '')
  from public.wish_pool_cards as pool
  join public.wish_rarity_tiers as tiers
    on tiers.rarity_tier = pool.rarity_tier
  join public.pokemon_cards as cards
    on cards.id::text = pool.card_id
  where pool.enabled = true
    and tiers.enabled = true
    and tiers.weight > 0
    and exists (
      select 1
      from public.inventory as stock
      where stock.card_id::text = pool.card_id
        and coalesce(stock.quantity, 0) > 0
    )
  order by
    greatest(coalesce(cards.market_value, 0), 0) desc,
    cards.name asc,
    cards.id::text asc
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$function$;

revoke all on function public.get_player_wish_chase_cards(integer) from public;
grant execute on function public.get_player_wish_chase_cards(integer) to authenticated;

-- -------------------------------------------------------------------------
-- PLAYER SUPPORT INBOX WITH PRIVATE PHOTO ATTACHMENTS
-- -------------------------------------------------------------------------

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  related_wish_id text,
  related_order_id uuid references public.wish_purchase_orders(id) on delete set null,
  related_shipment_id uuid references public.player_shipping_shipments(id) on delete set null,
  last_message_at timestamptz not null default now(),
  player_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_ticket_category_check check (
    category in ('wrong_card', 'payment', 'shipping', 'damaged', 'missing', 'account', 'other')
  ),
  constraint support_ticket_status_check check (
    status in ('open', 'waiting_admin', 'waiting_player', 'resolved', 'closed')
  ),
  constraint support_ticket_priority_check check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint support_ticket_subject_length check (
    char_length(subject) between 5 and 120
  )
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_queue_idx
  on public.support_tickets (status, priority, last_message_at);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null,
  admin_email text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_message_role_check check (
    sender_role in ('player', 'admin', 'system')
  ),
  constraint support_message_body_length check (
    char_length(body) between 1 and 4000
  )
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid not null references public.support_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint support_attachment_type_check check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint support_attachment_size_check check (
    size_bytes between 1 and 8388608
  ),
  constraint support_attachment_path_length check (
    char_length(storage_path) between 10 and 600
  )
);

create index if not exists support_attachments_message_idx
  on public.support_attachments (message_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;

drop policy if exists "Players read own support tickets" on public.support_tickets;
create policy "Players read own support tickets"
  on public.support_tickets for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Players read own support messages" on public.support_messages;
create policy "Players read own support messages"
  on public.support_messages for select to authenticated
  using (exists (
    select 1 from public.support_tickets as tickets
    where tickets.id = ticket_id and tickets.user_id = auth.uid()
  ));

drop policy if exists "Players read own support attachments" on public.support_attachments;
create policy "Players read own support attachments"
  on public.support_attachments for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Players add own support attachments" on public.support_attachments;
create policy "Players add own support attachments"
  on public.support_attachments for insert to authenticated
  with check (
    user_id = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and split_part(storage_path, '/', 2) = ticket_id::text
    and exists (
      select 1
      from public.support_tickets as tickets
      join public.support_messages as messages on messages.ticket_id = tickets.id
      where tickets.id = support_attachments.ticket_id
        and tickets.user_id = auth.uid()
        and messages.id = support_attachments.message_id
        and messages.sender_user_id = auth.uid()
    )
  );

revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;
revoke all on public.support_attachments from anon, authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;
grant select, insert on public.support_attachments to authenticated;
grant all on public.support_tickets to service_role;
grant all on public.support_messages to service_role;
grant all on public.support_attachments to service_role;

create or replace function public.create_player_support_ticket(
  p_category text,
  p_subject text,
  p_body text,
  p_related_wish_id text default null,
  p_related_order_id uuid default null,
  p_related_shipment_id uuid default null
)
returns table (ticket_id uuid, message_id uuid, ticket_number bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket_id uuid;
  v_message_id uuid;
  v_ticket_number bigint;
  v_category text := lower(btrim(coalesce(p_category, '')));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if v_category not in ('wrong_card', 'payment', 'shipping', 'damaged', 'missing', 'account', 'other') then
    raise exception using message = 'Choose a valid support category.';
  end if;
  if char_length(v_subject) not between 5 and 120 then
    raise exception using message = 'Support subject must be 5-120 characters.';
  end if;
  if char_length(v_body) not between 10 and 4000 then
    raise exception using message = 'Support message must be 10-4000 characters.';
  end if;

  if (select count(*) from public.support_tickets
      where user_id = v_user_id and created_at >= now() - interval '24 hours') >= 10 then
    raise exception using message = 'Too many support tickets were opened today. Reply to an existing ticket instead.';
  end if;

  if p_related_wish_id is not null and not exists (
    select 1 from public.player_wishes
    where id::text = p_related_wish_id and user_id = v_user_id
  ) then
    raise exception using message = 'That wish does not belong to this account.';
  end if;

  if p_related_order_id is not null and not exists (
    select 1 from public.wish_purchase_orders
    where id = p_related_order_id and user_id = v_user_id
  ) then
    raise exception using message = 'That purchase does not belong to this account.';
  end if;

  if p_related_shipment_id is not null and not exists (
    select 1 from public.player_shipping_shipments
    where id = p_related_shipment_id and user_id = v_user_id
  ) then
    raise exception using message = 'That shipment does not belong to this account.';
  end if;

  insert into public.support_tickets (
    user_id, category, subject, status,
    related_wish_id, related_order_id, related_shipment_id,
    player_last_read_at
  ) values (
    v_user_id, v_category, v_subject, 'waiting_admin',
    nullif(btrim(coalesce(p_related_wish_id, '')), ''),
    p_related_order_id, p_related_shipment_id, now()
  ) returning id, support_tickets.ticket_number
    into v_ticket_id, v_ticket_number;

  insert into public.support_messages (
    ticket_id, sender_user_id, sender_role, body
  ) values (
    v_ticket_id, v_user_id, 'player', v_body
  ) returning id into v_message_id;

  return query select v_ticket_id, v_message_id, v_ticket_number;
end;
$function$;

create or replace function public.reply_player_support_ticket(
  p_ticket_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception using message = 'Support message must be 1-4000 characters.';
  end if;

  perform 1 from public.support_tickets
  where id = p_ticket_id and user_id = v_user_id and status <> 'closed'
  for update;

  if not found then
    raise exception using message = 'That support ticket is not available.';
  end if;

  if (select count(*) from public.support_messages
      where ticket_id = p_ticket_id and sender_user_id = v_user_id
        and created_at >= now() - interval '1 hour') >= 20 then
    raise exception using message = 'Too many messages were sent to this ticket. Wait before trying again.';
  end if;

  insert into public.support_messages (ticket_id, sender_user_id, sender_role, body)
  values (p_ticket_id, v_user_id, 'player', v_body)
  returning id into v_message_id;

  update public.support_tickets
  set
    status = 'waiting_admin',
    last_message_at = now(),
    player_last_read_at = now(),
    resolved_at = null,
    updated_at = now()
  where id = p_ticket_id;

  return v_message_id;
end;
$function$;

create or replace function public.mark_player_support_ticket_read(
  p_ticket_id uuid
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $function$
  update public.support_tickets
  set player_last_read_at = now()
  where id = p_ticket_id and user_id = auth.uid();
$function$;

revoke all on function public.create_player_support_ticket(
  text, text, text, text, uuid, uuid
) from public;
revoke all on function public.reply_player_support_ticket(uuid, text) from public;
revoke all on function public.mark_player_support_ticket_read(uuid) from public;
grant execute on function public.create_player_support_ticket(
  text, text, text, text, uuid, uuid
) to authenticated;
grant execute on function public.reply_player_support_ticket(uuid, text) to authenticated;
grant execute on function public.mark_player_support_ticket_read(uuid) to authenticated;

-- Private support-image bucket. Players can only access the first path segment
-- matching their authenticated user ID; administrators use the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Players upload own support images" on storage.objects;
create policy "Players upload own support images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Players read own support images" on storage.objects;
create policy "Players read own support images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Players delete own support images" on storage.objects;
create policy "Players delete own support images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.support_attachments as attachments
      where attachments.storage_path = name
    )
  );

-- -------------------------------------------------------------------------
-- PLAYER CARD / ORDER TIMELINE
-- -------------------------------------------------------------------------

create or replace function public.get_player_order_timeline(
  p_limit integer default 100
)
returns table (
  wish_id text,
  card_id text,
  card_name text,
  set_name text,
  card_no text,
  rarity text,
  image_url text,
  pulled_at timestamptz,
  fulfilment_status text,
  card_finish text,
  card_condition text,
  card_language text,
  shipment_id uuid,
  shipment_status text,
  tracking_number text,
  tracking_url text,
  requested_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    wishes.id::text,
    cards.id::text,
    coalesce(nullif(btrim(cards.name), ''), 'Mystery card'),
    coalesce(nullif(btrim(cards.set_name), ''), 'Unknown set'),
    nullif(btrim(cards.card_no), ''),
    coalesce(nullif(btrim(cards.rarity), ''), 'Common'),
    nullif(btrim(cards.image_url), ''),
    wishes.created_at,
    coalesce(obligation.status, 'recorded'),
    coalesce(nullif(btrim(stock.finish), ''), 'normal'),
    coalesce(nullif(btrim(stock.card_condition), ''), 'near_mint'),
    coalesce(nullif(btrim(stock.card_language), ''), 'English'),
    shipment.id,
    shipment.status,
    shipment.tracking_number,
    shipment.tracking_url,
    shipment.requested_at,
    shipment.packed_at,
    shipment.shipped_at,
    shipment.delivered_at
  from public.player_wishes as wishes
  join public.pokemon_cards as cards
    on cards.id::text = wishes.card_id::text
  left join public.wish_fulfilment_obligations as obligation
    on obligation.wish_id = wishes.id::text
  left join public.inventory as stock
    on stock.id::text = obligation.physical_inventory_id
  left join public.player_shipping_shipments as shipment
    on shipment.id = obligation.shipment_id
  where obligation.user_id = auth.uid()
  order by wishes.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$function$;

revoke all on function public.get_player_order_timeline(integer) from public;
grant execute on function public.get_player_order_timeline(integer) to authenticated;

-- Keep shipment thresholds fail-safe even if an older environment lost its
-- singleton configuration row. Existing configured values are preserved.
insert into public.player_shipping_config (id, free_shipping_card_threshold)
values (1, 100)
on conflict (id) do nothing;

-- Existing shipment items aggregate copies by card design. Link the oldest
-- unshipped physical obligations to each item so duplicate cards retain an
-- exact wish-to-parcel trail.
create or replace function public.link_fulfilment_to_shipment_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_linked integer;
begin
  with candidates as (
    select obligation.id
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = new.user_id
      and obligation.card_id = new.card_id
      and obligation.shipment_id is null
      and obligation.status in ('ready', 'sourced')
    order by obligation.created_at asc, obligation.id asc
    limit new.quantity
    for update skip locked
  )
  update public.wish_fulfilment_obligations as obligation
  set shipment_id = new.shipment_id
  from candidates
  where obligation.id = candidates.id;

  get diagnostics v_linked = row_count;
  if v_linked <> new.quantity then
    raise exception using message =
      'One or more requested cards has no verified physical fulfilment record. The shipment was not created.';
  end if;

  return new;
end;
$function$;

drop trigger if exists shipment_items_link_fulfilment
  on public.player_shipping_shipment_items;
create trigger shipment_items_link_fulfilment
  after insert on public.player_shipping_shipment_items
  for each row execute function public.link_fulfilment_to_shipment_item();

create or replace function public.sync_fulfilment_from_shipment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item record;
begin
  if new.status = 'cancelled' then
    for v_item in
      select items.user_id, items.card_id, items.quantity
      from public.player_shipping_shipment_items as items
      where items.shipment_id = new.id
    loop
      update public.player_inventory as inventory
      set reserved_quantity = greatest(
        0,
        coalesce(inventory.reserved_quantity, 0) - v_item.quantity
      )
      where inventory.user_id = v_item.user_id
        and inventory.card_id::text = v_item.card_id
        and coalesce(inventory.reserved_quantity, 0) >= v_item.quantity;

      if not found then
        raise exception using message =
          'Reserved inventory could not be released. The shipment was not cancelled.';
      end if;
    end loop;

    update public.wish_fulfilment_obligations
    set status = 'ready', shipment_id = null, fulfilled_at = null
    where shipment_id = new.id;
  elsif new.status = 'packing' then
    update public.wish_fulfilment_obligations
    set status = 'packed'
    where shipment_id = new.id and status in ('ready', 'sourced');
  elsif new.status in ('shipped', 'delivered') then
    update public.wish_fulfilment_obligations
    set
      status = 'shipped',
      fulfilled_at = case when new.status = 'delivered' then now() else fulfilled_at end
    where shipment_id = new.id and status <> 'cancelled';

    if new.status = 'delivered' then
      for v_item in
        select items.user_id, items.card_id, items.quantity
        from public.player_shipping_shipment_items as items
        where items.shipment_id = new.id
      loop
        -- player_inventory enforces quantity > 0. Remove a fully shipped row
        -- directly; only use UPDATE when some copies remain in the vault.
        delete from public.player_inventory as inventory
        where inventory.user_id = v_item.user_id
          and inventory.card_id::text = v_item.card_id
          and coalesce(inventory.quantity, 0) = v_item.quantity
          and coalesce(inventory.reserved_quantity, 0) = v_item.quantity;

        if not found then
          update public.player_inventory as inventory
          set
            quantity = inventory.quantity - v_item.quantity,
            reserved_quantity = inventory.reserved_quantity - v_item.quantity
          where inventory.user_id = v_item.user_id
            and inventory.card_id::text = v_item.card_id
            and coalesce(inventory.quantity, 0) > v_item.quantity
            and coalesce(inventory.reserved_quantity, 0) >= v_item.quantity;

          if not found then
            raise exception using message =
              'Delivered inventory could not be reconciled. The shipment status was not changed.';
          end if;
        end if;
      end loop;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists shipments_sync_fulfilment
  on public.player_shipping_shipments;
create trigger shipments_sync_fulfilment
  after update of status on public.player_shipping_shipments
  for each row
  when (new.status is distinct from old.status)
execute function public.sync_fulfilment_from_shipment();

create or replace function public.get_player_shipping_eligibility()
returns table (
  threshold integer,
  total_cards bigint,
  available_cards bigint,
  reserved_cards bigint,
  progress_percent numeric,
  unlocked boolean,
  active_shipment_id uuid,
  active_status text,
  active_card_count integer,
  active_requested_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with config as (
    select greatest(shipping.free_shipping_card_threshold, 1) as threshold
    from public.player_shipping_config as shipping
    where shipping.id = 1
  ), totals as (
    select
      (select coalesce(sum(greatest(coalesce(inventory.quantity, 0), 0)), 0)::bigint
       from public.player_inventory as inventory
       where inventory.user_id = auth.uid()) as total_cards,
      count(*) filter (
        where obligation.shipment_id is null
          and obligation.status in ('ready', 'sourced')
      )::bigint as available_cards,
      count(*) filter (
        where obligation.shipment_id is not null
          and obligation.status in ('ready', 'sourced', 'packed', 'shipped')
      )::bigint as reserved_cards
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = auth.uid()
  ), active as (
    select shipments.id, shipments.status, shipments.card_count, shipments.requested_at
    from public.player_shipping_shipments as shipments
    where shipments.user_id = auth.uid()
      and shipments.status in ('requested', 'packing')
    order by shipments.requested_at desc
    limit 1
  )
  select
    config.threshold,
    totals.total_cards,
    totals.available_cards,
    totals.reserved_cards,
    least(100::numeric, (totals.available_cards::numeric / config.threshold::numeric) * 100),
    totals.available_cards >= config.threshold,
    active.id,
    active.status,
    active.card_count,
    active.requested_at
  from totals cross join config
  left join active on true;
$function$;

create or replace function public.request_player_shipment(
  p_address_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_threshold integer;
  v_available integer;
  v_shipment_id uuid;
  v_item record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform 1 from public.player_shipping_addresses_v2 as address
  where address.id = p_address_id and address.user_id = v_user_id
  for update;
  if not found then
    raise exception using message = 'Choose a valid shipping address.';
  end if;

  if exists (
    select 1 from public.player_shipping_shipments as shipment
    where shipment.user_id = v_user_id
      and shipment.status in ('requested', 'packing')
  ) then
    raise exception using message = 'You already have a shipment being prepared.';
  end if;

  select greatest(config.free_shipping_card_threshold, 1)
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  perform 1
  from public.wish_fulfilment_obligations as obligation
  where obligation.user_id = v_user_id
    and obligation.shipment_id is null
    and obligation.status in ('ready', 'sourced')
  order by obligation.id
  for update;

  select count(*)::integer into v_available
  from public.wish_fulfilment_obligations as obligation
  where obligation.user_id = v_user_id
    and obligation.shipment_id is null
    and obligation.status in ('ready', 'sourced');

  if v_available < v_threshold then
    raise exception using message =
      'You have not reached the physically verified free-shipping threshold yet.';
  end if;

  insert into public.player_shipping_shipments (
    user_id, address_id, status, card_count
  ) values (
    v_user_id, p_address_id, 'requested', v_available
  ) returning id into v_shipment_id;

  for v_item in
    select obligation.card_id, count(*)::integer as quantity
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = v_user_id
      and obligation.shipment_id is null
      and obligation.status in ('ready', 'sourced')
    group by obligation.card_id
    order by obligation.card_id
  loop
    update public.player_inventory as inventory
    set reserved_quantity = coalesce(inventory.reserved_quantity, 0) + v_item.quantity
    where inventory.user_id = v_user_id
      and inventory.card_id::text = v_item.card_id
      and greatest(coalesce(inventory.quantity, 0), 0)
        - greatest(coalesce(inventory.reserved_quantity, 0), 0) >= v_item.quantity;

    if not found then
      raise exception using message =
        'Collection quantity no longer matches physical fulfilment. The shipment was not created.';
    end if;

    insert into public.player_shipping_shipment_items (
      shipment_id, user_id, card_id, quantity
    ) values (
      v_shipment_id, v_user_id, v_item.card_id, v_item.quantity
    );
  end loop;

  perform public.sync_player_achievements();
  return v_shipment_id;
end;
$function$;

revoke all on function public.get_player_shipping_eligibility() from public;
revoke all on function public.request_player_shipment(uuid) from public;
grant execute on function public.get_player_shipping_eligibility() to authenticated;
grant execute on function public.request_player_shipment(uuid) to authenticated;

do $backfill_shipment_links$
declare
  v_item record;
begin
  for v_item in
    select
      items.shipment_id,
      items.user_id,
      items.card_id,
      items.quantity,
      shipments.status,
      shipments.requested_at,
      shipments.delivered_at
    from public.player_shipping_shipment_items as items
    join public.player_shipping_shipments as shipments
      on shipments.id = items.shipment_id
    where shipments.status <> 'cancelled'
    order by shipments.requested_at asc, items.shipment_id, items.card_id
  loop
    with candidates as (
      select obligation.id
      from public.wish_fulfilment_obligations as obligation
      where obligation.user_id = v_item.user_id
        and obligation.card_id = v_item.card_id
        and obligation.shipment_id is null
        and obligation.created_at <= v_item.requested_at
        and obligation.status <> 'cancelled'
      order by obligation.created_at asc, obligation.id asc
      limit v_item.quantity
      for update skip locked
    )
    update public.wish_fulfilment_obligations as obligation
    set
      shipment_id = v_item.shipment_id,
      status = case
        when v_item.status in ('shipped', 'delivered') then 'shipped'
        when v_item.status = 'packing' then 'packed'
        else obligation.status
      end,
      fulfilled_at = case
        when v_item.status = 'delivered' then coalesce(v_item.delivered_at, now())
        else obligation.fulfilled_at
      end
    from candidates
    where obligation.id = candidates.id;
  end loop;
end;
$backfill_shipment_links$;

-- A completed trade transfers the physical fulfilment obligation as well as
-- the collection count. If the exact number of obligations cannot move, the
-- whole trade completion rolls back rather than creating an unfunded card.
create or replace function public.transfer_fulfilment_on_trade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item record;
  v_recipient_id uuid;
  v_moved integer;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  for v_item in
    select item.owner_id, item.card_id, item.quantity
    from public.player_trade_items as item
    where item.trade_id = new.id
    order by item.owner_id, item.card_id
  loop
    v_recipient_id := case
      when v_item.owner_id = new.initiator_id then new.recipient_id
      else new.initiator_id
    end;

    with candidates as (
      select obligation.id
      from public.wish_fulfilment_obligations as obligation
      where obligation.user_id = v_item.owner_id
        and obligation.card_id = v_item.card_id
        and obligation.shipment_id is null
        and obligation.status in ('ready', 'source_needed', 'source_requested', 'sourced')
      order by
        case when obligation.status in ('ready', 'sourced') then 0 else 1 end,
        obligation.created_at asc,
        obligation.id asc
      limit v_item.quantity
      for update
    )
    update public.wish_fulfilment_obligations as obligation
    set user_id = v_recipient_id
    from candidates
    where obligation.id = candidates.id;

    get diagnostics v_moved = row_count;
    if v_moved <> v_item.quantity then
      raise exception using message =
        'The physical fulfilment record changed during trade completion. No cards were transferred.';
    end if;

    insert into public.operations_events (
      event_type, player_user_id, entity_type, entity_id,
      quantity, idempotency_key, metadata
    ) values (
      'trade.card_transferred',
      v_recipient_id,
      'trade',
      new.id::text,
      v_item.quantity,
      'trade:' || new.id::text || ':' || v_item.owner_id::text || ':' || v_item.card_id,
      jsonb_build_object(
        'from_user_id', v_item.owner_id,
        'to_user_id', v_recipient_id,
        'card_id', v_item.card_id
      )
    ) on conflict (idempotency_key) do nothing;
  end loop;

  return new;
end;
$function$;

drop trigger if exists player_trades_transfer_fulfilment
  on public.player_trades;
create trigger player_trades_transfer_fulfilment
  after update of status on public.player_trades
  for each row
  when (new.status is distinct from old.status)
  execute function public.transfer_fulfilment_on_trade();

-- -------------------------------------------------------------------------
-- SCANNER RELEASE EVIDENCE
-- -------------------------------------------------------------------------

create table if not exists public.scanner_release_benchmarks (
  id uuid primary key default gen_random_uuid(),
  scanner_version text not null,
  total_samples integer not null,
  auto_accepted_samples integer not null,
  wrong_auto_writes integer not null,
  unresolved_samples integer not null,
  queue_drops integer not null default 0,
  duplicate_writes integer not null default 0,
  p95_latency_ms numeric not null,
  auto_coverage_percent numeric not null,
  dataset_sha256 text not null,
  passed boolean not null,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint scanner_benchmark_counts check (
    total_samples >= 0
    and auto_accepted_samples >= 0
    and wrong_auto_writes >= 0
    and unresolved_samples >= 0
    and queue_drops >= 0
    and duplicate_writes >= 0
    and auto_accepted_samples <= total_samples
  ),
  constraint scanner_benchmark_hash check (
    dataset_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint scanner_benchmark_metrics check (
    p95_latency_ms >= 0
    and auto_coverage_percent between 0 and 100
  )
);

create index if not exists scanner_release_benchmarks_recorded_idx
  on public.scanner_release_benchmarks (recorded_at desc);
create unique index if not exists scanner_release_benchmarks_dataset_unique
  on public.scanner_release_benchmarks (dataset_sha256);

alter table public.scanner_release_benchmarks enable row level security;
revoke all on public.scanner_release_benchmarks from anon, authenticated;
grant all on public.scanner_release_benchmarks to service_role;

-- -------------------------------------------------------------------------
-- OPERATIONAL TRIGGERS AND FEATURE GUARDS
-- -------------------------------------------------------------------------

create or replace function public.log_purchase_order_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.operations_events (
      event_type, player_user_id, entity_type, entity_id,
      amount_pence, quantity, idempotency_key, metadata
    ) values (
      'purchase.' || new.status,
      new.user_id,
      'wish_purchase_order',
      new.id::text,
      new.amount_pence,
      new.wishes,
      'purchase:' || new.id::text || ':' || new.status,
      jsonb_build_object(
        'package_id', new.package_id,
        'first_recharge', new.first_recharge,
        'stripe_checkout_session_id', new.stripe_checkout_session_id,
        'stripe_payment_intent_id', new.stripe_payment_intent_id
      )
    ) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists wish_purchase_orders_operation_log on public.wish_purchase_orders;
create trigger wish_purchase_orders_operation_log
  after insert or update of status on public.wish_purchase_orders
  for each row execute function public.log_purchase_order_operation();

create or replace function public.log_player_wish_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.operations_events (
    event_type, player_user_id, entity_type, entity_id,
    quantity, idempotency_key, metadata
  ) values (
    'wish.completed',
    new.user_id,
    'player_wish',
    new.id::text,
    1,
    'wish:' || new.id::text || ':completed',
    jsonb_build_object(
      'card_id', new.card_id::text,
      'market_value_at_wish', new.market_value_at_wish
    )
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$function$;

drop trigger if exists player_wishes_operation_log on public.player_wishes;
create trigger player_wishes_operation_log
  after insert on public.player_wishes
  for each row execute function public.log_player_wish_operation();

create or replace function public.log_fulfilment_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.operations_events (
      event_type, player_user_id, entity_type, entity_id,
      quantity, idempotency_key, metadata
    ) values (
      'fulfilment.' || new.status,
      new.user_id,
      'wish_fulfilment',
      new.id::text,
      1,
      'fulfilment:' || new.id::text || ':' || new.status,
      jsonb_build_object(
        'wish_id', new.wish_id,
        'card_id', new.card_id,
        'physical_inventory_id', new.physical_inventory_id,
        'shipment_id', new.shipment_id
      )
    ) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists wish_fulfilment_operation_log on public.wish_fulfilment_obligations;
create trigger wish_fulfilment_operation_log
  after insert or update of status on public.wish_fulfilment_obligations
  for each row execute function public.log_fulfilment_operation();

create or replace function public.log_shipment_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.operations_events (
      event_type, player_user_id, entity_type, entity_id,
      quantity, idempotency_key, metadata
    ) values (
      'shipment.' || new.status,
      new.user_id,
      'shipment',
      new.id::text,
      new.card_count,
      'shipment:' || new.id::text || ':' || new.status,
      jsonb_build_object(
        'tracking_number', new.tracking_number,
        'tracking_url', new.tracking_url
      )
    ) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists player_shipments_operation_log on public.player_shipping_shipments;
create trigger player_shipments_operation_log
  after insert or update of status on public.player_shipping_shipments
  for each row execute function public.log_shipment_operation();

create or replace function public.log_admin_inventory_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.operations_events (
    event_type, actor_user_id, actor_email, entity_type, entity_id,
    quantity, idempotency_key, metadata
  ) values (
    'inventory.' || new.event_type,
    new.admin_user_id,
    new.admin_email,
    'inventory',
    coalesce(new.inventory_id, new.card_id),
    new.quantity_delta,
    'inventory-event:' || new.id::text,
    coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'card_id', new.card_id,
      'finish', new.finish,
      'final_quantity', new.final_quantity
    )
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$function$;

drop trigger if exists admin_inventory_operation_log on public.admin_inventory_events;
create trigger admin_inventory_operation_log
  after insert on public.admin_inventory_events
  for each row execute function public.log_admin_inventory_operation();

create or replace function public.guard_player_shipment_launch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings public.launch_control_settings%rowtype;
begin
  select * into v_settings from public.launch_control_settings where id = 1;
  if auth.uid() is not null then
    if v_settings.maintenance_mode then
      raise exception using message = coalesce(
        nullif(v_settings.maintenance_message, ''),
        'Ancient Pulls is temporarily paused for maintenance.'
      );
    end if;
    if not v_settings.shipping_enabled then
      raise exception using message = 'Shipping requests are currently paused.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists player_shipments_launch_guard on public.player_shipping_shipments;
create trigger player_shipments_launch_guard
  before insert on public.player_shipping_shipments
  for each row execute function public.guard_player_shipment_launch();

create or replace function public.guard_player_trade_launch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings public.launch_control_settings%rowtype;
begin
  select * into v_settings from public.launch_control_settings where id = 1;
  if auth.uid() is not null then
    if v_settings.maintenance_mode then
      raise exception using message = coalesce(
        nullif(v_settings.maintenance_message, ''),
        'Ancient Pulls is temporarily paused for maintenance.'
      );
    end if;
    if not v_settings.trades_enabled then
      raise exception using message = 'Trading is currently paused.';
    end if;
  end if;
  return new;
end;
$function$;

do $trade_guard$
begin
  if to_regclass('public.player_trades') is not null then
    execute 'drop trigger if exists player_trades_launch_guard on public.player_trades';
    execute 'create trigger player_trades_launch_guard before insert or update on public.player_trades for each row execute function public.guard_player_trade_launch()';
  end if;
end;
$trade_guard$;

-- Backfill immutable events for the records that existed before V66. The
-- conflict keys make the migration safely repeatable.
insert into public.operations_events (
  event_type, player_user_id, entity_type, entity_id,
  amount_pence, quantity, idempotency_key, metadata, created_at
)
select
  'purchase.' || orders.status,
  orders.user_id,
  'wish_purchase_order',
  orders.id::text,
  orders.amount_pence,
  orders.wishes,
  'purchase:' || orders.id::text || ':' || orders.status,
  jsonb_build_object('backfilled', true, 'package_id', orders.package_id),
  coalesce(orders.paid_at, orders.created_at)
from public.wish_purchase_orders as orders
on conflict (idempotency_key) do nothing;

insert into public.operations_events (
  event_type, player_user_id, entity_type, entity_id,
  quantity, idempotency_key, metadata, created_at
)
select
  'wish.completed',
  wishes.user_id,
  'player_wish',
  wishes.id::text,
  1,
  'wish:' || wishes.id::text || ':completed',
  jsonb_build_object('backfilled', true, 'card_id', wishes.card_id::text),
  wishes.created_at
from public.player_wishes as wishes
on conflict (idempotency_key) do nothing;

notify pgrst, 'reload schema';

commit;
