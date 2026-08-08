"use client";

import type { CSSProperties } from "react";

import { CardArtwork } from "@/components/player/PlayerUI";
import { getBinderTheme } from "@/lib/player/binder";
import { getPlayerRarityTheme } from "@/lib/player/rarity";

import styles from "./BinderSpread.module.css";

export type BinderDisplayCard = {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string | null;
  quantity?: number;
  isSignature?: boolean;
  anniversaryYears?: number;
};

type BinderSpreadProps = {
  cards: Array<BinderDisplayCard | null>;
  themeKey: string;
  onOpen?: (card: BinderDisplayCard) => void;
  swapSourceId?: string | null;
  onSwapTarget?: (card: BinderDisplayCard) => void;
  readonly?: boolean;
  dimmed?: boolean;
};

export default function BinderSpread({
  cards,
  themeKey,
  onOpen,
  swapSourceId = null,
  onSwapTarget,
  readonly = false,
  dimmed = false,
}: BinderSpreadProps) {
  const theme = getBinderTheme(themeKey);
  const slots = Array.from({ length: 18 }, (_, index) => cards[index] ?? null);
  const left = slots.slice(0, 9);
  const right = slots.slice(9, 18);

  const style = {
    "--binder-cover-base": theme.coverBase,
    "--binder-cover-accent": theme.coverAccent,
    "--binder-page-base": theme.pageBase,
    "--binder-page-glow": theme.pageGlow,
    "--binder-spine-base": theme.spineBase,
    "--binder-ring": theme.ring,
    "--binder-cover-image": theme.imageUrl ? `url(${theme.imageUrl})` : "none",
  } as CSSProperties;

  return (
    <div
      className={`${styles.binder} ${dimmed ? styles.dimmed : ""}`}
      style={style}
      data-theme={theme.key}
    >
      <div className={styles.coverArtwork} aria-hidden="true" />
      <div className={styles.coverEdgeLeft} />
      <BinderPage
        cards={left}
        side="left"
        onOpen={onOpen}
        swapSourceId={swapSourceId}
        onSwapTarget={onSwapTarget}
        readonly={readonly}
      />
      <div className={styles.spine} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className={styles.ring} />
        ))}
      </div>
      <BinderPage
        cards={right}
        side="right"
        onOpen={onOpen}
        swapSourceId={swapSourceId}
        onSwapTarget={onSwapTarget}
        readonly={readonly}
      />
      <div className={styles.coverEdgeRight} />
    </div>
  );
}

function BinderPage({
  cards,
  side,
  onOpen,
  swapSourceId,
  onSwapTarget,
  readonly,
}: {
  cards: Array<BinderDisplayCard | null>;
  side: "left" | "right";
  onOpen?: (card: BinderDisplayCard) => void;
  swapSourceId: string | null;
  onSwapTarget?: (card: BinderDisplayCard) => void;
  readonly: boolean;
}) {
  return (
    <div
      className={`${styles.binderPage} ${
        side === "left" ? styles.leftPage : styles.rightPage
      }`}
    >
      <div className={styles.pageSheen} />
      <div className={styles.pocketGrid}>
        {cards.map((card, index) =>
          card ? (
            <BinderPocket
              key={`${side}-${card.id}`}
              card={card}
              selectedForSwap={swapSourceId === card.id}
              swapMode={Boolean(swapSourceId)}
              onClick={() => {
                if (swapSourceId && onSwapTarget) {
                  onSwapTarget(card);
                  return;
                }

                if (!readonly) {
                  onOpen?.(card);
                  return;
                }

                onOpen?.(card);
              }}
            />
          ) : (
            <div
              key={`empty-${side}-${index}`}
              className={styles.emptyPocket}
              aria-hidden="true"
            >
              <span>✦</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function BinderPocket({
  card,
  selectedForSwap,
  swapMode,
  onClick,
}: {
  card: BinderDisplayCard;
  selectedForSwap: boolean;
  swapMode: boolean;
  onClick: () => void;
}) {
  const rarityTheme = getPlayerRarityTheme(card.rarity);
  const style = {
    "--rarity-colour": rarityTheme.primary,
    "--rarity-glow": rarityTheme.glow,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`${styles.pocket} ${
        selectedForSwap ? styles.swapSelected : ""
      } ${swapMode && !selectedForSwap ? styles.swapCandidate : ""}`}
    >
      <span className={styles.pocketPlastic} />
      {selectedForSwap ? (
        <span className={styles.swapBadge}>Swap from</span>
      ) : null}
      {card.isSignature ? (
        <span className={styles.signatureBadge}>★</span>
      ) : null}
      {(card.quantity || 0) > 1 ? (
        <span className={styles.quantityBadge}>×{card.quantity}</span>
      ) : null}
      {(card.anniversaryYears || 0) > 0 ? (
        <span
          className={styles.anniversaryBadge}
          title={`${card.anniversaryYears} year${card.anniversaryYears === 1 ? "" : "s"} ago today you summoned this card.`}
          aria-label={`${card.anniversaryYears} year${card.anniversaryYears === 1 ? "" : "s"} ago today you summoned this card.`}
        >
          ✦
        </span>
      ) : null}

      <CardArtwork
        name={card.name}
        imageUrl={card.imageUrl}
        rarity={card.rarity}
        className={styles.cardArtwork}
      />
    </button>
  );
}
