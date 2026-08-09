"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { PURCHASE_CONSENT_SUMMARY } from "@/lib/player/purchase-consent";
import { supabase } from "@/lib/supabase";

type PurchaseConsentGateProps = {
  displayName: string;
  onAccepted: () => void;
  onSignOut: () => void;
};

function getMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return "Your acknowledgement could not be saved. Please try again.";
}

export default function PurchaseConsentGate({
  displayName,
  onAccepted,
  onSignOut,
}: PurchaseConsentGateProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [randomCardAccepted, setRandomCardAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ready = ageConfirmed && randomCardAccepted && termsAccepted;

  async function accept() {
    if (!ready || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "accept_player_purchase_consent",
        {
          p_age_18: true,
          p_random_physical_card: true,
          p_terms: true,
        },
      );

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || typeof row !== "object" || !("accepted" in row) || row.accepted !== true) {
        throw new Error("Your acknowledgement was not confirmed by the server.");
      }

      onAccepted();
    } catch (error: unknown) {
      setErrorMessage(getMessage(error));
      setSaving(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-4 py-10 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(103,232,249,0.1),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(250,204,21,0.08),transparent_24%),radial-gradient(circle_at_50%_85%,rgba(124,58,237,0.18),transparent_38%)]" />

      <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-yellow-100/15 bg-[#080a22]/94 p-5 shadow-[0_35px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/50 to-transparent" />

        <div className="flex items-start gap-4">
          <div className="relative flex h-16 w-16 flex-none items-center justify-center rounded-2xl border border-yellow-100/12 bg-yellow-100/[0.04]">
            <div className="absolute inset-2 rounded-full bg-yellow-100/10 blur-xl" />
            <img
              src="/ancient-pulls/celestial-cat.png"
              alt=""
              draggable={false}
              className="relative h-12 w-12 object-contain"
            />
          </div>

          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-100/45">
              One-time account confirmation
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Before you continue, {displayName}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/45">
              We have moved the purchase acknowledgement onto the trainer account. Once you confirm it here, you will not have to tick the same notice every time you recharge unless the terms materially change.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <ConsentRow
            checked={ageConfirmed}
            onChange={setAgeConfirmed}
            disabled={saving}
          >
            {PURCHASE_CONSENT_SUMMARY.age}
          </ConsentRow>

          <ConsentRow
            checked={randomCardAccepted}
            onChange={setRandomCardAccepted}
            disabled={saving}
          >
            {PURCHASE_CONSENT_SUMMARY.randomPhysicalCard}
          </ConsentRow>

          <ConsentRow
            checked={termsAccepted}
            onChange={setTermsAccepted}
            disabled={saving}
          >
            <span>
              I agree to the{" "}
              <Link className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2" href="/terms">
                Terms
              </Link>
              {" "}and{" "}
              <Link className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2" href="/rules">
                Wish Rules
              </Link>
              , and I have read the{" "}
              <Link className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2" href="/player-protection">
                Player Protection
              </Link>
              {" "}information.
            </span>
          </ConsentRow>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-red-200/15 bg-red-400/[0.08] p-3 text-sm font-bold text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void accept()}
          disabled={!ready || saving}
          className="mt-5 flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving confirmation..." : "Agree and continue"}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          disabled={saving}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-5 text-xs font-black text-white/45 transition hover:bg-white/[0.07] hover:text-white"
        >
          Sign out instead
        </button>
      </section>
    </main>
  );
}

function ConsentRow({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:bg-white/[0.045]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 flex-none accent-cyan-200"
      />
      <span className="text-xs font-semibold leading-6 text-white/55">
        {children}
      </span>
    </label>
  );
}
