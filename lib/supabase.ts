import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // The dedicated /auth/callback page verifies confirmation tokens itself.
      // Letting the shared browser client also detect them creates a race where
      // the same token can be consumed twice, leaving one device with a stale
      // "email not confirmed" state.
      detectSessionInUrl: false,
    },
  },
);
