import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import {
  nameSimilarity,
  normaliseCollector,
  normaliseSetCode,
  setCodeSimilarity,
} from "@/lib/scanner/text";
import type {
  CandidateRequest,
  CandidateResponse,
  ScannerPokemonCard,
} from "@/lib/scanner/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type SetMetadata = {
  set_id: string;
  set_name: string | null;
  ptcgo_code: string | null;
  printed_total: number | null;
};

let nameCache: { expiresAt: number; values: string[] } | null = null;
let setCache: { expiresAt: number; values: SetMetadata[] } | null = null;

function cleanStrings(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => typeof item === "string" ? item.trim().slice(0, maxLength) : "")
    .filter(Boolean))]
    .slice(0, limit);
}

function cleanIntegers(value: unknown, limit: number): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 10 && item <= 9999))]
    .slice(0, limit);
}

async function getNames(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"]): Promise<string[]> {
  if (nameCache && nameCache.expiresAt > Date.now()) return nameCache.values;
  const { data, error } = await admin.rpc("get_scanner_card_names");
  if (error) throw error;
  const values = Array.isArray(data)
    ? data.map((row: unknown) => {
      if (typeof row === "string") return row.trim();
      if (row && typeof row === "object" && "card_name" in row) {
        const cardName = (row as { card_name?: unknown }).card_name;
        return typeof cardName === "string" ? cardName.trim() : "";
      }
      return "";
    }).filter(Boolean)
    : [];
  nameCache = { values, expiresAt: Date.now() + 15 * 60_000 };
  return values;
}

async function getSets(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"]): Promise<SetMetadata[]> {
  if (setCache && setCache.expiresAt > Date.now()) return setCache.values;
  const { data, error } = await admin
    .from("pokemon_set_scanner_metadata")
    .select("set_id,set_name,ptcgo_code,printed_total")
    .limit(1000);
  if (error) throw error;
  const values = (Array.isArray(data) ? data : []) as SetMetadata[];
  setCache = { values, expiresAt: Date.now() + 15 * 60_000 };
  return values;
}

function deduplicate(cards: ScannerPokemonCard[], limit: number): ScannerPokemonCard[] {
  const map = new Map<string, ScannerPokemonCard>();
  for (const card of cards) {
    const id = String(card.id || "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, card);
    if (map.size >= limit) break;
  }
  return [...map.values()];
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as Partial<CandidateRequest>;
    const names = cleanStrings(body.names, 8, 48);
    const collectorNumbers = cleanStrings(body.collectorNumbers, 8, 12)
      .map(normaliseCollector)
      .filter(Boolean);
    const denominators = cleanIntegers(body.denominators, 8);
    const setCodes = cleanStrings(body.setCodes, 8, 8).map(normaliseSetCode).filter(Boolean);
    const limit = Math.max(20, Math.min(220, Number(body.limit) || 160));
    if (!names.length && !collectorNumbers.length && !denominators.length && !setCodes.length) {
      return Response.json(
        { ok: true, cards: [], generatedBy: [] } satisfies CandidateResponse,
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [dictionary, sets] = await Promise.all([getNames(admin), getSets(admin)]);
    const likelyNames = dictionary
      .map((name) => ({
        name,
        score: Math.max(0, ...names.map((read) => nameSimilarity(name, read))),
      }))
      .filter((item) => item.score >= 0.58)
      .sort((left, right) => right.score - left.score)
      .slice(0, 24)
      .map((item) => item.name);
    const likelySets = sets.filter((set) => {
      const code = set.ptcgo_code || set.set_id;
      return setCodes.some((read) => setCodeSimilarity(code, read) >= 0.64) ||
        denominators.includes(Number(set.printed_total));
    });
    const setIds = [...new Set(likelySets.map((set) => set.set_id).filter(Boolean))];
    const generatedBy: string[] = [];
    const jobs: Array<PromiseLike<{ data: unknown; error: { message: string } | null }>> = [];

    for (const number of collectorNumbers.slice(0, 4)) {
      generatedBy.push("collector number");
      if (denominators.length) {
        jobs.push(admin.from("pokemon_cards").select(CARD_SELECT)
          .eq("card_no", number)
          .in("set_printed_total", denominators)
          .limit(80));
      }
      jobs.push(admin.from("pokemon_cards").select(CARD_SELECT).eq("card_no", number).limit(100));
    }
    if (setIds.length) {
      generatedBy.push("set code / set size");
      const query = admin.from("pokemon_cards").select(CARD_SELECT).in("set_id", setIds);
      jobs.push(collectorNumbers.length
        ? query.in("card_no", collectorNumbers).limit(120)
        : query.limit(180));
    }
    if (denominators.length) {
      generatedBy.push("set denominator");
      jobs.push(admin.from("pokemon_cards").select(CARD_SELECT)
        .in("set_printed_total", denominators)
        .limit(180));
    }
    if (likelyNames.length) {
      generatedBy.push("fuzzy database name");
      jobs.push(admin.from("pokemon_cards").select(CARD_SELECT).in("name", likelyNames).limit(180));
    }

    const results = await Promise.all(jobs);
    const cards: ScannerPokemonCard[] = [];
    for (const result of results) {
      if (result.error) throw new Error(result.error.message);
      if (Array.isArray(result.data)) cards.push(...result.data as ScannerPokemonCard[]);
    }
    const setCodeById = new Map(sets.map((set) => [set.set_id, set.ptcgo_code]));
    const responseCards = deduplicate(cards, limit).map((card) => ({
      ...card,
      set_code: card.set_id ? setCodeById.get(card.set_id) || null : null,
    }));
    return Response.json(
      {
        ok: true,
        cards: responseCards,
        generatedBy: [...new Set(generatedBy)],
      } satisfies CandidateResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
