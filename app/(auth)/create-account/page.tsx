"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

function getSafeNextPath(): string {
  if (typeof window === "undefined") {
    return "/wishes";
  }

  const value = new URLSearchParams(window.location.search).get("next");

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/wishes";
  }

  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

export default function CreateAccountPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signInHref = useMemo(() => {
    const nextPath =
      typeof window === "undefined" ? "/wishes" : getSafeNextPath();

    return `/sign-in?next=${encodeURIComponent(nextPath)}`;
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (session) {
          router.replace(getSafeNextPath());
          router.refresh();
          return;
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setErrorMessage(null);
    setCreatedMessage(null);

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setErrorMessage("Choose a display name with at least 2 characters.");
      return;
    }

    if (cleanName.length > 40) {
      setErrorMessage("Your display name must be 40 characters or fewer.");
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const nextPath = getSafeNextPath();

      const {
        data: { session },
        error,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanName,
          },
          emailRedirectTo: `${window.location.origin}${nextPath}`,
        },
      });

      if (error) {
        throw error;
      }

      if (session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setCreatedMessage(
        "Your account was created. Check your email and confirm the account before signing in.",
      );
      setSubmitting(false);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Jirachi could not create your account. Try again in a moment.",
        ),
      );
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return <AuthLoadingScreen />;
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#040617] px-4 py-10 text-white">
      <AuthBackground />

      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#080a24]/95 shadow-[0_40px_140px_rgba(0,0,0,0.65)] backdrop-blur-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <AuthStory />

        <div className="p-6 sm:p-9 lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
            New trainer
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Create your account
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-white/40">
            Your profile, wish wallet and personal collection will be created
            automatically.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
                maxLength={40}
                placeholder="Pokemon Trainer"
                disabled={submitting}
                className="min-h-13 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-yellow-200/40 focus:ring-2 focus:ring-yellow-200/10 disabled:opacity-50"
              />
            </Field>

            <Field label="Email address">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="trainer@example.com"
                disabled={submitting}
                className="min-h-13 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-cyan-200/40 focus:ring-2 focus:ring-cyan-200/10 disabled:opacity-50"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  disabled={submitting}
                  className="min-h-13 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-violet-200/40 focus:ring-2 focus:ring-violet-200/10 disabled:opacity-50"
                />
              </Field>

              <Field label="Confirm password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  disabled={submitting}
                  className="min-h-13 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-violet-200/40 focus:ring-2 focus:ring-violet-200/10 disabled:opacity-50"
                />
              </Field>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200/15 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold leading-6 text-red-100">
                {errorMessage}
              </div>
            ) : null}

            {createdMessage ? (
              <div className="rounded-xl border border-emerald-200/15 bg-emerald-400/[0.07] px-4 py-3 text-sm font-semibold leading-6 text-emerald-100">
                {createdMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || Boolean(createdMessage)}
              className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_0_35px_rgba(253,224,71,0.12)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating your star..." : "Create account"}
            </button>
          </form>

          <div className="mt-7 border-t border-white/10 pt-6 text-center">
            <p className="text-sm font-semibold text-white/40">
              Already have an account?
            </p>

            <Link
              href={signInHref}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-300/[0.07] px-5 text-sm font-black text-violet-50 transition hover:bg-violet-300/10"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>

      {children}
    </label>
  );
}

function AuthStory() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/10 bg-gradient-to-br from-violet-400/10 via-cyan-300/[0.05] to-yellow-200/[0.07] p-10 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-400/15 blur-[90px]" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-[90px]" />

      <div className="relative">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-4 rounded-full bg-yellow-200/20 blur-2xl" />

          <img
            src="/jirachi.png"
            alt=""
            draggable={false}
            className="relative z-10 h-28 w-28 object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,0.4)]"
          />

          <span className="absolute text-7xl text-yellow-100/20">*</span>
        </div>

        <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-cyan-100/40">
          Begin your journey
        </p>

        <h2 className="mt-3 text-4xl font-black leading-tight text-white">
          Every collection begins with a single wish.
        </h2>

        <p className="mt-5 max-w-md text-sm font-semibold leading-7 text-white/45">
          Browse the full catalogue, collect real cards and join the trainer
          leaderboard.
        </p>
      </div>

      <div className="relative mt-12 grid grid-cols-3 gap-3">
        <StoryStat value="Real" label="Cards" />
        <StoryStat value="100" label="Free shipping" />
        <StoryStat value="Live" label="Values" />
      </div>
    </aside>
  );
}

function StoryStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-white/30">
        {label}
      </p>
    </div>
  );
}

function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_36%),linear-gradient(180deg,#070922_0%,#040617_55%,#02030d_100%)]" />
      <div className="absolute left-[9%] top-[12%] h-1 w-1 animate-pulse rounded-full bg-yellow-100/70" />
      <div className="absolute right-[12%] top-[18%] h-1 w-1 animate-pulse rounded-full bg-cyan-100/70 [animation-delay:700ms]" />
      <div className="absolute bottom-[16%] left-[22%] h-0.5 w-0.5 rounded-full bg-pink-100/60" />
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#040617] text-white">
      <AuthBackground />

      <div className="relative z-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-yellow-100" />
        <p className="mt-5 text-sm font-black text-white/55">
          Checking your trainer session
        </p>
      </div>
    </main>
  );
}
