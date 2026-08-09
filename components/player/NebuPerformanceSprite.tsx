"use client";

import { type CSSProperties } from "react";

import styles from "./NebuPerformanceSprite.module.css";

const FRAME_COUNT = 16;

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
  const column = frozenFrame === null ? 0 : frozenFrame % 4;
  const row = frozenFrame === null ? 0 : Math.floor(frozenFrame / 4);
  const spriteStyle = {
    "--nebu-frame-column": String(column),
    "--nebu-frame-row": String(row),
    "--nebu-sprite-duration": `${Math.max(800, durationMs)}ms`,
    "--nebu-sprite-delay": `${Math.max(0, delayMs)}ms`,
  } as CSSProperties;

  return (
    <span
      className={`${styles.viewport} ${className}`.trim()}
      data-static={frozenFrame === null ? "false" : "true"}
      data-frame={frozenFrame ?? undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={sheet}
        alt=""
        draggable={false}
        className={`${styles.sheet} ${
          frozenFrame === null ? styles.animatedSheet : styles.staticSheet
        }`}
        style={spriteStyle}
      />
    </span>
  );
}
