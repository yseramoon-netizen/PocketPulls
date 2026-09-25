# Ancient Pulls Scanner V51.1 — image-first diagnostic correction

This archive is a path-preserving overlay for the existing Ancient Pulls Next.js project. V51.1 searches a precomputed visual fingerprint of the entire canonical card catalogue before OCR is allowed to contribute. It also recovers strict collector fractions read in either footer crop, exposes visual-index failures, and requires a real removal before rearming. Extract it at the project root and allow the included files to replace files with the same paths.

## Install

1. Back up the deployed project and database.
2. Extract the archive at the repository root.
3. If scanner V40 has never been installed, run `supabase/migrations/20260808_research_scanner_v40.sql` in Supabase SQL Editor first. It creates the scanner metadata table, metadata columns, set-code catalogue and name RPC used by candidate generation.
4. Run `supabase/migrations/20260820_scanner_database_first_v50.sql` if V50 was not previously installed.
5. Run `supabase/migrations/20260820_scanner_visual_index_v51.sql` to create the protected compact visual-index table.
6. Run `npm install`, `npm run build`, and deploy normally. V51.1 uses `sharp` to fingerprint canonical reference images on the server.
7. Open the admin card scanner, enable **Diagnostics**, and press **Build / resume visual index**. Leave the page open until the counter reaches the catalogue total. This is a one-time build; it can be paused and resumed.

The existing admin inventory endpoint remains the sole mutation path. Recognition returns the canonical `pokemon_cards.id`; the server verifies that ID before quantity is incremented.

## Files in the overlay

- `components/CardScanner.tsx` — conveyor UI, bounded queue, human review and diagnostics.
- `lib/scanner/` — card geometry, frame quality, canonical regions, constrained OCR, consensus, fuzzy scoring, visual matching, camera utilities and benchmark recording.
- `app/api/admin/scanner/candidates/route.ts` — authenticated database-first candidate generator.
- `app/api/admin/scanner/reference-image/route.ts` — authenticated reference-image proxy used for visual reranking.
- `app/api/admin/scanner/visual-index/route.ts` — protected, resumable reference fingerprint builder.
- `app/api/admin/scanner/visual-search/route.ts` — whole-catalogue nearest-image search.
- `app/api/admin/scanner/card-metadata/route.ts` — scanner metadata support retained for compatibility.
- `scripts/scanner-benchmark.mjs` and `SCANNER-BENCHMARK.md` — labelled accuracy/latency measurement.
- `supabase/migrations/` — prerequisite V40 schema and V50 indexes.

## Operational notes

- Keep the camera guide empty for roughly one second after opening so the surface baseline can calibrate.
- Remove each captured card from the guide until **Ready for the next card** appears. Requiring an empty-surface transition prevents autofocus and hand movement from duplicating the same card.
- Automatic mode accepts only high-confidence, multi-signal matches. Everything else enters the confirmation lane.
- The visual index must be at least 98% complete before scanning is enabled; this prevents a partially indexed catalogue from silently omitting the correct card.
- Tesseract remains a parallel verification signal and is reused until the scanner unmounts, but OCR cannot remove or outrank a clearly stronger image result.
- Diagnostics is admin-only because the entire scanner is mounted inside the existing protected admin intake page.
- If visual search fails, Diagnostics now prints the endpoint/database error instead of labelling OCR-only fallbacks as visual matches.
