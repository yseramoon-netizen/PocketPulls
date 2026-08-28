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
  travelDurationsMs?: readonly number[];
  collapseAtMs: number;
  cardRevealAtMs: number;
  walkSheet?: string;
  reactionSheet?: string;
  walkColumns?: number;
  walkRows?: number;
  reactionColumns?: number;
  reactionRows?: number;
  cosmic?: boolean;
  cosmicDiscovery?: boolean;
  cosmicReactionSheet?: string;
  cosmicReactionColumns?: number;
  cosmicReactionRows?: number;
  cosmicTransformAtMs?: number | null;
  blackHole?: boolean;
  blackHoleTravelStartMs?: number | null;
  blackHoleTravelDurationMs?: number;
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
const SOLAR_TONGUES = Array.from({ length: 14 }, (_, index) => index);
const SOLAR_SPARKS = Array.from({ length: 12 }, (_, index) => index);
const SUPERNOVA_FRAGMENTS = Array.from({ length: 16 }, (_, index) => index);
const SPACE_STREAKS = Array.from({ length: 48 }, (_, index) => index);
const SPACE_MOTES = Array.from({ length: 22 }, (_, index) => index);

function clampTier(tier: number): number {
  return Math.max(1, Math.min(GRADES.length, Math.round(tier)));
}

function BurningStarLayers({
  heatLevel,
  explosionPower,
}: {
  heatLevel: number;
  explosionPower: number;
}) {
  return (
    <>
      <span className={styles.sunHalo} />
      <span className={styles.chromosphere} />
      <span className={styles.plasmaTongues}>
        {SOLAR_TONGUES.map((index) => (
          <i
            key={index}
            style={
              {
                "--tongue-angle": `${index * (360 / SOLAR_TONGUES.length) + (index % 2) * 5}deg`,
                "--tongue-length": `${25 + (index % 5) * 7}px`,
                "--tongue-width": `${3.2 + (index % 3) * 1.25}px`,
                "--tongue-sway": `${index % 2 === 0 ? 5 + (index % 3) : -5 - (index % 3)}deg`,
                "--tongue-sway-back": `${index % 2 === 0 ? -4 - (index % 2) : 4 + (index % 2)}deg`,
                "--tongue-delay": `${index * -113}ms`,
                "--tongue-duration": `${Math.round(1420 + (index % 4) * 125 - heatLevel * 520)}ms`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <span className={styles.solarSparks}>
        {SOLAR_SPARKS.map((index) => (
          <i
            key={index}
            style={
              {
                "--spark-angle": `${index * 30 + (index % 3) * 8}deg`,
                "--spark-distance": `${48 + (index % 4) * 13}px`,
                "--spark-size": `${1.5 + (index % 3) * 0.75}px`,
                "--spark-delay": `${index * -149}ms`,
                "--spark-duration": `${Math.round(1500 + (index % 5) * 170 - heatLevel * 460)}ms`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <span className={styles.sunCore}>
        <i className={styles.surfaceFire} />
        <i className={styles.surfaceFireSecondary} />
      </span>
      <span className={styles.supernovaCorona} />
      <span className={styles.supernovaRays} />
      <span className={styles.supernovaFragments}>
        {SUPERNOVA_FRAGMENTS.map((index) => {
          const fragmentDistance = Math.round(
            (76 + (index % 5) * 19) * explosionPower,
          );
          return (
            <i
              key={index}
              style={
                {
                  "--fragment-angle": `${index * 22.5 + (index % 3) * 4}deg`,
                  "--fragment-near": `${Math.round(fragmentDistance * 0.32)}px`,
                  "--fragment-distance": `${fragmentDistance}px`,
                  "--fragment-far": `${Math.round(fragmentDistance * 1.2)}px`,
                  "--fragment-delay": `${(index % 4) * 18}ms`,
                  "--fragment-size": `${2 + (index % 4) * 1.15}px`,
                } as CSSProperties
              }
            />
          );
        })}
      </span>
    </>
  );
}

export default function AncientCatPullScene({
  tier,
  escalationStartMs,
  stepDurationsMs,
  travelDurationsMs = [],
  collapseAtMs,
  cardRevealAtMs,
  walkSheet = DEFAULT_WALK_SHEET,
  reactionSheet = DEFAULT_REACTION_SHEET,
  walkColumns = 4,
  walkRows = 4,
  reactionColumns = 4,
  reactionRows = 4,
  cosmic = false,
  cosmicDiscovery = false,
  cosmicReactionSheet = "/ancient-pulls/skins/cosmic-nebu/tier-reactions.webp",
  cosmicReactionColumns = 3,
  cosmicReactionRows = 3,
  cosmicTransformAtMs = null,
  blackHole = false,
  blackHoleTravelStartMs = null,
  blackHoleTravelDurationMs = 5000,
  lowEffects = false,
}: AncientCatPullSceneProps) {
  const finalTier = clampTier(tier);
  const [activeTier, setActiveTier] = useState(1);
  const [reactionBeat, setReactionBeat] = useState(0);
  const [reactionsStarted, setReactionsStarted] = useState(false);
  const [travelling, setTravelling] = useState(false);
  const [leftWorld, setLeftWorld] = useState(false);
  const [travelTargetTier, setTravelTargetTier] = useState(2);
  const [travelDurationMs, setTravelDurationMs] = useState(2000);
  const [travelSerial, setTravelSerial] = useState(0);
  const [blackHoleReached, setBlackHoleReached] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        setActiveTier(1);
        setReactionBeat(0);
        setReactionsStarted(false);
        setTravelling(false);
        setLeftWorld(false);
        setTravelTargetTier(2);
        setTravelDurationMs(2000);
        setTravelSerial(0);
        setBlackHoleReached(false);
        setCollapsing(false);
      }, 0),
    );

    timers.push(
      window.setTimeout(() => {
        setReactionsStarted(true);
        setActiveTier(1);
      }, escalationStartMs),
    );

    if (!cosmicDiscovery) {
      const firstStageDuration = stepDurationsMs[0] ?? 2000;
      timers.push(
        window.setTimeout(() => setReactionBeat(1),
          escalationStartMs + Math.min(900, Math.max(520, firstStageDuration * 0.42))),
      );

      for (let nextTier = 2; nextTier <= finalTier; nextTier += 1) {
        const segmentStartsAt = escalationStartMs + stepDurationsMs
          .slice(0, nextTier - 1)
          .reduce((total, duration) => total + duration, 0);
        const segmentDuration = stepDurationsMs[nextTier - 1] ?? 4000;
        const travelShare = Math.min(0.81, 0.6 + (nextTier - 2) * 0.03);
        const nextTravelDuration = travelDurationsMs[nextTier - 1]
          ?? Math.max(1200, Math.round(segmentDuration * travelShare));
        const destinationHold = Math.max(520, segmentDuration - nextTravelDuration);

        timers.push(
          window.setTimeout(() => {
            setLeftWorld(true);
            setTravelling(true);
            setTravelTargetTier(nextTier);
            setTravelDurationMs(nextTravelDuration);
            setTravelSerial((current) => current + 1);
            setReactionBeat(0);
          }, segmentStartsAt),
        );

        timers.push(
          window.setTimeout(() => {
            setActiveTier(nextTier);
            setTravelling(false);
            setReactionBeat(0);
          }, segmentStartsAt + nextTravelDuration),
        );

        timers.push(
          window.setTimeout(() => setReactionBeat(1),
            segmentStartsAt + nextTravelDuration + Math.min(640, destinationHold * 0.46)),
        );
      }

      if (blackHole && blackHoleTravelStartMs !== null) {
        timers.push(
          window.setTimeout(() => {
            setLeftWorld(true);
            setTravelling(true);
            setTravelTargetTier(GRADES.length + 1);
            setTravelDurationMs(blackHoleTravelDurationMs);
            setTravelSerial((current) => current + 1);
          }, blackHoleTravelStartMs),
        );
        timers.push(
          window.setTimeout(() => {
            setTravelling(false);
            setBlackHoleReached(true);
          }, blackHoleTravelStartMs + blackHoleTravelDurationMs),
        );
      }

      timers.push(
        window.setTimeout(() => setCollapsing(true), collapseAtMs),
      );
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [
    blackHole,
    blackHoleTravelDurationMs,
    blackHoleTravelStartMs,
    collapseAtMs,
    cosmicDiscovery,
    escalationStartMs,
    finalTier,
    stepDurationsMs,
    travelDurationsMs,
  ]);

  const grade = GRADES[activeTier - 1];
  const reactionFrame = cosmic
      ? activeTier - 1
      : REACTION_FRAMES[activeTier - 1][reactionBeat];
  const walkDurationMs = Math.max(1900, escalationStartMs - 260);
  const heatLevel = (activeTier - 1) / (GRADES.length - 1);
  const destinationGrade = GRADES[Math.min(GRADES.length - 1, travelTargetTier - 1)];
  const explosionPower = 0.78 + finalTier * 0.1;

  const sceneStyle = {
    "--active-accent": grade.accent,
    "--active-glow": grade.glow,
    "--escalation-start": `${escalationStartMs}ms`,
    "--sun-rise-duration": `${Math.max(700, escalationStartMs - 260)}ms`,
    "--sun-collapse-at": `${collapseAtMs}ms`,
    "--supernova-duration": `${Math.max(680, cardRevealAtMs - collapseAtMs)}ms`,
    "--scene-clear-at": `${cardRevealAtMs}ms`,
    "--walk-duration": `${walkDurationMs}ms`,
    "--heat-level": String(heatLevel),
    "--active-tier": String(activeTier),
    "--final-tier": String(finalTier),
    "--travel-duration": `${travelDurationMs}ms`,
    "--streak-duration": `${Math.max(620, Math.round(travelDurationMs * 0.48))}ms`,
    "--destination-accent": destinationGrade.accent,
    "--destination-glow": destinationGrade.glow,
    "--explosion-power": String(explosionPower),
    "--corona-peak": String(1.2 + finalTier * 0.13),
    "--ray-peak": String(1.08 + finalTier * 0.1),
    "--cosmic-transform-at": `${cosmicTransformAtMs ?? collapseAtMs}ms`,
    "--cosmic-brighten-duration": `${Math.max(1200, cardRevealAtMs - escalationStartMs)}ms`,
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
    "--surface-fire-opacity": String(0.34 + heatLevel * 0.34),
    "--surface-fire-secondary-opacity": String(0.24 + heatLevel * 0.25),
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
      data-black-hole-reached={blackHoleReached ? "true" : "false"}
      data-travelling={travelling ? "true" : "false"}
      data-left-world={leftWorld ? "true" : "false"}
      data-collapsing={collapsing ? "true" : "false"}
      data-reactions-started={reactionsStarted ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      data-cosmic={cosmic ? "true" : "false"}
      data-cosmic-discovery={cosmicDiscovery ? "true" : "false"}
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

      {leftWorld ? (
        <div
          className={styles.spaceJourney}
          data-travelling={travelling ? "true" : "false"}
          data-black-hole-reached={blackHoleReached ? "true" : "false"}
        >
          <div className={styles.deepSpace} />
          <div className={styles.deepNebula} />
          <div className={styles.farStarField} />

          {travelling ? (
            <div key={`tunnel-${travelSerial}`} className={styles.starTunnel}>
              {SPACE_STREAKS.map((index) => (
                <i
                  key={index}
                  style={
                    {
                      "--streak-angle": `${(index * 137.508 + (index % 5) * 11) % 360}deg`,
                      "--streak-radius": `${5 + ((index * 29) % 42)}vmax`,
                      "--streak-size": `${0.7 + (index % 4) * 0.42}px`,
                      "--streak-delay": `${-(index % 12) * 83}ms`,
                      "--streak-opacity": String(0.42 + (index % 5) * 0.11),
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ) : null}

          <div className={styles.spaceMotes}>
            {SPACE_MOTES.map((index) => (
              <i
                key={index}
                style={
                  {
                    "--mote-left": `${4 + ((index * 43) % 92)}%`,
                    "--mote-top": `${5 + ((index * 31) % 88)}%`,
                    "--mote-size": `${1 + (index % 3) * 0.7}px`,
                    "--mote-delay": `${index * -137}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {!blackHoleReached ? (
            <div
              key={`destination-star-${activeTier}`}
              className={styles.journeyStar}
            >
              <BurningStarLayers
                heatLevel={heatLevel}
                explosionPower={explosionPower}
              />
            </div>
          ) : null}

          {blackHoleReached ? (
            <div className={styles.destinationBlackHole}>
              <span className={styles.gravitationalLens} />
              <span className={styles.accretionDiskRear} />
              <span className={styles.eventHorizon} />
              <span className={styles.photonRing} />
              <span className={styles.accretionDiskFront} />
            </div>
          ) : null}

          {travelling ? (
            <div className={styles.travelReadout}>
              <span>Interstellar passage</span>
              <strong>{travelTargetTier > GRADES.length ? "Event horizon" : "Crossing deep space"}</strong>
            </div>
          ) : null}

          {blackHoleReached && collapsing ? (
            <div className={styles.singularityCollision} />
          ) : null}
        </div>
      ) : null}

      <div className={styles.world}>
        <div className={styles.sun}>
          <BurningStarLayers
            heatLevel={heatLevel}
            explosionPower={explosionPower}
          />
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
            smooth={cosmic}
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

        {!cosmicDiscovery ? (
          <div
            className={styles.reactionStage}
            data-visible={reactionsStarted && !leftWorld ? "true" : "false"}
            key={`${activeTier}-${reactionBeat}-${blackHole ? "void" : "sun"}`}
          >
            <NebuPerformanceSprite
              sheet={reactionSheet}
              durationMs={1000}
              staticFrame={reactionFrame}
              columns={reactionColumns}
              rows={reactionRows}
              smooth={cosmic}
              className={styles.reactionSprite}
            />
          </div>
        ) : (
          <div className={styles.cosmicTransformation}>
            <div className={styles.mortalNebu}>
              <NebuPerformanceSprite
                sheet={reactionSheet}
                durationMs={1000}
                staticFrame={REACTION_FRAMES[0][1]}
                columns={reactionColumns}
                rows={reactionRows}
                className={styles.reactionSprite}
              />
            </div>
            <div className={styles.transformedNebu}>
              <NebuPerformanceSprite
                sheet={cosmicReactionSheet}
                durationMs={1200}
                staticFrame={Math.max(0, cosmicReactionColumns * cosmicReactionRows - 1)}
                columns={cosmicReactionColumns}
                rows={cosmicReactionRows}
                smooth
                className={styles.reactionSprite}
              />
            </div>
            <span className={styles.transformationCore} />
            <span className={styles.transformationRing} />
          </div>
        )}

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

      {cosmicDiscovery ? (
        <>
          <div className={styles.cosmicSkyBloom} />
          <div className={styles.cosmicWhiteout} />
          <div className={styles.cosmicConstellationBurst} />
          <div className={styles.cosmicCaption}>
            <span>A living constellation awakens</span>
            <strong>Cosmic Nebu</strong>
          </div>
        </>
      ) : null}

      {!cosmicDiscovery && reactionsStarted && !travelling && !blackHoleReached ? (
        <div
          key={`flare-${activeTier}`}
          className={styles.rarityFlare}
        />
      ) : null}

      {blackHole && blackHoleReached && collapsing ? (
        <div className={styles.goldenGlimmer}>
          <span />
        </div>
      ) : null}

      {!cosmicDiscovery && reactionsStarted && !travelling && !blackHoleReached ? (
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
