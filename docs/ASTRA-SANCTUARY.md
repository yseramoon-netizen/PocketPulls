# Astra Sanctuary — interaction notes

## One persistent sky

The authenticated player layout owns a single Observatory instance. The constellation is a viewport-sized canvas, with quiet branding, sound and help controls. Route destinations render in an accessible, scrollable panel over the existing sky. Closing the panel restores focus and the constellation without replacing its canvas or resetting the camera. The universe is part of the same Observatory and retains its existing ranking, camera, orbit and black-hole behaviour.

Astra’s upper-right star has a jelly squash and spring on activation. His existing pixel rig and cape remain the character artwork. His staff is drawn at the rig’s hand attachment; the accessible DOM hit target follows the same coordinate. The target stays still while idle so it can be tapped reliably.

## Wish interaction

The staff accepts one primary pointer with pointer capture. A downward movement of at least 88 CSS pixels arms the pull. Release completes it only within the allowed horizontal tolerance. Short movements, sideways movements, pointer cancellation, lost focus, hidden tabs and resizing cancel safely. The tension line, instructions, star light and pitch provide feedback. The staff can also be armed with Down and released with Enter; Escape cancels. A two-tap alternative avoids dragging.

The server remains authoritative. A single pull calls the existing `make_player_wish` RPC with a persisted UUID. Requests are locked while in flight. The same key is retained until the awarded card is placed, and uncertain network failures recover that request. A locally saved award can be resumed after reload without a new request. A confirmed insufficient-wishes response restores the no-power state and clears only the rejected request.

The ceremony starts at the staff’s actual screen position: a neutral star rises, light gathers, the server’s card and rarity appear, then the player places the star into the constellation. Pre-reveal timing is independent of the result rarity. Reduced motion removes flight and orbiting effects; the saved skip preference speeds up later reveals. Existing unfinished ten-wish sequences remain recoverable through the legacy recovery screen.

## Astra requests

Tapping the staff opens “What would you like to do?” and makes the staff pulse. Each selected request has a one-second orbit of matching line icons around the star: books for the binder, cogs for preferences, paired people for friends, and corresponding symbols for other destinations. Reduced motion uses a brief, still acknowledgement.

Recharge is not a request menu entry. A failed attempt at zero power reveals “I have no power left” and the astral Recharge wishes button. It opens the existing package and checkout interface as a panel over the sky. Prices come from the existing store endpoint, not a new hard-coded price list. Existing checkout availability, consent and order protections remain authoritative.

## Staff power colours

Colours are taken from the existing wish rarity palette. Thresholds are cosmetic and never affect odds.

| Wallet balance | Staff palette |
| --- | --- |
| 0 | Resting silver-grey |
| 1–4 | Common |
| 5–14 | Uncommon |
| 15–29 | Rare |
| 30–59 | Double Rare |
| 60–99 | Ultra Rare |
| 100–149 | Illustration Rare |
| 150–199 | Special Illustration Rare |
| 200–249 | Hyper Rare |
| 250 and above | Crown Rare |

The real wallet count is still displayed above 250.

## Sound and comfort

The sound instrument synthesizes original sine chimes, small arpeggios, staff tension and reveal/placement tones. A deterministic stereo impulse gives a soft reverb; a compressor and bounded voices control peaks and overlap. Sound is unlocked by user interaction and initially off. It honours the existing SFX volume preference and stops when the tab is hidden. No audio downloads or background music loop are needed.

Both operating-system and saved reduced-motion preferences are respected. Low-effects and data-saver preferences lighten effects. Canvases use adaptive pixel density and pause when hidden or covered. Panels trap focus, Escape dismisses them, live messages report relevant state, and the staff has an accessible label and keyboard controls.

## Compatibility

The authentication and account gates, wallet refresh, maintenance handling, binder, trades, shipping, catalogue, profile, notifications and existing legal routes are retained. The old HQ and wishes entry routes return to the constellation. Existing database migrations are preserved; V82 adds none.

The previous standalone wish ceremony remains available for recovering an existing batch. Historical HTML studies in `docs/history/` show previous designs and are not previews of this new interface. Use the running application and the current verification screenshots to review V82.
