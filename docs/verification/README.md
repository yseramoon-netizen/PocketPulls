# V82 verification

Verified on 25 September 2026 with Node 24.19.0, Next 16.3.4 and Chromium 153 in this execution environment.

## Automated results

| Check | Result |
| --- | --- |
| Locked dependency installation (`npm ci`) | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build (`npm run build`) | Passed |
| Regression suites (`npm test`) | 121 passed, 0 failed |
| Main browser journeys | 20 passed — `browser-results.json` |
| Additional phone and cancellation journeys | 7 passed — `browser-edge-results.json` |
| Recharge price comparison and selection | 1 passed — `browser-recharge-results.json` |
| Early reveal by button and Escape | 2 passed — `browser-reveal-results.json` |
| Existing performance budgets | Passed, no violations |
| ESLint on new and changed interaction files | 0 errors; 2 existing Observatory image-element warnings |

The browser runs exercise the real Next application with intercepted fictional Supabase accounts, wallets, card images and store responses. They cover desktop 1440×960, phone 390×844, narrow phone 320×740 and landscape 844×390. The tests check a persistent canvas across panels, menu and recharge visibility, accidental and cancelled gestures, mouse/touch/keyboard wishes, one UUID per wish, retry after a lost response, reload recovery, insufficient balance, reduced motion, focus restoration, viewport fit and uncaught browser errors.

The fixture’s card artwork is visibly labelled FICTIONAL TEST CARD. It is not a replacement for the real inventory. The fixture’s closed-checkout response tests the existing ordering state; it does not change the production ordering flag.

## Visual review

Current browser captures are in `screenshots/`. They include the binder, settings, universe, wish ceremony, phone menu, no-power state, recharge panel, narrow phone, landscape and empty collection. They were inspected for layout, clipping and interaction placement. The binder controls were compacted, customization was collapsed, the zoom rail was moved clear of Astra, and the idle staff target was made stationary during this review.

## Practical limits

These checks establish reproducible behaviour in the tested browser and emulated viewport sizes. They are not a claim of universal frame rates or subjective perfection. Real Supabase permissions, actual Stripe purchases and webhooks, audio playback on physical speakers, real mobile Safari, and performance on physical phones require a pass in the owner’s configured environment. No live wishes were spent and no live deployment was made.

To repeat locally, install the locked dependencies, run `npx playwright install chromium`, then `npm run test:browser`. The test runner supplies its own fictional backend configuration. `ANCIENT_PULLS_QA_PORT` can select a different port. An existing compatible Chromium binary may be selected with `ANCIENT_PULLS_BROWSER`.
