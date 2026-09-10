-- Unown Pulls V21
-- Decouples summon odds from physical stock quantity.
-- Draw flow: rarity tier first -> one enabled card inside that tier.
-- Physical stock is used only for fulfilment. If a pulled card is not currently held,
-- the obligation is marked for sourcing before shipment.

begin;

create table if not exists public.wish_rarity_tiers (
  rarity_tier text primary key,
  display_name text not null,
  weight numeric(12,6) not null default 1,
  sort_order integer not null default 100,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint wish_rarity_tiers_weight_positive check (weight > 0)
);

insert into public.wish_rarity_tiers (rarity_tier, display_name, weight, sort_order, enabled)
values
  ('common', 'Common', 50, 10, true),
  ('uncommon', 'Uncommon', 25, 20, true),
  ('rare', 'Rare', 12, 30, true),
  ('double_rare', 'Double Rare', 6, 40, true),
  ('ultra_rare', 'Ultra Rare', 3, 50, true),
  ('illustration_rare', 'Illustration Rare', 2, 60, true),
  ('special_illustration_rare', 'Special Illustration Rare', 1, 70, true),
  ('hyper_rare', 'Hyper Rare', 0.5, 80, true),
  ('promo_other', 'Promo / Other', 0.5, 90, true)
on conflict (rarity_tier) do nothing;

create or replace function public.infer_wish_rarity_tier(p_rarity text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_rarity, '')) like '%special illustration%' then 'special_illustration_rare'
    when lower(coalesce(p_rarity, '')) like '%hyper%' then 'hyper_rare'
    when lower(coalesce(p_rarity, '')) like '%illustration%' then 'illustration_rare'
    when lower(coalesce(p_rarity, '')) like '%ultra%' then 'ultra_rare'
    when lower(coalesce(p_rarity, '')) like '%double rare%' then 'double_rare'
    when lower(coalesce(p_rarity, '')) like '%uncommon%' then 'uncommon'
    when lower(coalesce(p_rarity, '')) like '%common%' then 'common'
    when lower(coalesce(p_rarity, '')) like '%rare%' then 'rare'
    else 'promo_other'
  end;
$$;

create table if not exists public.wish_pool_cards (
  card_id text primary key,
  rarity_tier text not null references public.wish_rarity_tiers(rarity_tier),
  enabled boolean not null default true,
  draw_key double precision not null default random(),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wish_pool_cards_draw_key_range check (draw_key >= 0 and draw_key < 1)
);

create index if not exists wish_pool_cards_active_draw_idx
  on public.wish_pool_cards (rarity_tier, draw_key)
  where enabled = true;

alter table public.wish_rarity_tiers enable row level security;
alter table public.wish_pool_cards enable row level security;
revoke all on public.wish_rarity_tiers from anon, authenticated;
revoke all on public.wish_pool_cards from anon, authenticated;

-- Preserve the cards that were already physically eligible before V21, but only once
-- per card design. Physical copy count does NOT affect summon chance anymore.
insert into public.wish_pool_cards (card_id, rarity_tier, enabled)
select distinct
  stock.card_id::text,
  public.infer_wish_rarity_tier(cards.rarity),
  true
from public.inventory as stock
join public.pokemon_cards as cards
  on cards.id::text = stock.card_id::text
where stock.card_id is not null
on conflict (card_id) do nothing;

-- One record per card awarded. This is the fulfilment ledger.
create table if not exists public.wish_fulfilment_obligations (
  id uuid primary key default gen_random_uuid(),
  wish_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  status text not null default 'source_needed',
  physical_inventory_id text,
  shipment_id uuid,
  created_at timestamptz not null default now(),
  source_requested_at timestamptz,
  sourced_at timestamptz,
  fulfilled_at timestamptz,
  constraint wish_fulfilment_status_check check (
    status in (
      'ready',
      'source_needed',
      'source_requested',
      'sourced',
      'packed',
      'shipped',
      'cancelled'
    )
  )
);

create index if not exists wish_fulfilment_user_status_idx
  on public.wish_fulfilment_obligations (user_id, status, created_at);
create index if not exists wish_fulfilment_card_status_idx
  on public.wish_fulfilment_obligations (card_id, status, created_at);

alter table public.wish_fulfilment_obligations enable row level security;

-- Players may read only their own fulfilment state. They cannot edit it.
drop policy if exists "Players read own wish fulfilment" on public.wish_fulfilment_obligations;
create policy "Players read own wish fulfilment"
on public.wish_fulfilment_obligations
for select
to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.wish_fulfilment_obligations from authenticated;
grant select on public.wish_fulfilment_obligations to authenticated;

-- Safe service-role helper for later admin UI / bulk imports.
create or replace function public.admin_set_wish_pool_card(
  p_card_id text,
  p_enabled boolean default true,
  p_rarity_tier text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tier text;
  v_card_exists boolean;
begin
  select exists (
    select 1 from public.pokemon_cards as cards where cards.id::text = p_card_id
  ) into v_card_exists;

  if not v_card_exists then
    raise exception using message = 'That card does not exist in pokemon_cards.';
  end if;

  if p_rarity_tier is not null then
    v_tier := p_rarity_tier;
  else
    select public.infer_wish_rarity_tier(cards.rarity)
    into v_tier
    from public.pokemon_cards as cards
    where cards.id::text = p_card_id
    limit 1;
  end if;

  if not exists (
    select 1 from public.wish_rarity_tiers where rarity_tier = v_tier
  ) then
    raise exception using message = 'Unknown wish rarity tier.';
  end if;

  insert into public.wish_pool_cards (card_id, rarity_tier, enabled, draw_key, updated_at)
  values (p_card_id, v_tier, p_enabled, random(), now())
  on conflict (card_id) do update
  set rarity_tier = excluded.rarity_tier,
      enabled = excluded.enabled,
      updated_at = now();
end;
$function$;

revoke all on function public.admin_set_wish_pool_card(text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_wish_pool_card(text, boolean, text) to service_role;

-- Live odds now expose configured rarity-tier chances, NOT warehouse quantity.
create or replace function public.get_player_wish_odds()
returns table (
  rarity text,
  cards_in_pool bigint,
  chance_percent numeric
)
language sql
security definer
set search_path = public
as $$
  with counts as (
    select
      pool.rarity_tier,
      count(*)::bigint as card_count
    from public.wish_pool_cards as pool
    where pool.enabled = true
    group by pool.rarity_tier
  ), active as (
    select
      tiers.rarity_tier,
      tiers.display_name,
      tiers.weight,
      tiers.sort_order,
      counts.card_count
    from public.wish_rarity_tiers as tiers
    join counts on counts.rarity_tier = tiers.rarity_tier
    where tiers.enabled = true
      and tiers.weight > 0
      and counts.card_count > 0
  ), totals as (
    select coalesce(sum(weight), 0)::numeric as total_weight
    from active
  )
  select
    active.display_name as rarity,
    active.card_count as cards_in_pool,
    case
      when totals.total_weight <= 0 then 0::numeric
      else round((active.weight / totals.total_weight) * 100, 4)
    end as chance_percent
  from active
  cross join totals
  order by active.sort_order asc, active.display_name asc;
$$;

revoke all on function public.get_player_wish_odds() from public;
grant execute on function public.get_player_wish_odds() to authenticated;

-- V21 wish engine:
-- 1) spend one wish
-- 2) draw configured rarity tier
-- 3) draw one enabled catalogue card inside that tier using indexed draw_key
-- 4) use physical stock if available; otherwise create source_needed obligation
-- 5) add the result to the player's collection either way
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
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_rarity_tier text;
  v_random double precision;
  v_selected_card_id text;

  v_inventory_id text;
  v_inventory_id_type text;
  v_wish_card_id_type text;
  v_player_card_id_type text;
  v_wish_id text;
  v_remaining_quantity integer;
  v_player_inventory_updated integer;
  v_fulfilment_status text := 'source_needed';

  v_name text;
  v_set_name text;
  v_card_no text;
  v_rarity text;
  v_market_value numeric;
  v_image_url text;

  v_insert_columns text;
  v_insert_values text;
  v_sql text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in to make a wish.';
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

  -- Weighted rarity draw. The number of cards inside a tier does not change its tier chance.
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
        where pool.rarity_tier = tiers.rarity_tier
          and pool.enabled = true
      )
  ) as candidate
  order by -ln(greatest(random(), 0.0000001)) / candidate.weight
  limit 1;

  if v_rarity_tier is null then
    raise exception using message = 'The wish catalogue is currently empty.';
  end if;

  -- Scalable O(log N)-style card pick inside the selected tier using indexed draw_key.
  v_random := random();

  select pool.card_id
  into v_selected_card_id
  from public.wish_pool_cards as pool
  where pool.rarity_tier = v_rarity_tier
    and pool.enabled = true
    and pool.draw_key >= v_random
  order by pool.draw_key asc
  limit 1;

  if v_selected_card_id is null then
    select pool.card_id
    into v_selected_card_id
    from public.wish_pool_cards as pool
    where pool.rarity_tier = v_rarity_tier
      and pool.enabled = true
    order by pool.draw_key asc
    limit 1;
  end if;

  if v_selected_card_id is null then
    raise exception using message = 'No summonable card could be selected.';
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
    raise exception using message = 'The selected wish-pool card is missing from pokemon_cards.';
  end if;

  -- Physical stock affects fulfilment only, never probability.
  select stock.id::text
  into v_inventory_id
  from public.inventory as stock
  where stock.card_id::text = v_selected_card_id
    and coalesce(stock.quantity, 0) > 0
  order by stock.quantity desc, stock.id::text asc
  limit 1
  for update skip locked;

  if v_inventory_id is not null then
    execute $stock_update$
      update public.inventory
      set quantity = quantity - 1
      where id::text = $1
        and quantity > 0
      returning quantity
    $stock_update$
    into v_remaining_quantity
    using v_inventory_id;

    if v_remaining_quantity is not null then
      v_fulfilment_status := 'ready';
    else
      v_inventory_id := null;
      v_fulfilment_status := 'source_needed';
    end if;
  end if;

  update public.player_wallets as wallet
  set
    wish_balance = wallet.wish_balance - 1,
    lifetime_wishes_spent = coalesce(wallet.lifetime_wishes_spent, 0) + 1
  where wallet.user_id = v_user_id
  returning wallet.wish_balance into v_new_balance;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into v_wish_card_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.player_wishes'::regclass
    and attribute.attname = 'card_id'
    and not attribute.attisdropped;

  v_insert_columns := 'user_id, card_id, market_value_at_wish';
  v_insert_values := '$1, ' || quote_literal(v_selected_card_id) || '::' || v_wish_card_id_type || ', $2';

  if v_inventory_id is not null then
    select format_type(attribute.atttypid, attribute.atttypmod)
    into v_inventory_id_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.player_wishes'::regclass
      and attribute.attname = 'inventory_id'
      and not attribute.attisdropped;

    if v_inventory_id_type is not null then
      v_insert_columns := v_insert_columns || ', inventory_id';
      v_insert_values := v_insert_values || ', ' || quote_literal(v_inventory_id) || '::' || v_inventory_id_type;
    end if;
  end if;

  v_sql := 'insert into public.player_wishes (' || v_insert_columns || ') values (' || v_insert_values || ') returning id::text';
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
    v_fulfilment_status,
    v_inventory_id
  );

  execute $player_inventory_update$
    update public.player_inventory
    set quantity = coalesce(quantity, 0) + 1
    where user_id = $1
      and card_id::text = $2
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

    v_sql :=
      'insert into public.player_inventory (user_id, card_id, quantity, reserved_quantity) values ($1, ' ||
      quote_literal(v_selected_card_id) || '::' || v_player_card_id_type || ', 1, 0)';
    execute v_sql using v_user_id;
  end if;

  return query
  select
    v_wish_id,
    v_selected_card_id,
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url,
    v_new_balance;
end;
$function$;

revoke all on function public.make_player_wish() from public;
grant execute on function public.make_player_wish() to authenticated;

comment on function public.make_player_wish() is
  'V21: spends one wish, draws configured rarity then an enabled catalogue card, and records physical fulfilment separately from probability.';

-- Mark unsourced obligations for sourcing when a player actually asks for shipment.
-- This preserves the existing shipping workflow while making sourcing demand-driven.
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
  v_available bigint;
  v_shipment_id uuid;
  v_item record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform 1
  from public.player_shipping_addresses_v2 as addresses
  where addresses.id = p_address_id
    and addresses.user_id = v_user_id
  for update;

  if not found then
    raise exception using message = 'Choose a valid shipping address.';
  end if;

  if exists (
    select 1
    from public.player_shipping_shipments as shipments
    where shipments.user_id = v_user_id
      and shipments.status in ('requested', 'packing')
  ) then
    raise exception using message = 'You already have a shipment being prepared.';
  end if;

  select config.free_shipping_card_threshold
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  perform 1
  from public.player_inventory as inventory
  where inventory.user_id = v_user_id
  for update;

  select coalesce(sum(
    greatest(coalesce(inventory.quantity, 0), 0)
    - least(
      greatest(coalesce(inventory.reserved_quantity, 0), 0),
      greatest(coalesce(inventory.quantity, 0), 0)
    )
  ), 0)::bigint
  into v_available
  from public.player_inventory as inventory
  where inventory.user_id = v_user_id;

  if v_available < greatest(v_threshold, 1) then
    raise exception using message = 'You have not reached the free-shipping threshold yet.';
  end if;

  insert into public.player_shipping_shipments (user_id, address_id, status, card_count)
  values (v_user_id, p_address_id, 'requested', v_available::integer)
  returning id into v_shipment_id;

  for v_item in
    select
      inventory.card_id::text as card_id,
      (
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
          greatest(coalesce(inventory.reserved_quantity, 0), 0),
          greatest(coalesce(inventory.quantity, 0), 0)
        )
      )::integer as available_quantity
    from public.player_inventory as inventory
    where inventory.user_id = v_user_id
      and (
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
          greatest(coalesce(inventory.reserved_quantity, 0), 0),
          greatest(coalesce(inventory.quantity, 0), 0)
        )
      ) > 0
    for update
  loop
    insert into public.player_shipping_shipment_items (shipment_id, user_id, card_id, quantity)
    values (v_shipment_id, v_user_id, v_item.card_id, v_item.available_quantity);

    update public.player_inventory
    set reserved_quantity = least(
      greatest(coalesce(quantity, 0), 0),
      greatest(coalesce(reserved_quantity, 0), 0) + v_item.available_quantity
    )
    where user_id = v_user_id
      and card_id::text = v_item.card_id;
  end loop;

  update public.wish_fulfilment_obligations
  set
    status = 'source_requested',
    shipment_id = v_shipment_id,
    source_requested_at = coalesce(source_requested_at, now())
  where user_id = v_user_id
    and status = 'source_needed';

  perform public.sync_player_achievements();
  return v_shipment_id;
end;
$function$;

revoke all on function public.request_player_shipment(uuid) from public;
grant execute on function public.request_player_shipment(uuid) to authenticated;


-- Service-role helper for the future sourcing/admin screen.
-- It consumes one physical inventory copy and marks one outstanding obligation ready.
create or replace function public.admin_mark_wish_card_sourced(
  p_obligation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_card_id text;
  v_inventory_id text;
  v_remaining integer;
begin
  select obligation.card_id
  into v_card_id
  from public.wish_fulfilment_obligations as obligation
  where obligation.id = p_obligation_id
    and obligation.status in ('source_needed', 'source_requested')
  for update;

  if v_card_id is null then
    raise exception using message = 'That sourcing obligation is not available.';
  end if;

  select stock.id::text
  into v_inventory_id
  from public.inventory as stock
  where stock.card_id::text = v_card_id
    and coalesce(stock.quantity, 0) > 0
  order by stock.quantity desc, stock.id::text asc
  limit 1
  for update skip locked;

  if v_inventory_id is null then
    raise exception using message = 'Add a physical copy to inventory before marking this card sourced.';
  end if;

  execute $consume_stock$
    update public.inventory
    set quantity = quantity - 1
    where id::text = $1
      and quantity > 0
    returning quantity
  $consume_stock$
  into v_remaining
  using v_inventory_id;

  if v_remaining is null then
    raise exception using message = 'The physical copy was claimed before it could be allocated.';
  end if;

  update public.wish_fulfilment_obligations
  set
    status = 'sourced',
    physical_inventory_id = v_inventory_id,
    sourced_at = now()
  where id = p_obligation_id;
end;
$function$;

revoke all on function public.admin_mark_wish_card_sourced(uuid) from public, anon, authenticated;
grant execute on function public.admin_mark_wish_card_sourced(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
