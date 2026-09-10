# Ancient Pulls consumer and privacy launch checklist

This release implements the public-facing first version. Complete the business-specific fields and operating procedures below before enabling paid orders.

## 1. Publish the real operator

Set the public environment variables in `ENVIRONMENT.txt`. The legal operator must be the actual contracting person or incorporated entity, not only the brand name. Use a geographic address at which the business can be contacted; do not use a blank field or a fictional address.

Paid checkout is code-locked until the legal name, address, customer-service email and privacy contact exist.

## 2. Apply the database migration

Run:

`supabase/migrations/20260901_consumer_privacy_checkout_v6712.sql`

It:

- activates purchase-consent version `2026-09-01-v2`;
- records the per-order checkout wording version and immediate-access request;
- records when and where the durable order confirmation was sent; and
- ensures email signups can carry the current consent into the account.

Existing accounts are shown the refreshed one-time acknowledgement because the consumer terms changed materially.

## 3. Configure and test contract confirmations

Configure `RESEND_API_KEY`, a verified `ANCIENT_PULLS_ORDER_EMAIL_FROM`, and the production site URL. The Stripe webhook sends a durable contract-confirmation email after a successful payment and uses an idempotency key to prevent duplicate emails on webhook retries.

Before launch, make one low-value live purchase and verify all of the following:

- the checkout summary shows seller, quantity, total, random-card description, delivery arrangement and cancellation links;
- the hosted final payment control unambiguously indicates payment;
- the email arrives and contains the correct legal operator, address, support email, total, order reference, cancellation wording and policy links;
- `confirmation_sent_at` and `confirmation_email` are written to `wish_purchase_orders`; and
- a Stripe webhook retry neither duplicates credits nor sends a second confirmation.

## 4. Finish the ICO privacy exercise

The in-app notice is tailored to the data found in this codebase and follows the structure of the ICO small-business privacy tools. The operator should still complete the current free ICO general-business generator and compare its answers with `/privacy` whenever providers or uses change:

https://ico.org.uk/create-your-own-privacy-notice

Document, outside the public notice:

- the controller and responsible person;
- each processing purpose and lawful basis;
- processor contracts and international-transfer safeguards;
- the retention owner and deletion/review dates;
- a legitimate-interests assessment for security, fraud prevention and service integrity; and
- whether the business must pay the ICO data-protection fee.

Do not add marketing, analytics, advertising pixels or a new processor without updating the data map and notices first.

## 5. Operate the 2026 privacy-complaint process

Privacy complaints can arrive through the published privacy email or Help → Support. For every complaint:

1. Record the received date, identity/contact route, issue and requested outcome.
2. Acknowledge it within 30 days.
3. Begin proportionate enquiries without undue delay; do not wait until day 30.
4. Ask for ID or authority only when genuinely needed.
5. Keep the complainant informed if investigation takes time.
6. Record the evidence considered, outcome, response date and corrective action.

Configure an inbox auto-acknowledgement or monitored workflow for complaints sent by email. Support tickets already provide an immediate on-screen ticket acknowledgement.

## 6. Run returns and delivery fairly

- Accept a clear cancellation statement; never require the model form.
- Log the date, order, unused/used credits, cards, return evidence and refund calculation.
- Make deductions only where lawful and explain them.
- Do not silently substitute an unavailable card.
- Offer an earlier paid-delivery route before the free-shipping threshold, with the cost and estimate agreed in advance.
- Keep evidence of dispatch, loss/damage handling and the date risk passed on delivery.

## 7. Re-audit cookies and browser storage

The current code does not load optional analytics or advertising trackers. The notice therefore informs users about essential and requested-preference storage without presenting a misleading consent choice.

If optional technology is added later, implement prior consent where required, equal accept/reject controls, granular purposes, a persistent way to withdraw, and consent records before loading it.
