# Ancient Pulls social sign-in setup

The code sends Google and Discord through Supabase, then back to:

`https://www.ancientpulls.com/auth/callback?next=%2Fhq`

The provider callback is **not** that website URL. Google and Discord must both return to Supabase first, using the exact callback URL displayed for the provider in the Supabase dashboard. It normally looks like:

`https://<your-project-ref>.supabase.co/auth/v1/callback`

Never place a Google or Discord client secret in Vercel, browser code, or this repository. Store both secrets only in Supabase's provider settings.

## 1. Supabase URL configuration

Open **Supabase Dashboard → Authentication → URL Configuration**.

Set **Site URL** to:

`https://www.ancientpulls.com`

Add these **Redirect URLs** (one per line):

`https://www.ancientpulls.com/auth/callback`

`https://www.ancientpulls.com/**`

`https://ancientpulls.com/auth/callback`

`https://ancientpulls.com/**`

For local development only, add:

`http://localhost:3000/auth/callback`

`http://localhost:3000/**`

Keep email confirmation enabled. The current email templates should still send confirmation and recovery links to `/auth/callback`.

## 2. Google

1. In **Google Cloud Console / Google Auth Platform**, create or select the Ancient Pulls project.
2. Configure the consent screen. Use **Ancient Pulls** as the app name, add `https://www.ancientpulls.com` as the home/privacy/terms URLs where Google asks, and add test users while the app is in testing.
3. Create an **OAuth client ID** of type **Web application**.
4. Under **Authorized redirect URIs**, paste the exact Google Callback URL shown in **Supabase Dashboard → Authentication → Providers → Google**. This is usually `https://<your-project-ref>.supabase.co/auth/v1/callback`.
5. Copy the Google Client ID and Client Secret.
6. In **Supabase Dashboard → Authentication → Providers → Google**, enable Google, paste those two values, and save.

Do not use `https://www.ancientpulls.com/auth/callback` as Google’s Authorized redirect URI. Supabase is the OAuth broker, and it forwards the player there after it finishes authentication.

## 3. Discord

1. In the **Discord Developer Portal**, create or select the Ancient Pulls application.
2. In **OAuth2 → General**, add the exact Discord Callback URL shown in **Supabase Dashboard → Authentication → Providers → Discord** under **Redirects**. It is normally the same `https://<your-project-ref>.supabase.co/auth/v1/callback` URL.
3. Copy the Client ID and reset/copy the Client Secret.
4. In **Supabase Dashboard → Authentication → Providers → Discord**, enable Discord, paste those values, and save.

Discord requires an exact redirect match: no trailing slash and no website callback URL unless Supabase itself displays that exact URL.

## 4. Vercel environment

No provider secret belongs in Vercel. Keep the existing public client configuration available to the deployed site:

`NEXT_PUBLIC_SUPABASE_URL`

`NEXT_PUBLIC_SUPABASE_ANON_KEY` (or your existing publishable-key equivalent)

Set this production value if it is not already set:

`NEXT_PUBLIC_SITE_URL=https://www.ancientpulls.com`

Redeploy after changing Vercel environment values.

## 5. Database migration and test

1. Run `supabase/migrations/20260810_social_oauth_profile_bootstrap_v61.sql` once in Supabase SQL Editor.
2. Deploy the replacement application files.
3. In a private/incognito browser, test Google and Discord separately.
4. Confirm that each returns to `/hq`, creates one normal player profile and wallet, and does not overwrite the Ancient Pulls profile image.

Supabase automatically links verified identities with the same email address to the same Supabase user. Ancient Pulls records are keyed only by that Supabase user ID, so existing player data stays attached to the right account. This leaves the project ready for a future Connected Accounts screen and Apple provider without a parallel user table.
