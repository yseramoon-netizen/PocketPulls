export type NebulaRankKey =
  | "seed"
  | "dust"
  | "ember"
  | "luminous"
  | "nursery"
  | "grand"
  | "ancient"
  | "expanse"
  | "eternal";

export type NebulaRank = {
  key: NebulaRankKey;
  name: string;
  epithet: string;
  minimumMass: number;
  primary: string;
  secondary: string;
  core: string;
};

export const NEBULA_RANKS: readonly NebulaRank[] = [
  {
    key: "seed",
    name: "Nebula Seed",
    epithet: "The first light gathers",
    minimumMass: 0,
    primary: "#93c5fd",
    secondary: "#818cf8",
    core: "#f8fafc",
  },
  {
    key: "dust",
    name: "Dust Veil",
    epithet: "A shape appears in the dark",
    minimumMass: 500,
    primary: "#c4b5fd",
    secondary: "#64748b",
    core: "#ede9fe",
  },
  {
    key: "ember",
    name: "Ember Cloud",
    epithet: "New stars begin to burn",
    minimumMass: 2_500,
    primary: "#fb923c",
    secondary: "#f472b6",
    core: "#fff7ed",
  },
  {
    key: "luminous",
    name: "Luminous Nebula",
    epithet: "Visible across the Atlas",
    minimumMass: 10_000,
    primary: "#67e8f9",
    secondary: "#60a5fa",
    core: "#ecfeff",
  },
  {
    key: "nursery",
    name: "Stellar Nursery",
    epithet: "A birthplace of constellations",
    minimumMass: 30_000,
    primary: "#5eead4",
    secondary: "#a78bfa",
    core: "#f0fdfa",
  },
  {
    key: "grand",
    name: "Grand Nebula",
    epithet: "A formation of rare magnitude",
    minimumMass: 90_000,
    primary: "#d8b4fe",
    secondary: "#f472b6",
    core: "#fdf4ff",
  },
  {
    key: "ancient",
    name: "Ancient Nebula",
    epithet: "Its light has become legend",
    minimumMass: 250_000,
    primary: "#fde68a",
    secondary: "#a78bfa",
    core: "#fffbeb",
  },
  {
    key: "expanse",
    name: "Celestial Expanse",
    epithet: "Too vast for a single constellation",
    minimumMass: 750_000,
    primary: "#a5f3fc",
    secondary: "#e879f9",
    core: "#ffffff",
  },
  {
    key: "eternal",
    name: "Eternal Nebula",
    epithet: "A permanent light in Ancient Pulls",
    minimumMass: 2_000_000,
    primary: "#fff7c2",
    secondary: "#67e8f9",
    core: "#ffffff",
  },
] as const;

export const PRIME_NEBULA_NAME = "Prime Nebula";

export type NebulaProgress = {
  rank: NebulaRank;
  nextRank: NebulaRank | null;
  progress: number;
  massRemaining: number;
};

export function getNebulaRank(mass: number): NebulaRank {
  const safeMass = Math.max(0, Math.floor(Number(mass) || 0));

  for (let index = NEBULA_RANKS.length - 1; index >= 0; index -= 1) {
    const rank = NEBULA_RANKS[index];
    if (safeMass >= rank.minimumMass) return rank;
  }

  return NEBULA_RANKS[0];
}

export function getNebulaProgress(mass: number): NebulaProgress {
  const safeMass = Math.max(0, Math.floor(Number(mass) || 0));
  const rank = getNebulaRank(safeMass);
  const rankIndex = NEBULA_RANKS.findIndex((candidate) => candidate.key === rank.key);
  const nextRank = NEBULA_RANKS[rankIndex + 1] ?? null;

  if (!nextRank) {
    return {
      rank,
      nextRank: null,
      progress: 1,
      massRemaining: 0,
    };
  }

  const rankSpan = Math.max(1, nextRank.minimumMass - rank.minimumMass);
  const progress = Math.max(
    0,
    Math.min(1, (safeMass - rank.minimumMass) / rankSpan),
  );

  return {
    rank,
    nextRank,
    progress,
    massRemaining: Math.max(0, nextRank.minimumMass - safeMass),
  };
}

export function calculateNebulaMass(input: {
  collectionValue: number;
  totalCards: number;
  uniqueCards: number;
  lifetimeWishes: number;
}): number {
  return Math.max(
    0,
    Math.round(Math.max(0, Number(input.collectionValue) || 0) * 100) +
      Math.floor(Math.max(0, Number(input.totalCards) || 0)) * 25 +
      Math.floor(Math.max(0, Number(input.uniqueCards) || 0)) * 15 +
      Math.floor(Math.max(0, Number(input.lifetimeWishes) || 0)) * 10,
  );
}

export function getRelativeNebulaScale(mass: number, largestMass: number): number {
  const safeMass = Math.max(0, Number(mass) || 0);
  const safeLargest = Math.max(1, Number(largestMass) || 1);
  return Math.max(0.46, Math.min(1, 0.38 + Math.sqrt(safeMass / safeLargest) * 0.62));
}
