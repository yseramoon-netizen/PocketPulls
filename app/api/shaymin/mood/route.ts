import { NextResponse } from "next/server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Founder = "lukas" | "skye";

class RouteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RouteError";
    this.status = status;
  }
}

type MoodId =
  | "sleeping"
  | "morning"
  | "worried"
  | "celebration"
  | "together"
  | "lukas"
  | "skye"
  | "busy"
  | "gardener"
  | "seed"
  | "content";

type InventoryRow = {
  id: unknown;
  card_id: unknown;
  quantity: number | string | null;
  location: string | null;
  added_by_user_id: string | null;
  created_at: string | null;
};

type PokemonCardRow = {
  id: unknown;
  name: string | null;
  api_id: string | null;
  image_url: string | null;
  market_value: number | string | null;
};

type ActivityRow = {
  actor_user_id: string | null;
  card_id: string | null;
  quantity_delta: number | string | null;
  created_at: string | null;
};

type TreeRow = {
  peak_value: number | string | null;
  target_value: number | string | null;
};

type MilestoneRow = {
  milestone_value: number | string;
  label: string;
  reached_at: string;
};

type Milestone = {
  value: number;
  label: string;
};

type ShayminMood = {
  id: MoodId;
  title: string;
  message: string;
  detail: string;
};

const TARGET_VALUE = 1_000_000;
const QUERY_BATCH_SIZE = 250;

const MILESTONES: Milestone[] = [
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
    label: "The Million Pound World Tree",
  },
];

function toNumber(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function roundMoney(
  value: number,
): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function normaliseId(
  value: unknown,
): string {
  if (typeof value === "string") {
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

function readList(
  value: string | undefined,
): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function chunk<T>(
  values: T[],
  size: number,
): T[][] {
  const result: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size,
      ),
    );
  }

  return result;
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits:
        value >= 100_000 ? 0 : 2,
    },
  ).format(value);
}

function getLondonDateKey(
  value: Date,
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(value);

  const year =
    parts.find(
      (part) => part.type === "year",
    )?.value || "";

  const month =
    parts.find(
      (part) => part.type === "month",
    )?.value || "";

  const day =
    parts.find(
      (part) => part.type === "day",
    )?.value || "";

  return `${year}-${month}-${day}`;
}

function getLondonHour(
  value: Date,
): number {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        hour: "2-digit",
        hourCycle: "h23",
      },
    ).formatToParts(value);

  const hour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value,
  );

  return Number.isFinite(hour)
    ? hour
    : 12;
}

function founderName(
  founder: Founder | null,
): string {
  if (founder === "lukas") {
    return "Lukas";
  }

  if (founder === "skye") {
    return "Skye";
  }

  return "Founder";
}

function founderFromUser(
  user: {
    id: string;
    email?: string | null;
  },
): Founder | null {
  const userEmail =
    user.email
      ?.trim()
      .toLowerCase() || "";

  const lukasIds =
    readList(
      process.env
        .POCKETPULLS_LUKAS_USER_IDS,
    );

  const skyeIds =
    readList(
      process.env
        .POCKETPULLS_SKYE_USER_IDS,
    );

  const lukasEmails = [
    "pullspocket@gmail.com",
    ...readList(
      process.env
        .POCKETPULLS_LUKAS_EMAILS,
    ),
  ].map((email) =>
      email.toLowerCase(),
    );

  const skyeEmails =
    readList(
      process.env
        .POCKETPULLS_SKYE_EMAILS,
    ).map((email) =>
      email.toLowerCase(),
    );

  const isLukas =
    lukasIds.includes(user.id) ||
    Boolean(
      userEmail &&
        lukasEmails.includes(
          userEmail,
        ),
    );

  const isSkye =
    skyeIds.includes(user.id) ||
    Boolean(
      userEmail &&
        skyeEmails.includes(
          userEmail,
        ),
    );

  if (isLukas && !isSkye) {
    return "lukas";
  }

  if (isSkye && !isLukas) {
    return "skye";
  }

  return null;
}

async function authenticate(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  const token =
    authorization?.match(
      /^Bearer\s+(.+)$/i,
    )?.[1];

  if (!token) {
    throw new Error(
      "Authentication required.",
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    token,
  );

  if (error || !user) {
    throw new Error(
      "Your session could not be verified.",
    );
  }

  return user;
}

function nextMilestone(
  value: number,
): Milestone | null {
  return (
    MILESTONES.find(
      (milestone) =>
        milestone.value > value,
    ) || null
  );
}

function chooseMood(input: {
  hour: number;
  viewerFounder: Founder | null;

  currentValue: number;
  peakValue: number;
  targetValue: number;

  addedToday: number;
  valueAddedToday: number;

  lukasAddedToday: number;
  skyeAddedToday: number;

  issueCount: number;
  missingPriceCount: number;
  missingApiIdCount: number;
  missingImageCount: number;
  missingLocationCount: number;

  recentMilestone: MilestoneRow | null;
  nextMilestone: Milestone | null;
}): ShayminMood {
  const viewer =
    founderName(
      input.viewerFounder,
    );

  if (input.recentMilestone) {
    return {
      id: "celebration",

      title:
        "The forest is celebrating",

      message:
        `${input.recentMilestone.label} has been reached.`,

      detail:
        `ancientpulls passed ${formatCurrency(
          toNumber(
            input.recentMilestone
              .milestone_value,
          ),
        )}. The tree will remember this day.`,
    };
  }

  if (input.issueCount >= 5) {
    const details: string[] = [];

    if (
      input.missingPriceCount > 0
    ) {
      details.push(
        `${input.missingPriceCount} missing prices`,
      );
    }

    if (
      input.missingApiIdCount > 0
    ) {
      details.push(
        `${input.missingApiIdCount} missing API IDs`,
      );
    }

    if (
      input.missingImageCount > 0
    ) {
      details.push(
        `${input.missingImageCount} missing images`,
      );
    }

    if (
      input.missingLocationCount > 0
    ) {
      details.push(
        `${input.missingLocationCount} missing locations`,
      );
    }

    return {
      id: "worried",

      title:
        "Some cards need help",

      message:
        `${input.issueCount} inventory details need attention.`,

      detail:
        details.join(" - ") ||
        "The inventory needs a little care.",
    };
  }

  if (
    input.hour >= 0 &&
    input.hour < 5
  ) {
    return {
      id: "sleeping",

      title:
        "Shaymin is sleeping",

      message:
        "The forest is quiet, but the vault is safe.",

      detail:
        `Current inventory value: ${formatCurrency(
          input.currentValue,
        )}.`,
    };
  }

  if (
    input.hour >= 5 &&
    input.hour < 8
  ) {
    return {
      id: "morning",

      title: "Morning dew",

      message:
        `Good morning, ${viewer}. The forest is waking up.`,

      detail:
        input.addedToday > 0
          ? `${input.addedToday} cards have already joined the vault today.`
          : "The leaves are waiting for today's first card.",
    };
  }

  if (
    input.lukasAddedToday > 0 &&
    input.skyeAddedToday > 0
  ) {
    return {
      id: "together",

      title:
        "Moon and star together",

      message:
        "Lukas and Skye have both helped the forest grow today.",

      detail:
        `${input.addedToday} cards were added, worth approximately ${formatCurrency(
          input.valueAddedToday,
        )}.`,
    };
  }

  if (
    input.lukasAddedToday > 0
  ) {
    return {
      id: "lukas",

      title:
        "Moonlight in the garden",

      message:
        `Lukas added ${input.lukasAddedToday} cards today.`,

      detail:
        "Shaymin is carrying a little moon for him.",
    };
  }

  if (
    input.skyeAddedToday > 0
  ) {
    return {
      id: "skye",

      title:
        "Starlight in the garden",

      message:
        `Skye added ${input.skyeAddedToday} cards today.`,

      detail:
        "Shaymin is carrying a little star for her.",
    };
  }

  if (input.addedToday >= 30) {
    return {
      id: "busy",

      title:
        "Shaymin has been busy",

      message:
        `${input.addedToday} cards entered the vault today.`,

      detail:
        `Their current combined value is approximately ${formatCurrency(
          input.valueAddedToday,
        )}.`,
    };
  }

  if (input.currentValue <= 0) {
    return {
      id: "seed",

      title:
        "A seed beneath the soil",

      message:
        "Every forest begins with one card.",

      detail:
        "Add a valued card and Shaymin will begin watching it grow.",
    };
  }

  if (input.nextMilestone) {
    const effectiveValue =
      Math.max(
        input.currentValue,
        input.peakValue,
      );

    const amountRemaining =
      Math.max(
        0,
        input.nextMilestone.value -
          effectiveValue,
      );

    const closeAmount =
      Math.max(
        100,
        input.nextMilestone.value *
          0.1,
      );

    if (
      amountRemaining <=
      closeAmount
    ) {
      return {
        id: "gardener",

        title:
          "The next branch is close",

        message:
          `${formatCurrency(
            amountRemaining,
          )} remains until ${input.nextMilestone.label}.`,

        detail:
          "Shaymin has started preparing a new place in the canopy.",
      };
    }
  }

  const progress =
    input.targetValue > 0
      ? Math.min(
          100,
          (
            Math.max(
              input.currentValue,
              input.peakValue,
            ) /
            input.targetValue
          ) * 100,
        )
      : 0;

  return {
    id: "content",

    title:
      "The forest is peaceful",

    message:
      `The ancientpulls vault is worth ${formatCurrency(
        input.currentValue,
      )}.`,

    detail:
      `The legacy tree is ${progress.toFixed(
        4,
      )}% of the way to its final crown.`,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const user =
      await authenticate(request);

    const viewerFounder =
      founderFromUser(user);

    if (!viewerFounder) {
      throw new RouteError(
        "Only the configured Lukas and Skye founder accounts can access Shaymin's founder status.",
        403,
      );
    }

    const now = new Date();

    const londonHour =
      getLondonHour(now);

    const londonToday =
      getLondonDateKey(now);

    const inventoryResult =
      await supabase
        .from("inventory")
        .select(`
          id,
          card_id,
          quantity,
          location,
          added_by_user_id,
          created_at
        `);

    if (inventoryResult.error) {
      throw new Error(
        inventoryResult.error.message,
      );
    }

    const inventoryRows =
      (inventoryResult.data ||
        []) as InventoryRow[];

    const originalIds =
      new Map<
        string,
        string | number
      >();

    for (const row of inventoryRows) {
      const normalised =
        normaliseId(
          row.card_id,
        );

      if (!normalised) {
        continue;
      }

      if (
        typeof row.card_id ===
          "string" ||
        typeof row.card_id ===
          "number"
      ) {
        originalIds.set(
          normalised,
          row.card_id,
        );
      }
    }

    const pokemonCards:
      PokemonCardRow[] = [];

    for (const idBatch of chunk(
      [...originalIds.values()],
      QUERY_BATCH_SIZE,
    )) {
      if (idBatch.length === 0) {
        continue;
      }

      const cardResult =
        await supabase
          .from("pokemon_cards")
          .select(`
            id,
            name,
            api_id,
            image_url,
            market_value
          `)
          .in("id", idBatch);

      if (cardResult.error) {
        throw new Error(
          cardResult.error.message,
        );
      }

      pokemonCards.push(
        ...((cardResult.data ||
          []) as PokemonCardRow[]),
      );
    }

    const cardsById =
      new Map<
        string,
        PokemonCardRow
      >();

    for (const card of pokemonCards) {
      const cardId =
        normaliseId(card.id);

      if (cardId) {
        cardsById.set(
          cardId,
          card,
        );
      }
    }

    let currentValue = 0;
    let totalUnits = 0;

    let missingLocationCount = 0;

    for (const row of inventoryRows) {
      const quantity =
        Math.max(
          0,
          toNumber(row.quantity),
        );

      const cardId =
        normaliseId(
          row.card_id,
        );

      const card =
        cardsById.get(cardId);

      currentValue +=
        quantity *
        toNumber(
          card?.market_value,
        );

      totalUnits += quantity;

      if (
        typeof row.location !==
          "string" ||
        !row.location.trim()
      ) {
        missingLocationCount += 1;
      }
    }

    currentValue =
      roundMoney(currentValue);

    const missingPriceCount =
      pokemonCards.filter(
        (card) =>
          toNumber(
            card.market_value,
          ) <= 0,
      ).length;

    const missingApiIdCount =
      pokemonCards.filter(
        (card) =>
          typeof card.api_id !==
            "string" ||
          !card.api_id.trim(),
      ).length;

    const missingImageCount =
      pokemonCards.filter(
        (card) =>
          typeof card.image_url !==
            "string" ||
          !card.image_url.trim(),
      ).length;

    const issueCount =
      missingPriceCount +
      missingApiIdCount +
      missingImageCount +
      missingLocationCount;

    const lukasUserIds =
      new Set(
        readList(
          process.env
            .POCKETPULLS_LUKAS_USER_IDS,
        ),
      );

    const skyeUserIds =
      new Set(
        readList(
          process.env
            .POCKETPULLS_SKYE_USER_IDS,
        ),
      );

    let addedToday = 0;
    let valueAddedToday = 0;

    let lukasAddedToday = 0;
    let skyeAddedToday = 0;

    /*
     * Activity history is optional.
     * A missing table no longer breaks Shaymin.
     */

    const activitySince =
      new Date(
        now.getTime() -
          36 *
            60 *
            60 *
            1000,
      ).toISOString();

    const activityResult =
      await supabase
        .from(
          "pocketpulls_activity",
        )
        .select(`
          actor_user_id,
          card_id,
          quantity_delta,
          created_at
        `)
        .gte(
          "created_at",
          activitySince,
        );

    if (!activityResult.error) {
      const activities =
        (activityResult.data ||
          []) as ActivityRow[];

      for (const activity of activities) {
        if (!activity.created_at) {
          continue;
        }

        const activityDate =
          new Date(
            activity.created_at,
          );

        if (
          Number.isNaN(
            activityDate.getTime(),
          ) ||
          getLondonDateKey(
            activityDate,
          ) !== londonToday
        ) {
          continue;
        }

        const quantity =
          toNumber(
            activity.quantity_delta,
          );

        if (quantity <= 0) {
          continue;
        }

        const cardId =
          normaliseId(
            activity.card_id,
          );

        const card =
          cardsById.get(cardId);

        addedToday += quantity;

        valueAddedToday +=
          quantity *
          toNumber(
            card?.market_value,
          );

        if (
          activity.actor_user_id &&
          lukasUserIds.has(
            activity.actor_user_id,
          )
        ) {
          lukasAddedToday +=
            quantity;
        }

        if (
          activity.actor_user_id &&
          skyeUserIds.has(
            activity.actor_user_id,
          )
        ) {
          skyeAddedToday +=
            quantity;
        }
      }
    } else {
      /*
       * Fallback for projects where the activity table
       * has not been installed yet.
       */

      for (const row of inventoryRows) {
        if (!row.created_at) {
          continue;
        }

        const createdAt =
          new Date(
            row.created_at,
          );

        if (
          Number.isNaN(
            createdAt.getTime(),
          ) ||
          getLondonDateKey(
            createdAt,
          ) !== londonToday
        ) {
          continue;
        }

        const quantity =
          Math.max(
            0,
            toNumber(
              row.quantity,
            ),
          );

        const cardId =
          normaliseId(
            row.card_id,
          );

        const card =
          cardsById.get(cardId);

        addedToday += quantity;

        valueAddedToday +=
          quantity *
          toNumber(
            card?.market_value,
          );

        if (
          row.added_by_user_id &&
          lukasUserIds.has(
            row.added_by_user_id,
          )
        ) {
          lukasAddedToday +=
            quantity;
        }

        if (
          row.added_by_user_id &&
          skyeUserIds.has(
            row.added_by_user_id,
          )
        ) {
          skyeAddedToday +=
            quantity;
        }
      }
    }

    valueAddedToday =
      roundMoney(
        valueAddedToday,
      );

    let peakValue =
      currentValue;

    let targetValue =
      TARGET_VALUE;

    const treeResult =
      await supabase
        .from("growth_tree")
        .select(`
          peak_value,
          target_value
        `)
        .eq(
          "id",
          "pocketpulls",
        )
        .maybeSingle();

    if (
      !treeResult.error &&
      treeResult.data
    ) {
      const tree =
        treeResult.data as TreeRow;

      peakValue =
        Math.max(
          currentValue,
          toNumber(
            tree.peak_value,
          ),
        );

      targetValue =
        toNumber(
          tree.target_value,
        ) || TARGET_VALUE;
    }

    let recentMilestone:
      MilestoneRow | null =
      null;

    const milestoneResult =
      await supabase
        .from(
          "growth_tree_milestones",
        )
        .select(`
          milestone_value,
          label,
          reached_at
        `)
        .order(
          "reached_at",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    if (
      !milestoneResult.error &&
      milestoneResult.data
    ) {
      const milestone =
        milestoneResult.data as MilestoneRow;

      const reachedAt =
        new Date(
          milestone.reached_at,
        );

      const reachedRecently =
        !Number.isNaN(
          reachedAt.getTime(),
        ) &&
        now.getTime() -
          reachedAt.getTime() <=
          24 *
            60 *
            60 *
            1000;

      if (reachedRecently) {
        recentMilestone =
          milestone;
      }
    }

    const upcomingMilestone =
      nextMilestone(
        Math.max(
          currentValue,
          peakValue,
        ),
      );

    const mood =
      chooseMood({
        hour:
          londonHour,

        viewerFounder,

        currentValue,

        peakValue,

        targetValue,

        addedToday,

        valueAddedToday,

        lukasAddedToday,

        skyeAddedToday,

        issueCount,

        missingPriceCount,

        missingApiIdCount,

        missingImageCount,

        missingLocationCount,

        recentMilestone,

        nextMilestone:
          upcomingMilestone,
      });

    return NextResponse.json(
      {
        success: true,

        viewerFounder,

        viewerName:
          founderName(
            viewerFounder,
          ),

        londonHour,

        mood,

        stats: {
          currentValue,
          totalUnits,

          uniqueCards:
            originalIds.size,

          addedToday,
          valueAddedToday,

          issueCount,
          missingPriceCount,
          missingApiIdCount,
          missingImageCount,
          missingLocationCount,

          founderActivity: {
            lukas:
              lukasAddedToday,

            skye:
              skyeAddedToday,
          },
        },

        tree: {
          peakValue,
          targetValue,

          nextMilestone:
            upcomingMilestone,

          amountToNext:
            upcomingMilestone
              ? roundMoney(
                  Math.max(
                    0,
                    upcomingMilestone.value -
                      Math.max(
                        currentValue,
                        peakValue,
                      ),
                  ),
                )
              : 0,
        },

        updatedAt:
          now.toISOString(),
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "Shaymin mood route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Shaymin could not sense the forest.",
      },
      {
        status:
          error instanceof RouteError
            ? error.status
            : 500,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}
