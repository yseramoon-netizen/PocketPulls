import { NextResponse } from "next/server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InventoryRow = {
  card_id: unknown;
  quantity:
    | number
    | string
    | null;
};

type PokemonCardRow = {
  id: unknown;
  market_value:
    | number
    | string
    | null;
};

type GrowthTreeRow = {
  current_value:
    | number
    | string
    | null;

  peak_value:
    | number
    | string
    | null;

  target_value:
    | number
    | string
    | null;
};

type StoredMilestoneRow = {
  milestone_value:
    | number
    | string;

  label: string;
  reached_at: string;
};

type MilestoneDefinition = {
  value: number;
  label: string;
};

class RouteError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name = "RouteError";
    this.status = status;
  }
}

const TREE_ID = "pocketpulls";
const TARGET_VALUE = 1_000_000;
const QUERY_BATCH_SIZE = 300;

const MILESTONES:
  MilestoneDefinition[] = [
    {
      value: 100,
      label: "The First Seed",
    },
    {
      value: 1_000,
      label: "Roots Take Hold",
    },
    {
      value: 5_000,
      label: "The First Sapling",
    },
    {
      value: 10_000,
      label: "Young Branches",
    },
    {
      value: 25_000,
      label: "The Growing Crown",
    },
    {
      value: 50_000,
      label: "A Tree of Promise",
    },
    {
      value: 100_000,
      label: "The Sanctuary Tree",
    },
    {
      value: 250_000,
      label: "The Great Canopy",
    },
    {
      value: 500_000,
      label: "Guardian of the Forest",
    },
    {
      value: 750_000,
      label: "The Ancient Crown",
    },
    {
      value: 1_000_000,
      label:
        "The Million Pound World Tree",
    },
  ];

function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function roundCurrency(
  value: number,
): number {
  return (
    Math.round(
      (value +
        Number.EPSILON) *
        100,
    ) / 100
  );
}

function normaliseIdentifier(
  value: unknown,
): string {
  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return "";
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
      values.slice(
        index,
        index + size,
      ),
    );
  }

  return chunks;
}

function readAllowlist(
  value: string | undefined,
): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function authenticateAdmin(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  const accessToken =
    authorization?.match(
      /^Bearer\s+(.+)$/i,
    )?.[1];

  if (!accessToken) {
    throw new RouteError(
      "Authentication required.",
      401,
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    accessToken,
  );

  if (error || !user) {
    console.error(
      "Tree authentication failed:",
      error,
    );

    throw new RouteError(
      "Your session could not be verified.",
      401,
    );
  }

  const allowedUserIds = [
    ...readAllowlist(
      process.env
        .POCKETPULLS_LUKAS_USER_IDS,
    ),

    ...readAllowlist(
      process.env
        .POCKETPULLS_SKYE_USER_IDS,
    ),
  ];

  const allowedEmails = [
    "pullspocket@gmail.com",
    ...readAllowlist(
      process.env
        .POCKETPULLS_LUKAS_EMAILS,
    ),

    ...readAllowlist(
      process.env
        .POCKETPULLS_SKYE_EMAILS,
    ),
  ].map((email) =>
    email.toLowerCase(),
  );

  const configured =
    allowedUserIds.length > 0 ||
    allowedEmails.length > 0;

  if (!configured) {
    console.error(
      "No ancientpulls founder allowlist is configured.",
    );

    throw new RouteError(
      "The founder accounts have not been configured on this deployment.",
      500,
    );
  }

  const userEmail =
    user.email
      ?.trim()
      .toLowerCase() || "";

  const authorisedById =
    allowedUserIds.includes(
      user.id,
    );

  const authorisedByEmail =
    Boolean(
      userEmail &&
        allowedEmails.includes(
          userEmail,
        ),
    );

  console.info(
    "Tree access check:",
    {
      userId: user.id,
      email: userEmail,
      authorisedById,
      authorisedByEmail,
      deployment:
        process.env
          .VERCEL_ENV ||
        "local",
    },
  );

  if (
    !authorisedById &&
    !authorisedByEmail
  ) {
    throw new RouteError(
      "Only the configured Lukas and Skye founder accounts can view this page.",
      403,
    );
  }

  return user;
}

async function calculateInventory() {
  const {
    data: inventoryData,
    error: inventoryError,
  } = await supabase
    .from("inventory")
    .select(
      "card_id, quantity",
    )
    .gt("quantity", 0);

  if (inventoryError) {
    throw new RouteError(
      inventoryError.message,
      500,
    );
  }

  const inventoryRows =
    (inventoryData ||
      []) as InventoryRow[];

  const databaseIds =
    new Map<
      string,
      string | number
    >();

  for (const row of inventoryRows) {
    const identifier =
      normaliseIdentifier(
        row.card_id,
      );

    if (!identifier) {
      continue;
    }

    if (
      typeof row.card_id ===
        "string" ||
      typeof row.card_id ===
        "number"
    ) {
      databaseIds.set(
        identifier,
        row.card_id,
      );
    }
  }

  const cardRows:
    PokemonCardRow[] = [];

  for (const batch of chunkArray(
    [...databaseIds.values()],
    QUERY_BATCH_SIZE,
  )) {
    const {
      data,
      error,
    } = await supabase
      .from("pokemon_cards")
      .select(
        "id, market_value",
      )
      .in("id", batch);

    if (error) {
      throw new RouteError(
        error.message,
        500,
      );
    }

    cardRows.push(
      ...((data ||
        []) as PokemonCardRow[]),
    );
  }

  const priceByCardId =
    new Map<string, number>();

  for (const card of cardRows) {
    const identifier =
      normaliseIdentifier(
        card.id,
      );

    if (!identifier) {
      continue;
    }

    priceByCardId.set(
      identifier,
      toNumber(
        card.market_value,
      ),
    );
  }

  let currentValue = 0;
  let totalUnits = 0;

  for (const row of inventoryRows) {
    const cardId =
      normaliseIdentifier(
        row.card_id,
      );

    const quantity =
      Math.max(
        0,
        toNumber(row.quantity),
      );

    const cardValue =
      priceByCardId.get(
        cardId,
      ) || 0;

    currentValue +=
      cardValue * quantity;

    totalUnits += quantity;
  }

  return {
    currentValue:
      roundCurrency(
        currentValue,
      ),

    totalUnits,

    uniqueCards:
      databaseIds.size,
  };
}

function getCurrentStage(
  peakValue: number,
): MilestoneDefinition {
  let currentStage:
    MilestoneDefinition = {
      value: 0,
      label:
        "A Promise Beneath the Soil",
    };

  for (const milestone of MILESTONES) {
    if (
      peakValue >=
      milestone.value
    ) {
      currentStage =
        milestone;
    }
  }

  return currentStage;
}

export async function GET(
  request: Request,
) {
  try {
    await authenticateAdmin(
      request,
    );

    const inventory =
      await calculateInventory();

    const {
      data: storedTreeData,
      error: treeLookupError,
    } = await supabase
      .from("growth_tree")
      .select(
        `
          current_value,
          peak_value,
          target_value
        `,
      )
      .eq("id", TREE_ID)
      .maybeSingle();

    if (treeLookupError) {
      throw new RouteError(
        treeLookupError.message,
        500,
      );
    }

    const storedTree =
      storedTreeData as
        | GrowthTreeRow
        | null;

    const previousPeak =
      toNumber(
        storedTree?.peak_value,
      );

    const targetValue =
      toNumber(
        storedTree?.target_value,
      ) || TARGET_VALUE;

    const peakValue =
      roundCurrency(
        Math.max(
          previousPeak,
          inventory.currentValue,
        ),
      );

    const now =
      new Date().toISOString();

    const {
      error: treeUpdateError,
    } = await supabase
      .from("growth_tree")
      .upsert(
        {
          id: TREE_ID,

          current_value:
            inventory.currentValue,

          peak_value:
            peakValue,

          target_value:
            targetValue,

          updated_at:
            now,
        },
        {
          onConflict: "id",
        },
      );

    if (treeUpdateError) {
      throw new RouteError(
        treeUpdateError.message,
        500,
      );
    }

    const {
      data: storedMilestonesData,
      error: milestoneReadError,
    } = await supabase
      .from(
        "growth_tree_milestones",
      )
      .select(
        `
          milestone_value,
          label,
          reached_at
        `,
      );

    if (milestoneReadError) {
      throw new RouteError(
        milestoneReadError.message,
        500,
      );
    }

    const storedMilestones =
      (storedMilestonesData ||
        []) as StoredMilestoneRow[];

    const existingValues =
      new Set<number>();

    for (
      const milestone of
      storedMilestones
    ) {
      existingValues.add(
        toNumber(
          milestone.milestone_value,
        ),
      );
    }

    const newlyReached =
      MILESTONES.filter(
        (milestone) =>
          peakValue >=
            milestone.value &&
          !existingValues.has(
            milestone.value,
          ),
      ).map((milestone) => ({
        milestone_value:
          milestone.value,

        label:
          milestone.label,

        reached_at:
          now,
      }));

    if (
      newlyReached.length > 0
    ) {
      const {
        error: milestoneWriteError,
      } = await supabase
        .from(
          "growth_tree_milestones",
        )
        .upsert(
          newlyReached,
          {
            onConflict:
              "milestone_value",
          },
        );

      if (milestoneWriteError) {
        throw new RouteError(
          milestoneWriteError.message,
          500,
        );
      }
    }

    const {
      data: finalMilestoneData,
      error: finalMilestoneError,
    } = await supabase
      .from(
        "growth_tree_milestones",
      )
      .select(
        `
          milestone_value,
          label,
          reached_at
        `,
      )
      .order(
        "milestone_value",
        {
          ascending: true,
        },
      );

    if (finalMilestoneError) {
      throw new RouteError(
        finalMilestoneError.message,
        500,
      );
    }

    const finalMilestones =
      (finalMilestoneData ||
        []) as StoredMilestoneRow[];

    const reachedByValue =
      new Map<
        number,
        StoredMilestoneRow
      >();

    for (
      const milestone of
      finalMilestones
    ) {
      reachedByValue.set(
        toNumber(
          milestone.milestone_value,
        ),
        milestone,
      );
    }

    const nextMilestone =
      MILESTONES.find(
        (milestone) =>
          milestone.value >
          peakValue,
      ) || null;

    const percentage =
      Math.min(
        100,
        Math.max(
          0,
          (peakValue /
            targetValue) *
            100,
        ),
      );

    return NextResponse.json(
      {
        success: true,

        currentValue:
          inventory.currentValue,

        peakValue,

        targetValue,

        percentage:
          Number(
            percentage.toFixed(
              4,
            ),
          ),

        totalUnits:
          inventory.totalUnits,

        uniqueCards:
          inventory.uniqueCards,

        stage:
          getCurrentStage(
            peakValue,
          ),

        nextMilestone,

        milestones:
          MILESTONES.map(
            (milestone) => {
              const reached =
                reachedByValue.get(
                  milestone.value,
                );

              return {
                value:
                  milestone.value,

                label:
                  milestone.label,

                reached:
                  Boolean(reached),

                reachedAt:
                  reached?.reached_at ||
                  null,
              };
            },
          ),

        updatedAt: now,
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
      "Tree progress error:",
      error,
    );

    const status =
      error instanceof RouteError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "The tree could not be loaded.",
      },
      {
        status,
      },
    );
  }
}
