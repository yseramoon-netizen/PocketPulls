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
      { x: 24, y: 58 }, { x: 34, y: 48 }, { x: 45, y: 43 },
      { x: 57, y: 46 }, { x: 66, y: 39 }, { x: 76, y: 31 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  },
  taurus: {
    label: "Taurus",
    points: [
      { x: 22, y: 32 }, { x: 36, y: 44 }, { x: 49, y: 50 },
      { x: 63, y: 45 }, { x: 78, y: 30 }, { x: 58, y: 62 },
      { x: 43, y: 66 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]],
  },
  gemini: {
    label: "Gemini",
    points: [
      { x: 31, y: 24 }, { x: 31, y: 72 }, { x: 68, y: 25 },
      { x: 68, y: 72 }, { x: 40, y: 42 }, { x: 59, y: 42 },
      { x: 40, y: 58 }, { x: 59, y: 58 },
    ],
    segments: [[0,1],[2,3],[0,2],[1,3],[4,5],[6,7]],
  },
  cancer: {
    label: "Cancer",
    points: [
      { x: 22, y: 40 }, { x: 38, y: 48 }, { x: 50, y: 52 },
      { x: 63, y: 46 }, { x: 78, y: 37 }, { x: 48, y: 70 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[2,5]],
  },
  leo: {
    label: "Leo",
    points: [
      { x: 22, y: 66 }, { x: 33, y: 54 }, { x: 42, y: 38 },
      { x: 55, y: 31 }, { x: 67, y: 36 }, { x: 75, y: 49 },
      { x: 69, y: 62 }, { x: 56, y: 67 }, { x: 43, y: 60 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,2]],
  },
  virgo: {
    label: "Virgo",
    points: [
      { x: 21, y: 34 }, { x: 35, y: 42 }, { x: 47, y: 49 },
      { x: 60, y: 43 }, { x: 76, y: 35 }, { x: 56, y: 61 },
      { x: 69, y: 72 }, { x: 42, y: 66 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[5,7]],
  },
  libra: {
    label: "Libra",
    points: [
      { x: 25, y: 65 }, { x: 37, y: 45 }, { x: 50, y: 33 },
      { x: 63, y: 45 }, { x: 75, y: 65 }, { x: 50, y: 65 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[0,5],[5,4]],
  },
  scorpio: {
    label: "Scorpio",
    points: [
      { x: 18, y: 37 }, { x: 31, y: 43 }, { x: 43, y: 50 },
      { x: 55, y: 56 }, { x: 66, y: 54 }, { x: 76, y: 45 },
      { x: 80, y: 33 }, { x: 71, y: 27 }, { x: 66, y: 36 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]],
  },
  sagittarius: {
    label: "Sagittarius",
    points: [
      { x: 22, y: 68 }, { x: 37, y: 55 }, { x: 50, y: 47 },
      { x: 64, y: 38 }, { x: 78, y: 24 }, { x: 66, y: 25 },
      { x: 78, y: 37 }, { x: 44, y: 67 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5],[4,6],[2,7]],
  },
  capricorn: {
    label: "Capricorn",
    points: [
      { x: 20, y: 39 }, { x: 35, y: 31 }, { x: 51, y: 38 },
      { x: 65, y: 51 }, { x: 76, y: 65 }, { x: 60, y: 70 },
      { x: 45, y: 62 }, { x: 31, y: 52 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
  },
  aquarius: {
    label: "Aquarius",
    points: [
      { x: 19, y: 35 }, { x: 32, y: 44 }, { x: 45, y: 35 },
      { x: 58, y: 44 }, { x: 71, y: 35 }, { x: 81, y: 43 },
      { x: 23, y: 61 }, { x: 36, y: 70 }, { x: 49, y: 61 },
      { x: 62, y: 70 }, { x: 75, y: 61 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,4],[4,5],[6,7],[7,8],[8,9],[9,10]],
  },
  pisces: {
    label: "Pisces",
    points: [
      { x: 20, y: 33 }, { x: 31, y: 25 }, { x: 39, y: 36 },
      { x: 31, y: 47 }, { x: 45, y: 50 }, { x: 56, y: 50 },
      { x: 69, y: 53 }, { x: 79, y: 65 }, { x: 69, y: 75 },
      { x: 60, y: 64 },
    ],
    segments: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,6]],
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

function buildZodiacConstellationStars(
  wishes: WishRow[],
  cardMap: Map<string, CardRow>,
  zodiacSign: ZodiacSign,
): ConstellationStar[] {
  const shape = ZODIAC_SHAPES[zodiacSign];
  const segments = shape.segments;

  return wishes.map((wish, index) => {
    const base = buildStar(
      wish,
      cardMap.get(String(wish.card_id ?? "")),
      index,
    );
    const random = seededRandom(
      hashString(`zodiac:${zodiacSign}:${base.id}:${base.cardId}`),
    );
    const segmentIndex = index % segments.length;
    const cycle = Math.floor(index / segments.length);
    const [fromIndex, toIndex] = segments[segmentIndex];
    const from = shape.points[fromIndex];
    const to = shape.points[toIndex];

    const cycleOffset = ((cycle * 0.61803398875) % 1);
    const progress = Math.max(
      0.05,
      Math.min(0.95, (cycleOffset + random() * 0.16) % 1),
    );

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const perpendicularX = -dy / length;
    const perpendicularY = dx / length;

    const band = Math.floor(cycle / 9);
    const side = cycle % 2 === 0 ? 1 : -1;
    const cloudSpread = Math.min(7.5, 1.1 + band * 0.58);
    const perpendicularOffset =
      side * (0.7 + random() * cloudSpread) +
      (random() - 0.5) * 1.4;
    const alongOffset = (random() - 0.5) * Math.min(2.8, 0.8 + band * 0.18);

    const x = Math.max(
      9,
      Math.min(
        91,
        from.x + dx * progress + (dx / length) * alongOffset + perpendicularX * perpendicularOffset,
      ),
    );
    const y = Math.max(
      10,
      Math.min(
        89,
        from.y + dy * progress + (dy / length) * alongOffset + perpendicularY * perpendicularOffset,
      ),
    );

    return {
      ...base,
      x,
      y,
      size: Math.min(16.5, Math.max(6.5, base.size)),
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
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/76 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/45 to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/40">
            Jirachi&apos;s memory
          </p>

          <div className="mt-4 max-w-full overflow-hidden">
            <UnownText
              text="Your Constellation"
              size="clamp(1.9rem, 4.6vw, 3.75rem)"
              tone="holo"
            />
          </div>

          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
            Every card Jirachi has granted you lives here as a permanent
            light. Better rarities burn brighter and valuable cards glow larger.
          </p>

          {zodiacSign ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-200/15 bg-violet-300/[0.07] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-violet-100/65">
              <span aria-hidden="true">✦</span>
              {ZODIAC_SHAPES[zodiacSign].label} sky
            </div>
          ) : (
            <p className="mt-4 text-xs font-bold text-white/28">
              Choose a star sign in Profile to shape your sky.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            void loadConstellation(true);
          }}
          disabled={refreshing}
          className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          {refreshing ? "Reading the stars..." : "Refresh constellation"}
        </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-200/15 bg-red-400/[0.08] p-4 text-sm font-semibold text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Stars"
          value={String(stars.length)}
          detail={getMilestoneMessage(stars.length)}
        />

        <StatCard
          label="Starlight value"
          value={formatMoney(totalValue)}
          detail="Value when each wish was granted"
        />

        <StatCard
          label="Brightest star"
          value={rarestStar?.name || "Waiting"}
          detail={
            rarestStar
              ? rarestStar.rarity
              : "Your first wish will appear here"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <article className="relative min-h-[680px] overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#050619] shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(103,232,249,0.08),transparent_32%),radial-gradient(circle_at_25%_15%,rgba(196,181,253,0.08),transparent_27%),radial-gradient(circle_at_80%_20%,rgba(249,168,212,0.06),transparent_25%)]" />

          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_10%_18%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_21%_43%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_38%_17%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_55%_29%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_69%_12%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_82%_37%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_91%_18%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_14%_72%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_36%_82%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_62%_69%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_84%_79%,white_0_1px,transparent_1.5px)]" />

          {loading ? (
            <div className="relative z-10 flex min-h-[680px] flex-col items-center justify-center text-center">
              <div className="h-16 w-16 animate-pulse rounded-full bg-white shadow-[0_0_55px_18px_rgba(255,255,255,0.3)]" />

              <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Rebuilding your night sky
              </p>
            </div>
          ) : (
            <div className="relative z-10 min-h-[680px]">
              {stars.length > 0 ? (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
                >
                  {zodiacSign
                    ? ZODIAC_SHAPES[zodiacSign].segments.map(
                        ([fromIndex, toIndex], index) => {
                          const from = ZODIAC_SHAPES[zodiacSign].points[fromIndex];
                          const to = ZODIAC_SHAPES[zodiacSign].points[toIndex];

                          return (
                            <line
                              key={`zodiac-${zodiacSign}-${index}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="rgba(254,249,195,0.76)"
                              strokeWidth="0.22"
                              strokeDasharray="0.8 1.1"
                            />
                          );
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
                            stroke="rgba(196,181,253,0.65)"
                            strokeWidth="0.12"
                            strokeDasharray="0.6 1.1"
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
                const hitSize = Math.max(22, star.size + 12);
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
                      active ? "z-20 scale-[1.08]" : "z-10 hover:scale-110",
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
                          ? `0 0 ${star.size * 2.8}px ${star.size * 0.72}px ${star.glow}`
                          : `0 0 ${star.size * 1.8}px ${star.size * 0.4}px ${star.glow}`,
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
                  className="group absolute z-30 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/25 bg-[#090b27]/90 shadow-[0_0_24px_rgba(103,232,249,0.34)] transition duration-200 hover:scale-125 hover:border-yellow-100/45 hover:shadow-[0_0_32px_rgba(250,204,21,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100"
                  style={{
                    left: `${friend.x}%`,
                    top: `${friend.y}%`,
                    transform: "translate(-50%, -50%)",
                    animation: `friendStarIn 700ms ${friend.delay}ms ease-out both`,
                  }}
                >
                  <span className="pointer-events-none absolute -inset-2 rounded-full bg-cyan-200/10 blur-md" />
                  <span className="pointer-events-none absolute text-[2.1rem] leading-none text-cyan-100/80 drop-shadow-[0_0_12px_rgba(103,232,249,0.75)]">
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

              <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap text-[0.56rem] font-black uppercase tracking-[0.16em] text-white/20">
                <span>Select a light to remember its wish</span>
                {friendStars.length > 0 ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span className="text-cyan-100/30">Large stars are friends</span>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </article>

        <aside className="overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/85 p-5 backdrop-blur-xl">
          {selectedStar ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    background: `radial-gradient(circle at 50% 35%, ${selectedStar.glow}, transparent 55%)`,
                  }}
                />

                <div className="relative mx-auto aspect-[0.716] w-full max-w-[15rem] overflow-hidden rounded-xl bg-[#050713] shadow-[0_20px_55px_rgba(0,0,0,0.55)]">
                  {selectedStar.imageUrl ? (
                    <img
                      src={selectedStar.imageUrl}
                      alt={selectedStar.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-5 text-center">
                      <span
                        className="text-7xl"
                        style={{
                          color: selectedStar.colour,
                          filter: `drop-shadow(0 0 22px ${selectedStar.glow})`,
                        }}
                      >
                        *
                      </span>

                      <strong className="text-white">
                        {selectedStar.name}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <p
                  className="text-[0.62rem] font-black uppercase tracking-[0.18em]"
                  style={{ color: selectedStar.colour }}
                >
                  {selectedStar.rarity}
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {selectedStar.name}
                </h2>

                <p className="mt-2 text-sm font-semibold text-white/40">
                  {[
                    selectedStar.setName,
                    selectedStar.cardNumber
                      ? `#${selectedStar.cardNumber}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>

                <div className="mt-5 space-y-3">
                  <MemoryRow
                    label="Wish granted"
                    value={formatDate(selectedStar.grantedAt)}
                  />

                  <MemoryRow
                    label="Value that night"
                    value={formatMoney(selectedStar.marketValue)}
                  />

                  <MemoryRow
                    label="Star number"
                    value={`#${stars.findIndex(
                      (star) => star.id === selectedStar.id,
                    ) + 1}`}
                  />
                </div>

                {getAnniversaryYears(selectedStar.grantedAt) > 0 ? (
                  <div className="mt-4 rounded-xl border border-yellow-100/15 bg-yellow-200/[0.06] p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-yellow-100/55">
                      ✦ Wish anniversary
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-yellow-50/80">
                      {anniversaryMessage(getAnniversaryYears(selectedStar.grantedAt))}
                    </p>
                  </div>
                ) : null}

                <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold italic leading-6 text-white/40">
                  “A wish remembered becomes a light that never disappears.”
                </p>
              </div>
            </>
          ) : (
            <div className="flex min-h-[34rem] flex-col items-center justify-center text-center">
              <span className="text-7xl text-yellow-100/25">*</span>
              <p className="mt-4 text-sm font-bold text-white/35">
                Select a star from your sky.
              </p>
            </div>
          )}
        </aside>
      </div>

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

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>

      <p className="mt-3 truncate text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-white/30">
        {detail}
      </p>
    </article>
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
