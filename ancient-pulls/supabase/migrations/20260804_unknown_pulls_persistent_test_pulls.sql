-- Unknown Pulls persistent Jirachi test pulls
-- Generated 2026-08-04
--
-- Test behaviour:
-- - One wish is spent.
-- - Lifetime wishes spent increases.
-- - Pull history is recorded.
-- - The card is added to the player's collection.
-- - Physical public.inventory quantity is never changed.
-- - The Jirachi UI remains the existing pull UI.

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass(
    'public.inventory'
  ) is null then
    raise exception
      'public.inventory is missing.';
  end if;

  if to_regclass(
    'public.pokemon_cards'
  ) is null then
    raise exception
      'public.pokemon_cards is missing.';
  end if;

  if to_regclass(
    'public.player_profiles'
  ) is null then
    raise exception
      'public.player_profiles is missing.';
  end if;

  if to_regclass(
    'public.player_wallets'
  ) is null then
    raise exception
      'public.player_wallets is missing.';
  end if;

  if to_regclass(
    'public.player_wishes'
  ) is null then
    raise exception
      'public.player_wishes is missing.';
  end if;

  if to_regclass(
    'public.player_inventory'
  ) is null then
    raise exception
      'public.player_inventory is missing.';
  end if;
end;
$preflight$;

alter table
  public.player_profiles

add column if not exists
  is_banned boolean
    not null
    default false,

add column if not exists
  ban_reason text,

add column if not exists
  banned_at timestamptz,

add column if not exists
  banned_by uuid
    references auth.users(id)
    on delete set null,

add column if not exists
  last_seen_at timestamptz;

alter table
  public.player_wishes

add column if not exists
  is_test boolean
    not null
    default false;

create index if not exists
  player_wishes_test_idx

on public.player_wishes(
  user_id,
  is_test,
  created_at desc
);

create or replace function
public.make_player_wish()
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
set search_path =
  public,
  pg_temp
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_current_balance integer;
  v_new_balance integer;

  v_inventory_id text;
  v_inventory_card_id text;
  v_inventory_id_type text;

  v_wish_card_id_type text;
  v_player_card_id_type text;

  v_wish_id text;
  v_player_inventory_updated integer;

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
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message =
        'You must be signed in to make a wish.';
  end if;

  if exists (
    select 1

    from public.player_profiles
      as profile

    where profile.user_id =
        v_user_id

      and coalesce(
        profile.is_banned,
        false
      )
  ) then
    raise exception using
      errcode = '42501',
      message =
        'This trainer account is suspended.';
  end if;

  select
    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer

  into v_current_balance

  from public.player_wallets
    as wallet

  where wallet.user_id =
    v_user_id

  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'Your wish wallet does not exist.';
  end if;

  if v_current_balance < 1 then
    raise exception using
      errcode = 'P0001',
      message =
        'You do not have enough wishes.';
  end if;

  select
    stock.id::text,
    stock.card_id::text,
    card.name,
    card.set_name,
    card.card_no,
    card.rarity,
    coalesce(
      card.market_value,
      0
    )::numeric,
    card.image_url

  into
    v_inventory_id,
    v_inventory_card_id,
    v_name,
    v_set_name,
    v_card_no,
    v_rarity,
    v_market_value,
    v_image_url

  from public.inventory
    as stock

  join public.pokemon_cards
    as card

    on card.id::text =
      stock.card_id::text

  where coalesce(
      stock.quantity,
      0
    ) > 0

    and stock.card_id
      is not null

  order by
    -ln(
      greatest(
        random(),
        0.0000001
      )
    )
    /
    greatest(
      coalesce(
        stock.quantity,
        0
      ),
      1
    )

  limit 1;

  if v_inventory_id is null
    or v_inventory_card_id is null then

    raise exception using
      errcode = 'P0001',
      message =
        'There are no positive-quantity cards available in the test pool.';
  end if;

  /*
   * PERSISTENT TEST MODE
   *
   * Player-side data changes normally so the complete Jirachi experience can
   * be tested. The physical stock table is intentionally SELECT-only.
   *
   * This function never UPDATEs, INSERTs into or DELETEs from public.inventory.
   */

  update public.player_wallets
    as wallet

  set
    wish_balance =
      greatest(
        coalesce(
          wallet.wish_balance,
          0
        ) - 1,
        0
      ),

    lifetime_wishes_spent =
      coalesce(
        wallet.lifetime_wishes_spent,
        0
      ) + 1,

    updated_at =
      now()

  where wallet.user_id =
    v_user_id

  returning
    wallet.wish_balance

  into v_new_balance;

  if v_new_balance is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Your wish wallet could not be updated.';
  end if;

  select
    format_type(
      attribute.atttypid,
      attribute.atttypmod
    )

  into v_wish_card_id_type

  from pg_attribute
    as attribute

  where attribute.attrelid =
      'public.player_wishes'::regclass

    and attribute.attname =
      'card_id'

    and not attribute.attisdropped;

  if v_wish_card_id_type is null then
    raise exception using
      errcode = '42703',
      message =
        'player_wishes.card_id is missing.';
  end if;

  v_insert_columns :=
    'user_id, card_id, market_value_at_wish, is_test';

  v_insert_values :=
    '$1, ' ||
    quote_literal(
      v_inventory_card_id
    ) ||
    '::' ||
    v_wish_card_id_type ||
    ', $2, true';

  select
    format_type(
      attribute.atttypid,
      attribute.atttypmod
    )

  into v_inventory_id_type

  from pg_attribute
    as attribute

  where attribute.attrelid =
      'public.player_wishes'::regclass

    and attribute.attname =
      'inventory_id'

    and not attribute.attisdropped;

  if v_inventory_id_type is not null then
    v_insert_columns :=
      v_insert_columns ||
      ', inventory_id';

    v_insert_values :=
      v_insert_values ||
      ', ' ||
      quote_literal(
        v_inventory_id
      ) ||
      '::' ||
      v_inventory_id_type;
  end if;

  v_sql :=
    'insert into public.player_wishes (' ||
    v_insert_columns ||
    ') values (' ||
    v_insert_values ||
    ') returning id::text';

  execute v_sql
  into v_wish_id
  using
    v_user_id,
    v_market_value;

  execute $player_inventory_update$
    update public.player_inventory
    set quantity =
      coalesce(
        quantity,
        0
      ) + 1
    where user_id = $1
      and card_id::text = $2
  $player_inventory_update$
  using
    v_user_id,
    v_inventory_card_id;

  get diagnostics
    v_player_inventory_updated =
      row_count;

  if v_player_inventory_updated = 0 then
    select
      format_type(
        attribute.atttypid,
        attribute.atttypmod
      )

    into v_player_card_id_type

    from pg_attribute
      as attribute

    where attribute.attrelid =
        'public.player_inventory'::regclass

      and attribute.attname =
        'card_id'

      and not attribute.attisdropped;

    if v_player_card_id_type is null then
      raise exception using
        errcode = '42703',
        message =
          'player_inventory.card_id is missing.';
    end if;

    v_sql :=
      'insert into public.player_inventory ' ||
      '(user_id, card_id, quantity, reserved_quantity) ' ||
      'values ($1, ' ||
      quote_literal(
        v_inventory_card_id
      ) ||
      '::' ||
      v_player_card_id_type ||
      ', 1, 0)';

    execute v_sql
    using v_user_id;
  end if;

  return query
  select
    v_wish_id,
    v_inventory_card_id,
    coalesce(
      v_name,
      'Unknown card'
    ),
    coalesce(
      v_set_name,
      'Unknown set'
    ),
    coalesce(
      v_card_no,
      ''
    ),
    coalesce(
      v_rarity,
      'Unknown rarity'
    ),
    coalesce(
      v_market_value,
      0
    ),
    v_image_url,
    v_new_balance;
end;
$function$;

revoke all
on function
  public.make_player_wish()
from public;

grant execute
on function
  public.make_player_wish()
to authenticated;

comment on function
  public.make_player_wish()
is
  'Persistent Jirachi test pull: spends one wish, records test history and adds the card to the player collection without reducing physical inventory.';

notify pgrst, 'reload schema';
