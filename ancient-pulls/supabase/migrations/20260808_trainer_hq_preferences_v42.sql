-- Unown Pulls V42
-- Trainer HQ dashboard and persistent player comfort/performance preferences.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null
    or to_regclass('public.player_profile_details') is null
    or to_regclass('public.player_wallets') is null
    or to_regclass('public.player_wishes') is null
    or to_regclass('public.player_inventory') is null
    or to_regclass('public.pokemon_cards') is null
    or to_regclass('public.player_friendships') is null
    or to_regclass('public.player_trades') is null
    or to_regclass('public.player_shipping_shipments') is null
    or to_regclass('public.player_shipping_config') is null then
    raise exception
      'Trainer HQ needs the existing player, collection, friends, trade and shipping migrations first.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- GLOBAL PLAYER PREFERENCES
-- ---------------------------------------------------------------------------

create table if not exists public.player_preferences (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  music_volume smallint not null default 35,
  sfx_volume smallint not null default 72,
  reduced_motion boolean not null default false,
  low_visual_effects boolean not null default false,
  larger_text boolean not null default false,
  skip_pull_cinematic boolean not null default false,
  data_saver boolean not null default false,
  cinematic_seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_preferences_music_volume_range
    check (music_volume between 0 and 100),
  constraint player_preferences_sfx_volume_range
    check (sfx_volume between 0 and 100)
);

alter table public.player_preferences enable row level security;

drop policy if exists "Players can read their preferences"
  on public.player_preferences;

create policy "Players can read their preferences"
  on public.player_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete
  on public.player_preferences
  from anon, authenticated;

grant select
  on public.player_preferences
  to authenticated;

create or replace function public.get_player_preferences()
returns table (
  music_volume integer,
  sfx_volume integer,
  reduced_motion boolean,
  low_visual_effects boolean,
  larger_text boolean,
  skip_pull_cinematic boolean,
  data_saver boolean,
  cinematic_seen boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  insert into public.player_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return query
  select
    preferences.music_volume::integer,
    preferences.sfx_volume::integer,
    preferences.reduced_motion,
    preferences.low_visual_effects,
    preferences.larger_text,
    preferences.skip_pull_cinematic,
    preferences.data_saver,
    preferences.cinematic_seen
  from public.player_preferences as preferences
  where preferences.user_id = v_user_id;
end;
$function$;

create or replace function public.update_player_preferences(
  p_music_volume integer,
  p_sfx_volume integer,
  p_reduced_motion boolean,
  p_low_visual_effects boolean,
  p_larger_text boolean,
  p_skip_pull_cinematic boolean,
  p_data_saver boolean
)
returns table (
  music_volume integer,
  sfx_volume integer,
  reduced_motion boolean,
  low_visual_effects boolean,
  larger_text boolean,
  skip_pull_cinematic boolean,
  data_saver boolean,
  cinematic_seen boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  insert into public.player_preferences as preferences (
    user_id,
    music_volume,
    sfx_volume,
    reduced_motion,
    low_visual_effects,
    larger_text,
    skip_pull_cinematic,
    data_saver,
    updated_at
  )
  values (
    v_user_id,
    greatest(0, least(coalesce(p_music_volume, 35), 100)),
    greatest(0, least(coalesce(p_sfx_volume, 72), 100)),
    coalesce(p_reduced_motion, false),
    coalesce(p_low_visual_effects, false),
    coalesce(p_larger_text, false),
    coalesce(p_skip_pull_cinematic, false),
    coalesce(p_data_saver, false),
    now()
  )
  on conflict (user_id)
  do update set
    music_volume = excluded.music_volume,
    sfx_volume = excluded.sfx_volume,
    reduced_motion = excluded.reduced_motion,
    low_visual_effects = excluded.low_visual_effects,
    larger_text = excluded.larger_text,
    skip_pull_cinematic = excluded.skip_pull_cinematic,
    data_saver = excluded.data_saver,
    updated_at = now();

  return query
  select * from public.get_player_preferences();
end;
$function$;

create or replace function public.mark_player_cinematic_seen()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  insert into public.player_preferences (
    user_id,
    cinematic_seen,
    updated_at
  )
  values (v_user_id, true, now())
  on conflict (user_id)
  do update set
    cinematic_seen = true,
    updated_at = now();

  return true;
end;
$function$;

-- ---------------------------------------------------------------------------
-- TRAINER HQ
-- ---------------------------------------------------------------------------

create or replace function public.get_player_trainer_hq()
returns table (
  trainer_name text,
  wish_balance integer,
  daily_reward_available boolean,
  daily_reward_today integer,
  daily_streak integer,
  total_cards bigint,
  unique_cards bigint,
  available_cards bigint,
  collection_value numeric,
  shipping_threshold integer,
  shipping_unlocked boolean,
  shipment_status text,
  shipment_card_count integer,
  shipment_tracking_url text,
  zodiac_sign text,
  constellation_stars bigint,
  pending_friend_requests bigint,
  active_trades bigint,
  trade_needs_attention boolean,
  attention_trade_partner text,
  profile_complete boolean,
  first_wish_complete boolean,
  recent_wish_id uuid,
  recent_card_id text,
  recent_card_name text,
  recent_card_set text,
  recent_card_number text,
  recent_card_rarity text,
  recent_card_image_url text,
  recent_card_value numeric,
  recent_wish_at timestamptz,
  recommended_action_id text,
  recommended_action_title text,
  recommended_action_body text,
  recommended_action_href text,
  recommended_action_glyph text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_trainer_name text := 'Trainer';
  v_wish_balance integer := 0;
  v_daily_available boolean := true;
  v_daily_today integer := 0;
  v_daily_streak integer := 0;
  v_total_cards bigint := 0;
  v_unique_cards bigint := 0;
  v_available_cards bigint := 0;
  v_collection_value numeric := 0;
  v_shipping_threshold integer := 100;
  v_shipment_status text;
  v_shipment_card_count integer;
  v_shipment_tracking_url text;
  v_zodiac_sign text;
  v_constellation_stars bigint := 0;
  v_pending_friend_requests bigint := 0;
  v_active_trades bigint := 0;
  v_trade_needs_attention boolean := false;
  v_attention_trade_partner text;
  v_profile_complete boolean := false;
  v_first_wish_complete boolean := false;
  v_recent_wish_id uuid;
  v_recent_card_id text;
  v_recent_card_name text;
  v_recent_card_set text;
  v_recent_card_number text;
  v_recent_card_rarity text;
  v_recent_card_image_url text;
  v_recent_card_value numeric;
  v_recent_wish_at timestamptz;
  v_action_id text := 'wish';
  v_action_title text := 'Make another wish';
  v_action_body text := 'Add another real card to your Binder and constellation.';
  v_action_href text := '/wishes';
  v_action_glyph text := '✦';
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  select
    coalesce(
      nullif(trim(profiles.display_name), ''),
      nullif(trim(profiles.username), ''),
      'Trainer'
    ),
    nullif(trim(profiles.zodiac_sign), '')
  into v_trainer_name, v_zodiac_sign
  from public.player_profiles as profiles
  where profiles.user_id = v_user_id;

  select greatest(coalesce(wallets.wish_balance, 0), 0)::integer
  into v_wish_balance
  from public.player_wallets as wallets
  where wallets.user_id = v_user_id;

  v_wish_balance := coalesce(v_wish_balance, 0);

  select
    not coalesce(rewards.claimed_today, false),
    greatest(coalesce(rewards.reward_today, 0), 0),
    greatest(coalesce(rewards.current_streak, 0), 0)
  into v_daily_available, v_daily_today, v_daily_streak
  from public.get_daily_reward_status() as rewards
  limit 1;

  v_daily_available := coalesce(v_daily_available, true);
  v_daily_today := coalesce(v_daily_today, 0);
  v_daily_streak := coalesce(v_daily_streak, 0);

  select
    coalesce(sum(greatest(coalesce(inventory.quantity, 0), 0)), 0)::bigint,
    count(*) filter (where coalesce(inventory.quantity, 0) > 0)::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0) -
        least(
          greatest(coalesce(inventory.reserved_quantity, 0), 0),
          greatest(coalesce(inventory.quantity, 0), 0)
        )
      ),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0) *
        greatest(coalesce(cards.market_value, 0), 0)
      ),
      0
    )::numeric
  into
    v_total_cards,
    v_unique_cards,
    v_available_cards,
    v_collection_value
  from public.player_inventory as inventory
  left join public.pokemon_cards as cards
    on cards.id::text = inventory.card_id::text
  where inventory.user_id = v_user_id;

  select greatest(config.free_shipping_card_threshold, 1)
  into v_shipping_threshold
  from public.player_shipping_config as config
  where config.id = 1;

  v_shipping_threshold := greatest(coalesce(v_shipping_threshold, 100), 1);

  select
    shipments.status,
    shipments.card_count,
    nullif(trim(shipments.tracking_url), '')
  into
    v_shipment_status,
    v_shipment_card_count,
    v_shipment_tracking_url
  from public.player_shipping_shipments as shipments
  where shipments.user_id = v_user_id
  order by shipments.requested_at desc
  limit 1;

  select count(*)::bigint
  into v_pending_friend_requests
  from public.player_friendships as friendships
  where friendships.addressee_id = v_user_id
    and friendships.status = 'pending';

  select count(*)::bigint
  into v_active_trades
  from public.player_trades as trades
  where (trades.initiator_id = v_user_id or trades.recipient_id = v_user_id)
    and trades.status in ('open', 'countdown');

  select
    true,
    coalesce(
      nullif(trim(partner.display_name), ''),
      nullif('@' || trim(partner.username), '@'),
      'another trainer'
    )
  into v_trade_needs_attention, v_attention_trade_partner
  from public.player_trades as trades
  left join public.player_profiles as partner
    on partner.user_id = case
      when trades.initiator_id = v_user_id then trades.recipient_id
      else trades.initiator_id
    end
  where (trades.initiator_id = v_user_id or trades.recipient_id = v_user_id)
    and trades.status in ('open', 'countdown')
    and trades.last_action_by is distinct from v_user_id
  order by trades.updated_at desc
  limit 1;

  v_trade_needs_attention := coalesce(v_trade_needs_attention, false);

  select exists (
    select 1
    from public.player_profile_details as details
    where details.user_id = v_user_id
      and nullif(trim(details.favourite_pokemon), '') is not null
  )
  into v_profile_complete;

  select count(*)::bigint
  into v_constellation_stars
  from public.player_wishes as wishes
  where wishes.user_id = v_user_id;

  v_first_wish_complete := v_constellation_stars > 0;

  select
    wishes.id,
    wishes.card_id::text,
    coalesce(nullif(trim(cards.name), ''), 'Mystery card'),
    coalesce(nullif(trim(cards.set_name), ''), 'Unknown set'),
    coalesce(nullif(trim(cards.card_no), ''), '-'),
    coalesce(nullif(trim(cards.rarity), ''), 'Unlisted rarity'),
    nullif(trim(cards.image_url), ''),
    greatest(coalesce(wishes.market_value_at_wish, cards.market_value, 0), 0),
    wishes.created_at
  into
    v_recent_wish_id,
    v_recent_card_id,
    v_recent_card_name,
    v_recent_card_set,
    v_recent_card_number,
    v_recent_card_rarity,
    v_recent_card_image_url,
    v_recent_card_value,
    v_recent_wish_at
  from public.player_wishes as wishes
  left join public.pokemon_cards as cards
    on cards.id::text = wishes.card_id::text
  where wishes.user_id = v_user_id
  order by wishes.created_at desc
  limit 1;

  if v_trade_needs_attention then
    v_action_id := 'trade';
    v_action_title := format('Respond to %s''s trade', v_attention_trade_partner);
    v_action_body := 'The other trainer has changed or locked their side. Review it before confirming.';
    v_action_href := '/trade';
    v_action_glyph := '⇄';
  elsif not v_first_wish_complete and v_wish_balance > 0 then
    v_action_id := 'first-wish';
    v_action_title := 'Make your first wish';
    v_action_body := 'Your wish is ready. Reveal the first real card in your archive.';
    v_action_href := '/wishes';
    v_action_glyph := '✦';
  elsif not v_first_wish_complete and v_daily_available then
    v_action_id := 'daily-gift';
    v_action_title := 'Claim today''s gift';
    v_action_body := format('Jirachi is holding %s wish%s for you today.', v_daily_today, case when v_daily_today = 1 then '' else 'es' end);
    v_action_href := '/rewards';
    v_action_glyph := '◇';
  elsif v_zodiac_sign is null then
    v_action_id := 'zodiac';
    v_action_title := 'Choose your zodiac sign';
    v_action_body := 'Shape the ancient pattern behind your personal constellation.';
    v_action_href := '/profile';
    v_action_glyph := '✧';
  elsif not v_profile_complete then
    v_action_id := 'profile';
    v_action_title := 'Complete your profile';
    v_action_body := 'Choose your favourite Pokémon and finish your trainer identity.';
    v_action_href := '/profile';
    v_action_glyph := '◉';
  elsif v_available_cards >= v_shipping_threshold
    and coalesce(v_shipment_status, '') not in ('requested', 'packing', 'shipped') then
    v_action_id := 'shipping-ready';
    v_action_title := 'Your cards are ready to ship';
    v_action_body := format('%s available cards have unlocked free shipping.', v_available_cards);
    v_action_href := '/shipping';
    v_action_glyph := '▰';
  elsif v_shipment_status in ('requested', 'packing', 'shipped') then
    v_action_id := 'shipping';
    v_action_title := case v_shipment_status
      when 'shipped' then 'Track your card delivery'
      when 'packing' then 'Your cards are being packed'
      else 'Your shipment is requested'
    end;
    v_action_body := format('%s card%s are moving through the fulfilment journey.', coalesce(v_shipment_card_count, 0), case when coalesce(v_shipment_card_count, 0) = 1 then '' else 's' end);
    v_action_href := '/shipping';
    v_action_glyph := '▰';
  elsif v_daily_available then
    v_action_id := 'daily-gift';
    v_action_title := 'Claim today''s gift';
    v_action_body := format('Keep your %s-day streak moving and collect today''s wishes.', v_daily_streak);
    v_action_href := '/rewards';
    v_action_glyph := '◇';
  elsif v_wish_balance = 0 then
    v_action_id := 'wish-help';
    v_action_title := 'Speak to a Founder for more pulls';
    v_action_body := 'Orders are not open yet, but a Founder can help you continue pulling.';
    v_action_href := '/help';
    v_action_glyph := '?';
  end if;

  return query
  select
    v_trainer_name,
    v_wish_balance,
    v_daily_available,
    v_daily_today,
    v_daily_streak,
    v_total_cards,
    v_unique_cards,
    v_available_cards,
    v_collection_value,
    v_shipping_threshold,
    v_available_cards >= v_shipping_threshold,
    v_shipment_status,
    v_shipment_card_count,
    v_shipment_tracking_url,
    v_zodiac_sign,
    v_constellation_stars,
    v_pending_friend_requests,
    v_active_trades,
    v_trade_needs_attention,
    v_attention_trade_partner,
    v_profile_complete,
    v_first_wish_complete,
    v_recent_wish_id,
    v_recent_card_id,
    v_recent_card_name,
    v_recent_card_set,
    v_recent_card_number,
    v_recent_card_rarity,
    v_recent_card_image_url,
    v_recent_card_value,
    v_recent_wish_at,
    v_action_id,
    v_action_title,
    v_action_body,
    v_action_href,
    v_action_glyph;
end;
$function$;

revoke all on function public.get_player_preferences() from public;
revoke all on function public.update_player_preferences(integer, integer, boolean, boolean, boolean, boolean, boolean) from public;
revoke all on function public.mark_player_cinematic_seen() from public;
revoke all on function public.get_player_trainer_hq() from public;

grant execute on function public.get_player_preferences()
  to authenticated;
grant execute on function public.update_player_preferences(integer, integer, boolean, boolean, boolean, boolean, boolean)
  to authenticated;
grant execute on function public.mark_player_cinematic_seen()
  to authenticated;
grant execute on function public.get_player_trainer_hq()
  to authenticated;

commit;
