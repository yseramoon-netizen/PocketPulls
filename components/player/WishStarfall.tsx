"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

export type WishRevealCard = {
  id?: string | number;
  name: string;
  rarity?: string | null;
  imageUrl?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  marketValue?: number | null;
};

type WishStarfallProps = {
  active: boolean;
  card: WishRevealCard | null;
  onComplete?: () => void;
  onClose?: () => void;
};

type AnimationStage =
  | "idle"
  | "summon"
  | "fall"
  | "impact"
  | "reveal"
  | "complete";

type RarityTheme = {
  key: string;
  label: string;
  primary: string;
  secondary: string;
  soft: string;
  glow: string;
  particle: string;
  background: string;
  rainbow: boolean;
  particleCount: number;
};

const STAGE_TIMINGS = {
  summon: 650,
  fall: 1800,
  impact: 600,
  reveal: 950,
  complete: 200,
};

const RARITY_THEMES: Record<string, RarityTheme> = {
  common: {
    key: "common",
    label: "Common",
    primary: "#f8fafc",
    secondary: "#94a3b8",
    soft: "rgba(226,232,240,0.24)",
    glow: "rgba(248,250,252,0.78)",
    particle: "#f1f5f9",
    background: "rgba(148,163,184,0.08)",
    rainbow: false,
    particleCount: 18,
  },

  uncommon: {
    key: "uncommon",
    label: "Uncommon",
    primary: "#86efac",
    secondary: "#22c55e",
    soft: "rgba(134,239,172,0.24)",
    glow: "rgba(74,222,128,0.82)",
    particle: "#dcfce7",
    background: "rgba(34,197,94,0.09)",
    rainbow: false,
    particleCount: 22,
  },

  rare: {
    key: "rare",
    label: "Rare",
    primary: "#7dd3fc",
    secondary: "#2563eb",
    soft: "rgba(125,211,252,0.24)",
    glow: "rgba(56,189,248,0.85)",
    particle: "#dbeafe",
    background: "rgba(37,99,235,0.10)",
    rainbow: false,
    particleCount: 28,
  },

  doubleRare: {
    key: "doubleRare",
    label: "Double Rare",
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    soft: "rgba(196,181,253,0.26)",
    glow: "rgba(167,139,250,0.90)",
    particle: "#ede9fe",
    background: "rgba(124,58,237,0.11)",
    rainbow: false,
    particleCount: 34,
  },

  ultraRare: {
    key: "ultraRare",
    label: "Ultra Rare",
    primary: "#fde68a",
    secondary: "#f59e0b",
    soft: "rgba(253,230,138,0.28)",
    glow: "rgba(251,191,36,0.95)",
    particle: "#fef3c7",
    background: "rgba(245,158,11,0.12)",
    rainbow: false,
    particleCount: 42,
  },

  illustrationRare: {
    key: "illustrationRare",
    label: "Illustration Rare",
    primary: "#f9a8d4",
    secondary: "#a855f7",
    soft: "rgba(249,168,212,0.26)",
    glow: "rgba(232,121,249,0.96)",
    particle: "#fbcfe8",
    background: "rgba(168,85,247,0.12)",
    rainbow: true,
    particleCount: 50,
  },

  specialIllustrationRare: {
    key: "specialIllustrationRare",
    label: "Special Illustration Rare",
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    soft: "rgba(103,232,249,0.28)",
    glow: "rgba(244,114,182,1)",
    particle: "#fef9c3",
    background: "rgba(34,211,238,0.13)",
    rainbow: true,
    particleCount: 58,
  },

  hyperRare: {
    key: "hyperRare",
    label: "Hyper Rare",
    primary: "#fef08a",
    secondary: "#fbbf24",
    soft: "rgba(254,240,138,0.32)",
    glow: "rgba(250,204,21,1)",
    particle: "#fff7b2",
    background: "rgba(250,204,21,0.15)",
    rainbow: true,
    particleCount: 68,
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
    value.includes("hyper rare") ||
    value.includes("secret rare") ||
    value.includes("gold rare") ||
    value === "rare secret"
  ) {
    return RARITY_THEMES.hyperRare;
  }

  if (
    value.includes("special illustration") ||
    value.includes("special art") ||
    value.includes("alternate art")
  ) {
    return RARITY_THEMES.specialIllustrationRare;
  }

  if (
    value.includes("illustration rare") ||
    value.includes("trainer gallery") ||
    value.includes("character rare")
  ) {
    return RARITY_THEMES.illustrationRare;
  }

  if (
    value.includes("ultra rare") ||
    value.includes("full art") ||
    value.includes("rainbow rare") ||
    value.includes("ace spec") ||
    value.includes("amazing rare")
  ) {
    return RARITY_THEMES.ultraRare;
  }

  if (
    value.includes("double rare") ||
    value.includes("rare holo ex") ||
    value.includes("rare holo gx") ||
    value.includes("rare holo v") ||
    value.includes("rare holo vmax") ||
    value.includes("rare holo vstar")
  ) {
    return RARITY_THEMES.doubleRare;
  }

  if (
    value.includes("rare") ||
    value.includes("holo") ||
    value.includes("radiant")
  ) {
    return RARITY_THEMES.rare;
  }

  if (value.includes("uncommon")) {
    return RARITY_THEMES.uncommon;
  }

  return RARITY_THEMES.common;
}

function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, Number(value) || 0));
}

function createParticles(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (360 / count) * index + (index % 4) * 4;
    const distance = 75 + ((index * 31) % 165);
    const size = 2 + ((index * 17) % 6);
    const delay = (index % 10) * 20;
    const duration = 700 + ((index * 23) % 600);

    return {
      id: index,
      angle,
      distance,
      size,
      delay,
      duration,
    };
  });
}

function getStageText(stage: AnimationStage): string {
  switch (stage) {
    case "summon":
      return "A distant star answers";
    case "fall":
      return "Your wish is descending";
    case "impact":
      return "Its rarity reveals itself";
    case "reveal":
      return "Your card appears";
    case "complete":
      return "Wish granted";
    default:
      return "";
  }
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur-xl">
      {children}
    </span>
  );
}

function StarCore() {
  return (
    <div className="wish-star-core">
      <div className="wish-star-cross" />
    </div>
  );
}

function StarSky() {
  const stars = Array.from({ length: 42 }, (_, index) => ({
    id: index,
    left: (index * 37) % 100,
    top: (index * 53) % 88,
    size: 1 + ((index * 7) % 3),
    opacity: 0.2 + ((index * 11) % 7) / 10,
    delay: (index % 9) * 170,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute animate-pulse rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function WishStarfall({
  active,
  card,
  onComplete,
  onClose,
}: WishStarfallProps) {
  const [stage, setStage] = useState<AnimationStage>("idle");

  const theme = useMemo(
    () => getWishRarityTheme(card?.rarity),
    [card?.rarity],
  );

  const particles = useMemo(
    () => createParticles(theme.particleCount),
    [theme.particleCount],
  );

  useEffect(() => {
    if (!active || !card) {
      setStage("idle");
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    function queue(nextStage: AnimationStage, delay: number) {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setStage(nextStage);
        }
      }, delay);

      timers.push(timer);
    }

    setStage("summon");

    const fallAt = STAGE_TIMINGS.summon;
    const impactAt = fallAt + STAGE_TIMINGS.fall;
    const revealAt = impactAt + STAGE_TIMINGS.impact;
    const completeAt = revealAt + STAGE_TIMINGS.reveal;

    queue("fall", fallAt);
    queue("impact", impactAt);
    queue("reveal", revealAt);
    queue("complete", completeAt);

    const completeTimer = window.setTimeout(() => {
      if (!cancelled) {
        onComplete?.();
      }
    }, completeAt + STAGE_TIMINGS.complete);

    timers.push(completeTimer);

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [active, card, onComplete]);

  if (!active || !card) {
    return null;
  }

  const rootStyle = {
    "--rarity-primary": theme.primary,
    "--rarity-secondary": theme.secondary,
    "--rarity-soft": theme.soft,
    "--rarity-glow": theme.glow,
    "--rarity-particle": theme.particle,
    "--rarity-background": theme.background,
  } as CSSProperties;

  const showImpact =
    stage === "impact" || stage === "reveal" || stage === "complete";

  const showCard = stage === "reveal" || stage === "complete";

  return (
    <div
      className="wish-starfall-root fixed inset-0 z-[10000] overflow-hidden bg-[#02030f]/95 text-white backdrop-blur-xl"
      style={rootStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`${theme.label} card reveal`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,var(--rarity-background),transparent_35%),radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_40%)]" />

      <StarSky />

      <div
        className={[
          "wish-rarity-aurora absolute inset-0 opacity-0",
          theme.rainbow ? "wish-rarity-aurora-rainbow" : "",
          showImpact ? "wish-rarity-aurora-visible" : "",
        ].join(" ")}
      />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="relative flex h-[min(88dvh,760px)] w-full max-w-5xl items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/10">
          <div className="absolute left-1/2 top-7 -translate-x-1/2 text-center">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.26em] text-white/35">
              Jirachi has heard your wish
            </p>

            <p
              className={[
                "mt-2 text-sm font-black uppercase tracking-[0.18em] transition duration-500",
                showImpact ? "opacity-100" : "opacity-0",
              ].join(" ")}
              style={{ color: theme.primary }}
            >
              {theme.label}
            </p>
          </div>

          <div
            className={[
              "wish-summon-star absolute left-1/2 top-[18%]",
              stage === "summon" ? "wish-summon-star-visible" : "",
            ].join(" ")}
          >
            <StarCore />
          </div>

          <div
            className={[
              "wish-falling-star absolute left-1/2 top-[-18%]",
              stage === "fall" ? "wish-falling-star-active" : "",
              stage === "impact" || stage === "reveal" || stage === "complete"
                ? "wish-falling-star-landed"
                : "",
            ].join(" ")}
          >
            <div className="wish-star-trail" />
            <StarCore />
          </div>

          {showImpact ? (
            <div className="wish-impact absolute left-1/2 top-[58%]">
              <div className="wish-impact-ring wish-impact-ring-one" />
              <div className="wish-impact-ring wish-impact-ring-two" />
              <div className="wish-impact-flash" />

              {particles.map((particle) => {
                const particleStyle = {
                  "--particle-angle": `${particle.angle}deg`,
                  "--particle-distance": `${particle.distance}px`,
                  "--particle-size": `${particle.size}px`,
                  "--particle-delay": `${particle.delay}ms`,
                  "--particle-duration": `${particle.duration}ms`,
                } as CSSProperties;

                return (
                  <span
                    key={particle.id}
                    className="wish-impact-particle"
                    style={particleStyle}
                  />
                );
              })}
            </div>
          ) : null}

          <div
            className={[
              "wish-card-reveal absolute left-1/2 top-[52%]",
              showCard ? "wish-card-reveal-visible" : "",
            ].join(" ")}
          >
            <div className="wish-card-glow" />

            <div
              className={[
                "wish-card-shell relative overflow-hidden rounded-[1.4rem] border bg-[#080a24]",
                theme.rainbow ? "wish-card-shell-rainbow" : "",
              ].join(" ")}
            >
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-300/10 to-cyan-200/[0.06]">
                  <span className="text-8xl" style={{ color: theme.primary }}>
                    ★
                  </span>
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.06]" />

              {theme.rainbow ? (
                <div className="wish-card-holographic pointer-events-none absolute inset-0" />
              ) : null}
            </div>
          </div>

          <div
            className={[
              "absolute bottom-8 left-1/2 w-[min(92%,34rem)] -translate-x-1/2 text-center transition duration-700",
              showCard ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
            ].join(" ")}
          >
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {card.name}
            </h2>

            <p className="mt-2 text-sm font-semibold text-white/45">
              {[card.setName, card.cardNumber ? `#${card.cardNumber}` : null]
                .filter(Boolean)
                .join(" • ")}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Badge>{card.rarity || theme.label}</Badge>
              <Badge>{formatMoney(card.marketValue)}</Badge>
            </div>

            {stage === "complete" ? (
              <button
                type="button"
                onClick={onClose}
                className="mt-6 min-h-12 rounded-xl px-7 text-sm font-black transition hover:brightness-110"
                style={{
                  background: theme.primary,
                  color: "#080a24",
                  boxShadow: `0 0 35px ${theme.soft}`,
                }}
              >
                Add to my collection
              </button>
            ) : null}
          </div>

          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[0.56rem] font-black uppercase tracking-[0.18em] text-white/20">
            {getStageText(stage)}
          </p>
        </div>
      </div>

      <style jsx global>{`
        .wish-starfall-root {
          --rarity-primary: #ffffff;
          --rarity-secondary: #94a3b8;
          --rarity-soft: rgba(255, 255, 255, 0.2);
          --rarity-glow: rgba(255, 255, 255, 0.8);
          --rarity-particle: #ffffff;
          --rarity-background: rgba(255, 255, 255, 0.08);
        }

        .wish-summon-star,
        .wish-falling-star {
          width: 74px;
          height: 74px;
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
          z-index: 20;
        }

        .wish-summon-star-visible {
          animation: wishSummonPulse 650ms ease-out forwards;
        }

        .wish-falling-star-active {
          opacity: 1;
          animation: wishStarFall 1800ms cubic-bezier(0.18, 0.78, 0.25, 1)
            forwards;
        }

        .wish-falling-star-landed {
          opacity: 0;
          transform: translate(-50%, -50%) translateY(62vh) scale(0.4);
        }

        .wish-star-core {
          position: absolute;
          inset: 0;
          filter: drop-shadow(0 0 16px var(--rarity-glow))
            drop-shadow(0 0 40px var(--rarity-glow));
        }

        .wish-star-core::before,
        .wish-star-core::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          background: var(--rarity-primary);
          transform: translate(-50%, -50%) rotate(45deg);
          border-radius: 35%;
        }

        .wish-star-core::before {
          width: 33px;
          height: 33px;
          box-shadow: 0 0 30px var(--rarity-glow);
        }

        .wish-star-core::after {
          width: 12px;
          height: 70px;
          background: linear-gradient(
            180deg,
            transparent,
            var(--rarity-primary),
            transparent
          );
          border-radius: 999px;
        }

        .wish-star-cross {
          position: absolute;
          inset: 0;
        }

        .wish-star-cross::before,
        .wish-star-cross::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--rarity-secondary),
            transparent
          );
        }

        .wish-star-cross::before {
          width: 86px;
          height: 5px;
        }

        .wish-star-cross::after {
          width: 5px;
          height: 86px;
          background: linear-gradient(
            180deg,
            transparent,
            var(--rarity-secondary),
            transparent
          );
        }

        .wish-star-trail {
          position: absolute;
          left: 50%;
          bottom: 35px;
          width: 24px;
          height: 46vh;
          transform: translateX(-50%);
          border-radius: 999px;
          background: linear-gradient(
            to top,
            var(--rarity-primary),
            var(--rarity-secondary) 24%,
            var(--rarity-soft) 58%,
            transparent
          );
          filter: blur(7px);
          opacity: 0.82;
        }

        .wish-star-trail::before {
          content: "";
          position: absolute;
          inset: 0 7px;
          border-radius: inherit;
          background: linear-gradient(
            to top,
            white,
            var(--rarity-primary),
            transparent
          );
          filter: blur(2px);
        }

        .wish-impact {
          width: 1px;
          height: 1px;
          transform: translate(-50%, -50%);
          z-index: 15;
        }

        .wish-impact-flash {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 40px;
          height: 40px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: white;
          box-shadow:
            0 0 35px 20px var(--rarity-primary),
            0 0 90px 55px var(--rarity-soft);
          animation: wishImpactFlash 650ms ease-out forwards;
        }

        .wish-impact-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 40px;
          height: 40px;
          transform: translate(-50%, -50%);
          border: 3px solid var(--rarity-primary);
          border-radius: 999px;
          box-shadow: 0 0 18px var(--rarity-glow);
          opacity: 0;
        }

        .wish-impact-ring-one {
          animation: wishImpactRing 900ms ease-out forwards;
        }

        .wish-impact-ring-two {
          animation: wishImpactRing 1100ms 120ms ease-out forwards;
        }

        .wish-impact-particle {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--particle-size);
          height: var(--particle-size);
          margin-left: calc(var(--particle-size) / -2);
          margin-top: calc(var(--particle-size) / -2);
          border-radius: 999px;
          background: var(--rarity-particle);
          box-shadow: 0 0 8px var(--rarity-glow);
          opacity: 0;
          transform: rotate(var(--particle-angle)) translateX(0);
          animation: wishParticleBurst var(--particle-duration)
            var(--particle-delay) ease-out forwards;
        }

        .wish-card-reveal {
          width: min(54vw, 265px);
          aspect-ratio: 0.716;
          transform: translate(-50%, -42%) perspective(1000px) rotateY(90deg)
            scale(0.55);
          opacity: 0;
          z-index: 30;
        }

        .wish-card-reveal-visible {
          animation: wishCardReveal 950ms cubic-bezier(0.16, 0.9, 0.25, 1)
            forwards;
        }

        .wish-card-shell {
          width: 100%;
          height: 100%;
          border-color: var(--rarity-primary);
          box-shadow:
            0 0 0 1px var(--rarity-soft),
            0 18px 65px rgba(0, 0, 0, 0.65),
            0 0 45px var(--rarity-soft);
        }

        .wish-card-glow {
          position: absolute;
          inset: -24%;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            var(--rarity-soft),
            transparent 66%
          );
          filter: blur(18px);
          animation: wishGlowPulse 1800ms ease-in-out infinite alternate;
        }

        .wish-card-shell-rainbow {
          animation: wishRainbowBorder 2.8s linear infinite;
        }

        .wish-card-holographic {
          background: linear-gradient(
            115deg,
            transparent 20%,
            rgba(255, 255, 255, 0.06) 34%,
            rgba(103, 232, 249, 0.2) 42%,
            rgba(249, 168, 212, 0.2) 52%,
            rgba(254, 240, 138, 0.18) 62%,
            rgba(255, 255, 255, 0.05) 70%,
            transparent 82%
          );
          background-size: 260% 260%;
          mix-blend-mode: screen;
          animation: wishHoloSweep 2.4s linear infinite;
        }

        .wish-rarity-aurora {
          background: radial-gradient(
            circle at 50% 58%,
            var(--rarity-soft),
            transparent 38%
          );
          transition: opacity 600ms ease;
        }

        .wish-rarity-aurora-visible {
          opacity: 1;
        }

        .wish-rarity-aurora-rainbow {
          background: conic-gradient(
            from 0deg at 50% 58%,
            rgba(103, 232, 249, 0.1),
            rgba(196, 181, 253, 0.11),
            rgba(249, 168, 212, 0.1),
            rgba(254, 240, 138, 0.1),
            rgba(103, 232, 249, 0.1)
          );
          animation: wishAuroraSpin 8s linear infinite;
        }

        @keyframes wishSummonPulse {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          55% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.82);
            opacity: 0.35;
          }
        }

        @keyframes wishStarFall {
          0% {
            transform: translate(-50%, -50%) translate3d(-24vw, 0, 0)
              rotate(-18deg) scale(0.5);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) translate3d(14vw, 35vh, 0)
              rotate(12deg) scale(0.9);
          }
          82% {
            transform: translate(-50%, -50%) translate3d(-4vw, 61vh, 0)
              rotate(-4deg) scale(1.25);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate3d(0, 72vh, 0)
              scale(0.25);
            opacity: 0;
          }
        }

        @keyframes wishImpactFlash {
          0% {
            transform: translate(-50%, -50%) scale(0.1);
            opacity: 1;
          }
          65% {
            transform: translate(-50%, -50%) scale(4.5);
            opacity: 0.85;
          }
          100% {
            transform: translate(-50%, -50%) scale(9);
            opacity: 0;
          }
        }

        @keyframes wishImpactRing {
          0% {
            transform: translate(-50%, -50%) scale(0.15);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(11);
            opacity: 0;
          }
        }

        @keyframes wishParticleBurst {
          0% {
            transform: rotate(var(--particle-angle)) translateX(0) scale(0.3);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: rotate(var(--particle-angle))
              translateX(var(--particle-distance)) scale(0);
            opacity: 0;
          }
        }

        @keyframes wishCardReveal {
          0% {
            transform: translate(-50%, -42%) perspective(1000px)
              rotateY(90deg) scale(0.55);
            opacity: 0;
          }
          45% {
            transform: translate(-50%, -42%) perspective(1000px)
              rotateY(-12deg) scale(1.08);
            opacity: 1;
          }
          72% {
            transform: translate(-50%, -42%) perspective(1000px)
              rotateY(5deg) scale(0.98);
          }
          100% {
            transform: translate(-50%, -42%) perspective(1000px) rotateY(0)
              scale(1);
            opacity: 1;
          }
        }

        @keyframes wishGlowPulse {
          from {
            transform: scale(0.9);
            opacity: 0.65;
          }
          to {
            transform: scale(1.1);
            opacity: 1;
          }
        }

        @keyframes wishRainbowBorder {
          0% {
            box-shadow:
              0 0 0 2px rgba(103, 232, 249, 0.5),
              0 0 45px rgba(103, 232, 249, 0.32),
              0 18px 65px rgba(0, 0, 0, 0.65);
          }
          33% {
            box-shadow:
              0 0 0 2px rgba(249, 168, 212, 0.5),
              0 0 45px rgba(249, 168, 212, 0.32),
              0 18px 65px rgba(0, 0, 0, 0.65);
          }
          66% {
            box-shadow:
              0 0 0 2px rgba(254, 240, 138, 0.5),
              0 0 45px rgba(254, 240, 138, 0.32),
              0 18px 65px rgba(0, 0, 0, 0.65);
          }
          100% {
            box-shadow:
              0 0 0 2px rgba(103, 232, 249, 0.5),
              0 0 45px rgba(103, 232, 249, 0.32),
              0 18px 65px rgba(0, 0, 0, 0.65);
          }
        }

        @keyframes wishHoloSweep {
          from {
            background-position: 180% 180%;
          }
          to {
            background-position: -80% -80%;
          }
        }

        @keyframes wishAuroraSpin {
          from {
            transform: rotate(0deg) scale(1.3);
          }
          to {
            transform: rotate(360deg) scale(1.3);
          }
        }

        @media (max-width: 640px) {
          .wish-card-reveal {
            width: min(62vw, 235px);
            top: 49%;
          }

          .wish-impact {
            top: 55%;
          }

          .wish-falling-star-active {
            animation-name: wishStarFallMobile;
          }

          @keyframes wishStarFallMobile {
            0% {
              transform: translate(-50%, -50%) translate3d(-16vw, 0, 0)
                rotate(-14deg) scale(0.45);
              opacity: 0;
            }
            8% {
              opacity: 1;
            }
            52% {
              transform: translate(-50%, -50%) translate3d(12vw, 34vh, 0)
                rotate(9deg) scale(0.82);
            }
            82% {
              transform: translate(-50%, -50%) translate3d(-3vw, 56vh, 0)
                rotate(-3deg) scale(1.1);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) translate3d(0, 65vh, 0)
                scale(0.2);
              opacity: 0;
            }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wish-summon-star-visible,
          .wish-falling-star-active,
          .wish-impact-flash,
          .wish-impact-ring,
          .wish-impact-particle,
          .wish-card-reveal-visible,
          .wish-card-glow,
          .wish-card-shell-rainbow,
          .wish-card-holographic,
          .wish-rarity-aurora-rainbow {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>
  );
}