"use client";

/* eslint-disable @next/next/no-img-element -- Nebu art is preloaded by the cinematic before this timed scene mounts. */

import type { CSSProperties } from "react";

import AsterismSigil from "./AsterismSigil";
import styles from "./StellarWishJourney.module.css";

type StellarWishJourneyProps = {
  tier: number;
  stageMomentsMs: readonly number[];
  specialAtMs: number;
  collapseAtMs: number;
  impactAtMs: number;
  cardRevealAtMs: number;
  cosmicTransformAtMs: number | null;
  binderFormAtMs: number | null;
  binderOpenAtMs: number | null;
  nebuPortrait: string;
  cosmicNebuPortrait: string;
  equippedCosmicNebu?: boolean;
  cosmicDiscovery?: boolean;
  cosmicBinderDiscovery?: boolean;
  blackHole?: boolean;
  lowEffects?: boolean;
  seed: string;
};

type Point = {
  x: number;
  y: number;
};

const STAR_PATH: readonly Point[] = [
  { x: 13, y: 76 },
  { x: 26, y: 61 },
  { x: 40, y: 68 },
  { x: 53, y: 48 },
  { x: 67, y: 56 },
  { x: 80, y: 39 },
  { x: 68, y: 24 },
  { x: 45, y: 27 },
  { x: 51, y: 10 },
] as const;

const TIER_NAMES = [
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

const STAR_FRAGMENTS = Array.from({ length: 18 }, (_, index) => index);

function clampTier(tier: number): number {
  return Math.max(1, Math.min(STAR_PATH.length, Math.round(tier)));
}

export default function StellarWishJourney({
  tier,
  stageMomentsMs,
  specialAtMs,
  collapseAtMs,
  impactAtMs,
  cardRevealAtMs,
  cosmicTransformAtMs,
  binderFormAtMs,
  binderOpenAtMs,
  nebuPortrait,
  cosmicNebuPortrait,
  equippedCosmicNebu = false,
  cosmicDiscovery = false,
  cosmicBinderDiscovery = false,
  blackHole = false,
  lowEffects = false,
  seed,
}: StellarWishJourneyProps) {
  const finalTier = clampTier(tier);
  const visiblePath = STAR_PATH.slice(0, finalTier);
  const pathPoints = visiblePath.map((point) => `${point.x},${point.y}`).join(" ");
  const firstStageAtMs = stageMomentsMs[0] ?? 800;
  const finalStageAtMs = stageMomentsMs[finalTier - 1] ?? specialAtMs - 400;
  const journeyDurationMs = Math.max(520, finalStageAtMs - firstStageAtMs);
  const dualDiscovery = cosmicDiscovery && cosmicBinderDiscovery;
  const initialPortrait = equippedCosmicNebu
    ? cosmicNebuPortrait
    : nebuPortrait;
  const rootStyle = {
    "--stellar-first-stage-at": `${firstStageAtMs}ms`,
    "--stellar-final-stage-at": `${finalStageAtMs}ms`,
    "--stellar-journey-duration": `${journeyDurationMs}ms`,
    "--stellar-special-at": `${specialAtMs}ms`,
    "--stellar-collapse-at": `${collapseAtMs}ms`,
    "--stellar-impact-at": `${impactAtMs}ms`,
    "--stellar-card-at": `${cardRevealAtMs}ms`,
    "--stellar-cosmic-transform-at": `${cosmicTransformAtMs ?? specialAtMs}ms`,
    "--stellar-binder-form-at": `${binderFormAtMs ?? specialAtMs}ms`,
    "--stellar-binder-open-at": `${binderOpenAtMs ?? collapseAtMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={styles.scene}
      style={rootStyle}
      data-tier={finalTier}
      data-cosmic-equipped={equippedCosmicNebu ? "true" : "false"}
      data-cosmic-discovery={cosmicDiscovery ? "true" : "false"}
      data-binder-discovery={cosmicBinderDiscovery ? "true" : "false"}
      data-dual-discovery={dualDiscovery ? "true" : "false"}
      data-black-hole={blackHole ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      aria-hidden="true"
    >
      <div className={styles.deepSky} />
      <div className={styles.nebulaVeil} />
      <div className={styles.farStars} />
      <div className={styles.nearStars} />

      <div className={styles.celestialCamera}>
        <svg
          className={styles.constellationMap}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {finalTier > 1 ? (
            <polyline
              className={styles.constellationPath}
              points={pathPoints}
              pathLength="1"
            />
          ) : null}
          {visiblePath.map((point, index) => (
            <g
              key={`${point.x}-${point.y}`}
              className={styles.constellationNode}
              data-final={index === finalTier - 1 ? "true" : "false"}
              style={
                {
                  "--node-at": `${stageMomentsMs[index] ?? finalStageAtMs}ms`,
                  "--node-x": `${point.x}%`,
                  "--node-y": `${point.y}%`,
                } as CSSProperties
              }
            >
              <circle className={styles.nodeHalo} cx={point.x} cy={point.y} r="4.8" />
              <circle className={styles.nodeCore} cx={point.x} cy={point.y} r={index === finalTier - 1 ? "1.45" : "0.82"} />
            </g>
          ))}
        </svg>

        <div className={styles.wishStar}>
          <span className={styles.starHalo} />
          <span className={styles.starFlames}>
            {Array.from({ length: 10 }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    "--flame-angle": `${index * 36}deg`,
                    "--flame-delay": `${index * -127}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
          <span className={styles.starSurface} />
          <span className={styles.starCore} />
          <span className={styles.supernovaRing} />
          <span className={styles.supernovaRingSecond} />
        </div>

        {blackHole ? (
          <div className={styles.blackHole}>
            <span className={styles.blackHoleLens} />
            <span className={styles.blackHoleDisk} />
            <span className={styles.blackHoleCore} />
          </div>
        ) : null}

        <div className={styles.starFragments}>
          {STAR_FRAGMENTS.slice(0, lowEffects ? 7 : STAR_FRAGMENTS.length).map((index) => (
            <i
              key={index}
              style={
                {
                  "--fragment-angle": `${index * 20 + (index % 3) * 5}deg`,
                  "--fragment-distance": `${82 + (index % 6) * 24}px`,
                  "--fragment-delay": `${(index % 5) * 16}ms`,
                  "--fragment-size": `${2 + (index % 4) * 0.9}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <div className={styles.observatory}>
        <div className={styles.mountains} />
        <div className={styles.horizonLight} />
        <div className={styles.pyramid} />
        <div className={styles.foreground} />
      </div>

      <div className={styles.nebuStage}>
        <span className={styles.nebuShadow} />
        <span className={styles.nebuGaze} />
        <img
          src={initialPortrait}
          alt=""
          draggable={false}
          className={styles.nebuPortrait}
        />
        {cosmicDiscovery ? (
          <img
            src={cosmicNebuPortrait}
            alt=""
            draggable={false}
            className={styles.cosmicNebuPortrait}
          />
        ) : null}
      </div>

      <div className={styles.rarityPulse}>
        {TIER_NAMES.map((name, index) => (
          <span
            key={name}
            data-reached={index < finalTier ? "true" : "false"}
            data-final={index === finalTier - 1 ? "true" : "false"}
            style={
              {
                "--pulse-at": `${stageMomentsMs[index] ?? finalStageAtMs}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {cosmicDiscovery ? (
        <div className={styles.cosmicAwakening}>
          <span className={styles.cosmicSilence} />
          <span className={styles.cosmicShockwave} />
          <AsterismSigil
            seed={`${seed}:cosmic-nebu-awakening`}
            points={9}
            className={styles.cosmicNebuConstellation}
          />
          <p>{dualDiscovery ? "THE COSMOS REMEMBERS" : "THE COSMOS HAS AWAKENED"}</p>
        </div>
      ) : null}

      {cosmicBinderDiscovery ? (
        <div className={styles.binderAwakening}>
          <span className={styles.binderOrbit} />
          <div className={styles.cosmicBinder}>
            <div className={styles.binderBack}>
              <span className={styles.binderPortal} />
            </div>
            <div className={styles.binderFront}>
              <AsterismSigil
                seed={`${seed}:cosmic-binder-awakening`}
                points={9}
                className={styles.binderSigil}
              />
              <span className={styles.binderSpine} />
              <span className={styles.binderClasp} />
            </div>
          </div>
          <p>{dualDiscovery ? "A LEGENDARY CONVERGENCE" : "THE CELESTIAL ARCHIVE ANSWERS"}</p>
        </div>
      ) : null}

      <div className={styles.finalWhiteout} />
    </div>
  );
}
