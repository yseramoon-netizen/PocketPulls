export type NebuSceneKey =
  | "common"
  | "uncommon"
  | "rare"
  | "doubleRare"
  | "ultraRare"
  | "illustrationRare"
  | "specialIllustrationRare"
  | "hyperRare"
  | "crownRare";

export type NebuPerformance = {
  id: string;
  scene: NebuSceneKey;
  label: string;
  description: string;
  achievementKey: string | null;
  achievementTitle: string | null;
};

export type NebuPerformanceSelections = Record<NebuSceneKey, string>;

export const NEBU_PERFORMANCE_STORAGE_KEY =
  "pocketpulls:nebu-performances-v1";
export const NEBU_PERFORMANCE_CHANGE_EVENT =
  "pocketpulls:nebu-performances-changed";

export const NEBU_SCENE_LABELS: Record<NebuSceneKey, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  doubleRare: "Double Rare",
  ultraRare: "Ultra Rare",
  illustrationRare: "Illustration Rare",
  specialIllustrationRare: "Special Illustration Rare",
  hyperRare: "Hyper Rare",
  crownRare: "Crown Rare",
};

export const NEBU_PERFORMANCES: readonly NebuPerformance[] = [
  {
    id: "litter_bowl",
    scene: "common",
    label: "Celestial Litter Bowl",
    description: "A dignified visit to the sand bowl ends with a very undignified card reveal.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "sand_sneeze",
    scene: "common",
    label: "Sneeze of Ra",
    description: "One enormous sneeze uncovers the card beneath the desert sand.",
    achievementKey: "first_wish",
    achievementTitle: "First Light",
  },
  {
    id: "box_destiny",
    scene: "common",
    label: "Box of Destiny",
    description: "Nebu squeezes into a sacred box that is obviously much too small.",
    achievementKey: "wish_apprentice",
    achievementTitle: "Wish Apprentice",
  },
  {
    id: "balloon_incident",
    scene: "uncommon",
    label: "The Balloon Incident",
    description: "A golden balloon, one perfect swipe and a completely innocent-looking Nebu.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "papyrus_mouse",
    scene: "uncommon",
    label: "Papyrus Mouse",
    description: "An enchanted paper mouse unfolds into the card at the final pounce.",
    achievementKey: "unique_10",
    achievementTitle: "Ten Different Stars",
  },
  {
    id: "golden_yarn",
    scene: "rare",
    label: "Golden Yarn Chase",
    description: "Golden thread draws a constellation while Nebu gives chase.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "moon_moth",
    scene: "rare",
    label: "Moon Moth",
    description: "A luminous moth leads Nebu through the stars and becomes the reveal frame.",
    achievementKey: "rare_first",
    achievementTitle: "A Different Glow",
  },
  {
    id: "bath_bird",
    scene: "doubleRare",
    label: "Bath Time Interrupted",
    description: "A passing temple bird interrupts Nebu at the least convenient moment.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "temple_domino",
    scene: "doubleRare",
    label: "Temple Dominoes",
    description: "One careless paw starts a sacred and increasingly ridiculous chain reaction.",
    achievementKey: "streak_3",
    achievementTitle: "Three Nights",
  },
  {
    id: "sunbeam_vault",
    scene: "ultraRare",
    label: "Sunbeam Vault",
    description: "Mirrors, runes and Nebu's tail accidentally unlock an ancient chamber.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "balance_heart",
    scene: "ultraRare",
    label: "Balance of the Heart",
    description: "Nebu places one paw on the scales and the temple makes its judgement.",
    achievementKey: "treasure_100",
    achievementTitle: "Vault of Starlight",
  },
  {
    id: "living_mural",
    scene: "illustrationRare",
    label: "The Living Mural",
    description: "Nebu steps into a painted world and leaves a constellation in his wake.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "papyrus_theatre",
    scene: "illustrationRare",
    label: "Papyrus Theatre",
    description: "A tiny shadow play folds its final curtain into the card.",
    achievementKey: "streak_7",
    achievementTitle: "Week of Wishes",
  },
  {
    id: "catnip_star",
    scene: "specialIllustrationRare",
    label: "The Catnip Star",
    description: "A golden star appears in Nebu's eye before revealing its much sillier secret.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "sky_mirror",
    scene: "specialIllustrationRare",
    label: "Sky Mirror",
    description: "Nebu touches the reflected night and falls upward into the constellation.",
    achievementKey: "constellation_keeper",
    achievementTitle: "Constellation Keeper",
  },
  {
    id: "solar_heist",
    scene: "hyperRare",
    label: "Solar Barque Heist",
    description: "Nebu steals the sun and quietly replaces it with a ball of yarn.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "eclipse_thief",
    scene: "hyperRare",
    label: "Eclipse Thief",
    description: "Nebu pulls the darkness away from an eclipse like a loose piece of cloth.",
    achievementKey: "rare_twenty",
    achievementTitle: "Rare Constellation",
  },
  {
    id: "constellation_chooses",
    scene: "crownRare",
    label: "The Constellation Chooses You",
    description: "Nebu becomes a constellation and carries the final star back to the player.",
    achievementKey: null,
    achievementTitle: null,
  },
  {
    id: "hall_eight",
    scene: "crownRare",
    label: "Hall of Eight Doors",
    description: "Every earlier rarity chamber opens before Nebu reaches the final crown.",
    achievementKey: "wish_legend",
    achievementTitle: "Starbound Legend",
  },
];

export const DEFAULT_NEBU_PERFORMANCES: NebuPerformanceSelections = {
  common: "litter_bowl",
  uncommon: "balloon_incident",
  rare: "golden_yarn",
  doubleRare: "bath_bird",
  ultraRare: "sunbeam_vault",
  illustrationRare: "living_mural",
  specialIllustrationRare: "catnip_star",
  hyperRare: "solar_heist",
  crownRare: "constellation_chooses",
};

export function getPerformancesForScene(
  scene: NebuSceneKey,
): NebuPerformance[] {
  return NEBU_PERFORMANCES.filter((performance) => performance.scene === scene);
}

export function getNebuPerformance(
  scene: NebuSceneKey,
  performanceId: string | null | undefined,
): NebuPerformance {
  return (
    NEBU_PERFORMANCES.find(
      (performance) =>
        performance.scene === scene && performance.id === performanceId,
    ) ||
    NEBU_PERFORMANCES.find(
      (performance) =>
        performance.scene === scene &&
        performance.id === DEFAULT_NEBU_PERFORMANCES[scene],
    )!
  );
}

export function normaliseNebuPerformances(
  value: unknown,
): NebuPerformanceSelections {
  const row =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return (Object.keys(DEFAULT_NEBU_PERFORMANCES) as NebuSceneKey[]).reduce(
    (result, scene) => {
      const requested = typeof row[scene] === "string" ? row[scene] : null;
      result[scene] = getNebuPerformance(scene, requested).id;
      return result;
    },
    { ...DEFAULT_NEBU_PERFORMANCES },
  );
}

export function readNebuPerformances(): NebuPerformanceSelections {
  if (typeof window === "undefined") {
    return { ...DEFAULT_NEBU_PERFORMANCES };
  }

  try {
    const stored = window.localStorage.getItem(NEBU_PERFORMANCE_STORAGE_KEY);
    return stored
      ? normaliseNebuPerformances(JSON.parse(stored))
      : { ...DEFAULT_NEBU_PERFORMANCES };
  } catch {
    return { ...DEFAULT_NEBU_PERFORMANCES };
  }
}

export function readNebuPerformancesFromMetadata(
  value: unknown,
): NebuPerformanceSelections | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return normaliseNebuPerformances(value);
}

export function applyNebuPerformances(
  selections: NebuPerformanceSelections,
  options: { announce?: boolean } = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalised = normaliseNebuPerformances(selections);

  try {
    window.localStorage.setItem(
      NEBU_PERFORMANCE_STORAGE_KEY,
      JSON.stringify(normalised),
    );
  } catch {
    // The animation selection still works until the page is refreshed.
  }

  if (options.announce !== false) {
    window.dispatchEvent(
      new CustomEvent<NebuPerformanceSelections>(
        NEBU_PERFORMANCE_CHANGE_EVENT,
        { detail: normalised },
      ),
    );
  }
}
