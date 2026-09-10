import type { CSSProperties } from "react";

import styles from "./ForestBackground.module.css";

const LEAVES = [
  { left: 10, top: 25, delay: -1.2 },
  { left: 25, top: 45, delay: -4.1 },
  { left: 40, top: 15, delay: -2.8 },
  { left: 55, top: 60, delay: -5.3 },
  { left: 70, top: 30, delay: -0.6 },
  { left: 85, top: 50, delay: -3.6 },
  { left: 15, top: 70, delay: -6.2 },
  { left: 35, top: 55, delay: -1.9 },
  { left: 65, top: 16, delay: -4.8 },
  { left: 92, top: 24, delay: -2.2 },
] as const;

const FAR_TREES = "🌲 🌲 🌲 🌲 🌲 🌲 🌲 🌲 🌲 🌲 🌲 🌲";
const NEAR_TREES = "🌳  🌳  🌳  🌳  🌳  🌳  🌳";
const GRASS = "🌱 ".repeat(42);

export default function ForestBackground() {
  return (
    <div
      aria-hidden="true"
      className={`${styles.root} pointer-events-none absolute inset-0 z-0 overflow-hidden`}
    >
      <div className={styles.moon} />
      <div className={styles.mist} />

      <div className={`${styles.treeRow} ${styles.farForest}`}>{FAR_TREES}</div>
      <div className={`${styles.treeRow} ${styles.nearForest}`}>{NEAR_TREES}</div>
      <div className={styles.grass}>{GRASS}</div>

      {LEAVES.map((leaf, index) => (
        <span
          className={styles.leaf}
          key={`${leaf.left}-${leaf.top}`}
          style={{
            left: `${leaf.left}%`,
            top: `${leaf.top}%`,
            "--forest-delay": `${leaf.delay}s`,
            "--forest-duration": `${6.8 + (index % 3) * 0.8}s`,
          } as CSSProperties}
        >
          🍃
        </span>
      ))}

      <span className={styles.fireflyField} />
      <span className={`${styles.fireflyField} ${styles.fireflyFieldB}`} />
    </div>
  );
}
