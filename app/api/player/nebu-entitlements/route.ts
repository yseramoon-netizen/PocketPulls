import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExclusiveSkinKey = "sherry" | "bubbles";

function readAllowlist(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveExclusiveSkins(user: { id: string; email?: string | null }): ExclusiveSkinKey[] {
  // These are intentionally the same exact account allowlists used by the
  // founder/Shaymin features. Names and profile metadata are editable, so
  // never use them as proof that somebody owns a private Nebu skin.
  const email = user.email?.trim().toLowerCase() || "";
  const lukasIds = readAllowlist(process.env.POCKETPULLS_LUKAS_USER_IDS);
  const skyeIds = readAllowlist(process.env.POCKETPULLS_SKYE_USER_IDS);
  const lukasEmails = readAllowlist(process.env.POCKETPULLS_LUKAS_EMAILS)
    .map((item) => item.toLowerCase());
  const skyeEmails = readAllowlist(process.env.POCKETPULLS_SKYE_EMAILS)
    .map((item) => item.toLowerCase());

  const isLukas = lukasIds.includes(user.id) || Boolean(email && lukasEmails.includes(email));
  const isSkye = skyeIds.includes(user.id) || Boolean(email && skyeEmails.includes(email));

  if (isLukas && !isSkye) return ["sherry"];
  if (isSkye && !isLukas) return ["bubbles"];
  return [];
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireAdmin(request);

    const skins = resolveExclusiveSkins(user);

    return Response.json(
      {
        ok: true,
        skins,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
