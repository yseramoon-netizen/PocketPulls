import type {
  ServerAdminClient,
} from "@/lib/admin/server-auth";

type UnknownRow = Record<string, unknown>;

export type GrowthBranch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
  activeThisWeek: boolean;
};

export type GrowthMilestone = {
  score: number;
  label: string;
  reached: boolean;
};

export type GrowthSnapshot = {
  stage: string;
  stageIndex: number;
  growthScore: number;
  rawGrowthScore: number;
  gardenVisits: number;
  persistentGrowth: boolean;
  stageFloor: number;
  nextStageScore: number;
  stageProgress: number;
  stockCards: number;
  trainers: number;
  cardsFound: number;
  availableWishes: number;
  wishesSpent: number;
  valueShared: number;
  sharedCards: number;
  cardsPlantedToday: number;
  wishesToday: number;
  latestActivityAt: string | null;
  bothActiveThisWeek: boolean;
  branches: GrowthBranch[];
  milestones: GrowthMilestone[];
};

const STAGES = [
  { score: 0, label: "A promise in the soil" },
  { score: 250, label: "Two new leaves" },
  { score: 1000, label: "A brave young sapling" },
  { score: 3000, label: "The flowering tree" },
  { score: 7500, label: "A moonlit canopy" },
  { score: 15000, label: "The ancient garden" },
] as const;

function asRows(value: unknown): UnknownRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is UnknownRow =>
          typeof item === "object" &&
          item !== null,
      )
    : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toTime(value: unknown): number {
  const text = textValue(value);
  const time = text ? new Date(text).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function isSameLocalDay(
  timestamp: unknown,
  now: Date,
): boolean {
  const time = toTime(timestamp);
  if (!time) return false;
  const date = new Date(time);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function keeperName(
  email: string,
  displayName: string,
): string {
  if (displayName) return displayName;
  if (
    email === "pullspocket@gmail.com" ||
    email.includes("lukas")
  ) {
    return "Lukas";
  }
  if (email.includes("skye")) {
    return "Skye";
  }

  const prefix = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  return prefix
    ? prefix.replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      )
    : "Garden keeper";
}

async function safeSelect(
  admin: ServerAdminClient,
  tableName: string,
  columns: string,
): Promise<UnknownRow[]> {
  try {
    const result = await (
      admin.from(tableName) as any
    ).select(columns);

    if (result.error) {
      console.warn(
        `Growth metric ${tableName} unavailable:`,
        result.error,
      );
      return [];
    }

    return asRows(result.data);
  } catch (error: unknown) {
    console.warn(
      `Growth metric ${tableName} failed:`,
      error,
    );
    return [];
  }
}

export function resolveGrowthStage(growthScore: number) {
  let index = 0;

  for (let cursor = 0; cursor < STAGES.length; cursor += 1) {
    if (growthScore >= STAGES[cursor].score) {
      index = cursor;
    }
  }

  const current = STAGES[index];
  const next = STAGES[index + 1] || current;
  const range = Math.max(1, next.score - current.score);
  const progress =
    index === STAGES.length - 1
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((growthScore - current.score) / range) * 100,
          ),
        );

  return {
    stage: current.label,
    stageIndex: index,
    stageFloor: current.score,
    nextStageScore: next.score,
    stageProgress: Math.round(progress),
  };
}

export async function loadGrowthSnapshot(
  admin: ServerAdminClient,
): Promise<GrowthSnapshot> {
  const [
    inventory,
    profiles,
    wallets,
    wishes,
    admins,
  ] = await Promise.all([
    safeSelect(
      admin,
      "inventory",
      "quantity,added_by,created_at,status",
    ),
    safeSelect(
      admin,
      "player_profiles",
      "user_id,created_at",
    ),
    safeSelect(
      admin,
      "player_wallets",
      "wish_balance,lifetime_wishes_spent,updated_at",
    ),
    safeSelect(
      admin,
      "player_wishes",
      "id,market_value_at_wish,created_at,user_id",
    ),
    safeSelect(
      admin,
      "admin_users",
      "email,display_name,is_active,user_id",
    ),
  ]);

  const now = new Date();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const keepers = admins
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const email = textValue(row.email).toLowerCase();
      return {
        email,
        name: keeperName(
          email,
          textValue(row.display_name),
        ),
      };
    })
    .filter((row) => Boolean(row.email));

  if (
    !keepers.some(
      (row) => row.email === "pullspocket@gmail.com",
    )
  ) {
    keepers.unshift({
      email: "pullspocket@gmail.com",
      name: "Lukas",
    });
  }

  const branches: GrowthBranch[] = keepers
    .map((keeper) => {
      const matching = inventory.filter((row) => {
        const addedBy = textValue(row.added_by).toLowerCase();
        return (
          addedBy === keeper.email ||
          addedBy.includes(keeper.name.toLowerCase())
        );
      });

      const latest = matching.reduce(
        (latestValue, row) =>
          Math.max(latestValue, toTime(row.created_at)),
        0,
      );

      return {
        name: keeper.name,
        email: keeper.email,
        cardsPlanted: matching.reduce(
          (total, row) =>
            total + Math.max(0, numberValue(row.quantity)),
          0,
        ),
        plantingSessions: matching.length,
        lastPlantedAt: latest
          ? new Date(latest).toISOString()
          : null,
        activeThisWeek: latest >= weekAgo,
      };
    })
    .sort((first, second) => {
      const order = (name: string) =>
        name.toLowerCase().includes("lukas")
          ? 0
          : name.toLowerCase().includes("skye")
            ? 1
            : 2;
      return order(first.name) - order(second.name);
    });

  const stockCards = inventory.reduce(
    (total, row) =>
      total + Math.max(0, numberValue(row.quantity)),
    0,
  );

  const branchCards = branches.reduce(
    (total, branch) => total + branch.cardsPlanted,
    0,
  );

  const availableWishes = wallets.reduce(
    (total, row) =>
      total + Math.max(0, numberValue(row.wish_balance)),
    0,
  );

  const wishesSpent = wallets.reduce(
    (total, row) =>
      total +
      Math.max(0, numberValue(row.lifetime_wishes_spent)),
    0,
  );

  const valueShared = wishes.reduce(
    (total, row) =>
      total +
      Math.max(0, numberValue(row.market_value_at_wish)),
    0,
  );

  const cardsFound = wishes.length;
  const trainers = profiles.length;

  const cardsPlantedToday = inventory
    .filter((row) => isSameLocalDay(row.created_at, now))
    .reduce(
      (total, row) =>
        total + Math.max(0, numberValue(row.quantity)),
      0,
    );

  const wishesToday = wishes.filter((row) =>
    isSameLocalDay(row.created_at, now),
  ).length;

  const allActivityTimes = [
    ...inventory.map((row) => toTime(row.created_at)),
    ...wishes.map((row) => toTime(row.created_at)),
    ...profiles.map((row) => toTime(row.created_at)),
    ...wallets.map((row) => toTime(row.updated_at)),
  ].filter((value) => value > 0);

  const latestActivity = allActivityTimes.length
    ? Math.max(...allActivityTimes)
    : 0;

  const growthScore = Math.max(
    0,
    Math.round(
      stockCards +
        cardsFound * 6 +
        trainers * 14 +
        wishesSpent * 3 +
        Math.round(valueShared * 4),
    ),
  );

  const stage = resolveGrowthStage(growthScore);

  const bothActiveThisWeek =
    branches.filter((branch) =>
      ["lukas", "skye"].some((name) =>
        branch.name.toLowerCase().includes(name),
      ),
    ).length >= 2 &&
    branches
      .filter((branch) =>
        ["lukas", "skye"].some((name) =>
          branch.name.toLowerCase().includes(name),
        ),
      )
      .every((branch) => branch.activeThisWeek);

  return {
    ...stage,
    growthScore,
    rawGrowthScore: growthScore,
    gardenVisits: 0,
    persistentGrowth: false,
    stockCards,
    trainers,
    cardsFound,
    availableWishes,
    wishesSpent,
    valueShared,
    sharedCards: Math.max(0, stockCards - branchCards),
    cardsPlantedToday,
    wishesToday,
    latestActivityAt: latestActivity
      ? new Date(latestActivity).toISOString()
      : null,
    bothActiveThisWeek,
    branches,
    milestones: STAGES.slice(1).map((item) => ({
      score: item.score,
      label: item.label,
      reached: growthScore >= item.score,
    })),
  };
}


export function applyPersistentGrowth(
  snapshot: GrowthSnapshot,
  highWaterScore: number,
  gardenVisits: number,
): GrowthSnapshot {
  const safeHighWater = Math.max(
    snapshot.growthScore,
    Math.max(0, Math.round(highWaterScore)),
  );

  const stage = resolveGrowthStage(safeHighWater);

  return {
    ...snapshot,
    ...stage,
    growthScore: safeHighWater,
    rawGrowthScore: snapshot.growthScore,
    gardenVisits: Math.max(
      0,
      Math.round(gardenVisits),
    ),
    persistentGrowth: true,
    milestones: STAGES.slice(1).map((item) => ({
      score: item.score,
      label: item.label,
      reached: safeHighWater >= item.score,
    })),
  };
}
