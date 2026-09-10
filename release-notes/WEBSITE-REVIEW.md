# Ancient Pulls source review — 10 September 2026

The review covers the available complete application's route tree, shared player components, styles, animation imports and release packaging. The current live authenticated website could not be inspected through a connected repository or Vercel project, so findings below refer to the source available here.

| Area | Finding | V71 action |
| --- | --- | --- |
| Release wiring | The earlier delivery was an unpublished animation overlay. Its nested `source/` layout could be compiled without replacing the active component. | Full application package, checked installer for root or `src/` apps, and a visible Astral 71 menu identifier. |
| Shared identity | Old cat portraits, rune headings and multicolour panels conflicted with Aster's direction. | Original Aster pixel art, readable typography, one restrained colour and surface system. |
| Navigation | Constellation and ranks were secondary destinations despite defining the product. | Primary desktop navigation and mobile dock include both maps. Secondary destinations stay in the Explore drawer. |
| Constellation | Information opened by default and competed with the sky; mobile controls occupied separate overlapping positions. | Shared controls, mutually coordinated info and search panels, a responsive title and one camera dock. Finer star cores and connections. |
| Universe | Pause reverted position to the initial frame; some signed hash seeds made spiral arm counts zero. Thousands of particle drawing operations repeated each frame. | Persistent active-time clock, normalized unsigned seeds, reusable galaxy textures, bounded sizing, search, own-galaxy shortcut and touch zoom. |
| Overview | Box-heavy presentation with the retired companion nexus. | A large constellation feature, small Aster wish panel, quiet numerical summary and retained collection/activity/shipping data. |
| Wishes | The new full-screen cinematic was surrounded by the old dashboard and mascot presentation. | A dedicated astral stage using Aster, with the existing awarded-card cinematic and server wish logic retained. |
| Binder | Dense labels, dark/native-control inconsistency and decorative chrome. | Larger control labels, dark selects, calmer editing and theme controls. The player's chosen binder and card placement remain intact. |
| Catalogue | Card art competed with surrounding frames. | Minimal card frames and unified filters. No inventory/stock statistics added. |
| Sign-in | Decorative letterforms and old mascot branding obscured the form. | A responsive split observatory composition and readable sign-in form. Existing auth flows retained. |
| Help and policies | Heavy panels and small reading text. | Larger article typography and calm navigation. Existing legal and purchase controls retained. |
| Merged destinations | Old URLs still exist as redirects for compatibility. | Verified redirects to Shipping, Friends, Help and Constellation; no separate primary links added. |
| Scanner and account operations | Backend and recognition behavior are outside the visual redesign. | Retained and covered by the existing core regressions. The unnecessary retired wardrobe entitlement request was removed from Achievements. |

Remaining release work: integrate against the current live source, verify the real Vercel environment, review authenticated desktop/mobile behavior and publish the verified version. Those steps need access to the existing GitHub/Vercel project.
