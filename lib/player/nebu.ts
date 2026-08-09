export type NebuSkinKey =
  | "midnight"
  | "nile"
  | "lotus"
  | "scarab"
  | "sunstone"
  | "royal"
  | "pearl"
  | "sherry"
  | "bubbles";

export type NebuExclusiveOwner = "sherry" | "bubbles";

export type NebuHeatAssets = {
  portrait: string;
  walkSheet: string;
  reactionSheet: string;
};

export type NebuSkin = {
  key: NebuSkinKey;
  label: string;
  palette: string;
  swatch: string;
  achievementKey: string | null;
  achievementTitle: string | null;
  exclusiveOwner: NebuExclusiveOwner | null;
  heatAssets: NebuHeatAssets | null;
};

export const NEBU_SKIN_STORAGE_KEY = "pocketpulls:nebu-skin-v1";
export const NEBU_SKIN_CHANGE_EVENT = "pocketpulls:nebu-skin-changed";
export const DEFAULT_NEBU_SKIN: NebuSkinKey = "midnight";

export const NEBU_SKINS: readonly NebuSkin[] = [
  {
    key: "midnight",
    label: "Midnight Gold",
    palette: "Navy · gold · turquoise",
    swatch: "linear-gradient(135deg, #172a5b 0 48%, #f2b638 48% 76%, #45d7c8 76%)",
    achievementKey: null,
    achievementTitle: null,
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "nile",
    label: "Nile Dawn",
    palette: "Turquoise · rose · starlight",
    swatch: "linear-gradient(135deg, #0b7f91 0 48%, #f08aa4 48% 76%, #b9fff4 76%)",
    achievementKey: "first_wish",
    achievementTitle: "First Light",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "lotus",
    label: "Lotus Bloom",
    palette: "Rose · violet · emerald",
    swatch: "linear-gradient(135deg, #b52f76 0 48%, #7b51d9 48% 76%, #65e0a3 76%)",
    achievementKey: "collector_25",
    achievementTitle: "Growing Binder",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "scarab",
    label: "Scarab Glow",
    palette: "Emerald · cyan · ruby",
    swatch: "linear-gradient(135deg, #087d69 0 48%, #55ead8 48% 76%, #f05d74 76%)",
    achievementKey: "rare_first",
    achievementTitle: "A Different Glow",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "sunstone",
    label: "Sunstone",
    palette: "Amber · copper · cream",
    swatch: "linear-gradient(135deg, #9d471f 0 48%, #ffb52f 48% 76%, #fff1b8 76%)",
    achievementKey: "streak_7",
    achievementTitle: "Week of Wishes",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "royal",
    label: "Royal Night",
    palette: "Amethyst · indigo · jade",
    swatch: "linear-gradient(135deg, #4e278f 0 48%, #8a69ef 48% 76%, #9ee9b4 76%)",
    achievementKey: "constellation_keeper",
    achievementTitle: "Constellation Keeper",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "pearl",
    label: "Celestial Pearl",
    palette: "Silver · moonlight · ice",
    swatch: "linear-gradient(135deg, #77839e 0 48%, #eef2ff 48% 76%, #a5f3fc 76%)",
    achievementKey: "rare_twenty",
    achievementTitle: "Rare Constellation",
    exclusiveOwner: null,
    heatAssets: null,
  },
  {
    key: "sherry",
    label: "Sherry",
    palette: "Black coat · deep green eyes",
    swatch: "linear-gradient(135deg, #070a09 0 58%, #0d5f35 58% 78%, #e8b338 78%)",
    achievementKey: null,
    achievementTitle: null,
    exclusiveOwner: "sherry",
    heatAssets: {
      portrait: "/ancient-pulls/skins/sherry/portrait.webp",
      walkSheet: "/ancient-pulls/skins/sherry/pyramid-exit.webp",
      reactionSheet: "/ancient-pulls/skins/sherry/heat-reactions.webp",
    },
  },
  {
    key: "bubbles",
    label: "Bubbles",
    palette: "Pearl-white coat · bright blue eyes",
    swatch: "linear-gradient(135deg, #f8fbff 0 58%, #21b7ff 58% 78%, #e8b338 78%)",
    achievementKey: null,
    achievementTitle: null,
    exclusiveOwner: "bubbles",
    heatAssets: {
      portrait: "/ancient-pulls/skins/bubbles/portrait.webp",
      walkSheet: "/ancient-pulls/skins/bubbles/pyramid-exit.webp",
      reactionSheet: "/ancient-pulls/skins/bubbles/heat-reactions.webp",
    },
  },
];

const DEFAULT_NEBU_HEAT_ASSETS: NebuHeatAssets = {
  portrait: "/ancient-pulls/celestial-cat.png",
  walkSheet: "/ancient-pulls/scene/nebu-pyramid-exit-v1.png",
  reactionSheet: "/ancient-pulls/scene/nebu-heat-reactions-v1.png",
};

const NEBU_SKIN_KEYS = new Set<NebuSkinKey>(
  NEBU_SKINS.map((skin) => skin.key),
);

export function isNebuSkinKey(value: unknown): value is NebuSkinKey {
  return typeof value === "string" && NEBU_SKIN_KEYS.has(value as NebuSkinKey);
}

export function getNebuSkin(key: NebuSkinKey): NebuSkin {
  return NEBU_SKINS.find((skin) => skin.key === key) || NEBU_SKINS[0];
}

export function isExclusiveNebuSkin(key: NebuSkinKey): boolean {
  return Boolean(getNebuSkin(key).exclusiveOwner);
}

export function canUseNebuSkin(
  key: NebuSkinKey,
  exclusiveSkins: Iterable<NebuSkinKey>,
): boolean {
  const skin = getNebuSkin(key);

  if (!skin.exclusiveOwner) {
    return true;
  }

  return new Set(exclusiveSkins).has(key);
}

export function getNebuHeatAssets(key: NebuSkinKey): NebuHeatAssets {
  return getNebuSkin(key).heatAssets || DEFAULT_NEBU_HEAT_ASSETS;
}

export function readNebuSkin(): NebuSkinKey {
  if (typeof window === "undefined") {
    return DEFAULT_NEBU_SKIN;
  }

  try {
    const stored = window.localStorage.getItem(NEBU_SKIN_STORAGE_KEY);
    return isNebuSkinKey(stored) ? stored : DEFAULT_NEBU_SKIN;
  } catch {
    return DEFAULT_NEBU_SKIN;
  }
}

export function readNebuSkinFromMetadata(value: unknown): NebuSkinKey | null {
  return isNebuSkinKey(value) ? value : null;
}

export function applyNebuSkin(
  key: NebuSkinKey,
  options: { persist?: boolean; announce?: boolean } = {},
): void {
  if (typeof document === "undefined") {
    return;
  }

  const { persist = true, announce = true } = options;
  document.documentElement.dataset.nebuSkin = key;

  if (persist) {
    try {
      window.localStorage.setItem(NEBU_SKIN_STORAGE_KEY, key);
    } catch {
      // The colour still applies for this page when storage is unavailable.
    }
  }

  if (announce) {
    window.dispatchEvent(
      new CustomEvent(NEBU_SKIN_CHANGE_EVENT, { detail: { key } }),
    );
  }
}
