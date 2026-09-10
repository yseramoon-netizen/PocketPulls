# Ancient Pulls V68 release checklist

The source build is only one gate. Do not open paid orders until every blocking
row below is signed off against the real production deployment and database.

## Automated gates

- [ ] Run `npm ci` on a clean checkout.
- [ ] Run `npm run check:release`.
- [ ] Run `npm run test:core` (26 behavioural regressions).
- [ ] Run `npm run audit:performance` after building.
- [ ] Load the real deployment environment and run `npm run check:release:production`.
- [ ] Run `npm run build` with production-equivalent environment values.
- [ ] Run `npm audit --omit=dev`; release only when it reports zero known vulnerabilities.
- [ ] Deploy with `ANCIENT_PULLS_ORDERS_OPEN=false` first.
- [ ] Confirm `GET /api/health`, `/robots.txt` and `/sitemap.xml` return 200.
- [ ] Confirm API, account and admin responses include `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
- [ ] Run `supabase/RELEASE_DATA_AUDIT.sql`; retain the results with the release record.

## Account and access gates

- [ ] New registration creates exactly one profile and wallet.
- [ ] An existing auth user with a missing profile or wallet is repaired on sign-in without receiving duplicate promotion credit.
- [ ] Email verification lands on the intended production origin.
- [ ] Verification resend behaves correctly and cannot be spammed accidentally.
- [ ] Password reset and update work end to end.
- [ ] Sign-out clears player and administrator sessions.
- [ ] Non-admin accounts cannot reach any `/admin` page or API.
- [ ] Lukas and Skye receive preview controls; an ordinary account never does.

## Commerce gates — blocking before `ANCIENT_PULLS_ORDERS_OPEN=true`

- [ ] Enter the exact legal operator, service address and support/privacy contacts.
- [ ] Review the Terms, Returns, Shipping, Privacy, Cookies and Contact pages with the final business facts.
- [ ] Apply `supabase/migrations/20260901_consumer_privacy_checkout_v6712.sql`.
- [ ] Apply `supabase/migrations/20260901_consent_and_open_wishes_v6714.sql` after V67.12.
- [ ] Apply `supabase/migrations/20260901_wish_request_schema_collision_v6715.sql` after V67.14; this is required even if V67.14 already ran.
- [ ] Accept the current acknowledgement twice; both calls succeed and retain one row for the current consent version.
- [ ] Configure the live Stripe key and signing secret; verify the webhook endpoint signature.
- [ ] Configure Resend with a verified sender domain and test delivery to two unrelated mail providers.
- [ ] Complete one low-value live payment, then refund it through the real operator process.
- [ ] Confirm a browser retry returns the same active Stripe Checkout rather than another pending order.
- [ ] Confirm one Stripe webhook credits wishes exactly once even when replayed.
- [ ] Confirm the paid order stores the per-order acknowledgement version and timestamp.
- [ ] Confirm the contract email contains price, quantity, random physical-card wording, legal links and contact details.
- [ ] Confirm cancelled and expired Checkout sessions never credit wishes and release first-recharge eligibility correctly.
- [ ] Confirm an unused wish can follow the documented cancellation/refund route.
- [ ] Confirm the shop stays locked if any legal, Stripe or confirmation-email setting is removed.

## Wish, inventory and persistence gates

- [ ] Make ordinary, high-rarity and forced administrator test wishes; each decrements the correct balance once.
- [ ] Make a wish from two ordinary non-Founder accounts; neither path checks any pre-release registration list.
- [ ] Replay the same wish request UUID; it returns the original card and does not spend a second wish.
- [ ] Verify the authoritative 1-in-100,000 black-hole route without exposing progress or the result early.
- [ ] Verify unique issue numbering under two near-simultaneous wishes.
- [ ] Confirm a pulled card persists after refresh in binder, history, constellation, shipping and achievements.
- [ ] Confirm no out-of-stock or invalid catalogue row can be allocated.
- [ ] Reconcile physical launch stock against `inventory.quantity` and photograph/count the launch batch.
- [ ] Test card removal/reset/admin destructive controls only with a disposable test account.

## Shipping and social gates

- [ ] Test below-threshold shipping guidance and the Help contact route.
- [ ] Test threshold unlock, address validation, explicit card selection, request creation and order timeline.
- [ ] Confirm reserved cards cannot be selected twice and cancellation restores them.
- [ ] Test packing, tracking, shipped and delivered states from operator and player views.
- [ ] With two ordinary accounts, test friend request, acceptance, trade proposal, acceptance and rejection.
- [ ] Confirm Trade is entered from Friends; `/trade` only redirects into that panel.
- [ ] Confirm Orders is inside Shipping, History is inside Constellation and Support is inside Help.

## Device, animation and accessibility gates

- [ ] Test current iPhone Safari and Android Chrome on real devices, not only emulation.
- [ ] Test desktop Safari, Chrome and Firefox with normal and slow network profiles.
- [ ] Verify Nebu, Sherry and Bubbles skins, persistence and reveal-specific animation behaviour.
- [ ] Verify all rarities remain concealed until the final swipe; black hole has no swipe.
- [ ] Confirm the Universe Ranks galaxies visibly orbit and remain usable with reduced motion.
- [ ] Confirm Find a Card never covers Show Info and long constellation names fit small screens.
- [ ] Complete keyboard-only navigation, visible-focus, screen-reader landmark and colour-contrast checks.
- [ ] Test `prefers-reduced-motion`, 200% zoom and landscape mobile.
- [ ] Record Core Web Vitals and reveal-scene frame rate on mid-range hardware; investigate visible stutter.

## Scanner performance and safety gates

- [ ] Finish the whole-catalogue visual index before enabling automatic intake.
- [ ] Confirm strong automatic scans use `visual-verify`, strong confirmation scans use `visual-only`, and weak or close scans use `recovery`.
- [ ] Confirm automatic intake requires at least two captured frames and never accepts a single uploaded image.
- [ ] Test modern left-number and legacy right-number card layouts.
- [ ] Export at least 100 operator-confirmed scans and run `npm run benchmark:scanner`.
- [ ] Record overall and per-strategy accuracy, p95 latency, OCR latency and visual-search latency.

## Operational sign-off

- [ ] Production database backup and restore procedure tested.
- [ ] Stripe, Supabase, Resend and hosting alerts route to a monitored operator.
- [ ] Customer-service owner and response schedule assigned.
- [ ] Refund, privacy-rights, chargeback and lost-delivery runbooks rehearsed.
- [ ] Rollback owner, last-known-good deployment and maintenance message confirmed.
- [ ] Final smoke test completed after DNS, HTTPS and environment configuration.
- [ ] Only after all commerce blockers pass, set `ANCIENT_PULLS_ORDERS_OPEN=true` and redeploy.

Release owner: ____________________  Date/time: ____________________

Second checker: ___________________  Deployment: ___________________

## V68 interaction checks

- [ ] Open page search from the mobile menu and with Ctrl/Cmd K; use arrows, Enter and Escape.
- [ ] Set binder/catalogue filters and page, open a card, navigate away and return with Back.
- [ ] Open a binder card in Shipping: one available copy is selected; nothing is submitted automatically.
- [ ] Open a binder card in Constellation and confirm the camera arrives at the matching star.
- [ ] Change preference sliders quickly and confirm the final values survive refresh.
- [ ] Interrupt a wish response, reload, then recover the pending request; check that the same card returns and the balance changes once.
- [ ] Confirm cinematic loading copy and screen-reader labels reveal no result early.
- [ ] Open and close nested dialogs; keyboard focus and scrolling recover correctly.
- [ ] Stop recognition while visual search is pending: queued scans do not write stock.
- [ ] Scan a wrong-number lookalike and a one-frame image; both require confirmation.
- [ ] Simulate a lost inventory-add response: check inventory before resubmitting that physical card.
