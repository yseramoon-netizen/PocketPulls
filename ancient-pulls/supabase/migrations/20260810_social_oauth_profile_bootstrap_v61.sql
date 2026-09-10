-- Ancient Pulls V61: social OAuth profile bootstrap
--
-- Google and Discord users use the existing player profile/wallet architecture.
-- Provider avatar URLs are intentionally ignored: Ancient Pulls avatars are
-- owned by the player and uploaded through the profile picture system.

begin;

create or replace function public.complete_player_registration()
returns table (username text, display_name text, wish_balance integer)
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
  v_suffix text;
  v_existing_username text;
  v_promo_wishes integer;
  v_awarded_wishes integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in to complete registration.';
  end if;

  select auth_user.email::text, coalesce(auth_user.raw_user_meta_data, '{}'::jsonb), auth_user.created_at
  into v_email, v_metadata, v_user_created_at
  from auth.users as auth_user
  where auth_user.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'The authenticated Supabase user could not be found.';
  end if;

  -- Providers use different field names. These fields only seed an Ancient
  -- Pulls name; player_profiles remains the application source of truth.
  v_username := lower(regexp_replace(coalesce(
    nullif(btrim(v_metadata ->> 'username'), ''),
    nullif(btrim(v_metadata ->> 'preferred_username'), ''),
    nullif(btrim(v_metadata ->> 'user_name'), ''),
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    'trainer'
  ), '[^a-z0-9_]+', '_', 'g'));
  v_username := regexp_replace(regexp_replace(v_username, '_+', '_', 'g'), '^_+|_+$', '', 'g');
  v_username := left(v_username, 24);
  if char_length(v_username) < 3 then v_username := 'trainer'; end if;

  v_suffix := left(replace(v_user_id::text, '-', ''), 12);
  perform pg_advisory_xact_lock(hashtext(lower(v_username)));

  select profile.username into v_existing_username
  from public.player_profiles as profile
  where profile.user_id = v_user_id;

  if coalesce(btrim(v_existing_username), '') <> '' then
    v_username := v_existing_username;
  elsif exists (
    select 1 from public.player_profiles as profile
    where lower(profile.username) = lower(v_username) and profile.user_id <> v_user_id
  ) then
    v_username := left(v_username, 11) || '_' || v_suffix;
  end if;

  v_display_name := left(coalesce(
    nullif(btrim(v_metadata ->> 'display_name'), ''),
    nullif(btrim(v_metadata ->> 'full_name'), ''),
    nullif(btrim(v_metadata ->> 'name'), ''),
    nullif(btrim(v_metadata ->> 'global_name'), ''),
    nullif(btrim(v_metadata ->> 'preferred_username'), ''),
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    'Unknown Trainer'
  ), 60);

  -- Do not insert or update avatar_url here. In particular, provider avatars
  -- must never replace player-selected profile images.
  insert into public.player_profiles (user_id, username, display_name, updated_at)
  values (v_user_id, v_username, v_display_name, now())
  on conflict (user_id) do update set
    username = case when coalesce(btrim(player_profiles.username), '') = '' then excluded.username else player_profiles.username end,
    display_name = case when coalesce(btrim(player_profiles.display_name), '') = '' then excluded.display_name else player_profiles.display_name end,
    updated_at = now();

  insert into public.player_wallets (user_id, wish_balance, lifetime_wishes_spent, updated_at)
  values (v_user_id, 0, 0, now())
  on conflict (user_id) do nothing;

  -- Email registrations retain their current consent metadata. OAuth users are
  -- shown the normal in-product consent gate rather than being auto-consented.
  if coalesce(v_metadata ->> 'purchase_consent_version', '') = '2026-08-08-v1'
    and lower(coalesce(v_metadata ->> 'age_18_confirmed', '')) = 'true'
    and lower(coalesce(v_metadata ->> 'random_physical_card_ack', '')) = 'true'
    and lower(coalesce(v_metadata ->> 'terms_ack', '')) = 'true' then
    insert into public.player_legal_consents (user_id, consent_version, age_18_confirmed, random_physical_card_ack, terms_ack, source, accepted_at)
    values (v_user_id, '2026-08-08-v1', true, true, true, 'signup', now())
    on conflict (user_id, consent_version) do nothing;
  end if;

  select promotion.wishes into v_promo_wishes
  from public.player_promotions as promotion
  where promotion.promotion_key = 'tester_signup_10_v1'
    and promotion.enabled = true
    and v_user_created_at >= promotion.starts_at
    and (promotion.ends_at is null or v_user_created_at < promotion.ends_at)
  limit 1;

  if found then
    v_awarded_wishes := null;
    insert into public.player_promotion_grants as promotion_grant (user_id, promotion_key, wishes, granted_at)
    values (v_user_id, 'tester_signup_10_v1', v_promo_wishes, now())
    on conflict (user_id, promotion_key) do nothing
    returning promotion_grant.wishes into v_awarded_wishes;

    if coalesce(v_awarded_wishes, 0) > 0 then
      update public.player_wallets as wallet
      set wish_balance = greatest(coalesce(wallet.wish_balance, 0), 0) + v_awarded_wishes,
          updated_at = now()
      where wallet.user_id = v_user_id;
    end if;
  end if;

  return query
  select profile.username::text, profile.display_name::text, greatest(coalesce(wallet.wish_balance, 0), 0)::integer
  from public.player_profiles as profile
  left join public.player_wallets as wallet on wallet.user_id = profile.user_id
  where profile.user_id = v_user_id;
end;
$function$;

revoke all on function public.complete_player_registration() from public;
grant execute on function public.complete_player_registration() to authenticated;
notify pgrst, 'reload schema';
commit;
