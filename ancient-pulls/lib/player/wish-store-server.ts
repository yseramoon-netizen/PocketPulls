import { createClient } from "@supabase/supabase-js";

export type ServiceClient = ReturnType<typeof createClient>;

export type DatabaseError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function requireEnvironment(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  throw new Error(`Missing server environment value: ${names.join(" or ")}.`);
}

export function getServiceClient(): ServiceClient {
  const url = requireEnvironment([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  ]);

  const serviceKey = requireEnvironment([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new Error("Your player session is missing. Sign in again.");
  }

  return token;
}

export async function getVerifiedUser(service: ServiceClient, token: string) {
  const { data, error } = await service.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Your player session expired. Sign in again.");
  }

  return data.user;
}

export function readDatabaseMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message.trim();
  }

  return fallback;
}

export function playerErrorResponse(error: unknown, fallback: string): Response {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : readDatabaseMessage(error, fallback);

  console.error("Wish store error:", error);

  const lower = message.toLowerCase();
  const status =
    lower.includes("session") || lower.includes("sign in")
      ? 401
      : lower.includes("package") || lower.includes("request")
        ? 400
        : 500;

  return Response.json(
    {
      ok: false,
      error: { message },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
