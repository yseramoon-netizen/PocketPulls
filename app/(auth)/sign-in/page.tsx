"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthField, {
  AUTH_INPUT_CLASS,
} from "@/components/auth/AuthField";
import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { getSafeNextPath } from "@/lib/auth/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const passwordWasUpdated =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("password") ===
      "updated";

  const nextPath = useMemo(
    () =>
      typeof window === "undefined"
        ? "/wishes"
        : getSafeNextPath(),
    [],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (submitting) return;

    const cleanEmail = email.trim().toLowerCase();
    setErrorMessage(null);

    if (!cleanEmail || !password) {
      setErrorMessage("Enter both your email address and password.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      const { error: registrationError } = await supabase.rpc(
        "complete_player_registration",
      );

      if (registrationError) {
        console.warn(
          "Player registration repair failed:",
          registrationError,
        );
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "Unknown Pulls could not sign you in.",
        ),
      );
      setSubmitting(false);
    }
  }

  if (checking) {
    return <AuthLoading title="Reading your symbol" />;
  }

  return (
    <AuthShell
      eyebrow="Trainer gateway"
      title="Welcome Back"
      description="Return to your wishes, collection, constellation and shipping journey."
      storyTitle="Lost symbols always find their way home"
      footer={
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-semibold text-white/40">
              New to Unknown Pulls?
            </p>
            <p className="mt-1 text-xs font-semibold text-white/24">
              Create your trainer identity and personal collection.
            </p>
          </div>

          <Link
            href={`/create-account?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-300/[0.07] px-5 text-sm font-black text-violet-50 transition hover:bg-violet-300/12"
          >
            Create account
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="Email address">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="trainer@example.com"
            disabled={submitting}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        <AuthField
          label="Password"
          hint={
            <Link
              href="/forgot-password"
              className="font-black text-cyan-100/55 hover:text-cyan-50"
            >
              Forgot password?
            </Link>
          }
        >
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Your password"
              disabled={submitting}
              className={`${AUTH_INPUT_CLASS} pr-20`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 px-4 text-[0.62rem] font-black uppercase tracking-[0.1em] text-white/35 hover:text-white"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </AuthField>

        {passwordWasUpdated ? (
          <AuthMessage tone="success">
            Your password was updated. Sign in with the new password.
          </AuthMessage>
        ) : null}

        {errorMessage ? (
          <AuthMessage tone="error">{errorMessage}</AuthMessage>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_0_35px_rgba(103,232,249,0.11)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {submitting ? "Opening the gateway..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
