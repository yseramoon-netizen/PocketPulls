-- Unown Pulls V41
-- Player notification centre and guided first-wish journey.

begin;

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null
    or to_regclass('public.player_profile_details') is null
    or to_regclass('public.player_wallets') is null
    or to_regclass('public.player_wishes') is null
    or to_regclass('public.player_daily_rewards') is null
    or to_regclass('public.player_achievements') is null
    or to_regclass('public.player_friendships') is null
    or to_regclass('public.player_trades') is null
    or to_regclass('public.player_shipping_shipments') is null then
    raise exception
      'Player notifications need the existing player, rewards, friends, trade and shipping migrations first.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- NOTIFICATION STATE
-- ---------------------------------------------------------------------------

create table if not exists public.player_notification_reads (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  notification_key text not null,
  read_at timestamptz not null default now(),

  primary key (user_id, notification_key),

  constraint player_notification_reads_key_length
    check (char_length(notification_key) between 1 and 180)
);

create index if not exists player_notification_reads_user_time_idx
  on public.player_notification_reads(user_id, read_at desc);

alter table public.player_notification_reads enable row level security;

drop policy if exists "Players can read their notification state"
  on public.player_notification_reads;

create policy "Players can read their notification state"
  on public.player_notification_reads
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete
  on public.player_notification_reads
  from anon, authenticated;

grant select
  on public.player_notification_reads
  to authenticated;

-- Founder announcements are deliberately empty after this migration. Founders
-- can add a message later through a trusted service/admin connection without
-- inventing an announcement on their behalf.
create table if not exists public.founder_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  href text,
  glyph text not null default '✦',
  priority integer not null default 30,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint founder_announcements_title_length
    check (char_length(title) between 1 and 120),

  constraint founder_announcements_body_length
    check (char_length(body) between 1 and 700),

  constraint founder_announcements_href_format
    check (href is null or (char_length(href) between 1 and 240 and href like '/%')),

  constraint founder_announcements_glyph_length
    check (char_length(glyph) between 1 and 8),

  constraint founder_announcements_priority_range
    check (priority between 0 and 1000),

  constraint founder_announcements_expiry_order
    check (expires_at is null or expires_at > published_at)
);

create index if not exists founder_announcements_feed_idx
  on public.founder_announcements(active, published_at desc);

alter table public.founder_announcements enable row level security;

drop policy if exists "Players can read live founder announcements"
  on public.founder_announcements;

create policy "Players can read live founder announcements"
  on public.founder_announcements
  for select
  to authenticated
  using (
    active = true
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

revoke insert, update, delete
  on public.founder_announcements
  from anon, authenticated;

grant select
  on public.founder_announcements
  to authenticated;

create or replace function public.get_player_notifications(
  p_limit integer default 40
)
returns table (
  notification_key text,
  kind text,
  title text,
  body text,
  href text,
  glyph text,
  created_at timestamptz,
  read_at timestamptz,
  priority integer
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

  if to_regprocedure('public.sync_player_achievements()') is not null then
    perform public.sync_player_achievements();
  end if;

  return query
  with notification_rows as (
    select
      ('friend-request:' || friendships.id::text)::text as notification_key,
      'friend'::text as kind,
      'New friend request'::text as title,
      format(
        '%s wants to be friends.',
        coalesce(
          nullif(trim(profiles.display_name), ''),
          nullif('@' || trim(profiles.username), '@'),
          'A trainer'
        )
      )::text as body,
      '/friends'::text as href,
      '♢'::text as glyph,
      friendships.created_at,
      100::integer as priority
    from public.player_friendships as friendships
    left join public.player_profiles as profiles
      on profiles.user_id = friendships.requester_id
    where friendships.addressee_id = v_user_id
      and friendships.status = 'pending'

    union all

    select
      ('friend-accepted:' || friendships.id::text)::text,
      'friend'::text,
      'Friend request accepted'::text,
      format(
        '%s joined your circle of trainers.',
        coalesce(
          nullif(trim(profiles.display_name), ''),
          nullif('@' || trim(profiles.username), '@'),
          'A trainer'
        )
      )::text,
      '/friends'::text,
      '♢'::text,
      coalesce(friendships.accepted_at, friendships.updated_at),
      90::integer
    from public.player_friendships as friendships
    left join public.player_profiles as profiles
      on profiles.user_id = friendships.addressee_id
    where friendships.requester_id = v_user_id
      and friendships.status = 'accepted'

    union all

    select
      (
        'trade:' || trades.id::text || ':' || trades.status || ':' ||
        trades.revision::text
      )::text,
      'trade'::text,
      case trades.status
        when 'countdown' then 'Trade ready to confirm'
        when 'completed' then 'Trade completed'
        when 'cancelled' then 'Trade cancelled'
        else 'Trade updated'
      end::text,
      format(
        '%s %s',
        coalesce(
          nullif(trim(profiles.display_name), ''),
          nullif('@' || trim(profiles.username), '@'),
          'The other trainer'
        ),
        case trades.status
          when 'countdown' then 'has locked their side of the trade.'
          when 'completed' then 'completed the card exchange with you.'
          when 'cancelled' then 'closed this trade.'
          else 'changed your shared trade.'
        end
      )::text,
      '/trade'::text,
      '⇄'::text,
      trades.updated_at,
      case trades.status
        when 'countdown' then 95
        when 'completed' then 88
        when 'cancelled' then 75
        else 85
      end::integer
    from public.player_trades as trades
    left join public.player_profiles as profiles
      on profiles.user_id = case
        when trades.initiator_id = v_user_id then trades.recipient_id
        else trades.initiator_id
      end
    where (trades.initiator_id = v_user_id or trades.recipient_id = v_user_id)
      and trades.last_action_by is distinct from v_user_id

    union all

    select
      ('achievement:' || achievements.achievement_key)::text,
      'achievement'::text,
      'Achievement reward ready'::text,
      format(
        '%s is unlocked. Claim %s bonus wish%s.',
        initcap(replace(achievements.achievement_key, '_', ' ')),
        achievements.reward_wishes,
        case when achievements.reward_wishes = 1 then '' else 'es' end
      )::text,
      '/achievements'::text,
      '✪'::text,
      achievements.unlocked_at,
      86::integer
    from public.player_achievements as achievements
    where achievements.user_id = v_user_id
      and achievements.reward_wishes > 0
      and achievements.reward_claimed_at is null

    union all

    select
      ('daily-gift:' || current_date::text)::text,
      'reward'::text,
      'Your Daily Gift is ready'::text,
      format(
        'Day %s holds %s wish%s. Claim it before the date changes.',
        reward_status.cycle_day,
        reward_status.reward_today,
        case when reward_status.reward_today = 1 then '' else 'es' end
      )::text,
      '/rewards'::text,
      '◇'::text,
      date_trunc('day', now()),
      82::integer
    from public.get_daily_reward_status() as reward_status
    where reward_status.claimed_today = false

    union all

    select
      ('shipment:' || shipments.id::text || ':' || shipments.status)::text,
      'shipping'::text,
      case shipments.status
        when 'packing' then 'Your cards are being packed'
        when 'shipped' then 'Your cards are on the way'
        when 'delivered' then 'Your delivery has arrived'
        else 'Your shipment was cancelled'
      end::text,
      format(
        '%s card%s %s',
        shipments.card_count,
        case when shipments.card_count = 1 then '' else 's' end,
        case shipments.status
          when 'packing' then 'are being prepared by the Founders.'
          when 'shipped' then 'have left the archive.'
          when 'delivered' then 'have completed their journey to you.'
          else 'will remain safely in your collection.'
        end
      )::text,
      '/shipping'::text,
      '▰'::text,
      case shipments.status
        when 'packing' then coalesce(shipments.packed_at, shipments.requested_at)
        when 'shipped' then coalesce(shipments.shipped_at, shipments.requested_at)
        when 'delivered' then coalesce(shipments.delivered_at, shipments.requested_at)
        when 'cancelled' then coalesce(shipments.cancelled_at, shipments.requested_at)
        else shipments.requested_at
      end,
      case shipments.status
        when 'shipped' then 92
        when 'delivered' then 90
        when 'packing' then 78
        else 70
      end::integer
    from public.player_shipping_shipments as shipments
    where shipments.user_id = v_user_id
      and shipments.status in ('packing', 'shipped', 'delivered', 'cancelled')

    union all

    select
      ('founder:' || announcements.id::text)::text,
      'announcement'::text,
      announcements.title,
      announcements.body,
      announcements.href,
      announcements.glyph,
      announcements.published_at,
      announcements.priority
    from public.founder_announcements as announcements
    where announcements.active = true
      and announcements.published_at <= now()
      and (announcements.expires_at is null or announcements.expires_at > now())
  )
  select
    rows.notification_key,
    rows.kind,
    rows.title,
    rows.body,
    rows.href,
    rows.glyph,
    rows.created_at,
    reads.read_at,
    rows.priority
  from notification_rows as rows
  left join public.player_notification_reads as reads
    on reads.user_id = v_user_id
   and reads.notification_key = rows.notification_key
  order by
    (reads.read_at is null) desc,
    rows.priority desc,
    rows.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$function$;

create or replace function public.mark_player_notification_read(
  p_notification_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_key text := nullif(trim(coalesce(p_notification_key, '')), '');
  v_rows integer := 0;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if v_key is not null and char_length(v_key) > 180 then
    raise exception using
      errcode = '22023',
      message = 'That notification key is invalid.';
  end if;

  if v_key is null then
    insert into public.player_notification_reads (
      user_id,
      notification_key,
      read_at
    )
    select
      v_user_id,
      notifications.notification_key,
      now()
    from public.get_player_notifications(100) as notifications
    where notifications.read_at is null
    on conflict (user_id, notification_key)
    do update set read_at = excluded.read_at;
  else
    insert into public.player_notification_reads (
      user_id,
      notification_key,
      read_at
    )
    values (v_user_id, v_key, now())
    on conflict (user_id, notification_key)
    do update set read_at = excluded.read_at;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- FIRST-WISH JOURNEY
-- ---------------------------------------------------------------------------

create table if not exists public.player_onboarding_progress (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  intro_seen_at timestamptz,
  binder_seen_at timestamptz,
  constellation_seen_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_onboarding_progress enable row level security;

drop policy if exists "Players can read their onboarding journey"
  on public.player_onboarding_progress;

create policy "Players can read their onboarding journey"
  on public.player_onboarding_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete
  on public.player_onboarding_progress
  from anon, authenticated;

grant select
  on public.player_onboarding_progress
  to authenticated;

create or replace function public.mark_player_onboarding_stage(
  p_stage text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_stage text := lower(trim(coalesce(p_stage, '')));
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if v_stage not in ('intro', 'binder', 'constellation') then
    raise exception using
      errcode = '22023',
      message = 'That onboarding stage is invalid.';
  end if;

  insert into public.player_onboarding_progress as progress (
    user_id,
    intro_seen_at,
    binder_seen_at,
    constellation_seen_at,
    updated_at
  )
  values (
    v_user_id,
    case when v_stage = 'intro' then now() end,
    case when v_stage = 'binder' then now() end,
    case when v_stage = 'constellation' then now() end,
    now()
  )
  on conflict (user_id)
  do update set
    intro_seen_at = coalesce(
      progress.intro_seen_at,
      excluded.intro_seen_at
    ),
    binder_seen_at = coalesce(
      progress.binder_seen_at,
      excluded.binder_seen_at
    ),
    constellation_seen_at = coalesce(
      progress.constellation_seen_at,
      excluded.constellation_seen_at
    ),
    updated_at = now();

  return true;
end;
$function$;

create or replace function public.get_player_onboarding_journey()
returns table (
  intro_seen boolean,
  profile_complete boolean,
  zodiac_complete boolean,
  daily_reward_available boolean,
  wish_ready boolean,
  first_wish_complete boolean,
  binder_seen boolean,
  constellation_seen boolean,
  completed boolean,
  current_step text,
  completed_steps integer,
  total_steps integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_progress public.player_onboarding_progress%rowtype;
  v_profile_complete boolean := false;
  v_zodiac_complete boolean := false;
  v_daily_reward_available boolean := true;
  v_wish_ready boolean := false;
  v_first_wish_complete boolean := false;
  v_binder_seen boolean := false;
  v_constellation_seen boolean := false;
  v_completed boolean := false;
  v_completed_steps integer := 0;
  v_current_step text := 'profile';
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  insert into public.player_onboarding_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select progress.*
  into v_progress
  from public.player_onboarding_progress as progress
  where progress.user_id = v_user_id;

  select exists (
    select 1
    from public.player_profile_details as details
    where details.user_id = v_user_id
      and nullif(trim(details.favourite_pokemon), '') is not null
  )
  into v_profile_complete;

  select exists (
    select 1
    from public.player_profiles as profiles
    where profiles.user_id = v_user_id
      and nullif(trim(profiles.zodiac_sign), '') is not null
  )
  into v_zodiac_complete;

  select not coalesce(status.claimed_today, false)
  into v_daily_reward_available
  from public.get_daily_reward_status() as status
  limit 1;

  v_daily_reward_available := coalesce(v_daily_reward_available, true);

  select exists (
    select 1
    from public.player_wishes as wishes
    where wishes.user_id = v_user_id
  )
  into v_first_wish_complete;

  select exists (
    select 1
    from public.player_wallets as wallets
    where wallets.user_id = v_user_id
      and greatest(coalesce(wallets.wish_balance, 0), 0) > 0
  ) or v_first_wish_complete
  into v_wish_ready;

  v_binder_seen :=
    v_progress.binder_seen_at is not null and v_first_wish_complete;

  v_constellation_seen :=
    v_progress.constellation_seen_at is not null and v_first_wish_complete;

  v_completed_steps :=
    (case when v_profile_complete then 1 else 0 end) +
    (case when v_zodiac_complete then 1 else 0 end) +
    (case when v_wish_ready then 1 else 0 end) +
    (case when v_first_wish_complete then 1 else 0 end) +
    (case when v_binder_seen then 1 else 0 end) +
    (case when v_constellation_seen then 1 else 0 end);

  v_completed :=
    v_progress.completed_at is not null
    or v_completed_steps = 6;

  if v_completed and v_progress.completed_at is null then
    update public.player_onboarding_progress
    set
      completed_at = now(),
      updated_at = now()
    where user_id = v_user_id;
  end if;

  if v_completed then
    v_completed_steps := 6;
    v_current_step := 'complete';
  elsif not v_profile_complete then
    v_current_step := 'profile';
  elsif not v_zodiac_complete then
    v_current_step := 'zodiac';
  elsif not v_wish_ready then
    v_current_step := 'reward';
  elsif not v_first_wish_complete then
    v_current_step := 'wish';
  elsif not v_binder_seen then
    v_current_step := 'binder';
  else
    v_current_step := 'constellation';
  end if;

  return query
  select
    v_progress.intro_seen_at is not null,
    v_profile_complete,
    v_zodiac_complete,
    v_daily_reward_available,
    v_wish_ready,
    v_first_wish_complete,
    v_binder_seen,
    v_constellation_seen,
    v_completed,
    v_current_step,
    v_completed_steps,
    6::integer;
end;
$function$;

revoke all on function public.get_player_notifications(integer) from public;
revoke all on function public.mark_player_notification_read(text) from public;
revoke all on function public.mark_player_onboarding_stage(text) from public;
revoke all on function public.get_player_onboarding_journey() from public;

grant execute on function public.get_player_notifications(integer)
  to authenticated;
grant execute on function public.mark_player_notification_read(text)
  to authenticated;
grant execute on function public.mark_player_onboarding_stage(text)
  to authenticated;
grant execute on function public.get_player_onboarding_journey()
  to authenticated;

commit;
