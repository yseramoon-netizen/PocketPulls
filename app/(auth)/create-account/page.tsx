"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import AuthField, {
  AUTH_INPUT_CLASS,
} from "@/components/auth/AuthField";
import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { supabase } from "@/lib/supabase";
import {
  getAuthErrorMessage,
  getPasswordStrength,
  normaliseUsername,
} from "@/lib/auth/helpers";
import {
  buildAuthCallbackUrl,
  getSafeNextPath,
} from "@/lib/auth/navigation";

type UsernameState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export default function CreateAccountPage() {
  const router = useRouter();
  const usernameTimerRef = useRef<number | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [usernameState, setUsernameState] =
    useState<UsernameState>("idle");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (usernameTimerRef.current !== null) {
      window.clearTimeout(usernameTimerRef.current);
    }

    if (username.length < 3) {
      setUsernameState(username ? "invalid" : "idle");
      return;
    }

    setUsernameState("checking");

    usernameTimerRef.current = window.setTimeout(() => {
      void supabase
        .rpc("check_player_username_available", {
          p_username: username,
        })
        .then(({ data, error }) => {
          if (error) {
            console.warn("Username check failed:", error);
            setUsernameState("idle");
            return;
          }

          setUsernameState(data === true ? "available" : "taken");
        });
    }, 420);

    return () => {
      if (usernameTimerRef.current !== null) {
        window.clearTimeout(usernameTimerRef.current);
      }
    };
  }, [username]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (submitting) return;

    setErrorMessage(null);

    const cleanName = displayName.trim();
    const cleanUsername = normaliseUsername(username);
    const cleanEmail = email.trim().toLowerCase();
    const strength = getPasswordStrength(password);

    if (cleanName.length < 2 || cleanName.length > 60) {
      setErrorMessage("Display name must be between 2 and 60 characters.");
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage("Username must contain at least 3 characters.");
      return;
    }

    if (usernameState === "taken") {
      setErrorMessage("That username is already travelling with another trainer.");
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (!strength.checks.length || strength.score < 3) {
      setErrorMessage("Choose a stronger password and complete at least three strength rules.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    if (!accepted) {
      setErrorMessage("Confirm that you understand how the account and physical-card collection work.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanName,
            username: cleanUsername,
            brand: "Unknown Pulls",
          },
          emailRedirectTo: buildAuthCallbackUrl(nextPath),
        },
      });

      if (error) throw error;

      if (data.session) {
        const { error: registrationError } = await supabase.rpc(
          "complete_player_registration",
        );

        if (registrationError) throw registrationError;

        router.replace(
          `/welcome?next=${encodeURIComponent(nextPath)}`,
        );
        router.refresh();
        return;
      }

      router.replace(
        `/check-email?email=${encodeURIComponent(
          cleanEmail,
        )}&next=${encodeURIComponent(nextPath)}`,
      );
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "Unknown Pulls could not create your account.",
        ),
      );
      setSubmitting(false);
    }
  }

  if (checking) {
    return <AuthLoading title="Preparing a new symbol" />;
  }

  const usernameHint = {
    idle: "letters, numbers and underscores",
    checking: "checking availability...",
    available: "available ✓",
    taken: "already taken",
    invalid: "minimum 3 characters",
  }[usernameState];

  return (
    <AuthShell
      eyebrow="New trainer"
      title="Create Your Symbol"
      description="Create the identity that will follow every wish, physical card and constellation memory."
      storyTitle="Every collection begins with one unknown symbol"
      storyDescription="Your account creates a private wish wallet and collection. The cards you pull remain attached to your trainer identity."
      footer={
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm font-semibold text-white/40">
            Already part of the constellation?
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-300/[0.07] px-5 text-sm font-black text-violet-50 hover:bg-violet-300/12"
          >
            Return to sign in
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField label="Display name">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
              autoComplete="name"
              placeholder="Pokemon Trainer"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </AuthField>

          <AuthField label="Username" hint={usernameHint}>
            <input
              value={username}
              onChange={(event) =>
                setUsername(
                  normaliseUsername(event.target.value),
                )
              }
              autoComplete="username"
              placeholder="ancient_trainer"
              disabled={submitting}
              className={`${AUTH_INPUT_CLASS} ${
                usernameState === "available"
                  ? "border-emerald-200/25"
                  : usernameState === "taken"
                    ? "border-red-200/25"
                    : ""
              }`}
            />
          </AuthField>
        </div>

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

        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField label="Password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Create a strong password"
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

          <AuthField label="Confirm password">
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your password"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </AuthField>
        </div>

        <PasswordStrength password={password} />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 accent-cyan-200"
          />
          <span className="text-xs font-semibold leading-6 text-white/38">
            I understand that my account stores my digital wish history and ownership records for real physical cards, and that delivery details are added separately inside the Shipping Centre.
          </span>
        </label>

        {errorMessage ? (
          <AuthMessage tone="error">{errorMessage}</AuthMessage>
        ) : null}

        <button
          type="submit"
          disabled={submitting || usernameState === "checking" || usernameState === "taken"}
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_0_35px_rgba(103,232,249,0.11)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Binding your symbol..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
