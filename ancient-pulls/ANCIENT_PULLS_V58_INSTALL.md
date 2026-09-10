# Ancient Pulls v58 repair files

This package contains only the files changed for the live-site QA fixes. It is
safe to extract over the root of the current project; it does not include the
rest of the source tree or any environment file.

## Install

1. Extract `Ancient-Pulls-v58-repair-files.zip` into the root of the current
   project and allow these listed files to be replaced.
2. In Supabase, open **SQL Editor**, paste the contents of
   `supabase/migrations/20260809_ancient_pulls_hardening_v58.sql`, and run it
   once.
3. Deploy the updated project to Vercel.

Orders remain closed unless both conditions are met:

- `ANCIENT_PULLS_ORDERS_OPEN=true`
- `STRIPE_SECRET_KEY` is present

Leave `ANCIENT_PULLS_ORDERS_OPEN` unset (or set it to `false`) until ordering is
ready. The website will show the Founders message and will not create a Stripe
checkout.

## Included source files

- `app/template.tsx`
- `app/globals.css`
- `app/(auth)/create-account/page.tsx`
- `app/(player)/layout.tsx`
- `app/(player)/achievements/page.tsx`
- `app/(player)/catalogue/page.tsx`
- `app/(player)/collection/page.tsx`
- `app/(player)/constellation/page.tsx`
- `app/(player)/faq/page.tsx`
- `app/(player)/friends/page.tsx`
- `app/(player)/friends/[trainerId]/page.tsx`
- `app/(player)/history/page.tsx`
- `app/(player)/hq/page.tsx`
- `app/(player)/leaderboard/page.tsx`
- `app/(player)/profile/page.tsx`
- `app/(player)/rewards/page.tsx`
- `app/(player)/shipping/page.tsx`
- `app/(player)/trade/page.tsx`
- `app/(player)/wishes/page.tsx`
- `app/(player)/wishes/preview/page.tsx`
- `app/(player)/wishes/shop/page.tsx`
- `app/api/player/wishes/checkout/route.ts`
- `app/api/player/wishes/store/route.ts`
- `components/player/FirstWishJourney.tsx`
- `components/player/NotificationCentre.tsx`
- `components/player/PlayerCardModal.tsx`
- `components/player/PlayerUI.tsx`
- `components/player/WishCinematic.tsx`
- `components/player/WishStarfall.tsx`
- `lib/player/display.ts`
- `lib/player/format.ts`
- `lib/player/orders.ts`
- `supabase/migrations/20260809_ancient_pulls_hardening_v58.sql`

## Verification

- TypeScript: passed with `npx tsc --noEmit`
- Production build: passed with `npm run build` (51 routes)
