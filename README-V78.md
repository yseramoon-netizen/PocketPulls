# Ancient Pulls V78 — Observatory

This update combines Constellation and Universe into `/observatory`.

## Apply the update

Copy the `app`, `components`, `lib` and `scripts` files in this archive into the matching locations in your existing Ancient Pulls project, beside `package.json`. Replace matching files and add every new file. Keep all other project files.

This is a changed-files update based on V77. It contains 20 new or changed source files, not a complete project or an installer. No dependency installation or database migration is introduced. Build and redeploy your existing project after copying the files; downloading this archive does not change the live website.

## Changes

- One Observatory destination replaces the separate Constellation and Universe navigation entries.
- The first constellation frame uses the same perspective and depth as every subsequent frame. The cloud has rounded, tapered edges instead of a rectangular footprint.
- Scroll, pinch or use the zoom controls to travel from your constellation, through your galaxy, into the ranked universe. Card stars gather into the galaxy's spiral during the transition.
- Your galaxy stays marked and has a direct return control. Accounts outside the top 100 receive a personal marker without an invented rank. The Pharaoh remains the central black hole.
- Friend markers and friendship requests are removed from this scene. Friends and trades remain available through the existing Friends page.
- Card search, recent pulls, memory details, ranking search, wish-star arrivals, 360-degree rotation, pause and reduced-motion support remain available.
- The old `/constellation` and `/leaderboard` addresses redirect while preserving card, history and arrival links.
- The header reserves measured space above the stars. Narrow-screen controls and panels fit their available space.

## Verification

- Production Next.js build and TypeScript check passed using placeholder build-time service configuration.
- 97 project regression tests passed, including seven new tests for initial geometry, camera continuity, ownership, redirects and frame-rate-independent damping.
- 29 React DOM interaction checks passed in jsdom, including navigation, zoom, pinch, rotation, card search, wish arrivals, rendering recovery, settings and wish playback.
- Desktop and mobile scene renders were inspected. The nine-second preview uses the production canvas renderer, sample collections and native GPU renders of the production black-hole shader. Its captions identify the view; it is not a recording of the live website.
- The preview is exported at 60 fps. Real-browser, authenticated production and physical-device frame rates have not been verified in this environment.

The map displays the latest 1,600 requested wish records, subject to your API's row limit, plus explicitly linked or arriving wish stars. Your full binder is unchanged.
