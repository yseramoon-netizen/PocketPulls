-- Ancient Pulls V67.12
-- Consumer/privacy consent refresh and per-order checkout confirmation records.
-- Existing accounts must accept the materially updated 2026-09-01 terms once.

begin;

do $preflight$
begin
  if to_regclass('public.player_profiles') is null then
    raise exception 'public.player_profiles is missing.';
  end if;

  if to_regclass('public.player_legal_consents') is null then
    raise exception 'public.player_legal_consents is missing.';
  end if;

  if to_regclass('public.wish_purchase_orders') is null then
    raise exception 'public.wish_purchase_orders is missing.';
  end if;
end;
$preflight$;

alter table public.wish_purchase_orders
  add column if not exists checkout_acknowledgement_version text,
  add column if not exists checkout_acknowledged_at timestamptz,
  add column if not exists immediate_access_requested boolean not null default false,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists confirmation_email text;

comment on column public.wish_purchase_orders.checkout_acknowledgement_version is
  'Version of the per-order price/random-card/immediate-access wording shown before hosted payment.';

comment on column public.wish_purchase_orders.confirmation_sent_at is
  'When the durable contract-confirmation email was accepted by the configured email provider.';

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
    '2026-09-01-v2'::text as consent_version,
    consent.accepted_at
  from (select auth.uid() as user_id) as current_player
  left join public.player_legal_consents as consent
    on consent.user_id = current_player.user_id
   and consent.consent_version = '2026-09-01-v2'
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
    '2026-09-01-v2',
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
  select true, '2026-09-01-v2'::text, v_accepted_at;
end;
$function$;

create or replace function public.sync_signup_purchase_consent_v6712()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_metadata jsonb;
begin
  select coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  into v_metadata
  from auth.users as auth_user
  where auth_user.id = new.user_id;

  if coalesce(v_metadata ->> 'purchase_consent_version', '') = '2026-09-01-v2'
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
      new.user_id,
      '2026-09-01-v2',
      true,
      true,
      true,
      'signup',
      now()
    )
    on conflict (user_id, consent_version) do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_signup_purchase_consent_v6712
  on public.player_profiles;

create trigger sync_signup_purchase_consent_v6712
after insert or update on public.player_profiles
for each row
execute function public.sync_signup_purchase_consent_v6712();

insert into public.player_legal_consents (
  user_id,
  consent_version,
  age_18_confirmed,
  random_physical_card_ack,
  terms_ack,
  source,
  accepted_at
)
select
  auth_user.id,
  '2026-09-01-v2',
  true,
  true,
  true,
  'signup_backfill',
  now()
from auth.users as auth_user
where coalesce(auth_user.raw_user_meta_data ->> 'purchase_consent_version', '') = '2026-09-01-v2'
  and lower(coalesce(auth_user.raw_user_meta_data ->> 'age_18_confirmed', '')) = 'true'
  and lower(coalesce(auth_user.raw_user_meta_data ->> 'random_physical_card_ack', '')) = 'true'
  and lower(coalesce(auth_user.raw_user_meta_data ->> 'terms_ack', '')) = 'true'
on conflict (user_id, consent_version) do nothing;

revoke all on function public.get_player_purchase_consent() from public;
revoke all on function public.accept_player_purchase_consent(boolean, boolean, boolean) from public;
revoke all on function public.sync_signup_purchase_consent_v6712() from public;

grant execute on function public.get_player_purchase_consent() to authenticated;
grant execute on function public.accept_player_purchase_consent(boolean, boolean, boolean) to authenticated;

commit;
