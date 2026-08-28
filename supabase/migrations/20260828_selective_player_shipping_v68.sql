-- Ancient Pulls V68: choose the exact fulfilled wishes included in a parcel.

create or replace function public.link_fulfilment_to_shipment_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_already_linked integer;
  v_linked integer := 0;
  v_needed integer;
begin
  select count(*)::integer
  into v_already_linked
  from public.wish_fulfilment_obligations as obligation
  where obligation.user_id = new.user_id
    and obligation.card_id = new.card_id
    and obligation.shipment_id = new.shipment_id;

  v_needed := greatest(0, new.quantity - v_already_linked);

  if v_needed > 0 then
    with candidates as (
      select obligation.id
      from public.wish_fulfilment_obligations as obligation
      where obligation.user_id = new.user_id
        and obligation.card_id = new.card_id
        and obligation.shipment_id is null
        and obligation.status in ('ready', 'sourced')
      order by obligation.created_at asc, obligation.id asc
      limit v_needed
      for update skip locked
    )
    update public.wish_fulfilment_obligations as obligation
    set shipment_id = new.shipment_id
    from candidates
    where obligation.id = candidates.id;

    get diagnostics v_linked = row_count;
  end if;

  if v_already_linked + v_linked <> new.quantity then
    raise exception using message =
      'One or more requested cards has no verified physical fulfilment record. The shipment was not created.';
  end if;

  return new;
end;
$function$;

create or replace function public.request_player_shipment(
  p_address_id uuid,
  p_wish_ids text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_threshold integer;
  v_selected_count integer;
  v_requested_count integer;
  v_shipment_id uuid;
  v_clean_wish_ids text[];
  v_item record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(wish_id), '')), array[]::text[])
  into v_clean_wish_ids
  from unnest(coalesce(p_wish_ids, array[]::text[])) as requested(wish_id)
  where nullif(btrim(wish_id), '') is not null;

  v_requested_count := coalesce(cardinality(v_clean_wish_ids), 0);
  if v_requested_count = 0 then
    raise exception using message = 'Choose at least one card for this shipment.';
  end if;

  perform 1
  from public.player_shipping_addresses_v2 as address
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
    and obligation.wish_id = any(v_clean_wish_ids)
  order by obligation.id
  for update;

  select count(*)::integer
  into v_selected_count
  from public.wish_fulfilment_obligations as obligation
  where obligation.user_id = v_user_id
    and obligation.wish_id = any(v_clean_wish_ids)
    and obligation.shipment_id is null
    and obligation.status in ('ready', 'sourced');

  if v_selected_count <> v_requested_count then
    raise exception using message =
      'One or more selected cards is no longer available. Refresh your cards and try again.';
  end if;

  if v_selected_count < v_threshold then
    raise exception using message =
      'Choose enough physically verified cards to reach the free-shipping threshold.';
  end if;

  insert into public.player_shipping_shipments (user_id, address_id, status, card_count)
  values (v_user_id, p_address_id, 'requested', v_selected_count)
  returning id into v_shipment_id;

  update public.wish_fulfilment_obligations as obligation
  set shipment_id = v_shipment_id
  where obligation.user_id = v_user_id
    and obligation.wish_id = any(v_clean_wish_ids)
    and obligation.shipment_id is null
    and obligation.status in ('ready', 'sourced');

  for v_item in
    select obligation.card_id, count(*)::integer as quantity
    from public.wish_fulfilment_obligations as obligation
    where obligation.user_id = v_user_id
      and obligation.shipment_id = v_shipment_id
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

revoke all on function public.request_player_shipment(uuid, text[]) from public;
grant execute on function public.request_player_shipment(uuid, text[]) to authenticated;
