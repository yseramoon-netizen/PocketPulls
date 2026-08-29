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

    return {
      player,
      x: Math.cos(angle) * orbit * 1.18,
      y: Math.sin(angle) * orbit * 0.72,
      z: 0.48 - progress * 0.92 + (random() - 0.5) * 0.16,
      orbitAngle: angle,
      orbitRadius: orbit,
      orbitSpeed: 0.000026 - progress * 0.000013,
      orbitDepth: 0.045 + progress * 0.055,
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

  const angle = node.orbitAngle + time * node.orbitSpeed;
  return {
    x: Math.cos(angle) * node.orbitRadius * 1.18,
    y: Math.sin(angle) * node.orbitRadius * 0.72,
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
  const halo = context.createRadialGradient(
    projected.x,
    projected.y,
    0,
    projected.x,
    projected.y,
    radius * 1.42,
  );
  halo.addColorStop(0, hsla(node.hue + 22, 92, 86, 0.72 * intensity));
  halo.addColorStop(0.12, hsla(node.hue, 94, 70, 0.33 * intensity));
  halo.addColorStop(0.46, hsla(node.hue - 18, 88, 57, 0.12 * intensity));
  halo.addColorStop(1, hsla(node.hue, 88, 50, 0));
  context.fillStyle = halo;
  context.beginPath();
  context.arc(projected.x, projected.y, radius * 1.42, 0, TAU);
  context.fill();

  const spin = reducedMotion ? 0 : time * 0.001 * node.spin;
  const cosTilt = Math.cos(node.tilt);
  const sinTilt = Math.sin(node.tilt);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (const particle of node.particles) {
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
}

function drawOrbitLanes(
  context: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
) {
  const radii = [0.31, 0.53, 0.77, 1.02];

  context.save();
  context.lineWidth = 0.65;
  context.setLineDash([1.5, 8]);
  const project = createProjector(camera, width, height);

  for (let lane = 0; lane < radii.length; lane += 1) {
    const radius = radii[lane];
    context.strokeStyle = lane % 2 === 0
      ? "rgba(170,235,250,0.035)"
      : "rgba(205,188,255,0.03)";
    context.beginPath();

    for (let step = 0; step <= 72; step += 1) {
      const angle = (step / 72) * TAU;
      const projected = project({
        x: Math.cos(angle) * radius * 1.18,
        y: Math.sin(angle) * radius * 0.72,
        z: -0.08 + Math.sin(angle) * (0.025 + lane * 0.008),
      });

      if (step === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    }

    context.stroke();
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
  const pointerRef = useRef({ down: false, moved: false, x: 0, y: 0 });
  const hoverLabelRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });
  const cameraTargetRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncCompact = () => setInfoPanelOpen(!compact.matches);
    const syncReduced = () => { reducedMotionRef.current = reduced.matches; };
    syncCompact();
    syncReduced();
    compact.addEventListener("change", syncCompact);
    reduced.addEventListener("change", syncReduced);
    return () => {
      compact.removeEventListener("change", syncCompact);
      reduced.removeEventListener("change", syncReduced);
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

  const renderScene = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    const mobile = width < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.16 : 1.55);
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
    drawOrbitLanes(context, camera, width, height);

    const measure = Math.min(width, height);
    const project = createProjector(camera, width, height);
    const projectedNodes = nodesRef.current.map((node) => {
      const position = resolveGalaxyPosition(node, time, reducedMotionRef.current);
      return {
        node,
        projected: project(position),
      };
    }).sort((first, second) => first.projected.depth - second.projected.depth);
    const hits: GalaxyHit[] = [];

    for (const item of projectedNodes) {
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
        hoverLabelRef.current.style.left = item.projected.x + "px";
        hoverLabelRef.current.style.top = item.projected.y + "px";
      }
      hits.push({
        player: item.node.player,
        x: item.projected.x,
        y: item.projected.y,
        radius: Math.max(mobile ? 18 : 13, radius * 1.35),
        depth: item.projected.depth,
      });
    }

    const centre = project({ x: 0, y: 0, z: 0.18 });
    const holeRadius = clamp(measure * 0.105 * centre.scale, mobile ? 52 : 68, mobile ? 82 : 132);
    drawBlackHole(
      context,
      centre,
      holeRadius,
      time,
      selectedRef.current?.rank === 1 || hoveredRef.current?.rank === 1,
      reducedMotionRef.current,
    );
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

    if (!reducedMotionRef.current ||
      Math.abs(camera.yaw - target.yaw) > 0.001 ||
      Math.abs(camera.pitch - target.pitch) > 0.001 ||
      Math.abs(camera.zoom - target.zoom) > 0.001 ||
      Math.abs(camera.focusX - target.focusX) > 0.001 ||
      Math.abs(camera.focusY - target.focusY) > 0.001) {
      frameRef.current = window.requestAnimationFrame(renderScene);
    } else {
      frameRef.current = null;
    }
  }, []);

  const queueRender = useCallback(() => {
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderScene);
  }, [renderScene]);

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
      } else if (hit) {
        setHoverLabel({ player: hit.player, x: hit.x, y: hit.y });
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
          <div ref={hoverLabelRef} className={styles.hoverLabel} style={{ left: hoverLabel.x, top: hoverLabel.y }} aria-hidden="true">
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
        <div className={styles.sceneControls} aria-hidden="true">
          <span>Live orbit</span><i /><span>Drag the camera</span><i /><span>Select a galaxy</span>
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
            {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : player.displayName.charAt(0).toUpperCase()}
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
