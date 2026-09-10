export type BinderTheme = {
  key: string;
  label: string;
  imageUrl: string | null;
  coverBase: string;
  coverAccent: string;
  pageBase: string;
  pageGlow: string;
  spineBase: string;
  ring: string;
};

export const BINDER_THEMES: BinderTheme[] = [
  {
    key: "classic",
    label: "Classic Leather",
    imageUrl: null,
    coverBase: "#351b22",
    coverAccent: "#6b3743",
    pageBase: "#1a2133",
    pageGlow: "rgba(236, 218, 195, 0.06)",
    spineBase: "#321820",
    ring: "#b7b8bc",
  },
  {
    key: "midnight",
    label: "Midnight",
    imageUrl: null,
    coverBase: "#11172d",
    coverAccent: "#293965",
    pageBase: "#11182b",
    pageGlow: "rgba(128, 160, 255, 0.08)",
    spineBase: "#12182b",
    ring: "#b8c6e6",
  },
  {
    key: "ancient",
    label: "Ancient Gold",
    imageUrl: null,
    coverBase: "#3a2613",
    coverAccent: "#8c6429",
    pageBase: "#2a2118",
    pageGlow: "rgba(245, 196, 93, 0.08)",
    spineBase: "#332311",
    ring: "#d6b36a",
  },
  {
    key: "arcane",
    label: "Arcane",
    imageUrl: null,
    coverBase: "#2d174b",
    coverAccent: "#8b5bc5",
    pageBase: "#1f1834",
    pageGlow: "rgba(191, 134, 255, 0.09)",
    spineBase: "#27143d",
    ring: "#d3b6ea",
  },
  {
    key: "frostbite",
    label: "Frostbite",
    imageUrl: null,
    coverBase: "#1c5573",
    coverAccent: "#83d7ff",
    pageBase: "#17314a",
    pageGlow: "rgba(167, 229, 255, 0.12)",
    spineBase: "#17354d",
    ring: "#d7f4ff",
  },
  {
    key: "sunset",
    label: "Sunset",
    imageUrl: null,
    coverBase: "#6a2d1e",
    coverAccent: "#f28d56",
    pageBase: "#3a211f",
    pageGlow: "rgba(255, 144, 90, 0.1)",
    spineBase: "#4b241b",
    ring: "#e7bd9b",
  },
  {
    key: "shadow",
    label: "Shadow",
    imageUrl: null,
    coverBase: "#1e171c",
    coverAccent: "#8f302d",
    pageBase: "#211a25",
    pageGlow: "rgba(220, 76, 73, 0.08)",
    spineBase: "#1d1318",
    ring: "#b06e6c",
  },
  {
    key: "forest",
    label: "Forest",
    imageUrl: null,
    coverBase: "#26351b",
    coverAccent: "#668b42",
    pageBase: "#1d2a20",
    pageGlow: "rgba(144, 205, 103, 0.09)",
    spineBase: "#233019",
    ring: "#b7c79c",
  },
];

export const BINDER_THEME_KEYS = BINDER_THEMES.map((theme) => theme.key);

export function getBinderTheme(key: string | null | undefined): BinderTheme {
  return (
    BINDER_THEMES.find((theme) => theme.key === key) ||
    BINDER_THEMES[0]
  );
}

export function formatTrainerCode(userId: string): string {
  const compact = userId.replace(/-/g, "").toUpperCase();

  if (compact.length < 12) {
    return "UP-TRAINER";
  }

  return `UP-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
}
