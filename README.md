# Ancient Pulls — V68

A Next.js application for wishes, card collections, constellations, friends and physical-card fulfilment. V68 improves navigation, mobile dialogs, interrupted requests and scanner intake while preserving the existing visual identity and merged player navigation.

Start with **INSTALL-V68.md**. This is a complete source snapshot based on V67.16, including existing artwork, server routes and migrations. It is not a deployed site.

## Local setup

```sh
npm ci
```

Copy `.env.example` to your local environment configuration and supply the real project values. Keep credentials out of source control. The verified build used Node 24 and the pinned Next.js 16.3.4 / React 19 dependencies.

```sh
npm run test:core
npm run check:release
npm run build
npm run audit:performance
```

`npm run check:release:production` validates deployment configuration. Run it with the real environment loaded. Existing consumer, payment and email readiness checks still apply; see **RELEASE_CHECKLIST.md**.

## Release contents

- **RELEASE-V68.md** — changes and scope.
- **VALIDATION-V68.md** — executed checks, bundle measurements and remaining live verification.
- **validation-v68/** — test output, production build output and performance reports.
- **CHANGESET-V68.patch** — application-code differences from the V67.16 working snapshot, for review.
- **supabase/migrations/** — retained database migrations. V68 introduces no new migration.

The scanner diagnostics export can be evaluated with:

```sh
npm run benchmark:scanner -- --input ./scanner-results.json
```

That command needs real confirmed scan decisions. Synthetic regressions do not establish camera accuracy or scanning speed.
