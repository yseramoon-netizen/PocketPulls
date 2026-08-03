"use client";

import styles from "./UnknownPullsBackdrop.module.css";

export default function UnknownPullsBackdrop() {
  return (
    <div
      aria-hidden="true"
      className={styles.backdrop}
    >
      <div className={styles.deepSpace} />
      <div className={styles.ancientMewGhost} />
      <div className={styles.papyrusWash} />
      <div className={styles.prismField} />
      <div className={styles.holoDust} />
      <div className={styles.nebulaCyan} />
      <div className={styles.nebulaViolet} />
      <div className={styles.nebulaScarlet} />
      <div className={styles.nebulaEmerald} />
      <div className={styles.nebulaGold} />
      <div className={styles.topGlyphBand} />
      <div className={styles.bottomGlyphBand} />
      <div className={styles.frame} />
      <div className={styles.innerFrame} />
      <div className={styles.cornerTopLeft} />
      <div className={styles.cornerTopRight} />
      <div className={styles.cornerBottomLeft} />
      <div className={styles.cornerBottomRight} />
      <div className={styles.vignette} />
    </div>
  );
}
