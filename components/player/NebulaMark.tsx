/* eslint-disable @next/next/no-img-element -- Player avatars are remote user content and already use the site's validated avatar URLs. */

import type { CSSProperties } from "react";

import type { NebulaRank } from "@/lib/player/nebula-ranks";

import styles from "./NebulaMark.module.css";

type NebulaMarkProps = {
  rank: NebulaRank;
  avatarUrl?: string | null;
  initials: string;
  label: string;
  prime?: boolean;
  current?: boolean;
  size?: "small" | "medium" | "large";
  relativeScale?: number;
};

const STAR_POINTS = Array.from({ length: 18 }, (_, index) => index);

export default function NebulaMark({
  rank,
  avatarUrl = null,
  initials,
  label,
  prime = false,
  current = false,
  size = "medium",
  relativeScale = 1,
}: NebulaMarkProps) {
  const style = {
    "--nebula-primary": rank.primary,
    "--nebula-secondary": rank.secondary,
    "--nebula-core": rank.core,
    "--nebula-relative-scale": String(
      Math.max(0.46, Math.min(1, relativeScale)),
    ),
  } as CSSProperties;

  return (
    <div
      className={styles.nebula}
      style={style}
      data-size={size}
      data-prime={prime ? "true" : "false"}
      data-current={current ? "true" : "false"}
      role="img"
      aria-label={label}
    >
      <span className={styles.outerGlow} />
      <span className={styles.cloudOne} />
      <span className={styles.cloudTwo} />
      <span className={styles.cloudThree} />
      <span className={styles.orbitOne} />
      <span className={styles.orbitTwo} />

      <span className={styles.stars} aria-hidden="true">
        {STAR_POINTS.map((index) => (
          <i
            key={index}
            style={
              {
                "--star-angle": `${index * 137.508}deg`,
                "--star-distance": `${24 + (index % 6) * 9}%`,
                "--star-size": `${1 + (index % 4) * 0.55}px`,
                "--star-delay": `${(index % 7) * -0.37}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>

      <span className={styles.core}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" draggable={false} />
        ) : (
          <strong>{initials.slice(0, 1).toUpperCase()}</strong>
        )}
      </span>

      {prime ? <span className={styles.primeStar} aria-hidden="true">✦</span> : null}
    </div>
  );
}
