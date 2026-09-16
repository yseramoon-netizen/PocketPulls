# Ancient Pulls — Astra V72

Astra now flies with an articulated pixel rig and cape physics, creates rarity-coloured stars, and delivers them into the player's constellation after Continue. Ten wishes have their own ascent, accretion disk, and orbiting-star reveal.

**Existing project:** use `install-astra72.mjs` from the folder containing the active `package.json`:

```sh
node install-astra72.mjs --apply
npm run build
```

The installer protects unfamiliar edits and includes missing local dependencies. It supports root and `src/` app layouts. It is intended for the current project; do not extract another nested app inside it.

**Fresh project:** extract the complete archive into an empty folder, run `npm ci`, supply your existing environment variables, and run `npm run build`.

**Watch:** open `Astra-Flight-Preview.html` for the interactive, offline study. The two `previews/*.mp4` films show the same production motion at 60 fps with sample constellation placement.

[Installation, behavior, and verification details](docs/astra-v72/README.md)

This is the complete recovered V71.1 source with the Astra V72 update. It has not been deployed to the live website. TypeScript, production build, and 65 regression checks pass; local browser and live-account testing were blocked or unavailable. Existing setup documents are retained for the rest of the application.
