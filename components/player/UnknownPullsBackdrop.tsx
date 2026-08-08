"use client";

import type { CSSProperties } from "react";

import styles from "./UnknownPullsBackdrop.module.css";

type UnownTraveller = {
  glyph: string;
  lane: string;
  depth: "far" | "mid" | "near";
  size: number;
  top: string;
  duration: number;
  delay: number;
  drift: number;
  rotation: number;
  rare?: boolean;
  reverse?: boolean;
};

const TRAVELLERS: UnownTraveller[] = [
  { glyph: "u", lane: "laneA", depth: "far", size: 18, top: "8%", duration: 42, delay: -7, drift: -24, rotation: 14 },
  { glyph: "n", lane: "laneB", depth: "mid", size: 25, top: "15%", duration: 31, delay: -19, drift: 38, rotation: -12 },
  { glyph: "k", lane: "laneC", depth: "far", size: 16, top: "23%", duration: 48, delay: -34, drift: -35, rotation: 18 },
  { glyph: "o", lane: "laneD", depth: "near", size: 32, top: "31%", duration: 27, delay: -11, drift: 28, rotation: -18 },
  { glyph: "w", lane: "laneE", depth: "mid", size: 23, top: "39%", duration: 36, delay: -28, drift: -16, rotation: 11 },
  { glyph: "n", lane: "laneA", depth: "far", size: 14, top: "47%", duration: 51, delay: -16, drift: 31, rotation: -8 },
  { glyph: "p", lane: "laneC", depth: "mid", size: 27, top: "54%", duration: 33, delay: -25, drift: -29, rotation: 17 },
  { glyph: "u", lane: "laneB", depth: "near", size: 30, top: "62%", duration: 29, delay: -4, drift: 21, rotation: -15 },
  { glyph: "l", lane: "laneE", depth: "far", size: 17, top: "70%", duration: 45, delay: -38, drift: -22, rotation: 12 },
  { glyph: "l", lane: "laneD", depth: "mid", size: 22, top: "78%", duration: 37, delay: -13, drift: 33, rotation: -11 },
  { glyph: "s", lane: "laneA", depth: "far", size: 15, top: "87%", duration: 53, delay: -31, drift: -28, rotation: 19 },
  { glyph: "question", lane: "laneC", depth: "mid", size: 20, top: "18%", duration: 40, delay: -36, drift: 17, rotation: -17 },
  { glyph: "x", lane: "laneB", depth: "far", size: 13, top: "44%", duration: 56, delay: -23, drift: -19, rotation: 8 },
  { glyph: "m", lane: "laneE", depth: "near", size: 34, top: "73%", duration: 30, delay: -22, drift: 26, rotation: -14 },
  { glyph: "a", lane: "laneD", depth: "mid", size: 24, top: "10%", duration: 35, delay: -30, drift: 30, rotation: 13 },
  { glyph: "r", lane: "laneA", depth: "far", size: 16, top: "58%", duration: 49, delay: -42, drift: -30, rotation: -16 },
  { glyph: "e", lane: "laneC", depth: "near", size: 29, top: "84%", duration: 28, delay: -9, drift: 19, rotation: 16 },
  { glyph: "g", lane: "laneB", depth: "mid", size: 21, top: "27%", duration: 38, delay: -17, drift: -24, rotation: -10 },
  { glyph: "d", lane: "laneE", depth: "far", size: 14, top: "66%", duration: 54, delay: -47, drift: 22, rotation: 12 },
  { glyph: "y", lane: "laneD", depth: "mid", size: 26, top: "91%", duration: 34, delay: -26, drift: -20, rotation: -12 },
  { glyph: "exclamation", lane: "rareLane", depth: "near", size: 36, top: "36%", duration: 52, delay: -43, drift: -8, rotation: 8, rare: true },
  { glyph: "z", lane: "returnLane", depth: "far", size: 16, top: "81%", duration: 58, delay: -29, drift: 18, rotation: -10, reverse: true },
];

export default function UnknownPullsBackdrop() {
  return (
    <div aria-hidden="true" className={styles.backdrop}>
      <div className={styles.deepSpace} />
      <div className={styles.ancientMewGhost} data-pocketpulls-ambient="heavy" />
      <div className={styles.papyrusWash} />
      <div className={styles.prismField} data-pocketpulls-ambient="heavy" />
      <div className={styles.holoDust} data-pocketpulls-ambient="heavy" />

      <div className={styles.unownField} data-pocketpulls-ambient="heavy">
        {TRAVELLERS.map((traveller, index) => {
          const style = {
            "--traveller-size": `${traveller.size}px`,
            "--traveller-top": traveller.top,
            "--traveller-duration": `${traveller.duration}s`,
            "--traveller-delay": `${traveller.delay}s`,
            "--traveller-drift": `${traveller.drift}px`,
            "--traveller-rotation": `${traveller.rotation}deg`,
            "--pulse-delay": `${traveller.delay / 2}s`,
          } as CSSProperties;

          return (
            <span
              key={`${traveller.glyph}-${index}`}
              className={[
                styles.traveller,
                styles[traveller.lane],
                styles[traveller.depth],
                traveller.rare ? styles.rare : "",
                traveller.reverse ? styles.reverse : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={style}
            >
              <span className={styles.trail} />
              <span className={styles.wakeSparkOne} />
              <span className={styles.wakeSparkTwo} />
              <span className={styles.halo} />

              <img
                src={`/unknown-pulls/unown/${traveller.glyph}.png`}
                alt=""
                draggable={false}
                className={styles.travellerGlyph}
              />
            </span>
          );
        })}
      </div>

      <div className={styles.nebulaCyan} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaViolet} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaScarlet} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaEmerald} data-pocketpulls-ambient="heavy" />
      <div className={styles.nebulaGold} data-pocketpulls-ambient="heavy" />
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
