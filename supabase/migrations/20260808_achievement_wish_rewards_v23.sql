-- Unown Pulls V23
-- Expanded achievements + one-time free-wish rewards.

begin;

alter table public.player_achievements
  add column if not exists reward_wishes integer not null default 0,
  add column if not exists reward_claimed_at timestamptz;

create or replace function public.sync_player_achievements()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_wishes bigint := 0;
  v_cards bigint := 0;
  v_unique_cards bigint := 0;
  v_available bigint := 0;
  v_value numeric := 0;
  v_high_rarity bigint := 0;
  v_best_card numeric := 0;
  v_streak integer := 0;
  v_threshold integer := 100;
  v_deliveries bigint := 0;
  v_rows integer := 0;
begin
  if v_user_id is null then
    return 0;
  end if;

  select greatest(coalesce(wallets.lifetime_wishes_spent, 0), 0)
  into v_wishes
  from public.player_wallets as wallets
  where wallets.user_id = v_user_id;

  select
    coalesce(sum(greatest(coalesce(inventory.quantity, 0), 0)), 0)::bigint,
    coalesce(count(*) filter (where coalesce(inventory.quantity, 0) > 0), 0)::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(coalesce(inventory.reserved_quantity, 0), 0),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ),
      0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        * greatest(coalesce(cards.market_value, 0), 0)
      ),
      0
    )::numeric,
    coalesce(
      sum(
        case
          when lower(coalesce(cards.rarity, '')) ~
            '(double rare|ultra rare|illustration rare|special illustration|special art|alternate art|hyper rare|secret rare|gold rare|crown rare|full art|rainbow rare|ace spec|amazing rare)'
          then greatest(coalesce(inventory.quantity, 0), 0)
          else 0
        end
      ),
      0
    )::bigint,
    coalesce(
      max(
        case
          when coalesce(inventory.quantity, 0) > 0
          then greatest(coalesce(cards.market_value, 0), 0)
          else 0
        end
      ),
      0
    )::numeric
  into
    v_cards,
    v_unique_cards,
    v_available,
    v_value,
    v_high_rarity,
    v_best_card
  from public.player_inventory as inventory
  left join public.pokemon_cards as cards
    on cards.id::text = inventory.card_id::text
  where inventory.user_id = v_user_id;

  if to_regclass('public.player_daily_rewards') is not null then
    select
      case
        when rewards.last_claim_date >= current_date - 1
          then greatest(rewards.current_streak, 0)
        else 0
      end
    into v_streak
    from public.player_daily_rewards as rewards
    where rewards.user_id = v_user_id;
  end if;

  if to_regclass('public.player_shipping_config') is not null then
    select config.free_shipping_card_threshold
    into v_threshold
    from public.player_shipping_config as config
    where config.id = 1;
  end if;

  if to_regclass('public.player_shipping_shipments') is not null then
    select count(*)::bigint
    into v_deliveries
    from public.player_shipping_shipments as shipments
    where shipments.user_id = v_user_id
      and shipments.status = 'delivered';
  end if;

  v_wishes := coalesce(v_wishes, 0);
  v_cards := coalesce(v_cards, 0);
  v_unique_cards := coalesce(v_unique_cards, 0);
  v_available := coalesce(v_available, 0);
  v_value := coalesce(v_value, 0);
  v_high_rarity := coalesce(v_high_rarity, 0);
  v_best_card := coalesce(v_best_card, 0);
  v_streak := coalesce(v_streak, 0);
  v_threshold := greatest(coalesce(v_threshold, 100), 1);
  v_deliveries := coalesce(v_deliveries, 0);

  insert into public.player_achievements (
    user_id,
    achievement_key,
    reward_wishes
  )
  select
    v_user_id,
    unlocked.achievement_key,
    unlocked.reward_wishes
  from (
    values
      ('first_wish', v_wishes >= 1, 1),
      ('wish_apprentice', v_wishes >= 10, 2),
      ('wish_seeker', v_wishes >= 25, 3),
      ('constellation_keeper', v_wishes >= 50, 5),
      ('wish_master', v_wishes >= 100, 8),
      ('wish_sage', v_wishes >= 250, 15),
      ('wish_legend', v_wishes >= 500, 25),
      ('thousand_wishes', v_wishes >= 1000, 50),

      ('first_card', v_cards >= 1, 1),
      ('collector_25', v_cards >= 25, 2),
      ('collector_100', v_cards >= 100, 5),
      ('collector_250', v_cards >= 250, 10),
      ('collector_500', v_cards >= 500, 20),
      ('collector_1000', v_cards >= 1000, 40),

      ('unique_10', v_unique_cards >= 10, 1),
      ('unique_50', v_unique_cards >= 50, 3),
      ('unique_100', v_unique_cards >= 100, 6),
      ('unique_250', v_unique_cards >= 250, 12),

      ('treasure_10', v_value >= 10, 1),
      ('treasure_50', v_value >= 50, 2),
      ('treasure_100', v_value >= 100, 4),
      ('treasure_250', v_value >= 250, 8),
      ('treasure_500', v_value >= 500, 15),
      ('treasure_1000', v_value >= 1000, 30),

      ('rare_first', v_high_rarity >= 1, 2),
      ('rare_five', v_high_rarity >= 5, 5),
      ('rare_twenty', v_high_rarity >= 20, 12),
      ('best_card_25', v_best_card >= 25, 3),
      ('best_card_100', v_best_card >= 100, 10),
      ('best_card_500', v_best_card >= 500, 25),

      ('streak_3', v_streak >= 3, 1),
      ('streak_7', v_streak >= 7, 2),
      ('streak_14', v_streak >= 14, 4),
      ('streak_30', v_streak >= 30, 8),
      ('streak_100', v_streak >= 100, 25),

      ('shipping_ready', v_available >= v_threshold, 3),
      ('first_delivery', v_deliveries >= 1, 5),
      ('five_deliveries', v_deliveries >= 5, 15)
  ) as unlocked(achievement_key, achieved, reward_wishes)
  where unlocked.achieved
  on conflict (user_id, achievement_key)
  do update set reward_wishes = excluded.reward_wishes;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

create or replace function public.get_player_achievements()
returns table (
  achievement_key text,
  title text,
  description text,
  category text,
  icon text,
  current_value numeric,
  target_value numeric,
  progress_percent numeric,
  reward_wishes integer,
  reward_claimed_at timestamptz,
  unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_wishes bigint := 0;
  v_cards bigint := 0;
  v_unique_cards bigint := 0;
  v_available bigint := 0;
  v_value numeric := 0;
  v_high_rarity bigint := 0;
  v_best_card numeric := 0;
  v_streak integer := 0;
  v_threshold integer := 100;
  v_deliveries bigint := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform public.sync_player_achievements();

  select greatest(coalesce(wallets.lifetime_wishes_spent, 0), 0)
  into v_wishes
  from public.player_wallets as wallets
  where wallets.user_id = v_user_id;

  select
    coalesce(sum(greatest(coalesce(inventory.quantity, 0), 0)), 0)::bigint,
    coalesce(count(*) filter (where coalesce(inventory.quantity, 0) > 0), 0)::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        - least(
            greatest(coalesce(inventory.reserved_quantity, 0), 0),
            greatest(coalesce(inventory.quantity, 0), 0)
          )
      ), 0
    )::bigint,
    coalesce(
      sum(
        greatest(coalesce(inventory.quantity, 0), 0)
        * greatest(coalesce(cards.market_value, 0), 0)
      ), 0
    )::numeric,
    coalesce(
      sum(
        case
          when lower(coalesce(cards.rarity, '')) ~
            '(double rare|ultra rare|illustration rare|special illustration|special art|alternate art|hyper rare|secret rare|gold rare|crown rare|full art|rainbow rare|ace spec|amazing rare)'
          then greatest(coalesce(inventory.quantity, 0), 0)
          else 0
        end
      ), 0
    )::bigint,
    coalesce(
      max(
        case
          when coalesce(inventory.quantity, 0) > 0
          then greatest(coalesce(cards.market_value, 0), 0)
          else 0
        end
      ), 0
    )::numeric
  into
    v_cards,
    v_unique_cards,
    v_available,
    v_value,
    v_high_rarity,
    v_best_card
  from public.player_inventory as inventory
  left join public.pokemon_cards as cards
    on cards.id::text = inventory.card_id::text
  where inventory.user_id = v_user_id;

  if to_regclass('public.player_daily_rewards') is not null then
    select
      case
        when rewards.last_claim_date >= current_date - 1
          then greatest(rewards.current_streak, 0)
        else 0
      end
    into v_streak
    from public.player_daily_rewards as rewards
    where rewards.user_id = v_user_id;
  end if;

  if to_regclass('public.player_shipping_config') is not null then
    select config.free_shipping_card_threshold
    into v_threshold
    from public.player_shipping_config as config
    where config.id = 1;
  end if;

  if to_regclass('public.player_shipping_shipments') is not null then
    select count(*)::bigint
    into v_deliveries
    from public.player_shipping_shipments as shipments
    where shipments.user_id = v_user_id
      and shipments.status = 'delivered';
  end if;

  v_wishes := coalesce(v_wishes, 0);
  v_cards := coalesce(v_cards, 0);
  v_unique_cards := coalesce(v_unique_cards, 0);
  v_available := coalesce(v_available, 0);
  v_value := coalesce(v_value, 0);
  v_high_rarity := coalesce(v_high_rarity, 0);
  v_best_card := coalesce(v_best_card, 0);
  v_streak := coalesce(v_streak, 0);
  v_threshold := greatest(coalesce(v_threshold, 100), 1);
  v_deliveries := coalesce(v_deliveries, 0);

  return query
  with definitions as (
    select *
    from (
      values
        ('first_wish','First Light','Complete your first wish.','Wishes','★',v_wishes::numeric,1::numeric,1),
        ('wish_apprentice','Wish Apprentice','Complete 10 wishes.','Wishes','✦',v_wishes::numeric,10::numeric,2),
        ('wish_seeker','Star Seeker','Complete 25 wishes.','Wishes','✧',v_wishes::numeric,25::numeric,3),
        ('constellation_keeper','Constellation Keeper','Complete 50 wishes.','Wishes','☄',v_wishes::numeric,50::numeric,5),
        ('wish_master','Wish Master','Complete 100 wishes.','Wishes','✹',v_wishes::numeric,100::numeric,8),
        ('wish_sage','Wish Sage','Complete 250 wishes.','Wishes','✺',v_wishes::numeric,250::numeric,15),
        ('wish_legend','Starbound Legend','Complete 500 wishes.','Wishes','✵',v_wishes::numeric,500::numeric,25),
        ('thousand_wishes','A Thousand Stars','Complete 1,000 wishes.','Wishes','✷',v_wishes::numeric,1000::numeric,50),

        ('first_card','The First Card','Own your first card.','Collection','◆',v_cards::numeric,1::numeric,1),
        ('collector_25','Growing Binder','Own 25 cards.','Collection','◇',v_cards::numeric,25::numeric,2),
        ('collector_100','Hundred Card Archive','Own 100 cards.','Collection','▣',v_cards::numeric,100::numeric,5),
        ('collector_250','Binder Keeper','Own 250 cards.','Collection','▤',v_cards::numeric,250::numeric,10),
        ('collector_500','Deep Archive','Own 500 cards.','Collection','▥',v_cards::numeric,500::numeric,20),
        ('collector_1000','Living Pokédex Energy','Own 1,000 cards.','Collection','▦',v_cards::numeric,1000::numeric,40),

        ('unique_10','Ten Different Stars','Own 10 unique cards.','Unique','◈',v_unique_cards::numeric,10::numeric,1),
        ('unique_50','No Two Skies Alike','Own 50 unique cards.','Unique','◉',v_unique_cards::numeric,50::numeric,3),
        ('unique_100','Century of Faces','Own 100 unique cards.','Unique','◎',v_unique_cards::numeric,100::numeric,6),
        ('unique_250','Archive of Worlds','Own 250 unique cards.','Unique','◌',v_unique_cards::numeric,250::numeric,12),

        ('treasure_10','Pocket Treasure','Build a collection worth £10.','Value','£',v_value,10::numeric,1),
        ('treasure_50','Little Vault','Build a collection worth £50.','Value','♢',v_value,50::numeric,2),
        ('treasure_100','Vault of Starlight','Build a collection worth £100.','Value','♧',v_value,100::numeric,4),
        ('treasure_250','Golden Shelf','Build a collection worth £250.','Value','♤',v_value,250::numeric,8),
        ('treasure_500','Collector''s Vault','Build a collection worth £500.','Value','♛',v_value,500::numeric,15),
        ('treasure_1000','Four-Figure Constellation','Build a collection worth £1,000.','Value','♚',v_value,1000::numeric,30),

        ('rare_first','A Different Glow','Own your first high-rarity card.','Rarity','✶',v_high_rarity::numeric,1::numeric,2),
        ('rare_five','Five Bright Stars','Own 5 high-rarity cards.','Rarity','✸',v_high_rarity::numeric,5::numeric,5),
        ('rare_twenty','Rare Constellation','Own 20 high-rarity cards.','Rarity','✺',v_high_rarity::numeric,20::numeric,12),
        ('best_card_25','A £25 Star','Own a card valued at £25 or more.','Rarity','♦',v_best_card,25::numeric,3),
        ('best_card_100','Triple-Digit Pull','Own a card valued at £100 or more.','Rarity','♢',v_best_card,100::numeric,10),
        ('best_card_500','Legendary Treasure','Own a card valued at £500 or more.','Rarity','♛',v_best_card,500::numeric,25),

        ('streak_3','Three Nights','Claim gifts for 3 consecutive days.','Streak','☾',v_streak::numeric,3::numeric,1),
        ('streak_7','Week of Wishes','Claim gifts for 7 consecutive days.','Streak','☀',v_streak::numeric,7::numeric,2),
        ('streak_14','Fortnight Sky','Claim gifts for 14 consecutive days.','Streak','☽',v_streak::numeric,14::numeric,4),
        ('streak_30','Jirachi''s Chosen','Claim gifts for 30 consecutive days.','Streak','♛',v_streak::numeric,30::numeric,8),
        ('streak_100','Hundred-Day Star','Claim gifts for 100 consecutive days.','Streak','✹',v_streak::numeric,100::numeric,25),

        ('shipping_ready','Ready for the Journey','Reach the free-shipping card threshold.','Shipping','⌂',v_available::numeric,v_threshold::numeric,3),
        ('first_delivery','Home Among the Stars','Receive your first completed shipment.','Shipping','▰',v_deliveries::numeric,1::numeric,5),
        ('five_deliveries','Well Travelled','Receive 5 completed shipments.','Shipping','▱',v_deliveries::numeric,5::numeric,15)
    ) as values_table(
      achievement_key,
      title,
      description,
      category,
      icon,
      current_value,
      target_value,
      reward_wishes
    )
  )
  select
    definitions.achievement_key,
    definitions.title,
    definitions.description,
    definitions.category,
    definitions.icon,
    definitions.current_value,
    definitions.target_value,
    least(
      100::numeric,
      greatest(
        0::numeric,
        case
          when definitions.target_value <= 0 then 100
          else definitions.current_value / definitions.target_value * 100
        end
      )
    ),
    definitions.reward_wishes,
    achievements.reward_claimed_at,
    achievements.unlocked_at
  from definitions
  left join public.player_achievements as achievements
    on achievements.user_id = v_user_id
    and achievements.achievement_key = definitions.achievement_key
  order by
    (achievements.unlocked_at is not null and achievements.reward_claimed_at is null) desc,
    (achievements.unlocked_at is not null) desc,
    definitions.category,
    definitions.target_value;
end;
$function$;

create or replace function public.claim_player_achievement_reward(
  p_achievement_key text
)
returns table (
  achievement_key text,
  reward_wishes integer,
  wish_balance integer,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reward integer := 0;
  v_claimed_at timestamptz;
  v_new_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  perform public.sync_player_achievements();

  select
    achievements.reward_wishes,
    achievements.reward_claimed_at
  into
    v_reward,
    v_claimed_at
  from public.player_achievements as achievements
  where achievements.user_id = v_user_id
    and achievements.achievement_key = p_achievement_key
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'That badge is not unlocked yet.';
  end if;

  if v_claimed_at is not null then
    raise exception using errcode = 'P0001', message = 'That badge reward has already been claimed.';
  end if;

  v_reward := greatest(coalesce(v_reward, 0), 0);

  if v_reward <= 0 then
    raise exception using errcode = 'P0001', message = 'That badge has no wish reward.';
  end if;

  update public.player_wallets as wallets
  set wish_balance = coalesce(wallets.wish_balance, 0) + v_reward
  where wallets.user_id = v_user_id
  returning wallets.wish_balance into v_new_balance;

  if v_new_balance is null then
    raise exception using errcode = 'P0001', message = 'Your wish wallet could not be updated.';
  end if;

  update public.player_achievements as achievements
  set reward_claimed_at = now()
  where achievements.user_id = v_user_id
    and achievements.achievement_key = p_achievement_key
  returning achievements.reward_claimed_at into v_claimed_at;

  return query
  select p_achievement_key, v_reward, v_new_balance, v_claimed_at;
end;
$function$;

revoke all on function public.sync_player_achievements() from public;
revoke all on function public.get_player_achievements() from public;
revoke all on function public.claim_player_achievement_reward(text) from public;

grant execute on function public.sync_player_achievements() to authenticated;
grant execute on function public.get_player_achievements() to authenticated;
grant execute on function public.claim_player_achievement_reward(text) to authenticated;

commit;
