"use client";

/* eslint-disable @next/next/no-img-element -- Timed cinematic art is preloaded before this scene mounts. */

import type { CSSProperties } from "react";

import AsterismSigil from "./AsterismSigil";
import NebuWishSummon from "./NebuWishSummon";
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
  cosmicNebuPortrait: string;
  equippedCosmicNebu?: boolean;
  cosmicDiscovery?: boolean;
  cosmicBinderDiscovery?: boolean;
  blackHole?: boolean;
  lowEffects?: boolean;
  seed: string;
};

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

function clampTier(tier: number): number {
  return Math.max(1, Math.min(TIER_NAMES.length, Math.round(tier)));
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
  cosmicNebuPortrait,
  equippedCosmicNebu = false,
  cosmicDiscovery = false,
  cosmicBinderDiscovery = false,
  blackHole = false,
  lowEffects = false,
  seed,
}: StellarWishJourneyProps) {
  const finalTier = clampTier(tier);
  const finalStageAtMs = stageMomentsMs[finalTier - 1] ?? specialAtMs - 400;
  const dualDiscovery = cosmicDiscovery && cosmicBinderDiscovery;
  const rootStyle = {
    "--stellar-final-stage-at": `${finalStageAtMs}ms`,
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
      <div className={styles.summoningHalo} />

      <div className={styles.observatory}>
        <div className={styles.mountains} />
        <div className={styles.horizonLight} />
        <div className={styles.pyramid} />
        <div className={styles.foreground} />
      </div>

      <div className={styles.summonHost}>
        <NebuWishSummon
          tier={finalTier}
          stageMomentsMs={stageMomentsMs}
          specialAtMs={specialAtMs}
          impactAtMs={impactAtMs}
          cardRevealAtMs={cardRevealAtMs}
          blackHole={blackHole}
          lowEffects={lowEffects}
        />
      </div>

      {cosmicDiscovery ? (
        <div className={styles.cosmicTransformStage}>
          <img
            src={cosmicNebuPortrait}
            alt=""
            draggable={false}
            className={styles.cosmicNebuPortrait}
          />
        </div>
      ) : null}

      <div className={styles.rarityPulse}>
        {TIER_NAMES.map((name, index) => (
          <span
            key={name}
            data-reached={index < finalTier ? "true" : "false"}
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
