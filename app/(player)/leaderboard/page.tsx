"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";

import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

import styles from "./Leaderboard.module.css";

const MAX_VISIBLE_RANKS = 100;
const MAX_VISIBLE_GALAXIES = MAX_VISIBLE_RANKS - 1;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const INNER_ORBIT_SPEED = TAU / 92;
const OUTER_ORBIT_SPEED = TAU / 210;

type LeaderboardRow = {
  rank_position: number | string | null;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_cards: number | string | null;
  unique_cards: number | string | null;
  collection_value: number | string | null;
  lifetime_wishes: number | string | null;
  score: number | string | null;
  is_current_user: boolean | null;
};

type LeaderboardPlayer = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalCards: number;
  uniqueCards: number;
  collectionValue: number;
  lifetimeWishes: number;
  score: number;
  isCurrentUser: boolean;
  cosmicIssueNumber: number | null;
};

type GalaxyParticle = {
  radius: number;
  angle: number;
  size: number;
  brightness: number;
  warmth: number;
};

type GalaxyNode = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
  z: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitDepth: number;
  orbitDirection: number;
  orbitInclination: number;
  orbitEccentricity: number;
  orbitFlatten: number;
  size: number;
  hue: number;
  tilt: number;
  flatten: number;
  spin: number;
  particles: GalaxyParticle[];
};

type BackgroundStar = {
  x: number;
  y: number;
  z: number;
  size: number;
  brightness: number;
  phase: number;
  temperature: number;
};

type BlackHoleDust = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  brightness: number;
  warmth: number;
};

type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
  focusX: number;
  focusY: number;
  focusZ: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  scale: number;
  depth: number;
};

type GalaxyHit = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
  radius: number;
  depth: number;
};

type HoverLabel = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
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

function parseRows(value: unknown): LeaderboardPlayer[] {
  if (!Array.isArray(value)) return [];

  return (value as LeaderboardRow[])
    .map((row) => ({
      rank: toWholeNumber(row.rank_position),
      userId: row.user_id || "",
      username: row.username?.trim() || "trainer",
      displayName: row.display_name?.trim() || "Star Trainer",
      avatarUrl: row.avatar_url?.trim() || null,
      totalCards: toWholeNumber(row.total_cards),
      uniqueCards: toWholeNumber(row.unique_cards),
      collectionValue: toNumber(row.collection_value),
      lifetimeWishes: toWholeNumber(row.lifetime_wishes),
      score: toWholeNumber(row.score),
      isCurrentUser: row.is_current_user === true,
      cosmicIssueNumber: null,
    }))
    .filter((player) => player.rank > 0 && player.rank <= MAX_VISIBLE_RANKS)
    .sort((first, second) => first.rank - second.rank)
    .slice(0, MAX_VISIBLE_RANKS);
}

function buildGalaxyParticles(seed: number, rank: number): GalaxyParticle[] {
  const random = seededRandom(seed);
  const count = Math.round(clamp(92 - rank * 0.58, 24, 92));
  const arms = 2 + (seed % 3);

  return Array.from({ length: count }, (_, index) => {
    const radius = Math.pow(random(), 0.7);
    const arm = index % arms;
    const scatter = (random() - 0.5) * (0.28 + radius * 0.34);

    return {
      radius,
      angle: (arm / arms) * TAU + radius * (4.8 + (seed % 17) / 18) + scatter,
      size: 0.42 + random() * (radius < 0.25 ? 1.28 : 0.86),
      brightness: 0.28 + random() * 0.72,
      warmth: random(),
    };
  });
}

function buildGalaxyNodes(players: readonly LeaderboardPlayer[]): GalaxyNode[] {
  const galaxyPlayers = players
    .filter((player) => player.rank >= 2)
    .slice(0, MAX_VISIBLE_GALAXIES);
  const maximumCards = Math.max(1, ...galaxyPlayers.map((player) => player.totalCards));
  let previousSize = 0.108;

  return galaxyPlayers.map((player, index) => {
    const progress = clamp((player.rank - 2) / (MAX_VISIBLE_RANKS - 2), 0, 1);
    const rankPower = Math.pow(1 - progress, 0.72);
    const cardPower = Math.sqrt(player.totalCards / maximumCards);
    const requestedSize = 0.021 + rankPower * 0.065 + cardPower * 0.014;
    const size = clamp(Math.min(previousSize - 0.00042, requestedSize), 0.018, 0.105);
    previousSize = size;

    const seed = hashString(player.userId + ":" + player.rank);
    const random = seededRandom(seed);
    const angle = index * GOLDEN_ANGLE + (random() - 0.5) * 0.09;
    const orbit = 0.24 + Math.pow(progress, 0.68) * 0.9;
    const orbitInclination = (random() - 0.5) * 0.46;
    const orbitEccentricity = 1.06 + random() * 0.16;
    const orbitFlatten = 0.56 + random() * 0.13;
    const orbitX = Math.cos(angle) * orbit * orbitEccentricity;
    const orbitY = Math.sin(angle) * orbit * orbitFlatten;

    return {
      player,
      x: orbitX * Math.cos(orbitInclination) - orbitY * Math.sin(orbitInclination),
      y: orbitX * Math.sin(orbitInclination) + orbitY * Math.cos(orbitInclination),
      z: 0.03 + (random() - 0.5) * 0.24,
      orbitAngle: angle,
      orbitRadius: orbit,
      orbitSpeed: lerp(INNER_ORBIT_SPEED, OUTER_ORBIT_SPEED, Math.pow(progress, 0.72)),
      orbitDepth: 0.045 + progress * 0.055,
      orbitDirection: random() > 0.14 ? 1 : -1,
      orbitInclination,
      orbitEccentricity,
      orbitFlatten,
      size,
      hue: (188 + (seed % 174)) % 360,
      tilt: (random() - 0.5) * 1.2,
      flatten: 0.34 + random() * 0.23,
      spin: (random() > 0.5 ? 1 : -1) * (0.025 + random() * 0.038),
      particles: buildGalaxyParticles(seed ^ 0xa57ea, player.rank),
    };
  });
}

function resolveGalaxyPosition(
  node: GalaxyNode,
  time: number,
  reducedMotion: boolean,
): { x: number; y: number; z: number } {
  if (reducedMotion) {
    return { x: node.x, y: node.y, z: node.z };
  }

  const angle = node.orbitAngle + time * 0.001 * node.orbitSpeed * node.orbitDirection;
  const orbitX = Math.cos(angle) * node.orbitRadius * node.orbitEccentricity;
  const orbitY = Math.sin(angle) * node.orbitRadius * node.orbitFlatten;
  const cosInclination = Math.cos(node.orbitInclination);
  const sinInclination = Math.sin(node.orbitInclination);
  return {
    x: orbitX * cosInclination - orbitY * sinInclination,
    y: orbitX * sinInclination + orbitY * cosInclination,
    z: node.z + Math.sin(angle + node.tilt * 0.35) * node.orbitDepth,
  };
}

const BACKGROUND_STARS: BackgroundStar[] = (() => {
  const random = seededRandom(0x51a7c0de);
  return Array.from({ length: 320 }, () => ({
    x: (random() - 0.5) * 3.2,
    y: (random() - 0.5) * 2.25,
    z: -1.2 + random() * 1.8,
    size: 0.36 + random() * 1.34,
    brightness: 0.18 + random() * 0.66,
    phase: random() * TAU,
    temperature: random(),
  }));
})();

const BLACK_HOLE_DUST: BlackHoleDust[] = (() => {
  const random = seededRandom(0xb1ac40de);
  return Array.from({ length: 86 }, () => ({
    angle: random() * TAU,
    radius: 1.05 + Math.pow(random(), 0.72) * 1.08,
    speed: 0.00012 + random() * 0.00022,
    size: 0.34 + random() * 1.08,
    brightness: 0.18 + random() * 0.68,
    warmth: random(),
  }));
})();

function createProjector(
  camera: Camera,
  width: number,
  height: number,
): (point: { x: number; y: number; z: number }) => ProjectedPoint {
  const sinYaw = Math.sin(camera.yaw);
  const cosYaw = Math.cos(camera.yaw);
  const sinPitch = Math.sin(camera.pitch);
  const cosPitch = Math.cos(camera.pitch);
  const measure = Math.min(width, height);

  return (point) => {
    const worldX = point.x + camera.focusX;
    const worldY = point.y + camera.focusY;
    const worldZ = point.z + camera.focusZ;
    const yawX = worldX * cosYaw + worldZ * sinYaw;
    const yawZ = -worldX * sinYaw + worldZ * cosYaw;
    const pitchY = worldY * cosPitch - yawZ * sinPitch;
    const depth = worldY * sinPitch + yawZ * cosPitch;
    const perspective = 2.9 / Math.max(1.45, 2.9 - depth);
    const scale = perspective * camera.zoom;

    return {
      x: width / 2 + yawX * measure * 0.47 * scale,
      y: height / 2 + pitchY * measure * 0.47 * scale,
      scale,
      depth,
    };
  };
}

function hsla(hue: number, saturation: number, lightness: number, alpha: number): string {
  return "hsla(" + hue + "," + saturation + "%," + lightness + "%," + alpha + ")";
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera,
  time: number,
  reducedMotion: boolean,
) {
  const centreGlow = context.createRadialGradient(
    width * 0.5,
    height * 0.49,
    0,
    width * 0.5,
    height * 0.49,
    Math.max(width, height) * 0.72,
  );
  centreGlow.addColorStop(0, "rgba(35,31,79,0.24)");
  centreGlow.addColorStop(0.38, "rgba(12,14,43,0.14)");
  centreGlow.addColorStop(1, "rgba(1,2,9,0)");
  context.fillStyle = centreGlow;
  context.fillRect(0, 0, width, height);

  const leftNebula = context.createRadialGradient(
    width * 0.1,
    height * 0.3,
    0,
    width * 0.1,
    height * 0.3,
    Math.max(width, height) * 0.48,
  );
  leftNebula.addColorStop(0, "rgba(53,145,173,0.075)");
  leftNebula.addColorStop(0.44, "rgba(90,71,157,0.038)");
  leftNebula.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = leftNebula;
  context.fillRect(0, 0, width, height);

  const rightNebula = context.createRadialGradient(
    width * 0.92,
    height * 0.72,
    0,
    width * 0.92,
    height * 0.72,
    Math.max(width, height) * 0.52,
  );
  rightNebula.addColorStop(0, "rgba(124,54,145,0.065)");
  rightNebula.addColorStop(0.42, "rgba(31,126,153,0.032)");
  rightNebula.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = rightNebula;
  context.fillRect(0, 0, width, height);

  const projectBackground = createProjector({
    ...camera,
    focusX: camera.focusX * 0.08,
    focusY: camera.focusY * 0.08,
    focusZ: 0,
    zoom: 0.82 + camera.zoom * 0.12,
  }, width, height);

  for (const star of BACKGROUND_STARS) {
    const projected = projectBackground(star);
    if (projected.x < -4 || projected.x > width + 4 || projected.y < -4 || projected.y > height + 4) continue;
    const pulse = reducedMotion ? 1 : 0.78 + Math.sin(time * 0.00072 + star.phase) * 0.22;
    const colour = star.temperature > 0.68
      ? "rgba(213,247,255,"
      : star.temperature < 0.22
        ? "rgba(255,244,214,"
        : "rgba(238,235,255,";
    context.fillStyle = colour + clamp(star.brightness * pulse, 0.06, 0.82) + ")";
    context.beginPath();
    context.arc(projected.x, projected.y, Math.max(0.32, star.size * projected.scale), 0, TAU);
    context.fill();
  }
}

function drawGalaxy(
  context: CanvasRenderingContext2D,
  node: GalaxyNode,
  projected: ProjectedPoint,
  radius: number,
  time: number,
  selected: boolean,
  hovered: boolean,
  reducedMotion: boolean,
) {
  const intensity = selected ? 1.32 : hovered ? 1.16 : 1;
  const breathe = reducedMotion ? 1 : 0.97 + Math.sin(time * 0.0014 + node.orbitAngle) * 0.03;
  if (radius < 10 && !selected && !hovered && !node.player.isCurrentUser) {
    context.save();
    context.translate(projected.x, projected.y);
    context.rotate(node.tilt);
    context.globalCompositeOperation = "lighter";
    context.fillStyle = hsla(node.hue, 88, 68, 0.38);
    context.shadowColor = hsla(node.hue, 96, 72, 0.62);
    context.shadowBlur = radius * 0.82;
    context.beginPath();
    context.ellipse(0, 0, radius * 0.82, radius * node.flatten * 0.82, 0, 0, TAU);
    context.fill();
    context.fillStyle = "rgba(255,253,235,0.9)";
    context.shadowBlur = radius * 0.42;
    context.beginPath();
    context.arc(0, 0, Math.max(0.8, radius * 0.12), 0, TAU);
    context.fill();
    context.restore();
    return;
  }

  const halo = context.createRadialGradient(
    projected.x,
    projected.y,
    0,
    projected.x,
    projected.y,
    radius * 1.52 * breathe,
  );
  halo.addColorStop(0, hsla(node.hue + 22, 92, 86, 0.72 * intensity));
  halo.addColorStop(0.12, hsla(node.hue, 94, 70, 0.33 * intensity));
  halo.addColorStop(0.46, hsla(node.hue - 18, 88, 57, 0.12 * intensity));
  halo.addColorStop(1, hsla(node.hue, 88, 50, 0));
  context.fillStyle = halo;
  context.beginPath();
  context.arc(projected.x, projected.y, radius * 1.52 * breathe, 0, TAU);
  context.fill();

  const spin = reducedMotion ? 0 : time * 0.001 * node.spin;
  const cosTilt = Math.cos(node.tilt);
  const sinTilt = Math.sin(node.tilt);

  context.save();
  context.translate(projected.x, projected.y);
  context.rotate(node.tilt);
  context.scale(1, node.flatten);
  const disc = context.createRadialGradient(0, 0, radius * 0.04, 0, 0, radius * 1.08);
  disc.addColorStop(0, "rgba(255,253,232,0.9)");
  disc.addColorStop(0.16, hsla(node.hue + 18, 96, 76, 0.5 * intensity));
  disc.addColorStop(0.5, hsla(node.hue, 88, 55, 0.16 * intensity));
  disc.addColorStop(0.76, hsla(node.hue - 22, 82, 42, 0.055 * intensity));
  disc.addColorStop(1, hsla(node.hue, 80, 35, 0));
  context.fillStyle = disc;
  context.beginPath();
  context.arc(0, 0, radius * 1.08, 0, TAU);
  context.fill();

  context.globalAlpha = selected ? 0.3 : 0.18;
  context.strokeStyle = "rgba(2,3,12,0.96)";
  context.lineWidth = Math.max(0.7, radius * 0.055);
  for (let arm = 0; arm < 2; arm += 1) {
    context.beginPath();
    context.arc(0, 0, radius * (0.44 + arm * 0.24), spin + arm * Math.PI, spin + arm * Math.PI + Math.PI * 1.32);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "lighter";
  const particleStep = radius < 8 ? 3 : radius < 13 ? 2 : 1;
  for (let particleIndex = 0; particleIndex < node.particles.length; particleIndex += particleStep) {
    const particle = node.particles[particleIndex];
    const angle = particle.angle + spin;
    const radial = particle.radius * radius;
    const spiralX = Math.cos(angle) * radial;
    const spiralY = Math.sin(angle) * radial * node.flatten;
    const x = spiralX * cosTilt - spiralY * sinTilt;
    const y = spiralX * sinTilt + spiralY * cosTilt;
    const alpha = particle.brightness * (0.34 + (1 - particle.radius) * 0.42) * intensity;
    const lightness = particle.warmth > 0.74 ? 88 : 70 + particle.brightness * 18;

    context.fillStyle = particle.warmth > 0.86
      ? "rgba(255,246,213," + clamp(alpha, 0, 0.96) + ")"
      : hsla(node.hue + (particle.warmth - 0.5) * 44, 86, lightness, clamp(alpha, 0, 0.9));
    context.beginPath();
    context.arc(
      projected.x + x,
      projected.y + y,
      Math.max(0.34, particle.size * Math.max(0.52, projected.scale)),
      0,
      TAU,
    );
    context.fill();
  }

  context.fillStyle = "rgba(255,253,235,0.98)";
  context.shadowColor = hsla(node.hue, 100, 78, 0.96);
  context.shadowBlur = radius * (selected ? 0.74 : 0.48);
  context.beginPath();
  context.arc(projected.x, projected.y, Math.max(1.1, radius * 0.095), 0, TAU);
  context.fill();
  context.restore();

  if (selected || hovered || node.player.isCurrentUser) {
    context.save();
    context.strokeStyle = node.player.isCurrentUser
      ? "rgba(254,240,138,0.66)"
      : hsla(node.hue, 90, 88, selected ? 0.72 : 0.4);
    context.lineWidth = selected ? 1.2 : 0.75;
    context.setLineDash(selected ? [] : [2, 5]);
    context.beginPath();
    context.arc(projected.x, projected.y, radius * 1.28, 0, TAU);
    context.stroke();
    context.restore();
  }

  if (node.player.rank <= 10 && radius >= 15) {
    context.save();
    context.fillStyle = selected ? "rgba(255,249,218,0.9)" : "rgba(221,239,255,0.52)";
    context.font = "800 " + clamp(radius * 0.16, 7, 10) + "px ui-sans-serif, system-ui, sans-serif";
    context.letterSpacing = "0.08em";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.shadowColor = "rgba(0,0,0,0.92)";
    context.shadowBlur = 7;
    context.fillText("#" + node.player.rank, projected.x, projected.y + radius * 0.88);
    context.restore();
  }
}

function drawGalaxyTrails(
  context: CanvasRenderingContext2D,
  nodes: readonly GalaxyNode[],
  project: (point: { x: number; y: number; z: number }) => ProjectedPoint,
  measure: number,
  time: number,
  selectedUserId: string | null,
  hoveredUserId: string | null,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (const node of nodes) {
    const highlighted = node.player.userId === selectedUserId ||
      node.player.userId === hoveredUserId || node.player.isCurrentUser;
    if (!highlighted && node.player.rank > 24) continue;

    const samples = highlighted ? 11 : 7;
    const interval = highlighted ? 430 : 360;
    let previous = project(resolveGalaxyPosition(node, time - samples * interval, false));

    for (let sample = 1; sample <= samples; sample += 1) {
      const current = project(resolveGalaxyPosition(node, time - (samples - sample) * interval, false));
      const strength = sample / samples;
      context.strokeStyle = hsla(
        node.hue + 8,
        92,
        72,
        (highlighted ? 0.15 : 0.055) * strength,
      );
      context.lineWidth = clamp(node.size * measure * 0.045 * current.scale, 0.45, highlighted ? 2.1 : 1.15);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke();
      previous = current;
    }
  }

  context.restore();
}

function drawOrbitLanes(
  context: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  reducedMotion: boolean,
) {
  const radii = [0.31, 0.53, 0.77, 1.02];
  const inclinations = [0.04, -0.085, 0.11, -0.055];

  context.save();
  context.lineWidth = 0.65;
  context.setLineDash([1.5, 8]);
  const project = createProjector(camera, width, height);

  for (let lane = 0; lane < radii.length; lane += 1) {
    const radius = radii[lane];
    const inclination = inclinations[lane];
    const cosInclination = Math.cos(inclination);
    const sinInclination = Math.sin(inclination);
    context.lineDashOffset = reducedMotion ? 0 : -time * (0.002 + lane * 0.0004);
    context.strokeStyle = lane % 2 === 0
      ? "rgba(170,235,250,0.035)"
      : "rgba(205,188,255,0.03)";
    context.beginPath();

    for (let step = 0; step <= 72; step += 1) {
      const angle = (step / 72) * TAU;
      const orbitX = Math.cos(angle) * radius * 1.13;
      const orbitY = Math.sin(angle) * radius * 0.62;
      const projected = project({
        x: orbitX * cosInclination - orbitY * sinInclination,
        y: orbitX * sinInclination + orbitY * cosInclination,
        z: -0.08 + Math.sin(angle) * (0.025 + lane * 0.008),
      });

      if (step === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    }

    context.stroke();
  }

  context.restore();
}

function drawBlackHoleDust(
  context: CanvasRenderingContext2D,
  point: ProjectedPoint,
  radius: number,
  time: number,
  reducedMotion: boolean,
) {
  context.save();
  context.translate(point.x, point.y);
  context.rotate(-0.12);
  context.scale(1, 0.29);
  context.globalCompositeOperation = "lighter";

  for (const mote of BLACK_HOLE_DUST) {
    const angle = mote.angle + (reducedMotion ? 0 : time * mote.speed);
    const orbitRadius = radius * mote.radius;
    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius;
    const alpha = mote.brightness * (0.2 + Math.max(0, Math.sin(angle)) * 0.44);
    context.fillStyle = mote.warmth > 0.62
      ? "rgba(255,219,150," + alpha + ")"
      : "rgba(157,213,255," + alpha * 0.82 + ")";
    context.beginPath();
    context.arc(x, y, Math.max(0.4, mote.size * radius * 0.009), 0, TAU);
    context.fill();
  }

  context.restore();
}

function drawBlackHole(
  context: CanvasRenderingContext2D,
  point: ProjectedPoint,
  radius: number,
  time: number,
  active: boolean,
  reducedMotion: boolean,
) {
  const spin = reducedMotion ? 0.6 : time * 0.00017;
  const halo = context.createRadialGradient(point.x, point.y, radius * 0.24, point.x, point.y, radius * 2.35);
  halo.addColorStop(0, "rgba(0,0,0,0)");
  halo.addColorStop(0.28, active ? "rgba(177,149,255,0.2)" : "rgba(120,98,220,0.13)");
  halo.addColorStop(0.58, "rgba(63,180,213,0.055)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, radius * 2.35, 0, TAU);
  context.fill();

  context.save();
  context.globalCompositeOperation = "lighter";
  const jet = context.createLinearGradient(point.x, point.y - radius * 2.1, point.x, point.y + radius * 2.1);
  jet.addColorStop(0, "rgba(125,211,252,0)");
  jet.addColorStop(0.28, "rgba(139,180,255,0.05)");
  jet.addColorStop(0.5, active ? "rgba(221,214,254,0.13)" : "rgba(196,181,253,0.08)");
  jet.addColorStop(0.72, "rgba(139,180,255,0.04)");
  jet.addColorStop(1, "rgba(125,211,252,0)");
  context.fillStyle = jet;
  context.beginPath();
  context.moveTo(point.x - radius * 0.12, point.y);
  context.lineTo(point.x - radius * 0.48, point.y - radius * 2.1);
  context.lineTo(point.x + radius * 0.48, point.y - radius * 2.1);
  context.lineTo(point.x + radius * 0.12, point.y);
  context.lineTo(point.x + radius * 0.44, point.y + radius * 2.1);
  context.lineTo(point.x - radius * 0.44, point.y + radius * 2.1);
  context.closePath();
  context.fill();
  context.restore();

  drawBlackHoleDust(context, point, radius, time, reducedMotion);

  context.save();
  context.translate(point.x, point.y);
  context.rotate(-0.12);
  context.scale(1, 0.27);
  context.globalCompositeOperation = "lighter";

  for (let layer = 0; layer < 3; layer += 1) {
    const layerRadius = radius * (1.08 + layer * 0.19);
    context.lineCap = "round";
    context.lineWidth = radius * (0.16 - layer * 0.028);
    const gradient = context.createLinearGradient(-layerRadius, 0, layerRadius, 0);
    gradient.addColorStop(0, "rgba(89,221,255,0.12)");
    gradient.addColorStop(0.35, "rgba(160,123,255,0.72)");
    gradient.addColorStop(0.62, "rgba(255,246,212,0.94)");
    gradient.addColorStop(1, "rgba(255,174,86,0.16)");
    context.strokeStyle = gradient;
    for (let segment = 0; segment < 18; segment += 1) {
      const phase = spin * (layer % 2 ? -1.4 : 1) + segment * 0.39 + layer;
      const start = phase + Math.sin(segment * 2.1 + layer) * 0.11;
      const length = 0.09 + ((segment * 17 + layer * 11) % 9) * 0.022;
      context.beginPath();
      context.arc(0, 0, layerRadius, start, start + length);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.translate(point.x, point.y);
  context.rotate(0.055);
  context.scale(1, 0.34);
  context.strokeStyle = active ? "rgba(226,232,255,0.3)" : "rgba(188,197,255,0.16)";
  context.lineWidth = Math.max(0.7, radius * 0.016);
  context.setLineDash([radius * 0.04, radius * 0.085]);
  context.lineDashOffset = reducedMotion ? 0 : time * 0.012;
  context.beginPath();
  context.arc(0, 0, radius * 1.72, 0, TAU);
  context.stroke();
  context.restore();

  const lens = context.createRadialGradient(point.x - radius * 0.13, point.y - radius * 0.18, radius * 0.08, point.x, point.y, radius * 0.94);
  lens.addColorStop(0, "rgba(12,9,25,0.96)");
  lens.addColorStop(0.5, "rgba(2,2,7,1)");
  lens.addColorStop(0.84, "rgba(0,0,1,1)");
  lens.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = lens;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.91, 0, TAU);
  context.fill();

  context.save();
  context.strokeStyle = active ? "rgba(255,250,222,0.98)" : "rgba(246,240,255,0.9)";
  context.lineWidth = Math.max(1.2, radius * 0.045);
  context.shadowColor = active ? "rgba(250,204,21,0.82)" : "rgba(175,145,255,0.72)";
  context.shadowBlur = radius * 0.38;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.88, Math.PI * 0.09, Math.PI * 0.91);
  context.stroke();
  context.globalAlpha = 0.42;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.88, Math.PI * 1.08, Math.PI * 1.92);
  context.stroke();
  context.restore();

  context.fillStyle = "#000";
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.72, 0, TAU);
  context.fill();

  context.save();
  context.strokeStyle = active ? "rgba(254,249,219,0.36)" : "rgba(205,197,255,0.2)";
  context.lineWidth = Math.max(0.65, radius * 0.011);
  context.setLineDash([1, radius * 0.075]);
  context.lineDashOffset = reducedMotion ? 0 : -time * 0.018;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.99, 0, TAU);
  context.stroke();
  context.restore();
}

export default function LeaderboardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const hitsRef = useRef<GalaxyHit[]>([]);
  const nodesRef = useRef<GalaxyNode[]>([]);
  const pharaohRef = useRef<LeaderboardPlayer | null>(null);
  const selectedRef = useRef<LeaderboardPlayer | null>(null);
  const hoveredRef = useRef<LeaderboardPlayer | null>(null);
  const reducedMotionRef = useRef(false);
  const pageVisibleRef = useRef(true);
  const motionOverrideRef = useRef<boolean | null>(null);
  const pointerRef = useRef({ down: false, moved: false, x: 0, y: 0 });
  const hoverLabelRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });
  const cameraTargetRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [motionActive, setMotionActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_player_leaderboard", {
        p_limit: MAX_VISIBLE_RANKS,
      });
      if (error) throw error;

      const parsed = parseRows(data);
      const { data: cosmicHolders, error: cosmicError } = await supabase.rpc(
        "get_public_cosmic_nebu_holders",
        { p_user_ids: parsed.map((player) => player.userId).filter(Boolean) },
      );
      const cosmicByUser = new Map<string, number>();
      if (!cosmicError && Array.isArray(cosmicHolders)) {
        for (const holder of cosmicHolders as Array<{ user_id?: unknown; issue_number?: unknown }>) {
          const userId = typeof holder.user_id === "string" ? holder.user_id : "";
          const issue = toWholeNumber(holder.issue_number);
          if (userId && issue > 0) cosmicByUser.set(userId, issue);
        }
      }

      const nextPlayers = parsed.map((player) => ({
        ...player,
        cosmicIssueNumber: cosmicByUser.get(player.userId) ?? null,
      }));
      setPlayers(nextPlayers);
      setSelectedPlayer((current) =>
        current
          ? nextPlayers.find((player) => player.userId === current.userId) ?? null
          : null,
      );
    } catch (error: unknown) {
      console.error("Universe ranks error:", error);
      setErrorMessage(getErrorMessage(error, "The universe ranks could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadLeaderboard());
    return () => window.cancelAnimationFrame(frame);
  }, [loadLeaderboard]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 767px)");
    const syncCompact = () => setInfoPanelOpen(!compact.matches);
    syncCompact();
    compact.addEventListener("change", syncCompact);
    return () => {
      compact.removeEventListener("change", syncCompact);
    };
  }, []);

  const nodes = useMemo(() => buildGalaxyNodes(players), [players]);
  const pharaoh = players.find((player) => player.rank === 1) ?? null;
  const currentPlayer = players.find((player) => player.isCurrentUser) ?? null;
  const communityCards = useMemo(
    () => players.reduce((total, player) => total + player.totalCards, 0),
    [players],
  );
  const communityWishes = useMemo(
    () => players.reduce((total, player) => total + player.lifetimeWishes, 0),
    [players],
  );

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { pharaohRef.current = pharaoh; }, [pharaoh]);
  useEffect(() => { selectedRef.current = selectedPlayer; }, [selectedPlayer]);

  const renderScene = useCallback(function renderFrame(time: number) {
    frameRef.current = null;
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    const mobile = width < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.28 : 1.62);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }

    const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#02030b";
    context.fillRect(0, 0, width, height);

    const camera = cameraRef.current;
    const target = cameraTargetRef.current;
    const trackedPlayer = selectedRef.current;
    if (trackedPlayer && trackedPlayer.rank > 1) {
      const trackedNode = nodesRef.current.find(
        (node) => node.player.userId === trackedPlayer.userId,
      );
      if (trackedNode) {
        const trackedPosition = resolveGalaxyPosition(
          trackedNode,
          time,
          reducedMotionRef.current,
        );
        target.focusX = -trackedPosition.x * 0.34;
        target.focusY = -trackedPosition.y * 0.34;
        target.focusZ = -trackedPosition.z * 0.12;
      }
    }
    const settle = reducedMotionRef.current ? 1 : 0.075;
    camera.yaw = lerp(camera.yaw, target.yaw, settle);
    camera.pitch = lerp(camera.pitch, target.pitch, settle);
    camera.zoom = lerp(camera.zoom, target.zoom, settle);
    camera.focusX = lerp(camera.focusX, target.focusX, settle);
    camera.focusY = lerp(camera.focusY, target.focusY, settle);
    camera.focusZ = lerp(camera.focusZ, target.focusZ, settle);

    drawBackground(context, width, height, camera, time, reducedMotionRef.current);
    drawOrbitLanes(context, camera, width, height, time, reducedMotionRef.current);

    const measure = Math.min(width, height);
    const project = createProjector(camera, width, height);
    const centre = project({ x: 0, y: 0, z: 0.18 });
    const holeRadius = clamp(measure * 0.105 * centre.scale, mobile ? 52 : 68, mobile ? 82 : 132);
    const blackHoleActive = selectedRef.current?.rank === 1 || hoveredRef.current?.rank === 1;
    drawGalaxyTrails(
      context,
      nodesRef.current,
      project,
      measure,
      time,
      selectedRef.current?.userId ?? null,
      hoveredRef.current?.userId ?? null,
      reducedMotionRef.current,
    );
    const projectedNodes = nodesRef.current.map((node) => {
      const position = resolveGalaxyPosition(node, time, reducedMotionRef.current);
      return {
        node,
        projected: project(position),
      };
    }).sort((first, second) => first.projected.depth - second.projected.depth);
    const hits: GalaxyHit[] = [];
    let blackHoleDrawn = false;

    for (const item of projectedNodes) {
      if (!blackHoleDrawn && item.projected.depth >= centre.depth) {
        drawBlackHole(context, centre, holeRadius, time, blackHoleActive, reducedMotionRef.current);
        blackHoleDrawn = true;
      }
      const radius = clamp(item.node.size * measure * item.projected.scale, mobile ? 5.2 : 5.8, mobile ? 43 : 74);
      if (
        item.projected.x < -radius * 2 ||
        item.projected.x > width + radius * 2 ||
        item.projected.y < -radius * 2 ||
        item.projected.y > height + radius * 2
      ) continue;
      const selected = selectedRef.current?.userId === item.node.player.userId;
      const hovered = hoveredRef.current?.userId === item.node.player.userId;
      drawGalaxy(context, item.node, item.projected, radius, time, selected, hovered, reducedMotionRef.current);
      if (hovered && hoverLabelRef.current) {
        hoverLabelRef.current.style.transform =
          "translate3d(" + item.projected.x + "px," + item.projected.y + "px,0) " +
          "translate(-50%,calc(-100% - 1rem))";
      }
      hits.push({
        player: item.node.player,
        x: item.projected.x,
        y: item.projected.y,
        radius: Math.max(mobile ? 18 : 13, radius * 1.35),
        depth: item.projected.depth,
      });
    }

    if (!blackHoleDrawn) {
      drawBlackHole(context, centre, holeRadius, time, blackHoleActive, reducedMotionRef.current);
    }
    if (pharaohRef.current) {
      hits.push({
        player: pharaohRef.current,
        x: centre.x,
        y: centre.y,
        radius: holeRadius * 1.04,
        depth: centre.depth + 2,
      });
    }
    hitsRef.current = hits.sort((first, second) => second.depth - first.depth);

    if (pageVisibleRef.current && (!reducedMotionRef.current ||
      Math.abs(camera.yaw - target.yaw) > 0.001 ||
      Math.abs(camera.pitch - target.pitch) > 0.001 ||
      Math.abs(camera.zoom - target.zoom) > 0.001 ||
      Math.abs(camera.focusX - target.focusX) > 0.001 ||
      Math.abs(camera.focusY - target.focusY) > 0.001 ||
      Math.abs(camera.focusZ - target.focusZ) > 0.001)) {
      frameRef.current = window.requestAnimationFrame(renderFrame);
    }
  }, []);

  const queueRender = useCallback(() => {
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderScene);
  }, [renderScene]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => {
      const active = motionOverrideRef.current ?? !reduced.matches;
      reducedMotionRef.current = !active;
      setMotionActive(active);
      queueRender();
    };
    syncReduced();
    reduced.addEventListener("change", syncReduced);
    return () => reduced.removeEventListener("change", syncReduced);
  }, [queueRender]);

  useEffect(() => {
    const syncVisibility = () => {
      pageVisibleRef.current = document.visibilityState === "visible";
      if (pageVisibleRef.current) {
        queueRender();
      } else if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [queueRender]);

  useEffect(() => {
    queueRender();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(queueRender);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [nodes, pharaoh, queueRender]);

  const toggleMotion = useCallback(() => {
    const nextActive = reducedMotionRef.current;
    motionOverrideRef.current = nextActive;
    reducedMotionRef.current = !nextActive;
    setMotionActive(nextActive);
    queueRender();
  }, [queueRender]);

  const findHit = useCallback((clientX: number, clientY: number): GalaxyHit | null => {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    for (const hit of hitsRef.current) {
      if (Math.hypot(x - hit.x, y - hit.y) <= hit.radius) return hit;
    }
    return null;
  }, []);

  const selectPlayer = useCallback((player: LeaderboardPlayer | null) => {
    setSelectedPlayer(player);
    if (!player) {
      cameraTargetRef.current = { yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 };
      queueRender();
      return;
    }

    if (player.rank === 1) {
      cameraTargetRef.current = { yaw: 0, pitch: 0, zoom: 1.1, focusX: 0, focusY: 0, focusZ: 0 };
    } else {
      const node = nodesRef.current.find((candidate) => candidate.player.userId === player.userId);
      if (node) {
        const position = resolveGalaxyPosition(node, performance.now(), reducedMotionRef.current);
        cameraTargetRef.current = {
          yaw: clamp(-position.x * 0.14, -0.16, 0.16),
          pitch: clamp(position.y * 0.11, -0.11, 0.11),
          zoom: window.innerWidth < 768 ? 1.16 : 1.24,
          focusX: -position.x * 0.34,
          focusY: -position.y * 0.34,
          focusZ: -position.z * 0.12,
        };
      }
    }
    queueRender();
  }, [queueRender]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const pointer = pointerRef.current;

    if (pointer.down) {
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      if (Math.hypot(deltaX, deltaY) > 4) pointer.moved = true;
      cameraTargetRef.current.yaw = clamp(cameraTargetRef.current.yaw + deltaX * 0.0017, -0.38, 0.38);
      cameraTargetRef.current.pitch = clamp(cameraTargetRef.current.pitch - deltaY * 0.00145, -0.26, 0.26);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      setHoverLabel(null);
    } else if (event.pointerType !== "touch") {
      const selected = selectedRef.current;
      if (!selected) {
        cameraTargetRef.current.yaw = ((localX / Math.max(1, bounds.width)) - 0.5) * 0.085;
        cameraTargetRef.current.pitch = -((localY / Math.max(1, bounds.height)) - 0.5) * 0.06;
      }
      const hit = findHit(event.clientX, event.clientY);
      if (hoveredRef.current?.userId !== hit?.player.userId) {
        hoveredRef.current = hit?.player ?? null;
        setHoverLabel(hit ? { player: hit.player, x: hit.x, y: hit.y } : null);
      }
      event.currentTarget.style.cursor = hit ? "pointer" : "grab";
    }
    queueRender();
  }, [findHit, queueRender]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = { down: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grabbing";
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer.moved) {
      const hit = findHit(event.clientX, event.clientY);
      if (hit) selectPlayer(hit.player);
    }
    pointer.down = false;
    event.currentTarget.style.cursor = "grab";
  }, [findHit, selectPlayer]);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    cameraTargetRef.current.zoom = clamp(
      cameraTargetRef.current.zoom * (event.deltaY > 0 ? 0.92 : 1.08),
      0.74,
      1.58,
    );
    queueRender();
  }, [queueRender]);

  return (
    <section className={styles.page}>
      <h1 className="sr-only">Universe Ranks</h1>
      <div className={styles.ambientTop} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      {infoPanelOpen ? (
        <aside className={styles.infoPanel} aria-label="Universe ranks information">
          <div className={styles.panelHeading}>
            <div className={styles.panelCopy}>
              <p>Ancient Pulls · Live universe</p>
              <h2>Universe Ranks</h2>
              <span>One hundred collections. One gravitational centre.</span>
            </div>
            <div className={styles.panelActions}>
              <button type="button" onClick={() => void loadLeaderboard(true)} disabled={refreshing}>
                {refreshing ? "Reading…" : "Refresh"}
              </button>
              <button type="button" onClick={() => setInfoPanelOpen(false)} aria-label="Hide universe ranks information">×</button>
            </div>
          </div>
          <div className={styles.statsGrid}>
            <RankStat label="Ranked" value={loading ? "—" : formatWholeNumber(players.length)} />
            <RankStat label="Cards" value={loading ? "—" : formatWholeNumber(communityCards)} />
            <RankStat label="Wishes" value={loading ? "—" : formatWholeNumber(communityWishes)} />
            <RankStat label="Your orbit" value={loading ? "—" : currentPlayer ? "#" + currentPlayer.rank : "Unranked"} />
          </div>
        </aside>
      ) : (
        <button type="button" onClick={() => setInfoPanelOpen(true)} className={styles.infoButton} aria-label="Show universe ranks information">
          <span aria-hidden="true">✦</span>
          Show info
        </button>
      )}

      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void loadLeaderboard(true)}>Try again</button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => {
          pointerRef.current.down = false;
          event.currentTarget.style.cursor = "grab";
        }}
        onPointerLeave={() => {
          if (!pointerRef.current.down) {
            hoveredRef.current = null;
            setHoverLabel(null);
            queueRender();
          }
        }}
        onWheel={handleWheel}
        aria-label="Interactive map of the top one hundred collections"
      >
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

        {loading ? (
          <div className={styles.loadingState} role="status">
            <span><i /></span>
            <p>Mapping the universe</p>
          </div>
        ) : players.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <h2>The ranked universe is waiting.</h2>
            <p>The first collection will become its centre.</p>
          </div>
        ) : null}

        {hoverLabel && !selectedPlayer ? (
          <div
            ref={hoverLabelRef}
            className={styles.hoverLabel}
            style={{
              transform: "translate3d(" + hoverLabel.x + "px," + hoverLabel.y + "px,0) translate(-50%,calc(-100% - 1rem))",
            }}
            aria-hidden="true"
          >
            <small>{hoverLabel.player.rank === 1 ? "#1 · The Pharaoh" : "Rank #" + hoverLabel.player.rank}</small>
            <strong>{hoverLabel.player.displayName}</strong>
          </div>
        ) : null}

        {!loading && pharaoh && (!selectedPlayer || selectedPlayer.rank === 1) ? (
          <div className={styles.centreCaption} aria-hidden="true">
            <span>#1 · The Pharaoh</span>
            <strong>{pharaoh.displayName}</strong>
          </div>
        ) : null}
      </div>

      {!loading && players.length > 0 ? (
        <div className={styles.sceneControls} aria-label="Universe motion controls">
          <span className={motionActive ? styles.liveStatus : styles.pausedStatus}>
            <i aria-hidden="true" />
            {motionActive ? "Live orbit" : "Orbit paused"}
          </span>
          <span className={styles.controlHint}>Drag to explore · Select a galaxy</span>
          <button type="button" onClick={toggleMotion} aria-pressed={!motionActive}>
            {motionActive ? "Pause" : "Play"}
          </button>
        </div>
      ) : null}

      {selectedPlayer ? <RankDetails player={selectedPlayer} onClose={() => selectPlayer(null)} /> : null}

      <ol className="sr-only">
        {players.map((player) => (
          <li key={"accessible-" + (player.userId || player.rank)}>
            <button type="button" onClick={() => selectPlayer(player)}>
              Rank {player.rank}: {player.displayName}, {player.totalCards} cards
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RankStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rankStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RankDetails({ player, onClose }: { player: LeaderboardPlayer; onClose: () => void }) {
  return (
    <aside className={styles.rankDetails} aria-label={player.displayName + " rank details"}>
      <div className={styles.detailHeading}>
        <div className={styles.detailIdentity}>
          <div className={styles.detailAvatar}>
            {player.avatarUrl ? (
              <Image src={player.avatarUrl} alt="" width={54} height={54} unoptimized />
            ) : player.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p>{player.rank === 1 ? "The Pharaoh" : "Universe rank #" + player.rank}</p>
            <h2>{player.displayName}</h2>
            <span>@{player.username}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close rank details">×</button>
      </div>

      {player.cosmicIssueNumber ? (
        <div className={styles.cosmicBadge}>✦ Cosmic Nebu #{String(player.cosmicIssueNumber).padStart(6, "0")}</div>
      ) : null}

      <div className={styles.detailGrid}>
        <RankStat label="Cards" value={formatWholeNumber(player.totalCards)} />
        <RankStat label="Unique" value={formatWholeNumber(player.uniqueCards)} />
        <RankStat label="Wishes" value={formatWholeNumber(player.lifetimeWishes)} />
        <RankStat label="Value" value={formatMoney(player.collectionValue)} />
      </div>
      <div className={styles.scoreLine}>
        <span>Dynasty score</span>
        <strong>{formatWholeNumber(player.score)}</strong>
      </div>
    </aside>
  );
}
