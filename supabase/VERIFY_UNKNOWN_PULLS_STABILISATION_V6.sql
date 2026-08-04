-- Run after the V6 migration.

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_player_collection_overview',
    'get_player_collection',
    'set_player_signature_card',
    'get_player_profile_dashboard',
    'update_player_profile'
  )
order by routine_name;

select
  function_name,
  authenticated_can_execute,
  anon_can_execute
from (
  values
    (
      'get_player_collection_overview()',
      has_function_privilege(
        'authenticated',
        'public.get_player_collection_overview()',
        'execute'
      ),
      has_function_privilege(
        'anon',
        'public.get_player_collection_overview()',
        'execute'
      )
    ),
    (
      'get_player_collection(text,text,text,text,text,integer,integer)',
      has_function_privilege(
        'authenticated',
        'public.get_player_collection(text,text,text,text,text,integer,integer)',
        'execute'
      ),
      has_function_privilege(
        'anon',
        'public.get_player_collection(text,text,text,text,text,integer,integer)',
        'execute'
      )
    ),
    (
      'set_player_signature_card(text)',
      has_function_privilege(
        'authenticated',
        'public.set_player_signature_card(text)',
        'execute'
      ),
      has_function_privilege(
        'anon',
        'public.set_player_signature_card(text)',
        'execute'
      )
    ),
    (
      'get_player_profile_dashboard()',
      has_function_privilege(
        'authenticated',
        'public.get_player_profile_dashboard()',
        'execute'
      ),
      has_function_privilege(
        'anon',
        'public.get_player_profile_dashboard()',
        'execute'
      )
    ),
    (
      'update_player_profile(text,text,text,text,text,text,boolean)',
      has_function_privilege(
        'authenticated',
        'public.update_player_profile(text,text,text,text,text,text,boolean)',
        'execute'
      ),
      has_function_privilege(
        'anon',
        'public.update_player_profile(text,text,text,text,text,text,boolean)',
        'execute'
      )
    )
) as permissions(
  function_name,
  authenticated_can_execute,
  anon_can_execute
)
order by function_name;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'player_profile_details'
  and indexdef ilike '%user_id%';

select
  user_id,
  count(*) as rows_for_user
from public.player_profile_details
group by user_id
having count(*) > 1;

select
  user_id,
  username,
  display_name
from public.player_profiles
order by created_at desc nulls last
limit 20;

select
  details.user_id,
  profiles.username,
  details.signature_card_id,
  details.updated_at
from public.player_profile_details as details
left join public.player_profiles as profiles
  on profiles.user_id = details.user_id
order by details.updated_at desc nulls last
limit 20;
