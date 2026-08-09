import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function jsonError(message: string, status: number, code: string) {
  return Response.json(
    {
      ok: false,
      error: { code, message },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return jsonError("Your trainer session is missing. Sign in again.", 401, "player_session_missing");
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return jsonError(
      "The wish server is missing its Supabase environment configuration.",
      500,
      "wish_server_misconfigured",
    );
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);

  if (userError || !user) {
    return jsonError(
      "Your trainer session could not be verified. Refresh the page and try again.",
      401,
      "player_session_invalid",
    );
  }

  const { data, error } = await client.rpc("make_player_wish");

  if (error) {
    const message = error.message?.trim() || "Nebu could not complete that wish.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("signed in") ||
      lower.includes("jwt") ||
      lower.includes("session")
        ? 401
        : 400;

    return jsonError(message, status, "wish_rpc_failed");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return jsonError(
      "The wish completed, but Nebu did not receive a reveal payload.",
      500,
      "wish_reveal_missing",
    );
  }

  return Response.json(
    {
      ok: true,
      result: row,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
