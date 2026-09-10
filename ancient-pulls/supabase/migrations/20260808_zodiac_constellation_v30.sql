begin;

alter table public.player_profiles
  add column if not exists zodiac_sign text;

alter table public.player_profiles
  drop constraint if exists player_profiles_zodiac_sign_check;

alter table public.player_profiles
  add constraint player_profiles_zodiac_sign_check
  check (
    zodiac_sign is null
    or zodiac_sign in (
      'aries',
      'taurus',
      'gemini',
      'cancer',
      'leo',
      'virgo',
      'libra',
      'scorpio',
      'sagittarius',
      'capricorn',
      'aquarius',
      'pisces'
    )
  );

create or replace function public.get_player_zodiac_sign()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select profile.zodiac_sign
  from public.player_profiles as profile
  where profile.user_id = auth.uid()
  limit 1;
$function$;

create or replace function public.set_player_zodiac_sign(
  p_zodiac_sign text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sign text := nullif(lower(trim(coalesce(p_zodiac_sign, ''))), '');
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to update your star sign.';
  end if;

  if v_sign is not null and v_sign not in (
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces'
  ) then
    raise exception using
      errcode = '22023',
      message = 'That star sign is not supported.';
  end if;

  update public.player_profiles
  set zodiac_sign = v_sign
  where user_id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Your player profile does not exist.';
  end if;

  return v_sign;
end;
$function$;

revoke all on function public.get_player_zodiac_sign() from public;
revoke all on function public.set_player_zodiac_sign(text) from public;

grant execute on function public.get_player_zodiac_sign() to authenticated;
grant execute on function public.set_player_zodiac_sign(text) to authenticated;

commit;
