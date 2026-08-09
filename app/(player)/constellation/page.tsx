"use client";

import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UnownText from "@/components/player/UnownText";
import { formatMarketValue } from "@/lib/player/format";
import usePlayerPreferences from "@/components/player/usePlayerPreferences";
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
  z: number;
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
  z: number;
  delay: number;
};

type SpatialPoint = {
  x: number;
  y: number;
  z: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
  scale: number;
  atmosphere: number;
};

type VolumeStar = SpatialPoint & {
  id: string;
  size: number;
  brightness: number;
  colour: string;
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

const VOLUME_STARS: VolumeStar[] = (() => {
  const random = seededRandom(0x51a7c0de);
  const colours = [
    "rgba(255,255,255,0.96)",
    "rgba(207,250,254,0.94)",
    "rgba(237,233,254,0.94)",
    "rgba(254,249,195,0.9)",
  ];

  return Array.from({ length: 128 }, (_, index) => {
    const depthBias = Math.pow(random(), 0.82);

    return {
      id: `volume-star-${index}`,
      x: 2 + random() * 96,
      y: 3 + random() * 94,
      z: -118 + depthBias * 190,
      size: 0.65 + random() * 1.85,
      brightness: 0.28 + random() * 0.62,
      colour: colours[Math.floor(random() * colours.length)],
      delay: -random() * 9,
    };
  });
})();

function getZodiacSpatialPoint(
  zodiacSign: ZodiacSign,
  pointIndex: number,
): SpatialPoint {
  const point = ZODIAC_SHAPES[zodiacSign].points[pointIndex];
  const random = seededRandom(
    hashString(`zodiac-depth:${zodiacSign}:${pointIndex}`),
  );
  const wave = Math.sin(pointIndex * 1.73 + random() * Math.PI * 2);

  return {
    x: point.x,
    y: point.y,
    z: Math.max(-52, Math.min(52, wave * 31 + (random() - 0.5) * 27)),
  };
}

function projectSpatialPoint(
  point: SpatialPoint,
  rotation: { x: number; y: number },
): ProjectedPoint {
  const radiansX = (rotation.x * Math.PI) / 180;
  const radiansY = (rotation.y * Math.PI) / 180;
  const sinX = Math.sin(radiansX);
  const cosX = Math.cos(radiansX);
  const sinY = Math.sin(radiansY);
  const cosY = Math.cos(radiansY);

  const worldX = point.x - 50;
  const worldY = point.y - 50;
  const rotatedX = worldX * cosY + point.z * sinY;
  const yawDepth = -worldX * sinY + point.z * cosY;
  const rotatedY = worldY * cosX - yawDepth * sinX;
  const depth = worldY * sinX + yawDepth * cosX;
  const cameraDistance = 178;
  const scale = Math.max(
    0.48,
    Math.min(1.88, cameraDistance / Math.max(68, cameraDistance - depth)),
  );

  return {
    x: 50 + rotatedX * scale,
    y: 50 + rotatedY * scale,
    depth,
    scale,
    atmosphere: Math.max(0.18, Math.min(1, (depth + 126) / 184)),
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
    z: -48 + random() * 96,
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
      z: -68 + seededRandom(hashString(`organic-depth:${base.id}:${base.cardId}`))() * 136,
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
    { x: number; y: number; z: number; zodiacAnchor: boolean }
  >();

  for (let index = 0; index < anchorCount; index += 1) {
    const star = rankedStars[index];
    const pointIndex = anchorPriority[index];
    const point = getZodiacSpatialPoint(zodiacSign, pointIndex);

    placements.set(star.id, {
      x: point.x,
      y: point.y,
      z: point.z,
      zodiacAnchor: true,
    });
  }

  const ambientStars = rankedStars.slice(anchorCount);
  const scatteredPositions: ZodiacPoint[] = [];

  ambientStars.forEach((star, index) => {
    const random = seededRandom(
      hashString(`zodiac-scatter:${zodiacSign}:${star.id}:${star.cardId}`),
    );
    const densityPressure = Math.min(2.05, Math.sqrt(index + 1) * 0.064);
    const desiredSpacing = Math.max(1.45, 3.55 - densityPressure);
    let best = { x: 50, y: 50, score: -1 };

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = 5.5 + random() * 89;
      const y = 7.5 + random() * 85;
      let nearest = Number.POSITIVE_INFINITY;

      for (const point of shape.points) {
        nearest = Math.min(nearest, Math.hypot(x - point.x, y - point.y));
      }

      for (const point of scatteredPositions.slice(-280)) {
        nearest = Math.min(nearest, Math.hypot(x - point.x, y - point.y));
      }

      if (!Number.isFinite(nearest)) {
        nearest = 999;
      }

      if (nearest > best.score) {
        best = { x, y, score: nearest };
      }

      if (nearest >= desiredSpacing) {
        best = { x, y, score: nearest };
        break;
      }
    }

    const placement = {
      x: best.x,
      y: best.y,
      z: -76 + seededRandom(
        hashString(`zodiac-depth:${zodiacSign}:${star.id}:${star.cardId}`),
      )() * 148,
      zodiacAnchor: false,
    };

    placements.set(star.id, placement);
    scatteredPositions.push({ x: placement.x, y: placement.y });
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
      z: placement.z,
      zodiacAnchor: placement.zodiacAnchor,
      size: placement.zodiacAnchor
        ? Math.min(25, Math.max(13, star.size + 5.5))
        : Math.min(15, Math.max(5.8, star.size)),
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
      z: 38 + Math.sin(angle * 1.7 + ring) * 22 - ring * 7,
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
    return "Even Nebu can no longer count every light.";
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
  const preferences = usePlayerPreferences();
  const [stars, setStars] = useState<ConstellationStar[]>([]);
  const [friendStars, setFriendStars] = useState<FriendStar[]>([]);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [selectedStar, setSelectedStar] =
    useState<ConstellationStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [mobileSky, setMobileSky] = useState(false);
  const [rotation, setRotation] = useState({ x: -7, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [travellingStarId, setTravellingStarId] = useState<string | null>(null);
  const [draggingSky, setDraggingSky] = useState(false);
  const skyViewportRef = useRef<HTMLElement | null>(null);
  const skyPlaneRef = useRef<HTMLDivElement | null>(null);
  const viewFrameRef = useRef<number | null>(null);
  const travelAnimationRef = useRef<Animation | null>(null);
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef({
    rotation: { x: -7, y: 0 },
    zoom: 1,
  });
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startRotation: { x: number; y: number };
    singleStart: { x: number; y: number } | null;
    pinchDistance: number | null;
    pinchZoom: number;
  }>({
    pointers: new Map(),
    startRotation: { x: -7, y: 0 },
    singleStart: null,
    pinchDistance: null,
    pinchZoom: 1,
  });

  const clampZoom = useCallback((value: number) => {
    return Math.max(0.52, Math.min(2.4, value));
  }, []);

  const queueSkyView = useCallback((next: {
    rotation?: { x: number; y: number };
    zoom?: number;
  }) => {
    viewRef.current = {
      rotation:
        next.rotation ??
        viewRef.current.rotation,
      zoom:
        next.zoom ??
        viewRef.current.zoom,
    };

    if (
      viewFrameRef.current !==
      null
    ) {
      return;
    }

    viewFrameRef.current =
      window.requestAnimationFrame(
        () => {
          viewFrameRef.current =
            null;

          setRotation(
            viewRef.current.rotation,
          );
          setZoom(
            viewRef.current.zoom,
          );
        },
      );
  }, []);

  const resetSkyView = useCallback(() => {
    travelAnimationRef.current?.cancel();
    travelAnimationRef.current = null;

    const nextRotation = { x: mobileSky ? -4 : -7, y: 0 };
    const nextZoom = mobileSky ? 0.72 : 1;
    const nextOffset = { x: 0, y: 0 };
    viewRef.current = {
      rotation: nextRotation,
      zoom: nextZoom,
    };
    cameraOffsetRef.current = nextOffset;
    setRotation(nextRotation);
    setZoom(nextZoom);
    setCameraOffset(nextOffset);
    setTravellingStarId(null);
    gestureRef.current.startRotation = nextRotation;
    gestureRef.current.pinchZoom = nextZoom;
  }, [mobileSky]);

  const travelToStar = useCallback((star: ConstellationStar) => {
    travelAnimationRef.current?.cancel();
    travelAnimationRef.current = null;

    const activeRotation = viewRef.current.rotation;
    const projected = projectSpatialPoint(star, activeRotation);
    const startZoom = viewRef.current.zoom;
    const startOffset = cameraOffsetRef.current;
    const targetZoom = clampZoom(mobileSky ? 1.38 : 1.72);
    const targetOffset = {
      x: (50 - projected.x) * targetZoom,
      y: (50 - projected.y) * targetZoom,
    };

    setSelectedStar(null);
    setInfoPanelOpen(false);

    if (preferences.reducedMotion || preferences.lowVisualEffects) {
      viewRef.current.zoom = targetZoom;
      cameraOffsetRef.current = targetOffset;
      setZoom(targetZoom);
      setCameraOffset(targetOffset);
      setTravellingStarId(null);
      setSelectedStar(star);
      return;
    }

    const pullBackZoom = clampZoom(
      Math.min(startZoom * 0.76, mobileSky ? 0.62 : 0.78),
    );
    const pullBackOffset = {
      x: startOffset.x * 0.58,
      y: startOffset.y * 0.58,
    };
    const pullBackDuration = 420;
    const flightDuration = 1900;
    const totalDuration = pullBackDuration + flightDuration;
    const plane = skyPlaneRef.current;

    if (!plane) {
      viewRef.current.zoom = targetZoom;
      cameraOffsetRef.current = targetOffset;
      setZoom(targetZoom);
      setCameraOffset(targetOffset);
      setSelectedStar(star);
      return;
    }

    const transform = (offset: { x: number; y: number }, scale: number) =>
      `translate3d(${offset.x}%, ${offset.y}%, 0) scale(${scale})`;

    setTravellingStarId(star.id);

    const animation = plane.animate(
      [
        {
          transform: transform(startOffset, startZoom),
          offset: 0,
          easing: "cubic-bezier(0.22, 0.72, 0.28, 1)",
        },
        {
          transform: transform(pullBackOffset, pullBackZoom),
          offset: pullBackDuration / totalDuration,
          easing: "cubic-bezier(0.18, 0.76, 0.18, 1)",
        },
        {
          transform: transform(targetOffset, targetZoom),
          offset: 1,
        },
      ],
      {
        duration: totalDuration,
        fill: "forwards",
      },
    );

    travelAnimationRef.current = animation;

    animation.onfinish = () => {
      viewRef.current.zoom = targetZoom;
      cameraOffsetRef.current = targetOffset;
      setZoom(targetZoom);
      setCameraOffset(targetOffset);
      setTravellingStarId(null);
      setSelectedStar(star);

      window.requestAnimationFrame(() => {
        if (travelAnimationRef.current === animation) {
          animation.cancel();
          travelAnimationRef.current = null;
        }
      });
    };
  }, [clampZoom, mobileSky, preferences.lowVisualEffects, preferences.reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");

    const sync = () => {
      travelAnimationRef.current?.cancel();
      travelAnimationRef.current = null;

      const mobile = media.matches;
      const nextRotation = {
        x: mobile ? -4 : -7,
        y: 0,
      };
      const nextZoom =
        mobile ? 0.72 : 1;

      viewRef.current = {
        rotation: nextRotation,
        zoom: nextZoom,
      };
      cameraOffsetRef.current = { x: 0, y: 0 };
      setMobileSky(mobile);
      setZoom(nextZoom);
      setRotation(nextRotation);
      setCameraOffset({ x: 0, y: 0 });
      setTravellingStarId(null);
      gestureRef.current.startRotation = nextRotation;
      gestureRef.current.pinchZoom = nextZoom;
    };

    sync();
    media.addEventListener("change", sync);

    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (
        viewFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          viewFrameRef.current,
        );
      }

      travelAnimationRef.current?.cancel();
    };
  }, []);

  const handleSkyPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (
      target.closest("button,a,input,select,textarea") &&
      gestureRef.current.pointers.size === 0
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.pointers.size === 1) {
      gesture.singleStart = { x: event.clientX, y: event.clientY };
      gesture.startRotation = viewRef.current.rotation;
      gesture.pinchDistance = null;
      gesture.pinchZoom = viewRef.current.zoom;
      setDraggingSky(true);
      return;
    }

    if (gesture.pointers.size === 2) {
      const [first, second] = Array.from(gesture.pointers.values());
      gesture.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      gesture.pinchZoom = viewRef.current.zoom;
      gesture.singleStart = null;
      setDraggingSky(true);
    }
  }, []);

  const handleSkyPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (!gesture.pointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.pointers.size >= 2) {
      const [first, second] = Array.from(gesture.pointers.values());
      const distance = Math.hypot(second.x - first.x, second.y - first.y);

      if (gesture.pinchDistance && gesture.pinchDistance > 0) {
        queueSkyView({
          zoom: clampZoom(
            gesture.pinchZoom *
              (distance /
                gesture.pinchDistance),
          ),
        });
      }

      return;
    }

    if (gesture.pointers.size === 1 && gesture.singleStart) {
      const only = Array.from(gesture.pointers.values())[0];
      const deltaX = only.x - gesture.singleStart.x;
      const deltaY = only.y - gesture.singleStart.y;

      queueSkyView({
        rotation: {
          x: Math.max(-48, Math.min(48, gesture.startRotation.x - deltaY * 0.16)),
          y: Math.max(-68, Math.min(68, gesture.startRotation.y + deltaX * 0.19)),
        },
      });
    }
  }, [clampZoom, queueSkyView]);

  const finishSkyPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    gesture.pointers.delete(event.pointerId);

    if (gesture.pointers.size === 1) {
      const remaining = Array.from(gesture.pointers.values())[0];
      gesture.singleStart = remaining;
      gesture.startRotation = viewRef.current.rotation;
      gesture.pinchDistance = null;
      gesture.pinchZoom = viewRef.current.zoom;
      return;
    }

    if (gesture.pointers.size === 0) {
      gesture.singleStart = null;
      gesture.pinchDistance = null;
      gesture.startRotation = viewRef.current.rotation;
      gesture.pinchZoom = viewRef.current.zoom;
      setDraggingSky(false);
    }
  }, []);

  const handleSkyWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    const multiplier = Math.exp(-event.deltaY * 0.00135);
    queueSkyView({
      zoom: clampZoom(
        viewRef.current.zoom *
          multiplier,
      ),
    });
  }, [clampZoom, queueSkyView]);

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
          return null;
        }

        return nextStars.find((star) => star.id === current.id) || null;
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

  const zodiacAnchorRequirement = zodiacSign
    ? ZODIAC_SHAPES[zodiacSign].points.length
    : 0;
  const zodiacAnchorsFilled = zodiacSign
    ? Math.min(
        zodiacAnchorRequirement,
        stars.filter((star) => star.zodiacAnchor).length,
      )
    : 0;
  const constellationComplete =
    Boolean(zodiacSign) && zodiacAnchorRequirement > 0 && zodiacAnchorsFilled >= zodiacAnchorRequirement;

  const projectedVolumeStars = useMemo(
    () =>
      VOLUME_STARS.slice(
        0,
        preferences.dataSaver
          ? 28
          : preferences.lowVisualEffects
            ? 48
            : mobileSky
              ? 64
              : VOLUME_STARS.length,
      ).map((star) => ({
        star,
        projected: projectSpatialPoint(star, rotation),
      })).sort((first, second) => first.projected.depth - second.projected.depth),
    [mobileSky, preferences.dataSaver, preferences.lowVisualEffects, rotation],
  );

  const projectedStars = useMemo(
    () =>
      stars.map((star) => ({
        star,
        projected: projectSpatialPoint(star, rotation),
      })),
    [rotation, stars],
  );

  const depthSortedStars = useMemo(
    () =>
      [...projectedStars].sort(
        (first, second) => first.projected.depth - second.projected.depth,
      ),
    [projectedStars],
  );

  const projectedFriendStars = useMemo(
    () =>
      friendStars
        .map((friend) => ({
          friend,
          projected: projectSpatialPoint(friend, rotation),
        }))
        .sort((first, second) => first.projected.depth - second.projected.depth),
    [friendStars, rotation],
  );

  const projectedZodiacPoints = useMemo(
    () =>
      zodiacSign
        ? ZODIAC_SHAPES[zodiacSign].points.map((_, index) =>
            projectSpatialPoint(
              getZodiacSpatialPoint(zodiacSign, index),
              rotation,
            ),
          )
        : [],
    [rotation, zodiacSign],
  );

  return (
    <section className="relative min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden bg-[#040515] text-white">
      <h1 className="sr-only">Your Constellation</h1>
      <p className="sr-only" aria-live="polite">
        {travellingStarId
          ? `Travelling to ${stars.find((star) => star.id === travellingStarId)?.name || "the selected star"}.`
          : selectedStar
            ? `Arrived at ${selectedStar.name}.`
            : ""}
      </p>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(103,232,249,0.075),transparent_32%),radial-gradient(circle_at_20%_18%,rgba(196,181,253,0.08),transparent_26%),radial-gradient(circle_at_82%_17%,rgba(249,168,212,0.06),transparent_24%),linear-gradient(180deg,rgba(3,4,18,0.96),rgba(6,7,27,0.985))]" />
      <div className="pointer-events-none absolute inset-0 opacity-65 [background-image:radial-gradient(circle_at_7%_14%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_14%_43%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_26%_21%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_34%_68%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_42%_11%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_53%_31%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_61%_76%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_69%_13%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_79%_42%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_88%_19%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_94%_72%,white_0_1px,transparent_1.5px)]" />
      <div className="pointer-events-none absolute -left-[12vw] top-[16%] h-[28rem] w-[68vw] rotate-[-12deg] rounded-[50%] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.035),rgba(139,92,246,0.055),transparent)] blur-[34px] constellationAurora" />
      <div className="pointer-events-none absolute -right-[18vw] bottom-[8%] h-[26rem] w-[62vw] rotate-[9deg] rounded-[50%] bg-[linear-gradient(90deg,transparent,rgba(244,114,182,0.035),rgba(103,232,249,0.045),transparent)] blur-[40px] constellationAurora constellationAuroraLate" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.24)_78%,rgba(0,0,0,0.58)_100%)]" />

      {infoPanelOpen ? (
      <div className="absolute left-3 top-3 z-40 max-w-[min(92vw,34rem)] rounded-[1.6rem] border border-violet-200/12 bg-[#080a25]/72 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:left-5 sm:top-5 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/38">
              Nebu&apos;s memory
            </p>
            <div className="mt-2 overflow-hidden">
              <UnownText
                text="Your Constellation"
                size="clamp(1.45rem, 3.2vw, 2.45rem)"
                tone="holo"
              />
            </div>
            {zodiacSign ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-100/52">
                  {ZODIAC_SHAPES[zodiacSign].label} sky
                </p>
                <span
                  className={[
                    "rounded-full border px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em]",
                    constellationComplete
                      ? "border-cyan-100/20 bg-cyan-200/[0.08] text-cyan-50/80"
                      : "border-white/10 bg-white/[0.04] text-white/36",
                  ].join(" ")}
                >
                  {constellationComplete
                    ? "Constellation complete"
                    : `${zodiacAnchorsFilled}/${zodiacAnchorRequirement} anchors`}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-white/28">
                Choose a star sign in Profile to shape your sky.
              </p>
            )}
          </div>

          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => void loadConstellation(true)}
              disabled={refreshing}
              className="min-h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.7rem] font-black uppercase tracking-[0.12em] text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              {refreshing ? "Reading..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => setInfoPanelOpen(false)}
              aria-label="Hide constellation information"
              title="Hide information"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-lg font-black text-white/70 transition hover:border-cyan-100/25 hover:bg-cyan-100/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SkyStat label="Stars" value={String(stars.length)} />
          <SkyStat label="Value" value={formatMoney(totalValue)} />
          <SkyStat label="Brightest" value={rarestStar?.name || "Waiting"} />
        </div>
      </div>
      ) : (
        <button
          type="button"
          onClick={() => setInfoPanelOpen(true)}
          aria-label="Show constellation information"
          className="absolute left-3 top-3 z-40 flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/18 bg-[#080a25]/88 px-4 text-[0.68rem] font-black uppercase tracking-[0.13em] text-cyan-50/82 shadow-[0_15px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-cyan-100/35 hover:bg-[#10143a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:left-5 sm:top-5"
        >
          <span aria-hidden="true" className="text-base text-yellow-100">✦</span>
          Show info
        </button>
      )}

      {errorMessage ? (
        <div className="absolute left-1/2 top-4 z-50 w-[min(92vw,36rem)] -translate-x-1/2 rounded-2xl border border-red-200/15 bg-red-950/85 p-4 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-xl">
          {errorMessage}
        </div>
      ) : null}

      <article
        ref={skyViewportRef}
        onPointerDown={handleSkyPointerDown}
        onPointerMove={handleSkyPointerMove}
        onPointerUp={finishSkyPointer}
        onPointerCancel={finishSkyPointer}
        onWheel={handleSkyWheel}
        className={[
          "relative z-10 h-[calc(100dvh-4.5rem)] min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden select-none",
          draggingSky ? "cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        style={{ touchAction: "none", perspective: "1100px", overscrollBehavior: "contain" }}
      >
        {loading ? (
          <div className="relative z-10 flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center text-center">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white shadow-[0_0_55px_18px_rgba(255,255,255,0.3)]" />
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Rebuilding your night sky
            </p>
          </div>
        ) : (
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: mobileSky ? "150vw" : "100vw",
              height: mobileSky ? "104dvh" : "calc(100dvh - 4.5rem)",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              ref={skyPlaneRef}
              className="relative h-full w-full constellation3dPlane constellationSpatialVolume"
              style={{
                transform: `translate3d(${cameraOffset.x}%, ${cameraOffset.y}%, 0) scale(${zoom})`,
                transformOrigin: "50% 50%",
                transition: draggingSky || travellingStarId
                  ? "none"
                  : "transform 160ms ease-out",
              }}
            >
            <div aria-hidden="true" data-pocketpulls-ambient="heavy" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ transformStyle: "preserve-3d" }}>
              <span className="constellationOrbitRing absolute left-1/2 top-1/2 h-[58%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-100/[0.055]" />
              <span className="constellationOrbitRing constellationOrbitRingTwo absolute left-1/2 top-1/2 h-[78%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-violet-100/[0.035]" />
              <span className="constellationNebula absolute left-[12%] top-[18%] h-56 w-72 rounded-full bg-violet-400/[0.035] blur-[80px]" />
              <span className="constellationNebula constellationNebulaLate absolute bottom-[14%] right-[10%] h-64 w-80 rounded-full bg-cyan-300/[0.03] blur-[90px]" />
              <span className="shootingStar shootingStarOne" />
              <span className="shootingStar shootingStarTwo" />
              <span className="shootingStar shootingStarThree" />
            </div>

            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
              {projectedVolumeStars.map(({ star, projected }) => (
                <span
                  key={star.id}
                  className="constellationVolumeStar absolute rounded-full"
                  style={{
                    left: `${projected.x}%`,
                    top: `${projected.y}%`,
                    width: `${star.size * projected.scale}px`,
                    height: `${star.size * projected.scale}px`,
                    background: star.colour,
                    boxShadow:
                      projected.depth > 18
                        ? `0 0 ${4 + star.size * projected.scale * 4}px ${star.colour}`
                        : `0 0 ${1 + star.size * projected.scale * 1.4}px ${star.colour}`,
                    transform: "translate(-50%, -50%)",
                    zIndex: Math.round(80 + projected.depth),
                    ["--volume-opacity" as string]: `${star.brightness * projected.atmosphere}`,
                    ["--volume-delay" as string]: `${star.delay}s`,
                    transition: draggingSky
                      ? "none"
                      : "left 160ms ease-out, top 160ms ease-out, width 160ms ease-out, height 160ms ease-out",
                  }}
                />
              ))}
            </div>

            {stars.length > 0 ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {zodiacSign
                  ? constellationComplete
                    ? ZODIAC_SHAPES[zodiacSign].segments.flatMap(
                      ([fromIndex, toIndex], index) => {
                          const from = projectedZodiacPoints[fromIndex];
                          const to = projectedZodiacPoints[toIndex];
                          const depthScale = (from.scale + to.scale) / 2;

                          return [
                            <line
                              key={`zodiac-glow-${zodiacSign}-${index}`}
                              className="constellationCompletedGlow"
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="rgba(103,232,249,0.26)"
                              strokeWidth={1.05 * depthScale}
                              strokeLinecap="round"
                            />,
                            <line
                              key={`zodiac-core-${zodiacSign}-${index}`}
                              className="constellationCompletedCore"
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="rgba(254,249,195,0.92)"
                              strokeWidth={0.32 * depthScale}
                              strokeLinecap="round"
                            />,
                          ];
                        },
                      )
                    : ZODIAC_SHAPES[zodiacSign].segments.map(
                      ([fromIndex, toIndex], index) => {
                          const from = projectedZodiacPoints[fromIndex];
                          const to = projectedZodiacPoints[toIndex];
                          const depthScale = (from.scale + to.scale) / 2;

                          return (
                            <line
                              key={`zodiac-guide-${zodiacSign}-${index}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="rgba(196,181,253,0.42)"
                              strokeWidth={0.24 * depthScale}
                              strokeLinecap="round"
                              strokeDasharray="1.1 1.35"
                            />
                          );
                        },
                      )
                  : projectedStars.slice(1).map(({ star, projected }, index) => {
                      const previous = projectedStars[index];

                      return (
                        <line
                          key={`${previous.star.id}-${star.id}`}
                          x1={previous.projected.x}
                          y1={previous.projected.y}
                          x2={projected.x}
                          y2={projected.y}
                          stroke="rgba(196,181,253,0.4)"
                          strokeWidth={0.13 * ((previous.projected.scale + projected.scale) / 2)}
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
                  Return to the Wish Chamber and let Nebu place your first permanent star here.
                </p>
              </div>
            ) : null}

            {depthSortedStars.map(({ star, projected }) => {
              const active = selectedStar?.id === star.id;
              const destination = travellingStarId === star.id;
              const hitSize = Math.max(24, star.size + 14);
              const anniversaryYears = getAnniversaryYears(star.grantedAt);
              const starOpacity = Math.min(
                1,
                0.62 + projected.atmosphere * 0.38,
              );

              return (
                <button
                  key={star.id}
                  type="button"
                  onClick={() => travelToStar(star)}
                  disabled={travellingStarId !== null}
                  aria-label={`${star.name}, ${star.rarity}`}
                  title={anniversaryYears > 0 ? anniversaryMessage(anniversaryYears) : undefined}
                  className={[
                    "spatialStarButton absolute rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                    active || destination
                      ? "z-30 scale-[1.18]"
                      : "z-20 hover:scale-125",
                  ].join(" ")}
                  style={{
                    left: `${projected.x}%`,
                    top: `${projected.y}%`,
                    width: `${hitSize}px`,
                    height: `${hitSize}px`,
                    zIndex: Math.round(240 + projected.depth),
                    transform: `translate(-50%, -50%) scale(${projected.scale})`,
                    filter: `brightness(${0.82 + projected.atmosphere * 0.3})`,
                    animation: `constellationStarIn 650ms ${star.delay}ms ease-out both`,
                    ["--star-opacity" as string]: `${starOpacity}`,
                    transition: draggingSky
                      ? "none"
                      : "left 160ms ease-out, top 160ms ease-out, transform 160ms ease-out, filter 160ms ease-out",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "constellationStarLight absolute left-1/2 top-1/2 rounded-full",
                      star.zodiacAnchor ? "constellationAnchorStar" : "",
                    ].join(" ")}
                    style={{
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      background: star.colour,
                      boxShadow: active || destination
                        ? `0 0 ${star.size * 3.1}px ${star.size * 0.85}px ${star.glow}`
                        : star.zodiacAnchor
                          ? `0 0 ${star.size * 2.6}px ${star.size * 0.68}px ${star.glow}`
                          : `0 0 ${star.size * 1.75}px ${star.size * 0.36}px ${star.glow}`,
                      outline: star.zodiacAnchor
                        ? "2px solid rgba(254,249,195,0.48)"
                        : undefined,
                      outlineOffset: star.zodiacAnchor ? "3px" : undefined,
                      transform: "translate(-50%, -50%)",
                      ["--glimmer-delay" as string]: `${(hashString(`glimmer:${star.id}`) % 6200) / 1000}s`,
                      ["--glimmer-duration" as string]: `${4.2 + (hashString(`duration:${star.id}`) % 4200) / 1000}s`,
                      ["--glimmer-min" as string]: star.zodiacAnchor ? "0.78" : "0.48",
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

            {projectedFriendStars.map(({ friend, projected }) => (
              <button
                key={`friend-${friend.userId}`}
                type="button"
                onClick={() => router.push(`/friends/${encodeURIComponent(friend.userId)}`)}
                aria-label={`Open ${friend.displayName}'s trainer profile`}
                className="group absolute z-40 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-100/28 bg-[#090b27]/90 shadow-[0_0_28px_rgba(103,232,249,0.38)] transition duration-200 hover:scale-125 hover:border-yellow-100/45 hover:shadow-[0_0_36px_rgba(250,204,21,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100"
                style={{
                  left: `${projected.x}%`,
                  top: `${projected.y}%`,
                  zIndex: Math.round(520 + projected.depth),
                  transform: `translate(-50%, -50%) scale(${projected.scale})`,
                  animation: `friendStarIn 700ms ${friend.delay}ms ease-out both`,
                  ["--star-opacity" as string]: `${Math.min(1, 0.74 + projected.atmosphere * 0.26)}`,
                  transition: draggingSky
                    ? "none"
                    : "left 160ms ease-out, top 160ms ease-out, transform 160ms ease-out",
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
          </div>
        )}

        {travellingStarId ? (
          <div
            aria-hidden="true"
            className="constellationTravelTunnel pointer-events-none absolute inset-0 z-[35]"
          />
        ) : null}
      </article>

      {!loading && !selectedStar && !travellingStarId ? (
        <div className="pointer-events-none absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[94vw] -translate-x-1/2 items-center gap-2 md:bottom-4">
          <span className="rounded-full border border-white/10 bg-[#050619]/82 px-3 py-2 text-[0.56rem] font-black uppercase tracking-[0.12em] text-white/44 shadow-xl backdrop-blur-xl">
            {mobileSky ? "Drag to rotate · Pinch to zoom" : "Drag to rotate · Wheel to zoom"}
          </span>
          <span className="rounded-full border border-cyan-100/12 bg-[#071126]/86 px-3 py-2 text-[0.56rem] font-black tabular-nums text-cyan-50/62 shadow-xl backdrop-blur-xl">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={resetSkyView}
            className="pointer-events-auto min-h-9 rounded-full border border-cyan-100/15 bg-[#090b27]/90 px-3 text-[0.6rem] font-black uppercase tracking-[0.12em] text-cyan-50/78 shadow-xl backdrop-blur-xl transition hover:bg-cyan-100/10"
          >
            Reset view
          </button>
        </div>
      ) : null}

      {selectedStar ? (
        <aside className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[60] max-h-[72dvh] w-[min(92vw,22rem)] overflow-y-auto rounded-[1.7rem] border border-violet-200/16 bg-[#090b27]/94 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:bottom-4 md:right-4">
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
              <MemoryRow label="Value" value={formatMarketValue(selectedStar.marketValue)} />
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
            opacity: var(--star-opacity, 1);
            filter: brightness(1.35);
          }
          100% {
            opacity: var(--star-opacity, 1);
            filter: brightness(1);
          }
        }

        @keyframes constellationStarIn {
          0% {
            opacity: 0;
            filter: brightness(3);
          }

          60% {
            opacity: var(--star-opacity, 1);
            filter: brightness(1.8);
          }

          100% {
            opacity: var(--star-opacity, 1);
            filter: brightness(1);
          }
        }

        .constellationTravelTunnel {
          background:
            radial-gradient(circle at center, transparent 0 12%, rgba(103,232,249,0.055) 28%, transparent 62%),
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              rgba(255,255,255,0.22) 0deg,
              rgba(103,232,249,0.08) 0.18deg,
              transparent 0.65deg,
              transparent 11deg
            );
          mask-image: radial-gradient(circle at center, transparent 0 14%, #000 31%, transparent 74%);
          -webkit-mask-image: radial-gradient(circle at center, transparent 0 14%, #000 31%, transparent 74%);
          animation: constellationTravelTunnel 2320ms ease-in-out both;
          mix-blend-mode: screen;
          transform-origin: center;
        }

        @keyframes constellationTravelTunnel {
          0% {
            opacity: 0;
            transform: scale(0.82) rotate(-0.4deg);
            filter: blur(1.2px);
          }
          18% {
            opacity: 0.12;
            transform: scale(0.74) rotate(0deg);
            filter: blur(0.7px);
          }
          68% {
            opacity: 0.42;
            transform: scale(1.2) rotate(0.5deg);
            filter: blur(0.25px);
          }
          100% {
            opacity: 0;
            transform: scale(1.82) rotate(0.8deg);
            filter: blur(1px);
          }
        }

        .constellationSpatialVolume {
          isolation: isolate;
        }

        .constellationVolumeStar {
          opacity: var(--volume-opacity, 0.5);
          animation: constellationVolumeTwinkle 7s ease-in-out
            var(--volume-delay, 0s) infinite;
          will-change: left, top, width, height, opacity;
        }

        .spatialStarButton {
          will-change: left, top, transform, filter;
        }

        .constellationStarLight {
          animation: constellationGlimmer var(--glimmer-duration, 6s) ease-in-out
            var(--glimmer-delay, 0s) infinite;
          will-change: opacity;
        }

        .constellation3dPlane {
          will-change: transform;
          backface-visibility: visible;
          background:
            radial-gradient(circle at 50% 50%, rgba(103,232,249,0.025), transparent 34%),
            radial-gradient(circle at 26% 32%, rgba(167,139,250,0.018), transparent 24%),
            radial-gradient(circle at 74% 66%, rgba(244,114,182,0.016), transparent 22%);
        }

        .constellation3dPlane::before,
        .constellation3dPlane::after {
          content: "";
          position: absolute;
          inset: 4%;
          pointer-events: none;
          border-radius: 50%;
        }

        .constellation3dPlane::before {
          border: 1px solid rgba(165,243,252,0.035);
          box-shadow:
            inset 0 0 90px rgba(103,232,249,0.025),
            0 0 120px rgba(139,92,246,0.018);
          transform: translateZ(-34px) rotateZ(-8deg) scale(0.94);
        }

        .constellation3dPlane::after {
          inset: 12% 10%;
          border: 1px solid rgba(221,214,254,0.025);
          transform: translateZ(-68px) rotateZ(14deg) scale(1.08);
        }

        .constellationOrbitRing {
          transform: translate3d(-50%, -50%, -28px) rotateZ(-8deg);
          box-shadow: 0 0 38px rgba(103,232,249,0.018);
          animation: constellationOrbitDrift 28s linear infinite;
        }

        .constellationOrbitRingTwo {
          transform: translate3d(-50%, -50%, -54px) rotateZ(17deg);
          animation-direction: reverse;
          animation-duration: 36s;
        }

        .constellationAnchorStar {
          filter: brightness(1.16);
        }

        .constellationAnchorStar::after {
          content: "";
          position: absolute;
          inset: -7px;
          border-radius: 999px;
          border: 1px solid rgba(254,249,195,0.2);
          box-shadow: 0 0 20px rgba(254,249,195,0.09);
          animation: constellationAnchorBreath 3.8s ease-in-out infinite;
        }

        .constellationAurora {
          animation: constellationAuroraFloat 20s ease-in-out infinite alternate;
        }

        .constellationAuroraLate {
          animation-delay: -9s;
          animation-duration: 26s;
        }

        .constellationCompletedGlow {
          animation: constellationLineGlow 4.8s ease-in-out infinite;
        }

        .constellationCompletedCore {
          animation: constellationLineCore 4.8s ease-in-out infinite;
        }

        .constellationNebula {
          animation: constellationNebulaDrift 18s ease-in-out infinite alternate;
        }

        .constellationNebulaLate {
          animation-delay: -8s;
          animation-duration: 22s;
        }

        .shootingStar {
          position: absolute;
          width: 9rem;
          height: 1px;
          opacity: 0;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.92));
          box-shadow: 0 0 10px rgba(165,243,252,0.45);
          transform: rotate(-24deg);
          transform-origin: right center;
        }

        .shootingStar::after {
          content: "";
          position: absolute;
          right: -2px;
          top: -2px;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: white;
          box-shadow: 0 0 14px rgba(255,255,255,0.9);
        }

        .shootingStarOne {
          left: 12%;
          top: 18%;
          animation: constellationShootingStar 19s 3s linear infinite;
        }

        .shootingStarTwo {
          left: 62%;
          top: 31%;
          animation: constellationShootingStar 24s 11s linear infinite;
        }

        .shootingStarThree {
          left: 30%;
          top: 67%;
          animation: constellationShootingStar 28s 19s linear infinite;
        }

        @keyframes constellationGlimmer {
          0%, 100% {
            opacity: var(--glimmer-min, 0.5);
          }
          42% {
            opacity: 0.9;
          }
          55% {
            opacity: 1;
          }
          72% {
            opacity: 0.68;
          }
        }

        @keyframes constellationVolumeTwinkle {
          0%, 100% {
            opacity: var(--volume-opacity, 0.5);
            filter: brightness(0.62);
          }
          47% {
            opacity: var(--volume-opacity, 0.5);
            filter: brightness(1.18);
          }
          54% {
            opacity: var(--volume-opacity, 0.5);
            filter: brightness(0.78);
          }
        }

        @keyframes constellationLineGlow {
          0%, 100% {
            opacity: 0.56;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes constellationLineCore {
          0%, 100% {
            opacity: 0.72;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes constellationNebulaDrift {
          from {
            transform: translate3d(-2%, -1%, 0) scale(0.96);
            opacity: 0.55;
          }
          to {
            transform: translate3d(3%, 2%, 0) scale(1.08);
            opacity: 1;
          }
        }

        @keyframes constellationShootingStar {
          0%, 76% {
            opacity: 0;
            translate: 0 0;
          }
          78% {
            opacity: 0.95;
          }
          82% {
            opacity: 0;
            translate: 34vw 18vw;
          }
          100% {
            opacity: 0;
            translate: 34vw 18vw;
          }
        }


        @keyframes constellationOrbitDrift {
          from {
            rotate: 0deg;
          }
          to {
            rotate: 360deg;
          }
        }

        @keyframes constellationAnchorBreath {
          0%, 100% {
            opacity: 0.28;
            scale: 0.88;
          }
          50% {
            opacity: 0.82;
            scale: 1.12;
          }
        }

        @keyframes constellationAuroraFloat {
          from {
            translate: -2% -1%;
            opacity: 0.45;
          }
          to {
            translate: 3% 2%;
            opacity: 0.82;
          }
        }

        @media (max-width: 767px) {
          .constellationVolumeStar {
            animation: none;
            filter: none;
            will-change: auto;
          }

          .spatialStarButton {
            will-change: transform;
          }

          .constellationNebulaLate,
          .shootingStarTwo,
          .shootingStarThree {
            display: none;
          }

          .constellationOrbitRing {
            animation-duration: 48s;
          }

          .constellationAurora {
            animation-duration: 34s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .constellationStarLight,
          .constellationVolumeStar,
          .constellationCompletedGlow,
          .constellationCompletedCore,
          .constellationNebula,
          .constellationOrbitRing,
          .constellationAnchorStar::after,
          .constellationAurora,
          .constellationTravelTunnel,
          .shootingStar {
            animation: none !important;
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
