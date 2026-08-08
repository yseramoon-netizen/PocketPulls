"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

type AdminGlobal = typeof globalThis & {
  __unownPullsAdminSupabase?: SupabaseClient;
};

const globalForAdmin = globalThis as AdminGlobal;

export const adminSupabase =
  globalForAdmin.__unownPullsAdminSupabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: "unown-pulls:admin-auth:v18",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForAdmin.__unownPullsAdminSupabase = adminSupabase;
}

// Alias keeps older admin client components working after their import path is migrated.
export const supabase = adminSupabase;
