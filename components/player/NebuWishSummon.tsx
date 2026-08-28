"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
} from "react";

import styles from "./NebuWishSummon.module.css";

const FRAME_RATE = 24;
const FRAME_MS = 1000 / FRAME_RATE;
const FRAME_COLUMNS = 6;
const FRAME_ROWS = 4;
const LAST_FRAME = FRAME_COLUMNS * FRAME_ROWS - 1;

const NEBU_SUMMON_SPRITES = [
  "/ancient-pulls/wish/nebu-summon/tier-1-common.png",
  "/ancient-pulls/wish/nebu-summon/tier-2-uncommon.png",
  "/ancient-pulls/wish/nebu-summon/tier-3-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-4-double-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-5-ultra-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-6-illustration-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-7-special-illustration-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-8-hyper-rare.png",
  "/ancient-pulls/wish/nebu-summon/tier-9-crown-black-hole.png",
] as const;

const SUCTION_STREAKS = Array.from({ length: 9 }, (_, index) => index);

type NebuWishSummonProps = {
  tier: number;
  specialAtMs: number;
  impactAtMs: number;
  cardRevealAtMs: number;
  blackHole?: boolean;
  lowEffects?: boolean;
};

function clampTier(tier: number): number {
  return Math.max(1, Math.min(NEBU_SUMMON_SPRITES.length, Math.round(tier)));
}

export function getNebuSummonSprite(
  tier: number,
  blackHole = false,
): string {
  const index = blackHole ? NEBU_SUMMON_SPRITES.length - 1 : clampTier(tier) - 1;
  return NEBU_SUMMON_SPRITES[index];
}

function setAtlasFrame(element: HTMLElement, frame: number): void {
  const safeFrame = Math.max(0, Math.min(LAST_FRAME, Math.floor(frame)));
  if (element.dataset.frame === String(safeFrame)) return;

  const column = safeFrame % FRAME_COLUMNS;
  const row = Math.floor(safeFrame / FRAME_COLUMNS);
  const x = (column / (FRAME_COLUMNS - 1)) * 100;
  const y = (row / (FRAME_ROWS - 1)) * 100;

  element.dataset.frame = String(safeFrame);
  element.style.backgroundPosition = `${x}% ${y}%`;
}

function regularFrameAt(elapsedMs: number, swipeAtMs: number, impactAtMs: number): number {
  const introEndMs = 8 * FRAME_MS;
  if (elapsedMs < introEndMs) return Math.floor(elapsedMs / FRAME_MS);

  if (elapsedMs < swipeAtMs) {
    const struggleFrame = Math.floor((elapsedMs - introEndMs) / FRAME_MS) % 10;
    return 8 + struggleFrame;
  }

  const swipeEndMs = swipeAtMs + 3 * FRAME_MS;
  if (elapsedMs < swipeEndMs) {
    return 18 + Math.floor((elapsedMs - swipeAtMs) / FRAME_MS);
  }

  if (elapsedMs < Math.min(impactAtMs, swipeEndMs + 2 * FRAME_MS)) {
    return 21 + Math.floor((elapsedMs - swipeEndMs) / FRAME_MS);
  }

  return 23;
}

function blackHoleFrameAt(
  elapsedMs: number,
  blackHoleAtMs: number,
  impactAtMs: number,
): number {
  const warningLeadMs = 9 * FRAME_MS;
  const warningAtMs = Math.max(0, blackHoleAtMs - warningLeadMs);

  if (elapsedMs < warningAtMs) {
    return Math.floor(elapsedMs / 620) % 3;
  }

  if (elapsedMs < blackHoleAtMs) {
    return Math.min(8, Math.floor((elapsedMs - warningAtMs) / FRAME_MS));
  }

  const suctionDurationMs = Math.max(720, impactAtMs - blackHoleAtMs);
  const progress = Math.max(0, Math.min(1, (elapsedMs - blackHoleAtMs) / suctionDurationMs));

  if (progress < 0.48) {
    return 9 + Math.min(6, Math.floor((progress / 0.48) * 7));
  }

  if (progress < 0.77) {
    const braceFrame = Math.floor((elapsedMs - blackHoleAtMs) / FRAME_MS) % 4;
    return 12 + braceFrame;
  }

  return 16 + Math.min(7, Math.floor(((progress - 0.77) / 0.23) * 8));
}

export default function NebuWishSummon({
  tier,
  specialAtMs,
  impactAtMs,
  cardRevealAtMs,
  blackHole = false,
  lowEffects = false,
}: NebuWishSummonProps) {
  const spriteRef = useRef<HTMLSpanElement>(null);
  const spriteSrc = getNebuSummonSprite(tier, blackHole);
  const swipeAtMs = useMemo(
    () => Math.max(8 * FRAME_MS + 80, Math.min(specialAtMs, impactAtMs - 420)),
    [impactAtMs, specialAtMs],
  );
  const meteorAtMs = swipeAtMs + 3 * FRAME_MS;
  const meteorDurationMs = Math.max(360, impactAtMs - meteorAtMs);
  const rootStyle = {
    "--nebu-impact-at": `${impactAtMs}ms`,
    "--nebu-card-at": `${cardRevealAtMs}ms`,
    "--meteor-at": `${meteorAtMs}ms`,
    "--meteor-duration": `${meteorDurationMs}ms`,
    "--black-hole-at": `${specialAtMs}ms`,
    "--suction-duration": `${Math.max(720, impactAtMs - specialAtMs)}ms`,
  } as CSSProperties;

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setAtlasFrame(sprite, blackHole ? 21 : 23);
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();
    const updateInterval = 1000 / (lowEffects ? 12 : FRAME_RATE);
    let lastUpdatedAt = -updateInterval;

    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      if (elapsedMs - lastUpdatedAt >= updateInterval - 1) {
        const frame = blackHole
          ? blackHoleFrameAt(elapsedMs, specialAtMs, impactAtMs)
          : regularFrameAt(elapsedMs, swipeAtMs, impactAtMs);
        setAtlasFrame(sprite, frame);
        lastUpdatedAt = elapsedMs;
      }

      if (elapsedMs < cardRevealAtMs + 180) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    setAtlasFrame(sprite, 0);
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [blackHole, cardRevealAtMs, impactAtMs, lowEffects, specialAtMs, swipeAtMs]);

  return (
    <div
      className={styles.summon}
      style={rootStyle}
      data-black-hole={blackHole ? "true" : "false"}
      data-low-effects={lowEffects ? "true" : "false"}
      aria-hidden="true"
    >
      <span className={styles.groundShadow} />
      <span
        ref={spriteRef}
        className={styles.nebuSprite}
        style={{ backgroundImage: `url("${spriteSrc}")` }}
      />

      {!blackHole ? (
        <>
          <span className={styles.meteor}>
            <i className={styles.meteorTail} />
            <i className={styles.meteorFlame} />
            <i className={styles.meteorCore} />
          </span>
          <span className={styles.impactFlash} />
          <span className={styles.impactRing} />
          <span className={styles.impactDust} />
        </>
      ) : (
        <>
          <span className={styles.blackHole}>
            <i className={styles.lensing} />
            <i className={styles.accretionDisk} />
            <i className={styles.eventHorizon} />
          </span>
          <span className={styles.suctionCone} />
          <span className={styles.suctionStreaks}>
            {SUCTION_STREAKS.map((index) => (
              <i
                key={index}
                style={
                  {
                    "--streak-x": `${12 + ((index * 19) % 76)}%`,
                    "--streak-delay": `${(index % 5) * -86}ms`,
                    "--streak-scale": String(0.58 + (index % 4) * 0.16),
                  } as CSSProperties
                }
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
