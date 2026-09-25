# Ancient Pulls V81 — cinematic update

This is an incremental update over V80. It contains 25 changed source files, including one new component and one new stylesheet. It is not an installer or a complete project. The live website has not been deployed from this workspace.

## What changed

- **Observatory:** full-screen cinema view with a slow orbital camera; cleaner scene composition without labels or orbital guides in that view; pause, Escape and focus restoration; the main navigation hides during cinema. The same live scene supports drag and zoom.
- **Black hole:** an optically thinner outer disk, irregular moving filaments, warmer ivory/copper emission, restrained highlight bloom and a photon boundary that preserves the foreground disk. Light distortion continues to sample the surrounding scene. This remains a stylised real-time approximation, not a scientific Kerr/DNGR simulation.
- **Astra:** subtle authored camera banking and push-in; a darker anticipation beat; finer casting arcs, hand-emitted particles and disk ribbons; slimmer star diffraction; lower reflected light to retain the pixel artwork. An original synthesized harmonic bed and softer air cues accompany the existing articulated body and cape. Rarity is still hidden until the reveal.
- **Shared interface:** graphite surfaces, calmer typography, clearer form controls, consistent buttons, revised menus and floating mobile navigation. Overview and sign-in share a cached galaxy illustration; Astra stays small. Wishes, binder, catalogue, settings, notifications and Help use the same materials and spacing.
- **Help:** topic search, clear/reset and an empty-result state. Support stays on Help. Shipping & orders, Observatory, and Friends & trades retain their consolidated routes.
- **Reliability:** camera pause stops residual drift; cinema restores focus explicitly; settings no longer read initialization refs during render, while serialized preference saving stays intact; initial Observatory/deep-link state is scheduled safely; the zoom slider initializes during commit rather than reading refs in render.

## Review against the references

| Area | Reference used | Review findings and resulting revision |
|---|---|---|
| Universe | Interstellar’s contrast, black silhouette and luminous accretion flow | The first pass had a cut-out outer edge and a uniform ring across the disk. Revised opacity falloff, filaments, foreground emission and bloom. Reviewed desktop, close approach and portrait native renders. |
| Cinematography | Restrained film camera movement | Added a slow camera drift and a dedicated cinema view. Found and fixed residual motion on Pause, keyboard focus restoration and the navigation stacking above cinema. |
| Wish animation | Genshin’s anticipation and clear reveal staging; articulated character animation | Added camera beats and a brief lighting hush. Reduced washed-out pixel highlights. Reviewed the single and ten-wish sequences at multiple stages, plus an encoded 1,056-frame native capture. |
| Product interface | Apple’s visual hierarchy and quiet controls | Reworked common surfaces and typography, overview composition, sign-in, drawers and mobile navigation. Source/DOM and native layout reviews were used; final browser layout remains unverified. |
| Collection/catalogue | Artwork-first collection displays | Reduced ornamental treatment around cards, made search/filter controls clearer and retained favourite/search flows. No stock statistics were introduced. |
| Utility pages | Clear, focused task interfaces | Unified form, dialog and help materials; added topic search and kept support directly available. Tested settings, saved preferences, nested modal Escape and Help search. |
| Runtime | Responsive interactive scenes | Cached hero artwork, bounded drawing work, adaptive resolution and visibility/pause handling remain in place. Build asset/route budgets pass. Real-device frame time remains to be measured. |

Reference for the black-hole visual target: [Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar](https://arxiv.org/abs/1502.03808). The application renderer uses a much simpler approximation.

These references guided concrete revisions. They are not a claim of parity with a film studio, Apple, or a universal “10/10”.

## Verification

- Production `npm run build`: passed using placeholder Supabase values for compilation and static-page collection.
- Existing project suite plus the new camera regression: **105 passed, 0 failed**.
- Actual React components in jsdom with mock account data: **43 interaction checks passed** (21 Observatory, 22 navigation/settings/Help).
- Changed TypeScript/TSX files: **0 ESLint errors**. Thirteen warnings remain, mainly the existing plain-image usage and unused renderer parameters.
- Existing route/asset performance budget: passed; no budget violations.
- Native visual review: eight Observatory views, fourteen wish keyframes, GPU shader/bloom compilation and rendering, and a 17.6-second, 60 fps native ten-wish capture.
- Both downloadable HTML previews bundle the production renderers. The Observatory preview uses sample galaxies and a small preview controller; the wish preview uses sample cards. Neither signs into accounts, purchases wishes or changes rankings.

## Verification limits

A local browser session was unavailable. Native Canvas/OpenGL renders and jsdom interactions do not establish Chrome/Safari layout parity, touch behaviour or sustained 60 fps on phones. The native print layout engine could not reliably reproduce all modern CSS and is not treated as final browser approval. Production sign-in, payments, shipping, trades, scanner hardware and real account permissions were not exercised against a live backend. Those areas were preserved rather than claimed as end-to-end tested.

The video is a silent native capture of the renderer at 60 fps, not a real-time device benchmark. The wish HTML preview includes the original synthesized audio, enabled by its sound control.

## Apply the update

1. Open the project directory that contains `package.json`.
2. Copy the `app`, `components` and `scripts` files from the changed-files ZIP into the matching paths, replacing those files. Include the new `app/premium.css` and `components/player/observatory/CelestialWindow.tsx`.
3. Keep your existing assets, database migrations, dependencies and environment settings.
4. Run `npm test` and `npm run build`, then deploy through your existing workflow.

No SQL migration, dependency update, installer or full-project replacement is required. The ZIP’s manifest records each changed file and its SHA-256 hash.
