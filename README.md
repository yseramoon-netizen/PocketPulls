# Ancient Pulls V71.1 — installation repair

This corrects the V71 release packaging. All five observatory modules were already included, but placing the `ancient-pulls/` folder inside an existing project causes TypeScript to compile that nested copy while `@/` still resolves to the outer project's components. That reproduces the 13 reported missing-module errors and can leave the active website unchanged.

## Repair the existing project

1. Download `repair-astral-71.mjs` into the existing repository folder that contains the **active** `package.json` and `tsconfig.json`. Use the outer project folder, not the newly extracted nested `ancient-pulls/` folder.
2. Open a terminal in that project folder and run:

```sh
node repair-astral-71.mjs --apply
npm run build
```

An optional check without writes is `node repair-astral-71.mjs`.

The script contains the complete verified redesign overlay and its dependencies; no other downloaded files or network connection are needed for the repair. It supports both root `app/` and `src/app/` layouts when the existing `@/` alias matches.

It installs the redesign into the active app and moves recognised, unedited nested V71 copies outside the project. Original changed files and the nested copy are preserved in a sibling backup folder; the terminal prints its location. It stops before writing if a file that must be replaced has unfamiliar changes, if a nested copy contains unfamiliar source edits, or if the layout is ambiguous. Existing dependencies are preserved when already present. On an installation error, changed files and moved folders are restored.

After a successful build, commit the updated active files **and the removal of the nested copy**, then deploy using your normal Vercel project. Keeping the old nested source tracked will recreate the error on the server. The navigation menu displays **Ancient Pulls · Astral 71** when the redesign is running.

Do not change `@/*` to point at the nested copy, suppress TypeScript errors, or merely exclude the duplicate folder while leaving the active website on its old source.

If the script reports unfamiliar edits, preserve them and merge those files against the redesign before applying it. Do not replace your current backend with an older complete checkout simply to bypass this check.

## Corrected complete ZIP

The complete ZIP now has `package.json`, `tsconfig.json`, `app/`, `components/`, `lib/`, and `public/` at its archive root. There is no `ancient-pulls/` or `source/` wrapper inside the archive. All five observatory modules are at `components/player/observatory/`.

For a fresh checkout, extract into an empty project folder, run `npm ci`, supply your existing environment values, and run `npm run build`. If the repository itself is a subfolder of a monorepo, Vercel's project Root Directory must point to the directory containing this package.json.

For an existing live repository, use the repair script above so that unexpected newer edits are protected.

## Scope and verification

The visual source is unchanged from Astral 71. This delivery fixes how it is installed. The full source is based on the available V68 project plus the V70 Aster ceremony and V71 redesign; the current live repository was not connected during this repair. No environment values, migrations, account records, or server purchase allocation are modified by the repair script.

Verification reproduces all 13 reported missing observatory imports in a deliberately nested V71 copy, runs the repair, and checks that TypeScript succeeds. Additional checks cover a dry run, preservation of unfamiliar active/nested edits, external backups, repeat execution, and the `src/` layout. A production build of the repaired fixture is included in the verification logs.

This package does not publish the live website automatically.
