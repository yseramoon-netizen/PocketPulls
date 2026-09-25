Ancient Pulls V77 — Universe animation and Astra sizing

This patch contains only seven changed source files. Copy them into your
existing ancient-pulls project, preserving the app/ and components/ paths.
Then run npm run build and redeploy using your normal process.
Include the NEW BlackHoleRenderer.ts file; UniverseRenderer.ts imports it.
No new npm packages, image assets, database changes or installers are needed.

Changes
- GPU-rendered accretion flow with differential rotation, approximate light
  bending, asymmetric emission, a smooth photon boundary and soft bloom.
- Disk orientation responds continuously to the existing full 3D camera.
- Wider galaxy orbits, more evenly spaced initial positions, smaller large
  galaxies, stronger axial spin and slightly faster orbital motion.
- Astra reduced by about 27% in the shared UI, 29% in desktop ceremonies,
  and 37% in portrait ceremonies. Casting-hand effects track the new size.
- Bounded, adaptive GPU resolution, Canvas fallback and GPU cleanup on exit.

Verification
- Production build and TypeScript checks passed.
- All 90 existing regression tests passed; all 13 interaction checks passed.
- Native GLSL ES 1.00 shader compilation/link passed for both passes.
- GPU lifecycle/resize/fallback checks passed.
- Desktop/mobile production canvas scenes and Astra phases visually reviewed.
- 480 sequential shader frames checked for continuous motion and deterministic
  pause, then composited into an 8-second, 60 fps preview with the production
  universe renderer. That preview is a native render with sample ranking data,
  not a recording of the deployed website or a device performance benchmark.

The visual model approximates a black hole; it is not a scientific simulation.
Real-browser/device frame rates and the live deployment still need checking.
When WebGL is unavailable, the existing lighter Canvas animation is used.

Files
- app/(player)/layout.tsx
- app/(player)/leaderboard/page.tsx
- components/player/WishDetailsDialog.module.css
- components/player/astral/AstraCompanion.tsx
- components/player/astral/FlightRenderer.ts
- components/player/observatory/BlackHoleRenderer.ts
- components/player/observatory/UniverseRenderer.ts
