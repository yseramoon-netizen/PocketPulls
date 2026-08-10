"use client";

import Link from "next/link";
import {
  Suspense,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import {
  getAuthErrorDetails,
  getAuthErrorMessage,
} from "@/lib/auth/helpers";
import {
  clearPendingRegistration,
  type PendingRegistration,
  readPendingRegistration,
  rememberPendingRegistration,
  resendSignupConfirmation,
  secondsUntilVerificationResend,
} from "@/lib/auth/pending-registration";

function safeNextPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/admin") ||
    value.startsWith("/sign-in")
  ) {
    return "/hq";
  }

  return value;
}

async function hasPlayerProfile(userId: string): Promise<boolean> {
  const result = await supabase
    .from("player_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return Boolean(result.data);
}

async function ensurePlayerProfile(userId: string): Promise<boolean> {
  if (await hasPlayerProfile(userId)) {
    return true;
  }

  const { error } = await supabase.rpc("complete_player_registration");

  if (error) {
    throw error;
  }

  return hasPlayerProfile(userId);
}

function PlayerSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkPlayerSession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !data.session) {
          if (active) {
            setPendingRegistration(readPendingRegistration());
            setChecking(false);
          }
          return;
        }

        const playerExists = await ensurePlayerProfile(data.session.user.id);

        if (playerExists) {
          if (active) {
            clearPendingRegistration();
            router.replace(nextPath);
            router.refresh();
          }
          return;
        }

        // V18 migration path: an old Shaymin admin session may still be stored
        // in the legacy shared player slot. Remove it locally only; the new
        // isolated admin session uses a different storage key and is untouched.
        await supabase.auth.signOut({ scope: "local" });

        if (active) {
          setChecking(false);
        }
      } catch (sessionFailure: unknown) {
        console.warn("Player sign-in session check failed:", sessionFailure);
        if (active) {
          setError(
            getAuthErrorMessage(
              sessionFailure,
              "Your confirmed account could not finish preparing its player profile.",
            ),
          );
          setChecking(false);
        }
      }
    }

    void checkPlayerSession();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

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
      const refreshed = await resendSignupConfirmation(
        pendingRegistration.email,
        pendingRegistration.nextPath,
      );
      setPendingRegistration(refreshed);
      setResendMessage("A new verification email has been sent.");
    } catch (failure: unknown) {
      setError(
        getAuthErrorMessage(
          failure,
          "The verification email could not be resent.",
        ),
      );
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Enter your trainer email and password.");
      return;
    }

    setSigningIn(true);
    setError("");

    try {
      // Drop any expired or half-created browser session before asking Auth to
      // create a fresh password session. This matters when confirmation was
      // completed on another device.
      await supabase.auth.signOut({
        scope: "local",
      });

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError || !data.session) {
        const details = getAuthErrorDetails(
          signInError,
          "Nebu could not sign you in.",
        );

        if (
          details.code === "email_not_confirmed" ||
          details.message.toLowerCase().includes("confirm your email")
        ) {
          const remembered = readPendingRegistration();
          const pending = rememberPendingRegistration({
            email: cleanEmail,
            nextPath,
            lastSentAt:
              remembered?.email === cleanEmail
                ? remembered.lastSentAt
                : 0,
          });
          setPendingRegistration(pending);
        }

        throw signInError || new Error("No trainer session was returned.");
      }

      const playerExists = await ensurePlayerProfile(data.session.user.id);

      if (!playerExists) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error(
          "That account is not an ancientpulls player account. Use the admin sign-in if this is an administrator account.",
        );
      }

      clearPendingRegistration();
      router.replace(nextPath);
      router.refresh();
    } catch (failure: unknown) {
      console.error("Player sign-in error:", failure);
      setError(
        getAuthErrorMessage(failure, "Nebu could not sign you in."),
      );
      setSigningIn(false);
    }
  }

  if (checking) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_34%),radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#070922_0%,#030513_55%,#02030d_100%)]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-1 animate-spin rounded-full border border-transparent border-r-cyan-100/45 border-t-yellow-100/80 [animation-duration:2.6s]" />
            <img src="/ancient-pulls/celestial-cat.png" alt="" draggable={false} className="relative h-20 w-20 object-contain animate-[bounce_3.5s_ease-in-out_infinite]" />
          </div>
          <p className="mt-5 text-sm font-black text-yellow-50/70">Checking your constellation...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_20%_75%,rgba(250,204,21,0.07),transparent_28%),linear-gradient(180deg,#070922_0%,#030513_55%,#02030d_100%)]" />

      {Array.from({ length: 18 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute animate-pulse rounded-full bg-yellow-100/70 shadow-[0_0_10px_rgba(254,249,195,0.65)]"
          style={{
            left: `${(index * 37 + 8) % 94}%`,
            top: `${(index * 53 + 7) % 88}%`,
            width: `${2 + (index % 3)}px`,
            height: `${2 + (index % 3)}px`,
            animationDelay: `${(index % 7) * 240}ms`,
          }}
        />
      ))}

      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-violet-100/15 bg-[#080a25]/90 shadow-[0_40px_140px_rgba(0,0,0,0.58)] backdrop-blur-3xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[38rem] items-center justify-center overflow-hidden border-r border-white/10 lg:flex">
          <div className="absolute h-[26rem] w-[26rem] rounded-full border border-yellow-100/15 animate-spin [animation-duration:18s]" />
          <div className="absolute h-[20rem] w-[31rem] rounded-[50%] border border-cyan-100/10 animate-spin [animation-duration:24s] [animation-direction:reverse]" />
          <div className="absolute h-64 w-64 rounded-full bg-yellow-200/12 blur-[70px]" />
          <img src="/ancient-pulls/celestial-cat.png" alt="Nebu" draggable={false} className="relative z-10 w-64 object-contain animate-[bounce_4.5s_ease-in-out_infinite] drop-shadow-[0_30px_42px_rgba(0,0,0,0.5)]" />
        </div>

        <div className="p-6 sm:p-9 lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
            ancientpulls · Nebu
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Return to your wishes
          </h1>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/45">
            Player and admin sessions are separate. Signing in here always returns you to the ancientpulls constellation.
          </p>

          {pendingRegistration ? (
            <div className="mt-6 rounded-2xl border border-cyan-100/20 bg-cyan-300/[0.08] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100/70">
                Email confirmation still pending
              </p>
              <p className="mt-2 break-all text-sm font-black text-white">
                {pendingRegistration.email}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/60">
                This browser only remembers the original pending screen. If
                you confirmed on another device, try signing in below; this
                reminder clears automatically as soon as Supabase accepts it.
              </p>
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resending}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-black text-[#101427] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending ? "Sending verification..." : "Resend verification email"}
              </button>
              {resendMessage ? (
                <p className="mt-3 text-xs font-bold text-cyan-50">
                  {resendMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  clearPendingRegistration();
                  setPendingRegistration(null);
                  setResendMessage("");
                  setError("");
                }}
                disabled={resending}
                className="mt-3 w-full text-center text-xs font-black text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white"
              >
                I already confirmed it — hide this reminder
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-black">Trainer email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                disabled={signingIn}
                className="mt-2 min-h-14 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-cyan-100/30"
                placeholder="trainer@example.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black">Password</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={signingIn}
                  className="min-h-14 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 pr-20 text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-cyan-100/30"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-5 text-xs font-black uppercase tracking-[0.1em] text-white/35 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={signingIn}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_18px_50px_rgba(103,232,249,0.12)] transition hover:brightness-105 disabled:opacity-50"
            >
              {signingIn ? "Nebu is opening the way..." : "Sign in to ancientpulls"}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs font-black">
            <Link href="/create-account" className="text-cyan-100/50 hover:text-white">
              Create a trainer account
            </Link>
            <Link href="/admin/sign-in" className="text-emerald-100/40 hover:text-white">
              ancientpulls admin sign-in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function PlayerSignInPage() {
  return (
    <Suspense>
      <PlayerSignInContent />
    </Suspense>
  );
}
