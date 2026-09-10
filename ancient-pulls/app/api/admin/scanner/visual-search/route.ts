import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import {
  COMPACT_VISUAL_VERSION,
  compareCompactCoarseDecoded,
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
  orientation: 0 | 180;
  breakdown: CompactVisualComparison;
};

let indexCache: { expiresAt: number; rows: StoredFingerprint[]; total: number } | null = null;
let indexCachePromise: Promise<{ rows: StoredFingerprint[]; total: number }> | null = null;
const cardCache = new Map<string, { expiresAt: number; card: ScannerPokemonCard | null }>();
const INDEX_TTL_MS = 5 * 60_000;
const CARD_TTL_MS = 30 * 60_000;
const CARD_CACHE_LIMIT = 4_000;
const COARSE_SHORTLIST = 512;

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
  if (indexCachePromise) return indexCachePromise;
  indexCachePromise = (async () => {
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
      expiresAt: Date.now() + INDEX_TTL_MS,
    };
    return indexCache;
  })();
  try {
    return await indexCachePromise;
  } finally {
    indexCachePromise = null;
  }
}

type HeapEntry<T> = { score: number; value: T };

function pushTop<T>(heap: HeapEntry<T>[], entry: HeapEntry<T>, limit: number): void {
  if (heap.length < limit) {
    heap.push(entry);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].score <= heap[index].score) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
    return;
  }
  if (entry.score <= heap[0].score) return;
  heap[0] = entry;
  let index = 0;
  for (;;) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left].score < heap[smallest].score) smallest = left;
    if (right < heap.length && heap[right].score < heap[smallest].score) smallest = right;
    if (smallest === index) break;
    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
}

function coarseScore(orientations: CompactVisualDecoded[], reference: CompactVisualDecoded): number {
  let best = 0;
  for (const orientation of orientations) {
    best = Math.max(best, compareCompactCoarseDecoded(orientation, reference));
  }
  return best;
}

async function loadCards(
  admin: Awaited<ReturnType<typeof requireAdmin>>["admin"],
  ids: string[],
): Promise<Map<string, ScannerPokemonCard>> {
  const now = Date.now();
  const missing = ids.filter((id) => {
    const cached = cardCache.get(id);
    return !cached || cached.expiresAt <= now;
  });
  if (missing.length) {
    const { data, error } = await admin.from("pokemon_cards").select(CARD_SELECT).in("id", missing);
    if (error) throw error;
    const found = new Map(
      ((Array.isArray(data) ? data : []) as ScannerPokemonCard[])
        .map((card) => [String(card.id), card] as const),
    );
    for (const id of missing) {
      cardCache.delete(id);
      cardCache.set(id, { expiresAt: now + CARD_TTL_MS, card: found.get(id) || null });
    }
    while (cardCache.size > CARD_CACHE_LIMIT) {
      const oldest = cardCache.keys().next().value as string | undefined;
      if (!oldest) break;
      cardCache.delete(oldest);
    }
  }
  return new Map(ids.flatMap((id) => {
    const cached = cardCache.get(id);
    return cached?.card ? [[id, cached.card] as const] : [];
  }));
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
  let firstScore = 0;
  let secondScore = 0;
  let thirdScore = 0;
  let count = 0;
  let orientation: 0 | 180 = 0;
  let strongest: CompactVisualComparison | null = null;

  for (const orientations of frames) {
    let best = compareCompactDecoded(orientations[0], reference);
    let bestOrientation: 0 | 180 = 0;
    for (let index = 1; index < orientations.length; index += 1) {
      const comparison = compareCompactDecoded(orientations[index], reference);
      if (comparison.combined > best.combined) {
        best = comparison;
        bestOrientation = 180;
      }
    }

    if (!strongest || best.combined > strongest.combined) strongest = best;
    if (count === 0) {
      firstScore = best.combined;
      orientation = bestOrientation;
    }
    else if (count === 1) secondScore = best.combined;
    else thirdScore = best.combined;
    count += 1;
  }

  const similarity = (firstScore + secondScore + thirdScore) / Math.max(1, count);
  const spread = (
    Math.abs(firstScore - similarity) +
    (count > 1 ? Math.abs(secondScore - similarity) : 0) +
    (count > 2 ? Math.abs(thirdScore - similarity) : 0)
  ) / Math.max(1, count);
  return {
    similarity,
    agreement: Math.max(0, 1 - spread * 4),
    frameCount: count,
    orientation,
    breakdown: strongest ?? compareCompactDecoded(frames[0][0], reference),
  };
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { frames?: unknown };
    const rawFrames = Array.isArray(body.frames) ? body.frames.slice(0, 2) : [];
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
    // The best-quality frame cheaply narrows the catalogue; full multi-frame
    // comparison then runs only on that shortlist. This keeps the exact scorer
    // and two-frame agreement while avoiding repeated edge work for every card.
    const coarse: Array<HeapEntry<StoredFingerprint>> = [];
    for (const row of index.rows) {
      pushTop(coarse, {
        score: coarseScore(frames[0], row.decoded),
        value: row,
      }, Math.min(COARSE_SHORTLIST, index.rows.length));
    }
    const top: VisualMatch[] = [];
    for (const { value: row } of coarse) {
      insertTop(top, { cardId: row.cardId, ...compareFrames(frames, row.decoded) }, 16);
    }
    const ids = top.map((item) => item.cardId);
    const cardById = await loadCards(admin, ids);
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
          orientation: match.orientation,
          breakdown: match.breakdown,
        }] : [];
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
