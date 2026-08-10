"use client";

import { type CSSProperties } from "react";

import styles from "./NebuPerformanceSprite.module.css";

type NebuPerformanceSpriteProps = {
  sheet: string;
  durationMs: number;
  delayMs?: number;
  staticFrame?: number;
  columns?: number;
  rows?: number;
  className?: string;
  label?: string;
};

function clampFrame(frame: number, frameCount: number): number {
  return Math.min(frameCount - 1, Math.max(0, Math.round(frame)));
}

export default function NebuPerformanceSprite({
  sheet,
  durationMs,
  delayMs = 0,
  staticFrame,
  columns = 4,
  rows = 4,
  className = "",
  label,
}: NebuPerformanceSpriteProps) {
  const safeColumns = Math.max(1, Math.round(columns));
  const safeRows = Math.max(1, Math.round(rows));
  const frameCount = safeColumns * safeRows;
  const frozenFrame =
    staticFrame == null ? null : clampFrame(staticFrame, frameCount);
  const column = frozenFrame === null ? 0 : frozenFrame % safeColumns;
  const row = frozenFrame === null ? 0 : Math.floor(frozenFrame / safeColumns);
  const spriteStyle = {
    "--nebu-sheet-columns": String(safeColumns),
    "--nebu-sheet-rows": String(safeRows),
    "--nebu-frame-x": `${column * (-100 / safeColumns)}%`,
    "--nebu-frame-y": `${row * (-100 / safeRows)}%`,
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
