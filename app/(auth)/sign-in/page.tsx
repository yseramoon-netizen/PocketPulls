"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";

import { getAuthErrorDetails, getAuthErrorMessage } from "@/lib/auth/helpers";
import { buildAuthCallbackUrl, normaliseNextPath } from "@/lib/auth/navigation";
import {
  clearPendingRegistration,
  type PendingRegistration,
  readPendingRegistration,
  rememberPendingRegistration,
  resendSignupConfirmation,
  secondsUntilVerificationResend,
} from "@/lib/auth/pending-registration";
import { supabase } from "@/lib/supabase";

type SocialProvider = "google" | "discord";

async function settleWithin<T>(
  request: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: number | null = null;

  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.7A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.7V7.7H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.3l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.7 0 3.2.6 4.3 1.7l3-3A10 10 0 0 0 2.9 7.7l3.3 2.6C7 7.8 9.3 6 12 6Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M20.3 4.7A16.6 16.6 0 0 0 16.2 3l-.5 1a15.3 15.3 0 0 0-7.4 0l-.5-1a16.5 16.5 0 0 0-4.1 1.7C1.1 8.6.4 12.4.8 16.1a16.8 16.8 0 0 0 5 2.5l1.2-1.6-1.7-.8.4-.3a11.7 11.7 0 0 0 12.6 0l.5.3-1.7.8 1.2 1.6a16.7 16.7 0 0 0 5-2.5c.5-4.3-.8-8.1-3-11.4ZM8.8 14.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

function PlayerSignInContent() {
  const searchParams = useSearchParams();
  const nextPath = normaliseNextPath(searchParams.get("next"));
  const callbackError = searchParams.get("oauth_error");

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [error, setError] = useState(callbackError || "");
  const isBusy = signingIn || socialProvider !== null;

  useEffect(() => {
    let active = true;

    async function checkPlayerSession() {
      try {
        const { data, error: sessionError } = await settleWithin(
          supabase.auth.getSession(),
          4_000,
          "Session check timed out.",
        );
        if (sessionError || !data.session) {
          if (active) {
            setPendingRegistration(readPendingRegistration());
            setChecking(false);
          }
          return;
        }

        if (active) {
          clearPendingRegistration();
          window.location.replace(nextPath);
        }
      } catch (sessionFailure: unknown) {
        console.warn("Player sign-in session check failed:", sessionFailure);
        if (active) {
          setError(getAuthErrorMessage(
            sessionFailure,
            "Your confirmed account could not finish preparing its player profile.",
          ));
          setChecking(false);
        }
      }
    }

    void checkPlayerSession();
    return () => { active = false; };
  }, [nextPath]);

  async function handleResendVerification() {
    if (!pendingRegistration || resending) return;
    const cooldown = secondsUntilVerificationResend(pendingRegistration);
    if (cooldown > 0) {
      setResendMessage(`You can send another email in ${cooldown}s.`);
      return;
    }

    setResending(true);
    setResendMessage("");
    setError("");
    try {
      const refreshed = await resendSignupConfirmation(pendingRegistration.email, pendingRegistration.nextPath);
      setPendingRegistration(refreshed);
      setResendMessage("A new verification email has been sent.");
    } catch (failure: unknown) {
      setError(getAuthErrorMessage(failure, "The verification email could not be resent."));
    } finally {
      setResending(false);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    if (isBusy) return;
    setSocialProvider(provider);
    setError("");

    try {
      // Clear a stale browser-only player session before beginning PKCE. This
      // does not touch any separately stored Ancient Pulls admin session.
      await settleWithin(
        supabase.auth.signOut({ scope: "local" }),
        2_000,
        "Local session cleanup timed out.",
      ).catch(() => undefined);
      const { data, error: oauthError } = await settleWithin(
        supabase.auth.signInWithOAuth({
          provider: provider as Provider,
          options: {
            redirectTo: buildAuthCallbackUrl(nextPath),
            skipBrowserRedirect: true,
          },
        }),
        10_000,
        "Provider sign-in took too long. Try again.",
      );

      if (oauthError) throw oauthError;
      if (!data.url) throw new Error("Supabase did not return a provider sign-in URL.");

      window.location.assign(data.url);
    } catch (failure: unknown) {
      setError(getAuthErrorMessage(
        failure,
        `Nebu could not open ${provider === "google" ? "Google" : "Discord"} sign-in.`,
      ));
      setSocialProvider(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Enter your trainer email and password.");
      return;
    }

    setSigningIn(true);
    setError("");
    try {
      const { data, error: signInError } = await settleWithin(
        supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        15_000,
        "Sign-in took too long. Check your connection and try again.",
      );

      if (signInError || !data.session) {
        const details = getAuthErrorDetails(signInError, "Nebu could not sign you in.");
        if (details.code === "email_not_confirmed" || details.message.toLowerCase().includes("confirm your email")) {
          const remembered = readPendingRegistration();
          setPendingRegistration(rememberPendingRegistration({
            email: cleanEmail,
            nextPath,
            lastSentAt: remembered?.email === cleanEmail ? remembered.lastSentAt : 0,
          }));
        }
        throw signInError || new Error("No trainer session was returned.");
      }

      clearPendingRegistration();
      window.location.replace(nextPath);
    } catch (failure: unknown) {
      console.error("Player sign-in error:", failure);
      setError(getAuthErrorMessage(failure, "Nebu could not sign you in."));
      setSigningIn(false);
    }
  }

  if (checking) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.1),transparent_35%),linear-gradient(180deg,#06081d_0%,#02030d_100%)]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-1 animate-spin rounded-full border border-transparent border-r-cyan-100/40 border-t-yellow-100/70 [animation-duration:2.6s]" />
            <Image
              src="/ancient-pulls/celestial-cat.webp"
              alt=""
              width={56}
              height={56}
              priority
              draggable={false}
              className="relative h-14 w-14 object-contain"
            />
          </div>
          <p className="mt-5 text-sm font-black text-white/68">Checking session</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] items-start justify-center overflow-x-hidden bg-[#02030d] px-4 py-6 text-white sm:items-center sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.1),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#06081d_0%,#02030d_100%)]" />

      <section className="relative z-10 w-full max-w-[30rem] rounded-2xl border border-white/10 bg-[#080b20]/94 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.035]">
            <Image
              src="/ancient-pulls/celestial-cat.webp"
              alt=""
              width={44}
              height={44}
              priority
              draggable={false}
              className="h-11 w-11 object-contain"
            />
          </div>
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100/45">
              Ancient Pulls
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Welcome back</h1>
          </div>
        </div>

        {pendingRegistration ? (
          <div className="mt-5 rounded-xl border border-cyan-100/18 bg-cyan-300/[0.06] p-4">
            <p className="text-xs font-black text-cyan-50/80">Confirm your email</p>
            <p className="mt-1 truncate text-xs font-semibold text-white/55">{pendingRegistration.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resending}
                className="min-h-10 rounded-lg bg-cyan-100 px-3 text-xs font-black text-[#101427] disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPendingRegistration();
                  setPendingRegistration(null);
                  setResendMessage("");
                  setError("");
                }}
                disabled={resending}
                className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-white/55 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
            {resendMessage ? <p className="mt-2 text-xs font-bold text-cyan-50/70">{resendMessage}</p> : null}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-200/18 bg-red-400/[0.07] px-4 py-3 text-sm font-bold leading-6 text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleSocialSignIn("google")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-black transition hover:bg-white/[0.075] disabled:opacity-50"
          >
            <GoogleIcon />
            {socialProvider === "google" ? "Opening..." : "Google"}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleSocialSignIn("discord")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-indigo-200/18 bg-[#5865f2]/[0.11] px-3 text-sm font-black text-indigo-50 transition hover:bg-[#5865f2]/[0.18] disabled:opacity-50"
          >
            <DiscordIcon />
            {socialProvider === "discord" ? "Opening..." : "Discord"}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-white/28">or</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-black text-white/68">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              disabled={isBusy}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-base font-bold text-white outline-none placeholder:text-white/20 focus:border-cyan-100/30 disabled:opacity-50"
              placeholder="trainer@example.com"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-white/68">Password</span>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={isBusy}
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 pr-16 text-base font-bold text-white outline-none placeholder:text-white/20 focus:border-cyan-100/30 disabled:opacity-50"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={isBusy}
                className="absolute inset-y-0 right-0 px-4 text-[0.65rem] font-black uppercase tracking-[0.08em] text-white/38 hover:text-white disabled:opacity-50"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={isBusy}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:brightness-105 disabled:opacity-50"
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-black">
          <Link href="/forgot-password" className="text-white/48 hover:text-white">Forgot password?</Link>
          <Link href="/create-account" className="text-cyan-100/66 hover:text-white">Create account</Link>
        </div>

        <Link href="/admin/sign-in" className="mt-5 block border-t border-white/8 pt-4 text-center text-[0.68rem] font-black text-white/28 hover:text-white/60">
          Admin sign-in
        </Link>
      </section>
    </main>
  );
}

export default function PlayerSignInPage() {
  return <Suspense><PlayerSignInContent /></Suspense>;
}
