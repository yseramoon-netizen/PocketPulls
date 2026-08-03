-- PocketPulls physical card finishes
-- Adds finish tracking to the admin inventory pool.
--
-- Values:
--   normal
--   holo
--   reverse_holo

alter table public.inventory
add column if not exists finish text;

update public.inventory
set finish = case
  when lower(
    replace(
      replace(btrim(coalesce(finish, '')), '-', '_'),
      ' ',
      '_'
    )
  ) in ('holo', 'holographic') then 'holo'

  when lower(
    replace(
      replace(btrim(coalesce(finish, '')), '-', '_'),
      ' ',
      '_'
    )
  ) in (
    'reverse',
    'reverse_holo',
    'reverse_holographic'
  ) then 'reverse_holo'

  else 'normal'
end;

alter table public.inventory
alter column finish set default 'normal';

alter table public.inventory
alter column finish set not null;

alter table public.inventory
drop constraint if exists inventory_finish_check;

alter table public.inventory
add constraint inventory_finish_check
check (
  finish in (
    'normal',
    'holo',
    'reverse_holo'
  )
);

create index if not exists
  inventory_card_finish_lookup_idx
on public.inventory(card_id, finish);

comment on column public.inventory.finish is
  'Physical printing finish: normal, holo, or reverse_holo.';

notify pgrst, 'reload schema';
