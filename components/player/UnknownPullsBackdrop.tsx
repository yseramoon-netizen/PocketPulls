"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import usePageVisible from "@/lib/client/usePageVisible";
import styles from "./UnknownPullsBackdrop.module.css";

export default function UnknownPullsBackdrop() {
  const pathname = usePathname();
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const pageVisible = usePageVisible();

  useEffect(() => {
    const handleCinematicVisibility = (event: Event) => {
      setCinematicOpen(
        Boolean(
          (event as CustomEvent<{ open?: unknown }>).detail?.open,
        ),
      );
    };

    window.addEventListener(
      "pocketpulls:wish-cinematic-visibility",
      handleCinematicVisibility,
    );

    return () => {
      window.removeEventListener(
        "pocketpulls:wish-cinematic-visibility",
        handleCinematicVisibility,
      );
    };
  }, []);

  if (
    pathname === "/constellation" ||
    pathname === "/leaderboard" ||
    pathname === "/wishes/preview" ||
    cinematicOpen ||
    !pageVisible
  ) {
    return null;
  }

  return (
    <div aria-hidden="true" className={styles.backdrop}>
      <div className={styles.deepSpace} />
      <div className={styles.starField} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaCyan} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaViolet} data-pocketpulls-ambient="heavy" />
      <div className={styles.cosmicLattice} data-pocketpulls-ambient="heavy" />
      <div className={styles.cosmicArc} data-pocketpulls-ambient="heavy" />
      <div className={styles.cosmicComet} data-pocketpulls-ambient="heavy" />
      <div className={styles.horizon} />
      <div className={styles.vignette} />
    </div>
  );
}
