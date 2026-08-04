-- Unknown Pulls V7 verification

select
  public.unknown_pulls_multi_admin_health()
    as multi_admin_health;

select
  administrator.email,
  administrator.user_id,
  administrator.display_name,
  administrator.is_active,
  administrator.last_verified_at

from public.admin_users
  as administrator

order by
  administrator.is_active desc,
  administrator.email;

select
  event.actor_email,
  event.target_email,
  event.access_enabled,
  event.reason,
  event.created_at

from public.admin_access_events
  as event

order by
  event.created_at desc

limit 20;

notify pgrst, 'reload schema';
