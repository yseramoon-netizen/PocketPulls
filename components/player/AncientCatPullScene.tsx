"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

import NebuPerformanceSprite from "./NebuPerformanceSprite";
import styles from "./AncientCatPullScene.module.css";

type AncientCatPullSceneProps = {
  tier: number;
  escalationStartMs: number;
  stepDurationsMs: readonly number[];
  cardRevealAtMs: number;
  walkSheet?: string;
  reactionSheet?: string;
  walkColumns?: number;
  walkRows?: number;
  reactionColumns?: number;
  reactionRows?: number;
  cosmic?: boolean;
  blackHole?: boolean;
  lowEffects?: boolean;
};

type Grade = {
  name: string;
  skyTop: string;
  skyBottom: string;
  accent: string;
  glow: string;
};

const DEFAULT_WALK_SHEET = "/ancient-pulls/scene/nebu-pyramid-exit-v1.webp";
const DEFAULT_REACTION_SHEET = "/ancient-pulls/scene/nebu-heat-reactions-v1.webp";

const GRADES: readonly Grade[] = [
  {
    name: "Gentle dawn",
    skyTop: "#172746",
    skyBottom: "#ba7048",
    accent: "#fde68a",
    glow: "rgba(253, 230, 138, 0.72)",
  },
  {
    name: "Verdant light",
    skyTop: "#183d54",
    skyBottom: "#b87f55",
    accent: "#86efac",
    glow: "rgba(134, 239, 172, 0.74)",
  },
  {
    name: "Azure heat",
    skyTop: "#21376c",
    skyBottom: "#be6c5a",
    accent: "#7dd3fc",
    glow: "rgba(125, 211, 252, 0.78)",
  },
  {
    name: "Violet flare",
    skyTop: "#47295f",
    skyBottom: "#c26255",
    accent: "#c4b5fd",
    glow: "rgba(196, 181, 253, 0.82)",
  },
  {
    name: "Golden blaze",
    skyTop: "#6b301f",
    skyBottom: "#dd7144",
    accent: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.84)",
  },
  {
    name: "Rosefire",
    skyTop: "#65264f",
    skyBottom: "#ed725b",
    accent: "#f9a8d4",
    glow: "rgba(249, 168, 212, 0.86)",
  },
  {
    name: "Prismatic heat",
    skyTop: "#44215e",
    skyBottom: "#d95f74",
    accent: "#67e8f9",
    glow: "rgba(103, 232, 249, 0.9)",
  },
  {
    name: "Molten sky",
    skyTop: "#641c1c",
    skyBottom: "#f05c2f",
    accent: "#fb923c",
    glow: "rgba(251, 146, 60, 0.94)",
  },
  {
    name: "Crownfire",
    skyTop: "#8c2818",
    skyBottom: "#ff9a42",
    accent: "#fff7c2",
    glow: "rgba(255, 247, 194, 0.98)",
  },
] as const;

const REACTION_FRAMES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 10],
  [11, 11],
  [12, 12],
  [13, 13],
] as const;

const TIER_LABELS = [
  "Common",
  "Uncommon",
  "Rare",
  "Double Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare",
  "Crown Rare",
] as const;

const EMBERS = Array.from({ length: 18 }, (_, index) => index);

function clampTier(tier: number): number {
  return Math.max(1, Math.min(GRADES.length, Math.round(tier)));
}

export default function AncientCatPullScene({
  tier,
  escalationStartMs,
  stepDurationsMs,
  cardRevealAtMs,
  walkSheet = DEFAULT_WALK_SHEET,
  reactionSheet = DEFAULT_REACTION_SHEET,
  walkColumns = 4,
  walkRows = 4,
  reactionColumns = 4,
  reactionRows = 4,
  cosmic = false,
  blackHole = false,
  lowEffects = false,
}: AncientCatPullSceneProps) {
  const finalTier = clampTier(tier);
  const [activeTier, setActiveTier] = useState(1);
  const [finalTierReached, setFinalTierReached] = useState(false);
  const [reactionBeat, setReactionBeat] = useState(0);
  const [reactionsStarted, setReactionsStarted] = useState(false);

  useEffect(() => {
    const timers: number[] = [];

    setActiveTier(1);
    setFinalTierReached(false);
    setReactionBeat(0);
    setReactionsStarted(false);

    timers.push(
      window.setTimeout(() => {
        setReactionsStarted(true);
        setActiveTier(blackHole ? finalTier : 1);
        if (blackHole) setFinalTierReached(true);
      }, escalationStartMs),
    );

    if (!blackHole) {
      for (let nextTier = 1; nextTier <= finalTier; nextTier += 1) {
        const stepStartsAt = escalationStartMs + stepDurationsMs
          .slice(0, nextTier - 1)
          .reduce((total, duration) => total + duration, 0);
        const phaseDuration =
          stepDurationsMs[nextTier - 1] ?? 4000;
        const reactionBeatAt = Math.min(
          900,
          Math.max(520, Math.round(phaseDuration * 0.42)),
        );

        timers.push(
          window.setTimeout(() => {
            setActiveTier(nextTier);
            setReactionBeat(0);
            if (nextTier === finalTier) setFinalTierReached(true);
          }, stepStartsAt),
        );

        timers.push(
          window.setTimeout(() => {
            setReactionBeat(1);
          }, stepStartsAt + reactionBeatAt),
        );
      }
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [blackHole, escalationStartMs, finalTier, stepDurationsMs]);

  const grade = GRADES[activeTier - 1];
  const reactionFrame = blackHole
    ? 14
    : cosmic
      ? activeTier - 1
      : REACTION_FRAMES[activeTier - 1][reactionBeat];
  const walkDurationMs = Math.max(1900, escalationStartMs - 260);
  const heatLevel = (activeTier - 1) / (GRADES.length - 1);

  const sceneStyle = {
    "--active-accent": grade.accent,
    "--active-glow": grade.glow,
    "--escalation-start": `${escalationStartMs}ms`,
    "--scene-clear-at": `${cardRevealAtMs}ms`,
    "--walk-duration": `${walkDurationMs}ms`,
    "--heat-level": String(heatLevel),
    "--final-tier": String(finalTier),
    "--sky-star-opacity": String(0.55 - heatLevel * 0.38),
    "--sun-halo-opacity": String(0.42 + heatLevel * 0.42),
    "--sun-ray-opacity": String(0.18 + heatLevel * 0.42),
    "--mount-brightness": String(0.88 + heatLevel * 0.22),
    "--mount-saturation": String(0.82 + heatLevel * 0.48),
    "--sand-gold": `${Math.round(88 - heatLevel * 30)}%`,
    "--pyramid-brightness": String(0.86 + heatLevel * 0.24),
    "--pyramid-saturation": String(0.92 + heatLevel * 0.22),
    "--scorch-opacity": String(Math.max(0, (heatLevel - 0.55) * 1.9)),
    "--scorch-scale": String(0.45 + heatLevel * 0.55),
    "--haze-opacity": String(heatLevel * 0.58),
    "--ember-opacity": String(Math.max(0, (heatLevel - 0.62) * 2.6)),
  } as CSSProperties;

  const activeGradeStyle = useMemo(
    () =>
      ({
        "--grade-top": grade.skyTop,
        "--grade-bottom": grade.skyBottom,
      }) as CSSProperties,
    [grade],
  );

  return (
    <div
      className={styles.scene}
      data-tier={activeTier}
      data-black-hole={blackHole ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      data-cosmic={cosmic ? "true" : "false"}
      data-final-tier-reached={finalTierReached ? "true" : "false"}
      style={sceneStyle}
      aria-hidden="true"
    >
      <div className={styles.nightSky} />
      <div
        key={`grade-${activeTier}`}
        className={styles.gradeLayer}
        style={activeGradeStyle}
      />
      <div className={styles.skyStars} />

      <div className={styles.world}>
        <div className={styles.sun}>
          <span className={styles.sunCore} />
          <span className={styles.sunHalo} />
          <span className={styles.sunOrbitSystem}>
            <i className={`${styles.orbitRing} ${styles.orbitRingOne}`} />
            <i className={`${styles.orbitRing} ${styles.orbitRingTwo}`} />
            <i className={`${styles.orbitRing} ${styles.orbitRingThree}`} />
          </span>
        </div>

        <img
          src="/ancient-pulls/scene/distant-mountains-village-v1.webp"
          alt=""
          draggable={false}
          className={styles.horizon}
        />

        <div className={styles.sandGround} />
        <div className={styles.scorchedSand} />

        <div className={styles.walkStage}>
          {cosmic ? (
            <div className={styles.cosmicFlightTrail}>
              <span />
              <span />
              <span />
            </div>
          ) : null}
          <NebuPerformanceSprite
            sheet={walkSheet}
            durationMs={walkDurationMs}
            delayMs={180}
            columns={walkColumns}
            rows={walkRows}
            className={styles.walkSprite}
          />
        </div>

        <div className={styles.pyramidWrap}>
          <img
            src="/ancient-pulls/scene/pyramid-right-v1.webp"
            alt=""
            draggable={false}
            className={styles.pyramid}
          />
        </div>

        <div
          className={styles.reactionStage}
          data-visible={reactionsStarted ? "true" : "false"}
          key={`${activeTier}-${reactionBeat}-${blackHole ? "void" : "sun"}`}
        >
          <NebuPerformanceSprite
            sheet={reactionSheet}
            durationMs={1000}
            staticFrame={reactionFrame}
            columns={reactionColumns}
            rows={reactionRows}
            className={styles.reactionSprite}
          />
        </div>

        <div className={styles.heatHaze} />
        <div className={styles.embers}>
          {EMBERS.map((index) => (
            <span
              key={index}
              style={
                {
                  "--ember-left": `${8 + ((index * 41) % 85)}%`,
                  "--ember-delay": `${(index % 6) * 130}ms`,
                  "--ember-drift": `${-18 + (index % 7) * 6}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      {!blackHole && reactionsStarted ? (
        <div
          key={`flare-${activeTier}`}
          className={styles.rarityFlare}
        />
      ) : null}

      {blackHole ? (
        <>
          <div className={styles.blackHole}>
            <span className={styles.blackHoleCore} />
            <span className={styles.blackHoleRing} />
            <span className={styles.blackHoleRingOuter} />
          </div>
          <div className={styles.goldenGlimmer}>
            <span />
          </div>
        </>
      ) : null}

      {!blackHole && reactionsStarted ? (
        <div
          key={`caption-${activeTier}`}
          className={styles.heatCaption}
        >
          <span>{grade.name}</span>
          <strong>{TIER_LABELS[activeTier - 1]}</strong>
        </div>
      ) : null}
    </div>
  );
}
