import type { CSSProperties } from "react";

import styles from "./AsterismSigil.module.css";

type AsterismSigilProps = {
  seed: string;
  className?: string;
  points?: number;
};

type Point = {
  x: number;
  y: number;
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createPoints(seed: string, count: number): Point[] {
  const random = createRandom(hashSeed(seed));
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const radius = 28 + random() * 14;
    return {
      x: 50 + Math.cos(angle) * radius + (random() - 0.5) * 8,
      y: 50 + Math.sin(angle) * radius + (random() - 0.5) * 8,
    };
  });
}

function pointText(point: Point): string {
  return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
}

export default function AsterismSigil({
  seed,
  className = "",
  points = 7,
}: AsterismSigilProps) {
  const safeCount = Math.max(5, Math.min(9, Math.floor(points)));
  const stars = createPoints(seed, safeCount);
  const centre = {
    x: 47 + (hashSeed(seed) % 7),
    y: 47 + (hashSeed(`${seed}:centre`) % 7),
  };
  const outerPath = `M ${stars.map(pointText).join(" L ")} Z`;
  const branchPath = [1, Math.floor(safeCount / 2), safeCount - 1]
    .map((index) => `M ${pointText(centre)} L ${pointText(stars[index])}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${styles.sigil} ${className}`.trim()}
      data-asterism-sigil
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.outerPath} pathLength="1" d={outerPath} />
      <path className={styles.branchPath} pathLength="1" d={branchPath} />
      {stars.map((star, index) => (
        <circle
          key={`${star.x}-${star.y}`}
          className={styles.star}
          cx={star.x}
          cy={star.y}
          r={index % 3 === 0 ? 2.3 : 1.45}
          style={{ "--asterism-delay": `${index * 90}ms` } as CSSProperties}
        />
      ))}
      <circle className={styles.core} cx={centre.x} cy={centre.y} r="3.1" />
    </svg>
  );
}
