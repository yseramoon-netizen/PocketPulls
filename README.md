# Ancient Pulls — Astra Sanctuary V82

The player’s constellation is now the whole screen. Astra is the guide, the menu and the wish interaction. The universe remains connected to the same sky, and the binder and other destinations open over it.

This is the **complete website source**, combining the recovered V73 complete project, the supplied updates through V81, and the new V82 experience. It is ready to install in an empty local folder. It uses your existing Supabase project and its existing migrations, accounts, inventory and wallet rules.

## Clean installation

1. Extract this archive into an empty folder. Open the `ancient-pulls` folder containing `package.json`.
2. Use Node.js 24.19.0, the version used for verification. `.nvmrc` is included.
3. Copy your current website’s environment configuration into `.env.local`. If needed, copy `.env.example` first and replace its placeholders. Preserve your existing Supabase, server, payment, email and business configuration. Environment values and credentials are not included in this archive.
4. Install and start:

   ```sh
   npm ci
   npm run dev
   ```

5. Open the localhost address shown in the terminal and sign in. The player home opens the constellation.

For a production build:

```sh
npm test
npm run build
npm start
```

No database migration is introduced by V82. Do not reset or recreate the existing database to install this interface. Earlier SQL and installation notes are retained in `supabase/` and `docs/history/` for reference; they are not a new sequence to run. For a genuinely new, empty Supabase project, use the project’s existing backend provisioning process before connecting this frontend.

Your existing deployment process can use this folder. No live website or account was modified during this work. Existing checkout availability and server-side purchase protections remain in place.

## Using Astra

- Press the little star in the upper-right corner to call Astra.
- Tap the star on the staff to ask for your binder, settings, friends, universe and other destinations.
- Pull the staff down until it says **Release to wish**, then release to make one wish. A short, sideways or cancelled gesture does not spend a wish.
- With the staff focused, press **Down**, then **Enter** to wish. **Escape** cancels. “Use the staff without dragging” provides a two-tap alternative.
- At zero wishes, attempting a pull produces **“I have no power left”** and the **Recharge wishes** action. Recharge is absent from Astra’s request menu.
- Turn sound on using the lower-left control. Sound is initially off and the choice is remembered. Settings includes volume, reduced motion and lighter effects.
- Panels close back to the same constellation. The universe remains reachable through Astra and the sky’s zoom controls.

The staff follows the existing rarity colours as the wallet grows, reaching Crown Rare at 250 wishes. The displayed count continues above 250. This colour is cosmetic and does not change wish odds.

## Verification

- Optimized production build and TypeScript checks passed.
- 121 regression checks passed, including wish gestures and all colour boundaries.
- 30 browser checks passed. They cover desktop, touch-emulated phones, a 320px layout, landscape, keyboard operation, reduced motion, one-wish charging, cancelled gestures and recovery after a lost response.
- Existing bundle and asset performance budgets passed.

See `docs/verification/README.md` for exact results, screenshots and test limits. Browser fixtures use fictional accounts and cards. Live Supabase, real payments, physical phones and Safari were not exercised in this environment.

To repeat the browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

The browser runner uses an isolated test server and intercepted fictional data. It does not point at your live Supabase project. Its screenshots and JSON reports are saved in `docs/verification/`.

## Project map

| Location | Purpose |
| --- | --- |
| `components/player/sanctuary/` | Astra, staff interaction, wish ceremony, sound and persistent screen |
| `lib/player/astraInteraction.ts` | Wallet colour thresholds, gesture rules and request menu |
| `app/sanctuary.css` | Desktop, phone, landscape and motion styles |
| `components/player/observatory/` | Existing constellation and universe renderer |
| `scripts/browser/` | Repeatable browser journeys with fictional data |
| `docs/ASTRA-SANCTUARY.md` | Interaction and implementation notes |
| `docs/history/` | Earlier release notes and design previews |
| `supabase/` | Existing backend schema, migrations and audit scripts |

`node_modules`, build caches, real environment files and test browser binaries are intentionally excluded. `npm ci` restores the locked dependencies.
