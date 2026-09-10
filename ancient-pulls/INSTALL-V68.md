# Install Ancient Pulls V68

This archive contains the complete application in `ancient-pulls/`. It is based on the V67.16 source snapshot. Earlier incremental ZIP overlays are not needed to assemble this code release.

1. Put the contents of `ancient-pulls/` into your existing application repository. Preserve the live environment values and review any newer changes you made outside this snapshot before merging.
2. Keep the existing Supabase project. V68 requires no new SQL. If V67.15 was never installed, first follow `ANCIENT_PULLS_V67_15_INSTALL.txt`; its wish-result schema repair is still required.
3. Set `NEXT_PUBLIC_APP_VERSION=68.0` in the deployment environment. Keep your existing operational settings and credentials.
4. Run `npm ci`, `npm run test:core`, `npm run check:release`, `npm run build`, and `npm run audit:performance`. Run `npm run check:release:production` with the real deployment environment loaded.
5. Deploy through your existing Vercel workflow. Complete the V68 interaction checks in `RELEASE_CHECKLIST.md` against the deployed app and database.

Build dependencies, generated build output and real environment files are excluded. The package includes existing source artwork and private application assets used by the project. Keep the repository private where required by your asset and account configuration.

The source was built and checked here with inert Supabase credentials. No live database migration, payment, inventory mutation or deployment was performed during this release preparation.
