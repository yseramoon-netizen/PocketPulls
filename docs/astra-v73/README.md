# Ancient Pulls — Astra 73

This release continues V72's articulated Astra wish ceremony and refreshes the observatory interface. It does not deploy itself or change your Supabase data.

## Install

Choose **one** method. Do not copy an `ancient-pulls` folder inside your existing Next app.

### Existing project: guarded installer

Keep `install-astra73.mjs` outside the project, then run:

```sh
node install-astra73.mjs /absolute/path/to/your/project
node install-astra73.mjs /absolute/path/to/your/project --apply
```

The first command is a read-only preview. The second installs only recognized versions, creates a backup outside the active project, and supports both `app/` and `src/app/` layouts. If it reports unfamiliar edits, stop and merge those files instead of forcing an overwrite. Keep the backup until your deployment is verified.

### Clean project: complete ZIP

Extract `Ancient-Pulls-V73-Complete-Website.zip` into a new folder. Its root already contains `package.json`, `app`, `components`, and `lib`.

Keep your real environment values private. Configure the same Supabase and hosting environment values used by your current app. No credentials are included.

```sh
npm ci
npm test
npm run build
```

Then deploy through your existing Vercel workflow. A successful local build does not publish the update to ancientpulls.com.

## What changed

- One shared navy, ice-blue and gold visual system across player headers, panels, controls, catalogue, binder, navigation, loading/error states and guides.
- Constellation stars now match the cinematic's diamond-shaped light; the measured scene header accommodates long mobile names and keeps search/info controls apart.
- The top-100 universe has defined spiral galaxies, a layered accretion disk and photon ring, slow real orbits, bounded rank sizes, portrait fitting, and keyboard rotation/zoom controls.
- Galaxy texture generation is spread across frames. Camera easing is time-based. Hidden tabs suspend animation; reduced-motion and data-saving preferences remain supported.
- Home and Wishes use an articulated Astra idle with cape motion, breathing, feet movement and a small wave. The wish ceremony adds woven flight trails, rarity-colored reflected light after reveal, and longer-lived star-birth particles.
- Page search is inside navigation and accessible from the menu. Existing merged destinations are preserved: support in Help, trades in Friends, orders in Shipping, and history in Constellation.
- The obsolete non-transactional `/api/pull` endpoint returns 410. Price refresh requires administrator access; its old mutating GET is disabled. The wish API requires an explicit idempotency key and rejects incomplete reveal responses.

## Preview without an account

Open `docs/history/Astra-Flight-Preview.html` for the single/ten-wish animation and `docs/history/Universe-Preview.html` for the ranked-universe renderer. These use fictional results/sample collections, perform no purchases, and do not connect to Supabase. They are design previews, not live-account end-to-end tests.

## Verification and limits

See `validation-v73/` for the production build, regression results, installer checks, HTTP smoke checks and renderer review. The production build uses inert placeholder configuration, never real credentials.

The browser environment rejected local preview URLs, so full browser-based interaction/accessibility testing and physical iPhone/Android frame-rate measurements could not be completed. Native canvas rendering validates the production artwork and rendering path, not a guaranteed 60 fps on every device.

Live sign-in/email delivery, real wish spending, checkout/webhooks, shipping submission, trades, production database policies and scanner camera recognition still require staging accounts and representative devices. Keep payments disabled until your existing release requirements and business details are verified. No claim of universal 10/10 quality or complete live-service validation is made.

## Compatibility notes

The administrator price action now uses the existing `admin_users` / server admin allowlist used by the modern admin routes. Test founder access in staging before release. Existing internal database identifiers with legacy mascot names are intentionally preserved to avoid breaking saved accounts or RPC contracts.

This update does not alter odds, rarity allocation, wallet values, card ownership, legal policy terms, or database migrations.
