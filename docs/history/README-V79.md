# Ancient Pulls V79

Apply these changed files over your V78 project, using the matching paths beside `package.json`, then build and redeploy. This archive contains source files only; it does not update the live site by itself. No new dependencies or database changes are required.

## Black-hole zoom

- Select the black hole in the universe, then choose **Explore black hole**. Scrolling inward directly over the black hole also selects its zoom path. The #1 account can enter that path using the zoom controls from the universe view.
- The right-hand zoom rail supports dragging, touch and keyboard controls. Wheel, pinch and plus/minus controls use the same limit.
- Visitors stop at the event horizon. Only the account matching the current #1 ranking can continue into the animated singularity. The reserved section of the rail is marked with a lock.
- Rankings refresh on entry, when the page becomes visible and every minute while this view is open. A rank change or failed ranking verification removes full entry access.
- **Return to universe** reverses the journey. Normal constellation and galaxy navigation remain available.
- Close approaches shade the visible region directly, keeping texture dimensions bounded instead of magnifying the original small black-hole texture.

## Wording

Removed the Pharaoh title and references. Removed decorative page subtitles, redundant small headings and promotional lines from the Observatory, shared player headers, Overview, Wishes, Binder, Catalogue and account layouts. Wish results and controls now link by the Observatory name. Useful statuses, card metadata, purchase information and legal content remain available.

## Verification

- Production build and TypeScript passed using placeholder build-time service configuration.
- 100 project regression tests passed.
- 40 React DOM interaction checks passed in jsdom, including owner/visitor zoom limits, keyboard and pinch controls, demotion, unavailable rankings, wish arrivals and settings.
- Five GPU lifecycle checks passed, covering framebuffer feedback, resizing, cleanup, re-entry and fallback behaviour.
- Desktop and mobile scene renders were inspected and refined. A visitor render requested at full depth was verified to be identical to its permitted horizon view.

The preview compares the production renderer for a visitor and the #1 account using sample ranking data. It is exported at 60 fps with native GPU renders of the production shader, not recorded from a live browser. Physical-device frame rates and authenticated production behaviour have not been verified here. The singularity interior is a stylised visual treatment.
