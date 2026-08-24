# Ancient Pulls production optimisation

Completed: 20 August 2026

## Outcome

This pass optimises the production application without changing wish odds, ownership, wallet, XP, leaderboard, cosmetics, authentication, scanner inventory insertion, achievements, trades, shipping, or admin workflows.

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Public asset footprint | about 72 MiB | 39.4 MiB | about 45% smaller |
| Referenced PNG artwork set | 50,551,487 bytes | 34,721,282 bytes | 15,830,205 bytes / 31.3% smaller |
| Largest server JavaScript chunk | 4,487,283 bytes | 220,341 bytes | 95.1% smaller |
| Production `.next` output | about 45 MiB | about 35 MiB | about 22% smaller |
| `/wishes` initial JavaScript | about 434 KiB | 390.0 KiB | about 44 KiB smaller |
| `/collection` initial JavaScript | about 434 KiB | 395.8 KiB | about 38 KiB smaller |
| `/constellation` initial JavaScript | about 448 KiB | 413.8 KiB | about 34 KiB smaller |
| `/wishes/preview` initial JavaScript | about 450 KiB | 415.5 KiB | about 35 KiB smaller |
| `/admin/add` initial JavaScript | about 403 KiB | 352.1 KiB | about 51 KiB smaller |
| Admin forest backdrop | about 115 nodes / 90 animations | 18 nodes / 13 animations | about 84% fewer nodes and 86% fewer animations |

All converted visual assets use lossless WebP. The appearance is preserved; the browser downloads and decodes less data.

## What changed

### Rendering and interaction

- Replaced the admin forest's repeated emoji elements with consolidated tree, grass, leaf and firefly fields.
- Removed permanent whole-document mutation observers. Mascot-name personalisation is scoped to the player shell and batches mutations into one animation frame.
- Removed the document-head observer previously used to keep the page title in sync.
- Reused constellation canvas objects and context state, removed hot-path array sorting and allocation, and precomputed occupied zodiac points.
- Deferred onboarding, notification, preference, reward-check and modal code until it is needed or the browser is idle.
- Lazy-loaded the card scanner, wish cinematic, wish details and collection card modal.
- Reused `Intl` formatters instead of constructing them repeatedly while rendering lists.

### Network and database work

- Routine Supabase token refreshes no longer repeat profile, wallet and consent queries.
- Completed first-wish onboarding is remembered locally, avoiding the same RPC on every visit.
- Notification refreshes are deduplicated, visibility-aware and reduced from every 60 seconds to every 180 seconds.
- Open-trade fallback polling is reduced from every 5 seconds to every 15 seconds; Realtime remains the primary update path. The fallback no longer reloads the complete inbox and friend list each time.
- Admin inventory and price refreshes pause while hidden, focus/visibility refreshes are deduplicated, and external-price checks follow the existing 15-minute freshness window.

### Scanner

- Kept the image-first whole-catalogue identification path; OCR remains supporting evidence.
- Removed per-reference `map`, `sort` and `slice` allocations from visual-index searching.
- The third OCR frame is now a recovery pass only. When the first two frames agree on a collector fraction or normalised name, OCR stops while visual matching still uses every captured frame.
- Tesseract remains dynamically imported and is not part of the admin-add initial bundle.

### Assets and server deployment

- Converted 65 actively referenced PNGs to lossless WebP.
- Removed replaced PNGs and confirmed-unused legacy/public duplicates from the deployable project.
- Moved private Shaymin artwork out of a 4.5 MB base64 TypeScript object and out of public assets. The authenticated route reads binary files from `private-assets/shaymin`.
- Added narrow Next.js output-file tracing so all 18 protected artwork files are included in server deployments.
- Added long-lived browser caching for versioned artwork directories, compression, modern image formats and security headers.

## Verification completed

- TypeScript: clean (`tsc --noEmit`).
- Next.js production build: clean; all 50 static pages generated and all routes compiled.
- Performance budget: clean, with no route, asset or server-chunk violations.
- Protected artwork trace: all 18 private PNG files present in the route trace.
- HTTP smoke test: `/sign-in`, `/admin/sign-in`, `/wishes/preview`, the manifest and representative WebP assets returned 200; `/` returned its expected redirect.
- Static asset headers: confirmed WebP content type, one-week cache with stale-while-revalidate, `nosniff` and referrer policy.
- Scanner benchmark export: 1/1 operator-confirmed sample correct, top-three and confidence unchanged. More labelled scans are needed before treating scanner accuracy or latency as statistically measured.
- Focused lint for changed production modules: zero errors. The repository-wide lint command still reports pre-existing legacy warnings/errors in untouched files.

## Performance guard

Run after a production build:

```bash
npm run audit:performance
```

The command fails when a route exceeds 470 KiB of initial route JavaScript, a public asset exceeds 2.5 MiB, or a server chunk exceeds 1 MiB.

## Deployment

1. Preserve the deployment's existing environment variables.
2. Replace the project with this complete build rather than copying only individual source files; asset extensions and private-art storage changed together.
3. Install dependencies and run `npm run build`.
4. Run `npm run audit:performance`.
5. Deploy normally. No database migration is required for this optimisation pass.

For reliable scanner tuning, export at least 30–50 labelled diagnostics covering modern, vintage, sleeved, glare and low-light cards, then run:

```bash
npm run benchmark:scanner -- --input ./scanner-results.json
```
