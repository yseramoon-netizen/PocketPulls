"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
} from "react";

import styles from "./NebuWishSummon.module.css";

const KEYPOSE_SHEET =
  "/ancient-pulls/wish/nebu-cinematic/nebu-keyposes-v1.webp";
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 2;
const POSE_WIDTH = 768;
const POSE_HEIGHT = 1024;
const TAU = Math.PI * 2;

type NebuWishSummonProps = {
  tier: number;
  specialAtMs: number;
  impactAtMs: number;
  cardRevealAtMs: number;
  blackHole?: boolean;
  lowEffects?: boolean;
};

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];

type Theme = {
  primary: Rgb;
  secondary: Rgb;
  glow: Rgb;
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
  rotation: number;
  alpha: number;
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
  reducedMotion: boolean;
  lowEffects: boolean;
  theme: Theme;
  sparks: readonly SparkSeed[];
};

const PAW_POSITION_BY_POSE: Readonly<Record<number, readonly [number, number]>> = {
  1: [500, 284],
  2: [544, 224],
  3: [560, 228],
  4: [572, 696],
};

// Pose order: idle, raise, charged, strain, swipe, track, alarm, cover.

export function getNebuSummonSprite(
  _tier: number,
  _blackHole = false,
): string {
  return KEYPOSE_SHEET;
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

function smoothstep(value: number): number {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
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
      computed.getPropertyValue("--wish-primary"),
      [250, 190, 58],
    ),
    secondary: parseCssColor(
      computed.getPropertyValue("--wish-secondary"),
      [124, 58, 237],
    ),
    glow: parseCssColor(
      computed.getPropertyValue("--wish-glow"),
      [250, 204, 82],
    ),
  };
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
): void {
  const imageScale = environment.characterHeight / POSE_HEIGHT;
  const groundY = transform.y + 344 * imageScale * transform.scale;
  const radius = 232 * imageScale * transform.scale;

  drawEllipseGlow(
    context,
    transform.x,
    groundY + 3,
    radius * 1.48,
    radius * 0.3,
    environment.theme.primary,
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
  image: HTMLImageElement,
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
  image: HTMLImageElement,
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
  const localX = (sourceX - POSE_WIDTH / 2) * scale;
  const localY = (sourceY - POSE_HEIGHT / 2) * scale;
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return [
    transform.x + localX * cosine - localY * sine,
    transform.y + localX * sine + localY * cosine,
  ];
}

function drawPawMagic(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  pose: number,
  transform: CharacterTransform,
  environment: RenderEnvironment,
  strength: number,
): void {
  const [x, y] = pawPosition(pose, transform, environment);
  const pulse = 0.9 + Math.sin(elapsedMs * 0.011) * 0.1;
  const radius = environment.characterHeight * 0.09 * pulse;

  context.save();
  context.globalCompositeOperation = "screen";
  drawEllipseGlow(
    context,
    x,
    y,
    radius * 1.75,
    radius * 1.75,
    environment.theme.glow,
    0.34 * strength,
  );

  const orbitCount = environment.lowEffects ? 5 : 11;
  for (let index = 0; index < orbitCount; index += 1) {
    const orbit = elapsedMs * 0.0024 * (index % 2 ? -1 : 1) + index * 2.17;
    const orbitRadius = radius * (0.46 + (index % 4) * 0.16);
    const sparkleX = x + Math.cos(orbit) * orbitRadius;
    const sparkleY = y + Math.sin(orbit) * orbitRadius * 0.58;
    const sparkleAlpha = strength * (0.35 + (index % 3) * 0.18);
    context.fillStyle = index % 3 === 0
      ? `rgba(255, 255, 255, ${sparkleAlpha})`
      : rgba(environment.theme.primary, sparkleAlpha);
    context.beginPath();
    context.arc(sparkleX, sparkleY, 1 + (index % 3) * 0.7, 0, TAU);
    context.fill();
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
): void {
  if (strength <= 0.001) return;
  context.save();
  context.globalCompositeOperation = "screen";

  const fieldRadius = environment.characterHeight * 0.42;
  for (let index = 0; index < environment.sparks.length; index += 1) {
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
      : rgba(index % 2 ? environment.theme.primary : environment.theme.secondary, alpha);
    context.beginPath();
    context.arc(x, y, seed.size * (0.65 + environment.tierIntensity * 0.35), 0, TAU);
    context.fill();
  }

  context.restore();
}

function regularPoseAt(
  elapsedMs: number,
  swipeAtMs: number,
  impactAtMs: number,
  reducedMotion: boolean,
): PoseMoment {
  const raiseStartsAt = Math.max(360, Math.min(720, swipeAtMs - 760));
  const strainStartsAt = Math.max(raiseStartsAt + 240, Math.min(1040, swipeAtMs - 420));
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
    if (reducedMotion) return { from: 2, to: 2, mix: 0 };
    const loop = ((elapsedMs - strainStartsAt) % 760) / 760;
    if (loop < 0.5) return { from: 2, to: 3, mix: loop * 2 };
    return { from: 3, to: 2, mix: (loop - 0.5) * 2 };
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
  const tailLength = lerp(150, 310, environment.tierIntensity);
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
  context.lineWidth = lerp(10, 18, environment.tierIntensity);
  context.shadowBlur = 25;
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
  }

  const coreRadius = lerp(13, 24, environment.tierIntensity) *
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
  }
  context.restore();
}

function drawBlackHole(
  context: CanvasRenderingContext2D,
  elapsedMs: number,
  specialAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): readonly [number, number, number] {
  const x = environment.centerX;
  const y = environment.height * 0.205;
  const reveal = easeOutCubic(inverseLerp(specialAtMs, specialAtMs + 840, elapsedMs));
  const consume = inverseLerp(impactAtMs, impactAtMs + 300, elapsedMs);
  const radius = lerp(4, Math.min(environment.width, environment.height) * 0.115, reveal) *
    lerp(1, 0.08, easeInCubic(consume));
  if (reveal <= 0 || consume >= 1) return [x, y, radius];

  context.save();
  context.globalAlpha = 1 - consume;
  context.globalCompositeOperation = "screen";

  drawEllipseGlow(
    context,
    x,
    y,
    radius * 2.3,
    radius * 2.3,
    environment.theme.secondary,
    0.24 * reveal,
  );

  context.translate(x, y);
  context.rotate(elapsedMs * 0.00024);
  context.scale(1, 0.27);
  const disk = context.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.7);
  disk.addColorStop(0, "rgba(255, 255, 255, 0)");
  disk.addColorStop(0.34, rgba(environment.theme.primary, 0.9));
  disk.addColorStop(0.53, "rgba(255, 255, 255, 0.96)");
  disk.addColorStop(0.72, rgba(environment.theme.secondary, 0.76));
  disk.addColorStop(1, rgba(environment.theme.secondary, 0));
  context.fillStyle = disk;
  context.beginPath();
  context.arc(0, 0, radius * 1.8, 0, TAU);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = 1 - consume;
  const lens = context.createRadialGradient(x, y, radius * 0.28, x, y, radius * 1.22);
  lens.addColorStop(0, "rgba(0, 0, 0, 1)");
  lens.addColorStop(0.42, "rgba(0, 0, 0, 1)");
  lens.addColorStop(0.53, rgba(environment.theme.primary, 0.74));
  lens.addColorStop(0.61, "rgba(255, 255, 255, 0.54)");
  lens.addColorStop(0.69, rgba(environment.theme.secondary, 0.28));
  lens.addColorStop(1, rgba(environment.theme.secondary, 0));
  context.fillStyle = lens;
  context.beginPath();
  context.arc(x, y, radius * 1.24, 0, TAU);
  context.fill();
  context.fillStyle = "#000";
  context.beginPath();
  context.arc(x, y, radius * 0.47, 0, TAU);
  context.fill();
  context.restore();

  return [x, y, radius];
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
      index % 2 ? environment.theme.primary : environment.theme.secondary,
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

function renderRegular(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  elapsedMs: number,
  swipeAtMs: number,
  meteorAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): void {
  const pose = regularPoseAt(
    elapsedMs,
    swipeAtMs,
    impactAtMs,
    environment.reducedMotion,
  );
  const breath = environment.reducedMotion ? 0 : Math.sin(elapsedMs * 0.0031) * 0.009;
  const strain = elapsedMs >= Math.max(800, swipeAtMs - 900) && elapsedMs < swipeAtMs
    ? Math.sin(elapsedMs * 0.052) * (environment.reducedMotion ? 0 : 1.8)
    : 0;
  const impactFade = 1 - easeInCubic(inverseLerp(impactAtMs, impactAtMs + 230, elapsedMs));
  const swipeKick = elapsedMs >= swipeAtMs && elapsedMs < swipeAtMs + 300
    ? Math.sin(inverseLerp(swipeAtMs, swipeAtMs + 300, elapsedMs) * Math.PI)
    : 0;
  const transform: CharacterTransform = {
    x: environment.centerX + strain + swipeKick * 10,
    y: environment.centerY + Math.sin(elapsedMs * 0.0031) * (environment.reducedMotion ? 0 : 2.6) + swipeKick * 5,
    scale: 1 + breath - swipeKick * 0.018,
    rotation: strain * 0.0018 - swipeKick * 0.024,
    alpha: impactFade,
  };

  const magicStrength = elapsedMs < swipeAtMs
    ? smoothstep(inverseLerp(Math.max(620, swipeAtMs - 940), swipeAtMs - 80, elapsedMs))
    : 1 - smoothstep(inverseLerp(swipeAtMs, swipeAtMs + 360, elapsedMs));
  const ambientStrength = clamp(magicStrength * 0.82 + environment.tierIntensity * 0.12);

  drawAmbientMagic(
    context,
    elapsedMs,
    environment,
    transform.x,
    transform.y,
    ambientStrength,
  );
  drawGrounding(context, transform, environment, impactFade);

  drawPoseBlend(context, image, pose, transform, environment);

  if (magicStrength > 0.01 && elapsedMs < swipeAtMs + 340) {
    const activePose = pose.mix < 0.5 ? pose.from : pose.to;
    drawPawMagic(
      context,
      elapsedMs,
      Math.max(1, Math.min(4, activePose)),
      transform,
      environment,
      magicStrength,
    );
  }

  const imageScale = environment.characterHeight / POSE_HEIGHT;
  const impactX = environment.centerX;
  const impactY = environment.centerY - imageScale * 44;
  drawMeteor(
    context,
    elapsedMs,
    meteorAtMs,
    impactAtMs,
    impactX,
    impactY,
    environment,
  );
  drawImpact(
    context,
    elapsedMs,
    impactAtMs,
    impactX,
    impactY,
    environment,
  );
}

function renderBlackHole(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  elapsedMs: number,
  specialAtMs: number,
  impactAtMs: number,
  environment: RenderEnvironment,
): void {
  const warningAtMs = Math.max(520, specialAtMs - 260);
  const suctionAtMs = specialAtMs + 880;
  const suctionProgress = easeInCubic(inverseLerp(suctionAtMs, impactAtMs, elapsedMs));
  const holeX = environment.centerX;
  const holeY = environment.height * 0.205;

  let pose: PoseMoment;
  if (elapsedMs < warningAtMs) {
    pose = { from: 0, to: 0, mix: 0 };
  } else if (elapsedMs < specialAtMs + 420) {
    pose = {
      from: 0,
      to: 5,
      mix: inverseLerp(warningAtMs, specialAtMs + 280, elapsedMs),
    };
  } else if (elapsedMs < suctionAtMs) {
    pose = {
      from: 5,
      to: 6,
      mix: inverseLerp(specialAtMs + 420, suctionAtMs, elapsedMs),
    };
  } else {
    pose = suctionProgress < 0.38
      ? { from: 6, to: 7, mix: suctionProgress / 0.38 }
      : { from: 7, to: 6, mix: (suctionProgress - 0.38) / 0.62 };
  }

  const lift = easeInCubic(suctionProgress);
  const orbit = environment.reducedMotion ? 0 : Math.sin(suctionProgress * Math.PI * 2.2) * 38 * suctionProgress;
  const alpha = 1 - smoothstep(inverseLerp(0.78, 1, suctionProgress));
  const transform: CharacterTransform = {
    x: lerp(environment.centerX, holeX, lift) + orbit,
    y: lerp(environment.centerY, holeY + 12, lift),
    scale: lerp(1, 0.12, lift),
    rotation: environment.reducedMotion ? 0 : lift * 2.15,
    alpha,
  };

  drawAmbientMagic(
    context,
    elapsedMs,
    environment,
    transform.x,
    transform.y,
    clamp(inverseLerp(specialAtMs, specialAtMs + 900, elapsedMs) * (1 - suctionProgress)),
  );
  drawSuction(
    context,
    elapsedMs,
    suctionProgress,
    transform.x,
    transform.y,
    holeX,
    holeY,
    environment,
  );
  if (suctionProgress < 0.42) {
    drawGrounding(context, transform, environment, 1 - suctionProgress / 0.42);
  }
  drawPoseBlend(context, image, pose, transform, environment);
  drawBlackHole(
    context,
    elapsedMs,
    specialAtMs,
    impactAtMs,
    environment,
  );
  drawImpact(
    context,
    elapsedMs,
    impactAtMs,
    holeX,
    holeY,
    environment,
  );
}

export default function NebuWishSummon({
  tier,
  specialAtMs,
  impactAtMs,
  cardRevealAtMs,
  blackHole = false,
  lowEffects = false,
}: NebuWishSummonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useMemo(
    () => buildSparks(lowEffects ? 18 : 54 + Math.min(24, Math.max(0, tier - 1) * 3)),
    [lowEffects, tier],
  );
  const swipeAtMs = useMemo(
    () => Math.max(920, Math.min(specialAtMs, impactAtMs - 680)),
    [impactAtMs, specialAtMs],
  );
  const meteorAtMs = swipeAtMs + 310;
  const rootStyle = {
    "--nebu-impact-at": `${impactAtMs}ms`,
    "--nebu-card-at": `${cardRevealAtMs}ms`,
    "--nebu-focus-at": `${Math.max(0, swipeAtMs - 720)}ms`,
    "--nebu-tier-intensity": String(clamp((tier - 1) / 8)),
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

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = mediaQuery.matches;
    const image = new Image();
    image.decoding = "async";
    image.src = KEYPOSE_SHEET;

    let animationFrame = 0;
    let disposed = false;
    let loaded = image.complete && image.naturalWidth > 0;
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

      const characterHeight = Math.min(
        Math.max(height * 0.62, 430),
        680,
        width * 1.08,
      );
      const environment: RenderEnvironment = {
        width,
        height,
        characterHeight,
        centerX: width * 0.5,
        centerY: height * (width < 700 ? 0.54 : 0.515),
        tierIntensity,
        reducedMotion,
        lowEffects,
        theme,
        sparks,
      };

      if (blackHole) {
        renderBlackHole(
          context,
          image,
          elapsedMs,
          specialAtMs,
          impactAtMs,
          environment,
        );
      } else {
        renderRegular(
          context,
          image,
          elapsedMs,
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
    sparks,
    specialAtMs,
    swipeAtMs,
    tier,
  ]);

  return (
    <div
      ref={rootRef}
      className={styles.summon}
      style={rootStyle}
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
