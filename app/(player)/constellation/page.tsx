"use client";

import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UnownText from "@/components/player/UnownText";
import { formatMarketValue } from "@/lib/player/format";
import {
  ZODIAC_SHAPES,
  type ZodiacShape,
  type ZodiacSign,
} from "@/lib/player/zodiac-constellations";
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
  rank: number;
  delay: number;
  anniversaryYears: number;
  zodiacAnchor?: boolean;
  zodiacPointIndex?: number;
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

type ProjectedStarHit = {
  star: ConstellationStar;
  x: number;
  y: number;
  radius: number;
  depth: number;
};

type ProjectedStarFrame = {
  star: ConstellationStar;
  projected: ProjectedPoint;
};

type VolumeStar = SpatialPoint & {
  id: string;
  size: number;
  brightness: number;
  colour: string;
  delay: number;
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

const MONEY_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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
  return createSpatialProjector(rotation)(point);
}

function createSpatialProjector(rotation: { x: number; y: number }) {
  const radiansX = (rotation.x * Math.PI) / 180;
  const radiansY = (rotation.y * Math.PI) / 180;
  const sinX = Math.sin(radiansX);
  const cosX = Math.cos(radiansX);
  const sinY = Math.sin(radiansY);
  const cosY = Math.cos(radiansY);

  return (point: SpatialPoint): ProjectedPoint => {
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
    rank: theme.rank,
    delay: Math.min(1200, index * 35),
    anniversaryYears: getAnniversaryYears(wish.created_at),
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
  const rarityDifference = second.rank - first.rank;

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
    {
      x: number;
      y: number;
      z: number;
      zodiacAnchor: boolean;
      zodiacPointIndex?: number;
    }
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
      zodiacPointIndex: pointIndex,
    });
  }

  const ambientStars = rankedStars.slice(anchorCount);
  const scatteredPositions: Array<{ x: number; y: number }> = [];

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
      zodiacPointIndex: placement.zodiacPointIndex,
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
  return MONEY_FORMATTER.format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "A forgotten night";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "A forgotten night";
  }

  return LONG_DATE_FORMATTER.format(date);
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
  const [earthView, setEarthView] = useState(true);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [travellingStarId, setTravellingStarId] = useState<string | null>(null);
  const [draggingSky, setDraggingSky] = useState(false);
  const skyViewportRef = useRef<HTMLElement | null>(null);
  const skyPlaneRef = useRef<HTMLDivElement | null>(null);
  const skyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const skyContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const projectedStarsScratchRef = useRef<ProjectedStarFrame[]>([]);
  const friendButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const projectedStarHitsRef = useRef<ProjectedStarHit[]>([]);
  const viewFrameRef = useRef<number | null>(null);
  const recenterFrameRef = useRef<number | null>(null);
  const wheelCommitTimerRef = useRef<number | null>(null);
  const travelAnimationRef = useRef<Animation | null>(null);
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const earthViewRef = useRef(true);
  const resetAfterCardRef = useRef(false);
  const sceneDataRef = useRef<{
    stars: ConstellationStar[];
    friendStars: FriendStar[];
    zodiacSign: ZodiacSign | null;
    constellationComplete: boolean;
    volumeStarCount: number;
    mobileSky: boolean;
    earthView: boolean;
    earthBlend: number;
    lowVisualEffects: boolean;
    selectedStarId: string | null;
    travellingStarId: string | null;
    occupiedZodiacPoints: Set<number>;
  }>({
    stars: [],
    friendStars: [],
    zodiacSign: null,
    constellationComplete: false,
    volumeStarCount: VOLUME_STARS.length,
    mobileSky: false,
    earthView: true,
    earthBlend: 1,
    lowVisualEffects: false,
    selectedStarId: null,
    travellingStarId: null,
    occupiedZodiacPoints: new Set<number>(),
  });
  const viewRef = useRef({
    rotation: { x: 0, y: 0 },
    zoom: 1,
  });
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startRotation: { x: number; y: number };
    singleStart: { x: number; y: number } | null;
    pinchDistance: number | null;
    pinchZoom: number;
    moved: boolean;
  }>({
    pointers: new Map(),
    startRotation: { x: 0, y: 0 },
    singleStart: null,
    pinchDistance: null,
    pinchZoom: 1,
    moved: false,
  });

  const clampZoom = useCallback((value: number) => {
    return Math.max(0.52, Math.min(2.4, value));
  }, []);

  const renderSkyView = useCallback(() => {
    const plane = skyPlaneRef.current;
    const canvas = skyCanvasRef.current;

    if (!plane || !canvas) {
      return;
    }

    const width = plane.clientWidth;
    const height = plane.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    const { rotation: activeRotation, zoom: activeZoom } = viewRef.current;
    const offset = cameraOffsetRef.current;
    const scene = sceneDataRef.current;
    const project = createSpatialProjector(activeRotation);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      scene.mobileSky ? 1.2 : 1.5,
    );
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    plane.style.transform = `translate3d(${offset.x}%, ${offset.y}%, 0) scale(${activeZoom})`;

    const context = skyContextRef.current || canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!context) {
      return;
    }
    skyContextRef.current = context;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const earthScale = Math.min(width * 0.9, height * 0.86);
    const projectPoint = (point: SpatialPoint): ProjectedPoint => {
      if (scene.earthBlend >= 1) {
        return {
          x: point.x,
          y: point.y,
          depth: 0,
          scale: 1,
          atmosphere: 1,
        };
      }

      return project(
        scene.earthBlend > 0
          ? { x: point.x, y: point.y, z: point.z * (1 - scene.earthBlend) }
          : point,
      );
    };
    const toCanvasPoint = (point: ProjectedPoint) => {
      const freeX = (point.x / 100) * width;
      const freeY = (point.y / 100) * height;
      const earthX = width / 2 + ((point.x - 50) / 100) * earthScale;
      const earthY = height / 2 + ((point.y - 50) / 100) * earthScale;

      return {
        x: freeX + (earthX - freeX) * scene.earthBlend,
        y: freeY + (earthY - freeY) * scene.earthBlend,
      };
    };

    const volumeLimit = Math.min(VOLUME_STARS.length, scene.volumeStarCount);
    for (let index = 0; index < volumeLimit; index += 1) {
      const star = VOLUME_STARS[index];
      const projected = projectPoint(star);
      const point = toCanvasPoint(projected);
      const radius = Math.max(0.45, star.size * projected.scale * 0.52);

      context.globalAlpha =
        star.brightness * (scene.earthView ? 0.7 : projected.atmosphere);
      context.fillStyle = star.colour;

      if (
        !scene.mobileSky &&
        !scene.lowVisualEffects &&
        projected.depth > 18
      ) {
        context.shadowColor = star.colour;
        context.shadowBlur = radius * 3;
      } else {
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
      }

      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.shadowBlur = 0;
    context.globalAlpha = 1;

    const projectedStars = projectedStarsScratchRef.current;
    projectedStars.length = scene.stars.length;
    for (let index = 0; index < scene.stars.length; index += 1) {
      const star = scene.stars[index];
      const existing = projectedStars[index];
      if (existing) {
        existing.star = star;
        existing.projected = projectPoint(star);
      } else {
        projectedStars[index] = { star, projected: projectPoint(star) };
      }
    }

    const drawLine = (
      from: ProjectedPoint,
      to: ProjectedPoint,
      colour: string,
      widthValue: number,
      dash: number[] = [],
    ) => {
      const start = toCanvasPoint(from);
      const end = toCanvasPoint(to);
      context.strokeStyle = colour;
      context.lineWidth = widthValue;
      context.lineCap = "round";
      context.setLineDash(dash);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    };

    if (scene.zodiacSign) {
      const shape = ZODIAC_SHAPES[scene.zodiacSign];
      const zodiacPoints = shape.points.map((_, index) =>
        projectPoint(getZodiacSpatialPoint(scene.zodiacSign!, index)),
      );

      for (const [fromIndex, toIndex] of shape.segments) {
        const from = zodiacPoints[fromIndex];
        const to = zodiacPoints[toIndex];
        const depthScale = (from.scale + to.scale) / 2;

        if (scene.constellationComplete) {
          drawLine(
            from,
            to,
            "rgba(103,232,249,0.17)",
            (scene.mobileSky ? 3.4 : 4.8) * depthScale,
          );
          drawLine(
            from,
            to,
            "rgba(254,249,195,0.9)",
            (scene.mobileSky ? 1.05 : 1.3) * depthScale,
          );
        } else {
          drawLine(
            from,
            to,
            "rgba(196,181,253,0.46)",
            1.05 * depthScale,
            scene.mobileSky ? [3, 5] : [5, 6],
          );
        }
      }

      context.setLineDash([]);

      const occupiedPoints = scene.occupiedZodiacPoints;

      shape.points.forEach((skyPoint, index) => {
        const projected = zodiacPoints[index];
        const point = toCanvasPoint(projected);
        const magnitudeRadius = Math.max(
          1.35,
          Math.min(3.6, (6.35 - skyPoint.magnitude) * 0.62),
        );
        const occupied = occupiedPoints.has(index);

        context.globalAlpha = occupied ? 0.48 : 0.9;
        context.fillStyle = occupied ? "#dbeafe" : "#fff8c5";
        context.shadowColor = occupied
          ? "rgba(147,197,253,0.45)"
          : "rgba(250,204,21,0.82)";
        context.shadowBlur = occupied
          ? magnitudeRadius * 2.2
          : magnitudeRadius * 4.2;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          magnitudeRadius * projected.scale,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
    } else {
      const lineLimit = Math.min(
        projectedStars.length,
        scene.mobileSky ? 140 : 320,
      );

      for (let index = 1; index < lineLimit; index += 1) {
        const previous = projectedStars[index - 1].projected;
        const current = projectedStars[index].projected;
        const depthScale = (previous.scale + current.scale) / 2;

        drawLine(
          previous,
          current,
          "rgba(196,181,253,0.3)",
          0.8 * depthScale,
          [4, 7],
        );
      }
    }

    context.setLineDash([]);
    context.shadowBlur = 0;
    context.globalAlpha = 1;

    const hits: ProjectedStarHit[] = [];

    for (const { star, projected } of projectedStars) {
      const point = toCanvasPoint(projected);
      const active =
        scene.selectedStarId === star.id ||
        scene.travellingStarId === star.id;
      const radius = Math.max(
        1.7,
        Math.min(
          active ? 11 : 8.5,
          star.size * projected.scale * (star.zodiacAnchor ? 0.42 : 0.31),
        ),
      );
      const rank = star.rank;
      const useGlow =
        active ||
        star.zodiacAnchor ||
        (!scene.lowVisualEffects && !scene.mobileSky && rank >= 4);

      context.globalAlpha = Math.min(
        1,
        (scene.earthView ? 0.92 : 0.6 + projected.atmosphere * 0.4) *
          (active ? 1 : 0.94),
      );
      context.fillStyle = star.colour;
      context.shadowColor = useGlow ? star.glow : "transparent";
      context.shadowBlur = useGlow
        ? radius * (active ? 4.6 : star.zodiacAnchor ? 3.3 : 2.4)
        : 0;
      context.beginPath();
      context.arc(point.x, point.y, active ? radius * 1.22 : radius, 0, Math.PI * 2);
      context.fill();

      if (star.anniversaryYears > 0) {
        context.globalAlpha = 0.92;
        context.fillStyle = "#fef3c7";
        context.shadowColor = "rgba(250,204,21,0.8)";
        context.shadowBlur = 7;
        context.beginPath();
        context.arc(
          point.x + radius + 2.5,
          point.y - radius - 2.5,
          1.8,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      if (
        point.x >= -24 &&
        point.x <= width + 24 &&
        point.y >= -24 &&
        point.y <= height + 24
      ) {
        hits.push({
          star,
          x: point.x,
          y: point.y,
          radius: Math.max(
            radius + 7,
            (scene.mobileSky ? 22 : 15) / Math.max(0.52, activeZoom),
          ),
          depth: projected.depth,
        });
      }
    }

    projectedStarHitsRef.current = hits;

    context.shadowBlur = 0;
    context.globalAlpha = 1;

    for (const friend of scene.friendStars) {
      const element = friendButtonRefs.current.get(friend.userId);

      if (!element) {
        continue;
      }

      const projected = projectPoint(friend);
      const point = toCanvasPoint(projected);
      element.style.visibility = "visible";
      element.style.zIndex = String(Math.round(520 + projected.depth));
      element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) scale(${projected.scale})`;
      element.style.setProperty(
        "--star-opacity",
        String(Math.min(1, 0.74 + projected.atmosphere * 0.26)),
      );
    }
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
          renderSkyView();
        },
      );
  }, [renderSkyView]);

  const recenterEarthView = useCallback(() => {
    resetAfterCardRef.current = false;
    travelAnimationRef.current?.cancel();
    travelAnimationRef.current = null;

    if (recenterFrameRef.current !== null) {
      window.cancelAnimationFrame(recenterFrameRef.current);
      recenterFrameRef.current = null;
      sceneDataRef.current.earthBlend = earthViewRef.current ? 1 : 0;
    }

    const nextRotation = { x: 0, y: 0 };
    const nextZoom = mobileSky ? 0.82 : 1;
    const nextOffset = { x: 0, y: 0 };
    const startRotation = { ...viewRef.current.rotation };
    const startZoom = viewRef.current.zoom;
    const startOffset = { ...cameraOffsetRef.current };
    const startEarthBlend = earthViewRef.current ? 1 : 0;

    setSelectedStar(null);
    setTravellingStarId(null);

    const finish = () => {
      recenterFrameRef.current = null;
      earthViewRef.current = true;
      sceneDataRef.current.earthView = true;
      sceneDataRef.current.earthBlend = 1;
      viewRef.current = {
        rotation: nextRotation,
        zoom: nextZoom,
      };
      cameraOffsetRef.current = nextOffset;
      setRotation(nextRotation);
      setZoom(nextZoom);
      setCameraOffset(nextOffset);
      setEarthView(true);
      gestureRef.current.startRotation = nextRotation;
      gestureRef.current.pinchZoom = nextZoom;
      window.requestAnimationFrame(renderSkyView);
    };

    if (preferences.reducedMotion) {
      finish();
      return;
    }

    const startedAt = performance.now();
    const duration = 780;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextFrameRotation = {
        x: startRotation.x + (nextRotation.x - startRotation.x) * eased,
        y: startRotation.y + (nextRotation.y - startRotation.y) * eased,
      };
      const nextFrameZoom = startZoom + (nextZoom - startZoom) * eased;
      const nextFrameOffset = {
        x: startOffset.x + (nextOffset.x - startOffset.x) * eased,
        y: startOffset.y + (nextOffset.y - startOffset.y) * eased,
      };

      viewRef.current = {
        rotation: nextFrameRotation,
        zoom: nextFrameZoom,
      };
      cameraOffsetRef.current = nextFrameOffset;
      sceneDataRef.current.earthBlend =
        startEarthBlend + (1 - startEarthBlend) * eased;
      renderSkyView();

      if (progress < 1) {
        recenterFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        finish();
      }
    };

    recenterFrameRef.current = window.requestAnimationFrame(animate);
  }, [mobileSky, preferences.reducedMotion, renderSkyView]);

  const nudgeZoom = useCallback((direction: -1 | 1) => {
    const nextZoom = clampZoom(
      viewRef.current.zoom * (direction > 0 ? 1.18 : 0.84),
    );

    queueSkyView({ zoom: nextZoom });
    setZoom(nextZoom);
  }, [clampZoom, queueSkyView]);

  const travelToStar = useCallback((star: ConstellationStar) => {
    travelAnimationRef.current?.cancel();
    travelAnimationRef.current = null;

    if (recenterFrameRef.current !== null) {
      window.cancelAnimationFrame(recenterFrameRef.current);
      recenterFrameRef.current = null;
      sceneDataRef.current.earthBlend = earthViewRef.current ? 1 : 0;
    }

    const activeRotation = viewRef.current.rotation;
    const projected = projectSpatialPoint(
      earthViewRef.current ? { ...star, z: 0 } : star,
      activeRotation,
    );
    const plane = skyPlaneRef.current;
    const startZoom = viewRef.current.zoom;
    const startOffset = cameraOffsetRef.current;
    const targetZoom = clampZoom(mobileSky ? 1.38 : 1.72);
    const earthScale = plane
      ? Math.min(plane.clientWidth * 0.9, plane.clientHeight * 0.86)
      : 1;
    const targetOffset = {
      x:
        (50 - projected.x) *
        targetZoom *
        (earthViewRef.current && plane
          ? earthScale / Math.max(1, plane.clientWidth)
          : 1),
      y:
        (50 - projected.y) *
        targetZoom *
        (earthViewRef.current && plane
          ? earthScale / Math.max(1, plane.clientHeight)
          : 1),
    };

    setSelectedStar(null);
    setInfoPanelOpen(false);

    if (preferences.reducedMotion || preferences.lowVisualEffects) {
      viewRef.current.zoom = targetZoom;
      cameraOffsetRef.current = targetOffset;
      setZoom(targetZoom);
      setCameraOffset(targetOffset);
      setTravellingStarId(null);
      resetAfterCardRef.current = true;
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
    if (!plane) {
      viewRef.current.zoom = targetZoom;
      cameraOffsetRef.current = targetOffset;
      setZoom(targetZoom);
      setCameraOffset(targetOffset);
      resetAfterCardRef.current = true;
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
      resetAfterCardRef.current = true;
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

      if (recenterFrameRef.current !== null) {
        window.cancelAnimationFrame(recenterFrameRef.current);
        recenterFrameRef.current = null;
      }

      const mobile = media.matches;
      const nextRotation = { x: 0, y: 0 };
      const nextZoom =
        mobile ? 0.82 : 1;

      earthViewRef.current = true;
      sceneDataRef.current.earthView = true;
      sceneDataRef.current.earthBlend = 1;
      viewRef.current = {
        rotation: nextRotation,
        zoom: nextZoom,
      };
      cameraOffsetRef.current = { x: 0, y: 0 };
      resetAfterCardRef.current = false;
      setMobileSky(mobile);
      setInfoPanelOpen(!mobile);
      setZoom(nextZoom);
      setRotation(nextRotation);
      setCameraOffset({ x: 0, y: 0 });
      setEarthView(true);
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

      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current);
      }

      if (recenterFrameRef.current !== null) {
        window.cancelAnimationFrame(recenterFrameRef.current);
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

    if (recenterFrameRef.current !== null) {
      window.cancelAnimationFrame(recenterFrameRef.current);
      recenterFrameRef.current = null;
      sceneDataRef.current.earthBlend = earthViewRef.current ? 1 : 0;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.pointers.size === 1) {
      gesture.singleStart = { x: event.clientX, y: event.clientY };
      gesture.startRotation = viewRef.current.rotation;
      gesture.pinchDistance = null;
      gesture.pinchZoom = viewRef.current.zoom;
      gesture.moved = false;
      setDraggingSky(true);
      return;
    }

    if (gesture.pointers.size === 2) {
      const [first, second] = Array.from(gesture.pointers.values());
      gesture.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      gesture.pinchZoom = viewRef.current.zoom;
      gesture.singleStart = null;
      gesture.moved = true;
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
      if (resetAfterCardRef.current) {
        resetAfterCardRef.current = false;
        gesture.pointers.clear();
        setDraggingSky(false);
        recenterEarthView();
        return;
      }

      gesture.moved = true;
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

      if (Math.hypot(deltaX, deltaY) < 5) {
        return;
      }

      if (resetAfterCardRef.current) {
        resetAfterCardRef.current = false;
        gesture.moved = true;
        gesture.pointers.clear();
        setDraggingSky(false);
        recenterEarthView();
        return;
      }

      gesture.moved = true;

      if (earthViewRef.current) {
        earthViewRef.current = false;
        sceneDataRef.current.earthView = false;
        sceneDataRef.current.earthBlend = 0;
        setEarthView(false);
      }

      queueSkyView({
        rotation: {
          x: Math.max(-48, Math.min(48, gesture.startRotation.x - deltaY * 0.16)),
          y: Math.max(-68, Math.min(68, gesture.startRotation.y + deltaX * 0.19)),
        },
      });
    }
  }, [clampZoom, queueSkyView, recenterEarthView]);

  const finishSkyPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    const wasSinglePointer = gesture.pointers.size === 1;
    const wasTap = wasSinglePointer && !gesture.moved;
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
      gesture.moved = false;
      setDraggingSky(false);
      setRotation({ ...viewRef.current.rotation });
      setZoom(viewRef.current.zoom);

      if (wasTap && !sceneDataRef.current.travellingStarId) {
        const plane = skyPlaneRef.current;

        if (plane) {
          const bounds = plane.getBoundingClientRect();
          const localX =
            ((event.clientX - bounds.left) / Math.max(1, bounds.width)) *
            plane.clientWidth;
          const localY =
            ((event.clientY - bounds.top) / Math.max(1, bounds.height)) *
            plane.clientHeight;
          let hit: ProjectedStarHit | null = null;
          let hitDistance = Number.POSITIVE_INFINITY;
          for (const candidate of projectedStarHitsRef.current) {
            const distance = Math.hypot(
              localX - candidate.x,
              localY - candidate.y,
            );
            if (distance > candidate.radius) continue;
            if (
              distance < hitDistance ||
              (distance === hitDistance && candidate.depth > (hit?.depth ?? -Infinity))
            ) {
              hit = candidate;
              hitDistance = distance;
            }
          }

          if (hit) {
            travelToStar(hit.star);
          }
        }
      }
    }
  }, [travelToStar]);

  const handleSkyWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();

    // A card journey leaves the camera focused on the selected star. The
    // first desktop scroll must restore the whole sky instead of zooming that
    // focused camera farther away and making the constellation impossible to
    // find. Mobile uses the same rule for pinch/drag above.
    if (resetAfterCardRef.current) {
      resetAfterCardRef.current = false;
      recenterEarthView();
      return;
    }

    const multiplier = Math.exp(-event.deltaY * 0.00135);
    queueSkyView({
      zoom: clampZoom(
        viewRef.current.zoom *
          multiplier,
      ),
    });

    if (wheelCommitTimerRef.current !== null) {
      window.clearTimeout(wheelCommitTimerRef.current);
    }

    wheelCommitTimerRef.current = window.setTimeout(() => {
      wheelCommitTimerRef.current = null;
      setRotation({ ...viewRef.current.rotation });
      setZoom(viewRef.current.zoom);
    }, 140);
  }, [clampZoom, queueSkyView, recenterEarthView]);

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
    const frame = window.requestAnimationFrame(() => {
      void loadConstellation(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadConstellation]);

  const totalValue = useMemo(
    () => stars.reduce((sum, star) => sum + star.marketValue, 0),
    [stars],
  );

  const rarestStar = useMemo(() => stars.reduce<ConstellationStar | null>(
    (best, star) => {
      if (!best || star.rank > best.rank) return star;
      if (star.rank === best.rank && star.marketValue > best.marketValue) return star;
      return best;
    },
    null,
  ), [stars]);

  const occupiedZodiacPoints = useMemo(() => new Set(
    stars.flatMap((star) =>
      star.zodiacAnchor && typeof star.zodiacPointIndex === "number"
        ? [star.zodiacPointIndex]
        : [],
    ),
  ), [stars]);

  const zodiacAnchorRequirement = zodiacSign
    ? ZODIAC_SHAPES[zodiacSign].points.length
    : 0;
  const zodiacAnchorsFilled = zodiacSign
    ? Math.min(
        zodiacAnchorRequirement,
        occupiedZodiacPoints.size,
      )
    : 0;
  const constellationComplete =
    Boolean(zodiacSign) && zodiacAnchorRequirement > 0 && zodiacAnchorsFilled >= zodiacAnchorRequirement;

  const volumeStarCount = preferences.dataSaver
    ? 28
    : preferences.lowVisualEffects
      ? 48
      : mobileSky
        ? 64
        : VOLUME_STARS.length;

  useEffect(() => {
    earthViewRef.current = earthView;
    sceneDataRef.current = {
      stars,
      friendStars,
      zodiacSign,
      constellationComplete,
      volumeStarCount,
      mobileSky,
      earthView,
      earthBlend:
        recenterFrameRef.current !== null
          ? sceneDataRef.current.earthBlend
          : earthView
            ? 1
            : 0,
      lowVisualEffects:
        preferences.lowVisualEffects || preferences.dataSaver,
      selectedStarId: selectedStar?.id ?? null,
      travellingStarId,
      occupiedZodiacPoints,
    };
  }, [
    constellationComplete,
    earthView,
    friendStars,
    mobileSky,
    occupiedZodiacPoints,
    preferences.dataSaver,
    preferences.lowVisualEffects,
    selectedStar,
    stars,
    travellingStarId,
    volumeStarCount,
    zodiacSign,
  ]);

  useEffect(() => {
    if (loading || !skyPlaneRef.current) {
      return;
    }

    let frame = window.requestAnimationFrame(renderSkyView);
    const plane = skyPlaneRef.current;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(renderSkyView);
    });

    observer.observe(plane);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    constellationComplete,
    earthView,
    friendStars,
    loading,
    mobileSky,
    preferences.dataSaver,
    preferences.lowVisualEffects,
    renderSkyView,
    rotation,
    selectedStar,
    stars,
    travellingStarId,
    zodiacSign,
    zoom,
  ]);

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
      <div className="absolute inset-x-3 top-[4.75rem] z-40 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-[1.6rem] border border-violet-200/12 bg-[#080a25]/88 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:inset-x-auto sm:left-5 sm:top-5 sm:max-w-[min(92vw,34rem)] sm:p-5">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/38">
              Nebu&apos;s memory
            </p>
            <div className="mt-2 overflow-hidden">
              <UnownText
                text="Your Constellation"
                size="clamp(0.92rem, 4.8vw, 2.45rem)"
                tone="holo"
              />
            </div>
            {zodiacSign ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
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
                  <span
                    title="Real J2000 star coordinates. The IAU standardises constellation boundaries rather than a single official line figure."
                    className="rounded-full border border-yellow-100/14 bg-yellow-200/[0.055] px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-yellow-50/62"
                  >
                    J2000 · {ZODIAC_SHAPES[zodiacSign].iauCode}
                  </span>
                </div>
                <p className="mt-2 text-[0.66rem] font-bold text-white/30">
                  Real celestial positions · north up · east left in Earth view
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-white/28">
                Choose a star sign in Profile to shape your sky.
              </p>
            )}
          </div>

          <div className="flex flex-none items-center justify-end gap-2">
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
          className="absolute left-3 top-[4.75rem] z-40 flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/18 bg-[#080a25]/88 px-4 text-[0.68rem] font-black uppercase tracking-[0.13em] text-cyan-50/82 shadow-[0_15px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-cyan-100/35 hover:bg-[#10143a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:left-5 sm:top-5"
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

      {earthView && !loading && zodiacSign ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 z-30 h-20 w-20 -translate-y-1/2 rounded-full border border-cyan-100/10 bg-[#050619]/38 text-[0.52rem] font-black uppercase tracking-[0.12em] text-cyan-50/38 shadow-[0_0_36px_rgba(103,232,249,0.055)] backdrop-blur-sm sm:right-5"
        >
          <span className="absolute left-1/2 top-1 -translate-x-1/2">N</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2">S</span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2">E</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2">W</span>
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-100/65 shadow-[0_0_10px_rgba(250,204,21,0.65)]" />
          <span className="absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 bg-cyan-100/10" />
          <span className="absolute left-1/2 top-1/2 h-10 w-px -translate-y-1/2 bg-cyan-100/10" />
        </div>
      ) : null}

      <article
        data-onboarding-target="constellation"
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

            <canvas
              ref={skyCanvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

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

            {stars.length > 0 ? (
              <select
                className="sr-only"
                aria-label="Choose a card star"
                value=""
                onChange={(event) => {
                  const star = stars.find(
                    (candidate) => candidate.id === event.target.value,
                  );

                  if (star) {
                    travelToStar(star);
                  }
                }}
              >
                <option value="">Choose a card star</option>
                {stars.map((star) => (
                  <option key={star.id} value={star.id}>
                    {star.name} — {star.rarity}
                  </option>
                ))}
              </select>
            ) : null}

            {friendStars.map((friend) => (
              <button
                ref={(element) => {
                  if (element) {
                    friendButtonRefs.current.set(friend.userId, element);
                  } else {
                    friendButtonRefs.current.delete(friend.userId);
                  }
                }}
                key={`friend-${friend.userId}`}
                type="button"
                onClick={() => router.push(`/friends/${encodeURIComponent(friend.userId)}`)}
                aria-label={`Open ${friend.displayName}'s trainer profile`}
                className="group absolute z-40 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-100/28 bg-[#090b27]/90 shadow-[0_0_28px_rgba(103,232,249,0.38)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-yellow-100/45 hover:bg-[#10133a]/95 hover:shadow-[0_0_36px_rgba(250,204,21,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100"
                style={{
                  left: 0,
                  top: 0,
                  visibility: "hidden",
                  animation: `friendStarIn 700ms ${friend.delay}ms ease-out both`,
                }}
              >
                <span className="pointer-events-none absolute inset-0 transition-transform duration-200 group-hover:scale-110">
                  <span className="absolute -inset-2 rounded-full bg-cyan-200/10 blur-md" />
                  <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-50/45 bg-cyan-100/18 shadow-[0_0_18px_rgba(103,232,249,0.72)]" />
                </span>
                <span className="relative z-10 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-[#11143b] transition-transform duration-200 group-hover:scale-110">
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[0.62rem] font-black text-white">
                      {friend.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#07091f]/95 px-2.5 py-1 text-[0.58rem] font-black text-white/80 shadow-xl group-hover:block group-focus-visible:block">
                  {friend.displayName}
                </span>
              </button>
            ))}

            <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-white/[0.06] bg-[#050619]/55 px-4 py-2 text-[0.56rem] font-black uppercase tracking-[0.16em] text-white/24 backdrop-blur-md">
              <span>Tap a card star to travel through your archive</span>
              {friendStars.length > 0 ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-cyan-100/36">Glowing circles are friends</span>
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
        <div className="pointer-events-auto absolute bottom-[calc(0.8rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#050619]/88 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl md:bottom-4 md:gap-2">
          <span className="hidden px-2 text-[0.56rem] font-black uppercase tracking-[0.12em] text-white/38 lg:inline">
            {mobileSky ? "Drag to rotate · pinch to zoom" : "Drag to rotate · wheel to zoom"}
          </span>
          <button
            type="button"
            onClick={() => nudgeZoom(-1)}
            aria-label="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-lg font-black text-white/62 transition hover:bg-white/10 hover:text-white"
          >
            −
          </button>
          <span className="min-w-12 text-center text-[0.6rem] font-black tabular-nums text-cyan-50/68">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => nudgeZoom(1)}
            aria-label="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-lg font-black text-white/62 transition hover:bg-white/10 hover:text-white"
          >
            +
          </button>
          <button
            type="button"
            onClick={recenterEarthView}
            className={[
              "min-h-9 rounded-full border px-3 text-[0.58rem] font-black uppercase tracking-[0.1em] transition sm:px-4",
              earthView
                ? "border-yellow-100/24 bg-yellow-200/[0.1] text-yellow-50 shadow-[0_0_20px_rgba(250,204,21,0.08)]"
                : "border-cyan-100/16 bg-cyan-200/[0.07] text-cyan-50/82 hover:bg-cyan-100/12",
            ].join(" ")}
          >
            <span aria-hidden="true">◎ </span>
            {earthView ? "Earth view" : "View from Earth"}
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
              <h2 className="mt-1 max-w-full break-words text-[clamp(1rem,5.4vw,1.25rem)] font-black leading-tight tracking-tight text-white [overflow-wrap:anywhere]">
                {selectedStar.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStar(null);
                resetAfterCardRef.current = true;
              }}
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
                  ●
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

          {selectedStar.anniversaryYears > 0 ? (
            <div className="mt-3 rounded-xl border border-yellow-100/15 bg-yellow-200/[0.06] p-3">
              <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-yellow-100/55">
                ✦ Wish anniversary
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-yellow-50/78">
                {anniversaryMessage(selectedStar.anniversaryYears)}
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

        .constellationAurora {
          animation: constellationAuroraFloat 20s ease-in-out infinite alternate;
        }

        .constellationAuroraLate {
          animation-delay: -9s;
          animation-duration: 26s;
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
          .constellationNebulaLate,
          .shootingStarTwo,
          .shootingStarThree {
            display: none;
          }

          .constellationNebula,
          .constellationOrbitRing,
          .constellationAurora,
          .shootingStar {
            animation: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .constellationNebula,
          .constellationOrbitRing,
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
