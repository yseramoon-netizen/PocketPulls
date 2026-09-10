# Ancient Pulls — Astral 71

Complete available Next.js application with the Astral 71 redesign and Aster pixel ceremony.

Start with `../READ-ME.md` in the release package. The active app is `app/`, and its components are in `components/`. Do not nest the project in a duplicate `source/` folder inside an existing app.

```sh
npm ci
npm run build
```

Supply your existing project's environment values before building for deployment. No production credentials are included. The verified build used inert test values. No new database migration is required by the redesign.

Regression checks:

```sh
node --test scripts/astral-regression.cjs scripts/core-regression.cjs scripts/observatory-regression.cjs
```

The release package includes a checked overlay installer, an offline interactive design review and verification logs. Historical V68 documents describe the earlier baseline and are retained as release history; the outer Astral 71 readme is current.
