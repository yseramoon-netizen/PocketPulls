# Astra V72 — flight, creation, and constellation delivery

Astra is now a layered pixel character with articulated sleeves and boots, three head views, casting and celebration expressions, turning, and a cape driven by an inertial cloth chain. The production canvas advances on every `requestAnimationFrame`; it has no fixed 24 fps sprite holds.

## Player journey

**One wish:** a looping flight settles into casting. Two hand trails gather a neutral seed; the light contracts before it grows and acquires the awarded rarity. The awarded card appears, and **Continue to constellation** takes the player to their own sky. Astra carries the new star to its actual projected wish position.

**Ten wishes:** a charged ascent leads to an accretion disk. Ten stars separate from the seed, acquire their individual rarity colours, and orbit Astra. The result grid shows all ten awarded cards. Continue delivers those same wish IDs to the real constellation.

All opening animation and audio cues are independent of rarity. Colour, the black-hole variant, and reward names remain hidden until star creation. The one-wish opening lasts 9.6 seconds; the ten-wish opening lasts 11.6 seconds. Result controls appear after 12.8 and 16.4 seconds respectively. Placement takes up to 5.8 seconds and can be finished immediately.

The existing private preview entitlement check is retained. It now includes a ten-wish sample with every rarity. Sample previews never call the wish RPC.

## Install into an existing project

Download `install-astra72.mjs` and place it beside the **active** `package.json`. Then run:

```sh
node install-astra72.mjs
node install-astra72.mjs --apply
npm run build
```

The first command checks without writing. The installer supports both `app/` and `src/app/` when the `@/*` alias points to that source root. It includes the observatory modules, the preferences hook, and every local code import required by the overlay. Public artwork always goes under the root `public/` directory.

The installer protects unfamiliar edits to files it must replace, preserves existing dependency files, and backs up changed files outside the project. Recognised unedited nested V71 checkouts are moved to that backup so TypeScript does not compile them as a second application. Unknown nested checkouts stop installation for a manual merge. It does not change credentials, database migrations, account entitlements, or the server allocation function.

After your build passes, commit the changed active files and any removal of the recognised nested copy. Deploy through your existing project. The navigation menu identifies this version as **Ancient Pulls · Astra 72**. This download does not deploy the live website.

## Complete source archive

For a fresh project, extract the complete ZIP into an empty folder. `package.json`, `app/`, `components/`, `lib/`, and `public/` are at the archive root. Run `npm ci`, supply your existing environment configuration, then `npm run build`.

For an existing live project, prefer the guarded installer so newer local work is preserved. The complete archive starts from the recovered V71.1 source, not a fresh copy of the current live repository.

## Preview

Open `Astra-Flight-Preview.html` locally in a normal browser. It embeds the production renderer, artwork, and synthesised score. Choose a single rarity or all ten, pause, seek, replay, and switch the desktop preview to portrait framing. Continue shows placement in a **sample** constellation. No account, network request, or wish spending is involved.

`Astra-One-Wish-60fps.mp4` and `Astra-Ten-Wishes-60fps.mp4` are silent, 1280 × 720 animation studies rendered from the same production engine at 60 fps. Their transition to placement illustrates pressing Continue. They omit the app's real card artwork and its interactive waiting period; the HTML includes sample result controls.

## Recovery and compatibility

Ten wishes reuse the existing authenticated `make_player_wish(p_idempotency_key)` RPC, once per award. Ten unique keys are saved before spending; each confirmed response is saved before the next request. A network failure can leave a partially completed batch, which the player resumes using those same keys. Completed batches replay without extra spending. Web Locks and shared-progress rechecks prevent a slower tab from overwriting a newer confirmed result. Corrupt or unavailable recovery storage stops a new batch.

This is a resumable sequence of ten existing server transactions, not an atomic server-side ten-pull. Server-side stock and balance rules continue to apply to each wish. This update requires the idempotent V67.14/V67.15 wish RPC already used by V71.1.

Constellation arrivals query wish IDs with the signed-in user's ownership filter. Newly awarded wishes outside the map's first 1,600 entries are fetched explicitly for placement. The constellation now shares the ceremony's rarity palette. Other navigation consolidations remain in the V71 redesign.

## Verification and practical limits

- TypeScript passes and the Next production build completes, generating 59 static pages. Build-only environment values were inert placeholders; no real account was used.
- 65 automated regression checks pass. Coverage includes neutral openings and audio, 60/120 Hz interpolation, timeline completion, hidden-tab pause, batch recovery, lost responses after commitment, stale tabs, account changes, malformed results/storage, and arrival-ID validation. Existing scanner and orbit regressions also pass.
- Native render review inspected flight, side turns, casting, birth, ten-star framing, and portrait layout. Corrections moved the ten-wish seed above the crown, widened the star orbit to avoid body occlusion, softened side-on compression, and removed invisible trail calculations during casting.
- The native renderer's mean and 95th-percentile frame costs are recorded beside the exports. Those numbers exclude encoding and are **not** measurements of browser or phone frame rate.
- The review browser blocked local app and file URLs in this session. Browser layout, real device performance, live authentication, and end-to-end purchases/arrivals therefore remain unverified. No objective “10/10” or universal 60 fps claim is made.

The app retains reduced-motion, skip, sound, pause, keyboard focus, an artwork-failure fallback, responsive result grids, and adaptive pixel resolution. Reduced-motion users receive the result and constellation update without the extended flight. The frame loop adapts resolution rather than deliberately reducing animation cadence.
