begin;

-- The V50 scanner generates a narrow candidate pool from collector number,
-- set size, set ID and names before visual matching. These indexes keep those
-- lookups sub-linear without creating a second card database.
create index if not exists pokemon_cards_scanner_card_no_idx
  on public.pokemon_cards (card_no)
  where card_no is not null;

create index if not exists pokemon_cards_scanner_set_total_idx
  on public.pokemon_cards (set_printed_total)
  where set_printed_total is not null;

create index if not exists pokemon_cards_scanner_set_total_number_idx
  on public.pokemon_cards (set_printed_total, card_no)
  where set_printed_total is not null and card_no is not null;

create index if not exists pokemon_cards_scanner_set_id_number_v50_idx
  on public.pokemon_cards (set_id, card_no)
  where set_id is not null and card_no is not null;

create index if not exists pokemon_cards_scanner_lower_name_v50_idx
  on public.pokemon_cards (lower(name))
  where name is not null;

notify pgrst, 'reload schema';

commit;
