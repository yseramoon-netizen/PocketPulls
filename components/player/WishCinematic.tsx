"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
};

type RarityTheme = {
  label: string;
  primary: string;
  secondary: string;
  glow: string;
};

const ANIMATION_DURATION_MS = 7000;
const IMAGE_PRELOAD_TIMEOUT_MS = 1800;

const THEMES: Record<string, RarityTheme> = {
  common: {
    label: "Common",
    primary: "#e2e8f0",
    secondary: "#94a3b8",
    glow: "rgba(226,232,240,0.76)",
  },
  uncommon: {
    label: "Uncommon",
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.8)",
  },
  rare: {
    label: "Rare",
    primary: "#7dd3fc",
    secondary: "#2563eb",
    glow: "rgba(125,211,252,0.84)",
  },
  doubleRare: {
    label: "Double Rare",
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    glow: "rgba(196,181,253,0.88)",
  },
  ultraRare: {
    label: "Ultra Rare",
    primary: "#fde68a",
    secondary: "#f59e0b",
    glow: "rgba(253,230,138,0.92)",
  },
  illustrationRare: {
    label: "Illustration Rare",
    primary: "#f9a8d4",
    secondary: "#a855f7",
    glow: "rgba(249,168,212,0.92)",
  },
  specialIllustrationRare: {
    label: "Special Illustration Rare",
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    glow: "rgba(103,232,249,0.96)",
  },
  hyperRare: {
    label: "Hyper Rare",
    primary: "#fef08a",
    secondary: "#f59e0b",
    glow: "rgba(250,204,21,0.98)",
  },
  crownRare: {
    label: "Crown Rare",
    primary: "#ffffff",
    secondary: "#fef08a",
    glow: "rgba(255,255,255,1)",
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
}: WishCinematicProps) {
  const preloadTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);

  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [runNumber, setRunNumber] = useState(0);

  const theme = useMemo(
    () => getWishRarityTheme(card?.rarity),
    [card?.rarity],
  );

  const cardKey = useMemo(() => {
    if (!card) {
      return "";
    }

    return [
      card.id ?? "",
      card.name,
      card.rarity ?? "",
      card.imageUrl ?? "",
    ].join("|");
  }, [card]);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

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
    setReady(true);
    setSkipped(true);
    setComplete(true);
    reportFinished();
  }, [clearTimers, reportFinished]);

  useEffect(() => {
    if (!open || !card) {
      clearTimers();
      finishedRef.current = false;
      setReady(false);
      setComplete(false);
      setSkipped(false);
      return;
    }

    let active = true;
    let started = false;

    clearTimers();
    finishedRef.current = false;
    setReady(false);
    setComplete(false);
    setSkipped(false);

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
      }, ANIMATION_DURATION_MS);
    };

    if (!card.imageUrl) {
      startSequence();
    } else {
      const image = new Image();

      image.onload = startSequence;
      image.onerror = startSequence;
      image.src = card.imageUrl;

      preloadTimerRef.current = window.setTimeout(
        startSequence,
        IMAGE_PRELOAD_TIMEOUT_MS,
      );
    }

    return () => {
      active = false;
      clearTimers();
    };
  }, [open, card, cardKey, clearTimers, reportFinished]);

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
      <div className={styles.stars} />
      <div className={styles.vignette} />

      {!ready ? (
        <div className={styles.preparing}>
          <div className={styles.preparingGlow} />

          <img
            src="/jirachi.png"
            alt="Jirachi"
            draggable={false}
          />

          <p>Preparing your wish...</p>
        </div>
      ) : (
        <div
          key={runNumber}
          className={`${styles.sequence} ${
            skipped ? styles.sequenceSkipped : ""
          }`}
        >
          <div className={styles.jirachiScene}>
            <div className={styles.jirachiAura} />

            <img
              src="/jirachi.png"
              alt="Jirachi"
              draggable={false}
              className={styles.jirachi}
            />

            <p>Jirachi is granting your wish...</p>
          </div>

          <div className={styles.fallingStar}>
            <div className={styles.whiteTrail} />
            <div className={styles.rarityTrail} />
            <div className={styles.starOuterGlow} />
            <div className={styles.whiteCore} />
            <div className={styles.rarityCore} />
          </div>

          <div className={styles.impact}>
            <div className={styles.impactFlash} />
            <div className={styles.impactRing} />
            <div className={styles.impactRingSecond} />

            <div className={styles.particles}>
              {Array.from({ length: 32 }).map((_, index) => (
                <span
                  key={index}
                  style={
                    {
                      "--particle-angle": `${
                        (360 / 32) * index
                      }deg`,
                      "--particle-distance": `${
                        115 + (index % 8) * 22
                      }px`,
                      "--particle-delay": `${
                        (index % 6) * 13
                      }ms`,
                      "--particle-size": `${
                        3 + (index % 4)
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
                onClick={onClose}
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
