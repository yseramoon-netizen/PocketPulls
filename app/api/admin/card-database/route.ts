import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncMode = "full" | "prices";

type PokemonPrice = {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
};

type PokemonCard = {
  id: string;
  name?: string;
  supertype?: string;
  subtypes?: string[];
  number?: string;
  artist?: string;
  rarity?: string;
  nationalPokedexNumbers?: number[];
  images?: {
    small?: string;
    large?: string;
  };
  set?: {
    id?: string;
    name?: string;
    series?: string;
    releaseDate?: string;
    updatedAt?: string;
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      normal?: PokemonPrice;
      holofoil?: PokemonPrice;
      reverseHolofoil?: PokemonPrice;
      "1stEditionHolofoil"?: PokemonPrice;
      unlimitedHolofoil?: PokemonPrice;
    };
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
      reverseHoloSell?: number | null;
      reverseHoloLow?: number | null;
      reverseHoloTrend?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
      reverseHoloAvg1?: number | null;
      reverseHoloAvg7?: number | null;
      reverseHoloAvg30?: number | null;
    };
  };
};

type PokemonResponse = {
  data?: PokemonCard[];
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
  error?: {
    message?: string;
    code?: number;
  };
};

type SyncRequest = {
  page?: unknown;
  mode?: unknown;
  runId?: unknown;
};

type FxRateResponse = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function cleanNumber(value: unknown): number | null {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Math.round(number * 10000) / 10000;
}

function convert(
  value: unknown,
  rate: number,
): number | null {
  const number = cleanNumber(value);

  if (number === null) {
    return null;
  }

  return Math.round(number * rate * 100) / 100;
}

function firstPositive(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    const cleaned = cleanNumber(value);

    if (cleaned !== null) {
      return cleaned;
    }
  }

  return null;
}

function parseDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalised = value.replace(/\//g, "-");
  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseTimestamp(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalised = value
    .replace(/\//g, "-")
    .replace(" ", "T");

  const date = new Date(
    normalised.endsWith("Z")
      ? normalised
      : `${normalised}Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function requireUser(
  request: Request,
  admin: ReturnType<typeof getAdminClient>,
) {
  const header =
    request.headers.get("authorization") || "";

  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new HttpError(
      "Missing authentication token.",
      401,
    );
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(
      "Your admin session is invalid.",
      401,
    );
  }

  const allowedEmails = (
    process.env.ADMIN_EMAILS || ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedEmails.length > 0 &&
    !allowedEmails.includes(
      (user.email || "").toLowerCase(),
    )
  ) {
    throw new HttpError(
      "This account is not allowed to run database syncs.",
      403,
    );
  }

  return user;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 5,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
      });

      if (
        response.ok ||
        ![429, 500, 502, 503, 504].includes(
          response.status,
        )
      ) {
        return response;
      }

      const retryAfter = Number(
        response.headers.get("retry-after"),
      );

      const waitMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(12000, 700 * 2 ** (attempt - 1));

      await new Promise((resolve) =>
        setTimeout(resolve, waitMs),
      );
    } catch (error: unknown) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(12000, 700 * 2 ** (attempt - 1)),
          ),
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The external API did not respond.");
}

async function fetchFxRate(
  base: "USD" | "EUR",
): Promise<{
  rate: number;
  date: string;
}> {
  const response = await fetchWithRetry(
    `https://api.frankfurter.dev/v2/rate/${base}/GBP?providers=ECB`,
    {
      headers: {
        Accept: "application/json",
      },
    },
    4,
  );

  if (!response.ok) {
    throw new Error(
      `GBP exchange-rate request failed with ${response.status}.`,
    );
  }

  const body = (await response.json()) as FxRateResponse;
  const rate = cleanNumber(body.rate);

  if (rate === null || !body.date) {
    throw new Error(
      `The ${base}/GBP exchange rate response was incomplete.`,
    );
  }

  return {
    rate,
    date: body.date,
  };
}

async function getRates(
  admin: ReturnType<typeof getAdminClient>,
): Promise<{
  usdToGbp: number;
  eurToGbp: number;
  date: string;
}> {
  const [usdResult, eurResult] = await Promise.allSettled([
    fetchFxRate("USD"),
    fetchFxRate("EUR"),
  ]);

  if (
    usdResult.status === "fulfilled" &&
    eurResult.status === "fulfilled"
  ) {
    const date =
      usdResult.value.date < eurResult.value.date
        ? usdResult.value.date
        : eurResult.value.date;

    const { error } = await admin
      .from("card_sync_settings")
      .update({
        usd_to_gbp: usdResult.value.rate,
        eur_to_gbp: eurResult.value.rate,
        fx_date: date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      throw error;
    }

    return {
      usdToGbp: usdResult.value.rate,
      eurToGbp: eurResult.value.rate,
      date,
    };
  }

  const { data, error } = await admin
    .from("card_sync_settings")
    .select("usd_to_gbp,eur_to_gbp,fx_date")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const usdToGbp = cleanNumber(data?.usd_to_gbp);
  const eurToGbp = cleanNumber(data?.eur_to_gbp);

  if (usdToGbp === null || eurToGbp === null) {
    throw new Error(
      "GBP exchange rates could not be loaded and no previous rates are stored.",
    );
  }

  return {
    usdToGbp,
    eurToGbp,
    date:
      typeof data?.fx_date === "string"
        ? data.fx_date
        : new Date().toISOString().slice(0, 10),
  };
}

function mapCard(
  card: PokemonCard,
  usdToGbp: number,
  eurToGbp: number,
) {
  const tcg = card.tcgplayer?.prices;
  const market = card.cardmarket?.prices;

  const normalUsd = firstPositive(
    tcg?.normal?.market,
    tcg?.normal?.mid,
  );

  const holoUsd = firstPositive(
    tcg?.holofoil?.market,
    tcg?.holofoil?.mid,
    tcg?.["1stEditionHolofoil"]?.market,
    tcg?.unlimitedHolofoil?.market,
  );

  const reverseUsd = firstPositive(
    tcg?.reverseHolofoil?.market,
    tcg?.reverseHolofoil?.mid,
  );

  const cardmarketMainEur = firstPositive(
    market?.trendPrice,
    market?.averageSellPrice,
    market?.avg7,
    market?.avg30,
    market?.lowPrice,
  );

  const cardmarketReverseEur = firstPositive(
    market?.reverseHoloTrend,
    market?.reverseHoloSell,
    market?.reverseHoloAvg7,
    market?.reverseHoloAvg30,
    market?.reverseHoloLow,
  );

  const normalGbp = firstPositive(
    convert(normalUsd, usdToGbp),
    holoUsd === null
      ? convert(cardmarketMainEur, eurToGbp)
      : null,
  );

  const holoGbp = firstPositive(
    convert(holoUsd, usdToGbp),
    normalUsd === null
      ? convert(cardmarketMainEur, eurToGbp)
      : null,
  );

  const reverseGbp = firstPositive(
    convert(cardmarketReverseEur, eurToGbp),
    convert(reverseUsd, usdToGbp),
  );

  const genericGbp = firstPositive(
    convert(cardmarketMainEur, eurToGbp),
    normalGbp,
    holoGbp,
    reverseGbp,
  );

  const sources: string[] = [];

  if (
    normalUsd !== null ||
    holoUsd !== null ||
    reverseUsd !== null
  ) {
    sources.push("TCGplayer");
  }

  if (
    cardmarketMainEur !== null ||
    cardmarketReverseEur !== null
  ) {
    sources.push("Cardmarket");
  }

  const now = new Date().toISOString();

  return {
    api_id: card.id,
    name: card.name || "Unknown card",
    rarity: card.rarity || null,
    set_name: card.set?.name || null,
    card_no: card.number || null,
    image_url: card.images?.small || null,
    image_url_large: card.images?.large || null,
    market_value: genericGbp || 0,
    set_id: card.set?.id || null,
    set_series: card.set?.series || null,
    set_release_date:
      parseDate(card.set?.releaseDate),
    source_updated_at:
      parseTimestamp(card.set?.updatedAt),
    supertype: card.supertype || null,
    subtypes: Array.isArray(card.subtypes)
      ? card.subtypes
      : [],
    artist: card.artist || null,
    national_pokedex_numbers:
      Array.isArray(card.nationalPokedexNumbers)
        ? card.nationalPokedexNumbers
        : null,
    tcgplayer_url: card.tcgplayer?.url || null,
    tcgplayer_updated_at:
      parseDate(card.tcgplayer?.updatedAt),
    cardmarket_url: card.cardmarket?.url || null,
    cardmarket_updated_at:
      parseDate(card.cardmarket?.updatedAt),
    price_normal_usd: normalUsd,
    price_holo_usd: holoUsd,
    price_reverse_holo_usd: reverseUsd,
    price_cardmarket_eur: cardmarketMainEur,
    price_reverse_holo_eur:
      cardmarketReverseEur,
    market_value_normal_gbp: normalGbp,
    market_value_holo_gbp: holoGbp,
    market_value_reverse_holo_gbp:
      reverseGbp,
    price_source:
      sources.length > 0
        ? sources.join(" + ")
        : null,
    price_updated_at:
      sources.length > 0 ? now : null,
    database_synced_at: now,
  };
}

function jsonError(
  error: unknown,
  fallback: string,
  status = 500,
) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : fallback;

  const resolvedStatus =
    error instanceof HttpError
      ? error.status
      : status;

  return NextResponse.json(
    {
      error: message,
    },
    {
      status: resolvedStatus,
    },
  );
}

export async function GET(request: Request) {
  try {
    const admin = getAdminClient();
    await requireUser(request, admin);

    const [statsResult, runResult] =
      await Promise.all([
        admin.rpc("get_card_database_sync_stats"),
        admin
          .from("card_sync_runs")
          .select(
            "id,mode,status,current_page,total_pages,cards_received,cards_inserted,cards_updated,error_message,started_at,completed_at",
          )
          .order("started_at", {
            ascending: false,
          })
          .limit(10),
      ]);

    if (statsResult.error) {
      throw statsResult.error;
    }

    if (runResult.error) {
      throw runResult.error;
    }

    return NextResponse.json({
      stats: Array.isArray(statsResult.data)
        ? statsResult.data[0] || null
        : statsResult.data,
      runs: runResult.data || [],
      hasPokemonApiKey: Boolean(
        process.env.POKEMON_TCG_API_KEY,
      ),
    });
  } catch (error: unknown) {
    return jsonError(
      error,
      "Card database status could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  let runId: string | null = null;

  try {
    const admin = getAdminClient();
    const user = await requireUser(request, admin);
    const body = (await request.json()) as SyncRequest;

    const page = Math.max(
      1,
      Math.floor(Number(body.page) || 1),
    );

    const mode: SyncMode =
      body.mode === "prices" ? "prices" : "full";

    runId =
      typeof body.runId === "string" &&
      body.runId.trim()
        ? body.runId.trim()
        : null;

    if (!runId) {
      const { data, error } = await admin
        .from("card_sync_runs")
        .insert({
          started_by: user.id,
          mode,
          status: "running",
          current_page: 0,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      runId = data.id;
    }

    const rates = await getRates(admin);

    const apiUrl = new URL(
      "https://api.pokemontcg.io/v2/cards",
    );

    apiUrl.searchParams.set("page", String(page));
    apiUrl.searchParams.set("pageSize", "250");
    apiUrl.searchParams.set("orderBy", "id");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const pokemonApiKey =
      process.env.POKEMON_TCG_API_KEY;

    if (pokemonApiKey) {
      headers["X-Api-Key"] = pokemonApiKey;
    }

    const response = await fetchWithRetry(
      apiUrl.toString(),
      {
        headers,
      },
    );

    const responseBody =
      (await response.json()) as PokemonResponse;

    if (!response.ok) {
      throw new Error(
        responseBody.error?.message ||
          `Pokemon TCG API returned ${response.status}.`,
      );
    }

    const cards = Array.isArray(responseBody.data)
      ? responseBody.data
      : [];

    const mappedCards = cards.map((card) =>
      mapCard(
        card,
        rates.usdToGbp,
        rates.eurToGbp,
      ),
    );

    const { data: merged, error: mergeError } =
      await admin.rpc(
        "merge_pokemon_card_sync_batch",
        {
          p_cards: mappedCards,
        },
      );

    if (mergeError) {
      throw mergeError;
    }

    const mergeRow = Array.isArray(merged)
      ? merged[0]
      : merged;

    const totalCount = Math.max(
      0,
      Number(responseBody.totalCount) || 0,
    );

    const pageSize = Math.max(
      1,
      Number(responseBody.pageSize) || 250,
    );

    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / pageSize),
    );

    const finalPage =
      page >= totalPages || cards.length === 0;

    const received = Math.max(
      0,
      Number(mergeRow?.received_count) ||
        cards.length,
    );

    const inserted = Math.max(
      0,
      Number(mergeRow?.inserted_count) || 0,
    );

    const updated = Math.max(
      0,
      Number(mergeRow?.updated_count) || 0,
    );

    const { data: currentRun, error: runReadError } =
      await admin
        .from("card_sync_runs")
        .select(
          "cards_received,cards_inserted,cards_updated",
        )
        .eq("id", runId)
        .single();

    if (runReadError) {
      throw runReadError;
    }

    const { error: runUpdateError } = await admin
      .from("card_sync_runs")
      .update({
        status: finalPage ? "completed" : "running",
        current_page: page,
        total_pages: totalPages,
        cards_received:
          Number(currentRun.cards_received || 0) +
          received,
        cards_inserted:
          Number(currentRun.cards_inserted || 0) +
          inserted,
        cards_updated:
          Number(currentRun.cards_updated || 0) +
          updated,
        completed_at: finalPage
          ? new Date().toISOString()
          : null,
        error_message: null,
      })
      .eq("id", runId);

    if (runUpdateError) {
      throw runUpdateError;
    }

    if (finalPage) {
      const updatePayload =
        mode === "prices"
          ? {
              last_price_sync_at:
                new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : {
              last_full_sync_at:
                new Date().toISOString(),
              last_price_sync_at:
                new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

      const { error: settingsError } = await admin
        .from("card_sync_settings")
        .update(updatePayload)
        .eq("id", 1);

      if (settingsError) {
        throw settingsError;
      }
    }

    return NextResponse.json({
      runId,
      mode,
      page,
      totalPages,
      totalCount,
      received,
      inserted,
      updated,
      finalPage,
      rates,
      hasPokemonApiKey: Boolean(pokemonApiKey),
    });
  } catch (error: unknown) {
    if (runId) {
      try {
        const admin = getAdminClient();

        await admin
          .from("card_sync_runs")
          .update({
            status: "failed",
            error_message:
              error instanceof Error
                ? error.message
                : "Unknown sync error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      } catch {
        // The original error is more useful.
      }
    }

    return jsonError(
      error,
      "The card database sync failed.",
    );
  }
}
