import { ZODIAC_SHAPES, type ZodiacShape, type ZodiacSign } from "@/lib/player/zodiac-constellations";
import { getWishRevealConfig } from "@/lib/player/wish-reveal";

export type WishRow = {
  id: string | number;
  card_id: string | number | null;
  market_value_at_wish: number | string | null;
  created_at: string | null;
};

export type CardRow = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
};

export type ConstellationStar = {
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



export type SpatialPoint = {
  x: number;
  y: number;
  z: number;
};

export type ProjectedPoint = {
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

export type VolumeStar = SpatialPoint & {
  id: string;
  size: number;
  brightness: number;
  colour: string;
  delay: number;
};

export function parseZodiacSign(value: unknown): ZodiacSign | null {
  if (typeof value !== "string") return null;
  const sign = value.toLowerCase() as ZodiacSign;
  return sign in ZODIAC_SHAPES ? sign : null;
}

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

/** A tapered cloud rather than uniform XY coordinates with four visible edges.
 * Each seed remains attached to its card, so adding cards does not reshuffle the sky.
 */
function constellationCloudPoint(random: () => number, spread = 22) {
  const limit = 53;
  const enclosed = 1 - Math.exp(-(limit * limit) / (2 * spread * spread));
  const radius = spread * Math.sqrt(-2 * Math.log(1 - random() * enclosed));
  const angle = random() * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 49 + Math.sin(angle) * radius * 0.88,
  };
}

export const VOLUME_STARS: VolumeStar[] = (() => {
  const random = seededRandom(0x51a7c0de);
  const colours = [
    "rgba(255,255,255,0.96)",
    "rgba(207,250,254,0.94)",
    "rgba(237,233,254,0.94)",
    "rgba(228,213,175,0.68)",
  ];

  return Array.from({ length: 128 }, (_, index) => {
    const depthBias = Math.pow(random(), 0.82);
    const point = constellationCloudPoint(random, 26);

    return {
      id: `volume-star-${index}`,
      x: point.x,
      y: point.y,
      z: -118 + depthBias * 190,
      size: 0.65 + random() * 1.85,
      brightness: 0.28 + random() * 0.62,
      colour: colours[Math.floor(random() * colours.length)],
      delay: -random() * 9,
    };
  });
})();

export function getZodiacSpatialPoint(
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

  const reveal = getWishRevealConfig(rarity, marketValue);
  const theme = { rank: reveal.tier, colour: reveal.primary, glow: reveal.glow };
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


function buildOrganicConstellationStars(wishes: WishRow[], cardMap: Map<string, CardRow>): ConstellationStar[] {
  const placed: ConstellationStar[]=[];
  for(const [index,wish] of wishes.entries()){
    const star=buildStar(wish,cardMap.get(String(wish.card_id??"")),index);
    const random=seededRandom(hashString(`layout:${star.id}:${star.cardId}`));
    let best={x:50,y:50,distance:-1};
    for(let attempt=0;attempt<12;attempt++){
      const point=constellationCloudPoint(random,25);
      let distance=Infinity;
      for(const other of placed.slice(-320))distance=Math.min(distance,Math.hypot(point.x-other.x,point.y-other.y));
      if(distance>best.distance)best={...point,distance};
      if(distance>2.1)break;
    }
    const radial=Math.hypot(best.x-50,(best.y-49)/.88);
    const depth=Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(random()*Math.PI*2)*20;
    placed.push({...star,x:best.x,y:best.y,z:depth*Math.sqrt(Math.max(.08,1-(radial/65)**2)),size:Math.min(16.5,Math.max(6.5,star.size))});
  }
  return placed;
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

  ambientStars.forEach((star) => {
    const random = seededRandom(
      hashString(`zodiac-scatter:${zodiacSign}:${star.id}:${star.cardId}`),
    );
    const point = constellationCloudPoint(random);

    const placement = {
      x: point.x,
      y: point.y,
      z: Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(random()*Math.PI*2)*22,
      zodiacAnchor: false,
    };

    placements.set(star.id, placement);
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
export function buildConstellationStars(
  wishes: WishRow[],
  cardMap: Map<string, CardRow>,
  zodiacSign: ZodiacSign | null,
): ConstellationStar[] {
  return zodiacSign
    ? buildZodiacConstellationStars(wishes, cardMap, zodiacSign)
    : buildOrganicConstellationStars(wishes, cardMap);
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

export function anniversaryMessage(years: number): string {
  return `${years} year${years === 1 ? "" : "s"} ago today you summoned this card.`;
}

export function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(value);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "A forgotten night";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "A forgotten night";
  }

  return LONG_DATE_FORMATTER.format(date);
}
