-- V67.9: merge Orders into Shipping and let players choose the exact
-- card quantities that enter a shipment. The existing one-argument
-- request_player_shipment function remains for backwards compatibility;
-- the app uses this validated two-argument overload.

create or replace function public.get_player_shipping_cards()
returns table (
  card_id text,
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  name text,
  set_name text,
  card_no text,
  rarity text,
  image_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    inventory.card_id::text,
    greatest(coalesce(inventory.quantity, 0), 0)::integer,
    least(
      greatest(coalesce(inventory.reserved_quantity, 0), 0),
      greatest(coalesce(inventory.quantity, 0), 0)
    )::integer,
    (
      greatest(coalesce(inventory.quantity, 0), 0)
      - least(
          greatest(coalesce(inventory.reserved_quantity, 0), 0),
          greatest(coalesce(inventory.quantity, 0), 0)
        )
    )::integer,
    coalesce(card.name, 'Mystery card')::text,
    coalesce(card.set_name, 'Unknown set')::text,
    card.card_no::text,
    coalesce(card.rarity, 'Unknown rarity')::text,
    card.image_url::text
  from public.player_inventory as inventory
  left join public.pokemon_cards as card
    on card.id::text = inventory.card_id::text
  where inventory.user_id = auth.uid()
    and (
      greatest(coalesce(inventory.quantity, 0), 0)
      - least(
          greatest(coalesce(inventory.reserved_quantity, 0), 0),
          greatest(coalesce(inventory.quantity, 0), 0)
        )
    ) > 0
  order by
    coalesce(card.name, 'Mystery card'),
    inventory.card_id::text;
$function$;

revoke all on function public.get_player_shipping_cards() from public;
grant execute on function public.get_player_shipping_cards() to authenticated;

create or replace function public.request_player_shipment(
  p_address_id uuid,
  p_card_selection jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_threshold integer;
  v_selected_total bigint := 0;
  v_shipment_id uuid;
  v_item record;
  v_inventory_quantity integer;
  v_inventory_reserved integer;
  v_available integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if p_card_selection is null
     or jsonb_typeof(p_card_selection) <> 'array'
     or jsonb_array_length(p_card_selection) = 0 then
    raise exception using message = 'Choose at least one card for this shipment.';
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

  select greatest(config.free_shipping_card_threshold, 1)
  into v_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  if v_threshold is null then
    raise exception using message = 'Shipping is not configured yet.';
  end if;

  -- Lock the collection in a stable order before validating quantities.
  perform 1
  from public.player_inventory as inventory
  where inventory.user_id = v_user_id
  order by inventory.card_id
  for update;

  for v_item in
    select
      selection.card_id,
      sum(selection.quantity)::integer as quantity
    from (
      select
        nullif(trim(element ->> 'card_id'), '') as card_id,
        case
          when (element ->> 'quantity') ~ '^[0-9]+$'
            then (element ->> 'quantity')::integer
          else 0
        end as quantity
      from jsonb_array_elements(p_card_selection) as element
    ) as selection
    where selection.card_id is not null
      and selection.quantity > 0
    group by selection.card_id
    order by selection.card_id
  loop
    v_inventory_quantity := null;
    v_inventory_reserved := null;

    select
      greatest(coalesce(inventory.quantity, 0), 0)::integer,
      greatest(coalesce(inventory.reserved_quantity, 0), 0)::integer
    into v_inventory_quantity, v_inventory_reserved
    from public.player_inventory as inventory
    where inventory.user_id = v_user_id
      and inventory.card_id::text = v_item.card_id
    for update;

    if not found then
      raise exception using message = 'One selected card is no longer in your collection.';
    end if;

    v_available := v_inventory_quantity - least(v_inventory_reserved, v_inventory_quantity);
    if v_item.quantity > v_available then
      raise exception using message = 'A selected card quantity is no longer available.';
    end if;

    v_selected_total := v_selected_total + v_item.quantity;
  end loop;

  if v_selected_total < v_threshold then
    raise exception using message = format(
      'Choose at least %s available cards to unlock free shipping.',
      v_threshold
    );
  end if;

  insert into public.player_shipping_shipments (
    user_id,
    address_id,
    status,
    card_count
  )
  values (
    v_user_id,
    p_address_id,
    'requested',
    v_selected_total::integer
  )
  returning id into v_shipment_id;

  for v_item in
    select
      selection.card_id,
      sum(selection.quantity)::integer as quantity
    from (
      select
        nullif(trim(element ->> 'card_id'), '') as card_id,
        case
          when (element ->> 'quantity') ~ '^[0-9]+$'
            then (element ->> 'quantity')::integer
          else 0
        end as quantity
      from jsonb_array_elements(p_card_selection) as element
    ) as selection
    where selection.card_id is not null
      and selection.quantity > 0
    group by selection.card_id
    order by selection.card_id
  loop
    insert into public.player_shipping_shipment_items (
      shipment_id,
      user_id,
      card_id,
      quantity
    )
    values (
      v_shipment_id,
      v_user_id,
      v_item.card_id,
      v_item.quantity
    );

    update public.player_inventory
    set reserved_quantity = least(
      greatest(coalesce(quantity, 0), 0),
      greatest(coalesce(reserved_quantity, 0), 0) + v_item.quantity
    )
    where user_id = v_user_id
      and card_id::text = v_item.card_id;
  end loop;

  -- Only source obligations represented by the selected quantities.
  with selection as (
    select
      raw.card_id,
      sum(raw.quantity)::integer as quantity
    from (
      select
        nullif(trim(element ->> 'card_id'), '') as card_id,
        case
          when (element ->> 'quantity') ~ '^[0-9]+$'
            then (element ->> 'quantity')::integer
          else 0
        end as quantity
      from jsonb_array_elements(p_card_selection) as element
    ) as raw
    where raw.card_id is not null
      and raw.quantity > 0
    group by raw.card_id
  ), ranked_obligations as (
    select
      obligation.id,
      obligation.card_id,
      row_number() over (
        partition by obligation.card_id
        order by obligation.created_at, obligation.id
      ) as card_position
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = v_user_id
      and obligation.status = 'source_needed'
  )
  update public.wish_fulfilment_obligations as obligation
  set
    status = 'source_requested',
    shipment_id = v_shipment_id,
    source_requested_at = coalesce(obligation.source_requested_at, now())
  from ranked_obligations
  join selection
    on selection.card_id = ranked_obligations.card_id
   and ranked_obligations.card_position <= selection.quantity
  where obligation.id = ranked_obligations.id;

  perform public.sync_player_achievements();
  return v_shipment_id;
end;
$function$;

revoke all on function public.request_player_shipment(uuid, jsonb) from public;
grant execute on function public.request_player_shipment(uuid, jsonb) to authenticated;

comment on function public.request_player_shipment(uuid, jsonb) is
  'V67.9: creates one shipment from exact player-selected card quantities and reserves nothing else.';
