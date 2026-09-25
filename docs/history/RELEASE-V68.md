# Ancient Pulls V68 — quality and reliability release

7 September 2026 · Based on V67.16

## Player experience

- Page search from the mobile menu or Ctrl/Cmd K on desktop, with keyboard selection and relevant destination descriptions.
- Binder and catalogue search, set, rarity and page stored in the URL; binder availability and catalogue favourites are retained too. Back navigation restores the browsing context.
- Obsolete list requests are cancelled. Failed refreshes keep the last useful cards on screen. Invalid empty pages recover to the first page.
- A binder card can open Shipping with one available copy selected, or take the constellation camera to its star. Shipping still requires an explicit request.
- Card dialogs use responsive artwork sizing on small screens. Native dropdowns and keyboard focus indicators match the dark interface.
- Shared dialog focus handling, Escape behaviour, scroll locking and focus restoration cover card details, preferences, notifications, wish details, addresses, trade and wish ceremonies. The closed mobile drawer is inert.
- A visible offline message, an accessible skip link and descriptive browser tab titles improve everyday navigation.

## Requests and preferences

- Navigation no longer reloads the account shell on every pathname change. Same-account loads share their in-flight work; routine token refreshes avoid redundant account queries.
- Stale account responses are ignored. Live wish-balance events update the shell and the wish page.
- Pending wish UUIDs survive a same-tab reload and remain account-scoped. A recovery button reuses the server's existing idempotent wish operation, including when the displayed balance is zero. No wish is automatically replayed.
- Preferences apply immediately, coalesce rapid edits and save serially. Earlier responses cannot overwrite a newer local choice. Pending saves are flushed on panel unmount, and failed synchronization offers a retry.
- Preference consumers subscribe consistently, including cross-tab storage changes and system motion settings.
- Shipping retains current selection during refresh and guards repeated submission while a request is running.

## Animation work

- Hidden cinematic canvases stop scheduling rendering; visibility restoration resumes the existing timeline.
- Repeated wishes reuse processed skin atlases within a bounded 48 MiB pixel cache (at most two atlases).
- Universe Ranks avoids a redundant animated backdrop. The existing orbit scene is retained.
- Reduced-motion preferences are respected by the character renderer.
- Generic preparation text replaces discovery-specific clues. Card details and accessibility labels stay concealed until the completed reveal.
- Existing Nebu artwork, skin treatments, 24 fps struggle poses, reveal timing and special sequences remain in the release.

## Scanner and administration

- Automatic intake requires two visual frames, strong agreement, an exact collector/set identity and a matching name. Strong visual matches use a short footer-and-name verification path.
- Reliable conflicting numbers, set totals, names, HP or set codes prevent automatic intake. Ambiguous matches remain available for confirmation.
- Stop/reset/unmount invalidates the recognition session and aborts pending network recognition. Checks immediately before inventory submission discard stale recognition results. A write already submitted to the server may still complete.
- A full queue applies backpressure; it no longer silently drops the oldest capture. Waiting reviews can be dismissed individually.
- Camera capture pauses in hidden/offline pages. Late camera permissions and image-upload results from cancelled sessions are ignored.
- Manual selections are guarded against simultaneous clicks. An uncertain add response requires checking inventory before resubmission instead of offering an immediate duplicate add.
- The inventory API rejects blank, fractional, negative, zero and oversized quantities before querying or writing inventory.

## Scope

Support stays inside Help, orders inside Shipping, trades inside Friends, and pull history inside Constellation. Catalogue stock statistics remain hidden. Existing consent, wish-schema and purchase guards are retained. V68 adds no database migration and changes no rarity probabilities or account entitlements.

This is a source release, not a claim that every production flow has been tested. See `VALIDATION-V68.md` for the actual verification boundary.
