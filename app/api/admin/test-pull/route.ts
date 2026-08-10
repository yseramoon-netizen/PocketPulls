import {
  adminErrorResponse,
  requireAdmin,
  type ServerAdminClient,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SIMULATION_PULLS = 100000;
const SAMPLE_SIZE = 24;

type TierRow = {
  rarity_tier: string;
  display_name: string;
  weight: number | string;
  sort_order: number | string;
  enabled: boolean;
};

type PoolRow = {
  card_id: string | number;
  rarity_tier: string;
  draw_key: number | string;
};

type CardRow = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
  image_url_large?: string | null;
};

type OddsInput = {
  rarityTier?: unknown;
  weight?: unknown;
  enabled?: unknown;
};

type LabCard = {
  cardId: string;
  rarityTier: string;
  drawKey: number;
  name: string;
  setName: string;
  cardNumber: string;
  printedRarity: string;
  marketValue: number;
  imageUrl: string | null;
  brokenLink: boolean;
};

type LabTier = {
  rarityTier: string;
  displayName: string;
  weight: number;
  sortOrder: number;
  enabled: boolean;
  cardsInPool: number;
  averageCardValue: number;
  lowestCardValue: number;
  highestCardValue: number;
};

type LoadedLab = {
  tiers: LabTier[];
  cardsByTier: Map<string, LabCard[]>;
  totalPoolCards: number;
  brokenCardLinks: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, parsed));
}

function readCount(value: unknown): number {
  return Math.floor(
    clampNumber(value, 1, MAX_SIMULATION_PULLS, 1),
  );
}

function readPrice(value: unknown): number {
  return Math.round(clampNumber(value, 0, 10000, 0.5) * 100) / 100;
}

function readString(value: unknown, maxLength = 300): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isMissingColumn(error: unknown, column: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;
  const text = [record.message, record.details]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    text.includes(column.toLowerCase()) &&
    (text.includes("does not exist") || text.includes("schema cache"))
  );
}

async function loadCards(
  admin: ServerAdminClient,
  cardIds: string[],
): Promise<CardRow[]> {
  const cards: CardRow[] = [];

  for (let index = 0; index < cardIds.length; index += 500) {
    const chunk = cardIds.slice(index, index + 500);

    let result = await admin
      .from("pokemon_cards")
      .select(
        "id,name,set_name,card_no,rarity,market_value,image_url,image_url_large",
      )
      .in("id", chunk);

    if (result.error && isMissingColumn(result.error, "image_url_large")) {
      result = await admin
        .from("pokemon_cards")
        .select("id,name,set_name,card_no,rarity,market_value,image_url")
        .in("id", chunk);
    }

    if (result.error) {
      throw result.error;
    }

    if (Array.isArray(result.data)) {
      cards.push(...(result.data as CardRow[]));
    }
  }

  return cards;
}

async function loadWishLab(admin: ServerAdminClient): Promise<LoadedLab> {
  const [tierResult, poolResult] = await Promise.all([
    admin
      .from("wish_rarity_tiers")
      .select("rarity_tier,display_name,weight,sort_order,enabled")
      .order("sort_order", { ascending: true }),
    admin
      .from("wish_pool_cards")
      .select("card_id,rarity_tier,draw_key")
      .eq("enabled", true)
      .limit(20000),
  ]);

  if (tierResult.error) {
    throw tierResult.error;
  }

  if (poolResult.error) {
    throw poolResult.error;
  }

  const tierRows = Array.isArray(tierResult.data)
    ? (tierResult.data as TierRow[])
    : [];
  const poolRows = Array.isArray(poolResult.data)
    ? (poolResult.data as PoolRow[])
    : [];
  const cardIds = Array.from(
    new Set(poolRows.map((row) => String(row.card_id))),
  );
  const cardRows = await loadCards(admin, cardIds);
  const cardById = new Map(
    cardRows.map((card) => [String(card.id), card]),
  );
  const cardsByTier = new Map<string, LabCard[]>();
  let brokenCardLinks = 0;

  for (const row of poolRows) {
    const cardId = String(row.card_id);
    const card = cardById.get(cardId);
    const brokenLink = !card;

    if (brokenLink) {
      brokenCardLinks += 1;
    }

    const labCard: LabCard = {
      cardId,
      rarityTier: row.rarity_tier,
      drawKey: clampNumber(row.draw_key, 0, 0.999999999999, 0),
      name: card?.name || "Missing master-card record",
      setName: card?.set_name || "Pool repair required",
      cardNumber: card?.card_no || "",
      printedRarity: card?.rarity || "Unknown rarity",
      marketValue: Math.max(0, toNumber(card?.market_value)),
      imageUrl: card?.image_url_large || card?.image_url || null,
      brokenLink,
    };

    const current = cardsByTier.get(row.rarity_tier) || [];
    current.push(labCard);
    cardsByTier.set(row.rarity_tier, current);
  }

  for (const cards of cardsByTier.values()) {
    cards.sort((left, right) => left.drawKey - right.drawKey);
  }

  const tiers = tierRows.map((row): LabTier => {
    const cards = cardsByTier.get(row.rarity_tier) || [];
    const values = cards.map((card) => card.marketValue);
    const expectedCardValue = cards.reduce((sum, card, index) => {
      if (cards.length === 1) {
        return card.marketValue;
      }

      const previousDrawKey = index > 0
        ? cards[index - 1].drawKey
        : cards[cards.length - 1].drawKey - 1;
      const drawProbability = Math.max(0, card.drawKey - previousDrawKey);

      return sum + card.marketValue * drawProbability;
    }, 0);

    return {
      rarityTier: row.rarity_tier,
      displayName: row.display_name,
      weight: Math.max(0.000001, toNumber(row.weight)),
      sortOrder: Math.floor(toNumber(row.sort_order)),
      enabled: row.enabled !== false,
      cardsInPool: cards.length,
      // The player engine chooses the first indexed draw_key at or above a
      // random value and wraps to the first card. Gap size therefore controls
      // each card's exact chance; this is the true expected tier value.
      averageCardValue: cards.length ? expectedCardValue : 0,
      lowestCardValue: values.length ? Math.min(...values) : 0,
      highestCardValue: values.length ? Math.max(...values) : 0,
    };
  });

  return {
    tiers,
    cardsByTier,
    totalPoolCards: poolRows.length,
    brokenCardLinks,
  };
}

function applyOddsInputs(tiers: LabTier[], input: unknown): LabTier[] {
  if (!Array.isArray(input)) {
    return tiers;
  }

  const supplied = new Map<string, OddsInput>();

  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }

    const item = raw as OddsInput;
    const key = readString(item.rarityTier, 80);

    if (!key || supplied.has(key)) {
      continue;
    }

    supplied.set(key, item);
  }

  if (supplied.size !== tiers.length) {
    throw new Error("Every rarity tier must be included exactly once.");
  }

  return tiers.map((tier) => {
    const item = supplied.get(tier.rarityTier);

    if (!item) {
      throw new Error("Every rarity tier must be included exactly once.");
    }

    const weight = clampNumber(item.weight, 0.000001, 1000000, 0);

    if (weight <= 0) {
      throw new Error(`${tier.displayName} needs a positive chance value.`);
    }

    return {
      ...tier,
      weight,
      enabled: item.enabled !== false,
    };
  });
}

function requirePercentTotal(tiers: LabTier[]): void {
  const total = tiers
    .filter((tier) => tier.enabled)
    .reduce((sum, tier) => sum + tier.weight, 0);

  if (Math.abs(total - 100) > 0.01) {
    throw new Error(
      `Enabled rarity chances must total 100%. They currently total ${total.toFixed(2)}%.`,
    );
  }
}

function chooseWeightedTier(
  tiers: Array<LabTier & { chancePercent: number }>,
): LabTier & { chancePercent: number } {
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  let cursor = Math.random() * total;

  for (const tier of tiers) {
    cursor -= tier.weight;

    if (cursor <= 0) {
      return tier;
    }
  }

  return tiers[tiers.length - 1];
}

function chooseCard(cards: LabCard[]): LabCard {
  const target = Math.random();
  let low = 0;
  let high = cards.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (cards[middle].drawKey < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return cards[low] || cards[0];
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export async function GET(request: Request) {
  try {
    const { email, admin } = await requireAdmin(request);
    const lab = await loadWishLab(admin);

    return Response.json(
      {
        ok: true,
        mode: "read_only_test",
        inventoryChanged: false,
        adminEmail: email,
        maxSimulationPulls: MAX_SIMULATION_PULLS,
        tiers: lab.tiers,
        pool: {
          totalCards: lab.totalPoolCards,
          brokenCardLinks: lab.brokenCardLinks,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, email, admin } = await requireAdmin(request);
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_wish_lab_body",
            message: "The Wish Lab request was not valid JSON.",
          },
        },
        { status: 400 },
      );
    }

    const lab = await loadWishLab(admin);
    const tiers = applyOddsInputs(lab.tiers, body.tiers);
    const action = readString(body.action, 40) || "simulate";

    if (action === "save_odds") {
      requirePercentTotal(tiers);

      const { error } = await admin.rpc("admin_update_wish_rarity_odds", {
        p_tiers: tiers.map((tier) => ({
          rarityTier: tier.rarityTier,
          weight: tier.weight,
          enabled: tier.enabled,
        })),
        p_admin_user_id: user.id,
        p_admin_email: email,
        p_reason: readString(body.reason, 500),
      });

      if (error) {
        throw error;
      }

      const refreshed = await loadWishLab(admin);

      return Response.json(
        {
          ok: true,
          action: "save_odds",
          adminEmail: email,
          tiers: refreshed.tiers,
          savedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action !== "simulate") {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_wish_lab_action",
            message: "Choose a valid Wish Lab action.",
          },
        },
        { status: 400 },
      );
    }

    const count = readCount(body.count);
    const pricePerWish = readPrice(body.pricePerWish);
    const drawableTiers = tiers.filter(
      (tier) => tier.enabled && tier.weight > 0 && tier.cardsInPool > 0,
    );

    if (!drawableTiers.length) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "wish_lab_pool_empty",
            message: "No enabled rarity tier currently contains a summonable card.",
          },
        },
        { status: 409 },
      );
    }

    const totalWeight = drawableTiers.reduce(
      (sum, tier) => sum + tier.weight,
      0,
    );
    const weightedTiers = drawableTiers.map((tier) => ({
      ...tier,
      chancePercent: percent(tier.weight, totalWeight),
    }));
    const observed = new Map<string, number>();
    const samples: Array<LabCard & { sequence: number; testId: string }> = [];
    let totalCardValue = 0;
    let highestCardValue = 0;
    let lowestCardValue = Number.POSITIVE_INFINITY;
    let brokenPulls = 0;

    for (let sequence = 1; sequence <= count; sequence += 1) {
      const tier = chooseWeightedTier(weightedTiers);
      const cards = lab.cardsByTier.get(tier.rarityTier) || [];
      const card = chooseCard(cards);

      observed.set(tier.rarityTier, (observed.get(tier.rarityTier) || 0) + 1);
      totalCardValue += card.marketValue;
      highestCardValue = Math.max(highestCardValue, card.marketValue);
      lowestCardValue = Math.min(lowestCardValue, card.marketValue);

      if (card.brokenLink) {
        brokenPulls += 1;
      }

      if (samples.length < SAMPLE_SIZE) {
        samples.push({
          ...card,
          sequence,
          testId: crypto.randomUUID(),
        });
      }
    }

    const expectedAverageCardValue = weightedTiers.reduce(
      (sum, tier) =>
        sum + tier.averageCardValue * (tier.chancePercent / 100),
      0,
    );
    const revenue = pricePerWish * count;
    const grossProfit = revenue - totalCardValue;
    const expectedCardCost = expectedAverageCardValue * count;
    const expectedProfit = revenue - expectedCardCost;
    const distribution = tiers.map((tier) => {
      const active = weightedTiers.find(
        (candidate) => candidate.rarityTier === tier.rarityTier,
      );
      const actualCount = observed.get(tier.rarityTier) || 0;
      const targetPercent = active?.chancePercent || 0;
      const observedPercent = percent(actualCount, count);

      return {
        rarityTier: tier.rarityTier,
        displayName: tier.displayName,
        enabled: tier.enabled,
        configuredWeight: tier.weight,
        targetPercent,
        expectedCount: (targetPercent / 100) * count,
        actualCount,
        observedPercent,
        variancePoints: observedPercent - targetPercent,
        cardsInPool: tier.cardsInPool,
        averageCardValue: tier.averageCardValue,
      };
    });
    const warnings: string[] = [];
    const configuredTotal = tiers
      .filter((tier) => tier.enabled)
      .reduce((sum, tier) => sum + tier.weight, 0);

    if (Math.abs(configuredTotal - 100) > 0.01) {
      warnings.push(
        `Enabled chance values total ${configuredTotal.toFixed(2)}%, so this test normalized them to 100%.`,
      );
    }

    const emptyEnabled = tiers
      .filter((tier) => tier.enabled && tier.cardsInPool === 0)
      .map((tier) => tier.displayName);

    if (emptyEnabled.length) {
      warnings.push(
        `${emptyEnabled.join(", ")} ${emptyEnabled.length === 1 ? "has" : "have"} no cards and were excluded from the draw.`,
      );
    }

    if (lab.brokenCardLinks > 0) {
      warnings.push(
        `${lab.brokenCardLinks} enabled pool ${lab.brokenCardLinks === 1 ? "entry points" : "entries point"} to ${lab.brokenCardLinks === 1 ? "a missing" : "missing"} master-card ${lab.brokenCardLinks === 1 ? "record" : "records"}.`,
      );
    }

    return Response.json(
      {
        ok: true,
        mode: "read_only_test",
        inventoryChanged: false,
        adminEmail: email,
        simulatedAt: new Date().toISOString(),
        inputs: {
          count,
          pricePerWish,
          configuredWeightTotal: configuredTotal,
        },
        analytics: {
          revenue,
          totalCardValue,
          grossProfit,
          grossMarginPercent: percent(grossProfit, revenue),
          returnOnCardCostPercent: percent(grossProfit, totalCardValue),
          averageCardValue: totalCardValue / count,
          breakEvenWishPrice: totalCardValue / count,
          highestCardValue,
          lowestCardValue:
            Number.isFinite(lowestCardValue) ? lowestCardValue : 0,
          expectedAverageCardValue,
          expectedCardCost,
          expectedProfit,
          expectedGrossMarginPercent: percent(expectedProfit, revenue),
          expectedReturnOnCardCostPercent: percent(
            expectedProfit,
            expectedCardCost,
          ),
          brokenPulls,
        },
        distribution,
        samples,
        pool: {
          totalCards: lab.totalPoolCards,
          brokenCardLinks: lab.brokenCardLinks,
        },
        warnings,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Ancient-Pulls-Test-Mode": "read-only",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
