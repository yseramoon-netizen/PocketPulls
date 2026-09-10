begin;

-- V40 scanner metadata cache. These columns are intentionally nullable:
-- the scanner lazily fills HP from the Pokemon TCG API only for plausible candidates.
alter table public.pokemon_cards
  add column if not exists hp integer,
  add column if not exists set_printed_total integer,
  add column if not exists scanner_metadata_checked_at timestamptz;

create index if not exists pokemon_cards_scanner_name_idx
  on public.pokemon_cards(name);

create index if not exists pokemon_cards_scanner_set_number_idx
  on public.pokemon_cards(set_id, card_no);

-- Future local database refreshes now carry HP and set printed-total into the
-- master card table, so scanner evidence becomes local instead of requiring API calls.
create or replace function public.merge_local_pokemon_card_batch(
  p_cards jsonb,
  p_source_file_path text,
  p_source_commit_sha text
)
returns table (
  received_count integer,
  inserted_count integer,
  updated_count integer,
  skipped_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_card record;
  v_existing_id text;
  v_existing_hash text;
  v_received integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  if p_cards is null
    or jsonb_typeof(p_cards) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Local card sync payload must be a JSON array.';
  end if;

  if coalesce(btrim(p_source_file_path), '') = '' then
    raise exception using
      errcode = '22023',
      message = 'Source file path is required.';
  end if;

  for v_card in
    select *
    from jsonb_to_recordset(p_cards) as incoming(
      api_id text,
      name text,
      rarity text,
      set_name text,
      card_no text,
      image_url text,
      image_url_large text,
      set_id text,
      set_series text,
      hp integer,
      set_printed_total integer,
      set_release_date date,
      source_updated_at timestamptz,
      supertype text,
      subtypes jsonb,
      artist text,
      national_pokedex_numbers integer[],
      source_record_hash text
    )
  loop
    v_received := v_received + 1;
    v_existing_id := null;
    v_existing_hash := null;

    select cards.id::text, cards.source_record_hash
    into v_existing_id, v_existing_hash
    from public.pokemon_cards as cards
    where cards.api_id = v_card.api_id
    order by cards.id::text
    limit 1;

    if v_existing_id is null then
      select cards.id::text, cards.source_record_hash
      into v_existing_id, v_existing_hash
      from public.pokemon_cards as cards
      where cards.api_id is null
        and lower(coalesce(cards.name, '')) =
          lower(coalesce(v_card.name, ''))
        and lower(coalesce(cards.set_name, '')) =
          lower(coalesce(v_card.set_name, ''))
        and coalesce(cards.card_no, '') =
          coalesce(v_card.card_no, '')
      order by cards.id::text
      limit 1;
    end if;

    if v_existing_id is null then
      insert into public.pokemon_cards (
        api_id,
        name,
        rarity,
        set_name,
        card_no,
        image_url,
        image_url_large,
        market_value,
        set_id,
        set_series,
        hp,
        set_printed_total,
        set_release_date,
        source_updated_at,
        supertype,
        subtypes,
        artist,
        national_pokedex_numbers,
        source_record_hash,
        source_file_path,
        source_commit_sha,
        database_synced_at,
        price_status
      )
      values (
        v_card.api_id,
        coalesce(v_card.name, 'Unknown card'),
        v_card.rarity,
        v_card.set_name,
        v_card.card_no,
        v_card.image_url,
        v_card.image_url_large,
        0,
        v_card.set_id,
        v_card.set_series,
        v_card.hp,
        v_card.set_printed_total,
        v_card.set_release_date,
        v_card.source_updated_at,
        v_card.supertype,
        coalesce(v_card.subtypes, '[]'::jsonb),
        v_card.artist,
        v_card.national_pokedex_numbers,
        v_card.source_record_hash,
        p_source_file_path,
        p_source_commit_sha,
        now(),
        'unknown'
      );

      v_inserted := v_inserted + 1;
    elsif v_existing_hash is distinct from v_card.source_record_hash then
      update public.pokemon_cards as cards
      set
        api_id = coalesce(v_card.api_id, cards.api_id),
        name = coalesce(v_card.name, cards.name),
        rarity = coalesce(v_card.rarity, cards.rarity),
        set_name = coalesce(v_card.set_name, cards.set_name),
        card_no = coalesce(v_card.card_no, cards.card_no),
        image_url = coalesce(v_card.image_url, cards.image_url),
        image_url_large = coalesce(v_card.image_url_large, cards.image_url_large),
        set_id = coalesce(v_card.set_id, cards.set_id),
        set_series = coalesce(v_card.set_series, cards.set_series),
        hp = coalesce(v_card.hp, cards.hp),
        set_printed_total = coalesce(v_card.set_printed_total, cards.set_printed_total),
        set_release_date = coalesce(v_card.set_release_date, cards.set_release_date),
        source_updated_at = coalesce(v_card.source_updated_at, cards.source_updated_at),
        supertype = coalesce(v_card.supertype, cards.supertype),
        subtypes = coalesce(v_card.subtypes, cards.subtypes, '[]'::jsonb),
        artist = coalesce(v_card.artist, cards.artist),
        national_pokedex_numbers = coalesce(
          v_card.national_pokedex_numbers,
          cards.national_pokedex_numbers
        ),
        source_record_hash = v_card.source_record_hash,
        source_file_path = p_source_file_path,
        source_commit_sha = p_source_commit_sha,
        database_synced_at = now()
      where cards.id::text = v_existing_id;

      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return query
  select v_received, v_inserted, v_updated, v_skipped;
end;
$function$;

revoke all on function public.merge_local_pokemon_card_batch(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.merge_local_pokemon_card_batch(jsonb, text, text) to service_role;

create table if not exists public.pokemon_set_scanner_metadata (
  set_id text primary key,
  set_name text,
  ptcgo_code text,
  printed_total integer,
  total integer,
  updated_at timestamptz not null default now()
);

alter table public.pokemon_set_scanner_metadata enable row level security;
revoke all on table public.pokemon_set_scanner_metadata from anon, authenticated;

insert into public.pokemon_set_scanner_metadata (
  set_id,
  set_name,
  ptcgo_code,
  printed_total,
  total
)
values
  ('base1', 'Base', 'BS', 102, 102),
  ('base2', 'Jungle', 'JU', 64, 64),
  ('basep', 'Wizards Black Star Promos', 'PR', 53, 53),
  ('base3', 'Fossil', 'FO', 62, 62),
  ('base4', 'Base Set 2', 'B2', 130, 130),
  ('base5', 'Team Rocket', 'TR', 82, 83),
  ('gym1', 'Gym Heroes', 'G1', 132, 132),
  ('gym2', 'Gym Challenge', 'G2', 132, 132),
  ('neo1', 'Neo Genesis', 'N1', 111, 111),
  ('neo2', 'Neo Discovery', 'N2', 75, 75),
  ('si1', 'Southern Islands', null, 18, 18),
  ('neo3', 'Neo Revelation', 'N3', 64, 66),
  ('neo4', 'Neo Destiny', 'N4', 105, 113),
  ('base6', 'Legendary Collection', 'LC', 110, 110),
  ('ecard1', 'Expedition Base Set', 'EX', 165, 165),
  ('bp', 'Best of Game', 'BP', 9, 9),
  ('ecard2', 'Aquapolis', 'AQ', 147, 182),
  ('ecard3', 'Skyridge', 'SK', 144, 182),
  ('ex1', 'Ruby & Sapphire', 'RS', 109, 109),
  ('ex2', 'Sandstorm', 'SS', 100, 100),
  ('ex3', 'Dragon', 'DR', 97, 100),
  ('np', 'Nintendo Black Star Promos', 'PR-NP', 40, 40),
  ('ex4', 'Team Magma vs Team Aqua', 'MA', 95, 97),
  ('tk1a', 'EX Trainer Kit Latias', null, 10, 10),
  ('tk1b', 'EX Trainer Kit Latios', null, 10, 10),
  ('ex5', 'Hidden Legends', 'HL', 101, 102),
  ('ex6', 'FireRed & LeafGreen', 'RG', 112, 116),
  ('pop1', 'POP Series 1', null, 17, 17),
  ('ex7', 'Team Rocket Returns', 'TRR', 109, 111),
  ('ex8', 'Deoxys', 'DX', 107, 108),
  ('ex9', 'Emerald', 'EM', 106, 107),
  ('ex10', 'Unseen Forces', 'UF', 115, 145),
  ('pop2', 'POP Series 2', null, 17, 17),
  ('ex11', 'Delta Species', 'DS', 113, 114),
  ('ex12', 'Legend Maker', 'LM', 92, 93),
  ('tk2a', 'EX Trainer Kit 2 Plusle', null, 12, 12),
  ('tk2b', 'EX Trainer Kit 2 Minun', null, 12, 12),
  ('pop3', 'POP Series 3', null, 17, 17),
  ('ex13', 'Holon Phantoms', 'HP', 110, 111),
  ('ex14', 'Crystal Guardians', 'CG', 100, 100),
  ('pop4', 'POP Series 4', null, 17, 17),
  ('ex15', 'Dragon Frontiers', 'DF', 101, 101),
  ('pop5', 'POP Series 5', null, 17, 17),
  ('ex16', 'Power Keepers', 'PK', 108, 108),
  ('dp1', 'Diamond & Pearl', 'DP', 130, 130),
  ('dpp', 'DP Black Star Promos', 'PR-DPP', 56, 56),
  ('dp2', 'Mysterious Treasures', 'MT', 123, 124),
  ('pop6', 'POP Series 6', null, 17, 17),
  ('dp3', 'Secret Wonders', 'SW', 132, 132),
  ('dp4', 'Great Encounters', 'GE', 106, 106),
  ('pop7', 'POP Series 7', null, 17, 17),
  ('dp5', 'Majestic Dawn', 'MD', 100, 100),
  ('dp6', 'Legends Awakened', 'LA', 146, 146),
  ('pop8', 'POP Series 8', null, 17, 17),
  ('dp7', 'Stormfront', 'SF', 100, 106),
  ('pl1', 'Platinum', 'PL', 127, 133),
  ('pop9', 'POP Series 9', null, 17, 17),
  ('pl2', 'Rising Rivals', 'RR', 111, 120),
  ('pl3', 'Supreme Victors', 'SV', 147, 153),
  ('pl4', 'Arceus', 'AR', 99, 111),
  ('ru1', 'Pokémon Rumble', null, 16, 16),
  ('hgss1', 'HeartGold & SoulSilver', 'HS', 123, 124),
  ('hsp', 'HGSS Black Star Promos', 'PR-HS', 25, 25),
  ('hgss2', 'HS—Unleashed', 'UL', 95, 96),
  ('hgss3', 'HS—Undaunted', 'UD', 90, 91),
  ('hgss4', 'HS—Triumphant', 'TM', 102, 103),
  ('col1', 'Call of Legends', 'CL', 95, 106),
  ('bwp', 'BW Black Star Promos', 'PR-BLW', 101, 101),
  ('bw1', 'Black & White', 'BLW', 114, 115),
  ('mcd11', 'McDonald''s Collection 2011', null, 12, 12),
  ('bw2', 'Emerging Powers', 'EPO', 98, 98),
  ('bw3', 'Noble Victories', 'NVI', 101, 102),
  ('bw4', 'Next Destinies', 'NXD', 99, 103),
  ('bw5', 'Dark Explorers', 'DEX', 108, 111),
  ('mcd12', 'McDonald''s Collection 2012', null, 12, 12),
  ('bw6', 'Dragons Exalted', 'DRX', 124, 128),
  ('dv1', 'Dragon Vault', 'DRV', 20, 21),
  ('bw7', 'Boundaries Crossed', 'BCR', 149, 153),
  ('bw8', 'Plasma Storm', 'PLS', 135, 138),
  ('bw9', 'Plasma Freeze', 'PLF', 116, 122),
  ('bw10', 'Plasma Blast', 'PLB', 101, 105),
  ('xyp', 'XY Black Star Promos', 'PR-XY', 211, 216),
  ('bw11', 'Legendary Treasures', 'LTR', 113, 140),
  ('xy0', 'Kalos Starter Set', 'KSS', 39, 39),
  ('xy1', 'XY', 'XY', 146, 146),
  ('xy2', 'Flashfire', 'FLF', 106, 110),
  ('mcd14', 'McDonald''s Collection 2014', null, 12, 12),
  ('xy3', 'Furious Fists', 'FFI', 111, 114),
  ('xy4', 'Phantom Forces', 'PHF', 119, 124),
  ('xy5', 'Primal Clash', 'PRC', 160, 164),
  ('dc1', 'Double Crisis', 'DCR', 34, 34),
  ('xy6', 'Roaring Skies', 'ROS', 108, 112),
  ('xy7', 'Ancient Origins', 'AOR', 98, 100),
  ('xy8', 'BREAKthrough', 'BKT', 162, 165),
  ('mcd15', 'McDonald''s Collection 2015', null, 12, 12),
  ('xy9', 'BREAKpoint', 'BKP', 122, 126),
  ('g1', 'Generations', 'GEN', 83, 117),
  ('xy10', 'Fates Collide', 'FCO', 124, 129),
  ('xy11', 'Steam Siege', 'STS', 114, 116),
  ('mcd16', 'McDonald''s Collection 2016', null, 12, 12),
  ('xy12', 'Evolutions', 'EVO', 108, 113),
  ('sm1', 'Sun & Moon', 'SUM', 149, 173),
  ('smp', 'SM Black Star Promos', 'PR-SM', 248, 250),
  ('sm2', 'Guardians Rising', 'GRI', 145, 180),
  ('sm3', 'Burning Shadows', 'BUS', 147, 177),
  ('sm35', 'Shining Legends', 'SLG', 73, 81),
  ('sm4', 'Crimson Invasion', 'CIN', 111, 126),
  ('mcd17', 'McDonald''s Collection 2017', null, 12, 12),
  ('sm5', 'Ultra Prism', 'UPR', 156, 178),
  ('sm6', 'Forbidden Light', 'FLI', 131, 150),
  ('sm7', 'Celestial Storm', 'CES', 168, 187),
  ('sm75', 'Dragon Majesty', 'DRM', 70, 80),
  ('mcd18', 'McDonald''s Collection 2018', null, 12, 12),
  ('sm8', 'Lost Thunder', 'LOT', 214, 240),
  ('sm9', 'Team Up', 'TEU', 181, 198),
  ('det1', 'Detective Pikachu', 'DET', 18, 18),
  ('sm10', 'Unbroken Bonds', 'UNB', 214, 234),
  ('sm11', 'Unified Minds', 'UNM', 236, 260),
  ('sm115', 'Hidden Fates', 'HIF', 68, 69),
  ('sma', 'Hidden Fates Shiny Vault', 'HIF', 94, 94),
  ('mcd19', 'McDonald''s Collection 2019', null, 12, 12),
  ('sm12', 'Cosmic Eclipse', 'CEC', 236, 272),
  ('swshp', 'SWSH Black Star Promos', 'PR-SW', 307, 304),
  ('swsh1', 'Sword & Shield', 'SSH', 202, 216),
  ('swsh2', 'Rebel Clash', 'RCL', 192, 209),
  ('swsh3', 'Darkness Ablaze', 'DAA', 189, 201),
  ('fut20', 'Pokémon Futsal Collection', 'FUT20', 5, 5),
  ('swsh35', 'Champion''s Path', 'CPA', 73, 80),
  ('swsh4', 'Vivid Voltage', 'VIV', 185, 203),
  ('swsh45', 'Shining Fates', 'SHF', 72, 73),
  ('swsh45sv', 'Shining Fates Shiny Vault', 'SHF', 122, 122),
  ('swsh5', 'Battle Styles', 'BST', 163, 183),
  ('swsh6', 'Chilling Reign', 'CRE', 198, 233),
  ('swsh7', 'Evolving Skies', 'EVS', 203, 237),
  ('mcd21', 'McDonald''s Collection 2021', null, 25, 25),
  ('cel25', 'Celebrations', 'CEL', 25, 25),
  ('cel25c', 'Celebrations: Classic Collection', 'CEL', 25, 25),
  ('swsh8', 'Fusion Strike', 'FST', 264, 284),
  ('swsh9', 'Brilliant Stars', 'BRS', 172, 186),
  ('swsh9tg', 'Brilliant Stars Trainer Gallery', 'BRS', 30, 30),
  ('swsh10', 'Astral Radiance', 'ASR', 189, 216),
  ('swsh10tg', 'Astral Radiance Trainer Gallery', 'ASR', 30, 30),
  ('pgo', 'Pokémon GO', 'PGO', 78, 88),
  ('mcd22', 'McDonald''s Collection 2022', null, 15, 15),
  ('swsh11', 'Lost Origin', 'LOR', 196, 217),
  ('swsh11tg', 'Lost Origin Trainer Gallery', 'LOR', 30, 30),
  ('swsh12', 'Silver Tempest', 'SIT', 195, 215),
  ('swsh12tg', 'Silver Tempest Trainer Gallery', 'SIT', 30, 30),
  ('swsh12pt5', 'Crown Zenith', 'CRZ', 159, 160),
  ('swsh12pt5gg', 'Crown Zenith Galarian Gallery', 'CRZ', 70, 70),
  ('svp', 'Scarlet & Violet Black Star Promos', 'PR-SV', 102, 75),
  ('sve', 'Scarlet & Violet Energies', 'SVE', 8, 8),
  ('sv1', 'Scarlet & Violet', 'SVI', 198, 258),
  ('sv2', 'Paldea Evolved', 'PAL', 193, 279),
  ('sv3', 'Obsidian Flames', 'OBF', 197, 230),
  ('sv3pt5', '151', 'MEW', 165, 207),
  ('sv4', 'Paradox Rift', 'PAR', 182, 266),
  ('sv4pt5', 'Paldean Fates', 'PAF', 91, 245),
  ('sv5', 'Temporal Forces', 'TEF', 162, 218),
  ('sv6', 'Twilight Masquerade', 'TWM', 167, 226),
  ('sv6pt5', 'Shrouded Fable', 'SFA', 64, 99),
  ('sv7', 'Stellar Crown', 'SCR', 142, 175),
  ('sv8', 'Surging Sparks', 'SSP', 191, 252),
  ('sv8pt5', 'Prismatic Evolutions', 'PRE', 131, 180),
  ('sv9', 'Journey Together', 'JTG', 159, 190),
  ('sv10', 'Destined Rivals', 'DRI', 182, 244),
  ('zsv10pt5', 'Black Bolt', 'BLK', 86, 172),
  ('rsv10pt5', 'White Flare', 'WHT', 86, 173),
  ('me1', 'Mega Evolution', 'MEG', 132, 188),
  ('me2', 'Phantasmal Flames', 'PFL', 94, 130),
  ('me2pt5', 'Ascended Heroes', 'ASC', 217, 295),
  ('me3', 'Perfect Order', 'POR', 88, 124),
  ('me4', 'Chaos Rising', 'CRI', 86, 122),
  ('me5', 'Pitch Black', 'PBL', 84, 120)
on conflict (set_id) do update
set
  set_name = excluded.set_name,
  ptcgo_code = excluded.ptcgo_code,
  printed_total = excluded.printed_total,
  total = excluded.total,
  updated_at = now();

-- Set totals can be populated immediately without spending API quota.
update public.pokemon_cards as cards
set set_printed_total = metadata.printed_total
from public.pokemon_set_scanner_metadata as metadata
where cards.set_id = metadata.set_id
  and cards.set_printed_total is distinct from metadata.printed_total;

create or replace function public.get_scanner_set_metadata()
returns table (
  set_id text,
  set_name text,
  ptcgo_code text,
  printed_total integer,
  total integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    metadata.set_id,
    metadata.set_name,
    metadata.ptcgo_code,
    metadata.printed_total,
    metadata.total
  from public.pokemon_set_scanner_metadata as metadata
  order by metadata.set_id;
$function$;

revoke all on function public.get_scanner_set_metadata() from public;
grant execute on function public.get_scanner_set_metadata() to authenticated;

-- Keep the V34 name dictionary available as well.
create or replace function public.get_scanner_card_names()
returns table (
  card_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select distinct trim(cards.name) as card_name
  from public.pokemon_cards as cards
  where cards.name is not null
    and trim(cards.name) <> ''
  order by card_name;
$function$;

revoke all on function public.get_scanner_card_names() from public;
grant execute on function public.get_scanner_card_names() to authenticated;


create or replace function public.get_scanner_catalogue_status()
returns table (
  total_cards bigint,
  hp_cached bigint,
  set_total_cached bigint,
  latest_metadata_check timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    count(*)::bigint,
    count(*) filter (where cards.hp is not null)::bigint,
    count(*) filter (where cards.set_printed_total is not null)::bigint,
    max(cards.scanner_metadata_checked_at)
  from public.pokemon_cards as cards;
$function$;

revoke all on function public.get_scanner_catalogue_status() from public;
grant execute on function public.get_scanner_catalogue_status() to authenticated;

commit;

notify pgrst, 'reload schema';
