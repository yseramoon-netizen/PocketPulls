# Ancient Pulls V67.13 release checklist

The source build is only one gate. Do not open paid orders until every blocking
row below is signed off against the real production deployment and database.

## Automated gates

- [ ] Run `npm ci` on a clean checkout.
- [ ] Run `npm run check:release`.
- [ ] Load the real deployment environment and run `npm run check:release:production`.
- [ ] Run `npm run build` with production-equivalent environment values.
- [ ] Run `npm audit --omit=dev`; release only when it reports zero known vulnerabilities.
- [ ] Deploy with `ANCIENT_PULLS_ORDERS_OPEN=false` first.
- [ ] Confirm `GET /api/health`, `/robots.txt` and `/sitemap.xml` return 200.
- [ ] Confirm API, account and admin responses include `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
- [ ] Run `supabase/RELEASE_DATA_AUDIT.sql`; retain the results with the release record.

## Account and access gates

- [ ] New registration creates exactly one profile and wallet.
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
