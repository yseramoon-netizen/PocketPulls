"use client";

import type { CSSProperties } from "react";

import styles from "./UnownText.module.css";

type UnownTone =
  | "ancient"
  | "holo"
  | "moon"
  | "muted";

type UnownTextProps = {
  text: string;
  size?: string;
  tone?: UnownTone;
  className?: string;
  wrap?: boolean;
  centred?: boolean;
  showTranslation?: boolean;
  translation?: string;
};

const FILE_NAMES: Record<string, string> = {
  "?": "question",
  "!": "exclamation",
};

function getGlyphPath(character: string): string | null {
  const upper = character.toUpperCase();

  if (/^[A-Z]$/.test(upper)) {
    return `/unknown-pulls/unown/${upper.toLowerCase()}.png`;
  }

  if (upper === "?" || upper === "!") {
    return `/unknown-pulls/unown/${FILE_NAMES[upper]}.png`;
  }

  return null;
}

export default function UnownText({
  text,
  size = "2.75rem",
  tone = "ancient",
  className = "",
  wrap = true,
  centred = false,
  showTranslation = true,
  translation,
}: UnownTextProps) {
  const rootStyle = {
    "--unown-size": size,
  } as CSSProperties;

  const readableText = translation || text;

  return (
    <span
      role="img"
      aria-label={readableText}
      title={readableText}
      className={[
        styles.root,
        styles[tone],
        centred ? styles.centred : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={rootStyle}
    >
      <span
        aria-hidden="true"
        className={[
          styles.glyphRow,
          wrap ? styles.wrap : styles.noWrap,
          centred ? styles.glyphRowCentred : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {Array.from(text).map((character, index) => {
          if (character === " ") {
            return (
              <span
                key={`space-${index}`}
                className={styles.space}
              />
            );
          }

          if (character === "-" || character === "—") {
            return (
              <span
                key={`dash-${index}`}
                className={styles.dash}
              />
            );
          }

          if (character === "'" || character === "’") {
            return null;
          }

          const glyphPath = getGlyphPath(character);

          if (!glyphPath) {
            return (
              <span
                key={`${character}-${index}`}
                className={styles.fallback}
              >
                {character}
              </span>
            );
          }

          return (
            <span
              key={`${character}-${index}`}
              className={styles.glyph}
              style={
                {
                  "--glyph-mask": `url("${glyphPath}")`,
                } as CSSProperties
              }
            />
          );
        })}
      </span>

      {showTranslation ? (
        <span
          aria-hidden="true"
          className={styles.translation}
        >
          {readableText}
        </span>
      ) : null}
    </span>
  );
}
