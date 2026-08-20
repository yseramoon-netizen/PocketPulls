import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import {
  COMPACT_VISUAL_VERSION,
  compareCompactDecoded,
  decodeCompactFingerprint,
  type CompactVisualComparison,
  type CompactVisualDecoded,
  type CompactVisualFingerprint,
} from "@/lib/scanner/compact-visual";
import type { ScannerPokemonCard } from "@/lib/scanner/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const CARD_SELECT = `
  id,
  name,
  rarity,
  set_name,
  set_id,
  set_printed_total,
  card_no,
  hp,
  image_url,
  image_url_large,
  market_value,
  api_id,
  supertype,
  subtypes
`;

type StoredFingerprint = {
  cardId: string;
  decoded: CompactVisualDecoded;
};

type VisualMatch = {
  cardId: string;
  similarity: number;
  agreement: number;
  breakdown: CompactVisualComparison;
};

let indexCache: { expiresAt: number; rows: StoredFingerprint[]; total: number } | null = null;

function cleanFingerprint(value: unknown): CompactVisualFingerprint | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CompactVisualFingerprint>;
  if (
    item.version !== COMPACT_VISUAL_VERSION ||
    typeof item.full !== "string" || item.full.length > 1000 ||
    typeof item.artwork !== "string" || item.artwork.length > 1000 ||
    typeof item.colour !== "string" || item.colour.length > 1000
  ) return null;
  return {
    version: item.version,
    full: item.full,
    artwork: item.artwork,
    colour: item.colour,
  };
}

async function loadIndex(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"]): Promise<{
  rows: StoredFingerprint[];
  total: number;
}> {
  if (indexCache && indexCache.expiresAt > Date.now()) return indexCache;
  const rows: StoredFingerprint[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.from("pokemon_card_visual_fingerprints")
      .select("card_id,full_signature,artwork_signature,colour_signature")
      .eq("fingerprint_version", COMPACT_VISUAL_VERSION)
      .order("card_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    for (const row of page as Array<{
      card_id: unknown;
      full_signature: unknown;
      artwork_signature: unknown;
      colour_signature: unknown;
    }>) {
      const fingerprint = cleanFingerprint({
        version: COMPACT_VISUAL_VERSION,
        full: row.full_signature,
        artwork: row.artwork_signature,
        colour: row.colour_signature,
      });
      if (!fingerprint) continue;
      try {
        rows.push({ cardId: String(row.card_id), decoded: decodeCompactFingerprint(fingerprint) });
      } catch {
        // A malformed row is skipped without making the entire scanner unavailable.
      }
    }
    if (page.length < pageSize) break;
  }
  const countResult = await admin.from("pokemon_cards").select("id", { count: "exact", head: true })
    .or("image_url_large.not.is.null,image_url.not.is.null");
  if (countResult.error) throw countResult.error;
  indexCache = {
    rows,
    total: Number(countResult.count || 0),
    expiresAt: Date.now() + 5 * 60_000,
  };
  return indexCache;
}

function insertTop(matches: VisualMatch[], candidate: VisualMatch, limit: number): void {
  const index = matches.findIndex((item) => candidate.similarity > item.similarity);
  if (index < 0) {
    if (matches.length < limit) matches.push(candidate);
  } else {
    matches.splice(index, 0, candidate);
    if (matches.length > limit) matches.pop();
  }
}

function compareFrames(
  frames: CompactVisualDecoded[][],
  reference: CompactVisualDecoded,
): Omit<VisualMatch, "cardId"> {
  const perFrame = frames.map((orientations) => {
    let best = compareCompactDecoded(orientations[0], reference);
    for (let index = 1; index < orientations.length; index += 1) {
      const comparison = compareCompactDecoded(orientations[index], reference);
      if (comparison.combined > best.combined) best = comparison;
    }
    return best;
  }).sort((left, right) => right.combined - left.combined);
  const used = perFrame.slice(0, Math.min(3, perFrame.length));
  const similarity = used.reduce((sum, item) => sum + item.combined, 0) / Math.max(1, used.length);
  const spread = used.reduce((sum, item) => sum + Math.abs(item.combined - similarity), 0) / Math.max(1, used.length);
  return {
    similarity,
    agreement: Math.max(0, 1 - spread * 4),
    breakdown: used[0],
  };
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { frames?: unknown };
    const rawFrames = Array.isArray(body.frames) ? body.frames.slice(0, 3) : [];
    const frames: CompactVisualDecoded[][] = [];
    for (const rawFrame of rawFrames) {
      if (!Array.isArray(rawFrame)) continue;
      const orientations: CompactVisualDecoded[] = [];
      for (const raw of rawFrame.slice(0, 2)) {
        const fingerprint = cleanFingerprint(raw);
        if (!fingerprint) continue;
        try {
          orientations.push(decodeCompactFingerprint(fingerprint));
        } catch {
          // Invalid client fingerprints are ignored and cannot reach comparison.
        }
      }
      if (orientations.length) frames.push(orientations);
    }
    if (!frames.length) {
      return Response.json({
        ok: false,
        error: { code: "scanner_visual_fingerprint_missing", message: "A visual fingerprint is required." },
      }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const index = await loadIndex(admin);
    if (!index.rows.length) {
      return Response.json({ ok: true, ready: false, indexedCount: 0, matches: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const top: VisualMatch[] = [];
    for (const row of index.rows) {
      insertTop(top, { cardId: row.cardId, ...compareFrames(frames, row.decoded) }, 40);
    }
    const ids = top.map((item) => item.cardId);
    const { data, error } = await admin.from("pokemon_cards").select(CARD_SELECT).in("id", ids);
    if (error) throw error;
    const cards = (Array.isArray(data) ? data : []) as ScannerPokemonCard[];
    const cardById = new Map(cards.map((card) => [String(card.id), card]));
    return Response.json({
      ok: true,
      ready: index.total > 0 && index.rows.length >= Math.ceil(index.total * 0.98),
      indexedCount: index.rows.length,
      matches: top.flatMap((match) => {
        const card = cardById.get(match.cardId);
        return card ? [{
          card,
          similarity: match.similarity,
          agreement: match.agreement,
          breakdown: match.breakdown,
        }] : [];
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
