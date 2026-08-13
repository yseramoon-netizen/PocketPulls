"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

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
  label: string;
  skyTop: string;
  skyBottom: string;
  accent: string;
  secondary: string;
  glow: string;
};

type Journey = {
  id: number;
  fromTier: number;
  toTier: number;
  durationMs: number;
  toBlackHole: boolean;
};

const DEFAULT_WALK_SHEET = "/ancient-pulls/scene/nebu-pyramid-exit-v1.webp";
const DEFAULT_REACTION_SHEET = "/ancient-pulls/scene/nebu-heat-reactions-v1.webp";

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

const STREAKS = Array.from({ length: 30 }, (_, index) => index);
const DEPTH_STARS = Array.from({ length: 24 }, (_, index) => index);
const SOLAR_TONGUES = Array.from({ length: 14 }, (_, index) => index);
const SOLAR_SPARKS = Array.from({ length: 12 }, (_, index) => index);
const SUPERNOVA_FRAGMENTS = Array.from({ length: 18 }, (_, index) => index);

function clampTier(tier: number): number {
  return Math.max(1, Math.min(GRADES.length, Math.round(tier)));
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

function BurningStar({ grade, tier, final = false }: { grade: Grade; tier: number; final?: boolean }) {
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
}

export default function AncientCatPullScene({
  tier,
  escalationStartMs,
  stepDurationsMs,
  collapseAtMs,
  cardRevealAtMs,
  arrivalHoldMs = 420,
  blackHoleTravelMs = 5000,
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
  const [journey, setJourney] = useState<Journey | null>(null);
  const [spaceMode, setSpaceMode] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [blackHoleReached, setBlackHoleReached] = useState(false);
  const [finaleStarted, setFinaleStarted] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    setActiveTier(1);
    setJourney(null);
    setSpaceMode(false);
    setIntroComplete(false);
    setBlackHoleReached(false);
    setFinaleStarted(false);

    timers.push(window.setTimeout(() => setIntroComplete(true), escalationStartMs));

    let cursor = escalationStartMs;
    let journeyId = 0;

    for (let targetTier = 2; targetTier <= finalTier; targetTier += 1) {
      const durationMs = stepDurationsMs[targetTier - 1] ?? 4000;
      const fromTier = targetTier - 1;
      const thisJourneyId = ++journeyId;

      timers.push(window.setTimeout(() => {
        setSpaceMode(true);
        setJourney({ id: thisJourneyId, fromTier, toTier: targetTier, durationMs, toBlackHole: false });
      }, cursor));

      cursor += durationMs;
      timers.push(window.setTimeout(() => {
        setActiveTier(targetTier);
        setJourney(null);
      }, cursor));
      cursor += arrivalHoldMs;
    }

    if (blackHole) {
      const thisJourneyId = ++journeyId;
      timers.push(window.setTimeout(() => {
        setSpaceMode(true);
        setJourney({ id: thisJourneyId, fromTier: finalTier, toTier: finalTier, durationMs: blackHoleTravelMs, toBlackHole: true });
      }, cursor));
      cursor += blackHoleTravelMs;
      timers.push(window.setTimeout(() => {
        setJourney(null);
        setBlackHoleReached(true);
      }, cursor));
    }

    timers.push(window.setTimeout(() => setFinaleStarted(true), collapseAtMs));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [arrivalHoldMs, blackHole, blackHoleTravelMs, collapseAtMs, escalationStartMs, finalTier, stepDurationsMs]);

  const activeGrade = GRADES[activeTier - 1];
  const destinationGrade = journey ? GRADES[journey.toTier - 1] : activeGrade;
  const introDurationMs = Math.max(900, escalationStartMs - 260);
  const worldFinal = finalTier === 1 && !blackHole && finaleStarted;
  const settledFinal = spaceMode && !journey && !blackHole && activeTier === finalTier && finaleStarted;

  const sceneStyle = useMemo(() => ({
    ...gradeVariables(activeGrade, activeTier),
    "--intro-duration": `${introDurationMs}ms`,
    "--collapse-duration": `${Math.max(720, cardRevealAtMs - collapseAtMs)}ms`,
    "--scene-clear-at": `${cardRevealAtMs}ms`,
  } as CSSProperties), [activeGrade, activeTier, cardRevealAtMs, collapseAtMs, introDurationMs]);

  const journeyStyle = journey ? ({
    ...gradeVariables(destinationGrade, journey.toTier),
    "--travel-duration": `${journey.durationMs}ms`,
    "--departure-accent": GRADES[journey.fromTier - 1].accent,
    "--departure-glow": GRADES[journey.fromTier - 1].glow,
  } as CSSProperties) : undefined;

  return (
    <div className={styles.scene} data-tier={activeTier} data-space-mode={spaceMode ? "true" : "false"} data-traveling={journey ? "true" : "false"} data-black-hole={blackHole ? "true" : "false"} data-low-effects={lowEffects ? "true" : "false"} data-cosmic={cosmic ? "true" : "false"} style={sceneStyle} aria-hidden="true">
      <div className={styles.deepSpaceBackdrop} />
      <div className={styles.depthStarField}>
        {DEPTH_STARS.map((index) => (
          <i key={index} style={{
            "--star-x": `${5 + ((index * 37) % 90)}%`,
            "--star-y": `${4 + ((index * 53) % 90)}%`,
            "--star-size": `${1 + (index % 3) * 0.65}px`,
            "--star-delay": `${index * -127}ms`,
          } as CSSProperties} />
        ))}
      </div>

      <div className={styles.world} data-gone={spaceMode ? "true" : "false"}>
        <div className={styles.worldSky} />
        <div className={styles.worldStars} />
        <div className={styles.worldSun} data-final={worldFinal ? "true" : "false"}>
          <BurningStar grade={GRADES[0]} tier={1} final={worldFinal} />
        </div>
        <img src="/ancient-pulls/scene/distant-mountains-village-v1.webp" alt="" draggable={false} className={styles.horizon} />
        <div className={styles.sandGround} />
        <div className={styles.walkStage}>
          {cosmic ? <div className={styles.cosmicFlightTrail}><span /><span /><span /></div> : null}
          <NebuPerformanceSprite sheet={walkSheet} durationMs={introDurationMs} delayMs={180} columns={walkColumns} rows={walkRows} className={styles.walkSprite} />
        </div>
        <div className={styles.pyramidWrap}>
          <img src="/ancient-pulls/scene/pyramid-right-v1.webp" alt="" draggable={false} className={styles.pyramid} />
        </div>
        <div className={styles.reactionStage} data-visible={introComplete ? "true" : "false"}>
          <NebuPerformanceSprite sheet={reactionSheet} durationMs={1000} staticFrame={cosmic ? 0 : 1} columns={reactionColumns} rows={reactionRows} className={styles.reactionSprite} />
        </div>
      </div>

      {spaceMode && !journey && !blackHoleReached ? (
        <div className={styles.settledDestination} style={gradeVariables(activeGrade, activeTier)}>
          <div className={styles.settledStar}><BurningStar grade={activeGrade} tier={activeTier} final={settledFinal} /></div>
          <div className={styles.arrivalBloom} />
        </div>
      ) : null}

      {journey ? (
        <div key={`journey-${journey.id}`} className={styles.spaceJourney} data-to-black-hole={journey.toBlackHole ? "true" : "false"} style={journeyStyle}>
          <div className={styles.warpTunnel} />
          <div className={styles.departureStar} />
          <div className={styles.starStreaks}>
            {STREAKS.map((index) => {
              const angle = (index * 137.508) % 360;
              const radius = 7 + ((index * 17) % 39);
              return <i key={index} style={{
                "--streak-angle": `${angle}deg`,
                "--streak-radius": `${radius}vmin`,
                "--streak-length": `${34 + (index % 7) * 18}px`,
                "--streak-width": `${1 + (index % 3) * 0.55}px`,
                "--streak-delay": `${(index % 9) * -83}ms`,
              } as CSSProperties} />;
            })}
          </div>
          <div className={styles.destination}>
            {journey.toBlackHole ? (
              <div className={styles.approachingBlackHole}>
                <span className={styles.blackHoleDisc} /><span className={styles.blackHoleAccretion} /><span className={styles.blackHoleLens} />
              </div>
            ) : <BurningStar grade={destinationGrade} tier={journey.toTier} />}
          </div>
          <div className={styles.travelVignette} />
        </div>
      ) : null}

      {blackHoleReached ? (
        <div className={styles.eventHorizon} data-final={finaleStarted ? "true" : "false"} style={gradeVariables(GRADES[8], 9)}>
          <span className={styles.blackHoleDisc} /><span className={styles.blackHoleAccretion} /><span className={styles.blackHoleLens} />
          <div className={styles.goldenGlimmer}><span /></div>
        </div>
      ) : null}

      {introComplete && !journey && !blackHoleReached && !finaleStarted ? (
        <div key={`caption-${activeTier}`} className={styles.rarityCaption}><span>{activeGrade.name}</span><strong>{activeGrade.label}</strong></div>
      ) : null}
      {finaleStarted && !blackHole ? <div className={styles.supernovaSkyBloom} /> : null}
    </div>
  );
}
