"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { publishPlayerPreferences } from "@/lib/player/preferences";
import {
  getWishRevealConfig,
  getWishRevealParticleCount,
  type WishRevealConfig,
} from "@/lib/player/wish-reveal";
import {
  DEFAULT_NEBU_SKIN,
  getNebuHeatAssets,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  readNebuSkin,
  type NebuSkinKey,
} from "@/lib/player/nebu";
import { supabase } from "@/lib/supabase";

import AncientCatPullScene from "./AncientCatPullScene";
import AsterismSigil from "./AsterismSigil";
import {
  primeWishAudio,
  startWishAudio,
  type WishAudioSession,
} from "./wishAudio";
import usePlayerPreferences from "./usePlayerPreferences";
import styles from "./WishCinematic.module.css";

export type WishRevealCard = {
  id?: string | number;
  name: string;
  rarity?: string | null;
  imageUrl?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  marketValue?: number | null;
};

type WishCinematicProps = {
  open: boolean;
  card: WishRevealCard | null;
  onClose: () => void;
  onFinished?: () => void;
  onWishAgain?: () => void;
  canWishAgain?: boolean;
  busy?: boolean;
  actionError?: string | null;
  allowSkip?: boolean;
  forceFullSequence?: boolean;
  respectPreferences?: boolean;
  cosmicIssueNumber?: number | null;
  cosmicBinderIssueNumber?: number | null;
  cosmicSourceSkin?: NebuSkinKey | null;
};

const IMAGE_PRELOAD_TIMEOUT_MS = 2600;
const WORLD_SPRITES = [
  "/ancient-pulls/scene/pyramid-right-v1.webp",
  "/ancient-pulls/scene/distant-mountains-village-v1.webp",
] as const;

// Kept as a public compatibility helper for the existing cinematic laboratory.
export function getWishRarityTheme(
  rarity: string | null | undefined,
): WishRevealConfig {
  return getWishRevealConfig(rarity);
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "Price pending";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(value) || 0));
}

type WishRevealTimeline = {
  escalationStartMs: number;
  stepDurationsMs: readonly number[];
  travelDurationsMs: readonly number[];
  blackHoleTravelStartMs: number | null;
  blackHoleTravelDurationMs: number;
  cosmicTransformAtMs: number | null;
  collapseAtMs: number;
  impactAtMs: number;
  cardAtMs: number;
  infoAtMs: number;
  durationMs: number;
};

const SUN_RISE_DELAY_MS = 260;
const SUN_RISE_DURATION_MS = 2000;
const SUPERNOVA_DURATION_MS = 1500;
const BLACK_HOLE_TRAVEL_DURATION_MS = 5000;
const COSMIC_TRANSFORMATION_HOLD_MS = 6500;
const WORLD_RARITY_STAGE_DURATIONS_MS = [
  2000,
  3000,
  4000,
  4000,
  4000,
  4000,
  4000,
  4000,
  4000,
] as const;

function buildWorldTravelDurations(
  stepDurationsMs: readonly number[],
): readonly number[] {
  return stepDurationsMs.map((duration, index) => {
    if (index === 0) return 0;
    const nextTier = index + 1;
    const travelShare = Math.min(0.81, 0.6 + (nextTier - 2) * 0.03);
    return Math.max(1200, Math.round(duration * travelShare));
  });
}

function buildLegacyEscalationSteps(config: WishRevealConfig): readonly number[] {
  const available = Math.max(450, config.timings.cardAtMs - 620);
  const step = Math.max(150, Math.floor(available / config.tier));
  return Array.from({ length: 9 }, () => step);
}

function buildRevealTimeline(
  config: WishRevealConfig,
  cosmicDiscovery: boolean,
): WishRevealTimeline {
  if (!config.usesWorldScene) {
    return {
      escalationStartMs: 520,
      stepDurationsMs: buildLegacyEscalationSteps(config),
      travelDurationsMs: [],
      blackHoleTravelStartMs: null,
      blackHoleTravelDurationMs: BLACK_HOLE_TRAVEL_DURATION_MS,
      cosmicTransformAtMs: null,
      collapseAtMs: Math.max(0, config.timings.cardAtMs - 680),
      impactAtMs: config.timings.impactAtMs,
      cardAtMs: config.timings.cardAtMs,
      infoAtMs: config.timings.infoAtMs,
      durationMs: config.timings.durationMs,
    };
  }

  const escalationStartMs = SUN_RISE_DELAY_MS + SUN_RISE_DURATION_MS;
  const travelDurationsMs = buildWorldTravelDurations(
    WORLD_RARITY_STAGE_DURATIONS_MS,
  );
  if (cosmicDiscovery) {
    const cosmicTransformAtMs = escalationStartMs + 3920;
    const cardAtMs = escalationStartMs + COSMIC_TRANSFORMATION_HOLD_MS;
    const infoAtMs = cardAtMs + 720;

    return {
      escalationStartMs,
      stepDurationsMs: WORLD_RARITY_STAGE_DURATIONS_MS,
      travelDurationsMs,
      blackHoleTravelStartMs: null,
      blackHoleTravelDurationMs: BLACK_HOLE_TRAVEL_DURATION_MS,
      cosmicTransformAtMs,
      collapseAtMs: cosmicTransformAtMs,
      impactAtMs: cosmicTransformAtMs + 820,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1180,
    };
  }

  const finalRarityCompletedAtMs =
    escalationStartMs +
    WORLD_RARITY_STAGE_DURATIONS_MS
      .slice(0, config.tier)
      .reduce((total, duration) => total + duration, 0);

  if (config.blackHole) {
    const blackHoleTravelStartMs = finalRarityCompletedAtMs;
    const blackHoleArrivalAtMs = blackHoleTravelStartMs + BLACK_HOLE_TRAVEL_DURATION_MS;
    const collapseAtMs = blackHoleArrivalAtMs + 860;
    const cardAtMs = collapseAtMs + SUPERNOVA_DURATION_MS;
    const infoAtMs = cardAtMs + 720;

    return {
      escalationStartMs,
      stepDurationsMs: WORLD_RARITY_STAGE_DURATIONS_MS,
      travelDurationsMs,
      blackHoleTravelStartMs,
      blackHoleTravelDurationMs: BLACK_HOLE_TRAVEL_DURATION_MS,
      cosmicTransformAtMs: null,
      collapseAtMs,
      impactAtMs: collapseAtMs + Math.round(SUPERNOVA_DURATION_MS * 0.48),
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1180,
    };
  }

  const collapseAtMs = finalRarityCompletedAtMs + 720;
  const cardAtMs = collapseAtMs + SUPERNOVA_DURATION_MS;
  const infoAtMs = cardAtMs + 560;

  return {
    escalationStartMs,
    stepDurationsMs: WORLD_RARITY_STAGE_DURATIONS_MS,
    travelDurationsMs,
    blackHoleTravelStartMs: null,
    blackHoleTravelDurationMs: BLACK_HOLE_TRAVEL_DURATION_MS,
    cosmicTransformAtMs: null,
    collapseAtMs,
    impactAtMs: collapseAtMs + Math.round(SUPERNOVA_DURATION_MS * 0.48),
    cardAtMs,
    infoAtMs,
    durationMs: infoAtMs + 960,
  };
}

export default function WishCinematic({
  open,
  card,
  onClose,
  onFinished,
  onWishAgain,
  canWishAgain = false,
  busy = false,
  actionError = null,
  allowSkip = true,
  forceFullSequence = false,
  respectPreferences = true,
  cosmicIssueNumber = null,
  cosmicBinderIssueNumber = null,
  cosmicSourceSkin = null,
}: WishCinematicProps) {
  const preloadTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const skipRequestedRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const audioSessionRef = useRef<WishAudioSession | null>(null);
  const markedSeenRef = useRef(false);
  const preferences = usePlayerPreferences();

  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [mobileEffects, setMobileEffects] = useState(false);
  const [runNumber, setRunNumber] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nebuSkin, setNebuSkin] = useState<NebuSkinKey>(DEFAULT_NEBU_SKIN);

  const config = useMemo(
    () => getWishRevealConfig(card?.rarity, card?.marketValue),
    [card?.marketValue, card?.rarity],
  );
  const cosmicDiscovery = Boolean(cosmicIssueNumber);
  const cosmicBinderDiscovery = Boolean(cosmicBinderIssueNumber);
  const timeline = useMemo(
    () => buildRevealTimeline(config, cosmicDiscovery),
    [config, cosmicDiscovery],
  );
  const audioTravelWindows = useMemo(() => {
    if (cosmicDiscovery) return [];

    const windows = Array.from(
      { length: Math.max(0, config.tier - 1) },
      (_, index) => {
        const nextTier = index + 2;
        return {
          startAtMs: timeline.escalationStartMs + timeline.stepDurationsMs
            .slice(0, nextTier - 1)
            .reduce((total, duration) => total + duration, 0),
          durationMs: timeline.travelDurationsMs[nextTier - 1] ?? 1800,
          intensity: nextTier,
        };
      },
    );

    if (timeline.blackHoleTravelStartMs !== null) {
      windows.push({
        startAtMs: timeline.blackHoleTravelStartMs,
        durationMs: timeline.blackHoleTravelDurationMs,
        intensity: 9,
      });
    }

    return windows;
  }, [config.tier, cosmicDiscovery, timeline]);
  const sceneNebuSkin = cosmicDiscovery
    ? cosmicSourceSkin || (nebuSkin === "cosmic_nebu" ? DEFAULT_NEBU_SKIN : nebuSkin)
    : nebuSkin;
  const nebuHeatAssets = useMemo(
    () => getNebuHeatAssets(sceneNebuSkin),
    [sceneNebuSkin],
  );
  const cosmicHeatAssets = useMemo(
    () => getNebuHeatAssets("cosmic_nebu"),
    [],
  );
  const equippedCosmicNebu = !cosmicDiscovery && nebuSkin === "cosmic_nebu";
  const cosmicMode = equippedCosmicNebu || cosmicDiscovery;
  const lowEffects = preferences.lowVisualEffects || preferences.dataSaver;
  const particleCount = getWishRevealParticleCount(config, {
    mobile: mobileEffects,
    lowEffects,
  });
  const isolatedSunSequence = config.usesWorldScene;
  const revealFromPreferences =
    respectPreferences &&
    (preferences.reducedMotion ||
      (!forceFullSequence &&
        (preferences.dataSaver ||
          (preferences.skipPullCinematic && preferences.cinematicSeen))));

  const cardKey = useMemo(() => {
    if (!card) return "";
    return [card.id ?? "", card.name, card.rarity ?? "", card.imageUrl ?? "", card.marketValue ?? ""].join("|");
  }, [card]);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const sync = () => setMobileEffects(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pocketpulls:wish-cinematic-visibility", { detail: { open } }));
    return () => {
      if (open) {
        window.dispatchEvent(new CustomEvent("pocketpulls:wish-cinematic-visibility", { detail: { open: false } }));
      }
    };
  }, [open]);

  useEffect(() => {
    const syncSkin = () => setNebuSkin(readNebuSkin());
    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;
      if (isNebuSkinKey(key)) setNebuSkin(key);
    };
    syncSkin();
    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    return () => window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
  }, []);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem("pocketpulls-wish-muted") === "true");
    } catch {
      // Browser storage is optional.
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (preloadTimerRef.current !== null) window.clearTimeout(preloadTimerRef.current);
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    preloadTimerRef.current = null;
    completionTimerRef.current = null;
  }, []);

  const reportFinished = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishedRef.current?.();
  }, []);

  const revealImmediately = useCallback(() => {
    skipRequestedRef.current = true;
    clearTimers();
    stopAudio();
    setReady(true);
    setSkipped(true);
    setComplete(true);
    reportFinished();
  }, [clearTimers, reportFinished, stopAudio]);

  const handleContinue = useCallback(() => {
    stopAudio();
    window.dispatchEvent(new Event("pocketpulls:wish-cinematic-continued"));
    onClose();
  }, [onClose, stopAudio]);

  useEffect(() => {
    if (!open || !card) {
      clearTimers();
      stopAudio();
      finishedRef.current = false;
      setReady(false);
      setComplete(false);
      setSkipped(false);
      skipRequestedRef.current = false;
      markedSeenRef.current = false;
      return;
    }

    let active = true;
    let started = false;
    clearTimers();
    stopAudio();
    finishedRef.current = false;
    setReady(false);
    setComplete(false);
    setSkipped(false);
    skipRequestedRef.current = false;

    if (revealFromPreferences) {
      setReady(true);
      setSkipped(true);
      setComplete(true);
      reportFinished();
      return () => {
        active = false;
        clearTimers();
        stopAudio();
      };
    }

    const startSequence = () => {
      if (!active || started || skipRequestedRef.current) return;
      started = true;
      setRunNumber((current) => current + 1);
      setReady(true);

      completionTimerRef.current = window.setTimeout(() => {
        setComplete(true);
        reportFinished();
      }, timeline.durationMs);
    };

    const preloadSources = [
      card.imageUrl,
      ...(config.usesWorldScene && !lowEffects
        ? [
            ...WORLD_SPRITES,
            nebuHeatAssets.walkSheet,
            nebuHeatAssets.reactionSheet,
            ...(cosmicDiscovery
              ? [cosmicHeatAssets.portrait, cosmicHeatAssets.reactionSheet]
              : []),
          ]
        : []),
    ].filter((source): source is string => Boolean(source));

    if (preloadSources.length === 0) {
      startSequence();
    } else {
      let remaining = preloadSources.length;
      const settled = () => {
        remaining -= 1;
        if (remaining <= 0) startSequence();
      };
      for (const source of preloadSources) {
        const image = new Image();
        image.onload = settled;
        image.onerror = settled;
        image.src = source;
      }
      preloadTimerRef.current = window.setTimeout(
        startSequence,
        config.tier <= 2 ? 420 : IMAGE_PRELOAD_TIMEOUT_MS,
      );
    }

    return () => {
      active = false;
      clearTimers();
      stopAudio();
    };
  }, [
    card,
    cardKey,
    clearTimers,
    config,
    cosmicDiscovery,
    cosmicHeatAssets.portrait,
    cosmicHeatAssets.reactionSheet,
    lowEffects,
    nebuHeatAssets.reactionSheet,
    nebuHeatAssets.walkSheet,
    open,
    reportFinished,
    revealFromPreferences,
    stopAudio,
    timeline.durationMs,
  ]);

  useEffect(() => {
    if (!open || !ready || skipped) return;
    let cancelled = false;

    void primeWishAudio()
      .then(() => {
        if (cancelled) return;
        stopAudio();
        audioSessionRef.current = startWishAudio(
          config.tier,
          muted,
          preferences.sfxVolume,
          {
            impactAtMs: timeline.impactAtMs,
            revealAtMs: timeline.cardAtMs,
            mode: cosmicDiscovery ? "cosmic" : "journey",
            travelWindows: audioTravelWindows,
          },
        );
      })
      .catch(() => {
        // The visual reveal remains fully usable when Web Audio is unavailable.
      });

    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [audioTravelWindows, config, cosmicDiscovery, muted, open, preferences.sfxVolume, ready, runNumber, skipped, stopAudio, timeline.cardAtMs, timeline.impactAtMs]);

  useEffect(() => {
    audioSessionRef.current?.setMuted(muted);
    audioSessionRef.current?.setVolume(preferences.sfxVolume);
    try {
      window.localStorage.setItem("pocketpulls-wish-muted", String(muted));
    } catch {
      // Browser storage is optional.
    }
  }, [muted, preferences.sfxVolume]);

  useEffect(() => {
    if (!open || !complete || !respectPreferences || markedSeenRef.current || preferences.cinematicSeen) return;
    markedSeenRef.current = true;
    publishPlayerPreferences({ ...preferences, cinematicSeen: true });
    void supabase.rpc("mark_player_cinematic_seen").then(({ error }) => {
      if (error) console.warn("Cinematic viewing could not sync:", error.message);
    });
  }, [complete, open, preferences, respectPreferences]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (complete) handleContinue();
      else if (allowSkip) revealImmediately();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [allowSkip, complete, handleContinue, open, revealImmediately]);

  if (!open || !card) return null;

  const rootStyle = {
    "--wish-primary": config.primary,
    "--wish-secondary": config.secondary,
    "--wish-glow": config.glow,
    "--impact-scale": String(config.impactScale),
    "--shake-distance": `${config.shakeDistance}px`,
    "--flash-strength": String(config.flashStrength),
    "--tier": String(config.tier),
    "--collapse-at": `${timeline.collapseAtMs}ms`,
    "--collapse-duration": `${Math.max(1, timeline.cardAtMs - timeline.collapseAtMs)}ms`,
    "--impact-at": `${timeline.impactAtMs}ms`,
    "--card-at": `${timeline.cardAtMs}ms`,
    "--info-at": `${timeline.infoAtMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={styles.overlay}
      style={rootStyle}
      data-tier={config.tier}
      data-family={config.family}
      data-sun-sequence={isolatedSunSequence ? "true" : "false"}
      data-cosmic-discovery={cosmicDiscovery ? "true" : "false"}
      data-cosmic-binder-discovery={cosmicBinderDiscovery ? "true" : "false"}
      data-cosmic-mode={cosmicMode ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label={`Wish reveal for ${card.name}`}
    >
      <div className={styles.sky} />
      <div className={styles.stars} />
      <div className={styles.ancientCardGhost} />
      <div className={styles.holoDust} />
      <div className={styles.asterismRailTop} aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => <span key={index} />)}
      </div>
      <div className={styles.asterismRailBottom} aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => <span key={index} />)}
      </div>
      <div className={styles.ancientFrame} />
      <div className={styles.vignette} />

      <button
        type="button"
        className={styles.soundButton}
        onClick={() => {
          void primeWishAudio();
          setMuted((current) => !current);
        }}
        aria-label={muted ? "Turn wish sound on" : "Mute wish sound"}
      >
        {muted ? "Sound Off" : "Sound On"}
      </button>

      {!ready ? (
        <div className={styles.preparing}>
          <div className={styles.preparingGlow} />
          <img src={nebuHeatAssets.portrait} alt={equippedCosmicNebu ? "Cosmic Nebu" : "Nebu"} draggable={false} className={styles.preparingNebu} />
          <p>{cosmicDiscovery ? "The sky has chosen Nebu..." : equippedCosmicNebu ? "Cosmic Nebu is bending the constellation..." : "Nebu is reading the constellation..."}</p>
        </div>
      ) : (
        <div
          key={runNumber}
          className={`${styles.sequence} ${skipped ? styles.sequenceSkipped : ""} ${config.blackHole ? styles.blackHoleSequence : ""}`}
        >
          {config.usesWorldScene && !skipped ? (
            <div className={styles.catScene}>
              <AncientCatPullScene
                tier={config.tier}
                escalationStartMs={timeline.escalationStartMs}
                stepDurationsMs={timeline.stepDurationsMs}
                travelDurationsMs={timeline.travelDurationsMs}
                collapseAtMs={timeline.collapseAtMs}
                cardRevealAtMs={timeline.cardAtMs}
                walkSheet={nebuHeatAssets.walkSheet}
                reactionSheet={nebuHeatAssets.reactionSheet}
                walkColumns={nebuHeatAssets.walkColumns}
                walkRows={nebuHeatAssets.walkRows}
                reactionColumns={nebuHeatAssets.reactionColumns}
                reactionRows={nebuHeatAssets.reactionRows}
                cosmic={equippedCosmicNebu}
                cosmicDiscovery={cosmicDiscovery}
                cosmicReactionSheet={cosmicHeatAssets.reactionSheet}
                cosmicReactionColumns={cosmicHeatAssets.reactionColumns}
                cosmicReactionRows={cosmicHeatAssets.reactionRows}
                cosmicTransformAtMs={timeline.cosmicTransformAtMs}
                blackHole={config.blackHole}
                blackHoleTravelStartMs={timeline.blackHoleTravelStartMs}
                blackHoleTravelDurationMs={timeline.blackHoleTravelDurationMs}
                lowEffects={lowEffects}
              />
            </div>
          ) : null}

          <div className={styles.darkening} />
          {!isolatedSunSequence ? <p className={styles.omen}>{config.omen}</p> : null}

          {!isolatedSunSequence && config.glyphCount > 0 ? (
            <div className={styles.asterismOrbit} aria-hidden="true">
              <AsterismSigil seed={cardKey} points={Math.min(9, Math.max(5, config.glyphCount))} />
            </div>
          ) : null}

          {!isolatedSunSequence ? (
            <div className={styles.cardSilhouette} aria-hidden="true">
              <AsterismSigil seed={`${cardKey}:silhouette`} points={7} />
            </div>
          ) : null}

          {cosmicMode && !skipped ? (
            <div className={styles.cosmicRift} aria-hidden="true">
              <span className={styles.cosmicRiftOuter} />
              <span className={styles.cosmicRiftInner} />
              <AsterismSigil seed={`${cardKey}:cosmic-rift`} points={9} className={styles.cosmicRiftSigil} />
              <span className={styles.cosmicRiftCore} />
              <span className={styles.cosmicComets}><i /><i /><i /></span>
            </div>
          ) : null}

          {cosmicBinderIssueNumber ? (
            <div className={styles.cosmicBinderArtifact} aria-hidden="true">
              <div className={styles.cosmicBinderCover}>
                <AsterismSigil
                  seed={`${cardKey}:cosmic-binder`}
                  points={9}
                  className={styles.cosmicBinderSigil}
                />
                <span className={styles.cosmicBinderSpine} />
                <span className={styles.cosmicBinderClasp} />
              </div>
            </div>
          ) : null}

          {!cosmicDiscovery ? (
            <div className={styles.impact} aria-hidden="true">
              <div className={styles.impactFlash} />
              <div className={styles.impactRing} />
              <div className={styles.impactRingSecond} />
              {config.tier >= 5 ? <div className={styles.impactRingThird} /> : null}
              <div className={styles.impactRays}>
                {Array.from({ length: config.rayCount }, (_, index) => (
                  <span key={index} style={{ "--ray-angle": `${(360 / config.rayCount) * index}deg`, "--ray-length": `${65 + config.tier * 10 + (index % 6) * 13}px`, "--ray-delay": `${(index % 5) * 10}ms` } as CSSProperties} />
                ))}
              </div>
              <div className={styles.particles}>
                {Array.from({ length: particleCount }, (_, index) => (
                  <span key={index} style={{ "--particle-angle": `${(360 / particleCount) * index}deg`, "--particle-distance": `${84 + config.tier * 10 + (index % 8) * 17}px`, "--particle-delay": `${(index % 7) * 12}ms`, "--particle-size": `${2 + config.tier * 0.16 + (index % 4)}px` } as CSSProperties} />
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.cardScene} data-share-ready="true">
            <div className={styles.cardGlow} />
            <div className={styles.cardFrame}>
              {card.imageUrl ? <img src={card.imageUrl} alt={card.name} draggable={false} /> : <div className={styles.cardFallback}><span>✦</span><strong>{card.name}</strong></div>}
              <div className={styles.cardShine} />
              {config.tier >= 5 ? <div className={styles.premiumCardShine} /> : null}
            </div>
          </div>

          <div className={styles.cardInfo} data-share-ready="true">
            {cosmicIssueNumber || cosmicBinderIssueNumber ? (
              <div className={styles.legendaryDiscoveries}>
                {cosmicIssueNumber ? (
                  <div className={styles.cosmicDiscoveryBadge}>
                    <span>✦ Permanent legendary form discovered</span>
                    <strong>COSMIC NEBU #{String(cosmicIssueNumber).padStart(6, "0")}</strong>
                  </div>
                ) : null}
                {cosmicBinderIssueNumber ? (
                  <div className={styles.cosmicBinderDiscoveryBadge}>
                    <span>✦ Independent 1 in 50,000 discovery</span>
                    <strong>COSMIC BINDER #{String(cosmicBinderIssueNumber).padStart(6, "0")}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className={styles.rarity}>{config.label}</p>
            <h2>{card.name}</h2>
            <p className={styles.meta}>{[card.setName, card.cardNumber ? `#${card.cardNumber}` : null].filter(Boolean).join(" · ")}</p>
            <div className={styles.pills}><span>{card.rarity || config.label}</span><span>{formatMoney(card.marketValue)}</span></div>
            {actionError ? <div className={styles.actionError}>{actionError}</div> : null}
            <div className={styles.actions}>
              {onWishAgain && canWishAgain ? <button type="button" onClick={onWishAgain} disabled={!complete || busy} className={styles.wishAgainButton}>{busy ? "Choosing next card..." : "Wish Again · 1 Wish"}</button> : null}
              <button type="button" onClick={handleContinue} disabled={!complete || busy} className={styles.keepButton}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {allowSkip && !complete ? (
        <button type="button" className={styles.skipButton} onClick={revealImmediately}>Reveal now</button>
      ) : null}
    </div>
  );
}
