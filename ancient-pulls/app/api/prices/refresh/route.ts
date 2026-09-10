import { NextResponse } from "next/server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredCard = {
  id: string;
  name: string;
  set_name: string | null;
  card_no: string | null;
  api_id: string | null;
  market_value: number | string | null;
};

type TcgPlayerFinishPrice = {
  market?: number | null;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
};

type ExternalPokemonCard = {
  id: string;
  name?: string;

  tcgplayer?: {
    updatedAt?: string;
    prices?: Record<string, TcgPlayerFinishPrice>;
  };

  cardmarket?: {
    updatedAt?: string;

    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
      lowPriceExPlus?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
      reverseHoloSell?: number | null;
      reverseHoloLow?: number | null;
      reverseHoloTrend?: number | null;
    };
  };
};

type ExternalCardResponse = {
  data?: ExternalPokemonCard;

  error?: {
    message?: string;
  };
};

type CardDiagnostic = {
  databaseId: string;
  name: string;
  setName: string;
  cardNumber: string;
  apiId: string;
  reason: string;
};

type PriceResult = {
  priceGbp: number;
  source: "cardmarket" | "tcgplayer";
};

type ExternalLookupResult =
  | {
      status: "found";
      card: ExternalPokemonCard;
    }
  | {
      status: "not_found";
    };

const DATABASE_BATCH_SIZE = 300;
const LOOKUP_CONCURRENCY = 5;

function toPositiveNumber(
  value: number | string | null | undefined,
): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function roundCurrency(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function chunkArray<T>(
  values: T[],
  size: number,
): T[][] {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size),
    );
  }

  return chunks;
}

function describeCard(
  card: StoredCard,
  reason: string,
): CardDiagnostic {
  return {
    databaseId: card.id,
    name: card.name || "Unknown card",
    setName: card.set_name || "Unknown set",
    cardNumber: card.card_no || "",
    apiId: card.api_id?.trim() || "",
    reason,
  };
}

async function authenticateRequest(
  request: Request,
): Promise<string> {
  const authorization =
    request.headers.get("authorization");

  const accessToken =
    authorization?.match(
      /^Bearer\s+(.+)$/i,
    )?.[1];

  if (!accessToken) {
    throw new Error(
      "AUTHENTICATION_REQUIRED",
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    accessToken,
  );

  if (error || !user) {
    throw new Error(
      "AUTHENTICATION_REQUIRED",
    );
  }

  return user.id;
}

async function fetchExchangeRate(
  from: "EUR" | "USD",
): Promise<number> {
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from}/GBP`,
    {
      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `${from}/GBP conversion failed with HTTP ${response.status}.`,
    );
  }

  const payload = await response.json();

  const result = Array.isArray(payload)
    ? payload[0]
    : payload;

  const rate = Number(result?.rate);

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(
      `${from}/GBP returned an invalid exchange rate.`,
    );
  }

  return rate;
}

async function loadInventoryCards(): Promise<
  StoredCard[]
> {
  const {
    data: inventoryRows,
    error: inventoryError,
  } = await supabase
    .from("inventory")
    .select("card_id")
    .gt("quantity", 0);

  if (inventoryError) {
    throw new Error(
      `Inventory query failed: ${inventoryError.message}`,
    );
  }

  const cardIds = [
    ...new Set(
      (inventoryRows || [])
        .map((row) =>
          String(row.card_id || ""),
        )
        .filter(Boolean),
    ),
  ];

  if (cardIds.length === 0) {
    return [];
  }

  const cards: StoredCard[] = [];

  for (const cardIdBatch of chunkArray(
    cardIds,
    DATABASE_BATCH_SIZE,
  )) {
    const {
      data,
      error,
    } = await supabase
      .from("pokemon_cards")
      .select(`
        id,
        name,
        set_name,
        card_no,
        api_id,
        market_value
      `)
      .in("id", cardIdBatch);

    if (error) {
      throw new Error(
        `Card query failed: ${error.message}`,
      );
    }

    cards.push(
      ...((data || []) as StoredCard[]),
    );
  }

  return cards;
}

async function fetchExternalCard(
  apiId: string,
): Promise<ExternalLookupResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey =
    process.env.POKEMON_TCG_API_KEY?.trim();

  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  /*
   * Direct card lookup is more reliable than constructing
   * a large Lucene OR query. It also lets us distinguish
   * a missing card from a card that has no provider price.
   */

  const searchParameters =
    new URLSearchParams({
      select:
        "id,name,tcgplayer,cardmarket",
    });

  const response = await fetch(
    `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(
      apiId,
    )}?${searchParameters.toString()}`,
    {
      cache: "no-store",
      headers,
    },
  );

  if (response.status === 404) {
    return {
      status: "not_found",
    };
  }

  const payload =
    (await response.json()) as ExternalCardResponse;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `Pokémon API returned HTTP ${response.status} for ${apiId}.`,
    );
  }

  if (!payload.data) {
    return {
      status: "not_found",
    };
  }

  return {
    status: "found",
    card: payload.data,
  };
}

function getCardmarketPrice(
  card: ExternalPokemonCard,
): number | null {
  const prices =
    card.cardmarket?.prices;

  if (!prices) {
    return null;
  }

  const candidates = [
    prices.trendPrice,
    prices.averageSellPrice,
    prices.avg7,
    prices.avg30,
    prices.avg1,
    prices.lowPriceExPlus,
    prices.lowPrice,
  ];

  for (const candidate of candidates) {
    const value =
      toPositiveNumber(candidate);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getTcgPlayerPrice(
  card: ExternalPokemonCard,
): number | null {
  const prices =
    card.tcgplayer?.prices;

  if (!prices) {
    return null;
  }

  const preferredFinishes = [
    "normal",
    "holofoil",
    "reverseHolofoil",
    "1stEditionHolofoil",
    "unlimitedHolofoil",
  ];

  for (const finish of preferredFinishes) {
    const marketPrice =
      toPositiveNumber(
        prices[finish]?.market,
      );

    if (marketPrice !== null) {
      return marketPrice;
    }

    /*
     * Some provider records have no market value but do
     * have a mid or low value.
     */

    const midPrice =
      toPositiveNumber(
        prices[finish]?.mid,
      );

    if (midPrice !== null) {
      return midPrice;
    }

    const lowPrice =
      toPositiveNumber(
        prices[finish]?.low,
      );

    if (lowPrice !== null) {
      return lowPrice;
    }
  }

  const fallbackPrices =
    Object.values(prices)
      .flatMap((finish) => [
        toPositiveNumber(
          finish.market,
        ),
        toPositiveNumber(
          finish.mid,
        ),
        toPositiveNumber(
          finish.low,
        ),
      ])
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  if (fallbackPrices.length === 0) {
    return null;
  }

  return Math.min(
    ...fallbackPrices,
  );
}

function calculateGbpPrice(
  card: ExternalPokemonCard,
  eurToGbp: number,
  usdToGbp: number,
): PriceResult | null {
  const cardmarketPrice =
    getCardmarketPrice(card);

  if (cardmarketPrice !== null) {
    return {
      priceGbp: roundCurrency(
        cardmarketPrice *
          eurToGbp,
      ),

      source: "cardmarket",
    };
  }

  const tcgPlayerPrice =
    getTcgPlayerPrice(card);

  if (tcgPlayerPrice !== null) {
    return {
      priceGbp: roundCurrency(
        tcgPlayerPrice *
          usdToGbp,
      ),

      source: "tcgplayer",
    };
  }

  return null;
}

async function refreshPrices() {
  const storedCards =
    await loadInventoryCards();

  if (storedCards.length === 0) {
    return {
      checked: 0,
      updated: 0,
      unchanged: 0,
      missingApiId: 0,
      missingPrice: 0,

      missingApiIds: [],
      invalidApiIds: [],
      withoutPrices: [],
      failedCards: [],
    };
  }

  const missingApiIds:
    CardDiagnostic[] = [];

  const invalidApiIds:
    CardDiagnostic[] = [];

  const withoutPrices:
    CardDiagnostic[] = [];

  const failedCards:
    CardDiagnostic[] = [];

  const cardsWithApiIds =
    storedCards.filter((card) => {
      const apiId =
        card.api_id?.trim();

      if (!apiId) {
        missingApiIds.push(
          describeCard(
            card,
            "No Pokémon TCG API ID is stored.",
          ),
        );

        return false;
      }

      return true;
    });

  const [eurToGbp, usdToGbp] =
    await Promise.all([
      fetchExchangeRate("EUR"),
      fetchExchangeRate("USD"),
    ]);

  let updated = 0;
  let unchanged = 0;

  for (const cardBatch of chunkArray(
    cardsWithApiIds,
    LOOKUP_CONCURRENCY,
  )) {
    const results =
      await Promise.allSettled(
        cardBatch.map(
          async (storedCard) => {
            const apiId =
              storedCard.api_id!.trim();

            const lookup =
              await fetchExternalCard(
                apiId,
              );

            if (
              lookup.status ===
              "not_found"
            ) {
              invalidApiIds.push(
                describeCard(
                  storedCard,
                  `No Pokémon TCG API card exists with ID "${apiId}".`,
                ),
              );

              return;
            }

            const calculatedPrice =
              calculateGbpPrice(
                lookup.card,
                eurToGbp,
                usdToGbp,
              );

            if (!calculatedPrice) {
              withoutPrices.push(
                describeCard(
                  storedCard,
                  "The card exists, but Cardmarket and TCGplayer returned no usable price.",
                ),
              );

              return;
            }

            const currentPrice =
              toPositiveNumber(
                storedCard.market_value,
              ) || 0;

            const priceChanged =
              Math.abs(
                currentPrice -
                  calculatedPrice.priceGbp,
              ) >= 0.01;

            const {
              error: updateError,
            } = await supabase
              .from("pokemon_cards")
              .update({
                market_value:
                  calculatedPrice.priceGbp,

                price_source:
                  calculatedPrice.source,

                price_updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                storedCard.id,
              );

            if (updateError) {
              throw new Error(
                updateError.message,
              );
            }

            if (priceChanged) {
              updated += 1;
            } else {
              unchanged += 1;
            }
          },
        ),
      );

    results.forEach(
      (result, index) => {
        if (
          result.status ===
          "rejected"
        ) {
          const card =
            cardBatch[index];

          failedCards.push(
            describeCard(
              card,
              result.reason instanceof
                Error
                ? result.reason.message
                : String(
                    result.reason,
                  ),
            ),
          );
        }
      },
    );
  }

  /*
   * The existing inventory UI understands missingApiId and
   * missingPrice. Invalid API IDs are included in the
   * missingApiId count because they require the same fix:
   * correcting pokemon_cards.api_id.
   */

  return {
    checked:
      storedCards.length,

    updated,
    unchanged,

    missingApiId:
      missingApiIds.length +
      invalidApiIds.length,

    missingPrice:
      withoutPrices.length,

    missingApiIds,
    invalidApiIds,
    withoutPrices,
    failedCards,
  };
}

export async function POST(
  request: Request,
) {
  try {
    await authenticateRequest(
      request,
    );

    const result =
      await refreshPrices();

    return NextResponse.json(
      {
        success: true,
        ...result,

        syncedAt:
          new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "Live price refresh error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Live price refresh failed.";

    if (
      message ===
      "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your admin session could not be verified.",
        },
        {
          status: 401,
        },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}