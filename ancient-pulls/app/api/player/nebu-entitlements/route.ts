import { getAdminClient } from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EntitledSkinKey = "sherry" | "bubbles" | "cosmic_nebu";

function readAllowlist(value: string | undefined): string[] {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function resolvePrivateSkins(user: { id: string; email?: string | null }): EntitledSkinKey[] {
  const email = user.email?.trim().toLowerCase() || "";
  const lukasIds = readAllowlist(process.env.POCKETPULLS_LUKAS_USER_IDS);
  const skyeIds = readAllowlist(process.env.POCKETPULLS_SKYE_USER_IDS);
  const lukasEmails = readAllowlist(process.env.POCKETPULLS_LUKAS_EMAILS).map((item) => item.toLowerCase());
  const skyeEmails = readAllowlist(process.env.POCKETPULLS_SKYE_EMAILS).map((item) => item.toLowerCase());
  const isLukas = lukasIds.includes(user.id) || Boolean(email && lukasEmails.includes(email));
  const isSkye = skyeIds.includes(user.id) || Boolean(email && skyeEmails.includes(email));
  if (isLukas && !isSkye) return ["sherry"];
  if (isSkye && !isLukas) return ["bubbles"];
  return [];
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return Response.json({ ok: false, error: "Your player session is missing." }, { status: 401 });
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return Response.json({ ok: false, error: "Your player session could not be verified." }, { status: 401 });
    }

    const skins = resolvePrivateSkins(data.user);
    const cosmicResult = await admin
      .from("cosmic_nebu_ownerships")
      .select("issue_number,discovered_at")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const cosmicIssueNumber = cosmicResult.error || !cosmicResult.data
      ? null
      : Number(cosmicResult.data.issue_number);

    if (cosmicIssueNumber && Number.isFinite(cosmicIssueNumber)) {
      skins.push("cosmic_nebu");
    }

    return Response.json(
      {
        ok: true,
        skins,
        cosmicIssueNumber,
        cosmicDiscoveredAt: cosmicResult.data?.discovered_at || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("Nebu entitlement error:", error);
    return Response.json(
      { ok: false, error: "Nebu's wardrobe could not be verified." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
