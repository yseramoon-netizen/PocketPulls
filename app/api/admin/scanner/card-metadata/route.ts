import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOCAL_CARD_ROOT = path.join(
  process.cwd(),
  ".pocketpulls-data",
  "pokemon-tcg-data",
  "cards",
  "en",
);

const localSetCache = new Map<string, Map<string, PokemonApiCard>>();

type RequestBody = {
  cardIds?: unknown;
};

type StoredCard = {
  id: string;
  api_id: string | null;
  hp: number | string | null;
  set_printed_total: number | string | null;
  set_id: string | null;
  set_name: string | null;
  image_url_large: string | null;
  scanner_metadata_checked_at: string | null;
};

type PokemonApiCard = {
  id?: string;
  name?: string;
  number?: string;
  hp?: string;
  images?: {
    large?: string;
  };
  set?: {
    id?: string;
    name?: string;
    printedTotal?: number;
  };
};

function toInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean),
  )].slice(0, 8);
}

async function readLocalPokemonCard(
  setId: string | null,
  apiId: string,
): Promise<PokemonApiCard | null> {
  const safeSetId = setId?.trim() || "";
  if (!safeSetId || !/^[A-Za-z0-9._-]+$/.test(safeSetId)) return null;

  let cached = localSetCache.get(safeSetId);
  if (!cached) {
    try {
      const raw = await readFile(path.join(LOCAL_CARD_ROOT, `${safeSetId}.json`), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      cached = new Map<string, PokemonApiCard>();
      for (const item of parsed as PokemonApiCard[]) {
        const id = typeof item.id === "string" ? item.id.trim() : "";
        if (id) cached.set(id, item);
      }
      // A set file is typically small enough to keep in a warm server instance.
      // Limit the cache so long-lived development servers cannot grow forever.
      if (localSetCache.size >= 18) {
        const first = localSetCache.keys().next().value as string | undefined;
        if (first) localSetCache.delete(first);
      }
      localSetCache.set(safeSetId, cached);
    } catch {
      return null;
    }
  }
  return cached.get(apiId) ?? null;
}

async function fetchPokemonCard(apiId: string): Promise<PokemonApiCard | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "UnownPulls-Scanner/40",
  };
  const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(apiId)}`,
      {
        headers,
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: PokemonApiCard };
    return payload.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRefresh(row: StoredCard): boolean {
  if (toInteger(row.hp) === null || toInteger(row.set_printed_total) === null) return true;
  if (!row.scanner_metadata_checked_at) return false;
  const checked = Date.parse(row.scanner_metadata_checked_at);
  return Number.isFinite(checked) && Date.now() - checked > 1000 * 60 * 60 * 24 * 90;
}

export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const cardIds = cleanIds(body.cardIds);

    if (!cardIds.length) {
      return Response.json({ ok: true, cards: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const { data, error } = await admin
      .from("pokemon_cards")
      .select(
        "id,api_id,hp,set_printed_total,set_id,set_name,image_url_large,scanner_metadata_checked_at",
      )
      .in("id", cardIds);

    if (error) throw error;

    const rows = (Array.isArray(data) ? data : []) as StoredCard[];
    const now = new Date().toISOString();

    const hydrated = await Promise.all(
      rows.map(async (row): Promise<StoredCard> => {
        const apiId = row.api_id?.trim() || "";
        if (!apiId || !shouldRefresh(row)) return row;

        const local = await readLocalPokemonCard(row.set_id, apiId);
        const remote = local ?? await fetchPokemonCard(apiId);
        if (!remote) {
          await admin
            .from("pokemon_cards")
            .update({ scanner_metadata_checked_at: now })
            .eq("id", row.id);
          return { ...row, scanner_metadata_checked_at: now };
        }

        const hp = toInteger(remote.hp) ?? toInteger(row.hp);
        const printedTotal =
          toInteger(remote.set?.printedTotal) ?? toInteger(row.set_printed_total);
        const update = {
          hp,
          set_printed_total: printedTotal,
          set_id: remote.set?.id?.trim() || row.set_id,
          set_name: remote.set?.name?.trim() || row.set_name,
          image_url_large: remote.images?.large?.trim() || row.image_url_large,
          scanner_metadata_checked_at: now,
        };

        const { error: updateError } = await admin
          .from("pokemon_cards")
          .update(update)
          .eq("id", row.id);

        if (updateError) {
          console.warn("Scanner metadata cache update failed:", updateError.message);
        }

        return {
          ...row,
          ...update,
        };
      }),
    );

    return Response.json(
      {
        ok: true,
        cards: hydrated.map((row) => ({
          id: String(row.id),
          hp: toInteger(row.hp),
          setPrintedTotal: toInteger(row.set_printed_total),
          setId: row.set_id,
          setName: row.set_name,
          imageUrlLarge: row.image_url_large,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
