"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import AsterismSigil from "@/components/player/AsterismSigil";
import { supabase } from "@/lib/supabase";

import styles from "./WishDetailsDialog.module.css";

type WishDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
};

type OddsRow = {
  rarity?: unknown;
  cards_in_pool?: unknown;
  chance_percent?: unknown;
};

type ChaseCardRow = {
  card_id?: unknown;
  name?: unknown;
  set_name?: unknown;
  card_no?: unknown;
  rarity?: unknown;
  rarity_display_name?: unknown;
  market_value?: unknown;
  image_url?: unknown;
};

type ParsedOdds = {
  rarity: string;
  cards: number;
  chance: number;
};

type ChaseCard = {
  id: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  marketValue: number;
  imageUrl: string | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatChance(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function oneIn(value: number): string {
  if (value <= 0) return "—";
  const result = 100 / value;
  return `About 1 in ${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: result < 10 ? 1 : 0,
  }).format(result)}`;
}

export default function WishDetailsDialog({ open, onClose }: WishDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odds, setOdds] = useState<ParsedOdds[]>([]);
  const [chaseCards, setChaseCards] = useState<ChaseCard[]>([]);
  const [cosmicIssueNumber, setCosmicIssueNumber] = useState<number | null>(null);
  const [cosmicBinderIssueNumber, setCosmicBinderIssueNumber] = useState<number | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [oddsResult, chaseResult, cosmicResult, cosmicBinderResult] = await Promise.all([
      supabase.rpc("get_player_wish_odds"),
      supabase.rpc("get_player_wish_chase_cards", { p_limit: 5 }),
      supabase
        .from("cosmic_nebu_ownerships")
        .select("issue_number")
        .maybeSingle(),
      supabase
        .from("cosmic_binder_ownerships")
        .select("issue_number")
        .maybeSingle(),
    ]);

    if (oddsResult.error || chaseResult.error) {
      console.error("Wish details error:", oddsResult.error || chaseResult.error);
      setError("The live prize details could not be read right now.");
      setLoading(false);
      return;
    }

    const nextOdds = (Array.isArray(oddsResult.data) ? oddsResult.data : [])
      .map((row) => row as OddsRow)
      .map((row) => ({
        rarity: readString(row.rarity, "Other"),
        cards: Math.max(0, Math.floor(toNumber(row.cards_in_pool))),
        chance: Math.max(0, toNumber(row.chance_percent)),
      }))
      .filter((row) => row.cards > 0 && row.chance > 0);

    const nextCards = (Array.isArray(chaseResult.data) ? chaseResult.data : [])
      .map((row) => row as ChaseCardRow)
      .map((row) => ({
        id: readString(row.card_id, "unknown-card"),
        name: readString(row.name, "Mystery card"),
        setName: readString(row.set_name, "Unknown set"),
        cardNumber:
          typeof row.card_no === "string" && row.card_no.trim()
            ? row.card_no.trim()
            : null,
        rarity: readString(row.rarity, readString(row.rarity_display_name, "Other")),
        marketValue: Math.max(0, toNumber(row.market_value)),
        imageUrl:
          typeof row.image_url === "string" && row.image_url.trim()
            ? row.image_url.trim()
            : null,
      }));

    const issue = cosmicResult.error
      ? 0
      : Math.max(0, Math.floor(toNumber(cosmicResult.data?.issue_number)));
    const binderIssue = cosmicBinderResult.error
      ? 0
      : Math.max(0, Math.floor(toNumber(cosmicBinderResult.data?.issue_number)));

    setOdds(nextOdds);
    setChaseCards(nextCards);
    setCosmicIssueNumber(issue > 0 ? issue : null);
    setCosmicBinderIssueNumber(binderIssue > 0 ? binderIssue : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const loadTimer = window.setTimeout(() => {
      void loadDetails();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(loadTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadDetails, onClose, open]);

  const totalCards = useMemo(
    () => odds.reduce((sum, row) => sum + row.cards, 0),
    [odds],
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-details-title"
      >
        <header className={styles.header}>
          <div>
            <p>Inside the constellation</p>
            <h2 id="wish-details-title">What can one wish uncover?</h2>
            <span>
              Live cards and rarity percentages from the currently enabled summon pool.
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close wish details">
            ×
          </button>
        </header>

        <div className={styles.scrollArea}>
          {error ? (
            <div className={styles.errorBox}>
              <p>{error}</p>
              <button type="button" onClick={() => void loadDetails()}>Try again</button>
            </div>
          ) : null}

          <article className={styles.cosmicPrize}>
            <div className={styles.cosmicGlow} aria-hidden="true" />
            <img
              src="/ancient-pulls/skins/cosmic-nebu/portrait.webp"
              alt="Cosmic Nebu, the ultimate Ancient Pulls discovery"
              draggable={false}
            />
            <div className={styles.cosmicCopy}>
              <p>✦ The ultimate prize</p>
              <h3>Cosmic Nebu</h3>
              <strong>1 in 100,000 · 0.001% per completed wish</strong>
              <span>
                An independent permanent cosmetic discovery. Cosmic Nebu is awarded alongside
                your card, receives a chronological issue number, and never changes card odds.
              </span>
              {cosmicIssueNumber ? (
                <div className={styles.ownedBadge}>
                  Discovered · #{String(cosmicIssueNumber).padStart(6, "0")}
                </div>
              ) : (
                <div className={styles.unfoundBadge}>Still hidden in your constellation</div>
              )}
            </div>
          </article>

          <article className={styles.cosmicBinderPrize}>
            <div className={styles.cosmicBinderMini} aria-hidden="true">
              <AsterismSigil seed="wish-details-cosmic-binder" points={9} />
              <span />
            </div>
            <div className={styles.cosmicBinderCopy}>
              <p>✦ Separate legendary artifact</p>
              <h3>Cosmic Binder</h3>
              <strong>1 in 50,000 · 0.002% per completed wish</strong>
              <span>
                Rolled independently from Cosmic Nebu and your card. It is permanent,
                uniquely numbered and unlocks the living Cosmic Binder style.
              </span>
            </div>
            {cosmicBinderIssueNumber ? (
              <div className={styles.ownedBadge}>
                Discovered · #{String(cosmicBinderIssueNumber).padStart(6, "0")}
              </div>
            ) : (
              <div className={styles.unfoundBadge}>Undiscovered</div>
            )}
          </article>

          <div className={styles.sectionHeading}>
            <div>
              <p>Chase cards</p>
              <h3>Five greatest treasures currently summonable</h3>
            </div>
            <span>{loading ? "Reading the vault..." : `${totalCards.toLocaleString("en-GB")} card designs in the live pool`}</span>
          </div>

          {loading ? (
            <div className={styles.cardSkeletons} aria-label="Loading chase cards">
              {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
            </div>
          ) : chaseCards.length > 0 ? (
            <div className={styles.chaseGrid}>
              {chaseCards.map((card, index) => (
                <article className={styles.chaseCard} key={card.id}>
                  <div className={styles.cardRank}>#{index + 1}</div>
                  <div className={styles.cardArtwork}>
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.name} loading="lazy" draggable={false} />
                    ) : (
                      <span>✦</span>
                    )}
                  </div>
                  <div className={styles.cardCopy}>
                    <p>{card.rarity}</p>
                    <h4>{card.name}</h4>
                    <span>{card.setName}{card.cardNumber ? ` · #${card.cardNumber}` : ""}</span>
                    <strong>{card.marketValue > 0 ? formatMoney(card.marketValue) : "Price pending"}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : !error ? (
            <p className={styles.empty}>No chase cards are enabled in the summon pool yet.</p>
          ) : null}

          <div className={styles.sectionHeading}>
            <div>
              <p>Published chances</p>
              <h3>Live rarity odds</h3>
            </div>
            <span>Rarity is selected before the card</span>
          </div>

          {loading ? (
            <div className={styles.oddsSkeleton} />
          ) : (
            <div className={styles.oddsList}>
              {odds.map((row) => (
                <div className={styles.oddsRow} key={row.rarity}>
                  <div className={styles.oddsLabel}>
                    <strong>{row.rarity}</strong>
                    <span>{row.cards.toLocaleString("en-GB")} summonable designs · {oneIn(row.chance)}</span>
                  </div>
                  <div className={styles.oddsBar} aria-hidden="true">
                    <span style={{ width: `${Math.max(1.2, Math.min(100, row.chance))}%` }} />
                  </div>
                  <b>{formatChance(row.chance)}</b>
                </div>
              ))}
            </div>
          )}

          <p className={styles.disclaimer}>
            Market values can move. Physical copy count does
            not secretly change the published rarity odds. The reveal animation never rerolls a result.
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
