import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import {
  COMPACT_VISUAL_VERSION,
  compareCompactCoarse,
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
  frameCount: number;
  supportingFrames: number;
  breakdown: CompactVisualComparison;
};

type CoarseMatch = {
  cardId: string;
  similarity: number;
};

let indexCache: { expiresAt: number; rows: StoredFingerprint[]; total: number } | null = null;

function cleanFingerprint(value: unknown): CompactVisualFingerprint | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CompactVisualFingerprint>;
  if (
    item.version !== COMPACT_VISUAL_VERSION ||
    typeof item.full !== "string" || item.full.length > 1600 ||
    typeof item.artwork !== "string" || item.artwork.length > 1200 ||
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
    // A completed catalogue is immutable between card imports, so keep its
    // decoded descriptors warm. Partial builds refresh quickly while indexing.
    expiresAt: Date.now() + (
      Number(countResult.count || 0) > 0 && rows.length >= Math.ceil(Number(countResult.count || 0) * 0.98)
        ? 30 * 60_000
        : 15_000
    ),
  };
  return indexCache;
}

function insertTop<T extends { similarity: number }>(matches: T[], candidate: T, limit: number): void {
  const index = matches.findIndex((item) => candidate.similarity > item.similarity);
  if (index < 0) {
    if (matches.length < limit) matches.push(candidate);
  } else {
    matches.splice(index, 0, candidate);
    if (matches.length > limit) matches.pop();
  }
}

function coarseFrameScore(frames: CompactVisualDecoded[][], reference: CompactVisualDecoded): number {
  // The best-quality frame is sufficient for high-recall retrieval. Remaining
  // frames verify the shortlist below, avoiding a full-catalogue N x M scan.
  let best = 0;
  for (const orientation of frames[0] || []) {
    best = Math.max(best, compareCompactCoarse(orientation, reference));
  }
  return best;
}

function compareFrames(
  frames: CompactVisualDecoded[][],
  reference: CompactVisualDecoded,
): Omit<VisualMatch, "cardId"> {
  const comparisons: CompactVisualComparison[] = [];

  for (const orientations of frames) {
    let best = compareCompactDecoded(orientations[0], reference);
    for (let index = 1; index < orientations.length; index += 1) {
      const comparison = compareCompactDecoded(orientations[index], reference);
      if (comparison.combined > best.combined) best = comparison;
    }

    comparisons.push(best);
  }

  const ranked = [...comparisons].sort((left, right) => right.combined - left.combined);
  const weights = ranked.length >= 3 ? [0.45, 0.35, 0.20] : ranked.length === 2 ? [0.55, 0.45] : [1];
  const similarity = ranked.reduce(
    (sum, comparison, index) => sum + comparison.combined * weights[index],
    0,
  );
  const spread = comparisons.reduce(
    (sum, comparison) => sum + Math.abs(comparison.combined - similarity),
    0,
  ) / Math.max(1, comparisons.length);
  const supportingFrames = comparisons.filter((comparison) =>
    comparison.combined >= 0.54 &&
    (comparison.artwork >= 0.48 || comparison.hash >= 0.64)
  ).length;
  const aggregate = (key: keyof CompactVisualComparison) => ranked.reduce(
    (sum, comparison, index) => sum + comparison[key] * weights[index],
    0,
  );
  const supportRatio = supportingFrames / Math.max(1, comparisons.length);
  return {
    similarity,
    agreement: Math.max(0, Math.min(1, (1 - spread * 3.5) * (0.82 + supportRatio * 0.18))),
    frameCount: comparisons.length,
    supportingFrames,
    breakdown: {
      combined: aggregate("combined"),
      artwork: aggregate("artwork"),
      fullCard: aggregate("fullCard"),
      colour: aggregate("colour"),
      edge: aggregate("edge"),
      hash: aggregate("hash"),
      details: aggregate("details"),
    },
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
      return Response.json({
        ok: true,
        ready: false,
        indexedCount: 0,
        totalCount: index.total,
        matches: [],
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    // Stage one combines packed perceptual hashes, HOG and coarse structure to
    // retain high recall across the full catalogue. Stage two spends the richer
    // title/footer correlation only on that shortlist.
    const coarse: CoarseMatch[] = [];
    for (const row of index.rows) {
      insertTop(coarse, {
        cardId: row.cardId,
        similarity: coarseFrameScore(frames, row.decoded),
      }, 180);
    }
    const rowById = new Map(index.rows.map((row) => [row.cardId, row]));
    const top: VisualMatch[] = [];
    for (const item of coarse) {
      const row = rowById.get(item.cardId);
      if (!row) continue;
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
      totalCount: index.total,
      matches: top.flatMap((match) => {
        const card = cardById.get(match.cardId);
        return card ? [{
          card,
          similarity: match.similarity,
          agreement: match.agreement,
          frameCount: match.frameCount,
          supportingFrames: match.supportingFrames,
          breakdown: match.breakdown,
        }] : [];
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
