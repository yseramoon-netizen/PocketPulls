"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  primeWishAudio,
  startWishAudio,
  type WishAudioSession,
} from "./wishAudio";
import usePlayerPreferences from "./usePlayerPreferences";
import { publishPlayerPreferences } from "@/lib/player/preferences";
import { supabase } from "@/lib/supabase";
import AncientCatPullScene from "./AncientCatPullScene";
import {
  DEFAULT_NEBU_SKIN,
  getNebuHeatAssets,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  readNebuSkin,
  type NebuSkinKey,
} from "@/lib/player/nebu";
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
};

type RarityTheme = {
  label: string;
  tier: number;
  primary: string;
  secondary: string;
  glow: string;
  particleCount: number;
  impactScale: number;
  shakeDistance: number;
  flashStrength: number;
  rayCount: number;
};

const IMAGE_PRELOAD_TIMEOUT_MS = 3500;
const ESCALATION_START_MS = 2600;
const RARITY_HOLD_MS = [
  2000,
  2000,
  3000,
  4000,
  4000,
  4000,
  4000,
  4000,
  4000,
] as const;
const BASE_SCENE_SPRITES = [
  "/ancient-pulls/scene/pyramid-right-v1.webp",
  "/ancient-pulls/scene/distant-mountains-village-v1.webp",
] as const;

function getRarityRevealOffset(tier: number): number {
  return RARITY_HOLD_MS.slice(0, Math.max(1, tier)).reduce(
    (total, duration) => total + duration,
    0,
  );
}

const THEMES: Record<string, RarityTheme> = {
  common: {
    label: "Common",
    tier: 1,
    primary: "#e2e8f0",
    secondary: "#94a3b8",
    glow: "rgba(226,232,240,0.76)",
    particleCount: 24,
    impactScale: 6.4,
    shakeDistance: 2,
    flashStrength: 0.72,
    rayCount: 12,
  },
  uncommon: {
    label: "Uncommon",
    tier: 2,
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.8)",
    particleCount: 28,
    impactScale: 7,
    shakeDistance: 3,
    flashStrength: 0.78,
    rayCount: 14,
  },
  rare: {
    label: "Rare",
    tier: 3,
    primary: "#7dd3fc",
    secondary: "#2563eb",
    glow: "rgba(125,211,252,0.84)",
    particleCount: 34,
    impactScale: 7.8,
    shakeDistance: 4,
    flashStrength: 0.84,
    rayCount: 17,
  },
  doubleRare: {
    label: "Double Rare",
    tier: 4,
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    glow: "rgba(196,181,253,0.88)",
    particleCount: 40,
    impactScale: 8.7,
    shakeDistance: 6,
    flashStrength: 0.9,
    rayCount: 20,
  },
  ultraRare: {
    label: "Ultra Rare",
    tier: 5,
    primary: "#fde68a",
    secondary: "#f59e0b",
    glow: "rgba(253,230,138,0.92)",
    particleCount: 48,
    impactScale: 9.7,
    shakeDistance: 8,
    flashStrength: 0.96,
    rayCount: 24,
  },
  illustrationRare: {
    label: "Illustration Rare",
    tier: 6,
    primary: "#f9a8d4",
    secondary: "#a855f7",
    glow: "rgba(249,168,212,0.92)",
    particleCount: 50,
    impactScale: 9.8,
    shakeDistance: 8,
    flashStrength: 0.96,
    rayCount: 25,
  },
  specialIllustrationRare: {
    label: "Special Illustration Rare",
    tier: 7,
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    glow: "rgba(103,232,249,0.96)",
    particleCount: 58,
    impactScale: 10.8,
    shakeDistance: 10,
    flashStrength: 1,
    rayCount: 29,
  },
  hyperRare: {
    label: "Hyper Rare",
    tier: 8,
    primary: "#fef08a",
    secondary: "#f59e0b",
    glow: "rgba(250,204,21,0.98)",
    particleCount: 66,
    impactScale: 11.8,
    shakeDistance: 12,
    flashStrength: 1,
    rayCount: 33,
  },
  crownRare: {
    label: "Crown Rare",
    tier: 9,
    primary: "#ffffff",
    secondary: "#fef08a",
    glow: "rgba(255,255,255,1)",
    particleCount: 76,
    impactScale: 13,
    shakeDistance: 14,
    flashStrength: 1,
    rayCount: 38,
  },
};

function normaliseRarity(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/pokemon/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getWishRarityTheme(
  rarity: string | null | undefined,
): RarityTheme {
  const value = normaliseRarity(rarity);

  if (
    value.includes("crown rare") ||
    value.includes("masterpiece") ||
    value.includes("god rare")
  ) {
    return THEMES.crownRare;
  }

  if (
    value.includes("hyper rare") ||
    value.includes("secret rare") ||
    value.includes("gold rare") ||
    value === "rare secret"
  ) {
    return THEMES.hyperRare;
  }

  if (
    value.includes("special illustration") ||
    value.includes("special art") ||
    value.includes("alternate art")
  ) {
    return THEMES.specialIllustrationRare;
  }

  if (
    value.includes("illustration rare") ||
    value.includes("trainer gallery") ||
    value.includes("character rare")
  ) {
    return THEMES.illustrationRare;
  }

  if (
    value.includes("ultra rare") ||
    value.includes("full art") ||
    value.includes("rainbow rare") ||
    value.includes("ace spec") ||
    value.includes("amazing rare")
  ) {
    return THEMES.ultraRare;
  }

  if (
    value.includes("double rare") ||
    value.includes("rare holo ex") ||
    value.includes("rare holo gx") ||
    value.includes("rare holo v") ||
    value.includes("rare holo vmax") ||
    value.includes("rare holo vstar")
  ) {
    return THEMES.doubleRare;
  }

  if (
    value.includes("rare") ||
    value.includes("holo") ||
    value.includes("radiant")
  ) {
    return THEMES.rare;
  }

  if (value.includes("uncommon")) {
    return THEMES.uncommon;
  }

  return THEMES.common;
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
}: WishCinematicProps) {
  const preloadTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const audioSessionRef = useRef<WishAudioSession | null>(null);
  const markedSeenRef = useRef(false);
  const preferences = usePlayerPreferences();

  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [runNumber, setRunNumber] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nebuSkin, setNebuSkin] =
    useState<NebuSkinKey>(DEFAULT_NEBU_SKIN);

  const nebuHeatAssets = useMemo(
    () => getNebuHeatAssets(nebuSkin),
    [nebuSkin],
  );

  const revealFromPreferences =
    respectPreferences &&
    (
      preferences.reducedMotion ||
      (!forceFullSequence &&
        (preferences.dataSaver ||
          (preferences.skipPullCinematic && preferences.cinematicSeen)))
    );

  const theme = useMemo(
    () => getWishRarityTheme(card?.rarity),
    [card?.rarity],
  );
  const isBlackHole = Number(card?.marketValue) > 500;
  const sequenceTiming = useMemo(() => {
    if (isBlackHole) {
      return {
        impactAtMs: 5400,
        cardAtMs: 7080,
        infoAtMs: 7800,
        durationMs: 8600,
      };
    }

    const cardAtMs =
      ESCALATION_START_MS + getRarityRevealOffset(theme.tier);
    const impactAtMs = Math.max(
      ESCALATION_START_MS,
      cardAtMs - 520,
    );
    const infoAtMs = cardAtMs + 720;

    return {
      impactAtMs,
      cardAtMs,
      infoAtMs,
      durationMs: infoAtMs + 720,
    };
  }, [isBlackHole, theme.tier]);

  const cardKey = useMemo(() => {
    if (!card) {
      return "";
    }

    return [
      card.id ?? "",
      card.name,
      card.rarity ?? "",
      card.imageUrl ?? "",
      card.marketValue ?? "",
    ].join("|");
  }, [card]);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pocketpulls:wish-cinematic-visibility", {
        detail: { open },
      }),
    );

    return () => {
      if (open) {
        window.dispatchEvent(
          new CustomEvent("pocketpulls:wish-cinematic-visibility", {
            detail: { open: false },
          }),
        );
      }
    };
  }, [open]);

  useEffect(() => {
    const syncSkin = () => {
      setNebuSkin(readNebuSkin());
    };

    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;

      if (isNebuSkinKey(key)) {
        setNebuSkin(key);
      }
    };

    syncSkin();
    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);

    return () => {
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        "pocketpulls-wish-muted",
      );

      // This one-time client preference hydration deliberately follows mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMuted(stored === "true");
    } catch {
      // Local storage is optional.
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (preloadTimerRef.current !== null) {
      window.clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }

    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

  }, []);

  const reportFinished = useCallback(() => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    onFinishedRef.current?.();
  }, []);

  const revealImmediately = useCallback(() => {
    clearTimers();
    stopAudio();
    setReady(true);
    setSkipped(true);
    setComplete(true);
    reportFinished();
  }, [clearTimers, reportFinished, stopAudio]);

  const handleContinue = useCallback(() => {
    stopAudio();
    onClose();
  }, [onClose, stopAudio]);

  useEffect(() => {
    if (!open || !card) {
      clearTimers();
      stopAudio();
      finishedRef.current = false;
      // The prop-driven cinematic state machine resets when the dialog closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(false);
      setComplete(false);
      setSkipped(false);
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
      if (!active || started) {
        return;
      }

      started = true;
      setRunNumber((current) => current + 1);
      setReady(true);

      completionTimerRef.current = window.setTimeout(() => {
        setComplete(true);
        reportFinished();
      }, sequenceTiming.durationMs);
    };

    const preloadSources = [
      ...BASE_SCENE_SPRITES,
      nebuHeatAssets.walkSheet,
      nebuHeatAssets.reactionSheet,
      nebuHeatAssets.portrait,
      card.imageUrl,
    ].filter(
      (source): source is string => Boolean(source),
    );
    let remainingImages = preloadSources.length;

    const imageSettled = () => {
      remainingImages -= 1;

      if (remainingImages <= 0) {
        startSequence();
      }
    };

    for (const source of preloadSources) {
      const image = new Image();

      image.onload = imageSettled;
      image.onerror = imageSettled;
      image.src = source;
    }

    preloadTimerRef.current = window.setTimeout(
      startSequence,
      IMAGE_PRELOAD_TIMEOUT_MS,
    );

    return () => {
      active = false;
      clearTimers();
      stopAudio();
    };
  }, [
    open,
    card,
    cardKey,
    clearTimers,
    reportFinished,
    stopAudio,
    revealFromPreferences,
    sequenceTiming.durationMs,
    nebuHeatAssets.walkSheet,
    nebuHeatAssets.reactionSheet,
    nebuHeatAssets.portrait,
  ]);

  useEffect(() => {
    if (!open || !ready || skipped) {
      return;
    }

    let cancelled = false;

    void primeWishAudio()
      .then(() => {
        if (cancelled) {
          return;
        }

        stopAudio();
        audioSessionRef.current = startWishAudio(
          isBlackHole ? 8 : theme.tier,
          muted,
          preferences.sfxVolume,
          {
            impactAtMs: sequenceTiming.impactAtMs,
            revealAtMs: sequenceTiming.cardAtMs,
          },
        );
      })
      .catch(() => {
        // The animation remains fully usable without sound.
      });

    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [
    open,
    ready,
    runNumber,
    skipped,
    isBlackHole,
    theme.tier,
    sequenceTiming.impactAtMs,
    sequenceTiming.cardAtMs,
    muted,
    stopAudio,
    preferences.sfxVolume,
  ]);

  useEffect(() => {
    audioSessionRef.current?.setMuted(muted);
    audioSessionRef.current?.setVolume(preferences.sfxVolume);

    try {
      window.localStorage.setItem(
        "pocketpulls-wish-muted",
        String(muted),
      );
    } catch {
      // Local storage is optional.
    }
  }, [muted, preferences.sfxVolume]);

  useEffect(() => {
    if (
      !open ||
      !complete ||
      !respectPreferences ||
      markedSeenRef.current ||
      preferences.cinematicSeen
    ) {
      return;
    }

    markedSeenRef.current = true;
    publishPlayerPreferences({
      ...preferences,
      cinematicSeen: true,
    });

    void supabase.rpc("mark_player_cinematic_seen").then(({ error }) => {
      if (error) {
        console.warn("Cinematic viewing could not sync:", error.message);
      }
    });
  }, [complete, open, preferences, respectPreferences]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (complete) {
        onClose();
        return;
      }

      if (allowSkip) {
        revealImmediately();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    open,
    complete,
    allowSkip,
    onClose,
    revealImmediately,
  ]);

  if (!open || !card) {
    return null;
  }

  const rootStyle = {
    "--wish-primary": theme.primary,
    "--wish-secondary": theme.secondary,
    "--wish-glow": theme.glow,
    "--impact-scale": String(theme.impactScale),
    "--shake-distance": `${theme.shakeDistance}px`,
    "--flash-strength": String(theme.flashStrength),
    "--tier": String(theme.tier),
    "--impact-at": `${sequenceTiming.impactAtMs}ms`,
    "--card-at": `${sequenceTiming.cardAtMs}ms`,
    "--info-at": `${sequenceTiming.infoAtMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={styles.overlay}
      style={rootStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`Wish reveal for ${card.name}`}
    >
      <div className={styles.sky} />
      <div className={styles.ancientCardGhost} />
      <div className={styles.stars} />
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

          <img
            src={nebuHeatAssets.portrait}
            alt="Nebu, the Ancient Pulls celestial cat"
            draggable={false}
            className={styles.preparingNebu}
          />

          <p>Nebu is reading the constellation...</p>
        </div>
      ) : (
        <div
          key={runNumber}
          className={`${styles.sequence} ${
            skipped ? styles.sequenceSkipped : ""
          } ${
            isBlackHole ? styles.blackHoleSequence : ""
          }`}
        >
          <div className={styles.catScene}>
            <AncientCatPullScene
              tier={theme.tier}
              escalationStartMs={ESCALATION_START_MS}
              stepDurationsMs={RARITY_HOLD_MS}
              cardRevealAtMs={sequenceTiming.cardAtMs}
              walkSheet={nebuHeatAssets.walkSheet}
              reactionSheet={nebuHeatAssets.reactionSheet}
              blackHole={isBlackHole}
              lowEffects={
                preferences.lowVisualEffects || preferences.dataSaver
              }
            />
          </div>

          <div className={styles.impact}>
            <div className={styles.impactFlash} />
            <div className={styles.impactRing} />
            <div className={styles.impactRingSecond} />

            {theme.tier >= 4 ? (
              <div className={styles.impactRingThird} />
            ) : null}

            <div className={styles.impactRays}>
              {Array.from({ length: theme.rayCount }).map(
                (_, index) => (
                  <span
                    key={index}
                    style={
                      {
                        "--ray-angle": `${
                          (360 / theme.rayCount) * index
                        }deg`,
                        "--ray-length": `${
                          80 +
                          theme.tier * 11 +
                          (index % 6) * 16
                        }px`,
                        "--ray-delay": `${
                          (index % 5) * 10
                        }ms`,
                      } as CSSProperties
                    }
                  />
                ),
              )}
            </div>

            <div className={styles.particles}>
              {Array.from({
                length: theme.particleCount,
              }).map((_, index) => (
                <span
                  key={index}
                  style={
                    {
                      "--particle-angle": `${
                        (360 / theme.particleCount) *
                        index
                      }deg`,
                      "--particle-distance": `${
                        105 +
                        theme.tier * 10 +
                        (index % 9) * 22
                      }px`,
                      "--particle-delay": `${
                        (index % 7) * 11
                      }ms`,
                      "--particle-size": `${
                        2.5 +
                        theme.tier * 0.18 +
                        (index % 5)
                      }px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          <div className={styles.cardScene}>
            <div className={styles.cardGlow} />

            <div className={styles.cardFrame}>
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  draggable={false}
                />
              ) : (
                <div className={styles.cardFallback}>
                  <span>*</span>
                  <strong>{card.name}</strong>
                </div>
              )}

              <div className={styles.cardShine} />

              {theme.tier >= 5 ? (
                <div className={styles.premiumCardShine} />
              ) : null}
            </div>
          </div>

          <div className={styles.cardInfo}>
            <p className={styles.rarity}>
              {theme.label}
            </p>

            <h2>{card.name}</h2>

            <p className={styles.meta}>
              {[
                card.setName,
                card.cardNumber
                  ? `#${card.cardNumber}`
                  : null,
              ]
                .filter(Boolean)
                .join(" - ")}
            </p>

            <div className={styles.pills}>
              <span>
                {card.rarity || theme.label}
              </span>

              <span>
                {formatMoney(card.marketValue)}
              </span>
            </div>

            {actionError ? (
              <div className={styles.actionError}>
                {actionError}
              </div>
            ) : null}

            <div className={styles.actions}>
              {onWishAgain && canWishAgain ? (
                <button
                  type="button"
                  onClick={onWishAgain}
                  disabled={!complete || busy}
                  className={styles.wishAgainButton}
                >
                  {busy
                    ? "Choosing next card..."
                    : "Wish Again - 1 Wish"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleContinue}
                disabled={!complete || busy}
                className={styles.keepButton}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {allowSkip && ready && !complete ? (
        <button
          type="button"
          className={styles.skipButton}
          onClick={revealImmediately}
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}
