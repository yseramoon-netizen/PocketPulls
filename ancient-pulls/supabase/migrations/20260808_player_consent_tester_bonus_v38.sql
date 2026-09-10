-- Unown Pulls V38
-- Account-level purchase consent + one-time 10-wish tester signup grant.
-- Safe to re-run. Existing accounts do NOT receive the tester signup grant.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception 'public.player_profiles is missing.';
  end if;

  if to_regclass('public.player_wallets') is null then
    raise exception 'public.player_wallets is missing.';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- ACCOUNT-LEVEL PURCHASE CONSENT
-- ---------------------------------------------------------------------------

create table if not exists public.player_legal_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null,
  age_18_confirmed boolean not null default false,
  random_physical_card_ack boolean not null default false,
  terms_ack boolean not null default false,
  source text not null default 'account_gate',
  accepted_at timestamptz not null default now(),
  primary key (user_id, consent_version)
);

alter table public.player_legal_consents enable row level security;

revoke all on table public.player_legal_consents from anon, authenticated;
grant select on table public.player_legal_consents to service_role;

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
    ) as accepted,
    '2026-08-08-v1'::text as consent_version,
    consent.accepted_at
  from (select auth.uid() as user_id) as current_player
  left join public.player_legal_consents as consent
    on consent.user_id = current_player.user_id
   and consent.consent_version = '2026-08-08-v1'
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
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to save this acknowledgement.';
  end if;

  if p_age_18 is not true
     or p_random_physical_card is not true
     or p_terms is not true then
    raise exception using
      errcode = '22023',
      message = 'All account and purchase acknowledgements must be accepted.';
  end if;

  insert into public.player_legal_consents (
    user_id,
    consent_version,
    age_18_confirmed,
    random_physical_card_ack,
    terms_ack,
    source,
    accepted_at
  )
  values (
    v_user_id,
    '2026-08-08-v1',
    true,
    true,
    true,
    'existing_account_gate',
    v_accepted_at
  )
  on conflict (user_id, consent_version)
  do update set
    age_18_confirmed = true,
    random_physical_card_ack = true,
    terms_ack = true,
    source = excluded.source,
    accepted_at = excluded.accepted_at;

  return query
  select
    true,
    '2026-08-08-v1'::text,
    v_accepted_at;
end;
$function$;

revoke all on function public.get_player_purchase_consent() from public;
revoke all on function public.accept_player_purchase_consent(boolean, boolean, boolean) from public;

grant execute on function public.get_player_purchase_consent() to authenticated;
grant execute on function public.accept_player_purchase_consent(boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- TESTER SIGNUP PROMOTION
-- ---------------------------------------------------------------------------

create table if not exists public.player_promotions (
  promotion_key text primary key,
  wishes integer not null check (wishes > 0),
  enabled boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.player_promotion_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  promotion_key text not null references public.player_promotions(promotion_key) on delete restrict,
  wishes integer not null check (wishes > 0),
  granted_at timestamptz not null default now(),
  primary key (user_id, promotion_key)
);

alter table public.player_promotions enable row level security;
alter table public.player_promotion_grants enable row level security;

revoke all on table public.player_promotions from anon, authenticated;
revoke all on table public.player_promotion_grants from anon, authenticated;

insert into public.player_promotions (
  promotion_key,
  wishes,
  enabled,
  starts_at,
  ends_at
)
values (
  'tester_signup_10_v1',
  10,
  true,
  now(),
  null
)
on conflict (promotion_key) do nothing;

-- ---------------------------------------------------------------------------
-- REGISTRATION
-- Preserves the existing return type and existing profile/wallet semantics.
-- ---------------------------------------------------------------------------

create or replace function public.complete_player_registration()
returns table (
  username text,
  display_name text,
  wish_balance integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_metadata jsonb;
  v_user_created_at timestamptz;
  v_username text;
  v_display_name text;
  v_avatar_url text;
  v_suffix text;
  v_existing_username text;
  v_promo_wishes integer;
  v_awarded_wishes integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to complete registration.';
  end if;

  select
    auth_user.email::text,
    coalesce(auth_user.raw_user_meta_data, '{}'::jsonb),
    auth_user.created_at
  into
    v_email,
    v_metadata,
    v_user_created_at
  from auth.users as auth_user
  where auth_user.id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'The authenticated Supabase user could not be found.';
  end if;

  v_username := lower(
    regexp_replace(
      coalesce(
        nullif(btrim(v_metadata ->> 'username'), ''),
        nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
        'trainer'
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    )
  );

  v_username := regexp_replace(v_username, '_+', '_', 'g');
  v_username := regexp_replace(v_username, '^_+|_+$', '', 'g');
  v_username := left(v_username, 24);

  if char_length(v_username) < 3 then
    v_username := 'trainer';
  end if;

  v_suffix := left(replace(v_user_id::text, '-', ''), 12);

  perform pg_advisory_xact_lock(hashtext(lower(v_username)));

  select profile.username
  into v_existing_username
  from public.player_profiles as profile
  where profile.user_id = v_user_id;

  if coalesce(btrim(v_existing_username), '') <> '' then
    v_username := v_existing_username;
  elsif exists (
    select 1
    from public.player_profiles as profile
    where lower(profile.username) = lower(v_username)
      and profile.user_id <> v_user_id
  ) then
    v_username := left(v_username, 11) || '_' || v_suffix;
  end if;

  v_display_name := left(
    coalesce(
      nullif(btrim(v_metadata ->> 'display_name'), ''),
      nullif(btrim(v_metadata ->> 'full_name'), ''),
      nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
      'Unknown Trainer'
    ),
    60
  );

  v_avatar_url := nullif(
    btrim(
      coalesce(
        v_metadata ->> 'avatar_url',
        v_metadata ->> 'picture',
        ''
      )
    ),
    ''
  );

  insert into public.player_profiles (
    user_id,
    username,
    display_name,
    avatar_url,
    updated_at
  )
  values (
    v_user_id,
    v_username,
    v_display_name,
    v_avatar_url,
    now()
  )
  on conflict (user_id)
  do update set
    username = case
      when coalesce(btrim(player_profiles.username), '') = ''
        then excluded.username
      else player_profiles.username
    end,
    display_name = case
      when coalesce(btrim(player_profiles.display_name), '') = ''
        then excluded.display_name
      else player_profiles.display_name
    end,
    avatar_url = coalesce(player_profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  insert into public.player_wallets (
    user_id,
    wish_balance,
    lifetime_wishes_spent,
    updated_at
  )
  values (
    v_user_id,
    0,
    0,
    now()
  )
  on conflict (user_id) do nothing;

  -- New signups already made the acknowledgement on the create-account form.
  -- It is persisted here after Supabase has an authenticated user/session.
  if coalesce(v_metadata ->> 'purchase_consent_version', '') = '2026-08-08-v1'
     and lower(coalesce(v_metadata ->> 'age_18_confirmed', '')) = 'true'
     and lower(coalesce(v_metadata ->> 'random_physical_card_ack', '')) = 'true'
     and lower(coalesce(v_metadata ->> 'terms_ack', '')) = 'true' then
    insert into public.player_legal_consents (
      user_id,
      consent_version,
      age_18_confirmed,
      random_physical_card_ack,
      terms_ack,
      source,
      accepted_at
    )
    values (
      v_user_id,
      '2026-08-08-v1',
      true,
      true,
      true,
      'signup',
      now()
    )
    on conflict (user_id, consent_version) do nothing;
  end if;

  -- Tester bonus: only accounts CREATED after this promotion was first enabled.
  -- The grant ledger makes repeated calls to complete_player_registration() safe.
  select promotion.wishes
  into v_promo_wishes
  from public.player_promotions as promotion
  where promotion.promotion_key = 'tester_signup_10_v1'
    and promotion.enabled = true
    and v_user_created_at >= promotion.starts_at
    and (promotion.ends_at is null or v_user_created_at < promotion.ends_at)
  limit 1;

  if found then
    v_awarded_wishes := null;

    insert into public.player_promotion_grants (
      user_id,
      promotion_key,
      wishes,
      granted_at
    )
    values (
      v_user_id,
      'tester_signup_10_v1',
      v_promo_wishes,
      now()
    )
    on conflict (user_id, promotion_key) do nothing
    returning wishes into v_awarded_wishes;

    if coalesce(v_awarded_wishes, 0) > 0 then
      update public.player_wallets
      set
        wish_balance = greatest(coalesce(wish_balance, 0), 0) + v_awarded_wishes,
        updated_at = now()
      where user_id = v_user_id;
    end if;
  end if;

  return query
  select
    profile.username::text,
    profile.display_name::text,
    greatest(coalesce(wallet.wish_balance, 0), 0)::integer
  from public.player_profiles as profile
  left join public.player_wallets as wallet
    on wallet.user_id = profile.user_id
  where profile.user_id = v_user_id;
end;
$function$;

revoke all on function public.complete_player_registration() from public;
grant execute on function public.complete_player_registration() to authenticated;

notify pgrst, 'reload schema';

commit;
