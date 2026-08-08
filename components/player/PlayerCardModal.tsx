"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  CardArtwork,
  PlayerSecondaryButton,
  RarityPill,
} from "@/components/player/PlayerUI";
import {
  formatMoney,
  formatWholeNumber,
} from "@/lib/player/format";

export type PlayerCardModalCard = {
  id: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  imageUrl: string | null;
  marketValue: number;
  quantity?: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  isSignature?: boolean;
};

export default function PlayerCardModal({
  card,
  onClose,
  onSetSignature,
  onSwapPosition,
  signatureBusy = false,
  showShippingLink = true,
}: {
  card: PlayerCardModalCard;
  onClose: () => void;
  onSetSignature?: () => void;
  onSwapPosition?: () => void;
  signatureBusy?: boolean;
  showShippingLink?: boolean;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-[#02020f]/92 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} card details`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <article className="relative my-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27] shadow-[0_40px_140px_rgba(0,0,0,0.65)] lg:grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close card details"
          className="absolute right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/35 text-xl text-white/55 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
        >
          ×
        </button>

        <div className="flex min-h-[30rem] items-center justify-center border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
          <CardArtwork
            name={card.name}
            imageUrl={card.imageUrl}
            rarity={card.rarity}
            className="aspect-[0.716] w-full max-w-[21rem] rounded-2xl border border-white/15 shadow-[0_30px_85px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <RarityPill rarity={card.rarity} />

            {card.isSignature ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-yellow-100/20 bg-yellow-100/10 px-3 text-[0.6rem] font-black uppercase tracking-[0.12em] text-yellow-50">
                ★ Signature card
              </span>
            ) : null}
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {card.name}
          </h2>

          <p className="mt-3 text-sm font-semibold text-white/40">
            {card.setName}
            {card.cardNumber
              ? ` · Card #${card.cardNumber}`
              : ""}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <ModalValue
              label="Market value"
              value={formatMoney(card.marketValue)}
            />

            <ModalValue
              label="Owned"
              value={formatWholeNumber(card.quantity || 0)}
            />

            <ModalValue
              label="Available"
              value={formatWholeNumber(
                card.availableQuantity || 0,
              )}
            />

            <ModalValue
              label="Reserved"
              value={formatWholeNumber(
                card.reservedQuantity || 0,
              )}
            />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {onSetSignature ? (
              <PlayerSecondaryButton
                onClick={onSetSignature}
                disabled={signatureBusy || card.isSignature}
                className="flex-1"
              >
                {signatureBusy
                  ? "Saving..."
                  : card.isSignature
                    ? "★ Your signature card"
                    : "Set as signature card"}
              </PlayerSecondaryButton>
            ) : null}

            {onSwapPosition ? (
              <PlayerSecondaryButton
                onClick={onSwapPosition}
                className="flex-1"
              >
                ⇄ Swap position
              </PlayerSecondaryButton>
            ) : null}

            {showShippingLink ? (
              <Link
                href="/shipping"
                onClick={onClose}
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#e7ad46] via-[#48d5ca] to-[#d84f78] px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Shipping centre
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

function ModalValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/27">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-white">
        {value}
      </p>
    </div>
  );
}
