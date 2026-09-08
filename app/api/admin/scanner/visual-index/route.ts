import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import { fingerprintReferenceImage } from "@/lib/scanner/compact-visual-server";
import { COMPACT_VISUAL_VERSION } from "@/lib/scanner/compact-visual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type CardImageRow = {
  id: string | number;
  image_url_large: string | null;
  image_url: string | null;
};

const ALLOWED_IMAGE_HOSTS = new Set([
  "images.scrydex.com",
  "images.pokemontcg.io",
]);

function safeImageUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

async function fetchImage(url: URL): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "force-cache",
      headers: { Accept: "image/*" },
    });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength && bytes.byteLength <= 8_000_000 ? bytes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimited<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index]);
    }
  }));
  return output;
}

async function counts(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"]) {
  const [cards, fingerprints] = await Promise.all([
    admin.from("pokemon_cards").select("id", { count: "exact", head: true })
      .or("image_url_large.not.is.null,image_url.not.is.null"),
    admin.from("pokemon_card_visual_fingerprints").select("card_id", { count: "exact", head: true })
      .eq("fingerprint_version", COMPACT_VISUAL_VERSION),
  ]);
  if (cards.error) throw cards.error;
  if (fingerprints.error) throw fingerprints.error;
  return {
    total: Number(cards.count || 0),
    indexed: Number(fingerprints.count || 0),
  };
}

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    return Response.json({ ok: true, ...(await counts(admin)) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      offset?: unknown;
      limit?: unknown;
      force?: unknown;
    };
    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    const limit = Math.max(1, Math.min(100, Math.floor(Number(body.limit) || 48)));
    const force = body.force === true;
    const { data, error } = await admin.from("pokemon_cards")
      .select("id,image_url_large,image_url")
      .or("image_url_large.not.is.null,image_url.not.is.null")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const cards = (Array.isArray(data) ? data : []) as CardImageRow[];
    const ids = cards.map((card) => String(card.id));
    let existing = new Set<string>();
    if (!force && ids.length) {
      const result = await admin.from("pokemon_card_visual_fingerprints")
        .select("card_id")
        .eq("fingerprint_version", COMPACT_VISUAL_VERSION)
        .in("card_id", ids);
      if (result.error) throw result.error;
      existing = new Set((Array.isArray(result.data) ? result.data : [])
        .map((row: { card_id?: unknown }) => String(row.card_id || "")));
    }
    const generated = await mapLimited(cards, 10, async (card) => {
      const cardId = String(card.id);
      if (existing.has(cardId)) return { status: "existing" as const, cardId };
      // Small canonical images are sufficient for a 12x17 fingerprint and
      // make the one-time catalogue build dramatically faster.
      const url = safeImageUrl(card.image_url || card.image_url_large);
      if (!url) return { status: "failed" as const, cardId };
      const bytes = await fetchImage(url);
      if (!bytes) return { status: "failed" as const, cardId };
      try {
        const fingerprint = await fingerprintReferenceImage(bytes);
        return {
          status: "generated" as const,
          cardId,
          row: {
            card_id: cardId,
            fingerprint_version: fingerprint.version,
            full_signature: fingerprint.full,
            artwork_signature: fingerprint.artwork,
            colour_signature: fingerprint.colour,
            source_url: url.toString(),
            updated_at: new Date().toISOString(),
          },
        };
      } catch {
        return { status: "failed" as const, cardId };
      }
    });
    const rows = generated.flatMap((item) => item.status === "generated" ? [item.row] : []);
    if (rows.length) {
      const result = await admin.from("pokemon_card_visual_fingerprints").upsert(rows, {
        onConflict: "card_id",
      });
      if (result.error) throw result.error;
    }
    const current = await counts(admin);
    return Response.json({
      ok: true,
      ...current,
      offset,
      nextOffset: offset + cards.length,
      done: cards.length < limit || offset + cards.length >= current.total,
      generated: rows.length,
      existing: generated.filter((item) => item.status === "existing").length,
      failed: generated.filter((item) => item.status === "failed").length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
