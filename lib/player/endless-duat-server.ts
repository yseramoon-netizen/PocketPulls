import { getAdminClient } from "@/lib/admin/server-auth";

export function readAllowlist(value: string | undefined): string[] {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function resolvePrivateDuatSkins(user: { id: string; email?: string | null }) {
  const email = user.email?.trim().toLowerCase() || "";
  const lukasIds = readAllowlist(process.env.POCKETPULLS_LUKAS_USER_IDS);
  const skyeIds = readAllowlist(process.env.POCKETPULLS_SKYE_USER_IDS);
  const lukasEmails = readAllowlist(process.env.POCKETPULLS_LUKAS_EMAILS).map((item) => item.toLowerCase());
  const skyeEmails = readAllowlist(process.env.POCKETPULLS_SKYE_EMAILS).map((item) => item.toLowerCase());
  const skins: string[] = [];
  if (lukasIds.includes(user.id) || Boolean(email && lukasEmails.includes(email))) skins.push("sherry");
  if (skyeIds.includes(user.id) || Boolean(email && skyeEmails.includes(email))) skins.push("bubbles");
  return skins;
}

export async function requireDuatUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new DuatApiError("Your player session is missing.", 401);
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new DuatApiError("Your player session could not be verified.", 401);
  return { admin, user: data.user };
}

export class DuatApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function duatErrorResponse(error: unknown) {
  const status = error instanceof DuatApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "The Endless Duat could not answer.";
  if (status >= 500) console.error("Endless Duat API error:", error);
  return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
