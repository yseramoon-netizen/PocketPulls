"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AuthField, { AUTH_INPUT_CLASS } from "@/components/auth/AuthField";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import {
  type PendingRegistration,
  clearPendingRegistration,
  readPendingRegistration,
  rememberPendingRegistration,
  resendSignupConfirmation,
  secondsUntilVerificationResend,
} from "@/lib/auth/pending-registration";

export default function CheckEmailClient({
  initialEmail,
  initialNextPath,
}: {
  initialEmail: string;
  initialNextPath: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cooldown = secondsUntilVerificationResend(pending, now);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;

      const remembered = readPendingRegistration();
      const restored = initialEmail
        ? remembered?.email === initialEmail
          ? remembered
          : rememberPendingRegistration({
              email: initialEmail,
              nextPath: initialNextPath,
              lastSentAt: 0,
            })
        : remembered;

      if (!initialEmail && restored?.email) {
        setEmail(restored.email);
      }

      setPending(restored);
      setNow(Date.now());
      setRestoring(false);
    });

    return () => {
      active = false;
    };
  }, [initialEmail, initialNextPath]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (resending || restoring) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage(null);
      setErrorMessage("Enter the email address used to create the account.");
      return;
    }

    if (cooldown > 0) {
      setErrorMessage(null);
      setMessage(
        `The first email was sent successfully. Another can be sent in ${cooldown}s.`,
      );
      return;
    }

    setResending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const refreshed = await resendSignupConfirmation(
        cleanEmail,
        pending?.nextPath || initialNextPath,
      );

      setEmail(refreshed.email);
      setPending(refreshed);
      setNow(Date.now());
      setMessage(`A new confirmation email was sent to ${refreshed.email}.`);
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

  const signInHref = email
    ? `/sign-in?email=${encodeURIComponent(email.trim().toLowerCase())}`
    : "/sign-in";

  return (
    <AuthShell
      eyebrow="One final step"
      title="Check Your Email"
      description="Your trainer identity has been created, but the email address must be confirmed before the gateway can open."
      storyTitle="A symbol becomes real when it is recognised"
      footer={
        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-black text-white/75 hover:bg-white/10 hover:text-white"
        >
          Return to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-cyan-100/20 bg-cyan-300/[0.08] p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100/70">
            Confirmation sent to
          </p>

          {email ? (
            <p className="mt-2 break-all text-lg font-black text-white">
              {email}
            </p>
          ) : (
            <div className="mt-4">
              <AuthField label="Email address">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="trainer@example.com"
                  disabled={resending}
                  className={AUTH_INPUT_CLASS}
                />
              </AuthField>
            </div>
          )}

          <p className="mt-3 text-sm font-semibold leading-6 text-white/60">
            Open the message from ancientpulls and press the confirmation link.
            The link returns here and completes your profile automatically.
          </p>
        </div>

        {message ? <AuthMessage tone="info">{message}</AuthMessage> : null}
        {errorMessage ? <AuthMessage tone="error">{errorMessage}</AuthMessage> : null}

        <button
          type="button"
          onClick={() => void resend()}
          disabled={resending || restoring}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-100 via-violet-200 to-pink-200 px-5 text-sm font-black text-[#111329] shadow-[0_14px_38px_rgba(103,232,249,0.12)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-65"
        >
          {resending
            ? "Sending confirmation email..."
            : restoring
              ? "Preparing confirmation..."
              : "Resend confirmation email"}
        </button>

        {!restoring && cooldown > 0 ? (
          <p className="text-center text-xs font-bold text-white/55">
            Another email can be sent in {cooldown}s.
          </p>
        ) : null}

        <Link
          href={signInHref}
          onClick={() => {
            // Confirmation may have happened on another device. The local
            // reminder must not trap this browser on a stale pending screen.
            clearPendingRegistration();
          }}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-5 text-sm font-black text-white/75 hover:bg-white/10 hover:text-white"
        >
          I already confirmed it — sign in
        </Link>
      </div>
    </AuthShell>
  );
}
