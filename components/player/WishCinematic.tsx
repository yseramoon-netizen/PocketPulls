"use client";

/* eslint-disable @next/next/no-img-element -- Timed cinematic art is explicitly preloaded and must not be wrapped or deferred. */

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

import AsterismSigil from "./AsterismSigil";
import { getNebuSummonSprite } from "./NebuWishSummon";
import StellarWishJourney from "./StellarWishJourney";
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
  stageMomentsMs: readonly number[];
  specialAtMs: number;
  cosmicTransformAtMs: number | null;
  binderFormAtMs: number | null;
  binderOpenAtMs: number | null;
  collapseAtMs: number;
  impactAtMs: number;
  cardAtMs: number;
  infoAtMs: number;
  durationMs: number;
};

const STELLAR_STAGE_MOMENTS_MS = [
  850,
  1900,
  3250,
  4850,
  6600,
  8350,
  10100,
  11850,
  13600,
] as const;

function buildRevealTimeline(
  config: WishRevealConfig,
  cosmicDiscovery: boolean,
  cosmicBinderDiscovery: boolean,
): WishRevealTimeline {
  if (!config.usesWorldScene) {
    const stageStep = Math.max(180, Math.floor(config.timings.impactAtMs / config.tier));
    return {
      stageMomentsMs: Array.from({ length: config.tier }, (_, index) => 240 + index * stageStep),
      specialAtMs: Math.max(300, config.timings.impactAtMs - 420),
      cosmicTransformAtMs: null,
      binderFormAtMs: null,
      binderOpenAtMs: null,
      collapseAtMs: Math.max(0, config.timings.cardAtMs - 680),
      impactAtMs: config.timings.impactAtMs,
      cardAtMs: config.timings.cardAtMs,
      infoAtMs: config.timings.infoAtMs,
      durationMs: config.timings.durationMs,
    };
  }

  const safeTier = Math.max(1, Math.min(9, Math.round(config.tier)));
  const stageMomentsMs = STELLAR_STAGE_MOMENTS_MS.slice(0, safeTier);
  const finalStageAtMs = stageMomentsMs[safeTier - 1] ?? 850;
  const specialAtMs = finalStageAtMs + 420;
  const dualDiscovery = cosmicDiscovery && cosmicBinderDiscovery;

  if (dualDiscovery) {
    const cosmicTransformAtMs = specialAtMs + 1180;
    const binderFormAtMs = specialAtMs + 2050;
    const binderOpenAtMs = specialAtMs + 3220;
    const collapseAtMs = binderOpenAtMs + 420;
    const impactAtMs = binderOpenAtMs + 760;
    const cardAtMs = binderOpenAtMs + 1260;
    const infoAtMs = cardAtMs + 900;

    return {
      stageMomentsMs,
      specialAtMs,
      cosmicTransformAtMs,
      binderFormAtMs,
      binderOpenAtMs,
      collapseAtMs,
      impactAtMs,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1750,
    };
  }

  if (cosmicDiscovery) {
    const cosmicTransformAtMs = specialAtMs + 1350;
    const collapseAtMs = cosmicTransformAtMs + 760;
    const impactAtMs = cosmicTransformAtMs + 1120;
    const cardAtMs = cosmicTransformAtMs + 1760;
    const infoAtMs = cardAtMs + 860;

    return {
      stageMomentsMs,
      specialAtMs,
      cosmicTransformAtMs,
      binderFormAtMs: null,
      binderOpenAtMs: null,
      collapseAtMs,
      impactAtMs,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1600,
    };
  }

  if (cosmicBinderDiscovery) {
    const binderFormAtMs = specialAtMs + 260;
    const binderOpenAtMs = specialAtMs + 1420;
    const collapseAtMs = binderOpenAtMs + 340;
    const impactAtMs = binderOpenAtMs + 680;
    const cardAtMs = binderOpenAtMs + 1120;
    const infoAtMs = cardAtMs + 820;

    return {
      stageMomentsMs,
      specialAtMs,
      cosmicTransformAtMs: null,
      binderFormAtMs,
      binderOpenAtMs,
      collapseAtMs,
      impactAtMs,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1450,
    };
  }

  if (config.blackHole) {
    const collapseAtMs = specialAtMs + 2600;
    const impactAtMs = specialAtMs + 3050;
    const cardAtMs = specialAtMs + 3650;
    const infoAtMs = cardAtMs + 820;

    return {
      stageMomentsMs,
      specialAtMs,
      cosmicTransformAtMs: null,
      binderFormAtMs: null,
      binderOpenAtMs: null,
      collapseAtMs,
      impactAtMs,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 1350,
    };
  }

  const collapseAtMs = specialAtMs + 620;
  const impactAtMs = specialAtMs + 980;
  const cardAtMs = specialAtMs + 1290;
  const infoAtMs = cardAtMs + 620;

  return {
    stageMomentsMs,
    specialAtMs,
    cosmicTransformAtMs: null,
    binderFormAtMs: null,
    binderOpenAtMs: null,
    collapseAtMs,
    impactAtMs,
    cardAtMs,
    infoAtMs,
    durationMs: infoAtMs + 1150,
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
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("pocketpulls-wish-muted") === "true";
    } catch {
      return false;
    }
  });
  const [nebuSkin, setNebuSkin] = useState<NebuSkinKey>(DEFAULT_NEBU_SKIN);

  const config = useMemo(
    () => getWishRevealConfig(card?.rarity, card?.marketValue),
    [card?.marketValue, card?.rarity],
  );
  const cosmicDiscovery = Boolean(cosmicIssueNumber);
  const cosmicBinderDiscovery = Boolean(cosmicBinderIssueNumber);
  const dualDiscovery = cosmicDiscovery && cosmicBinderDiscovery;
  const timeline = useMemo(
    () => buildRevealTimeline(config, cosmicDiscovery, cosmicBinderDiscovery),
    [config, cosmicBinderDiscovery, cosmicDiscovery],
  );
  const audioTravelWindows = useMemo(() => {
    const windows = timeline.stageMomentsMs.slice(1).map((moment, index) => {
      const previous = timeline.stageMomentsMs[index] ?? 0;
      return {
        startAtMs: previous + 120,
        durationMs: Math.max(520, moment - previous - 220),
        intensity: index + 2,
      };
    });

    if (config.blackHole && !cosmicDiscovery && !cosmicBinderDiscovery) {
      windows.push({
        startAtMs: timeline.specialAtMs,
        durationMs: Math.max(800, timeline.collapseAtMs - timeline.specialAtMs - 180),
        intensity: 9,
      });
    }

    return windows;
  }, [config.blackHole, cosmicBinderDiscovery, cosmicDiscovery, timeline]);
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
  const preparingCopy = dualDiscovery
    ? "Nebu hears two impossible answers..."
    : cosmicDiscovery
      ? "The sky has chosen Nebu..."
      : cosmicBinderDiscovery
        ? "A sealed archive is answering..."
        : equippedCosmicNebu
          ? "Cosmic Nebu is bending the constellation..."
          : "Nebu is reading the constellation...";
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

  /* eslint-disable react-hooks/set-state-in-effect -- Opening a new card starts a fresh, externally keyed cinematic timeline. */
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
      ...(config.usesWorldScene
        ? [
            ...WORLD_SPRITES,
            getNebuSummonSprite(
              config.tier,
              config.blackHole && !cosmicDiscovery && !cosmicBinderDiscovery,
            ),
            nebuHeatAssets.portrait,
            ...(cosmicDiscovery || equippedCosmicNebu
              ? [cosmicHeatAssets.portrait]
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
    equippedCosmicNebu,
    nebuHeatAssets.portrait,
    open,
    reportFinished,
    revealFromPreferences,
    stopAudio,
    timeline.durationMs,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
            mode: dualDiscovery
              ? "convergence"
              : cosmicDiscovery
                ? "cosmic"
                : cosmicBinderDiscovery
                  ? "binder"
                  : "journey",
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
  }, [audioTravelWindows, config, cosmicBinderDiscovery, cosmicDiscovery, dualDiscovery, muted, open, preferences.sfxVolume, ready, runNumber, skipped, stopAudio, timeline.cardAtMs, timeline.impactAtMs]);

  useEffect(() => {
    if (!open || !ready || skipped || lowEffects || typeof navigator.vibrate !== "function") return;

    const pattern = dualDiscovery
      ? [34, 34, 56, 34, 110]
      : cosmicDiscovery
        ? [42, 42, 92]
        : cosmicBinderDiscovery
          ? [28, 32, 72]
          : config.tier >= 7
            ? [24, 26, 42]
            : config.tier >= 4
              ? [20, 24, 30]
              : [18];
    const timer = window.setTimeout(() => {
      navigator.vibrate(pattern);
    }, timeline.impactAtMs);

    return () => window.clearTimeout(timer);
  }, [config.tier, cosmicBinderDiscovery, cosmicDiscovery, dualDiscovery, lowEffects, open, ready, skipped, timeline.impactAtMs]);

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
      data-dual-discovery={dualDiscovery ? "true" : "false"}
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
          <p>{preparingCopy}</p>
        </div>
      ) : (
        <div
          key={runNumber}
          className={`${styles.sequence} ${skipped ? styles.sequenceSkipped : ""} ${config.blackHole ? styles.blackHoleSequence : ""}`}
        >
          {config.usesWorldScene && !skipped ? (
            <div className={styles.catScene}>
              <StellarWishJourney
                tier={config.tier}
                stageMomentsMs={timeline.stageMomentsMs}
                specialAtMs={timeline.specialAtMs}
                collapseAtMs={timeline.collapseAtMs}
                impactAtMs={timeline.impactAtMs}
                cardRevealAtMs={timeline.cardAtMs}
                cosmicTransformAtMs={timeline.cosmicTransformAtMs}
                binderFormAtMs={timeline.binderFormAtMs}
                binderOpenAtMs={timeline.binderOpenAtMs}
                cosmicNebuPortrait={cosmicHeatAssets.portrait}
                equippedCosmicNebu={equippedCosmicNebu}
                cosmicDiscovery={cosmicDiscovery}
                cosmicBinderDiscovery={cosmicBinderDiscovery}
                blackHole={config.blackHole && !cosmicDiscovery && !cosmicBinderDiscovery}
                lowEffects={lowEffects}
                seed={cardKey}
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

          {!config.usesWorldScene ? (
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
