export type PlayerRarityTheme = {
  label: string;
  rank: number;
  primary: string;
  secondary: string;
  glow: string;
  background: string;
};

const THEMES: Record<string, PlayerRarityTheme> = {
  common: {
    label: "Common",
    rank: 1,
    primary: "#e2e8f0",
    secondary: "#94a3b8",
    glow: "rgba(226,232,240,0.66)",
    background: "rgba(226,232,240,0.07)",
  },
  uncommon: {
    label: "Uncommon",
    rank: 2,
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.76)",
    background: "rgba(34,197,94,0.09)",
  },
  rare: {
    label: "Rare",
    rank: 3,
    primary: "#7dd3fc",
    secondary: "#2563eb",
    glow: "rgba(125,211,252,0.82)",
    background: "rgba(37,99,235,0.1)",
  },
  doubleRare: {
    label: "Double Rare",
    rank: 4,
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    glow: "rgba(196,181,253,0.86)",
    background: "rgba(124,58,237,0.11)",
  },
  ultraRare: {
    label: "Ultra Rare",
    rank: 5,
    primary: "#fde68a",
    secondary: "#f59e0b",
    glow: "rgba(253,230,138,0.9)",
    background: "rgba(245,158,11,0.12)",
  },
  illustrationRare: {
    label: "Illustration Rare",
    rank: 5,
    primary: "#f9a8d4",
    secondary: "#a855f7",
    glow: "rgba(249,168,212,0.9)",
    background: "rgba(168,85,247,0.12)",
  },
  specialIllustrationRare: {
    label: "Special Illustration Rare",
    rank: 6,
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    glow: "rgba(103,232,249,0.94)",
    background: "rgba(34,211,238,0.13)",
  },
  hyperRare: {
    label: "Hyper Rare",
    rank: 7,
    primary: "#fef08a",
    secondary: "#f59e0b",
    glow: "rgba(250,204,21,0.96)",
    background: "rgba(250,204,21,0.13)",
  },
};

function normalise(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/pokemon/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getPlayerRarityTheme(
  rarity: string | null | undefined,
): PlayerRarityTheme {
  const value = normalise(rarity);

  if (
    value.includes("hyper rare") ||
    value.includes("secret rare") ||
    value.includes("gold rare") ||
    value.includes("crown rare") ||
    value.includes("masterpiece")
  ) {
    return THEMES.hyperRare;
  }

  if (
    value.includes("special illustration") ||
    value.includes("special art") ||
    value.includes("alternate art")
  ) {
    return THEMES.specialIllustrationRare;
  }

  if (
    value.includes("illustration rare") ||
    value.includes("trainer gallery") ||
    value.includes("character rare")
  ) {
    return THEMES.illustrationRare;
  }

  if (
    value.includes("ultra rare") ||
    value.includes("full art") ||
    value.includes("rainbow rare") ||
    value.includes("ace spec") ||
    value.includes("amazing rare")
  ) {
    return THEMES.ultraRare;
  }

  if (
    value.includes("double rare") ||
    value.includes("rare holo ex") ||
    value.includes("rare holo gx") ||
    value.includes("rare holo v") ||
    value.includes("rare holo vmax") ||
    value.includes("rare holo vstar")
  ) {
    return THEMES.doubleRare;
  }

  if (
    value.includes("rare") ||
    value.includes("holo") ||
    value.includes("radiant")
  ) {
    return THEMES.rare;
  }

  if (value.includes("uncommon")) {
    return THEMES.uncommon;
  }

  return THEMES.common;
}
