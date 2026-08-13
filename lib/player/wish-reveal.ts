export type WishRevealFamily =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type WishRevealConfig = {
  key:
    | "common"
    | "uncommon"
    | "rare"
    | "doubleRare"
    | "ultraRare"
    | "illustrationRare"
    | "specialIllustrationRare"
    | "hyperRare"
    | "crownRare"
    | "blackHole";
  label: string;
  omen: string;
  tier: number;
  family: WishRevealFamily;
  primary: string;
  secondary: string;
  glow: string;
  timings: {
    impactAtMs: number;
    cardAtMs: number;
    infoAtMs: number;
    durationMs: number;
    skipAfterMs: number | null;
  };
  particles: {
    desktop: number;
    mobile: number;
    lowEffects: number;
  };
  rayCount: number;
  glyphCount: number;
  impactScale: number;
  shakeDistance: number;
  flashStrength: number;
  usesWorldScene: boolean;
  blackHole: boolean;
};

type RevealSeed = Omit<WishRevealConfig, "key" | "blackHole">;

const REVEALS: Record<Exclude<WishRevealConfig["key"], "blackHole">, RevealSeed> = {
  common: {
    label: "Common",
    omen: "A quiet star answers",
    tier: 1,
    family: "common",
    primary: "#e2e8f0",
    secondary: "#94a3b8",
    glow: "rgba(226,232,240,0.7)",
    timings: { impactAtMs: 360, cardAtMs: 480, infoAtMs: 760, durationMs: 1080, skipAfterMs: null },
    particles: { desktop: 12, mobile: 8, lowEffects: 5 },
    rayCount: 6,
    glyphCount: 0,
    impactScale: 3.7,
    shakeDistance: 0,
    flashStrength: 0.3,
    usesWorldScene: true,
  },
  uncommon: {
    label: "Uncommon",
    omen: "The relic begins to glow",
    tier: 2,
    family: "uncommon",
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.78)",
    timings: { impactAtMs: 760, cardAtMs: 900, infoAtMs: 1220, durationMs: 1540, skipAfterMs: null },
    particles: { desktop: 18, mobile: 12, lowEffects: 7 },
    rayCount: 8,
    glyphCount: 3,
    impactScale: 4.7,
    shakeDistance: 1,
    flashStrength: 0.44,
    usesWorldScene: true,
  },
  rare: {
    label: "Rare",
    omen: "The constellation is listening",
    tier: 3,
    family: "rare",
    primary: "#7dd3fc",
    secondary: "#2563eb",
    glow: "rgba(125,211,252,0.86)",
    timings: { impactAtMs: 1900, cardAtMs: 2090, infoAtMs: 2500, durationMs: 2940, skipAfterMs: 1180 },
    particles: { desktop: 28, mobile: 18, lowEffects: 10 },
    rayCount: 13,
    glyphCount: 5,
    impactScale: 6.2,
    shakeDistance: 3,
    flashStrength: 0.66,
    usesWorldScene: true,
  },
  doubleRare: {
    label: "Double Rare",
    omen: "Two ancient lights converge",
    tier: 4,
    family: "epic",
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    glow: "rgba(196,181,253,0.9)",
    timings: { impactAtMs: 2700, cardAtMs: 2920, infoAtMs: 3400, durationMs: 3900, skipAfterMs: 1550 },
    particles: { desktop: 36, mobile: 22, lowEffects: 12 },
    rayCount: 17,
    glyphCount: 7,
    impactScale: 7.5,
    shakeDistance: 5,
    flashStrength: 0.78,
    usesWorldScene: true,
  },
  ultraRare: {
    label: "Ultra Rare",
    omen: "A sealed chamber awakens",
    tier: 5,
    family: "epic",
    primary: "#fde68a",
    secondary: "#f59e0b",
    glow: "rgba(253,230,138,0.94)",
    timings: { impactAtMs: 3650, cardAtMs: 3920, infoAtMs: 4460, durationMs: 5000, skipAfterMs: 1900 },
    particles: { desktop: 44, mobile: 26, lowEffects: 14 },
    rayCount: 21,
    glyphCount: 9,
    impactScale: 8.9,
    shakeDistance: 7,
    flashStrength: 0.88,
    usesWorldScene: true,
  },
  illustrationRare: {
    label: "Illustration Rare",
    omen: "The mural moves beneath the stars",
    tier: 6,
    family: "epic",
    primary: "#f9a8d4",
    secondary: "#a855f7",
    glow: "rgba(249,168,212,0.94)",
    timings: { impactAtMs: 4050, cardAtMs: 4340, infoAtMs: 4900, durationMs: 5480, skipAfterMs: 2050 },
    particles: { desktop: 48, mobile: 28, lowEffects: 15 },
    rayCount: 23,
    glyphCount: 10,
    impactScale: 9.5,
    shakeDistance: 7,
    flashStrength: 0.9,
    usesWorldScene: true,
  },
  specialIllustrationRare: {
    label: "Special Illustration Rare",
    omen: "The heavens have chosen this relic",
    tier: 7,
    family: "legendary",
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    glow: "rgba(103,232,249,0.98)",
    timings: { impactAtMs: 5250, cardAtMs: 5580, infoAtMs: 6240, durationMs: 6900, skipAfterMs: 2450 },
    particles: { desktop: 58, mobile: 32, lowEffects: 17 },
    rayCount: 28,
    glyphCount: 12,
    impactScale: 10.8,
    shakeDistance: 9,
    flashStrength: 0.96,
    usesWorldScene: true,
  },
  hyperRare: {
    label: "Hyper Rare",
    omen: "The solar crown descends",
    tier: 8,
    family: "legendary",
    primary: "#fef08a",
    secondary: "#f59e0b",
    glow: "rgba(250,204,21,1)",
    timings: { impactAtMs: 6250, cardAtMs: 6610, infoAtMs: 7330, durationMs: 8070, skipAfterMs: 2800 },
    particles: { desktop: 66, mobile: 36, lowEffects: 19 },
    rayCount: 32,
    glyphCount: 14,
    impactScale: 12,
    shakeDistance: 11,
    flashStrength: 1,
    usesWorldScene: true,
  },
  crownRare: {
    label: "Crown Rare",
    omen: "Every star falls silent",
    tier: 9,
    family: "legendary",
    primary: "#fffdf0",
    secondary: "#f5b83b",
    glow: "rgba(255,248,194,1)",
    timings: { impactAtMs: 7200, cardAtMs: 7600, infoAtMs: 8400, durationMs: 9200, skipAfterMs: 3150 },
    particles: { desktop: 74, mobile: 40, lowEffects: 21 },
    rayCount: 36,
    glyphCount: 16,
    impactScale: 13.2,
    shakeDistance: 13,
    flashStrength: 1,
    usesWorldScene: true,
  },
};

const BLACK_HOLE: WishRevealConfig = {
  ...REVEALS.crownRare,
  key: "blackHole",
  label: "Event Horizon Relic",
  omen: "The constellation has broken",
  blackHole: true,
  timings: { impactAtMs: 5400, cardAtMs: 7080, infoAtMs: 7800, durationMs: 8600, skipAfterMs: 2600 },
};

function normaliseRarity(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/pokemon/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function identifyRevealKey(
  rarity: string | null | undefined,
): Exclude<WishRevealConfig["key"], "blackHole"> {
  const value = normaliseRarity(rarity);

  if (value.includes("crown rare") || value.includes("masterpiece") || value.includes("god rare")) return "crownRare";
  if (value.includes("hyper rare") || value.includes("secret rare") || value.includes("gold rare") || value === "rare secret") return "hyperRare";
  if (value.includes("special illustration") || value.includes("special art") || value.includes("alternate art")) return "specialIllustrationRare";
  if (value.includes("illustration rare") || value.includes("trainer gallery") || value.includes("character rare")) return "illustrationRare";
  if (value.includes("ultra rare") || value.includes("full art") || value.includes("rainbow rare") || value.includes("ace spec") || value.includes("amazing rare")) return "ultraRare";
  if (value.includes("double rare") || value.includes("rare holo ex") || value.includes("rare holo gx") || value.includes("rare holo v") || value.includes("rare holo vmax") || value.includes("rare holo vstar")) return "doubleRare";
  if (value.includes("rare") || value.includes("holo") || value.includes("radiant")) return "rare";
  if (value.includes("uncommon")) return "uncommon";
  return "common";
}

export function getWishRevealConfig(
  rarity: string | null | undefined,
  marketValue?: number | null,
): WishRevealConfig {
  if (Number(marketValue) > 500) return BLACK_HOLE;

  const key = identifyRevealKey(rarity);
  return { ...REVEALS[key], key, blackHole: false };
}

export function getWishRevealParticleCount(
  config: WishRevealConfig,
  options: { mobile: boolean; lowEffects: boolean },
): number {
  if (options.lowEffects) return config.particles.lowEffects;
  return options.mobile ? config.particles.mobile : config.particles.desktop;
}
