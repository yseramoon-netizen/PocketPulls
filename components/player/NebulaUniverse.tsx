"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getNebulaRank,
  getRelativeNebulaScale,
  PRIME_NEBULA_NAME,
} from "@/lib/player/nebula-ranks";

import styles from "./NebulaUniverse.module.css";

export type NebulaUniversePlayer = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  score: number;
  isCurrentUser: boolean;
  cosmicIssueNumber: number | null;
};

type NebulaUniverseProps = {
  players: readonly NebulaUniversePlayer[];
  reducedMotion?: boolean;
  onOpenConstellation: (player: NebulaUniversePlayer) => void;
};

type GalaxyPosition = {
  player: NebulaUniversePlayer;
  x: number;
  y: number;
  radius: number;
  depth: number;
  blackHole: boolean;
};

type BackgroundStar = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  phase: number;
};

type OrbitSlot = {
  ring: number;
  item: number;
  count: number;
  ringCount: number;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function buildBackgroundStars(seed: string, count: number): BackgroundStar[] {
  const base = hashString(seed);
  return Array.from({ length: count }, (_, index) => ({
    x: seededUnit(base + index * 17),
    y: seededUnit(base + index * 41 + 7),
    size: 0.45 + seededUnit(base + index * 67 + 13) * 1.35,
    alpha: 0.18 + seededUnit(base + index * 83 + 29) * 0.58,
    phase: seededUnit(base + index * 101 + 47) * Math.PI * 2,
  }));
}

function orbitCapacity(ring: number): number {
  return 6 + ring * 4;
}

function orbitRingCount(total: number): number {
  let capacity = 0;
  let rings = 0;
  while (capacity < total) {
    capacity += orbitCapacity(rings);
    rings += 1;
  }
  return Math.max(1, rings);
}

function getOrbitSlot(index: number, total: number): OrbitSlot {
  const ringCount = orbitRingCount(total);
  let start = 0;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const capacity = orbitCapacity(ring);
    const count = Math.min(capacity, Math.max(0, total - start));
    if (index < start + count) {
      return { ring, item: index - start, count, ringCount };
    }
    start += count;
  }

  return { ring: 0, item: 0, count: 1, ringCount: 1 };
}

function orbitFactor(ring: number, ringCount: number): number {
  if (ringCount <= 1) return 0.48;
  return 0.3 + ring / (ringCount - 1) * 0.64;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(
    value.length === 3
      ? value.split("").map((character) => character + character).join("")
      : value,
    16,
  );
  return [parsed >> 16 & 255, parsed >> 8 & 255, parsed & 255];
}

function rgba(hex: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  stars: readonly BackgroundStar[],
  reducedMotion: boolean,
) {
  const sky = context.createRadialGradient(
    width * 0.5,
    height * 0.46,
    0,
    width * 0.5,
    height * 0.46,
    Math.max(width, height) * 0.72,
  );
  sky.addColorStop(0, "#111035");
  sky.addColorStop(0.43, "#08091f");
  sky.addColorStop(1, "#02030d");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  for (const star of stars) {
    const pulse = reducedMotion
      ? 1
      : 0.72 + Math.sin(time * 0.00075 + star.phase) * 0.28;
    context.globalAlpha = star.alpha * pulse;
    context.fillStyle = "#f8fafc";
    context.beginPath();
    context.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawOrbitPaths(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  orbitCount: number,
) {
  const centreX = width * 0.5;
  const centreY = height * 0.48;
  const maxRadiusX = width * 0.43;
  const maxRadiusY = height * 0.4;
  const rings = orbitRingCount(orbitCount);

  for (let ring = 0; ring < rings; ring += 1) {
    const factor = orbitFactor(ring, rings);
    context.beginPath();
    context.ellipse(
      centreX,
      centreY,
      maxRadiusX * factor,
      maxRadiusY * factor,
      ring % 2 === 0 ? -0.08 : 0.12,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = ring === 0
      ? "rgba(165, 243, 252, 0.09)"
      : "rgba(196, 181, 253, 0.055)";
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawBlackHole(
  context: CanvasRenderingContext2D,
  position: GalaxyPosition,
  time: number,
  highlighted: boolean,
  reducedMotion: boolean,
) {
  const spin = reducedMotion ? -0.12 : time * 0.00008;
  const radius = position.radius;

  context.save();
  context.translate(position.x, position.y);
  context.rotate(spin);
  context.scale(1, 0.35);

  const disk = context.createRadialGradient(0, 0, radius * 0.22, 0, 0, radius * 1.72);
  disk.addColorStop(0, "rgba(255,255,255,0)");
  disk.addColorStop(0.2, "rgba(255,247,194,0.92)");
  disk.addColorStop(0.42, "rgba(251,146,60,0.7)");
  disk.addColorStop(0.68, "rgba(168,85,247,0.42)");
  disk.addColorStop(1, "rgba(34,211,238,0)");
  context.fillStyle = disk;
  context.beginPath();
  context.arc(0, 0, radius * 1.78, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,247,194,0.72)";
  context.lineWidth = Math.max(1, radius * 0.06);
  context.beginPath();
  context.arc(0, 0, radius * 1.18, 0.18, Math.PI * 1.34);
  context.stroke();
  context.restore();

  const lens = context.createRadialGradient(
    position.x,
    position.y,
    radius * 0.35,
    position.x,
    position.y,
    radius * 1.55,
  );
  lens.addColorStop(0, "#000");
  lens.addColorStop(0.55, "#000");
  lens.addColorStop(0.69, "rgba(255,255,255,0.2)");
  lens.addColorStop(0.78, "rgba(103,232,249,0.12)");
  lens.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = lens;
  context.beginPath();
  context.arc(position.x, position.y, radius * 1.55, 0, Math.PI * 2);
  context.fill();

  if (highlighted) {
    context.strokeStyle = "rgba(255,247,194,0.82)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(position.x, position.y, radius * 1.8, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawGalaxy(
  context: CanvasRenderingContext2D,
  position: GalaxyPosition,
  time: number,
  highlighted: boolean,
  reducedMotion: boolean,
) {
  const formation = getNebulaRank(position.player.score);
  const radius = position.radius;
  const rotation = reducedMotion
    ? hashString(position.player.userId) % 360 / 57.3
    : time * (0.00004 + position.player.rank * 0.0000007) +
      hashString(position.player.userId) % 360 / 57.3;

  context.save();
  context.translate(position.x, position.y);
  context.rotate(rotation);
  context.scale(1, 0.6 + position.depth * 0.2);

  const cloud = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.25);
  cloud.addColorStop(0, rgba(formation.core, 0.98));
  cloud.addColorStop(0.15, rgba(formation.primary, 0.88));
  cloud.addColorStop(0.48, rgba(formation.secondary, 0.46));
  cloud.addColorStop(1, rgba(formation.primary, 0));
  context.fillStyle = cloud;
  context.beginPath();
  context.arc(0, 0, radius * 1.25, 0, Math.PI * 2);
  context.fill();

  for (let arm = 0; arm < 3; arm += 1) {
    context.beginPath();
    for (let step = 0; step <= 17; step += 1) {
      const progress = step / 17;
      const angle = arm * Math.PI * 2 / 3 + progress * Math.PI * 1.65;
      const distance = radius * (0.12 + progress * 0.94);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = arm % 2 === 0
      ? rgba(formation.primary, highlighted ? 0.8 : 0.5)
      : rgba(formation.secondary, highlighted ? 0.72 : 0.42);
    context.lineWidth = highlighted ? 2 : 1.15;
    context.lineCap = "round";
    context.stroke();
  }
  context.restore();

  context.fillStyle = formation.core;
  context.shadowColor = formation.primary;
  context.shadowBlur = highlighted ? 15 : 8;
  context.beginPath();
  context.arc(position.x, position.y, Math.max(1.6, radius * 0.13), 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  if (position.player.isCurrentUser || highlighted) {
    context.strokeStyle = position.player.isCurrentUser
      ? rgba(formation.primary, 0.9)
      : rgba(formation.core, 0.62);
    context.lineWidth = position.player.isCurrentUser ? 1.8 : 1;
    context.beginPath();
    context.arc(position.x, position.y, radius * 1.45, 0, Math.PI * 2);
    context.stroke();
  }

  if (position.player.cosmicIssueNumber) {
    context.fillStyle = "#a5f3fc";
    context.shadowColor = "#67e8f9";
    context.shadowBlur = 8;
    context.fillRect(position.x + radius * 0.8, position.y - radius * 0.9, 2, 2);
    context.shadowBlur = 0;
  }
}

function drawLabel(
  context: CanvasRenderingContext2D,
  position: GalaxyPosition,
  highlighted: boolean,
) {
  const name = position.blackHole
    ? `${PRIME_NEBULA_NAME} · ${position.player.displayName}`
    : position.player.displayName;
  const fontSize = position.blackHole ? 11 : 10;
  context.font = `800 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = highlighted
    ? "rgba(255,255,255,0.96)"
    : "rgba(255,255,255,0.58)";
  context.fillText(name, position.x, position.y + position.radius * 1.75);
}

export default function NebulaUniverse({
  players,
  reducedMotion = false,
  onOpenConstellation,
}: NebulaUniverseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const positionsRef = useRef<GalaxyPosition[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(
    players.find((player) => player.isCurrentUser)?.userId ?? players[0]?.userId ?? null,
  );
  const highlightedIdRef = useRef<string | null>(highlightedId);

  const backgroundStars = useMemo(
    () => buildBackgroundStars(players.map((player) => player.userId).join(":"), 150),
    [players],
  );

  const highlightedPlayer = players.find((player) => player.userId === highlightedId) ?? null;

  useEffect(() => {
    highlightedIdRef.current = highlightedId;
  }, [highlightedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || players.length === 0) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let frame = 0;
    let width = 1;
    let height = 1;
    let visible = !document.hidden;
    let lastPaint = 0;
    const dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (time: number) => {
      const frameInterval = width < 700 ? 40 : 32;
      if (!reducedMotion && time - lastPaint < frameInterval) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      lastPaint = time;

      drawBackground(context, width, height, time, backgroundStars, reducedMotion);
      drawOrbitPaths(context, width, height, Math.max(0, players.length - 1));

      const centreX = width * 0.5;
      const centreY = height * 0.48;
      const compact = width < 700;
      const largestMass = Math.max(1, players[0]?.score ?? 1);
      const positions: GalaxyPosition[] = [];

      const prime = players[0];
      positions.push({
        player: prime,
        x: centreX,
        y: centreY,
        radius: compact ? 27 : 39,
        depth: 1,
        blackHole: true,
      });

      const orbiters = players.slice(1);
      orbiters.forEach((player, index) => {
        const slot = getOrbitSlot(index, orbiters.length);
        const ring = slot.ring;
        const hash = hashString(player.userId);
        const baseAngle =
          slot.item / slot.count * Math.PI * 2 +
          seededUnit(hash) * 0.2 +
          ring * 0.31;
        const direction = hash % 2 === 0 ? 1 : -1;
        const speed = reducedMotion ? 0 : direction * (0.0000068 / (1 + ring * 0.34));
        const angle = baseAngle + time * speed;
        const ringFactor = orbitFactor(ring, slot.ringCount);
        const radiusX = width * 0.43 * ringFactor;
        const radiusY = height * 0.4 * ringFactor;
        const depth = 0.5 + Math.sin(angle) * 0.5;
        const relativeScale = getRelativeNebulaScale(player.score, largestMass);
        const baseRadius = compact ? 6.5 : 8;
        const massRadius = (compact ? 9 : 15) * relativeScale;

        positions.push({
          player,
          x: centreX + Math.cos(angle) * radiusX,
          y: centreY + Math.sin(angle) * radiusY,
          radius: baseRadius + massRadius * (0.76 + depth * 0.24),
          depth,
          blackHole: false,
        });
      });

      const primePosition = positions[0];
      const orbitingPositions = positions.slice(1).sort((first, second) => first.depth - second.depth);

      for (const position of orbitingPositions) {
        drawGalaxy(
          context,
          position,
          time,
          position.player.userId === highlightedIdRef.current,
          reducedMotion,
        );
      }

      drawBlackHole(
        context,
        primePosition,
        time,
        primePosition.player.userId === highlightedIdRef.current,
        reducedMotion,
      );

      const labelled = new Set(
        positions
          .filter((position) =>
            position.blackHole ||
            position.player.rank <= 3 ||
            position.player.isCurrentUser ||
            position.player.userId === highlightedIdRef.current,
          )
          .map((position) => position.player.userId),
      );
      for (const position of positions) {
        if (labelled.has(position.player.userId)) {
          drawLabel(context, position, position.player.userId === highlightedIdRef.current);
        }
      }

      positionsRef.current = positions;
      if (!reducedMotion && visible) frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) render(0);
    });
    observer.observe(canvas);
    resize();
    frame = window.requestAnimationFrame(render);

    const handleVisibility = () => {
      visible = !document.hidden;
      if (visible && !reducedMotion) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      visible = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [backgroundStars, players, reducedMotion]);

  const findPlayerAtPointer = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let closest: GalaxyPosition | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const position of positionsRef.current) {
      const distance = Math.hypot(x - position.x, y - position.y);
      const hitRadius = Math.max(18, position.radius * (position.blackHole ? 1.8 : 1.45));
      if (distance <= hitRadius && distance < closestDistance) {
        closest = position;
        closestDistance = distance;
      }
    }
    return closest?.player ?? null;
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const player = findPlayerAtPointer(event);
      const nextId = player?.userId ?? null;
      setHighlightedId((current) => current === nextId ? current : nextId);
      event.currentTarget.style.cursor = player ? "pointer" : "grab";
    },
    [findPlayerAtPointer],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (players.length === 0) return;
      const currentIndex = Math.max(
        0,
        players.findIndex((player) => player.userId === highlightedId),
      );

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedId(players[(currentIndex + 1) % players.length].userId);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedId(players[(currentIndex - 1 + players.length) % players.length].userId);
      } else if ((event.key === "Enter" || event.key === " ") && highlightedPlayer) {
        event.preventDefault();
        onOpenConstellation(highlightedPlayer);
      }
    },
    [highlightedId, highlightedPlayer, onOpenConstellation, players],
  );

  return (
    <section className={styles.universe} aria-labelledby="nebula-universe-title">
      <div className={styles.universeHeader}>
        <div>
          <p>Live cosmic map</p>
          <h2 id="nebula-universe-title">The Ancient Pulls Universe</h2>
        </div>
        <span>Choose a galaxy to enter its constellation</span>
      </div>

      <div className={styles.canvasShell}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={0}
          role="application"
          aria-label="Interactive universe of ranked player galaxies. Use arrow keys to select a galaxy and Enter to open its constellation."
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHighlightedId(null)}
          onFocus={() => {
            setHighlightedId((current) =>
              current ??
              players.find((player) => player.isCurrentUser)?.userId ??
              players[0]?.userId ??
              null,
            );
          }}
          onClick={(event) => {
            const player = findPlayerAtPointer(event);
            if (player) onOpenConstellation(player);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.mapLegend} aria-hidden="true">
          <span><i className={styles.blackHoleKey} /> Prime Nebula</span>
          <span><i className={styles.galaxyKey} /> Player galaxy</span>
          <span><i className={styles.currentKey} /> Your orbit</span>
        </div>

        {highlightedPlayer ? (
          <button
            type="button"
            className={styles.focusCard}
            onClick={() => onOpenConstellation(highlightedPlayer)}
          >
            <span>
              Orbit #{highlightedPlayer.rank} · {highlightedPlayer.rank === 1
                ? PRIME_NEBULA_NAME
                : getNebulaRank(highlightedPlayer.score).name}
            </span>
            <strong>{highlightedPlayer.displayName}</strong>
            <small>{highlightedPlayer.score.toLocaleString("en-GB")} stellar mass · Open constellation →</small>
          </button>
        ) : (
          <p className={styles.mapHint}>Move across the universe to find a trainer</p>
        )}
      </div>
    </section>
  );
}
