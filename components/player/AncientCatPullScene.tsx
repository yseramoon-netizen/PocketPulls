"use client";

import type { CSSProperties, ReactNode } from "react";

import NebuSprite, { type NebuPose } from "./NebuSprite";
import {
  getNebuPerformance,
  type NebuSceneKey,
} from "@/lib/player/nebuPerformances";
import styles from "./AncientCatPullScene.module.css";

type AncientCatPullSceneProps = {
  scene: NebuSceneKey;
  performanceId: string;
  epilogue?: boolean;
  lowEffects?: boolean;
};

const CONSTELLATION_STARS = [
  [9, 28],
  [19, 17],
  [29, 34],
  [40, 15],
  [51, 29],
  [62, 12],
  [72, 31],
  [82, 18],
  [91, 36],
  [15, 51],
  [34, 54],
  [58, 49],
  [77, 55],
  [94, 61],
] as const;

const ACCENT_PARTICLES = Array.from({ length: 18 }, (_, index) => index);

function Actor({
  pose,
  className,
}: {
  pose: NebuPose;
  className: string;
}) {
  return <NebuSprite pose={pose} className={`${styles.actor} ${className}`} />;
}

function CommonScene({ performanceId }: { performanceId: string }) {
  const actionPose: NebuPose =
    performanceId === "sand_sneeze" ? "puffed" : "wiggle";

  return (
    <>
      <div className={styles.commonProp}>
        <span className={styles.commonPropRim} />
        <span className={styles.commonPropSand} />
        <span className={styles.commonCard}>✦</span>
      </div>
      <div className={styles.dustPuff}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <Actor pose="walk" className={styles.actorStart} />
      <Actor pose={actionPose} className={styles.actorAction} />
      <Actor pose="smug" className={styles.actorReaction} />
    </>
  );
}

function UncommonScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      <div className={styles.balloonProp}>
        <span className={styles.balloonOrb}>
          {performanceId === "papyrus_mouse" ? "◈" : "✦"}
        </span>
        <span className={styles.balloonString} />
      </div>
      <div className={styles.popBurst}>✦</div>
      <Actor pose="wiggle" className={styles.actorStart} />
      <Actor pose="swipe" className={styles.actorAction} />
      <Actor
        pose={performanceId === "papyrus_mouse" ? "pounce" : "puffed"}
        className={styles.actorReaction}
      />
    </>
  );
}

function RareScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      <div className={styles.chaseOrb}>
        {performanceId === "moon_moth" ? (
          <>
            <span className={styles.mothWingLeft} />
            <span className={styles.mothCore}>✦</span>
            <span className={styles.mothWingRight} />
          </>
        ) : (
          <span className={styles.yarnOrb}>✦</span>
        )}
      </div>
      <div className={styles.goldenThread} />
      <Actor pose="run" className={styles.actorStart} />
      <Actor pose="pounce" className={styles.actorAction} />
      <Actor pose="yarn" className={styles.actorReaction} />
    </>
  );
}

function DoubleRareScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      {performanceId === "temple_domino" ? (
        <div className={styles.dominoes}>
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              style={
                {
                  "--domino-delay": `${index * 55}ms`,
                  "--domino-height": `${42 + index * 4}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : (
        <div className={styles.templeBird}>
          <span className={styles.birdWing} />
          <span className={styles.birdBody}>◆</span>
          <span className={styles.birdRibbon} />
        </div>
      )}
      <Actor pose="groom" className={styles.actorStart} />
      <Actor pose="leap" className={styles.actorAction} />
      <Actor pose="smug" className={styles.actorReaction} />
    </>
  );
}

function UltraRareScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      {performanceId === "balance_heart" ? (
        <div className={styles.heartScale}>
          <span className={styles.scaleBeam} />
          <span className={styles.scaleLeft}>✦</span>
          <span className={styles.scaleRight}>◆</span>
        </div>
      ) : (
        <div className={styles.mirrorVault}>
          <span className={styles.mirrorOne} />
          <span className={styles.mirrorTwo} />
          <span className={styles.mirrorThree} />
          <span className={styles.sunbeam} />
        </div>
      )}
      <div className={styles.vaultDoor}>
        <span>◈</span>
      </div>
      <Actor pose="walk" className={styles.actorStart} />
      <Actor pose="sacred" className={styles.actorAction} />
      <Actor pose="crown" className={styles.actorReaction} />
    </>
  );
}

function IllustrationScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      <div
        className={`${styles.mural} ${
          performanceId === "papyrus_theatre" ? styles.papyrusTheatre : ""
        }`}
      >
        <div className={styles.muralSun} />
        <div className={styles.muralRiver} />
        <NebuSprite pose="sacred" className={styles.muralNebu} />
        <span className={styles.muralCurtainLeft} />
        <span className={styles.muralCurtainRight} />
      </div>
      <div className={styles.inkTrail}>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index}>◆</span>
        ))}
      </div>
      <Actor pose="idle" className={styles.actorStart} />
      <Actor pose="leap" className={styles.actorAction} />
      <Actor pose="sacred" className={styles.actorReaction} />
    </>
  );
}

function SpecialIllustrationScene({
  performanceId,
}: {
  performanceId: string;
}) {
  return (
    <>
      <div
        className={`${styles.skyMirror} ${
          performanceId === "sky_mirror" ? styles.skyMirrorActive : ""
        }`}
      >
        <span />
      </div>
      <div className={styles.eyeReflection}>
        <span>✦</span>
      </div>
      <Actor pose="back" className={styles.actorStart} />
      <Actor pose="sacred" className={styles.actorAction} />
      <Actor pose="leap" className={styles.actorReaction} />
    </>
  );
}

function HyperRareScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      <div
        className={`${styles.solarBoat} ${
          performanceId === "eclipse_thief" ? styles.eclipseBoat : ""
        }`}
      >
        <span className={styles.boatHull} />
        <span className={styles.boatMast} />
        <span className={styles.solarDisc}>✦</span>
      </div>
      <div className={styles.starBridge}>
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <Actor pose="run" className={styles.actorStart} />
      <Actor pose="leap" className={styles.actorAction} />
      <Actor pose="crown" className={styles.actorReaction} />
    </>
  );
}

function CrownRareScene({ performanceId }: { performanceId: string }) {
  return (
    <>
      {performanceId === "hall_eight" ? (
        <div className={styles.eightDoors}>
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              style={
                {
                  "--door-delay": `${index * 70}ms`,
                  "--door-height": `${42 + index * 3}%`,
                } as CSSProperties
              }
            >
              ◈
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.catConstellation}>
        <span className={styles.constellationHead} />
        <span className={styles.constellationEarLeft} />
        <span className={styles.constellationEarRight} />
        <span className={styles.constellationBody} />
        <span className={styles.constellationTail} />
      </div>
      <div className={styles.screenCrack}>✦</div>
      <Actor pose="sacred" className={styles.actorStart} />
      <Actor pose="leap" className={styles.actorAction} />
      <Actor pose="crown" className={styles.actorReaction} />
    </>
  );
}

function SceneContent({
  scene,
  performanceId,
}: {
  scene: NebuSceneKey;
  performanceId: string;
}): ReactNode {
  switch (scene) {
    case "common":
      return <CommonScene performanceId={performanceId} />;
    case "uncommon":
      return <UncommonScene performanceId={performanceId} />;
    case "rare":
      return <RareScene performanceId={performanceId} />;
    case "doubleRare":
      return <DoubleRareScene performanceId={performanceId} />;
    case "ultraRare":
      return <UltraRareScene performanceId={performanceId} />;
    case "illustrationRare":
      return <IllustrationScene performanceId={performanceId} />;
    case "specialIllustrationRare":
      return <SpecialIllustrationScene performanceId={performanceId} />;
    case "hyperRare":
      return <HyperRareScene performanceId={performanceId} />;
    case "crownRare":
      return <CrownRareScene performanceId={performanceId} />;
  }
}

function Epilogue({ scene }: { scene: NebuSceneKey }) {
  const isCatnip = scene === "specialIllustrationRare";
  const isSolar = scene === "hyperRare";

  return (
    <div className={styles.epilogue}>
      <div className={styles.epilogueGlow} />
      <NebuSprite
        pose={isCatnip ? "catnip" : isSolar ? "yarn" : "crown"}
        className={styles.epilogueNebu}
      />
      <div className={styles.epilogueObject}>
        {isCatnip ? "☘" : isSolar ? "✦" : "♛"}
      </div>
      <p>
        {isCatnip
          ? "The star was catnip."
          : isSolar
            ? "The replacement sun was yarn."
            : "The crown was slightly too large."}
      </p>
      <span>Nebu knew exactly what he was doing.</span>
    </div>
  );
}

export default function AncientCatPullScene({
  scene,
  performanceId,
  epilogue = false,
  lowEffects = false,
}: AncientCatPullSceneProps) {
  const performance = getNebuPerformance(scene, performanceId);

  return (
    <div
      className={styles.scene}
      data-scene={scene}
      data-performance={performance.id}
      data-epilogue={epilogue ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      aria-hidden="true"
    >
      <div className={styles.constellation}>
        <span className={`${styles.line} ${styles.lineOne}`} />
        <span className={`${styles.line} ${styles.lineTwo}`} />
        <span className={`${styles.line} ${styles.lineThree}`} />
        <span className={`${styles.line} ${styles.lineFour}`} />
        <span className={`${styles.line} ${styles.lineFive}`} />

        {CONSTELLATION_STARS.map(([left, top], index) => (
          <span
            key={`${left}-${top}`}
            className={styles.constellationStar}
            style={
              {
                "--star-left": `${left}%`,
                "--star-top": `${top}%`,
                "--star-delay": `${index * 70}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.moonDisc} />
      <div className={styles.templeSilhouette}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.desertHorizon} />
      <div className={styles.duneNear} />

      <div className={styles.primaryScene}>
        <SceneContent scene={scene} performanceId={performance.id} />
      </div>

      <div className={styles.signatureParticles}>
        {ACCENT_PARTICLES.map((index) => (
          <span
            key={index}
            style={
              {
                "--accent-size": `${3 + (index % 4)}px`,
                "--accent-left": `${7 + ((index * 37) % 88)}%`,
                "--accent-top": `${10 + ((index * 53) % 72)}%`,
                "--accent-delay": `${(index % 7) * 130}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <p className={styles.performanceLabel}>{performance.label}</p>
      <Epilogue scene={scene} />
    </div>
  );
}
