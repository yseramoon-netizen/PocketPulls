-- Unknown Pulls account gateway
-- Adds username availability checking and a safe account/profile repair RPC.
-- Existing player records are preserved.

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception 'public.player_profiles is missing. Run the player-system migration first.';
  end if;

  if to_regclass('public.player_wallets') is null then
    raise exception 'public.player_wallets is missing. Run the player-system migration first.';
  end if;
end;
$preflight$;

create or replace function public.check_player_username_available(
  p_username text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_username text;
begin
  v_username := lower(
    regexp_replace(
      btrim(coalesce(p_username, '')),
      '[^a-z0-9_]+',
      '',
      'g'
    )
  );

  if char_length(v_username) < 3
    or char_length(v_username) > 24 then
    return false;
  end if;

  return not exists (
    select 1
    from public.player_profiles as profile
    where lower(profile.username) = v_username
  );
end;
$function$;

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
  v_username text;
  v_display_name text;
  v_avatar_url text;
  v_suffix text;
  v_existing_username text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to complete registration.';
  end if;

  select
    users.email::text,
    coalesce(users.raw_user_meta_data, '{}'::jsonb)
  into
    v_email,
    v_metadata
  from auth.users as users
  where users.id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'The authenticated account could not be found.';
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

  v_suffix := left(replace(v_user_id::text, '-', ''), 6);

  perform pg_advisory_xact_lock(hashtext(v_username));

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
    v_username := left(v_username, 17) || '_' || v_suffix;
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
    avatar_url
  )
  values (
    v_user_id,
    v_username,
    v_display_name,
    v_avatar_url
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
    avatar_url = coalesce(
      player_profiles.avatar_url,
      excluded.avatar_url
    );

  insert into public.player_wallets (
    user_id,
    wish_balance,
    lifetime_wishes_spent
  )
  values (
    v_user_id,
    0,
    0
  )
  on conflict (user_id) do nothing;

  return query
  select
    profile.username,
    profile.display_name,
    greatest(coalesce(wallet.wish_balance, 0), 0)::integer
  from public.player_profiles as profile
  left join public.player_wallets as wallet
    on wallet.user_id = profile.user_id
  where profile.user_id = v_user_id;
end;
$function$;

revoke all
on function public.check_player_username_available(text)
from public;

revoke all
on function public.complete_player_registration()
from public;

grant execute
on function public.check_player_username_available(text)
to anon, authenticated;

grant execute
on function public.complete_player_registration()
to authenticated;

notify pgrst, 'reload schema';
