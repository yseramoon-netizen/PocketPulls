# Ancient Pulls · Astral 71

This release redesigns the complete available Ancient Pulls application. The active app is in `ancient-pulls/app`, with its components in `ancient-pulls/components`. The updated wish cinematic is wired into the actual Wishes page. Do not put the release inside a new `source` directory in your project.

Open **Ancient-Pulls-V71-Design-Review.html** to review the visual direction offline. It contains sample collections, the production constellation and universe drawing code, and all ten Aster ceremony outcomes. The review is a design demonstration: it does not sign in, spend wishes, query inventory or award cards.

## What changed

- A shared observatory design: clear Geist typography, warm gold accents, quiet dark surfaces and consistent mobile controls.
- Constellation and Universe promoted into primary navigation, with a compact mobile dock.
- Constellation: unobstructed sky, finer star shapes, readable responsive title, coordinated search/info panels, a card archive and a single camera dock. Search opens with `/`; Escape closes panels.
- Universe: 100 ranked collections, a central black hole for #1, bounded galaxy sizes and closer orbits for higher ranks. Search by name or rank; jump to your galaxy, pause, zoom and recenter. Pinch zoom works on touch devices.
- Fixed invalid spiral-arm geometry for some account ID hashes. Galaxy particles are rendered into a bounded texture cache so orbit frames reuse the detailed artwork.
- Orbit motion now freezes in place and resumes without jumping. Hidden tabs stop advancing the orbital clock.
- Aster integrated into the overview, wish chamber, sign-in and empty/loading states. The retired wardrobe is removed from the active achievements page; owned entitlement records remain unchanged.
- Binder and catalogue frames, forms, filters and information hierarchy are restyled around the actual card artwork.
- Help and policy pages use readable article typography. Existing policy wording, contacts and purchasing restrictions remain in place.
- Trades stay inside Friends; support stays inside Help; Shipping includes orders; history stays inside Constellation. No standalone navigation links were restored.

## Update your existing project

The installer is a checked overlay of the redesigned files. It preserves existing shared dependencies and only adds missing ones. Unexpected edits in files it needs to replace are reported before any writes. Your existing environment values, database, authentication, wish allocation, scanner, purchases and ownership records are not changed by the installer.

Run from the unpacked release directory, using the folder that contains your existing `package.json`:

```sh
node apply-redesign.mjs /path/to/your/project
node apply-redesign.mjs /path/to/your/project --apply
```

On Windows, quote paths containing spaces:

```powershell
node .\apply-redesign.mjs "C:\path\to\ancient-pulls"
node .\apply-redesign.mjs "C:\path\to\ancient-pulls" --apply
```

Then run `npm run build` in the existing project and publish through its existing Vercel project. The menu shows **Ancient Pulls · Astral 71** after this version is running. A build error mentioning `source/components/player/WishCinematic.tsx` can indicate that an earlier update was extracted into a duplicate source folder. Move that extracted package outside the app before installing; the installer stops if it finds that condition.

Backups are made before replacement. Keep the release files together: the installer needs `ancient-pulls/` and `redesign-manifest.json` beside it.

## Complete source

`ancient-pulls/` is also a complete Next.js project. Dependencies remain Next.js 16.3.4 and React 19.2.4 with the existing lockfile. For a clean checkout, install using `npm ci`, supply the real environment values from your existing project, and run `npm run build`. No new migration is introduced by this redesign. Existing migrations are retained for reference; do not rerun them as part of this installation.

## Verification and limits

The complete application production build and 48 regression checks passed. The checks include existing wish, scanner, filter and recovery behavior, plus bounded galaxy geometry, signed account seeds, orbit continuity, pause/resume and hidden-tab timing. The offline review also initializes and issues finite drawing commands at desktop and portrait dimensions. Verification logs are included.

This source is based on the complete V68 project available in the workspace, with the V70 pixel ceremony and this V71 redesign. The newer live repository was not available during this work. The checked installer stops on unexpected file differences to protect work in a newer checkout. A successful local build does not prove that live credentials, database contents or account journeys work in production. No authenticated browser/device QA or production publication was performed. 60 fps remains the animation target, not a benchmark claim for every device.
