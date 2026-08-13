"use client";

import { type CSSProperties, useEffect, useState } from "react";

import {
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  readNebuSkin,
} from "@/lib/player/nebu";

import styles from "./CosmicNebuAmbient.module.css";

const MOTES = Array.from({ length: 10 }, (_, index) => index);

export default function CosmicNebuAmbient() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(readNebuSkin() === "cosmic_nebu");
    const frame = window.requestAnimationFrame(sync);
    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;
      if (isNebuSkinKey(key)) setActive(key === "cosmic_nebu");
    };

    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className={styles.ambient}
      data-pocketpulls-ambient="heavy"
      aria-hidden="true"
    >
      <span className={styles.nebula} />
      <span className={styles.lensingArc} />
      <span className={styles.constellationLine} />
      <span className={styles.comet} />
      <span className={styles.cometSecond} />
      <span className={styles.orbit}><i /><i /><i /></span>
      <span className={styles.motes}>
        {MOTES.map((index) => (
          <i
            key={index}
            style={{
              "--mote-x": `${7 + ((index * 31) % 88)}%`,
              "--mote-y": `${8 + ((index * 47) % 82)}%`,
              "--mote-delay": `${index * -0.73}s`,
              "--mote-duration": `${6.5 + (index % 4) * 1.2}s`,
            } as CSSProperties}
          />
        ))}
      </span>
    </div>
  );
}
