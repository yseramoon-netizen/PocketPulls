-- Unknown Pulls registration repair
--
-- Fixes:
-- 1. Password validation in the client package.
-- 2. Empty or unreadable Supabase error responses.
-- 3. Missing player profile/wallet rows after Auth signup.
-- 4. Username race conditions.
--
-- The auth.users trigger below is deliberately fail-safe:
-- a player-row problem is logged as a warning but never blocks
-- creation of the Supabase Auth user.

do $preflight$
begin
  if to_regclass(
    'public.player_profiles'
  ) is null then
    raise exception
      'public.player_profiles is missing. Run the player-system migration first.';
  end if;

  if to_regclass(
    'public.player_wallets'
  ) is null then
    raise exception
      'public.player_wallets is missing. Run the player-system migration first.';
  end if;
end;
$preflight$;

-- Repair duplicate historical usernames before enforcing
-- case-insensitive uniqueness.
with ranked_usernames as (
  select
    profile.user_id,
    profile.username,
    row_number() over (
      partition by lower(profile.username)
      order by profile.user_id
    ) as duplicate_position

  from public.player_profiles
    as profile

  where profile.username is not null
    and btrim(profile.username) <> ''
)
update public.player_profiles
  as profile
set username =
  left(
    regexp_replace(
      lower(profile.username),
      '[^a-z0-9_]+',
      '_',
      'g'
    ),
    11
  ) ||
  '_' ||
  left(
    replace(
      profile.user_id::text,
      '-',
      ''
    ),
    12
  )
from ranked_usernames
  as ranked
where ranked.user_id =
    profile.user_id
  and ranked.duplicate_position > 1;

create unique index if not exists
  player_profiles_username_lower_unique
on public.player_profiles (
  lower(username)
)
where username is not null
  and btrim(username) <> '';

create or replace function
public.check_player_username_available(
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
      btrim(
        coalesce(
          p_username,
          ''
        )
      ),
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
    from public.player_profiles
      as profile
    where lower(
      profile.username
    ) = v_username
  );
end;
$function$;

create or replace function
public.complete_player_registration()
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
  v_user_id uuid :=
    auth.uid();

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
      message =
        'You must be signed in to complete registration.';
  end if;

  select
    users.email::text,
    coalesce(
      users.raw_user_meta_data,
      '{}'::jsonb
    )
  into
    v_email,
    v_metadata
  from auth.users as users
  where users.id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'The authenticated account could not be found.';
  end if;

  v_username := lower(
    regexp_replace(
      coalesce(
        nullif(
          btrim(
            v_metadata ->> 'username'
          ),
          ''
        ),
        nullif(
          split_part(
            coalesce(v_email, ''),
            '@',
            1
          ),
          ''
        ),
        'trainer'
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    )
  );

  v_username :=
    regexp_replace(
      v_username,
      '_+',
      '_',
      'g'
    );

  v_username :=
    regexp_replace(
      v_username,
      '^_+|_+$',
      '',
      'g'
    );

  v_username :=
    left(v_username, 24);

  if char_length(v_username) < 3 then
    v_username := 'trainer';
  end if;

  v_suffix :=
    left(
      replace(
        v_user_id::text,
        '-',
        ''
      ),
      12
    );

  perform pg_advisory_xact_lock(
    hashtext(v_username)
  );

  select profile.username
  into v_existing_username
  from public.player_profiles
    as profile
  where profile.user_id =
    v_user_id;

  if coalesce(
    btrim(v_existing_username),
    ''
  ) <> '' then
    v_username :=
      v_existing_username;
  elsif exists (
    select 1
    from public.player_profiles
      as profile
    where lower(
      profile.username
    ) = lower(v_username)
      and profile.user_id <>
        v_user_id
  ) then
    v_username :=
      left(v_username, 11) ||
      '_' ||
      v_suffix;
  end if;

  v_display_name :=
    left(
      coalesce(
        nullif(
          btrim(
            v_metadata
              ->> 'display_name'
          ),
          ''
        ),
        nullif(
          btrim(
            v_metadata
              ->> 'full_name'
          ),
          ''
        ),
        nullif(
          split_part(
            coalesce(v_email, ''),
            '@',
            1
          ),
          ''
        ),
        'Unknown Trainer'
      ),
      60
    );

  v_avatar_url :=
    nullif(
      btrim(
        coalesce(
          v_metadata
            ->> 'avatar_url',
          v_metadata
            ->> 'picture',
          ''
        )
      ),
      ''
    );

  insert into
    public.player_profiles (
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
      when coalesce(
        btrim(
          player_profiles.username
        ),
        ''
      ) = ''
        then excluded.username
      else
        player_profiles.username
    end,

    display_name = case
      when coalesce(
        btrim(
          player_profiles.display_name
        ),
        ''
      ) = ''
        then excluded.display_name
      else
        player_profiles.display_name
    end,

    avatar_url =
      coalesce(
        player_profiles.avatar_url,
        excluded.avatar_url
      );

  insert into
    public.player_wallets (
      user_id,
      wish_balance,
      lifetime_wishes_spent
    )
  values (
    v_user_id,
    0,
    0
  )
  on conflict (user_id)
  do nothing;

  return query
  select
    profile.username::text,
    profile.display_name::text,
    greatest(
      coalesce(
        wallet.wish_balance,
        0
      ),
      0
    )::integer

  from public.player_profiles
    as profile

  left join public.player_wallets
    as wallet
    on wallet.user_id =
      profile.user_id

  where profile.user_id =
    v_user_id;
end;
$function$;

create or replace function
public.unknown_pulls_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_metadata jsonb :=
    coalesce(
      new.raw_user_meta_data,
      '{}'::jsonb
    );

  v_username text;
  v_display_name text;
  v_avatar_url text;
  v_suffix text;
begin
  v_username := lower(
    regexp_replace(
      coalesce(
        nullif(
          btrim(
            v_metadata ->> 'username'
          ),
          ''
        ),
        nullif(
          split_part(
            coalesce(new.email, ''),
            '@',
            1
          ),
          ''
        ),
        'trainer'
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    )
  );

  v_username :=
    regexp_replace(
      v_username,
      '_+',
      '_',
      'g'
    );

  v_username :=
    regexp_replace(
      v_username,
      '^_+|_+$',
      '',
      'g'
    );

  v_username :=
    left(v_username, 24);

  if char_length(v_username) < 3 then
    v_username := 'trainer';
  end if;

  v_suffix :=
    left(
      replace(
        new.id::text,
        '-',
        ''
      ),
      12
    );

  if exists (
    select 1
    from public.player_profiles
      as profile
    where lower(
      profile.username
    ) = lower(v_username)
      and profile.user_id <>
        new.id
  ) then
    v_username :=
      left(v_username, 11) ||
      '_' ||
      v_suffix;
  end if;

  v_display_name :=
    left(
      coalesce(
        nullif(
          btrim(
            v_metadata
              ->> 'display_name'
          ),
          ''
        ),
        nullif(
          btrim(
            v_metadata
              ->> 'full_name'
          ),
          ''
        ),
        nullif(
          split_part(
            coalesce(new.email, ''),
            '@',
            1
          ),
          ''
        ),
        'Unknown Trainer'
      ),
      60
    );

  v_avatar_url :=
    nullif(
      btrim(
        coalesce(
          v_metadata
            ->> 'avatar_url',
          v_metadata
            ->> 'picture',
          ''
        )
      ),
      ''
    );

  begin
    insert into
      public.player_profiles (
        user_id,
        username,
        display_name,
        avatar_url
      )
    values (
      new.id,
      v_username,
      v_display_name,
      v_avatar_url
    )
    on conflict (user_id)
    do nothing;

  exception
    when unique_violation then
      insert into
        public.player_profiles (
          user_id,
          username,
          display_name,
          avatar_url
        )
      values (
        new.id,
        left(v_username, 11) ||
          '_' ||
          v_suffix,
        v_display_name,
        v_avatar_url
      )
      on conflict (user_id)
      do nothing;
  end;

  insert into
    public.player_wallets (
      user_id,
      wish_balance,
      lifetime_wishes_spent
    )
  values (
    new.id,
    0,
    0
  )
  on conflict (user_id)
  do nothing;

  return new;

exception
  when others then
    raise warning
      'Unknown Pulls player bootstrap failed for auth user %: %',
      new.id,
      sqlerrm;

    return new;
end;
$function$;

drop trigger if exists
  unknown_pulls_create_player_records
on auth.users;

create trigger
  unknown_pulls_create_player_records
after insert
on auth.users
for each row
execute function
  public.unknown_pulls_handle_new_auth_user();

create or replace function
public.unknown_pulls_registration_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'ok',
      to_regclass(
        'public.player_profiles'
      ) is not null
      and to_regclass(
        'public.player_wallets'
      ) is not null
      and to_regprocedure(
        'public.check_player_username_available(text)'
      ) is not null
      and to_regprocedure(
        'public.complete_player_registration()'
      ) is not null
      and exists (
        select 1
        from pg_trigger as trigger_row
        join pg_class as table_row
          on table_row.oid =
            trigger_row.tgrelid
        join pg_namespace as schema_row
          on schema_row.oid =
            table_row.relnamespace
        where schema_row.nspname =
          'auth'
          and table_row.relname =
            'users'
          and trigger_row.tgname =
            'unknown_pulls_create_player_records'
          and not trigger_row.tgisinternal
      ),

    'profiles_table',
      to_regclass(
        'public.player_profiles'
      ) is not null,

    'wallets_table',
      to_regclass(
        'public.player_wallets'
      ) is not null,

    'username_function',
      to_regprocedure(
        'public.check_player_username_available(text)'
      ) is not null,

    'registration_function',
      to_regprocedure(
        'public.complete_player_registration()'
      ) is not null,

    'signup_trigger',
      exists (
        select 1
        from pg_trigger as trigger_row
        join pg_class as table_row
          on table_row.oid =
            trigger_row.tgrelid
        join pg_namespace as schema_row
          on schema_row.oid =
            table_row.relnamespace
        where schema_row.nspname =
          'auth'
          and table_row.relname =
            'users'
          and trigger_row.tgname =
            'unknown_pulls_create_player_records'
          and not trigger_row.tgisinternal
      )
  );
$function$;

revoke all
on function
  public.check_player_username_available(
    text
  )
from public;

revoke all
on function
  public.complete_player_registration()
from public;

revoke all
on function
  public.unknown_pulls_registration_health()
from public;

grant execute
on function
  public.check_player_username_available(
    text
  )
to anon, authenticated;

grant execute
on function
  public.complete_player_registration()
to authenticated;

grant execute
on function
  public.unknown_pulls_registration_health()
to anon, authenticated;

notify pgrst, 'reload schema';
