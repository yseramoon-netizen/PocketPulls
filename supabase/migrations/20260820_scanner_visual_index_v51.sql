begin;

-- Compact, deterministic visual signatures of the canonical card images. Card
-- IDs are stored as text so this remains compatible with numeric or UUID card
-- primary keys without creating a disconnected card catalogue.
create table if not exists public.pokemon_card_visual_fingerprints (
  card_id text primary key,
  fingerprint_version integer not null,
  full_signature text not null,
  artwork_signature text not null,
  colour_signature text not null,
  source_url text,
  updated_at timestamptz not null default now()
);

create index if not exists pokemon_card_visual_fingerprints_version_idx
  on public.pokemon_card_visual_fingerprints (fingerprint_version);

alter table public.pokemon_card_visual_fingerprints enable row level security;
revoke all on table public.pokemon_card_visual_fingerprints from anon, authenticated;
grant all on table public.pokemon_card_visual_fingerprints to service_role;

notify pgrst, 'reload schema';

commit;
