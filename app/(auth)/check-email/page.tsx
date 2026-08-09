"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { normaliseNextPath } from "@/lib/auth/navigation";
import {
  type PendingRegistration,
  readPendingRegistration,
  rememberPendingRegistration,
  resendSignupConfirmation,
  secondsUntilVerificationResend,
} from "@/lib/auth/pending-registration";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email")?.trim().toLowerCase() || "";
  const queryNext = searchParams.get("next");

  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const email = queryEmail || pending?.email || "";
  const nextPath = normaliseNextPath(queryNext || pending?.nextPath);
  const cooldown = secondsUntilVerificationResend(pending, now);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;

      const remembered = readPendingRegistration();
      const restored = queryEmail
        ? remembered?.email === queryEmail
          ? remembered
          : rememberPendingRegistration({
              email: queryEmail,
              nextPath: normaliseNextPath(queryNext),
              lastSentAt: 0,
            })
        : remembered;

      setPending(restored);
      setNow(Date.now());
      setRestoring(false);
    });

    return () => {
      active = false;
    };
  }, [queryEmail, queryNext]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (!email || cooldown > 0 || resending || restoring) return;

    setResending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const refreshed = await resendSignupConfirmation(
        email,
        nextPath,
      );
      setPending(refreshed);
      setNow(Date.now());
      setMessage("A new confirmation email has been sent.");
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "The confirmation email could not be resent.",
        ),
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      eyebrow="One final step"
      title="Check Your Email"
      description="Your trainer identity has been created, but the email address must be confirmed before the gateway can open."
      storyTitle="A symbol becomes real when it is recognised"
      footer={
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/60 hover:bg-white/10 hover:text-white"
        >
          Return to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.055] p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100/40">
            Confirmation sent to
          </p>
          <p className="mt-2 break-all text-lg font-black text-white">
            {email || "your email address"}
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/38">
            Open the message from Unknown Pulls and press the confirmation link. The link returns you here and completes your profile automatically.
          </p>
        </div>

        {message ? <AuthMessage tone="success">{message}</AuthMessage> : null}
        {errorMessage ? <AuthMessage tone="error">{errorMessage}</AuthMessage> : null}

        <button
          type="button"
          onClick={() => void resend()}
          disabled={!email || cooldown > 0 || resending || restoring}
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-violet-100/15 bg-violet-300/[0.08] px-5 text-sm font-black text-violet-50 transition hover:bg-violet-300/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {resending
            ? "Sending again..."
            : restoring
              ? "Preparing resend..."
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend confirmation email"}
        </button>
      </div>
    </AuthShell>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<AuthLoading title="Preparing email confirmation" />}>
      <CheckEmailContent />
    </Suspense>
  );
}
