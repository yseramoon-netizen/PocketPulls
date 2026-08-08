"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import UnownText from "@/components/player/UnownText";
import { supabase } from "@/lib/supabase";

type WishRow = {
  id: string | number;
  card_id: string | number | null;
  market_value_at_wish: number | string | null;
  created_at: string | null;
};

type CardRow = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
};

type ConstellationStar = {
  id: string;
  cardId: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  marketValue: number;
  imageUrl: string | null;
  grantedAt: string | null;
  x: number;
  y: number;
  size: number;
  colour: string;
  glow: string;
  delay: number;
  zodiacAnchor?: boolean;
};


type FriendRow = {
  other_user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  relationship_status: string | null;
  direction: string | null;
};

type FriendStar = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  x: number;
  y: number;
  delay: number;
};

type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

type ZodiacPoint = { x: number; y: number };
type ZodiacShape = {
  label: string;
  points: ZodiacPoint[];
  segments: Array<[number, number]>;
};

const ZODIAC_SHAPES: Record<ZodiacSign, ZodiacShape> = {
  aries: {
    label: "Aries",
    points: [
      { x: 60.5, y: 16.0 },
      { x: 17.5, y: 20.6 },
      { x: 80.6, y: 60.0 },
      { x: 82.5, y: 78.1 },
      { x: 79.0, y: 84.0 },
    ],
    segments: [
      [0, 1], [0, 2], [2, 3], [3, 4],
    ],
  },
  taurus: {
    label: "Taurus",
    points: [
      { x: 28.8, y: 20.1 },
      { x: 16.0, y: 32.8 },
      { x: 49.5, y: 42.9 },
      { x: 53.1, y: 49.8 },
      { x: 44.8, y: 52.1 },
      { x: 49.9, y: 55.2 },
      { x: 55.2, y: 57.3 },
      { x: 63.9, y: 67.0 },
      { x: 82.2, y: 76.4 },
      { x: 84.0, y: 79.9 },
    ],
    segments: [
      [0, 2], [1, 4], [2, 3], [3, 6],
      [4, 5], [5, 6], [6, 7], [7, 8],
      [8, 9],
    ],
  },
  gemini: {
    label: "Gemini",
    points: [
      { x: 51.3, y: 23.3 },
      { x: 24.3, y: 28.9 },
      { x: 39.5, y: 34.5 },
      { x: 16.0, y: 40.1 },
      { x: 29.3, y: 41.8 },
      { x: 22.2, y: 44.0 },
      { x: 58.0, y: 50.0 },
      { x: 16.0, y: 51.7 },
      { x: 84.0, y: 53.6 },
      { x: 73.2, y: 57.5 },
      { x: 78.6, y: 57.2 },
      { x: 32.8, y: 59.9 },
      { x: 44.0, y: 63.9 },
      { x: 69.1, y: 64.6 },
      { x: 33.3, y: 76.0 },
      { x: 63.3, y: 76.7 },
    ],
    segments: [
      [0, 2], [1, 2], [2, 4], [2, 6],
      [3, 5], [4, 5], [5, 7], [5, 11],
      [6, 9], [6, 13], [8, 10], [9, 10],
      [11, 12], [11, 14], [12, 15],
    ],
  },
  cancer: {
    label: "Cancer",
    points: [
      { x: 48.6, y: 16.0 },
      { x: 50.4, y: 45.5 },
      { x: 48.7, y: 58.8 },
      { x: 65.3, y: 81.7 },
      { x: 34.7, y: 84.0 },
    ],
    segments: [
      [0, 1], [1, 2], [2, 3], [2, 4],
    ],
  },
  leo: {
    label: "Leo",
    points: [
      { x: 79.4, y: 27.5 },
      { x: 84.0, y: 33.1 },
      { x: 68.7, y: 38.5 },
      { x: 69.5, y: 49.3 },
      { x: 37.1, y: 52.7 },
      { x: 76.5, y: 56.7 },
      { x: 37.9, y: 68.7 },
      { x: 77.8, y: 70.3 },
      { x: 16.0, y: 72.5 },
    ],
    segments: [
      [0, 1], [0, 2], [2, 3], [3, 4],
      [3, 5], [4, 8], [5, 7], [6, 7],
      [6, 8],
    ],
  },
  virgo: {
    label: "Virgo",
    points: [
      { x: 48.4, y: 16.0 },
      { x: 53.9, y: 35.8 },
      { x: 43.5, y: 41.0 },
      { x: 28.3, y: 42.4 },
      { x: 61.7, y: 47.0 },
      { x: 71.7, y: 53.0 },
      { x: 50.4, y: 55.9 },
      { x: 45.5, y: 65.7 },
      { x: 70.8, y: 69.7 },
      { x: 60.2, y: 72.6 },
      { x: 60.2, y: 79.0 },
      { x: 43.5, y: 82.3 },
      { x: 56.8, y: 84.0 },
    ],
    segments: [
      [0, 1], [1, 2], [1, 4], [2, 3],
      [2, 6], [4, 5], [5, 6], [5, 8],
      [6, 7], [7, 11], [8, 9], [9, 10],
      [10, 12],
    ],
  },
  libra: {
    label: "Libra",
    points: [
      { x: 43.7, y: 17.3 },
      { x: 16.0, y: 37.9 },
      { x: 73.4, y: 37.8 },
      { x: 45.8, y: 39.3 },
      { x: 32.7, y: 62.9 },
      { x: 79.0, y: 68.9 },
      { x: 78.5, y: 73.6 },
      { x: 84.0, y: 75.7 },
      { x: 37.4, y: 82.7 },
    ],
    segments: [
      [0, 1], [0, 2], [1, 3], [1, 4],
      [2, 3], [2, 5], [4, 8], [5, 6],
      [6, 7],
    ],
  },
  scorpio: {
    label: "Scorpio",
    points: [
      { x: 64.7, y: 16.0 },
      { x: 69.2, y: 22.3 },
      { x: 72.3, y: 31.0 },
      { x: 59.4, y: 31.9 },
      { x: 52.8, y: 40.4 },
      { x: 49.7, y: 56.6 },
      { x: 30.6, y: 69.4 },
      { x: 34.7, y: 70.2 },
      { x: 53.8, y: 73.7 },
      { x: 27.7, y: 76.7 },
      { x: 54.3, y: 77.7 },
      { x: 46.0, y: 80.4 },
      { x: 34.6, y: 84.0 },
    ],
    segments: [
      [0, 3], [1, 3], [2, 3], [3, 4],
      [4, 5], [5, 8], [6, 7], [6, 9],
      [8, 10], [9, 12], [10, 11], [11, 12],
    ],
  },
  sagittarius: {
    label: "Sagittarius",
    points: [
      { x: 68.3, y: 16.0 },
      { x: 30.2, y: 20.8 },
      { x: 33.1, y: 23.7 },
      { x: 37.7, y: 24.5 },
      { x: 41.4, y: 26.5 },
      { x: 60.6, y: 28.9 },
      { x: 79.7, y: 30.5 },
      { x: 48.5, y: 35.0 },
      { x: 53.4, y: 34.8 },
      { x: 65.6, y: 37.0 },
      { x: 72.9, y: 37.1 },
      { x: 43.9, y: 38.7 },
      { x: 47.7, y: 41.9 },
      { x: 66.8, y: 47.3 },
      { x: 20.3, y: 48.0 },
      { x: 71.5, y: 52.0 },
      { x: 26.9, y: 60.4 },
      { x: 28.9, y: 63.1 },
      { x: 45.9, y: 67.6 },
      { x: 34.9, y: 74.6 },
      { x: 50.4, y: 75.6 },
      { x: 32.0, y: 84.0 },
    ],
    segments: [
      [0, 5], [1, 2], [2, 3], [3, 4],
      [4, 11], [5, 8], [5, 9], [6, 10],
      [7, 8], [7, 11], [8, 12], [9, 10],
      [9, 13], [11, 12], [13, 15], [14, 16],
      [16, 17], [17, 19], [18, 19], [19, 20],
    ],
  },
  capricorn: {
    label: "Capricorn",
    points: [
      { x: 84.0, y: 17.1 },
      { x: 83.4, y: 25.0 },
      { x: 49.9, y: 40.4 },
      { x: 36.1, y: 42.8 },
      { x: 16.0, y: 46.2 },
      { x: 22.9, y: 46.2 },
      { x: 28.0, y: 54.0 },
      { x: 36.0, y: 58.6 },
      { x: 40.5, y: 60.3 },
      { x: 72.0, y: 62.0 },
      { x: 56.7, y: 64.6 },
      { x: 70.0, y: 67.6 },
      { x: 33.9, y: 82.9 },
    ],
    segments: [
      [0, 1], [1, 2], [1, 9], [2, 3],
      [3, 5], [4, 5], [4, 6], [6, 7],
      [7, 8], [8, 10], [9, 11], [10, 11],
    ],
  },
  aquarius: {
    label: "Aquarius",
    points: [
      { x: 27.6, y: 16.7 },
      { x: 50.5, y: 16.7 },
      { x: 53.9, y: 21.2 },
      { x: 61.0, y: 23.4 },
      { x: 35.2, y: 24.3 },
      { x: 49.5, y: 32.8 },
      { x: 31.2, y: 34.7 },
      { x: 26.1, y: 37.8 },
      { x: 69.7, y: 39.5 },
      { x: 16.0, y: 43.6 },
      { x: 48.1, y: 44.7 },
      { x: 84.0, y: 57.5 },
      { x: 37.0, y: 83.3 },
    ],
    segments: [
      [0, 1], [0, 4], [1, 2], [2, 3],
      [3, 5], [3, 8], [4, 6], [5, 10],
      [6, 7], [7, 9], [8, 11],
    ],
  },
  pisces: {
    label: "Pisces",
    points: [
      { x: 16.3, y: 17.6 },
      { x: 16.0, y: 23.1 },
      { x: 21.6, y: 27.5 },
      { x: 80.2, y: 27.6 },
      { x: 76.2, y: 28.2 },
      { x: 84.0, y: 29.6 },
      { x: 26.1, y: 32.3 },
      { x: 72.6, y: 32.6 },
      { x: 64.3, y: 35.7 },
      { x: 82.0, y: 35.7 },
      { x: 75.6, y: 38.5 },
      { x: 24.5, y: 45.0 },
      { x: 46.6, y: 46.4 },
      { x: 41.0, y: 49.3 },
      { x: 25.5, y: 56.9 },
      { x: 33.5, y: 57.6 },
      { x: 30.0, y: 61.3 },
      { x: 28.2, y: 67.1 },
      { x: 25.3, y: 69.6 },
      { x: 37.3, y: 82.4 },
    ],
    segments: [
      [0, 1], [1, 2], [2, 6], [3, 4],
      [3, 5], [4, 7], [5, 9], [6, 11],
      [7, 8], [7, 10], [8, 12], [9, 10],
      [11, 14], [12, 13], [13, 15], [14, 18],
      [15, 16], [16, 17], [17, 18],
    ],
  },
};
function parseZodiacSign(value: unknown): ZodiacSign | null {
  if (typeof value !== "string") return null;
  const sign = value.toLowerCase() as ZodiacSign;
  return sign in ZODIAC_SHAPES ? sign : null;
}

type RarityTheme = {
  colour: string;
  glow: string;
  rank: number;
};

const RARITY_THEMES: Record<string, RarityTheme> = {
  common: {
    colour: "#f8fafc",
    glow: "rgba(248,250,252,0.78)",
    rank: 1,
  },
  uncommon: {
    colour: "#86efac",
    glow: "rgba(74,222,128,0.86)",
    rank: 2,
  },
  rare: {
    colour: "#7dd3fc",
    glow: "rgba(56,189,248,0.9)",
    rank: 3,
  },
  doubleRare: {
    colour: "#c4b5fd",
    glow: "rgba(167,139,250,0.94)",
    rank: 4,
  },
  ultraRare: {
    colour: "#fde68a",
    glow: "rgba(251,191,36,0.96)",
    rank: 5,
  },
  illustrationRare: {
    colour: "#f9a8d4",
    glow: "rgba(232,121,249,0.96)",
    rank: 5,
  },
  specialIllustrationRare: {
    colour: "#67e8f9",
    glow: "rgba(244,114,182,1)",
    rank: 6,
  },
  hyperRare: {
    colour: "#fef08a",
    glow: "rgba(250,204,21,1)",
    rank: 7,
  },
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normaliseRarity(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/pokemon/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRarityTheme(
  rarity: string | null | undefined,
): RarityTheme {
  const value = normaliseRarity(rarity);

  if (
    value.includes("hyper rare") ||
    value.includes("secret rare") ||
    value.includes("gold rare") ||
    value.includes("crown rare")
  ) {
    return RARITY_THEMES.hyperRare;
  }

  if (
    value.includes("special illustration") ||
    value.includes("special art") ||
    value.includes("alternate art")
  ) {
    return RARITY_THEMES.specialIllustrationRare;
  }

  if (
    value.includes("illustration rare") ||
    value.includes("trainer gallery") ||
    value.includes("character rare")
  ) {
    return RARITY_THEMES.illustrationRare;
  }

  if (
    value.includes("ultra rare") ||
    value.includes("full art") ||
    value.includes("rainbow rare") ||
    value.includes("ace spec")
  ) {
    return RARITY_THEMES.ultraRare;
  }

  if (
    value.includes("double rare") ||
    value.includes("rare holo ex") ||
    value.includes("rare holo gx") ||
    value.includes("rare holo v") ||
    value.includes("rare holo vmax") ||
    value.includes("rare holo vstar")
  ) {
    return RARITY_THEMES.doubleRare;
  }

  if (
    value.includes("rare") ||
    value.includes("holo") ||
    value.includes("radiant")
  ) {
    return RARITY_THEMES.rare;
  }

  if (value.includes("uncommon")) {
    return RARITY_THEMES.uncommon;
  }

  return RARITY_THEMES.common;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStar(
  wish: WishRow,
  card: CardRow | undefined,
  index: number,
): ConstellationStar {
  const id = String(wish.id);
  const cardId = String(wish.card_id ?? card?.id ?? "");
  const rarity = card?.rarity?.trim() || "Common";
  const theme = getRarityTheme(rarity);
  const random = seededRandom(hashString(`${id}:${cardId}`));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle + random() * 0.55;
  const radius = Math.min(43, 9 + Math.sqrt(index + 1) * 7.3);

  const x = Math.max(
    7,
    Math.min(93, 50 + Math.cos(angle) * radius + (random() - 0.5) * 5),
  );

  const y = Math.max(
    8,
    Math.min(91, 49 + Math.sin(angle) * radius * 0.76 + (random() - 0.5) * 5),
  );

  const marketValue = Math.max(
    toNumber(wish.market_value_at_wish),
    toNumber(card?.market_value),
  );

  const valueBoost = Math.min(5, Math.log10(marketValue + 1) * 2.3);

  return {
    id,
    cardId,
    name: card?.name?.trim() || "Mystery card",
    setName: card?.set_name?.trim() || "Unknown set",
    cardNumber: card?.card_no?.trim() || null,
    rarity,
    marketValue,
    imageUrl: card?.image_url?.trim() || null,
    grantedAt: wish.created_at,
    x,
    y,
    size: 7 + theme.rank * 1.15 + valueBoost,
    colour: theme.colour,
    glow: theme.glow,
    delay: Math.min(1200, index * 35),
  };
}


function buildOrganicConstellationStars(
  wishes: WishRow[],
  cardMap: Map<string, CardRow>,
): ConstellationStar[] {
  const positioned: ConstellationStar[] = [];

  wishes.forEach((wish, index) => {
    const base = buildStar(
      wish,
      cardMap.get(String(wish.card_id ?? "")),
      index,
    );

    const random = seededRandom(hashString(`layout:${base.id}:${base.cardId}`));
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radiusBase = Math.min(42, 8 + Math.sqrt(index + 1) * 5.8);
    const minDistance = Math.max(1.9, Math.min(4.25, base.size * 0.2 + 1.15));

    let best = {
      x: base.x,
      y: base.y,
      score: -1,
    };

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const angle =
        index * goldenAngle +
        random() * 0.6 +
        attempt * 0.52;
      const radius = Math.min(
        43,
        Math.max(7, radiusBase + ((attempt % 5) - 2) * 1.7),
      );
      const x = Math.max(
        8,
        Math.min(92, 50 + Math.cos(angle) * radius + (random() - 0.5) * 2.8),
      );
      const y = Math.max(
        9,
        Math.min(90, 49 + Math.sin(angle) * radius * 0.72 + (random() - 0.5) * 2.8),
      );

      let nearest = Number.POSITIVE_INFINITY;
      for (const placed of positioned.slice(-360)) {
        const distance = Math.hypot(x - placed.x, y - placed.y);
        nearest = Math.min(nearest, distance);
      }

      if (!Number.isFinite(nearest)) nearest = 999;

      if (nearest > best.score) best = { x, y, score: nearest };

      if (nearest >= minDistance) {
        best = { x, y, score: nearest };
        break;
      }
    }

    positioned.push({
      ...base,
      x: best.x,
      y: best.y,
      size: Math.min(16.5, Math.max(6.5, base.size)),
    });
  });

  return positioned;
}

function getZodiacAnchorPriority(shape: ZodiacShape): number[] {
  const degree = shape.points.map(() => 0);

  shape.segments.forEach(([from, to]) => {
    degree[from] += 1;
    degree[to] += 1;
  });

  return shape.points
    .map((point, index) => ({
      index,
      degree: degree[index],
      centreDistance: Math.hypot(point.x - 50, point.y - 50),
    }))
    .sort((first, second) => {
      if (second.degree !== first.degree) {
        return second.degree - first.degree;
      }

      return first.centreDistance - second.centreDistance;
    })
    .map((item) => item.index);
}

function compareStarsForAnchor(
  first: ConstellationStar,
  second: ConstellationStar,
): number {
  const rarityDifference =
    getRarityTheme(second.rarity).rank - getRarityTheme(first.rarity).rank;

  if (rarityDifference !== 0) {
    return rarityDifference;
  }

  if (second.marketValue !== first.marketValue) {
    return second.marketValue - first.marketValue;
  }

  return first.id.localeCompare(second.id);
}

function buildZodiacConstellationStars(
  wishes: WishRow[],
  cardMap: Map<string, CardRow>,
  zodiacSign: ZodiacSign,
): ConstellationStar[] {
  const shape = ZODIAC_SHAPES[zodiacSign];
  const baseStars = wishes.map((wish, index) =>
    buildStar(
      wish,
      cardMap.get(String(wish.card_id ?? "")),
      index,
    ),
  );

  const rankedStars = [...baseStars].sort(compareStarsForAnchor);
  const anchorPriority = getZodiacAnchorPriority(shape);
  const anchorCount = Math.min(shape.points.length, rankedStars.length);
  const placements = new Map<
    string,
    { x: number; y: number; zodiacAnchor: boolean }
  >();

  for (let index = 0; index < anchorCount; index += 1) {
    const star = rankedStars[index];
    const point = shape.points[anchorPriority[index]];

    placements.set(star.id, {
      x: point.x,
      y: point.y,
      zodiacAnchor: true,
    });
  }

  const ambientStars = rankedStars.slice(anchorCount);

  ambientStars.forEach((star, index) => {
    const random = seededRandom(
      hashString(`zodiac-cloud:${zodiacSign}:${star.id}:${star.cardId}`),
    );
    const segmentIndex = index % shape.segments.length;
    const cycle = Math.floor(index / shape.segments.length);
    const [fromIndex, toIndex] = shape.segments[segmentIndex];
    const from = shape.points[fromIndex];
    const to = shape.points[toIndex];

    const progressSeed = ((cycle * 0.61803398875 + random()) % 1);
    const progress = 0.16 + progressSeed * 0.68;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const perpendicularX = -dy / length;
    const perpendicularY = dx / length;
    const band = Math.floor(cycle / 8);
    const cloudSpread = Math.min(5.4, 0.9 + band * 0.42);
    const side = (index + cycle) % 2 === 0 ? 1 : -1;
    const perpendicularOffset =
      side * (0.45 + random() * cloudSpread) +
      (random() - 0.5) * 0.75;
    const alongOffset = (random() - 0.5) * Math.min(2.1, 0.65 + band * 0.14);

    placements.set(star.id, {
      x: Math.max(
        8,
        Math.min(
          92,
          from.x +
            dx * progress +
            (dx / length) * alongOffset +
            perpendicularX * perpendicularOffset,
        ),
      ),
      y: Math.max(
        9,
        Math.min(
          91,
          from.y +
            dy * progress +
            (dy / length) * alongOffset +
            perpendicularY * perpendicularOffset,
        ),
      ),
      zodiacAnchor: false,
    });
  });

  return baseStars.map((star) => {
    const placement = placements.get(star.id);

    if (!placement) {
      return star;
    }

    return {
      ...star,
      x: placement.x,
      y: placement.y,
      zodiacAnchor: placement.zodiacAnchor,
      size: placement.zodiacAnchor
        ? Math.min(18, Math.max(8.5, star.size + 1.4))
        : Math.min(15.5, Math.max(6.2, star.size)),
    };
  });
}
function buildConstellationStars(
  wishes: WishRow[],
  cardMap: Map<string, CardRow>,
  zodiacSign: ZodiacSign | null,
): ConstellationStar[] {
  return zodiacSign
    ? buildZodiacConstellationStars(wishes, cardMap, zodiacSign)
    : buildOrganicConstellationStars(wishes, cardMap);
}


function buildFriendStars(rows: FriendRow[]): FriendStar[] {
  const friends = rows.filter(
    (row) =>
      row.relationship_status === "accepted" &&
      row.direction === "accepted" &&
      typeof row.other_user_id === "string" &&
      row.other_user_id.length > 0,
  );

  return friends.map((row, index) => {
    const ring = Math.floor(index / 12);
    const indexOnRing = index % 12;
    const countOnRing = Math.min(12, Math.max(1, friends.length - ring * 12));
    const angle =
      -Math.PI / 2 +
      (indexOnRing / countOnRing) * Math.PI * 2 +
      ring * 0.18;
    const radiusX = Math.max(36, 46 - ring * 5.5);
    const radiusY = Math.max(32, 44 - ring * 5);

    return {
      userId: row.other_user_id as string,
      username: row.username?.trim() || "trainer",
      displayName: row.display_name?.trim() || row.username?.trim() || "Trainer",
      avatarUrl: row.avatar_url?.trim() || null,
      x: Math.max(4.5, Math.min(95.5, 50 + Math.cos(angle) * radiusX)),
      y: Math.max(5.5, Math.min(94.5, 50 + Math.sin(angle) * radiusY)),
      delay: 120 + index * 55,
    };
  });
}

function getAnniversaryYears(value: string | null): number {
  if (!value) return 0;

  const wished = new Date(value);
  if (Number.isNaN(wished.getTime())) return 0;

  const today = new Date();
  const sameMonth = wished.getMonth() === today.getMonth();
  const sameDay = wished.getDate() === today.getDate();

  if (!sameMonth || !sameDay) return 0;

  const years = today.getFullYear() - wished.getFullYear();
  return years >= 1 ? years : 0;
}

function anniversaryMessage(years: number): string {
  return `${years} year${years === 1 ? "" : "s"} ago today you summoned this card.`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "A forgotten night";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "A forgotten night";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMilestoneMessage(count: number): string {
  if (count >= 1000) {
    return "Your sky has become a galaxy.";
  }

  if (count >= 500) {
    return "Even Jirachi can no longer count every light.";
  }

  if (count >= 250) {
    return "A great constellation watches over your collection.";
  }

  if (count >= 100) {
    return "One hundred wishes now burn in the night.";
  }

  if (count >= 50) {
    return "Your constellation can be seen from far away.";
  }

  if (count >= 25) {
    return "The shape of your journey is beginning to appear.";
  }

  if (count >= 10) {
    return "A true constellation has formed.";
  }

  if (count >= 2) {
    return "Your stars are beginning to find one another.";
  }

  if (count === 1) {
    return "Every constellation begins with a single wish.";
  }

  return "Make your first wish and place a star in the sky.";
}

export default function ConstellationPage() {
  const router = useRouter();
  const [stars, setStars] = useState<ConstellationStar[]>([]);
  const [friendStars, setFriendStars] = useState<FriendStar[]>([]);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [selectedStar, setSelectedStar] =
    useState<ConstellationStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConstellation = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in to see your constellation.");
      }

      const [wishResult, friendResult, zodiacResult] = await Promise.all([
        supabase
          .from("player_wishes")
          .select("id, card_id, market_value_at_wish, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1600),
        supabase.rpc("get_player_friend_dashboard"),
        supabase.rpc("get_player_zodiac_sign"),
      ]);

      if (wishResult.error) {
        throw wishResult.error;
      }

      const wishes = (wishResult.data || []) as WishRow[];
      const friendRows = Array.isArray(friendResult.data)
        ? (friendResult.data as FriendRow[])
        : [];
      setFriendStars(friendResult.error ? [] : buildFriendStars(friendRows));
      const nextZodiacSign = zodiacResult.error
        ? null
        : parseZodiacSign(
            Array.isArray(zodiacResult.data)
              ? zodiacResult.data[0]
              : zodiacResult.data,
          );
      setZodiacSign(nextZodiacSign);

      const cardIds = Array.from(
        new Set(
          wishes
            .map((wish) => wish.card_id)
            .filter(
              (value): value is string | number =>
                value !== null && value !== undefined,
            ),
        ),
      );

      let cards: CardRow[] = [];

      if (cardIds.length > 0) {
        const { data: cardData, error: cardError } = await supabase
          .from("pokemon_cards")
          .select(
            "id, name, set_name, card_no, rarity, market_value, image_url",
          )
          .in("id", cardIds);

        if (cardError) {
          throw cardError;
        }

        cards = (cardData || []) as CardRow[];
      }

      const cardMap = new Map(
        cards.map((card) => [String(card.id), card]),
      );

      const nextStars = buildConstellationStars(wishes, cardMap, nextZodiacSign);

      setStars(nextStars);

      setSelectedStar((current) => {
        if (!current) {
          return nextStars.at(-1) || null;
        }

        return (
          nextStars.find((star) => star.id === current.id) ||
          nextStars.at(-1) ||
          null
        );
      });
    } catch (error: unknown) {
      console.error("Constellation load error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your constellation could not be loaded.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadConstellation(false);
  }, [loadConstellation]);

  const totalValue = useMemo(
    () => stars.reduce((sum, star) => sum + star.marketValue, 0),
    [stars],
  );

  const rarestStar = useMemo(() => {
    return [...stars].sort((first, second) => {
      const firstRank = getRarityTheme(first.rarity).rank;
      const secondRank = getRarityTheme(second.rarity).rank;

      if (secondRank !== firstRank) {
        return secondRank - firstRank;
      }

      return second.marketValue - first.marketValue;
    })[0] || null;
  }, [stars]);

  return (
    <section className="relative min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden bg-[#040515] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(103,232,249,0.075),transparent_32%),radial-gradient(circle_at_20%_18%,rgba(196,181,253,0.08),transparent_26%),radial-gradient(circle_at_82%_17%,rgba(249,168,212,0.06),transparent_24%),linear-gradient(180deg,rgba(3,4,18,0.96),rgba(6,7,27,0.985))]" />
      <div className="pointer-events-none absolute inset-0 opacity-65 [background-image:radial-gradient(circle_at_7%_14%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_14%_43%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_26%_21%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_34%_68%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_42%_11%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_53%_31%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_61%_76%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_69%_13%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_79%_42%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_88%_19%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_94%_72%,white_0_1px,transparent_1.5px)]" />

      <div className="absolute left-3 top-3 z-40 max-w-[min(92vw,34rem)] rounded-[1.6rem] border border-violet-200/12 bg-[#080a25]/72 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:left-5 sm:top-5 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/38">
              Jirachi&apos;s memory
            </p>
            <div className="mt-2 overflow-hidden">
              <UnownText
                text="Your Constellation"
                size="clamp(1.45rem, 3.2vw, 2.45rem)"
                tone="holo"
              />
            </div>
            {zodiacSign ? (
              <p className="mt-2 text-xs font-black uppercase tracking-[0.15em] text-violet-100/52">
                {ZODIAC_SHAPES[zodiacSign].label} sky
              </p>
            ) : (
              <p className="mt-2 text-xs font-bold text-white/28">
                Choose a star sign in Profile to shape your sky.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadConstellation(true)}
            disabled={refreshing}
            className="min-h-10 flex-none rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.7rem] font-black uppercase tracking-[0.12em] text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {refreshing ? "Reading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SkyStat label="Stars" value={String(stars.length)} />
          <SkyStat label="Value" value={formatMoney(totalValue)} />
          <SkyStat label="Brightest" value={rarestStar?.name || "Waiting"} />
        </div>
      </div>

      {errorMessage ? (
        <div className="absolute left-1/2 top-4 z-50 w-[min(92vw,36rem)] -translate-x-1/2 rounded-2xl border border-red-200/15 bg-red-950/85 p-4 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-xl">
          {errorMessage}
        </div>
      ) : null}

      <article className="relative z-10 min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden">
        {loading ? (
          <div className="relative z-10 flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center text-center">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white shadow-[0_0_55px_18px_rgba(255,255,255,0.3)]" />
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Rebuilding your night sky
            </p>
          </div>
        ) : (
          <div className="relative min-h-[calc(100dvh-4.5rem)] w-full">
            {stars.length > 0 ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {zodiacSign
                  ? ZODIAC_SHAPES[zodiacSign].segments.flatMap(
                      ([fromIndex, toIndex], index) => {
                        const from = ZODIAC_SHAPES[zodiacSign].points[fromIndex];
                        const to = ZODIAC_SHAPES[zodiacSign].points[toIndex];

                        return [
                          <line
                            key={`zodiac-glow-${zodiacSign}-${index}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="rgba(103,232,249,0.22)"
                            strokeWidth="1.15"
                            strokeLinecap="round"
                          />,
                          <line
                            key={`zodiac-core-${zodiacSign}-${index}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="rgba(254,249,195,0.78)"
                            strokeWidth="0.34"
                            strokeLinecap="round"
                          />,
                        ];
                      },
                    )
                  : stars.slice(1).map((star, index) => {
                      const previous = stars[index];

                      return (
                        <line
                          key={`${previous.id}-${star.id}`}
                          x1={previous.x}
                          y1={previous.y}
                          x2={star.x}
                          y2={star.y}
                          stroke="rgba(196,181,253,0.4)"
                          strokeWidth="0.14"
                          strokeDasharray="0.65 1.05"
                        />
                      );
                    })}
              </svg>
            ) : null}

            {stars.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <div className="text-8xl text-yellow-100/30">*</div>
                <h2 className="mt-4 text-2xl font-black text-white">
                  The sky is waiting for you.
                </h2>
                <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/40">
                  Return to the Wish Chamber and let Jirachi place your first permanent star here.
                </p>
              </div>
            ) : null}

            {stars.map((star) => {
              const active = selectedStar?.id === star.id;
              const hitSize = Math.max(24, star.size + 14);
              const anniversaryYears = getAnniversaryYears(star.grantedAt);

              return (
                <button
                  key={star.id}
                  type="button"
                  onClick={() => setSelectedStar(star)}
                  aria-label={`${star.name}, ${star.rarity}`}
                  title={anniversaryYears > 0 ? anniversaryMessage(anniversaryYears) : undefined}
                  className={[
                    "absolute rounded-full transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                    active ? "z-30 scale-[1.12]" : "z-20 hover:scale-125",
                  ].join(" ")}
                  style={{
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    width: `${hitSize}px`,
                    height: `${hitSize}px`,
                    transform: "translate(-50%, -50%)",
                    animation: `constellationStarIn 650ms ${star.delay}ms ease-out both`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 rounded-full"
                    style={{
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      background: star.colour,
                      boxShadow: active
                        ? `0 0 ${star.size * 3.1}px ${star.size * 0.85}px ${star.glow}`
                        : star.zodiacAnchor
                          ? `0 0 ${star.size * 2.6}px ${star.size * 0.68}px ${star.glow}`
                          : `0 0 ${star.size * 1.75}px ${star.size * 0.36}px ${star.glow}`,
                      outline: star.zodiacAnchor
                        ? "2px solid rgba(254,249,195,0.48)"
                        : undefined,
                      outlineOffset: star.zodiacAnchor ? "3px" : undefined,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  {anniversaryYears > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -top-0.5 z-20 text-[0.7rem] text-yellow-100 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]"
                    >
                      ✦
                    </span>
                  ) : null}
                  <span className="sr-only">{star.name}</span>
                </button>
              );
            })}

            {friendStars.map((friend) => (
              <button
                key={`friend-${friend.userId}`}
                type="button"
                onClick={() => router.push(`/friends/${encodeURIComponent(friend.userId)}`)}
                aria-label={`Open ${friend.displayName}'s trainer profile`}
                className="group absolute z-40 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-100/28 bg-[#090b27]/90 shadow-[0_0_28px_rgba(103,232,249,0.38)] transition duration-200 hover:scale-125 hover:border-yellow-100/45 hover:shadow-[0_0_36px_rgba(250,204,21,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100"
                style={{
                  left: `${friend.x}%`,
                  top: `${friend.y}%`,
                  transform: "translate(-50%, -50%)",
                  animation: `friendStarIn 700ms ${friend.delay}ms ease-out both`,
                }}
              >
                <span className="pointer-events-none absolute -inset-2 rounded-full bg-cyan-200/10 blur-md" />
                <span className="pointer-events-none absolute text-[2.25rem] leading-none text-cyan-100/80 drop-shadow-[0_0_12px_rgba(103,232,249,0.75)]">
                  ✦
                </span>
                {friend.avatarUrl ? (
                  <img
                    src={friend.avatarUrl}
                    alt=""
                    className="relative z-10 h-5 w-5 rounded-full border border-white/30 object-cover"
                  />
                ) : (
                  <span className="relative z-10 text-[0.58rem] font-black text-white">
                    {friend.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#07091f]/95 px-2.5 py-1 text-[0.58rem] font-black text-white/80 shadow-xl group-hover:block group-focus-visible:block">
                  {friend.displayName}
                </span>
              </button>
            ))}

            <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-white/[0.06] bg-[#050619]/55 px-4 py-2 text-[0.56rem] font-black uppercase tracking-[0.16em] text-white/24 backdrop-blur-md">
              <span>Select a light to remember its wish</span>
              {friendStars.length > 0 ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-cyan-100/36">Large stars are friends</span>
                </>
              ) : null}
            </div>
          </div>
        )}
      </article>

      {selectedStar ? (
        <aside className="fixed bottom-[5.8rem] right-3 z-[60] max-h-[72dvh] w-[min(92vw,22rem)] overflow-y-auto rounded-[1.7rem] border border-violet-200/16 bg-[#090b27]/94 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:bottom-4 md:right-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[0.58rem] font-black uppercase tracking-[0.18em]"
                style={{ color: selectedStar.colour }}
              >
                {selectedStar.rarity}
              </p>
              <h2 className="mt-1 truncate text-xl font-black tracking-tight text-white">
                {selectedStar.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStar(null)}
              aria-label="Close memory"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg font-black text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-4">
            <div className="aspect-[0.716] overflow-hidden rounded-xl border border-white/10 bg-black/25 shadow-[0_15px_45px_rgba(0,0,0,0.45)]">
              {selectedStar.imageUrl ? (
                <img
                  src={selectedStar.imageUrl}
                  alt={selectedStar.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl" style={{ color: selectedStar.colour }}>
                  *
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <MemoryRow label="Wish granted" value={formatDate(selectedStar.grantedAt)} />
              <MemoryRow label="Value" value={formatMoney(selectedStar.marketValue)} />
              <MemoryRow
                label="Star"
                value={`#${stars.findIndex((star) => star.id === selectedStar.id) + 1}`}
              />
            </div>
          </div>

          <p className="mt-3 text-xs font-semibold text-white/38">
            {[selectedStar.setName, selectedStar.cardNumber ? `#${selectedStar.cardNumber}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {getAnniversaryYears(selectedStar.grantedAt) > 0 ? (
            <div className="mt-3 rounded-xl border border-yellow-100/15 bg-yellow-200/[0.06] p-3">
              <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-yellow-100/55">
                ✦ Wish anniversary
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-yellow-50/78">
                {anniversaryMessage(getAnniversaryYears(selectedStar.grantedAt))}
              </p>
            </div>
          ) : null}
        </aside>
      ) : null}

      <style jsx global>{`
        @keyframes friendStarIn {
          0% {
            opacity: 0;
            filter: brightness(2.4);
          }
          70% {
            opacity: 1;
            filter: brightness(1.35);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes constellationStarIn {
          0% {
            opacity: 0;
            filter: brightness(3);
          }

          60% {
            opacity: 1;
            filter: brightness(1.8);
          }

          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
      `}</style>
    </section>
  );
}

function SkyStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
      <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-white/26">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white/82">
        {value}
      </p>
    </div>
  );
}

function MemoryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-xs font-bold text-white/30">{label}</span>
      <strong className="text-right text-xs text-white/75">{value}</strong>
    </div>
  );
}
