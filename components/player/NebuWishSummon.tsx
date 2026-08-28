"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type { NebuSkinKey } from "@/lib/player/nebu";

import styles from "./NebuWishSummon.module.css";

const KEYPOSE_SHEET =
  "/ancient-pulls/wish/nebu-cinematic/nebu-keyposes-v2.webp";
const FOUNDER_KEYPOSE_SHEETS: Readonly<
  Partial<Record<NebuSkinKey, string>>
> = {
  sherry: "/ancient-pulls/wish/nebu-cinematic/sherry-keyposes-v1.png",
  bubbles: "/ancient-pulls/wish/nebu-cinematic/bubbles-keyposes-v1.png",
};
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 2;
const POSE_WIDTH = 768;
const POSE_HEIGHT = 1024;
const TAU = Math.PI * 2;
const STRUGGLE_FRAME_MS = 1000 / 24;

type NebuWishSummonProps = {
  tier: number;
  nebuSkin: NebuSkinKey;
  stageMomentsMs: readonly number[];
  specialAtMs: number;
  impactAtMs: number;
  cardRevealAtMs: number;
  blackHole?: boolean;
  lowEffects?: boolean;
};

// These are the colour treatments used by the equipped badge skins elsewhere
// in the app, without their CSS drop shadows. The full atlas is treated once
// after loading so every pose, aura echo, and black-hole slice stays identical
// without repeating palette conversion inside the frame loop.
const NEBU_ATLAS_FILTERS: Readonly<Record<NebuSkinKey, string>> = {
  midnight: "none",
  nile: "hue-rotate(300deg) saturate(1.28) brightness(1.08)",
  lotus: "hue-rotate(88deg) saturate(1.32) brightness(1.06)",
  scarab: "hue-rotate(232deg) saturate(1.35) brightness(1.05)",
  sunstone: "sepia(0.62) saturate(1.65) hue-rotate(338deg) brightness(1.08)",
  royal: "hue-rotate(48deg) saturate(1.42) brightness(1.06)",
  pearl: "grayscale(0.82) saturate(0.7) brightness(1.2) contrast(0.96)",
  // Founder characters use dedicated hand-authored pose sheets. Never pass
  // them through the global badge filters or their eyes/coats drift.
  sherry: "none",
  bubbles: "none",
  cosmic_nebu: "saturate(1.16) contrast(1.08)",
};

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];

const NEBU_SKIN_LIGHTS: Readonly<Record<NebuSkinKey, Rgb>> = {
  midnight: [69, 215, 200],
  nile: [185, 255, 244],
  lotus: [101, 224, 163],
  scarab: [85, 234, 216],
  sunstone: [255, 241, 184],
  royal: [158, 233, 180],
  pearl: [165, 243, 252],
  sherry: [34, 166, 90],
  bubbles: [145, 173, 71],
  cosmic_nebu: [103, 232, 249],
};

type Theme = {
  primary: Rgb;
  secondary: Rgb;
  glow: Rgb;
};

type StruggleSample = {
  levelIndex: number;
  progress: number;
  frameIndex: number;
  sampledAtMs: number;
};

type PoseMoment = {
  from: number;
  to: number;
  mix: number;
};

type CharacterTransform = {
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  alpha: number;
};

type EffectSurface = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  pixelRatio: number;
};

type SparkSeed = {
  angle: number;
  phase: number;
  radius: number;
  size: number;
  speed: number;
};

type RenderEnvironment = {
  width: number;
  height: number;
  characterHeight: number;
  centerX: number;
  centerY: number;
  tierIntensity: number;
  nebuSkin: NebuSkinKey;
  reducedMotion: boolean;
  lowEffects: boolean;
  theme: Theme;
  skinLight: Rgb;
  sparks: readonly SparkSeed[];
  effectSurface: EffectSurface;
};

const PAW_POSITION_BY_POSE: Readonly<Record<number, readonly [number, number]>> = {
  1: [500, 284],
  2: [544, 224],
  3: [560, 228],
  4: [572, 696],
};

const NEUTRAL_STRUGGLE_THEME: Theme = {
  primary: [226, 232, 240],
  secondary: [148, 163, 184],
  glow: [241, 245, 249],
};

// Candidate colours escalate in a fixed public order. A colour means that
// level has been reached, never that it is the final result. Only the swipe
// swaps to the server-decided final theme.
const STRUGGLE_THEMES: readonly Theme[] = [
  { primary: [226, 232, 240], secondary: [148, 163, 184], glow: [248, 250, 252] },
  { primary: [74, 222, 128], secondary: [16, 185, 129], glow: [167, 243, 208] },
  { primary: [96, 165, 250], secondary: [37, 99, 235], glow: [191, 219, 254] },
  { primary: [167, 139, 250], secondary: [124, 58, 237], glow: [221, 214, 254] },
  { primary: [244, 114, 182], secondary: [219, 39, 119], glow: [251, 207, 232] },
  { primary: [251, 191, 36], secondary: [245, 158, 11], glow: [254, 240, 138] },
  { primary: [251, 113, 133], secondary: [249, 115, 22], glow: [254, 205, 211] },
  { primary: [34, 211, 238], secondary: [217, 70, 239], glow: [207, 250, 254] },
  { primary: [255, 247, 194], secondary: [192, 132, 252], glow: [255, 255, 255] },
];

const BLACK_HOLE_THEME: Theme = {
  primary: [250, 204, 82],
  secondary: [139, 92, 246],
  glow: [125, 211, 252],
};

// Pose order: idle, raise, charged, strain, swipe, track, alarm, cover.

export function getNebuSummonSprite(
  _tier: number,
  _blackHole = false,
  nebuSkin: NebuSkinKey = "midnight",
): string {
  return FOUNDER_KEYPOSE_SHEETS[nebuSkin] || KEYPOSE_SHEET;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function inverseLerp(from: number, to: number, value: number): number {
  if (from === to) return value >= to ? 1 : 0;
  return clamp((value - from) / (to - from));
}

function easeInCubic(value: number): number {
  const progress = clamp(value);
  return progress * progress * progress;
}

function easeOutCubic(value: number): number {
  const progress = 1 - clamp(value);
  return 1 - progress * progress * progress;
}

function easeOutQuint(value: number): number {
  const progress = 1 - clamp(value);
  return 1 - progress ** 5;
}

function smoothstep(value: number): number {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
}

function mixRgb(from: Rgb, to: Rgb, progress: number): Rgb {
  const amount = clamp(progress);
  return [
    Math.round(lerp(from[0], to[0], amount)),
    Math.round(lerp(from[1], to[1], amount)),
    Math.round(lerp(from[2], to[2], amount)),
  ];
}

function mixTheme(from: Theme, to: Theme, progress: number): Theme {
  return {
    primary: mixRgb(from.primary, to.primary, progress),
    secondary: mixRgb(from.secondary, to.secondary, progress),
    glow: mixRgb(from.glow, to.glow, progress),
  };
}

function struggleSampleAt(
  elapsedMs: number,
  stageMomentsMs: readonly number[],
  terminalAtMs: number,
): StruggleSample {
  let levelIndex = 0;
  for (let index = 1; index < stageMomentsMs.length; index += 1) {
    if (elapsedMs < (stageMomentsMs[index] ?? terminalAtMs)) break;
    levelIndex = index;
  }

  const startsAt = stageMomentsMs[levelIndex] ?? terminalAtMs;
  const endsAt = stageMomentsMs[levelIndex + 1] ?? terminalAtMs;
  const durationMs = Math.max(STRUGGLE_FRAME_MS, endsAt - startsAt);
  const localMs = clamp(elapsedMs - startsAt, 0, durationMs);
  const frameIndex = Math.max(0, Math.floor(localMs / STRUGGLE_FRAME_MS));
  const sampledLocalMs = Math.min(durationMs, frameIndex * STRUGGLE_FRAME_MS);

  return {
    levelIndex,
    progress: clamp(sampledLocalMs / durationMs),
    frameIndex,
    sampledAtMs: startsAt + sampledLocalMs,
  };
}

function struggleThemeAt(sample: StruggleSample, blackHole: boolean): Theme {
  const targetIndex = Math.max(
    0,
    Math.min(STRUGGLE_THEMES.length - 1, sample.levelIndex),
  );
  const from = targetIndex === 0
    ? NEUTRAL_STRUGGLE_THEME
    : STRUGGLE_THEMES[targetIndex - 1] ?? NEUTRAL_STRUGGLE_THEME;
  let to = STRUGGLE_THEMES[targetIndex] ?? NEUTRAL_STRUGGLE_THEME;

  // Crown's last charge deliberately becomes an unreadable white overload;
  // the black hole itself remains the reveal.
  if (blackHole && targetIndex === STRUGGLE_THEMES.length - 1) {
    to = {
      primary: [244, 247, 255],
      secondary: [184, 196, 221],
      glow: [255, 255, 255],
    };
  }

  return mixTheme(from, to, smoothstep(sample.progress));
}

function deterministic(index: number, salt: number): number {
  const value = Math.sin(index * 91.731 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function buildSparks(count: number): SparkSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: deterministic(index, 1) * TAU,
    phase: deterministic(index, 2),
    radius: 0.34 + deterministic(index, 3) * 0.88,
    size: 0.7 + deterministic(index, 4) * 2.4,
    speed: 0.54 + deterministic(index, 5) * 1.18,
  }));
}

function parseCssColor(value: string, fallback: Rgb): Rgb {
  const input = value.trim();
  const hex = input.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3
      ? hex.split("").map((character) => character + character).join("")
      : hex;
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ];
  }

  const channels = input.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (channels?.length === 3 && channels.every(Number.isFinite)) {
    return [
      channels[0] ?? fallback[0],
      channels[1] ?? fallback[1],
      channels[2] ?? fallback[2],
    ];
  }

  return fallback;
}

function rgba(rgb: Rgb, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha)})`;
}

function readTheme(element: HTMLElement): Theme {
  const computed = window.getComputedStyle(element);
  return {
    primary: parseCssColor(
      computed.getPropertyValue("--wish-final-primary") ||
        computed.getPropertyValue("--wish-primary"),
      [250, 190, 58],
    ),
    secondary: parseCssColor(
      computed.getPropertyValue("--wish-final-secondary") ||
        computed.getPropertyValue("--wish-secondary"),
      [124, 58, 237],
    ),
    glow: parseCssColor(
      computed.getPropertyValue("--wish-final-glow") ||
        computed.getPropertyValue("--wish-glow"),
      [250, 204, 82],
    ),
  };
}

type FounderCoat = 0 | 1 | 2;

const BUBBLES_WHITE: FounderCoat = 0;
const BUBBLES_BLACK: FounderCoat = 1;
const BUBBLES_GOLD: FounderCoat = 2;
const FOUNDER_ATLAS_CACHE = new Map<"sherry" | "bubbles", HTMLCanvasElement>();

const FOUNDER_EYE_MASKS: ReadonlyArray<
  readonly [centerX: number, centerY: number, radiusX: number, radiusY: number]
> = [
  [450, 406, 80, 60],
  [366, 376, 75, 60],
  [365, 370, 70, 55],
  [277, 405, 70, 50],
  [445, 370, 105, 55],
  [408, 262, 80, 60],
  [434, 287, 132, 96],
  [354, 319, 92, 68],
] as const;

function founderEyeMaskAt(
  pose: number,
  localX: number,
  localY: number,
): number {
  const mask = FOUNDER_EYE_MASKS[pose] || FOUNDER_EYE_MASKS[0];
  const distance =
    ((localX - mask[0]) / mask[2]) ** 2 +
    ((localY - mask[1]) / mask[3]) ** 2;
  return 1 - smoothstep(inverseLerp(0.34, 1, distance));
}

function bubblesCoatAt(
  pose: number,
  localX: number,
  localY: number,
): FounderCoat {
  const x = localX / POSE_WIDTH;
  const y = localY / POSE_HEIGHT;
  const faceWhite =
    y < 0.43 &&
    Math.abs(x - 0.49) < lerp(0.075, 0.13, smoothstep(y / 0.43));
  const chestWhite =
    y >= 0.34 &&
    Math.abs(x - 0.49) < lerp(0.08, 0.15, smoothstep((y - 0.34) / 0.48));

  if (faceWhite || chestWhite) return BUBBLES_WHITE;

  // Broad, softly interlocked fields create the black-and-gold mask running
  // from the eyes over the back and tail. The source luminance is retained,
  // so drawn fur, shadows, and pose silhouettes survive the palette transfer.
  const field =
    Math.sin(x * 12.8 + y * 5.3 + pose * 1.71) * 0.54 +
    Math.sin(x * 25.2 - y * 9.4 + pose * 0.83) * 0.29 +
    Math.cos(x * 7.1 + y * 17.6 - pose * 1.13) * 0.25;
  const backBias = smoothstep(inverseLerp(0.26, 0.68, x + y * 0.42));

  if (field + backBias * 0.24 > 0.34) return BUBBLES_BLACK;
  if (field - backBias * 0.12 < -0.22) return BUBBLES_GOLD;
  return BUBBLES_WHITE;
}

function founderToneDetail(
  sourceValue: number,
  lift = 0,
): number {
  return clamp(
    Math.pow(clamp((sourceValue + lift) / 0.68), 0.58),
  );
}

function createFounderAtlas(
  image: HTMLImageElement,
  nebuSkin: "sherry" | "bubbles",
): CanvasImageSource {
  const cached = FOUNDER_ATLAS_CACHE.get(nebuSkin);
  if (
    cached &&
    cached.width === image.naturalWidth &&
    cached.height === image.naturalHeight
  ) {
    return cached;
  }

  const atlas = document.createElement("canvas");
  atlas.width = image.naturalWidth;
  atlas.height = image.naturalHeight;
  const atlasContext = atlas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!atlasContext) return image;

  atlasContext.drawImage(image, 0, 0);
  const pixels = atlasContext.getImageData(0, 0, atlas.width, atlas.height);
  const data = pixels.data;

  for (let y = 0; y < atlas.height; y += 1) {
    const poseRow = Math.floor(y / POSE_HEIGHT);
    const localY = y % POSE_HEIGHT;

    for (let x = 0; x < atlas.width; x += 1) {
      const offset = (y * atlas.width + x) * 4;
      if (data[offset + 3] < 8) continue;

      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const r = red / 255;
      const g = green / 255;
      const b = blue / 255;
      const value = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const delta = value - minimum;
      const saturation = value > 0 ? delta / value : 0;
      let hue = 0;
      if (delta > 0.0001) {
        if (value === r) hue = ((g - b) / delta) % 6;
        else if (value === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue = ((hue / 6) + 1) % 1;
      }
      const pose = poseRow * SHEET_COLUMNS + Math.floor(x / POSE_WIDTH);
      const localX = x % POSE_WIDTH;
      const eyeMask = founderEyeMaskAt(pose, localX, localY);
      const warmDetail =
        hue >= 0.025 && hue <= 0.19 && saturation > 0.34 && value > 0.28;
      const midnightFur =
        saturation > 0.12 &&
        value < 0.78 &&
        hue >= 0.5 &&
        hue <= 0.86;

      if (eyeMask > 0.18 && warmDetail) {
        const detail = founderToneDetail(value, 0.12);
        const sherryEye = nebuSkin === "sherry";
        const eyeDarkRed = sherryEye ? 4 : 31;
        const eyeDarkGreen = sherryEye ? 38 : 49;
        const eyeDarkBlue = sherryEye ? 18 : 7;
        const eyeLightRed = sherryEye ? 102 : 185;
        const eyeLightGreen = sherryEye ? 255 : 225;
        const eyeLightBlue = sherryEye ? 159 : 82;
        const mix = eyeMask * smoothstep(inverseLerp(0.28, 0.78, saturation));
        data[offset] = Math.round(lerp(red, lerp(eyeDarkRed, eyeLightRed, detail), mix));
        data[offset + 1] = Math.round(lerp(green, lerp(eyeDarkGreen, eyeLightGreen, detail), mix));
        data[offset + 2] = Math.round(lerp(blue, lerp(eyeDarkBlue, eyeLightBlue, detail), mix));
        continue;
      }

      if (!midnightFur && !(nebuSkin === "bubbles" && warmDetail && localY > 340 && value < 0.9)) {
        continue;
      }

      let darkRed: number;
      let darkGreen: number;
      let darkBlue: number;
      let lightRed: number;
      let lightGreen: number;
      let lightBlue: number;
      let lift = 0;
      if (nebuSkin === "sherry") {
        darkRed = 2;
        darkGreen = 7;
        darkBlue = 5;
        lightRed = 64;
        lightGreen = 84;
        lightBlue = 73;
      } else {
        const coat = bubblesCoatAt(pose, localX, localY);
        if (coat === BUBBLES_BLACK) {
          darkRed = 7;
          darkGreen = 7;
          darkBlue = 6;
          lightRed = 74;
          lightGreen = 65;
          lightBlue = 54;
        } else if (coat === BUBBLES_GOLD) {
          darkRed = 83;
          darkGreen = 38;
          darkBlue = 9;
          lightRed = 245;
          lightGreen = 169;
          lightBlue = 63;
          lift = 0.09;
        } else {
          darkRed = 76;
          darkGreen = 72;
          darkBlue = 66;
          lightRed = 255;
          lightGreen = 250;
          lightBlue = 237;
          lift = 0.2;
        }
      }

      const detail = founderToneDetail(value, lift);
      data[offset] = Math.round(lerp(darkRed, lightRed, detail));
      data[offset + 1] = Math.round(lerp(darkGreen, lightGreen, detail));
      data[offset + 2] = Math.round(lerp(darkBlue, lightBlue, detail));
    }
  }

  atlasContext.putImageData(pixels, 0, 0);
  FOUNDER_ATLAS_CACHE.set(nebuSkin, atlas);
  return atlas;
}

function createSkinnedAtlas(
  image: HTMLImageElement,
  nebuSkin: NebuSkinKey,
): CanvasImageSource {
  const treatment = NEBU_ATLAS_FILTERS[nebuSkin];
  if (!treatment || treatment === "none") return image;

  const atlas = document.createElement("canvas");
  atlas.width = image.naturalWidth;
  atlas.height = image.naturalHeight;
  const atlasContext = atlas.getContext("2d", { alpha: true });
  if (!atlasContext) return image;

  atlasContext.imageSmoothingEnabled = true;
  atlasContext.imageSmoothingQuality = "high";
  atlasContext.filter = treatment;
  atlasContext.drawImage(image, 0, 0);
  atlasContext.filter = "none";
  return atlas;
}

function drawEllipseGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: Rgb,
  alpha: number,
): void {
  context.save();
  context.translate(x, y);
  context.scale(1, radiusY / Math.max(1, radiusX));
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.35, rgba(color, alpha * 0.42));
  gradient.addColorStop(1, rgba(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusX, 0, TAU);
  context.fill();
  context.restore();
}

function drawGrounding(
  context: CanvasRenderingContext2D,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  strength = 1,
  theme: Theme = environment.theme,
): void {
  const imageScale = environment.characterHeight / POSE_HEIGHT;
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const groundY = transform.y + 344 * imageScale * transform.scale * scaleY;
  const radius = 232 * imageScale * transform.scale * scaleX;

  drawEllipseGlow(
    context,
    transform.x,
    groundY + 3,
    radius * 1.48,
    radius * 0.3,
    theme.primary,
    0.12 * strength * transform.alpha,
  );

  context.save();
  context.globalAlpha = 0.52 * strength * transform.alpha;
  context.fillStyle = "rgba(0, 0, 0, 0.78)";
  context.beginPath();
  context.ellipse(
    transform.x,
    groundY,
    radius,
    radius * 0.16,
    0,
    0,
    TAU,
  );
  context.fill();
  context.restore();
}

function drawPose(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  alpha = 1,
): void {
  const safePose = Math.max(0, Math.min(SHEET_COLUMNS * SHEET_ROWS - 1, pose));
  const sourceX = (safePose % SHEET_COLUMNS) * POSE_WIDTH;
  const sourceY = Math.floor(safePose / SHEET_COLUMNS) * POSE_HEIGHT;
  const scale = (environment.characterHeight / POSE_HEIGHT) * transform.scale;
  const targetWidth = POSE_WIDTH * scale;
  const targetHeight = POSE_HEIGHT * scale;

  context.save();
  context.globalAlpha = transform.alpha * alpha;
  context.translate(transform.x, transform.y);
  context.rotate(transform.rotation);
  context.scale(transform.scaleX ?? 1, transform.scaleY ?? 1);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    POSE_WIDTH,
    POSE_HEIGHT,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight,
  );
  context.restore();
}

function drawPoseBlend(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  moment: PoseMoment,
  transform: CharacterTransform,
  environment: RenderEnvironment,
): void {
  const mix = smoothstep(inverseLerp(0.42, 0.58, moment.mix));
  if (moment.from === moment.to || mix <= 0.001) {
    drawPose(context, image, moment.from, transform, environment);
    return;
  }

  if (mix >= 0.999) {
    drawPose(context, image, moment.to, transform, environment);
    return;
  }

  drawPose(context, image, moment.from, transform, environment, 1 - mix);
  drawPose(context, image, moment.to, transform, environment, mix);
}

function pawPosition(
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
): readonly [number, number] {
  const [sourceX, sourceY] = PAW_POSITION_BY_POSE[pose] ?? [250, 142];
  const scale = (environment.characterHeight / POSE_HEIGHT) * transform.scale;
  const localX = (sourceX - POSE_WIDTH / 2) * scale * (transform.scaleX ?? 1);
  const localY = (sourceY - POSE_HEIGHT / 2) * scale * (transform.scaleY ?? 1);
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return [
    transform.x + localX * cosine - localY * sine,
    transform.y + localX * sine + localY * cosine,
  ];
}

function drawConstellationOrbit(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  strength: number,
  theme: Theme,
  visibleIntensity: number,
): void {
  if (strength <= 0.03 || environment.reducedMotion) return;

  const orbitColor = mixRgb(environment.skinLight, theme.primary, 0.72);
  const radiusX = environment.characterHeight * lerp(0.23, 0.34, visibleIntensity);
  const radiusY = radiusX * 0.28;
  const rotation = -0.18 + Math.sin(elapsedMs * 0.00031) * 0.09;
  const phase = elapsedMs * 0.00038;
  const orbitCount = environment.lowEffects ? 1 : visibleIntensity > 0.48 ? 2 : 1;

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  for (let orbitIndex = 0; orbitIndex < orbitCount; orbitIndex += 1) {
    const orbitScale = 1 + orbitIndex * 0.24;
    const orbitAlpha = strength * (orbitIndex === 0 ? 0.25 : 0.12);
    const orbitRotation = rotation + orbitIndex * 0.38;
    context.strokeStyle = rgba(orbitIndex ? theme.secondary : orbitColor, orbitAlpha);
    context.lineWidth = orbitIndex ? 0.8 : 1.15;
    context.setLineDash([radiusX * 0.34, radiusX * 0.12]);
    context.lineDashOffset = -elapsedMs * (orbitIndex ? 0.012 : 0.018);
    context.beginPath();
    context.ellipse(
      transform.x,
      transform.y + environment.characterHeight * 0.09,
      radiusX * orbitScale,
      radiusY * orbitScale,
      orbitRotation,
      phase + orbitIndex,
      phase + Math.PI * 1.42 + orbitIndex,
    );
    context.stroke();

    const nodeCount = orbitIndex ? 4 : 6;
    context.setLineDash([]);
    for (let index = 0; index < nodeCount; index += 1) {
      const angle = phase * (orbitIndex ? -0.74 : 1) + index * TAU / nodeCount;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const cosRotation = Math.cos(orbitRotation);
      const sinRotation = Math.sin(orbitRotation);
      const localX = cosine * radiusX * orbitScale;
      const localY = sine * radiusY * orbitScale;
      const x = transform.x + localX * cosRotation - localY * sinRotation;
      const y = transform.y + environment.characterHeight * 0.09 +
        localX * sinRotation + localY * cosRotation;
      const twinkle = 0.64 + Math.sin(elapsedMs * 0.006 + index * 2.1) * 0.36;
      context.fillStyle = index % 3 === 0
        ? rgba(WHITE, orbitAlpha * twinkle)
        : rgba(orbitColor, orbitAlpha * twinkle);
      context.beginPath();
      context.arc(x, y, 0.8 + twinkle * 1.1, 0, TAU);
      context.fill();
    }
  }

  context.restore();
}

function drawGravityTether(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  strength: number,
  theme: Theme,
  visibleIntensity: number,
): void {
  if (strength <= 0.08) return;

  const [pawX, pawY] = pawPosition(pose, transform, environment);
  const topX = environment.centerX +
    Math.sin(elapsedMs * 0.00047) * environment.width * 0.028;
  const topY = -environment.height * 0.06;
  const strandCount = environment.lowEffects ? 1 : 3;

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  for (let index = 0; index < strandCount; index += 1) {
    const offset = (index - (strandCount - 1) / 2) *
      lerp(3.5, 9, visibleIntensity);
    const wave = Math.sin(elapsedMs * 0.0032 + index * 2.4) *
      lerp(5, 15, visibleIntensity);
    const gradient = context.createLinearGradient(pawX, pawY, topX, topY);
    gradient.addColorStop(0, rgba(theme.glow, strength * 0.52));
    gradient.addColorStop(0.34, rgba(theme.primary, strength * 0.2));
    gradient.addColorStop(1, rgba(theme.secondary, 0));
    context.strokeStyle = gradient;
    context.lineWidth = index === 1
      ? lerp(1.1, 2.2, visibleIntensity)
      : 0.65;
    context.shadowBlur = index === 1 ? 9 : 3;
    context.shadowColor = rgba(theme.glow, strength * 0.62);
    context.beginPath();
    context.moveTo(pawX + offset, pawY);
    context.bezierCurveTo(
      pawX + wave + offset,
      lerp(pawY, topY, 0.34),
      topX - wave * 0.7 + offset * 0.25,
      lerp(pawY, topY, 0.7),
      topX,
      topY,
    );
    context.stroke();
  }

  context.restore();
}

function drawMotionEcho(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: PoseMoment,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  theme: Theme,
  strength: number,
): void {
  if (strength <= 0.02 || environment.lowEffects || environment.reducedMotion) return;

  context.save();
  context.globalCompositeOperation = "screen";
  context.shadowColor = rgba(theme.glow, 0.74);
  context.shadowBlur = 16;
  context.filter = "saturate(1.28) contrast(1.08)";
  for (let index = 3; index >= 1; index -= 1) {
    const lag = index / 3;
    drawPoseBlend(
      context,
      image,
      pose,
      {
        ...transform,
        x: transform.x - lag * 22 * strength,
        y: transform.y - lag * 4 * strength,
        rotation: transform.rotation + lag * 0.035 * strength,
        alpha: transform.alpha * (0.028 + (1 - lag) * 0.035) * strength,
      },
      environment,
    );
  }
  context.restore();
}

function drawCharacterEnergyWash(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: PoseMoment,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  theme: Theme,
  strength: number,
): void {
  if (strength <= 0.005) return;

  const { canvas, context: effectContext, pixelRatio } = environment.effectSurface;
  effectContext.setTransform(1, 0, 0, 1, 0, 0);
  effectContext.clearRect(0, 0, canvas.width, canvas.height);
  effectContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  effectContext.globalAlpha = 1;
  effectContext.globalCompositeOperation = "source-over";
  effectContext.filter = "none";
  drawPoseBlend(effectContext, image, pose, transform, environment);

  const activePose = pose.mix < 0.5 ? pose.from : pose.to;
  const [pawX, pawY] = pawPosition(activePose, transform, environment);
  const wash = effectContext.createRadialGradient(
    pawX,
    pawY,
    0,
    pawX,
    pawY,
    environment.characterHeight * 0.82,
  );
  wash.addColorStop(0, rgba(theme.glow, 1));
  wash.addColorStop(0.2, rgba(theme.primary, 1));
  wash.addColorStop(0.58, rgba(theme.secondary, 0.96));
  wash.addColorStop(1, rgba(environment.skinLight, 0.72));
  effectContext.globalCompositeOperation = "source-in";
  effectContext.fillStyle = wash;
  effectContext.fillRect(0, 0, environment.width, environment.height);
  effectContext.globalCompositeOperation = "source-over";

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = clamp(strength);
  context.shadowColor = rgba(theme.glow, 0.76);
  context.shadowBlur = lerp(4, 18, strength);
  context.filter = `saturate(${lerp(1.08, 1.42, strength)})`;
  context.drawImage(
    canvas,
    0,
    0,
    canvas.width,
    canvas.height,
    0,
    0,
    environment.width,
    environment.height,
  );
  context.restore();
}

function drawPawMagic(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  strength: number,
  theme: Theme,
  visibleIntensity: number,
): void {
  const [x, y] = pawPosition(pose, transform, environment);
  const pulse = 0.9 + Math.sin(elapsedMs * 0.011) * 0.1;
  const radius = environment.characterHeight *
    lerp(0.068, 0.112, visibleIntensity) * pulse;

  context.save();
  context.globalCompositeOperation = "screen";
  drawEllipseGlow(
    context,
    x,
    y,
    radius * 1.75,
    radius * 1.75,
    theme.glow,
    lerp(0.24, 0.48, visibleIntensity) * strength,
  );

  const core = context.createRadialGradient(x, y, 0, x, y, radius * 0.46);
  core.addColorStop(0, `rgba(255, 255, 255, ${0.82 * strength})`);
  core.addColorStop(0.3, rgba(theme.glow, 0.58 * strength));
  core.addColorStop(1, rgba(theme.primary, 0));
  context.fillStyle = core;
  context.beginPath();
  context.arc(x, y, radius * 0.46, 0, TAU);
  context.fill();

  if (!environment.reducedMotion) {
    context.save();
    context.translate(x, y);
    context.rotate(elapsedMs * 0.00082);
    const ringCount = environment.lowEffects ? 1 : 3;
    for (let index = 0; index < ringCount; index += 1) {
      const ringRadius = radius * (0.62 + index * 0.21);
      context.rotate(index % 2 ? -0.72 : 0.48);
      context.scale(1, 0.42 + index * 0.08);
      context.strokeStyle = rgba(
        index % 2 ? theme.secondary : theme.glow,
        strength * (0.44 - index * 0.09),
      );
      context.lineWidth = Math.max(0.65, 1.35 - index * 0.22);
      context.beginPath();
      context.arc(0, 0, ringRadius, index * 0.88, index * 0.88 + Math.PI * 1.22);
      context.stroke();
      context.scale(1, 1 / (0.42 + index * 0.08));
    }
    context.restore();
  }

  const orbitCount = environment.lowEffects ? 5 : 11;
  for (let index = 0; index < orbitCount; index += 1) {
    const orbit = elapsedMs * 0.0024 * (index % 2 ? -1 : 1) + index * 2.17;
    const orbitRadius = radius * (0.46 + (index % 4) * 0.16);
    const sparkleX = x + Math.cos(orbit) * orbitRadius;
    const sparkleY = y + Math.sin(orbit) * orbitRadius * 0.58;
    const sparkleAlpha = strength * (0.35 + (index % 3) * 0.18);
    context.fillStyle = index % 3 === 0
      ? `rgba(255, 255, 255, ${sparkleAlpha})`
      : rgba(theme.primary, sparkleAlpha);
    context.beginPath();
    context.arc(sparkleX, sparkleY, 1 + (index % 3) * 0.7, 0, TAU);
    context.fill();
  }

  if (!environment.lowEffects) {
    const flareRadius = radius * lerp(0.72, 1.18, visibleIntensity);
    context.strokeStyle = `rgba(255, 255, 255, ${0.44 * strength})`;
    context.lineWidth = 0.85;
    context.beginPath();
    context.moveTo(x - flareRadius, y);
    context.lineTo(x + flareRadius, y);
    context.moveTo(x, y - flareRadius * 0.62);
    context.lineTo(x, y + flareRadius * 0.62);
    context.stroke();
  }
  context.restore();
}

function drawAmbientMagic(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  environment: RenderEnvironment,
  centerX: number,
  centerY: number,
  strength: number,
  theme: Theme = environment.theme,
  visibleIntensity = environment.tierIntensity,
): void {
  if (strength <= 0.001) return;
  context.save();
  context.globalCompositeOperation = "screen";

  const fieldRadius = environment.characterHeight * 0.42;
  const visibleCount = environment.lowEffects
    ? environment.sparks.length
    : Math.min(
        environment.sparks.length,
        Math.round(24 + visibleIntensity * (environment.sparks.length - 24)),
      );
  for (let index = 0; index < visibleCount; index += 1) {
    const seed = environment.sparks[index];
    if (!seed) continue;
    const life = (elapsedMs * 0.00016 * seed.speed + seed.phase) % 1;
    const radius = fieldRadius * seed.radius * (0.62 + life * 0.52);
    const angle = seed.angle + elapsedMs * 0.00022 * seed.speed;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.55 - life * 34;
    const alpha = Math.sin(life * Math.PI) * 0.48 * strength;
    context.fillStyle = index % 5 === 0
      ? `rgba(255, 255, 255, ${alpha})`
      : rgba(index % 2 ? theme.primary : theme.secondary, alpha);
    context.beginPath();
    context.arc(x, y, seed.size * (0.65 + visibleIntensity * 0.35), 0, TAU);
    context.fill();
  }

  context.restore();
}

function drawCharacterAura(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: PoseMoment,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  theme: Theme,
  strength: number,
): void {
  if (strength <= 0.001) return;

  drawEllipseGlow(
    context,
    transform.x,
    transform.y - environment.characterHeight * 0.035,
    environment.characterHeight * lerp(0.24, 0.39, strength),
    environment.characterHeight * lerp(0.28, 0.46, strength),
    theme.glow,
    0.075 + strength * 0.11,
  );
  drawEllipseGlow(
    context,
    transform.x,
    transform.y + environment.characterHeight * 0.03,
    environment.characterHeight * lerp(0.2, 0.31, strength),
    environment.characterHeight * lerp(0.25, 0.36, strength),
    environment.skinLight,
    0.035 + strength * 0.055,
  );

  context.save();
  context.globalCompositeOperation = "screen";
  context.shadowColor = rgba(theme.glow, 0.88);
  context.shadowBlur = lerp(9, 34, strength);
  context.filter = `saturate(${lerp(1.04, 1.36, strength)}) brightness(${lerp(1, 1.16, strength)})`;
  drawPoseBlend(
    context,
    image,
    pose,
    { ...transform, alpha: transform.alpha * lerp(0.055, 0.2, strength) },
    environment,
  );
  context.restore();
}

function regularPoseAt(
  elapsedMs: number,
  stageMomentsMs: readonly number[],
  swipeAtMs: number,
  impactAtMs: number,
  reducedMotion: boolean,
  protectedEnding = false,
): PoseMoment {
  const strainStartsAt = stageMomentsMs[0] ?? Math.max(720, swipeAtMs - 1000);
  const raiseStartsAt = Math.max(320, strainStartsAt - 470);
  const anticipateAtMs = impactAtMs - 215;

  if (elapsedMs < raiseStartsAt) return { from: 0, to: 0, mix: 0 };
  if (elapsedMs < strainStartsAt) {
    return {
      from: 0,
      to: 1,
      mix: inverseLerp(raiseStartsAt, strainStartsAt, elapsedMs),
    };
  }

  if (elapsedMs < swipeAtMs) {
    const sample = struggleSampleAt(elapsedMs, stageMomentsMs, swipeAtMs);
    const range = reducedMotion ? 0.48 : 1;
    if (sample.progress < 0.52) {
      return {
        from: 2,
        to: 3,
        mix: smoothstep(sample.progress / 0.52) * range,
      };
    }
    return {
      from: 3,
      to: 2,
      mix: smoothstep((sample.progress - 0.52) / 0.48) * range,
    };
  }

  if (elapsedMs < swipeAtMs + 300) {
    return {
      from: 3,
      to: 4,
      mix: inverseLerp(swipeAtMs, swipeAtMs + 190, elapsedMs),
    };
  }

  if (elapsedMs < anticipateAtMs) {
    return {
      from: 4,
      to: 5,
      mix: inverseLerp(swipeAtMs + 300, swipeAtMs + 470, elapsedMs),
    };
  }

  if (elapsedMs < impactAtMs - 86) {
    return {
      from: 5,
      to: 6,
      mix: inverseLerp(anticipateAtMs, impactAtMs - 86, elapsedMs),
    };
  }

  if (protectedEnding) {
    // Bubbles sees the meteor coming, but her personal shield means she never
    // needs to take Nebu's direct-impact cover pose.
    return { from: 6, to: 6, mix: 0 };
  }

  // The protective crouch is an anticipation accent, never a held end state.
  return {
    from: 6,
    to: 7,
    mix: inverseLerp(impactAtMs - 86, impactAtMs, elapsedMs),
  };
}

function drawMeteor(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  meteorAtMs: number,
  impactAtMs: number,
  impactX: number,
  impactY: number,
  environment: RenderEnvironment,
): void {
  if (elapsedMs < meteorAtMs || elapsedMs >= impactAtMs + 30) return;

  const progress = inverseLerp(meteorAtMs, impactAtMs, elapsedMs);
  const fall = easeInCubic(progress);
  const startX = environment.width * 0.84;
  const startY = -environment.height * 0.08;
  const arc = Math.sin(progress * Math.PI) * environment.width * 0.035;
  const x = lerp(startX, impactX, fall) - arc;
  const y = lerp(startY, impactY, Math.pow(progress, 1.72));
  const previousProgress = clamp(progress - 0.018);
  const previousFall = easeInCubic(previousProgress);
  const previousX = lerp(startX, impactX, previousFall) -
    Math.sin(previousProgress * Math.PI) * environment.width * 0.035;
  const previousY = lerp(startY, impactY, Math.pow(previousProgress, 1.72));
  const directionX = x - previousX;
  const directionY = y - previousY;
  const directionLength = Math.max(1, Math.hypot(directionX, directionY));
  const unitX = directionX / directionLength;
  const unitY = directionY / directionLength;
  const approachScale = lerp(0.82, 2.65, easeInCubic(progress));
  const tailLength = lerp(190, 340, environment.tierIntensity) *
    lerp(0.82, 1.22, smoothstep(progress));
  const tailX = x - unitX * tailLength;
  const tailY = y - unitY * tailLength;

  context.save();
  context.globalCompositeOperation = "screen";

  const tailGradient = context.createLinearGradient(x, y, tailX, tailY);
  tailGradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  tailGradient.addColorStop(0.16, rgba(environment.theme.primary, 0.92));
  tailGradient.addColorStop(0.58, rgba(environment.theme.secondary, 0.44));
  tailGradient.addColorStop(1, rgba(environment.theme.secondary, 0));
  context.strokeStyle = tailGradient;
  context.lineCap = "round";
  context.lineWidth = lerp(12, 22, environment.tierIntensity) *
    lerp(0.82, 1.38, progress);
  context.shadowBlur = lerp(24, 46, progress);
  context.shadowColor = rgba(environment.theme.glow, 0.9);
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(tailX, tailY);
  context.stroke();

  if (!environment.lowEffects) {
    context.lineWidth = 1.4;
    for (let index = 0; index < 8; index += 1) {
      const offset = (index - 3.5) * 6.5;
      const wave = Math.sin(elapsedMs * 0.016 + index * 1.7) * 8;
      context.strokeStyle = rgba(
        index % 2 ? environment.theme.primary : environment.theme.secondary,
        0.22,
      );
      context.beginPath();
      context.moveTo(x + unitY * offset, y - unitX * offset);
      context.quadraticCurveTo(
        (x + tailX) / 2 + unitY * (offset + wave),
        (y + tailY) / 2 - unitX * (offset + wave),
        tailX + unitY * offset * 0.3,
        tailY - unitX * offset * 0.3,
      );
      context.stroke();
    }

    const ribbonCount = 4;
    for (let index = 0; index < ribbonCount; index += 1) {
      const offset = (index - (ribbonCount - 1) / 2) * 9;
      const ribbonWave = Math.sin(elapsedMs * 0.009 + index * 1.9) * 13;
      context.strokeStyle = rgba(
        index % 2 ? environment.theme.primary : environment.theme.glow,
        0.16 + progress * 0.16,
      );
      context.lineWidth = 0.7 + progress * 0.9;
      context.beginPath();
      context.moveTo(x + unitY * offset, y - unitX * offset);
      context.bezierCurveTo(
        lerp(x, tailX, 0.28) + unitY * (offset + ribbonWave),
        lerp(y, tailY, 0.28) - unitX * (offset + ribbonWave),
        lerp(x, tailX, 0.72) + unitY * (offset - ribbonWave * 0.45),
        lerp(y, tailY, 0.72) - unitX * (offset - ribbonWave * 0.45),
        tailX,
        tailY,
      );
      context.stroke();
    }
  }

  const coreRadius = lerp(18, 32, environment.tierIntensity) *
    approachScale *
    (0.92 + Math.sin(elapsedMs * 0.021) * 0.08);
  drawEllipseGlow(
    context,
    x,
    y,
    coreRadius * 4.8,
    coreRadius * 4.8,
    environment.theme.glow,
    0.38,
  );
  const core = context.createRadialGradient(x, y, 0, x, y, coreRadius);
  core.addColorStop(0, "rgba(255, 255, 255, 1)");
  core.addColorStop(0.32, "rgba(255, 248, 210, 1)");
  core.addColorStop(0.68, rgba(environment.theme.primary, 1));
  core.addColorStop(1, rgba(environment.theme.secondary, 0));
  context.fillStyle = core;
  context.beginPath();
  context.arc(x, y, coreRadius, 0, TAU);
  context.fill();

  const corona = context.createRadialGradient(
    x,
    y,
    coreRadius * 0.72,
    x,
    y,
    coreRadius * 1.48,
  );
  corona.addColorStop(0, rgba(environment.theme.glow, 0));
  corona.addColorStop(0.44, rgba(environment.theme.primary, 0.48));
  corona.addColorStop(0.72, rgba(environment.theme.secondary, 0.22));
  corona.addColorStop(1, rgba(environment.theme.secondary, 0));
  context.fillStyle = corona;
  context.beginPath();
  context.arc(x, y, coreRadius * 1.52, 0, TAU);
  context.fill();

  if (!environment.lowEffects) {
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(unitY, unitX));
    const flareLength = coreRadius * lerp(2.8, 4.8, progress);
    const flare = context.createLinearGradient(-flareLength, 0, flareLength, 0);
    flare.addColorStop(0, rgba(environment.theme.secondary, 0));
    flare.addColorStop(0.42, rgba(environment.theme.primary, 0.28));
    flare.addColorStop(0.5, "rgba(255, 255, 255, 0.92)");
    flare.addColorStop(0.58, rgba(environment.theme.glow, 0.28));
    flare.addColorStop(1, rgba(environment.theme.secondary, 0));
    context.strokeStyle = flare;
    context.lineWidth = 1.25 + progress * 1.4;
    context.beginPath();
    context.moveTo(-flareLength, 0);
    context.lineTo(flareLength, 0);
    context.stroke();

    const flameCount = 7;
    context.rotate(elapsedMs * 0.0018);
    for (let index = 0; index < flameCount; index += 1) {
      const angle = index * TAU / flameCount;
      const flutter = 0.78 + Math.sin(elapsedMs * 0.015 + index * 1.37) * 0.22;
      context.strokeStyle = rgba(
        index % 2 ? environment.theme.primary : environment.theme.glow,
        0.34,
      );
      context.lineWidth = 0.9;
      context.beginPath();
      context.moveTo(
        Math.cos(angle) * coreRadius * 0.74,
        Math.sin(angle) * coreRadius * 0.74,
      );
      context.quadraticCurveTo(
        Math.cos(angle + 0.28) * coreRadius * 1.1,
        Math.sin(angle + 0.28) * coreRadius * 1.1,
        Math.cos(angle + 0.46) * coreRadius * 1.62 * flutter,
        Math.sin(angle + 0.46) * coreRadius * 1.62 * flutter,
      );
      context.stroke();
    }
    context.restore();
  }
  context.restore();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  impactAtMs: number,
  x: number,
  y: number,
  environment: RenderEnvironment,
): void {
  if (elapsedMs < impactAtMs) return;
  const progress = inverseLerp(impactAtMs, impactAtMs + 720, elapsedMs);
  if (progress >= 1) return;
  const expansion = easeOutCubic(progress);

  context.save();
  context.globalCompositeOperation = "screen";
  drawEllipseGlow(
    context,
    x,
    y,
    lerp(80, environment.width * 0.48, expansion),
    lerp(80, environment.height * 0.58, expansion),
    environment.theme.glow,
    (1 - progress) * 0.8,
  );

  const ringRadius = lerp(28, Math.min(environment.width, environment.height) * 0.48, expansion);
  context.strokeStyle = rgba(environment.theme.primary, (1 - progress) * 0.92);
  context.lineWidth = lerp(8, 1, progress);
  context.shadowBlur = 20;
  context.shadowColor = rgba(environment.theme.glow, 0.9);
  context.beginPath();
  context.ellipse(x, y, ringRadius, ringRadius * 0.42, 0, 0, TAU);
  context.stroke();

  const secondaryProgress = smoothstep(inverseLerp(0.08, 0.86, progress));
  const secondaryRadius = lerp(
    20,
    Math.min(environment.width, environment.height) * 0.38,
    easeOutQuint(secondaryProgress),
  );
  context.strokeStyle = rgba(
    environment.theme.secondary,
    (1 - secondaryProgress) * 0.56,
  );
  context.lineWidth = lerp(4.2, 0.7, secondaryProgress);
  context.beginPath();
  context.ellipse(
    x,
    y + secondaryRadius * 0.02,
    secondaryRadius,
    secondaryRadius * 0.24,
    0,
    0,
    TAU,
  );
  context.stroke();

  if (!environment.lowEffects) {
    const rayCount = 18 + Math.round(environment.tierIntensity * 12);
    for (let index = 0; index < rayCount; index += 1) {
      const angle = deterministic(index, 31) * TAU;
      const inner = ringRadius * (0.08 + deterministic(index, 32) * 0.14);
      const outer = ringRadius * (0.62 + deterministic(index, 33) * 0.72);
      context.strokeStyle = rgba(
        index % 3 ? environment.theme.primary : WHITE,
        (1 - progress) * (0.18 + deterministic(index, 34) * 0.42),
      );
      context.lineWidth = 0.8 + deterministic(index, 35) * 2.1;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner * 0.68);
      context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer * 0.68);
      context.stroke();
    }

    const debrisCount = 18;
    for (let index = 0; index < debrisCount; index += 1) {
      const angle = lerp(Math.PI * 1.08, Math.PI * 1.92, deterministic(index, 73));
      const speed = lerp(46, 210, deterministic(index, 74));
      const travel = easeOutCubic(progress) * speed;
      const gravity = progress * progress * 92;
      const debrisX = x + Math.cos(angle) * travel;
      const debrisY = y + Math.sin(angle) * travel + gravity;
      const alpha = (1 - progress) * (0.22 + deterministic(index, 75) * 0.48);
      context.fillStyle = rgba(
        index % 4 === 0 ? WHITE : environment.theme.primary,
        alpha,
      );
      context.beginPath();
      context.arc(
        debrisX,
        debrisY,
        0.7 + deterministic(index, 76) * 2.1,
        0,
        TAU,
      );
      context.fill();
    }
  }
  context.restore();
}

type BubbleShieldState = {
  centerX: number;
  centerY: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  formation: number;
  impactProgress: number;
  opacity: number;
};

function bubbleShieldStateAt(
  elapsedMs: number,
  impactAtMs: number,
  centerX: number,
  centerY: number,
  radius: number,
  reducedMotion: boolean,
): BubbleShieldState | null {
  const appearsAtMs = impactAtMs - 270;
  if (elapsedMs < appearsAtMs || elapsedMs >= impactAtMs + 780) return null;

  const formation = smoothstep(inverseLerp(appearsAtMs, impactAtMs - 28, elapsedMs));
  const impactProgress = inverseLerp(impactAtMs, impactAtMs + 720, elapsedMs);
  const pop = reducedMotion
    ? 0
    : Math.sin(inverseLerp(appearsAtMs, impactAtMs + 40, elapsedMs) * Math.PI * 1.35) *
      (1 - formation) * 0.08;
  const wobble = impactProgress > 0 && !reducedMotion
    ? Math.sin(impactProgress * Math.PI * 10.5) * Math.exp(-impactProgress * 4.5) * 0.065
    : 0;

  return {
    centerX,
    centerY,
    radius: radius * lerp(0.72, 1, formation) * (1 + pop),
    scaleX: 1 + wobble,
    scaleY: 1 - wobble * 0.72,
    formation,
    impactProgress,
    opacity: formation * (1 - smoothstep(inverseLerp(0.72, 1, impactProgress))),
  };
}

function drawBubbleShieldBack(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  impactAtMs: number,
  centerX: number,
  centerY: number,
  radius: number,
  environment: RenderEnvironment,
): void {
  const state = bubbleShieldStateAt(
    elapsedMs,
    impactAtMs,
    centerX,
    centerY,
    radius,
    environment.reducedMotion,
  );
  if (!state || state.opacity <= 0.001) return;

  context.save();
  context.translate(state.centerX, state.centerY);
  context.scale(state.scaleX, state.scaleY);
  context.globalCompositeOperation = "screen";

  const glass = context.createRadialGradient(
    -state.radius * 0.3,
    -state.radius * 0.38,
    state.radius * 0.04,
    0,
    0,
    state.radius,
  );
  glass.addColorStop(0, `rgba(255,255,255,${0.12 * state.opacity})`);
  glass.addColorStop(0.28, `rgba(186,250,255,${0.055 * state.opacity})`);
  glass.addColorStop(0.7, `rgba(115,214,255,${0.045 * state.opacity})`);
  glass.addColorStop(1, `rgba(210,168,255,${0.15 * state.opacity})`);
  context.fillStyle = glass;
  context.beginPath();
  context.arc(0, 0, state.radius, 0, TAU);
  context.fill();

  const lowerCaustic = context.createLinearGradient(
    0,
    state.radius * 0.12,
    0,
    state.radius,
  );
  lowerCaustic.addColorStop(0, "rgba(82,210,255,0)");
  lowerCaustic.addColorStop(1, `rgba(80,205,255,${0.12 * state.opacity})`);
  context.fillStyle = lowerCaustic;
  context.beginPath();
  context.ellipse(0, state.radius * 0.55, state.radius * 0.78, state.radius * 0.28, 0, 0, TAU);
  context.fill();
  context.restore();
}

function drawBubbleShieldFront(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  impactAtMs: number,
  centerX: number,
  centerY: number,
  radius: number,
  impactX: number,
  impactY: number,
  environment: RenderEnvironment,
): void {
  const state = bubbleShieldStateAt(
    elapsedMs,
    impactAtMs,
    centerX,
    centerY,
    radius,
    environment.reducedMotion,
  );
  if (!state || state.opacity <= 0.001) return;

  const impact = state.impactProgress;
  context.save();
  context.globalCompositeOperation = "screen";
  context.translate(state.centerX, state.centerY);
  context.scale(state.scaleX, state.scaleY);

  const rim = context.createLinearGradient(
    -state.radius,
    -state.radius,
    state.radius,
    state.radius,
  );
  rim.addColorStop(0, `rgba(255,255,255,${0.82 * state.opacity})`);
  rim.addColorStop(0.28, `rgba(109,231,255,${0.34 * state.opacity})`);
  rim.addColorStop(0.67, `rgba(205,160,255,${0.46 * state.opacity})`);
  rim.addColorStop(1, `rgba(255,241,181,${0.7 * state.opacity})`);
  context.strokeStyle = rim;
  context.lineWidth = lerp(1.4, 3.4, state.formation) + (1 - impact) * 0.8;
  context.shadowBlur = 22;
  context.shadowColor = `rgba(120,225,255,${0.72 * state.opacity})`;
  context.beginPath();
  context.arc(0, 0, state.radius, 0, TAU);
  context.stroke();

  context.lineCap = "round";
  context.strokeStyle = `rgba(255,255,255,${0.72 * state.opacity})`;
  context.lineWidth = lerp(5, 2, state.formation);
  context.beginPath();
  context.arc(0, 0, state.radius * 0.86, Math.PI * 1.07, Math.PI * 1.45);
  context.stroke();
  context.strokeStyle = `rgba(118,233,255,${0.42 * state.opacity})`;
  context.lineWidth = 1.6;
  context.beginPath();
  context.arc(0, 0, state.radius * 0.93, Math.PI * 0.08, Math.PI * 0.52);
  context.stroke();
  context.restore();

  if (impact > 0 && impact < 1) {
    const ripple = easeOutCubic(impact);
    const flash = 1 - smoothstep(inverseLerp(0, 0.34, impact));
    context.save();
    context.globalCompositeOperation = "screen";
    drawEllipseGlow(
      context,
      impactX,
      impactY,
      lerp(24, radius * 0.72, ripple),
      lerp(18, radius * 0.28, ripple),
      WHITE,
      flash * 0.78,
    );

    for (let ring = 0; ring < 3; ring += 1) {
      const delayed = smoothstep(inverseLerp(ring * 0.055, 0.82, impact));
      const ringRadius = lerp(8, radius * (0.58 + ring * 0.13), delayed);
      context.strokeStyle = ring === 1
        ? `rgba(220,174,255,${(1 - delayed) * 0.58})`
        : `rgba(137,238,255,${(1 - delayed) * 0.7})`;
      context.lineWidth = lerp(4.2, 0.8, delayed);
      context.beginPath();
      context.ellipse(impactX, impactY, ringRadius, ringRadius * 0.34, -0.48, 0, TAU);
      context.stroke();
    }

    if (!environment.lowEffects) {
      const bubbleCount = 11;
      for (let index = 0; index < bubbleCount; index += 1) {
        const angle = lerp(Math.PI * 0.9, Math.PI * 2.12, deterministic(index, 101));
        const travel = easeOutCubic(impact) * lerp(30, radius * 0.78, deterministic(index, 102));
        const bubbleX = impactX + Math.cos(angle) * travel;
        const bubbleY = impactY + Math.sin(angle) * travel - impact * impact * radius * 0.16;
        const bubbleRadius = lerp(1.6, 6.2, deterministic(index, 103)) * (1 - impact * 0.44);
        context.strokeStyle = `rgba(188,246,255,${(1 - impact) * 0.62})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(bubbleX, bubbleY, bubbleRadius, 0, TAU);
        context.stroke();
      }
    }
    context.restore();
  }
}

type BlackHoleField = {
  x: number;
  y: number;
  radius: number;
  engulf: number;
};

function drawBlackHoleField(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  specialAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): BlackHoleField {
  const x = environment.centerX;
  const y = environment.height * 0.205;
  const reveal = easeOutCubic(
    inverseLerp(specialAtMs + 160, specialAtMs + 1120, elapsedMs),
  );
  const pull = smoothstep(inverseLerp(specialAtMs, impactAtMs, elapsedMs));
  const engulf = easeInCubic(
    inverseLerp(impactAtMs - 950, impactAtMs + 80, elapsedMs),
  );
  const radius = reveal <= 0
    ? 0
    : lerp(3, Math.min(environment.width, environment.height) * 0.122, reveal);

  if (pull > 0) {
    context.save();
    const vignette = context.createRadialGradient(
      x,
      y,
      Math.max(1, radius * 0.4),
      x,
      y,
      Math.hypot(environment.width, environment.height) * 0.78,
    );
    vignette.addColorStop(0, `rgba(0, 0, 0, ${0.08 + pull * 0.18})`);
    vignette.addColorStop(0.5, `rgba(2, 1, 12, ${pull * 0.16})`);
    vignette.addColorStop(1, `rgba(0, 0, 0, ${pull * 0.58})`);
    context.fillStyle = vignette;
    context.fillRect(0, 0, environment.width, environment.height);

    if (!environment.reducedMotion) {
      context.globalCompositeOperation = "screen";
      const streakCount = environment.lowEffects ? 18 : 48;
      const diagonal = Math.hypot(environment.width, environment.height);
      for (let index = 0; index < streakCount; index += 1) {
        const angle = deterministic(index, 61) * TAU;
        const outerRadius = diagonal * (0.18 + deterministic(index, 62) * 0.62);
        const drawIn = smoothstep(
          (pull + deterministic(index, 63) * 0.34 - 0.18) / 1.16,
        );
        const innerRadius = lerp(outerRadius, radius * 0.72, drawIn);
        const nextRadius = Math.max(radius * 0.55, innerRadius - lerp(12, 86, pull));
        const bend = Math.sin(elapsedMs * 0.0011 + index) * radius * 0.12 * pull;
        context.strokeStyle = rgba(
          index % 4 === 0 ? BLACK_HOLE_THEME.primary :
            index % 3 === 0 ? BLACK_HOLE_THEME.secondary : WHITE,
          (0.025 + deterministic(index, 64) * 0.13) * pull,
        );
        context.lineWidth = 0.45 + deterministic(index, 65) * 1.35;
        context.beginPath();
        context.moveTo(
          x + Math.cos(angle) * innerRadius,
          y + Math.sin(angle) * innerRadius,
        );
        context.quadraticCurveTo(
          x + Math.cos(angle + 0.08) * ((innerRadius + nextRadius) * 0.5) + bend,
          y + Math.sin(angle + 0.08) * ((innerRadius + nextRadius) * 0.5),
          x + Math.cos(angle + 0.16 * pull) * nextRadius,
          y + Math.sin(angle + 0.16 * pull) * nextRadius,
        );
        context.stroke();
      }
    }
    context.restore();
  }

  if (reveal <= 0) return { x, y, radius, engulf };

  context.save();
  context.globalCompositeOperation = "screen";

  drawEllipseGlow(
    context,
    x,
    y,
    radius * 2.3,
    radius * 2.3,
    BLACK_HOLE_THEME.secondary,
    0.2 * reveal,
  );

  context.translate(x, y);
  context.rotate(elapsedMs * 0.00024);
  context.scale(1, 0.27);
  const disk = context.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.7);
  disk.addColorStop(0, "rgba(255, 255, 255, 0)");
  disk.addColorStop(0.34, rgba(BLACK_HOLE_THEME.primary, 0.92));
  disk.addColorStop(0.53, "rgba(255, 255, 255, 0.96)");
  disk.addColorStop(0.72, rgba(BLACK_HOLE_THEME.secondary, 0.78));
  disk.addColorStop(1, rgba(BLACK_HOLE_THEME.secondary, 0));
  context.fillStyle = disk;
  context.beginPath();
  context.arc(0, 0, radius * 1.8, 0, TAU);
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  const lens = context.createRadialGradient(x, y, radius * 0.28, x, y, radius * 1.22);
  lens.addColorStop(0, "rgba(0, 0, 0, 0)");
  lens.addColorStop(0.42, "rgba(0, 0, 0, 0)");
  lens.addColorStop(0.53, rgba(BLACK_HOLE_THEME.primary, 0.74));
  lens.addColorStop(0.61, "rgba(255, 255, 255, 0.54)");
  lens.addColorStop(0.69, rgba(BLACK_HOLE_THEME.secondary, 0.3));
  lens.addColorStop(1, rgba(BLACK_HOLE_THEME.secondary, 0));
  context.fillStyle = lens;
  context.beginPath();
  context.arc(x, y, radius * 1.24, 0, TAU);
  context.fill();
  context.restore();

  if (!environment.lowEffects && !environment.reducedMotion) {
    context.save();
    context.globalCompositeOperation = "screen";
    context.translate(x, y);
    context.rotate(-elapsedMs * 0.00019);
    context.scale(1, 0.3);
    context.lineCap = "round";
    for (let index = 0; index < 4; index += 1) {
      const photonRadius = radius * (1.02 + index * 0.19);
      const arcStart = elapsedMs * 0.00034 * (index % 2 ? -1 : 1) + index * 1.37;
      context.strokeStyle = rgba(
        index % 2 ? BLACK_HOLE_THEME.secondary : BLACK_HOLE_THEME.primary,
        reveal * (0.38 - index * 0.055),
      );
      context.lineWidth = Math.max(0.9, 2.5 - index * 0.42);
      context.shadowColor = index % 2
        ? rgba(BLACK_HOLE_THEME.secondary, 0.7)
        : rgba(BLACK_HOLE_THEME.primary, 0.74);
      context.shadowBlur = 8 + index * 2;
      context.beginPath();
      context.arc(0, 0, photonRadius, arcStart, arcStart + Math.PI * (0.48 + index * 0.11));
      context.stroke();
    }
    context.restore();
  }

  return { x, y, radius, engulf };
}

function drawEventHorizon(
  context: CanvasRenderingContext2D,
  field: BlackHoleField,
  environment: RenderEnvironment,
): void {
  if (field.radius <= 0) return;
  const diagonal = Math.hypot(environment.width, environment.height);
  const apertureRadius = lerp(field.radius * 0.49, diagonal * 1.08, field.engulf);

  context.save();
  context.fillStyle = "#000";
  context.shadowBlur = field.engulf < 0.92 ? lerp(16, 54, field.engulf) : 0;
  context.shadowColor = rgba(BLACK_HOLE_THEME.primary, 0.7 * (1 - field.engulf));
  context.beginPath();
  context.arc(field.x, field.y, apertureRadius, 0, TAU);
  context.fill();

  if (field.engulf > 0.02 && field.engulf < 0.96) {
    context.globalCompositeOperation = "screen";
    context.strokeStyle = rgba(
      BLACK_HOLE_THEME.primary,
      Math.sin(field.engulf * Math.PI) * 0.72,
    );
    context.lineWidth = lerp(2.4, 0.8, field.engulf);
    context.beginPath();
    context.arc(field.x, field.y, apertureRadius * 1.012, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function drawSuction(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  suctionProgress: number,
  fromX: number,
  fromY: number,
  holeX: number,
  holeY: number,
  environment: RenderEnvironment,
): void {
  if (suctionProgress <= 0 || suctionProgress >= 1 || environment.reducedMotion) return;
  context.save();
  context.globalCompositeOperation = "screen";
  const count = environment.lowEffects ? 10 : 26;
  for (let index = 0; index < count; index += 1) {
    const phase = (elapsedMs * 0.00042 * (0.7 + deterministic(index, 41)) + deterministic(index, 42)) % 1;
    const travel = easeInCubic(phase);
    const spread = (deterministic(index, 43) - 0.5) * environment.characterHeight * 0.48 * (1 - travel);
    const x = lerp(fromX + spread, holeX, travel);
    const y = lerp(fromY + (deterministic(index, 44) - 0.5) * environment.characterHeight * 0.34, holeY, travel);
    const next = clamp(travel + 0.07);
    context.strokeStyle = rgba(
      index % 2 ? BLACK_HOLE_THEME.primary : BLACK_HOLE_THEME.secondary,
      Math.sin(phase * Math.PI) * 0.52 * suctionProgress,
    );
    context.lineWidth = 0.8 + deterministic(index, 45) * 2.2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(lerp(fromX + spread, holeX, next), lerp(fromY, holeY, next));
    context.stroke();
  }
  context.restore();
}

function drawSpaghettifiedSinglePose(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  holeX: number,
  holeY: number,
  progress: number,
  alpha: number,
): void {
  const safePose = Math.max(0, Math.min(SHEET_COLUMNS * SHEET_ROWS - 1, pose));
  const sourceX = (safePose % SHEET_COLUMNS) * POSE_WIDTH;
  const sourceY = Math.floor(safePose / SHEET_COLUMNS) * POSE_HEIGHT;
  const scale = (environment.characterHeight / POSE_HEIGHT) * transform.scale;
  const targetWidth = POSE_WIDTH * scale * (transform.scaleX ?? 1);
  const slices = environment.lowEffects ? 20 : 36;
  const sourceSliceHeight = POSE_HEIGHT / slices;
  const targetSliceHeight = sourceSliceHeight * scale * (transform.scaleY ?? 1);
  const fade = 1 - smoothstep(inverseLerp(0.82, 1, progress));
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);

  context.save();
  context.globalAlpha = transform.alpha * alpha * fade;

  for (let index = 0; index < slices; index += 1) {
    const normalized = (index + 0.5) / slices;
    const topWeight = (1 - normalized) ** 0.68;
    const pull = clamp(
      progress * topWeight + progress ** 3 * (1 - topWeight),
    );
    const localY = (normalized - 0.5) * POSE_HEIGHT * scale * (transform.scaleY ?? 1);
    const baseX = transform.x - localY * sine;
    const baseY = transform.y + localY * cosine;
    const swirl = Math.sin(index * 0.47 + progress * 12.4) *
      environment.characterHeight * 0.045 * progress * (1 - pull);
    const destinationX = lerp(baseX, holeX, pull) + swirl;
    const destinationY = lerp(baseY, holeY, pull);
    const widthScale = lerp(1, 0.035, pull * 0.96);
    const stretch = 1 + progress * topWeight * (1 - pull * 0.52) * 5.4;

    context.drawImage(
      image,
      sourceX,
      sourceY + index * sourceSliceHeight,
      POSE_WIDTH,
      sourceSliceHeight,
      destinationX - targetWidth * widthScale * 0.5,
      destinationY - targetSliceHeight * stretch * 0.5,
      targetWidth * widthScale,
      targetSliceHeight * stretch + 0.8,
    );
  }
  context.restore();
}

function drawSpaghettifiedPose(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  moment: PoseMoment,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  holeX: number,
  holeY: number,
  progress: number,
): void {
  if (environment.reducedMotion || progress <= 0.015) {
    drawPoseBlend(context, image, moment, transform, environment);
    return;
  }

  const mix = smoothstep(inverseLerp(0.42, 0.58, moment.mix));
  if (moment.from === moment.to || mix <= 0.001) {
    drawSpaghettifiedSinglePose(
      context,
      image,
      moment.from,
      transform,
      environment,
      holeX,
      holeY,
      progress,
      1,
    );
    return;
  }

  drawSpaghettifiedSinglePose(
    context,
    image,
    moment.from,
    transform,
    environment,
    holeX,
    holeY,
    progress,
    1 - mix,
  );
  drawSpaghettifiedSinglePose(
    context,
    image,
    moment.to,
    transform,
    environment,
    holeX,
    holeY,
    progress,
    mix,
  );
}

function renderRegular(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  elapsedMs: number,
  stageMomentsMs: readonly number[],
  swipeAtMs: number,
  meteorAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): void {
  const protectedByBubble = environment.nebuSkin === "bubbles";
  const struggle = struggleSampleAt(elapsedMs, stageMomentsMs, swipeAtMs);
  const struggleStartedAt = stageMomentsMs[0] ?? Math.max(720, swipeAtMs - 1000);
  const isStruggling = elapsedMs >= struggleStartedAt && elapsedMs < swipeAtMs;
  const visibleIntensity = elapsedMs >= swipeAtMs
    ? environment.tierIntensity
    : clamp((struggle.levelIndex + struggle.progress) / 8);
  const activeTheme = elapsedMs >= swipeAtMs
    ? environment.theme
    : struggleThemeAt(struggle, false);
  const pose = regularPoseAt(
    elapsedMs,
    stageMomentsMs,
    swipeAtMs,
    impactAtMs,
    environment.reducedMotion,
    protectedByBubble,
  );
  const breath = environment.reducedMotion ? 0 : Math.sin(elapsedMs * 0.0031) * 0.009;
  const strainEnvelope = Math.sin(struggle.progress * Math.PI);
  const strain = isStruggling
    ? Math.sin(struggle.frameIndex * 1.87) * strainEnvelope *
      lerp(0.55, 2.35, visibleIntensity) * (environment.reducedMotion ? 0.18 : 1)
    : 0;
  const impactFade = protectedByBubble
    ? 1 - easeInCubic(inverseLerp(impactAtMs + 330, impactAtMs + 690, elapsedMs))
    : 1 - easeInCubic(inverseLerp(impactAtMs, impactAtMs + 230, elapsedMs));
  const swipeKick = elapsedMs >= swipeAtMs && elapsedMs < swipeAtMs + 300
    ? Math.sin(inverseLerp(swipeAtMs, swipeAtMs + 300, elapsedMs) * Math.PI)
    : 0;
  const exertion = isStruggling
    ? Math.sin(struggle.progress * Math.PI) ** 2 * lerp(0.42, 1, visibleIntensity)
    : 0;
  const transform: CharacterTransform = {
    x: environment.centerX + strain + swipeKick * 10,
    y: environment.centerY + Math.sin(elapsedMs * 0.0031) * (environment.reducedMotion ? 0 : 2.6) + swipeKick * 5,
    scale: 1 + breath - swipeKick * 0.018,
    scaleX: 1 + exertion * 0.022 + swipeKick * 0.052,
    scaleY: 1 - exertion * 0.028 - swipeKick * 0.038,
    rotation: strain * 0.0018 - swipeKick * 0.024,
    alpha: impactFade,
  };

  const magicStrength = elapsedMs < swipeAtMs
    ? isStruggling
      ? clamp(0.42 + visibleIntensity * 0.42 + struggle.progress * 0.18)
      : smoothstep(inverseLerp(struggleStartedAt - 420, struggleStartedAt, elapsedMs)) * 0.42
    : 1 - smoothstep(inverseLerp(swipeAtMs, swipeAtMs + 360, elapsedMs));
  const ambientStrength = clamp(magicStrength * 0.82 + visibleIntensity * 0.12);

  drawAmbientMagic(
    context,
    isStruggling ? struggle.sampledAtMs : elapsedMs,
    environment,
    transform.x,
    transform.y,
    ambientStrength,
    activeTheme,
    visibleIntensity,
  );
  drawConstellationOrbit(
    context,
    isStruggling ? struggle.sampledAtMs : elapsedMs,
    transform,
    environment,
    ambientStrength,
    activeTheme,
    visibleIntensity,
  );

  const activePose = pose.mix < 0.5 ? pose.from : pose.to;
  if (elapsedMs < swipeAtMs) {
    drawGravityTether(
      context,
      isStruggling ? struggle.sampledAtMs : elapsedMs,
      Math.max(1, Math.min(3, activePose)),
      transform,
      environment,
      magicStrength,
      activeTheme,
      visibleIntensity,
    );
  }
  drawGrounding(context, transform, environment, impactFade, activeTheme);

  const shieldRadius = environment.characterHeight * 0.455;
  const shieldCenterX = environment.centerX;
  const shieldCenterY = environment.centerY - environment.characterHeight * 0.015;
  if (protectedByBubble) {
    drawBubbleShieldBack(
      context,
      elapsedMs,
      impactAtMs,
      shieldCenterX,
      shieldCenterY,
      shieldRadius,
      environment,
    );
  }

  drawMotionEcho(
    context,
    image,
    pose,
    transform,
    environment,
    activeTheme,
    swipeKick,
  );
  drawCharacterAura(
    context,
    image,
    pose,
    transform,
    environment,
    activeTheme,
    magicStrength * lerp(0.34, 1, visibleIntensity),
  );
  drawPoseBlend(context, image, pose, transform, environment);
  drawCharacterEnergyWash(
    context,
    image,
    pose,
    transform,
    environment,
    activeTheme,
    magicStrength * lerp(0.045, 0.22, visibleIntensity) + swipeKick * 0.08,
  );

  if (magicStrength > 0.01 && elapsedMs < swipeAtMs + 340) {
    drawPawMagic(
      context,
      isStruggling ? struggle.sampledAtMs : elapsedMs,
      Math.max(1, Math.min(4, activePose)),
      transform,
      environment,
      magicStrength,
      activeTheme,
      visibleIntensity,
    );
  }

  const imageScale = environment.characterHeight / POSE_HEIGHT;
  const impactX = protectedByBubble
    ? shieldCenterX + shieldRadius * 0.23
    : environment.centerX;
  const impactY = protectedByBubble
    ? shieldCenterY - shieldRadius * 0.91
    : environment.centerY - imageScale * 44;
  drawMeteor(
    context,
    elapsedMs,
    meteorAtMs,
    impactAtMs,
    impactX,
    impactY,
    environment,
  );
  if (protectedByBubble) {
    drawBubbleShieldFront(
      context,
      elapsedMs,
      impactAtMs,
      shieldCenterX,
      shieldCenterY,
      shieldRadius,
      impactX,
      impactY,
      environment,
    );
  } else {
    drawImpact(
      context,
      elapsedMs,
      impactAtMs,
      impactX,
      impactY,
      environment,
    );
  }
}

function renderBlackHole(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  elapsedMs: number,
  stageMomentsMs: readonly number[],
  specialAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): void {
  const struggle = struggleSampleAt(elapsedMs, stageMomentsMs, specialAtMs);
  const struggleStartedAt = stageMomentsMs[0] ?? Math.max(720, specialAtMs - 1000);
  const isStruggling = elapsedMs >= struggleStartedAt && elapsedMs < specialAtMs;
  const pullProgress = smoothstep(inverseLerp(specialAtMs, impactAtMs - 260, elapsedMs));
  const spaghettifyProgress = smoothstep(
    inverseLerp(specialAtMs + 720, impactAtMs - 360, elapsedMs),
  );
  const holeX = environment.centerX;
  const holeY = environment.height * 0.205;
  let pose = regularPoseAt(
    Math.min(elapsedMs, specialAtMs - 0.001),
    stageMomentsMs,
    specialAtMs,
    impactAtMs,
    environment.reducedMotion,
  );
  if (elapsedMs >= specialAtMs && elapsedMs < specialAtMs + 520) {
    pose = {
      from: 2,
      to: 5,
      mix: inverseLerp(specialAtMs, specialAtMs + 520, elapsedMs),
    };
  } else if (elapsedMs >= specialAtMs + 520 && elapsedMs < specialAtMs + 1120) {
    pose = {
      from: 5,
      to: 6,
      mix: inverseLerp(specialAtMs + 520, specialAtMs + 1120, elapsedMs),
    };
  } else if (elapsedMs >= specialAtMs + 1120) {
    pose = {
      from: 6,
      to: 7,
      mix: clamp(spaghettifyProgress * 0.72),
    };
  }

  const gentleLift = easeInCubic(pullProgress);
  const orbit = environment.reducedMotion
    ? 0
    : Math.sin(pullProgress * Math.PI * 3.2) * 14 * pullProgress;
  const transform: CharacterTransform = {
    x: environment.centerX + orbit,
    y: lerp(environment.centerY, holeY + environment.characterHeight * 0.16, gentleLift * 0.58),
    scale: lerp(1, 0.82, gentleLift),
    scaleX: lerp(1, 0.9, gentleLift),
    scaleY: lerp(1, 1.14, gentleLift),
    rotation: environment.reducedMotion
      ? 0
      : Math.sin(pullProgress * Math.PI * 2.4) * 0.055 + pullProgress * 0.16,
    alpha: 1,
  };

  const visibleIntensity = clamp((struggle.levelIndex + struggle.progress) / 8);
  const struggleTheme = struggleThemeAt(struggle, true);
  const preMagicStrength = isStruggling
    ? clamp(0.42 + visibleIntensity * 0.42 + struggle.progress * 0.18)
    : smoothstep(inverseLerp(struggleStartedAt - 420, struggleStartedAt, elapsedMs)) * 0.42;
  const field = drawBlackHoleField(
    context,
    elapsedMs,
    specialAtMs,
    impactAtMs,
    environment,
  );

  drawAmbientMagic(
    context,
    isStruggling ? struggle.sampledAtMs : elapsedMs,
    environment,
    transform.x,
    transform.y,
    elapsedMs < specialAtMs
      ? preMagicStrength
      : clamp((1 - pullProgress) * 0.48 + pullProgress * 0.18),
    elapsedMs < specialAtMs ? struggleTheme : BLACK_HOLE_THEME,
    elapsedMs < specialAtMs ? visibleIntensity : 1,
  );

  if (elapsedMs < specialAtMs) {
    drawConstellationOrbit(
      context,
      isStruggling ? struggle.sampledAtMs : elapsedMs,
      transform,
      environment,
      preMagicStrength,
      struggleTheme,
      visibleIntensity,
    );
    const activePose = pose.mix < 0.5 ? pose.from : pose.to;
    drawGravityTether(
      context,
      struggle.sampledAtMs,
      Math.max(1, Math.min(3, activePose)),
      transform,
      environment,
      preMagicStrength,
      struggleTheme,
      visibleIntensity,
    );
    drawGrounding(context, transform, environment, 1, struggleTheme);
    drawCharacterAura(
      context,
      image,
      pose,
      transform,
      environment,
      struggleTheme,
      preMagicStrength * lerp(0.34, 1, visibleIntensity),
    );
    drawPoseBlend(context, image, pose, transform, environment);
    drawCharacterEnergyWash(
      context,
      image,
      pose,
      transform,
      environment,
      struggleTheme,
      preMagicStrength * lerp(0.045, 0.22, visibleIntensity),
    );

    if (preMagicStrength > 0.01) {
      drawPawMagic(
        context,
        struggle.sampledAtMs,
        Math.max(1, Math.min(3, activePose)),
        transform,
        environment,
        preMagicStrength,
        struggleTheme,
        visibleIntensity,
      );
    }
  } else {
    drawSuction(
      context,
      elapsedMs,
      pullProgress,
      transform.x,
      transform.y,
      holeX,
      holeY,
      environment,
    );
    if (pullProgress < 0.34) {
      drawGrounding(
        context,
        transform,
        environment,
        1 - pullProgress / 0.34,
        BLACK_HOLE_THEME,
      );
    }
    drawSpaghettifiedPose(
      context,
      image,
      pose,
      transform,
      environment,
      holeX,
      holeY,
      spaghettifyProgress,
    );
  }

  drawEventHorizon(context, field, environment);
}

export default function NebuWishSummon({
  tier,
  nebuSkin,
  stageMomentsMs,
  specialAtMs,
  impactAtMs,
  cardRevealAtMs,
  blackHole = false,
  lowEffects = false,
}: NebuWishSummonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useMemo(
    () => buildSparks(lowEffects ? 18 : 78),
    [lowEffects],
  );
  const swipeAtMs = specialAtMs;
  const meteorAtMs = swipeAtMs + 310;
  const rootStyle = {
    "--nebu-impact-at": `${impactAtMs}ms`,
    "--nebu-card-at": `${cardRevealAtMs}ms`,
    "--nebu-reveal-at": `${specialAtMs}ms`,
    "--nebu-focus-at": `${Math.max(0, swipeAtMs - 720)}ms`,
    "--nebu-tier-intensity": "0",
    "--nebu-final-intensity": String(clamp((tier - 1) / 8)),
  } as CSSProperties;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;
    const effectCanvas = document.createElement("canvas");
    const effectContext = effectCanvas.getContext("2d", { alpha: true });
    if (!effectContext) return;
    const effectSurface: EffectSurface = {
      canvas: effectCanvas,
      context: effectContext,
      pixelRatio: 1,
    };

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = mediaQuery.matches;
    const image = new Image();
    image.decoding = "async";
    image.src = getNebuSummonSprite(tier, blackHole, nebuSkin);

    let animationFrame = 0;
    let disposed = false;
    let loaded = image.complete && image.naturalWidth > 0;
    let renderedAtlas: CanvasImageSource = loaded
      ? createSkinnedAtlas(image, nebuSkin)
      : image;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let lastRenderedAt = Number.NEGATIVE_INFINITY;
    const startedAt = performance.now();
    const theme = readTheme(root);
    const tierIntensity = clamp((tier - 1) / 8);
    // Reduced motion removes secondary motion but keeps milestone timing alive.
    const targetFrameInterval = 1000 / (lowEffects ? 30 : reducedMotion ? 24 : 60);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, lowEffects ? 1.25 : 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      const effectQuality = lowEffects ? 0.55 : reducedMotion ? 0.75 : 1;
      effectSurface.pixelRatio = Math.max(
        0.25,
        Math.min(effectQuality, 1280 / width, 720 / height),
      );
      effectCanvas.width = Math.max(1, Math.round(width * effectSurface.pixelRatio));
      effectCanvas.height = Math.max(1, Math.round(height * effectSurface.pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", resize, { passive: true });
    resize();

    const draw = (elapsedMs: number) => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!loaded) return;

      const compactStage = width < 700;
      const characterHeight = Math.min(
        Math.max(height * (compactStage ? 0.38 : 0.44), compactStage ? 270 : 300),
        compactStage ? 410 : 500,
        width * (compactStage ? 0.82 : 0.62),
      );
      const stageFloorY = height * (compactStage ? 0.875 : 0.865);
      const centerY = stageFloorY - 344 * (characterHeight / POSE_HEIGHT);
      const environment: RenderEnvironment = {
        width,
        height,
        characterHeight,
        centerX: width * 0.5,
        centerY,
        tierIntensity,
        nebuSkin,
        reducedMotion,
        lowEffects,
        theme,
        skinLight: NEBU_SKIN_LIGHTS[nebuSkin],
        sparks,
        effectSurface,
      };

      if (blackHole) {
        renderBlackHole(
          context,
          renderedAtlas,
          elapsedMs,
          stageMomentsMs,
          specialAtMs,
          impactAtMs,
          environment,
        );
      } else {
        renderRegular(
          context,
          renderedAtlas,
          elapsedMs,
          stageMomentsMs,
          swipeAtMs,
          meteorAtMs,
          impactAtMs,
          environment,
        );
      }
    };

    // Imperative rendering keeps React out of the per-frame hot path.
    const tick = (now: number) => {
      if (disposed) return;
      const elapsedMs = now - startedAt;
      if (now - lastRenderedAt >= targetFrameInterval - 1) {
        draw(elapsedMs);
        lastRenderedAt = now;
      }

      if (elapsedMs < cardRevealAtMs + 760) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        context.clearRect(0, 0, width, height);
      }
    };

    image.onload = () => {
      renderedAtlas = createSkinnedAtlas(image, nebuSkin);
      loaded = true;
      draw(performance.now() - startedAt);
    };
    image.onerror = () => {
      loaded = false;
    };
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      image.onload = null;
      image.onerror = null;
    };
  }, [
    blackHole,
    cardRevealAtMs,
    impactAtMs,
    lowEffects,
    meteorAtMs,
    nebuSkin,
    sparks,
    specialAtMs,
    stageMomentsMs,
    swipeAtMs,
    tier,
  ]);

  return (
    <div
      ref={rootRef}
      className={styles.summon}
      style={rootStyle}
      data-nebu-skin={nebuSkin}
      data-black-hole={blackHole ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      aria-hidden="true"
    >
      <span className={styles.focusField} />
      <canvas ref={canvasRef} className={styles.cinematicCanvas} />
      <span className={styles.impactBloom} />
      <span className={styles.opticalVignette} />
      <span className={styles.filmGrain} />
    </div>
  );
}
