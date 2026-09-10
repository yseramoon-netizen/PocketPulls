begin;

create or replace function public.get_player_wish_anniversaries(
  p_today date default current_date
)
returns table (
  card_id text,
  wished_at timestamptz,
  years_ago integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with matching as (
    select
      wishes.card_id::text as card_id,
      wishes.created_at as wished_at,
      greatest(
        1,
        extract(
          year from age(
            p_today,
            (wishes.created_at at time zone 'UTC')::date
          )
        )::integer
      ) as years_ago
    from public.player_wishes as wishes
    where auth.uid() is not null
      and wishes.user_id = auth.uid()
      and wishes.card_id is not null
      and wishes.created_at is not null
      and (wishes.created_at at time zone 'UTC')::date < p_today
      and extract(month from wishes.created_at at time zone 'UTC') = extract(month from p_today)
      and extract(day from wishes.created_at at time zone 'UTC') = extract(day from p_today)
  )
  select distinct on (matching.card_id)
    matching.card_id,
    matching.wished_at,
    matching.years_ago
  from matching
  order by
    matching.card_id,
    matching.years_ago desc,
    matching.wished_at asc;
$function$;

revoke all on function public.get_player_wish_anniversaries(date) from public;
grant execute on function public.get_player_wish_anniversaries(date) to authenticated;

comment on function public.get_player_wish_anniversaries(date) is
  'Returns the authenticated player cards whose wish date falls on the supplied calendar day in a prior year. Used only for non-reward anniversary memories.';

commit;
