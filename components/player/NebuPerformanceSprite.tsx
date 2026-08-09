"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./NebuPerformanceSprite.module.css";

const FRAME_COUNT = 16;

// Longer anticipation, impact and final-pose holds make the generated in-betweens
// read as intentional animation rather than a fast slideshow.
const FRAME_WEIGHTS = [
  1.35, 0.9, 0.88, 0.92,
  0.88, 0.9, 0.94, 1.08,
  0.88, 0.94, 1.08, 1.02,
  1.2, 1.12, 1.2, 1.72,
] as const;

type NebuPerformanceSpriteProps = {
  sheet: string;
  durationMs: number;
  delayMs?: number;
  staticFrame?: number;
  className?: string;
  label?: string;
};

function clampFrame(frame: number): number {
  return Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(frame)));
}

export default function NebuPerformanceSprite({
  sheet,
  durationMs,
  delayMs = 0,
  staticFrame,
  className = "",
  label,
}: NebuPerformanceSpriteProps) {
  const frozenFrame =
    staticFrame == null ? null : clampFrame(staticFrame);
  const [animatedFrame, setAnimatedFrame] = useState(0);
  const [started, setStarted] = useState(false);

  const frameDurations = useMemo(() => {
    const safeDuration = Math.max(800, durationMs);
    const totalWeight = FRAME_WEIGHTS.reduce(
      (total, weight) => total + weight,
      0,
    );

    return FRAME_WEIGHTS.map((weight) =>
      Math.max(48, Math.round((safeDuration * weight) / totalWeight)),
    );
  }, [durationMs]);

  useEffect(() => {
    if (frozenFrame !== null) {
      return;
    }

    const timers: number[] = [];
    let elapsed = Math.max(0, delayMs);

    timers.push(
      window.setTimeout(() => {
        setAnimatedFrame(0);
        setStarted(true);
      }, elapsed),
    );

    for (let nextFrame = 1; nextFrame < FRAME_COUNT; nextFrame += 1) {
      elapsed += frameDurations[nextFrame - 1];
      timers.push(
        window.setTimeout(() => {
          setAnimatedFrame(nextFrame);
        }, elapsed),
      );
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [delayMs, frameDurations, frozenFrame, sheet]);

  const frame = frozenFrame ?? animatedFrame;
  const isStarted = frozenFrame !== null || started;
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  const spriteStyle = {
    "--nebu-frame-column": String(column),
    "--nebu-frame-row": String(row),
  } as CSSProperties;

  return (
    <span
      className={`${styles.viewport} ${className}`.trim()}
      data-started={isStarted ? "true" : "false"}
      data-frame={frame}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={sheet}
        alt=""
        draggable={false}
        className={styles.sheet}
        style={spriteStyle}
      />
    </span>
  );
}
