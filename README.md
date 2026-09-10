# Aster — the Astral Ceremony

Ancient Pulls · Pixel-art animation update V70 · 9 September 2026

Aster is an original pixel-art star spirit: a pale-gold star hood, expressive eyes, a tiny navy body, a cyan diamond and two short comet streamers. The ceremony follows Aster through a traced constellation, a gathering of starlight, an accelerating comet and a composed card reveal. The black-hole outcome stretches Aster and the starfield into a lensing event horizon that consumes the screen.

## Start with the preview

Open `preview/Aster-Pixel-Preview.html` in a current browser. It is self-contained and works offline. Select any of the ten outcomes, choose **Make a wish**, and use the sound control to hear the original score. Pause, reveal immediately, replay and choose another rarity are included. This preview does not access an account, spend wishes or award cards.

The two MP4s are 1280 × 720 motion studies rendered at 60 frames per second. They use the production scene renderer with a demonstration card overlay and an offline mix of the score. The HTML preview uses the production renderer, stylesheet and Web Audio implementation. In the app, the demonstration card is replaced with the actual server-awarded card image and details.

## Integrating into the current website

This is a **focused animation update**, not a complete website snapshot. The accessible project was V68; the newer Nebu-free site source was not available. Only the animation entry point, score, renderer, artwork and preview tooling are supplied. The update has not been deployed.

If V69 is already installed, this revision changes only the renderer/shaders, the pixel sprite, and the optional preview tooling. The existing cinematic adapter and audio implementation are retained.

1. Review the two replacement files in `source/components/player`: `WishCinematic.tsx` and `wishAudio.ts` against the equivalents in the current site. `changes/V68-animation.diff` shows their changes relative to the available V68 baseline; it is a review aid for that baseline.
2. Add `source/components/player/astral/` and `source/public/ancient-pulls/wish/astral/aster-pixel.webp` at the same paths in the current project.
3. The entry component retains the existing `open`, `card`, `onClose`, `onFinished`, `onWishAgain`, preference and numbered-discovery props. `getWishRarityTheme` and `primeWishAudio` retain their existing import paths. Pass the existing awarded-card object to `WishCinematic`; keep wish allocation and authentication in the current application.
4. The adapter expects the project's existing `useModalFocus`, `usePlayerPreferences`, player preference utilities and `getWishRevealConfig`. It was compiled against Next 16.3.4 and React 19.2.4. If the newer site renamed these adapters, map their imports to the current equivalents rather than restoring old pages.
5. Preserve the existing authorization on the in-app preview page. The standalone preview is a local design review file; it is not a replacement for an authenticated route.

There are no new npm dependencies, database migrations, payment changes or account mutations in this update. Unrelated pages, navigation, policies, inventory and scanner code are not included.

## Motion and performance

The opening is identical for all outcomes through 7.1 seconds, including movement, colour and audio. Rarity is introduced only in the terminal movement. Normal reveals complete at 11.3 seconds; the event-horizon reveal completes at 13.45 seconds. A falling comet grows more than eightfold during its flight.

The renderer uses requestAnimationFrame, a continuous time-based timeline, a 32 × 32 deforming sprite mesh with a stable face and star hood and small WebGL programs. It does not step through 24 fps sprites. Low-effects mode reduces particle count, and automatic quality adjustment reduces pixel resolution instead of lowering the render cadence. Canvas resolution is capped at 1.9 million pixels and 1.75 device pixel ratio before adaptation. The transparent lossless WebP is 96 × 96 pixels and 5,452 bytes. Nearest-neighbour filtering keeps the sprite crisp while its motion remains continuous. The generated source artwork is retained separately.

60 fps is the rendering target and the movie export rate, not a guarantee across every device. The live site has not been profiled on physical phones. Native browser presentation, battery state, GPU capacity and other page activity affect performance. An idle result stops requesting animation frames; paused/hidden ceremonies freeze their clock and stop audio. Reduced motion uses a gentle reveal. Missing artwork, unavailable WebGL and context loss have a card-reveal fallback.

## Verification

- Production Next build passed on the available V68 source with inert test environment values.
- 15 animation regressions passed, including all ten outcomes, outcome secrecy in visuals and score, timing continuity, pause/resume, skip, growing comet, audio cleanup and preview contents.
- Existing 26 core regressions passed in V69; application business logic is unchanged by this art update.
- V69 release preflight: 82 checks passed, zero failures. Live deployment environment checks were not enforced.
- Changed renderer and shader files pass ESLint; the production build passes TypeScript checking.
- V69 production performance budgets passed. V70 replaces the 157 KiB mascot asset with a 5.3 KiB pixel sprite.
- Production scene commands were rendered with software EGL/OpenGL at desktop and portrait dimensions. Shader compilation, linking and rendering completed without GL errors. This validates the renderer, not browser UI layout or device frame rate.

To reproduce the preview and behavioural tests after adding the optional scripts:

```sh
node scripts/build-astral-preview.cjs
node --test scripts/astral-regression.cjs
npm run build
```

Current animation tests, type-check, lint, build and rendering logs are included. The new original PNG and exact image-generation prompt are included in `artwork/`; the application loads the lossless pixel sprite.
