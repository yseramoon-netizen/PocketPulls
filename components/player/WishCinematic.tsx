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

function buildEscalationSteps(config: WishRevealConfig): readonly number[] {
  const available = Math.max(450, config.timings.cardAtMs - 620);
  const step = Math.max(150, Math.floor(available / config.tier));
  return Array.from({ length: 9 }, () => step);
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
  const nebuHeatAssets = useMemo(() => getNebuHeatAssets(nebuSkin), [nebuSkin]);
  const cosmicNebu = nebuSkin === "cosmic_nebu";
  const lowEffects = preferences.lowVisualEffects || preferences.dataSaver;
  const particleCount = getWishRevealParticleCount(config, {
    mobile: mobileEffects,
    lowEffects,
  });
  const escalationSteps = useMemo(() => buildEscalationSteps(config), [config]);
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
      }, config.timings.durationMs);
    };

    const preloadSources = [
      card.imageUrl,
      ...(config.usesWorldScene && !lowEffects
        ? [...WORLD_SPRITES, nebuHeatAssets.walkSheet, nebuHeatAssets.reactionSheet]
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
    lowEffects,
    nebuHeatAssets.reactionSheet,
    nebuHeatAssets.walkSheet,
    open,
    reportFinished,
    revealFromPreferences,
    stopAudio,
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
            impactAtMs: config.timings.impactAtMs,
            revealAtMs: config.timings.cardAtMs,
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
  }, [config, muted, open, preferences.sfxVolume, ready, runNumber, skipped, stopAudio]);

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
    "--impact-at": `${config.timings.impactAtMs}ms`,
    "--card-at": `${config.timings.cardAtMs}ms`,
    "--info-at": `${config.timings.infoAtMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={styles.overlay}
      style={rootStyle}
      data-tier={config.tier}
      data-family={config.family}
      data-low-effects={lowEffects ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label={`Wish reveal for ${card.name}`}
    >
      <div className={styles.sky} />
      <div className={styles.stars} />
      <div className={styles.ancientCardGhost} />
      <div className={styles.holoDust} />
      <div className={styles.ancientGlyphBandTop} />
      <div className={styles.ancientGlyphBandBottom} />
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
          <img src={nebuHeatAssets.portrait} alt={cosmicNebu ? "Cosmic Nebu" : "Nebu"} draggable={false} className={styles.preparingNebu} />
          <p>{cosmicNebu ? "Cosmic Nebu is bending the constellation..." : "Nebu is reading the constellation..."}</p>
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
                escalationStartMs={520}
                stepDurationsMs={escalationSteps}
                cardRevealAtMs={config.timings.cardAtMs}
                walkSheet={nebuHeatAssets.walkSheet}
                reactionSheet={nebuHeatAssets.reactionSheet}
                walkColumns={nebuHeatAssets.walkColumns}
                walkRows={nebuHeatAssets.walkRows}
                reactionColumns={nebuHeatAssets.reactionColumns}
                reactionRows={nebuHeatAssets.reactionRows}
                cosmic={cosmicNebu}
                blackHole={config.blackHole}
                lowEffects={lowEffects}
              />
            </div>
          ) : null}

          <div className={styles.darkening} />
          <p className={styles.omen}>{config.omen}</p>

          <div className={styles.relicSeal} aria-hidden="true">
            <span className={styles.relicOuter} />
            <span className={styles.relicInner} />
            <span className={styles.relicStar}>✦</span>
          </div>

          {config.glyphCount > 0 ? (
            <div className={styles.glyphOrbit} aria-hidden="true">
              {Array.from({ length: config.glyphCount }, (_, index) => (
                <span
                  key={index}
                  style={{ "--glyph-angle": `${(360 / config.glyphCount) * index}deg`, "--glyph-counter-angle": `${(-360 / config.glyphCount) * index}deg`, "--glyph-delay": `${(index % 6) * 70}ms` } as CSSProperties}
                >
                  {index % 3 === 0 ? "◇" : index % 3 === 1 ? "✦" : "⌁"}
                </span>
              ))}
            </div>
          ) : null}

          <div className={styles.cardSilhouette} aria-hidden="true"><span>✦</span></div>

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

          <div className={styles.cardScene} data-share-ready="true">
            <div className={styles.cardGlow} />
            <div className={styles.cardFrame}>
              {card.imageUrl ? <img src={card.imageUrl} alt={card.name} draggable={false} /> : <div className={styles.cardFallback}><span>✦</span><strong>{card.name}</strong></div>}
              <div className={styles.cardShine} />
              {config.tier >= 5 ? <div className={styles.premiumCardShine} /> : null}
            </div>
          </div>

          <div className={styles.cardInfo} data-share-ready="true">
            {cosmicIssueNumber ? (
              <div className={styles.cosmicDiscoveryBadge}>
                <span>✦ Permanent legendary form discovered</span>
                <strong>COSMIC NEBU #{String(cosmicIssueNumber).padStart(6, "0")}</strong>
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
