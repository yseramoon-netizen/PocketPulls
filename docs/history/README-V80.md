# Ancient Pulls V80

Copy these files into the matching paths in your V79 project, beside `package.json`, then build and redeploy. This archive contains only 11 changed source files and these instructions. It is not an installer and does not update the live site itself. No new dependencies, environment variables or database migrations are needed.

## Observatory

- The exterior shader now bends the existing background sky and galaxies behind the black hole along approximate escaped light rays. Background texture size and shader resolution remain bounded; the existing Canvas fallback remains available when WebGL cannot initialise.
- Everyone can enter the animated singularity. Visitors can keep scrolling, pinching or pressing plus indefinitely; visible light streams and stars continue to rush past, without arriving at an endpoint.
- The right-hand slider approaches its end without reaching it for visitors. Holding its top continues the descent, and repeated End presses also keep advancing. Releasing, cancelling, losing focus or opening a panel stops sustained input. The infinity marker replaces the previous lock and blocked segment.
- The current, verified #1 account can continue through the singularity. An aperture opens into that account's actual constellation on the same canvas. Its final rendered frame matches the constellation view, and card navigation remains available after arrival.
- Rankings are checked on entry, on returning to the tab and periodically during descent. Failed verification or losing first place closes the owner passage; visitors can still descend.
- Return to universe uses a short crossfade regardless of how far a visitor has travelled. My stars and card search can also leave the descent immediately.
- Pause and reduced-motion preferences remain supported. Reduced motion suppresses autonomous motion; explicit navigation still works.

## Astra

The current mascot stays Astra; the retired Nebu artwork is not restored.

- Flight banking follows the path's velocity, with a full barrel turn, depth changes, body stretch, head follow-through and independent leg movement.
- The cape and both ribbons use constrained cloth simulation at a fixed 120 Hz simulation step. They react to acceleration and airflow, independently of display refresh rate, and freeze when playback is paused.
- Magic ribbons start at the actual articulated hand positions and converge on the growing star. Reflected light also reaches the arms.
- The ten-wish stars pass behind and in front of Astra, with orbital trails and differential rotation in the accretion disk.
- The placement sequence and companion idle use the improved rig. Wish costs, awarding, recovery and reveal timing are unchanged. Opening movement and colours remain independent of the outcome until its reveal.

## Verification

- Production Next.js build and TypeScript checks passed with placeholder build-time service configuration.
- 104 project regression tests passed.
- 41 React DOM interaction checks passed in jsdom, covering wish playback/replay, settings, card search, arrival, visitor travel, slider hold/release, owner passage, rank loss and unavailable standings.
- Five GPU lifecycle checks passed, including framebuffer feedback, resizing, cleanup/re-entry and shader fallback. The current shaders also compiled and rendered in native OpenGL.
- Desktop and mobile scene renders were reviewed and refined. The owner passage's final frame was compared byte-for-byte with the live constellation render.
- Cloth constraints and pause were exercised at 30, 60 and 120 Hz input sampling.

The two previews use the production renderers with sample ranking/card data and are exported at 60 fps. They are silent native renders, not recordings of the authenticated live site. Browser/device frame rates and production account behaviour have not been verified here. The singularity is a stylised visual treatment.
