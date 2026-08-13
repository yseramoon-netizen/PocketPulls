"use client";

import {
  memo,
  type CSSProperties,
  type RefCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import NebuPerformanceSprite from "./NebuPerformanceSprite";
import styles from "./AncientCatPullScene.module.css";

type AncientCatPullSceneProps = {
  tier: number;
  escalationStartMs: number;
  stepDurationsMs: readonly number[];
  collapseAtMs: number;
  cardRevealAtMs: number;
  arrivalHoldMs?: number;
  blackHoleTravelMs?: number;
  reactionSheet?: string;
  reactionColumns?: number;
  reactionRows?: number;
  cosmic?: boolean;
  blackHole?: boolean;
  lowEffects?: boolean;
};

type Grade = {
  name: string;
  label: string;
  skyTop: string;
  skyBottom: string;
  accent: string;
  secondary: string;
  glow: string;
};

type RouteNode = {
  id: string;
  tier: number | null;
  x: number;
  y: number;
  z: number;
  blackHole?: boolean;
};

type CameraPoint = {
  x: number;
  y: number;
  z: number;
};

type RoutePhase = {
  kind: "travel" | "hold";
  from: RouteNode;
  to: RouteNode;
  startsAt: number;
  endsAt: number;
};

type BackgroundStar = {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  colour: 0 | 1 | 2;
};

type PrebuiltSpaceRouteProps = {
  active: boolean;
  finalTier: number;
  stepDurationsMs: readonly number[];
  arrivalHoldMs: number;
  blackHoleTravelMs: number;
  blackHole: boolean;
  finaleStarted: boolean;
  lowEffects: boolean;
  onArrive: (tier: number) => void;
  onBlackHoleReached: () => void;
  onTravelStateChange: (travelling: boolean) => void;
};

const DEFAULT_REACTION_SHEET = "/ancient-pulls/scene/nebu-heat-reactions-v1.webp";
const CAMERA_STAR_DISTANCE = 76;

const GRADES: readonly Grade[] = [
  { name: "Gentle dawn", label: "Common", skyTop: "#172746", skyBottom: "#ba7048", accent: "#fde68a", secondary: "#fb923c", glow: "rgba(253,230,138,.74)" },
  { name: "Verdant light", label: "Uncommon", skyTop: "#071d20", skyBottom: "#19543e", accent: "#86efac", secondary: "#22c55e", glow: "rgba(134,239,172,.78)" },
  { name: "Azure heat", label: "Rare", skyTop: "#07142d", skyBottom: "#183f72", accent: "#7dd3fc", secondary: "#2563eb", glow: "rgba(125,211,252,.82)" },
  { name: "Violet flare", label: "Double Rare", skyTop: "#190b34", skyBottom: "#54236d", accent: "#c4b5fd", secondary: "#7c3aed", glow: "rgba(196,181,253,.86)" },
  { name: "Golden blaze", label: "Ultra Rare", skyTop: "#281205", skyBottom: "#743612", accent: "#fbbf24", secondary: "#f97316", glow: "rgba(251,191,36,.88)" },
  { name: "Rosefire", label: "Illustration Rare", skyTop: "#2c0b25", skyBottom: "#7b255c", accent: "#f9a8d4", secondary: "#db2777", glow: "rgba(249,168,212,.9)" },
  { name: "Prismatic heat", label: "Special Illustration Rare", skyTop: "#071b2d", skyBottom: "#3b2774", accent: "#67e8f9", secondary: "#a855f7", glow: "rgba(103,232,249,.94)" },
  { name: "Molten sky", label: "Hyper Rare", skyTop: "#2a0806", skyBottom: "#842917", accent: "#fb923c", secondary: "#ef4444", glow: "rgba(251,146,60,.96)" },
  { name: "Crownfire", label: "Crown Rare", skyTop: "#211b08", skyBottom: "#70530e", accent: "#fff7c2", secondary: "#f5b83b", glow: "rgba(255,247,194,1)" },
] as const;

const ROUTE_NODES: readonly RouteNode[] = [
  { id: "common", tier: 1, x: 0, y: 0, z: 0 },
  { id: "uncommon", tier: 2, x: 24, y: -9, z: 132 },
  { id: "rare", tier: 3, x: -28, y: 14, z: 298 },
  { id: "double-rare", tier: 4, x: 18, y: -17, z: 492 },
  { id: "ultra-rare", tier: 5, x: -24, y: 9, z: 704 },
  { id: "illustration-rare", tier: 6, x: 29, y: -7, z: 926 },
  { id: "special-illustration-rare", tier: 7, x: -13, y: -19, z: 1158 },
  { id: "hyper-rare", tier: 8, x: 21, y: 13, z: 1402 },
  { id: "crown-rare", tier: 9, x: 0, y: -4, z: 1658 },
  { id: "event-horizon", tier: null, x: -8, y: 3, z: 1976, blackHole: true },
] as const;

const SOLAR_TONGUES = Array.from({ length: 14 }, (_, index) => index);
const SOLAR_SPARKS = Array.from({ length: 12 }, (_, index) => index);
const SUPERNOVA_FRAGMENTS = Array.from({ length: 18 }, (_, index) => index);
const STAR_COLOURS = ["#e6ebff", "#afd7ff", "#ffe2ac"] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clampTier(tier: number): number {
  return clamp(Math.round(tier), 1, GRADES.length);
}

function smootherStep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function cameraAtNode(node: RouteNode): CameraPoint {
  return { x: node.x, y: node.y, z: node.z - CAMERA_STAR_DISTANCE };
}

function gradeVariables(grade: Grade, tier: number): CSSProperties {
  const heat = (tier - 1) / (GRADES.length - 1);
  return {
    "--active-accent": grade.accent,
    "--active-secondary": grade.secondary,
    "--active-glow": grade.glow,
    "--grade-top": grade.skyTop,
    "--grade-bottom": grade.skyBottom,
    "--heat-level": String(heat),
  } as CSSProperties;
}

function buildBackgroundStars(): readonly BackgroundStar[] {
  let seed = 0x51f15e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  return Array.from({ length: 240 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const radius = 18 + Math.pow(random(), 0.62) * 128;
    return {
      x: Math.cos(angle) * radius + (random() - 0.5) * 18,
      y: Math.sin(angle) * radius * 0.68 + (random() - 0.5) * 12,
      z: -35 + (index / 239) * 2150 + random() * 34,
      size: 0.7 + random() * 1.65,
      alpha: 0.34 + random() * 0.66,
      colour: random() > 0.82 ? 2 : random() < 0.18 ? 1 : 0,
    };
  });
}

const BACKGROUND_STARS = buildBackgroundStars();

function buildRoutePhases(
  finalTier: number,
  stepDurationsMs: readonly number[],
  arrivalHoldMs: number,
  blackHole: boolean,
  blackHoleTravelMs: number,
): readonly RoutePhase[] {
  const phases: RoutePhase[] = [];
  let cursor = 0;

  for (let targetTier = 2; targetTier <= finalTier; targetTier += 1) {
    const from = ROUTE_NODES[targetTier - 2];
    const to = ROUTE_NODES[targetTier - 1];
    const duration = stepDurationsMs[targetTier - 1] ?? 4000;
    phases.push({ kind: "travel", from, to, startsAt: cursor, endsAt: cursor + duration });
    cursor += duration;
    phases.push({ kind: "hold", from: to, to, startsAt: cursor, endsAt: cursor + arrivalHoldMs });
    cursor += arrivalHoldMs;
  }

  if (blackHole) {
    const from = ROUTE_NODES[finalTier - 1];
    const to = ROUTE_NODES[ROUTE_NODES.length - 1];
    phases.push({ kind: "travel", from, to, startsAt: cursor, endsAt: cursor + blackHoleTravelMs });
    cursor += blackHoleTravelMs;
    phases.push({ kind: "hold", from: to, to, startsAt: cursor, endsAt: Number.POSITIVE_INFINITY });
  } else {
    const finalNode = ROUTE_NODES[finalTier - 1];
    phases.push({ kind: "hold", from: finalNode, to: finalNode, startsAt: cursor, endsAt: Number.POSITIVE_INFINITY });
  }

  return phases;
}

const BurningStar = memo(function BurningStar({ grade, tier, final = false }: { grade: Grade; tier: number; final?: boolean }) {
  const heat = (tier - 1) / (GRADES.length - 1);

  return (
    <div className={styles.burningStar} data-final={final ? "true" : "false"} style={gradeVariables(grade, tier)}>
      <span className={styles.sunHalo} />
      <span className={styles.chromosphere} />
      <span className={styles.plasmaTongues}>
        {SOLAR_TONGUES.map((index) => (
          <i key={index} style={{
            "--tongue-angle": `${index * (360 / SOLAR_TONGUES.length) + (index % 2) * 5}deg`,
            "--tongue-length": `${25 + (index % 5) * 7}px`,
            "--tongue-width": `${3.2 + (index % 3) * 1.25}px`,
            "--tongue-sway": `${index % 2 === 0 ? 6 : -6}deg`,
            "--tongue-delay": `${index * -113}ms`,
            "--tongue-duration": `${Math.round(1420 + (index % 4) * 125 - heat * 480)}ms`,
          } as CSSProperties} />
        ))}
      </span>
      <span className={styles.solarSparks}>
        {SOLAR_SPARKS.map((index) => (
          <i key={index} style={{
            "--spark-angle": `${index * 30 + (index % 3) * 8}deg`,
            "--spark-distance": `${48 + (index % 4) * 13}px`,
            "--spark-size": `${1.5 + (index % 3) * 0.75}px`,
            "--spark-delay": `${index * -149}ms`,
            "--spark-duration": `${Math.round(1500 + (index % 5) * 170 - heat * 420)}ms`,
          } as CSSProperties} />
        ))}
      </span>
      <span className={styles.sunCore}>
        <i className={styles.surfaceFire} />
        <i className={styles.surfaceFireSecondary} />
      </span>
      <span className={styles.supernovaCorona} />
      <span className={styles.supernovaRays} />
      <span className={styles.supernovaFragments}>
        {SUPERNOVA_FRAGMENTS.map((index) => (
          <i key={index} style={{
            "--fragment-angle": `${index * 20 + (index % 3) * 4}deg`,
            "--fragment-distance": `${82 + (index % 5) * 21}px`,
            "--fragment-size": `${2 + (index % 4) * 1.1}px`,
            "--fragment-delay": `${(index % 5) * 16}ms`,
          } as CSSProperties} />
        ))}
      </span>
    </div>
  );
});

function PrebuiltSpaceRoute({
  active,
  finalTier,
  stepDurationsMs,
  arrivalHoldMs,
  blackHoleTravelMs,
  blackHole,
  finaleStarted,
  lowEffects,
  onArrive,
  onBlackHoleReached,
  onTravelStateChange,
}: PrebuiltSpaceRouteProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starRefs = useRef(new Map<string, HTMLDivElement>());
  const animationFrameRef = useRef<number | null>(null);
  const routeStartedAtRef = useRef(0);
  const lastCameraRef = useRef<CameraPoint>(cameraAtNode(ROUTE_NODES[0]));
  const lastFrameAtRef = useRef(0);
  const announcedNodeRef = useRef<string>("common");
  const travellingRef = useRef(false);
  const phaseIndexRef = useRef(0);
  const nodeVisibilityRef = useRef(new Map<string, boolean>());
  const detailedSignatureRef = useRef("");
  const [detailedStarIds, setDetailedStarIds] = useState<readonly string[]>([]);

  const phases = useMemo(
    () => buildRoutePhases(finalTier, stepDurationsMs, arrivalHoldMs, blackHole, blackHoleTravelMs),
    [arrivalHoldMs, blackHole, blackHoleTravelMs, finalTier, stepDurationsMs],
  );

  const registerStar = useCallback(
    (id: string): RefCallback<HTMLDivElement> => (element) => {
      if (element) starRefs.current.set(id, element);
      else starRefs.current.delete(id);
    },
    [],
  );

  useEffect(() => {
    if (!active) {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      routeStartedAtRef.current = 0;
      announcedNodeRef.current = "common";
      travellingRef.current = false;
      phaseIndexRef.current = 0;
      nodeVisibilityRef.current.clear();
      if (detailedSignatureRef.current) {
        detailedSignatureRef.current = "";
        setDetailedStarIds([]);
      }
      onTravelStateChange(false);
      return;
    }

    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) return;

    routeStartedAtRef.current = performance.now();
    lastFrameAtRef.current = routeStartedAtRef.current;
    lastCameraRef.current = cameraAtNode(ROUTE_NODES[0]);
    phaseIndexRef.current = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let qualityLevel = lowEffects ? 0 : 2;
    let frameTimeTotal = 0;
    let frameTimeSamples = 0;
    const projectedStars = new Float32Array(BACKGROUND_STARS.length * 5);

    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const mobile = width <= 720;
      if (mobile && qualityLevel > 1) qualityLevel = 1;
      const pixelRatioCaps = [1, 1.15, 1.35] as const;
      pixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCaps[qualityLevel]);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const render = (now: number) => {
      const elapsed = now - routeStartedAtRef.current;
      while (
        phaseIndexRef.current < phases.length - 1 &&
        elapsed >= phases[phaseIndexRef.current].endsAt
      ) {
        phaseIndexRef.current += 1;
      }
      const phase = phases[phaseIndexRef.current] ?? phases[phases.length - 1];
      const isTravelling = phase.kind === "travel";

      if (isTravelling !== travellingRef.current) {
        travellingRef.current = isTravelling;
        onTravelStateChange(isTravelling);
      }

      let camera: CameraPoint;
      if (phase.kind === "travel") {
        const duration = Math.max(1, phase.endsAt - phase.startsAt);
        const rawProgress = clamp((elapsed - phase.startsAt) / duration, 0, 1);
        const pullBackFraction = Math.min(0.16, 320 / duration);
        const start = cameraAtNode(phase.from);
        const finish = cameraAtNode(phase.to);

        if (rawProgress < pullBackFraction) {
          const progress = smootherStep(rawProgress / pullBackFraction);
          camera = {
            x: mix(start.x, start.x - (phase.to.x - start.x) * 0.025, progress),
            y: mix(start.y, start.y - (phase.to.y - start.y) * 0.025, progress),
            z: mix(start.z, start.z - 10, progress),
          };
        } else {
          const progress = smootherStep((rawProgress - pullBackFraction) / (1 - pullBackFraction));
          camera = {
            x: mix(start.x - (phase.to.x - start.x) * 0.025, finish.x, progress),
            y: mix(start.y - (phase.to.y - start.y) * 0.025, finish.y, progress),
            z: mix(start.z - 10, finish.z, progress),
          };
        }
      } else {
        const at = cameraAtNode(phase.to);
        const holdElapsed = Math.max(0, elapsed - phase.startsAt);
        const settle = smootherStep(Math.min(1, holdElapsed / 620));
        const drift = Math.sin(holdElapsed / 1250) * 0.9 * settle;
        camera = {
          x: at.x + drift,
          y: at.y + Math.cos(holdElapsed / 1480) * 0.42 * settle,
          z: at.z - Math.sin(holdElapsed / 1750) * 0.7 * settle,
        };

        if (announcedNodeRef.current !== phase.to.id) {
          announcedNodeRef.current = phase.to.id;
          if (phase.to.blackHole) onBlackHoleReached();
          else if (phase.to.tier) onArrive(phase.to.tier);
        }
      }

      const deltaSeconds = clamp((now - lastFrameAtRef.current) / 1000, 1 / 240, 0.08);
      const lastCamera = lastCameraRef.current;
      const cameraSpeed = Math.hypot(camera.x - lastCamera.x, camera.y - lastCamera.y, camera.z - lastCamera.z) / deltaSeconds;
      const motionStrength = isTravelling ? clamp(cameraSpeed / 72, 0.08, 1) : 0;
      const focalLength = Math.min(width, height) * 0.86;

      context.clearRect(0, 0, width, height);
      const starCountByQuality = [72, 124, 184] as const;
      const backgroundCount = starCountByQuality[qualityLevel];
      let projectedCount = 0;

      for (let index = 0; index < backgroundCount; index += 1) {
        const star = BACKGROUND_STARS[index];
        const depth = star.z - camera.z;
        if (depth <= 1.5 || depth > 680) continue;

        const projectedX = width / 2 + ((star.x - camera.x) * focalLength) / depth;
        const projectedY = height / 2 + ((star.y - camera.y) * focalLength) / depth;
        if (projectedX < -80 || projectedX > width + 80 || projectedY < -80 || projectedY > height + 80) continue;

        const depthScale = clamp(120 / depth, 0.18, 3.4);
        const radius = clamp(star.size * depthScale, 0.45, 3.2);
        const alpha = star.alpha * clamp(230 / depth, 0.22, 1);
        const offset = projectedCount * 5;
        projectedStars[offset] = projectedX;
        projectedStars[offset + 1] = projectedY;
        projectedStars[offset + 2] = radius;
        projectedStars[offset + 3] = alpha;
        projectedStars[offset + 4] = star.colour;
        projectedCount += 1;
      }

      if (motionStrength > 0.08) {
        context.lineWidth = qualityLevel === 0 ? 0.7 : 1;
        context.globalAlpha = 0.5 * motionStrength;
        for (let colour = 0; colour < STAR_COLOURS.length; colour += 1) {
          context.beginPath();
          for (let index = 0; index < projectedCount; index += 1) {
            const offset = index * 5;
            if (projectedStars[offset + 4] !== colour) continue;
            const projectedX = projectedStars[offset];
            const projectedY = projectedStars[offset + 1];
            const radialX = projectedX - width / 2;
            const radialY = projectedY - height / 2;
            const inverseLength = 1 / Math.max(1, Math.hypot(radialX, radialY));
            const trailLength = clamp(motionStrength * projectedStars[offset + 2] * 13, 1.4, 36);
            context.moveTo(projectedX, projectedY);
            context.lineTo(
              projectedX - radialX * inverseLength * trailLength,
              projectedY - radialY * inverseLength * trailLength,
            );
          }
          context.strokeStyle = STAR_COLOURS[colour];
          context.stroke();
        }
      }

      context.shadowBlur = 0;
      for (let colour = 0; colour < STAR_COLOURS.length; colour += 1) {
        context.fillStyle = STAR_COLOURS[colour];
        for (let index = 0; index < projectedCount; index += 1) {
          const offset = index * 5;
          if (projectedStars[offset + 4] !== colour) continue;
          const radius = projectedStars[offset + 2];
          const diameter = radius * 2;
          context.globalAlpha = projectedStars[offset + 3];
          context.fillRect(
            projectedStars[offset] - radius,
            projectedStars[offset + 1] - radius,
            diameter,
            diameter,
          );
          if (radius > 1.5 && qualityLevel > 0) {
            context.globalAlpha = projectedStars[offset + 3] * 0.16;
            context.fillRect(
              projectedStars[offset] - radius * 2.2,
              projectedStars[offset + 1] - radius * 2.2,
              diameter * 2.2,
              diameter * 2.2,
            );
          }
        }
      }
      context.globalAlpha = 1;
      const visibleDistance = 188;
      const detailedIds: string[] = [];

      for (const node of ROUTE_NODES.slice(1)) {
        const element = starRefs.current.get(node.id);
        if (!element) continue;
        const depth = node.z - camera.z;

        if (depth <= 3 || depth >= visibleDistance) {
          if (nodeVisibilityRef.current.get(node.id) !== false) {
            element.style.opacity = "0";
            element.style.visibility = "hidden";
            nodeVisibilityRef.current.set(node.id, false);
          }
          continue;
        }

        const projectedX = width / 2 + ((node.x - camera.x) * focalLength) / depth;
        const projectedY = height / 2 + ((node.y - camera.y) * focalLength) / depth;
        const scale = clamp(CAMERA_STAR_DISTANCE / depth, 0.012, 12);
        const appearance = smootherStep((visibleDistance - depth) / 78);
        const insideFrame = projectedX > -width * 0.75 && projectedX < width * 1.75 && projectedY > -height * 0.75 && projectedY < height * 1.75;
        const visible = insideFrame && appearance > 0.025;

        if (!visible) {
          if (nodeVisibilityRef.current.get(node.id) !== false) {
            element.style.opacity = "0";
            element.style.visibility = "hidden";
            nodeVisibilityRef.current.set(node.id, false);
          }
          continue;
        }

        element.style.visibility = "visible";
        element.style.opacity = String(appearance);
        element.style.transform = `translate3d(${projectedX}px, ${projectedY}px, 0) translate(-50%, -50%) scale(${scale})`;
        if (nodeVisibilityRef.current.get(node.id) !== true) {
          nodeVisibilityRef.current.set(node.id, true);
        }
        if (!node.blackHole) detailedIds.push(node.id);
      }

      const detailedSignature = detailedIds.join("|");
      if (detailedSignature !== detailedSignatureRef.current) {
        detailedSignatureRef.current = detailedSignature;
        setDetailedStarIds(detailedIds);
      }

      if (isTravelling) {
        frameTimeTotal += now - lastFrameAtRef.current;
        frameTimeSamples += 1;
        if (frameTimeSamples >= 45) {
          const averageFrameTime = frameTimeTotal / frameTimeSamples;
          if (averageFrameTime > 20.5 && qualityLevel > 0) {
            qualityLevel -= 1;
            resize();
          }
          frameTimeTotal = 0;
          frameTimeSamples = 0;
        }
      }

      lastCameraRef.current = camera;
      lastFrameAtRef.current = now;
      animationFrameRef.current = window.requestAnimationFrame(render);
    };

    animationFrameRef.current = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [active, lowEffects, onArrive, onBlackHoleReached, onTravelStateChange, phases]);

  return (
    <div ref={stageRef} className={styles.routeStage} data-active={active ? "true" : "false"} aria-hidden="true">
      <div className={styles.routeNebula} />
      <canvas ref={canvasRef} className={styles.routeCanvas} />

      {ROUTE_NODES.slice(1, 9).map((node) => {
        const nodeTier = node.tier ?? 9;
        const grade = GRADES[nodeTier - 1];
        const detailed = detailedStarIds.includes(node.id);
        return (
          <div key={node.id} ref={registerStar(node.id)} className={styles.routeStar} data-visible={detailed ? "true" : "false"} style={gradeVariables(grade, nodeTier)}>
            {detailed ? (
              <BurningStar grade={grade} tier={nodeTier} final={!blackHole && finaleStarted && nodeTier === finalTier} />
            ) : (
              <span className={styles.dormantDestination} />
            )}
          </div>
        );
      })}

      <div ref={registerStar("event-horizon")} className={styles.routeBlackHole} data-visible="false">
        <span className={styles.blackHoleDisc} />
        <span className={styles.blackHoleAccretion} />
        <span className={styles.blackHoleLens} />
        <div className={styles.goldenGlimmer} data-visible={blackHole && finaleStarted ? "true" : "false"}><span /></div>
      </div>

      <div className={styles.routeVignette} />
    </div>
  );
}

export default function AncientCatPullScene({
  tier,
  escalationStartMs,
  stepDurationsMs,
  collapseAtMs,
  cardRevealAtMs,
  arrivalHoldMs = 850,
  blackHoleTravelMs = 5000,
  reactionSheet = DEFAULT_REACTION_SHEET,
  reactionColumns = 4,
  reactionRows = 4,
  cosmic = false,
  blackHole = false,
  lowEffects = false,
}: AncientCatPullSceneProps) {
  const finalTier = clampTier(tier);
  const [activeTier, setActiveTier] = useState(1);
  const [introComplete, setIntroComplete] = useState(false);
  const [spaceMode, setSpaceMode] = useState(false);
  const [travelling, setTravelling] = useState(false);
  const [blackHoleReached, setBlackHoleReached] = useState(false);
  const [finaleStarted, setFinaleStarted] = useState(false);

  useEffect(() => {
    const introTimer = window.setTimeout(() => {
      setIntroComplete(true);
      if (finalTier > 1 || blackHole) setSpaceMode(true);
    }, escalationStartMs);
    const finaleTimer = window.setTimeout(() => setFinaleStarted(true), collapseAtMs);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(finaleTimer);
    };
  }, [blackHole, collapseAtMs, escalationStartMs, finalTier]);

  const activeGrade = GRADES[activeTier - 1];
  const introDurationMs = Math.max(900, escalationStartMs - 260);
  const worldFinal = finalTier === 1 && !blackHole && finaleStarted;
  const sceneStyle = useMemo(() => ({
    ...gradeVariables(activeGrade, activeTier),
    "--intro-duration": `${introDurationMs}ms`,
    "--collapse-duration": `${Math.max(720, cardRevealAtMs - collapseAtMs)}ms`,
    "--scene-clear-at": `${cardRevealAtMs}ms`,
  } as CSSProperties), [activeGrade, activeTier, cardRevealAtMs, collapseAtMs, introDurationMs]);

  const handleArrive = useCallback((arrivedTier: number) => {
    setActiveTier(arrivedTier);
    setBlackHoleReached(false);
  }, []);
  const handleBlackHoleReached = useCallback(() => setBlackHoleReached(true), []);
  const handleTravelStateChange = useCallback((nextTravelling: boolean) => setTravelling(nextTravelling), []);

  const showCaption =
    introComplete &&
    !travelling &&
    !blackHoleReached &&
    !finaleStarted &&
    (finalTier === 1 || spaceMode);

  return (
    <div className={styles.scene} data-tier={activeTier} data-space-mode={spaceMode ? "true" : "false"} data-black-hole={blackHole ? "true" : "false"} data-low-effects={lowEffects ? "true" : "false"} data-cosmic={cosmic ? "true" : "false"} style={sceneStyle} aria-hidden="true">
      <div className={styles.world} data-gone={spaceMode ? "true" : "false"}>
        <div className={styles.worldSky} />
        <div className={styles.worldStars} />
        <div className={styles.worldSun}>
          <BurningStar grade={GRADES[0]} tier={1} final={worldFinal} />
        </div>
        <img src="/ancient-pulls/scene/distant-mountains-village-v1.webp" alt="" draggable={false} className={styles.horizon} />
        <div className={styles.sandGround} />
        <div className={styles.pyramidWrap}>
          <img src="/ancient-pulls/scene/pyramid-right-v1.webp" alt="" draggable={false} className={styles.pyramid} />
        </div>
        <div className={styles.watchingNebu}>
          <NebuPerformanceSprite sheet={reactionSheet} durationMs={1000} staticFrame={cosmic ? 0 : 1} columns={reactionColumns} rows={reactionRows} className={styles.reactionSprite} />
        </div>
      </div>

      <PrebuiltSpaceRoute
        active={spaceMode}
        finalTier={finalTier}
        stepDurationsMs={stepDurationsMs}
        arrivalHoldMs={arrivalHoldMs}
        blackHoleTravelMs={blackHoleTravelMs}
        blackHole={blackHole}
        finaleStarted={finaleStarted}
        lowEffects={lowEffects}
        onArrive={handleArrive}
        onBlackHoleReached={handleBlackHoleReached}
        onTravelStateChange={handleTravelStateChange}
      />

      {showCaption ? (
        <div key={`caption-${activeTier}`} className={styles.rarityCaption}><span>{activeGrade.name}</span><strong>{activeGrade.label}</strong></div>
      ) : null}
      {finaleStarted && !blackHole ? <div className={styles.supernovaSkyBloom} /> : null}
    </div>
  );
}
