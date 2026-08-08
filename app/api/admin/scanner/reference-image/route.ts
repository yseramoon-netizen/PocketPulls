import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestBody = {
  cardId?: unknown;
};

type ImageRow = {
  image_url_large: string | null;
  image_url: string | null;
};

const ALLOWED_IMAGE_HOSTS = new Set([
  "images.scrydex.com",
  "images.pokemontcg.io",
]);

function safeCardId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 128) : "";
}

function safeReferenceUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const cardId = safeCardId(body.cardId);
    if (!cardId) {
      return Response.json(
        { ok: false, error: { code: "scanner_card_id_missing", message: "Card ID is required." } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = await admin
      .from("pokemon_cards")
      .select("image_url_large,image_url")
      .eq("id", cardId)
      .maybeSingle();
    if (error) throw error;

    const row = (data ?? null) as ImageRow | null;
    const url = safeReferenceUrl(row?.image_url_large ?? row?.image_url ?? null);
    if (!url) {
      return Response.json(
        { ok: false, error: { code: "scanner_reference_image_unavailable", message: "No approved reference image is available." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "force-cache",
        headers: { Accept: "image/*" },
      });
      if (!response.ok) {
        return Response.json(
          { ok: false, error: { code: "scanner_reference_fetch_failed", message: `Reference image returned ${response.status}.` } },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }

      const type = response.headers.get("content-type") || "image/jpeg";
      if (!type.toLowerCase().startsWith("image/")) {
        return Response.json(
          { ok: false, error: { code: "scanner_reference_not_image", message: "Reference source did not return an image." } },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 8_000_000) {
        return Response.json(
          { ok: false, error: { code: "scanner_reference_too_large", message: "Reference image is too large." } },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      }

      return new Response(bytes, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
