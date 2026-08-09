"use client";

import type { CSSProperties } from "react";

import styles from "./AncientCatPullScene.module.css";

type AncientCatPullSceneProps = {
  tier: number;
  epilogue?: boolean;
};

type SceneName =
  | "sand"
  | "scarab"
  | "thread"
  | "feather"
  | "celestial";

function getScene(tier: number): SceneName {
  if (tier >= 6) return "celestial";
  if (tier >= 4) return "feather";
  if (tier === 3) return "thread";
  if (tier === 2) return "scarab";
  return "sand";
}

const CONSTELLATION_STARS = [
  [12, 28, 0],
  [25, 18, 1],
  [38, 34, 2],
  [50, 17, 3],
  [63, 30, 4],
  [76, 15, 5],
  [87, 33, 6],
  [21, 48, 7],
  [71, 50, 8],
  [91, 57, 9],
] as const;

export default function AncientCatPullScene({
  tier,
  epilogue = false,
}: AncientCatPullSceneProps) {
  const scene = getScene(tier);

  return (
    <div
      className={styles.scene}
      data-scene={scene}
      data-epilogue={epilogue ? "true" : "false"}
      aria-hidden="true"
    >
      <div className={styles.constellation}>
        <span className={`${styles.line} ${styles.lineOne}`} />
        <span className={`${styles.line} ${styles.lineTwo}`} />
        <span className={`${styles.line} ${styles.lineThree}`} />
        <span className={`${styles.line} ${styles.lineFour}`} />
        <span className={`${styles.line} ${styles.lineFive}`} />

        {CONSTELLATION_STARS.map(([left, top, index]) => (
          <span
            key={index}
            className={styles.constellationStar}
            style={
              {
                "--star-left": `${left}%`,
                "--star-top": `${top}%`,
                "--star-delay": `${index * 90}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.moonDisc} />
      <div className={styles.desertHorizon} />
      <div className={styles.duneNear} />

      <div className={styles.sandBowl}>
        <span className={styles.sandOne} />
        <span className={styles.sandTwo} />
        <span className={styles.papyrusCard}>✦</span>
      </div>

      <div className={styles.scarab}>
        <span className={styles.scarabWingLeft} />
        <span className={styles.scarabBody}>◆</span>
        <span className={styles.scarabWingRight} />
      </div>

      <div className={styles.goldenThread}>
        <span className={styles.threadTrail} />
        <span className={styles.threadOrb}>✦</span>
      </div>

      <div className={styles.feather}>❯</div>
      <div className={styles.falconShadow}>⌁</div>

      <div className={styles.catWrap}>
        <div className={styles.catHalo} />
        <img
          className={styles.cat}
          src="/ancient-pulls/celestial-cat.png"
          alt=""
          draggable={false}
        />
        <span className={styles.pawFlash}>✦</span>
      </div>

      <div className={styles.eyeReflection}>✦</div>

      <div className={styles.epilogue}>
        <div className={styles.catnipStar}>✦</div>
        <div className={styles.catnipStem}>
          <span />
          <span />
          <span />
        </div>
        <img
          src="/ancient-pulls/celestial-cat.png"
          alt=""
          draggable={false}
        />
        <p>The star was catnip.</p>
        <span>Nebu knew all along.</span>
      </div>
    </div>
  );
}
