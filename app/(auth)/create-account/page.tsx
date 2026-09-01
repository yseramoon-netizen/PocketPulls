"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
  getSafeNextPath,
} from "@/lib/auth/navigation";
import {
  clearPendingRegistration,
  type PendingRegistration,
  readPendingRegistration,
  rememberPendingRegistration,
  resendSignupConfirmation,
  secondsUntilVerificationResend,
} from "@/lib/auth/pending-registration";
import {
  PURCHASE_CONSENT_SUMMARY,
  PURCHASE_CONSENT_VERSION,
} from "@/lib/player/purchase-consent";

type UsernameState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

type RegistrationGatewayResponse = {
  ok?: boolean;
  session?: {
    access_token?: unknown;
    refresh_token?: unknown;
  } | null;
  error?: {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    upstreamStatus?: unknown;
  };
};

function registrationGatewayError(
  payload: RegistrationGatewayResponse | null,
): Error {
  const failure =
    payload?.error;

  const error = new Error(
    typeof failure?.message === "string" && failure.message.trim()
      ? failure.message
      : "ancientpulls could not create your account.",
  ) as Error & {
    code?: unknown;
    details?: unknown;
    status?: unknown;
  };

  error.code = failure?.code;
  error.details = failure?.details;
  error.status = failure?.upstreamStatus;

  return error;
}

export default function CreateAccountPage() {
  const router = useRouter();
  const usernameTimerRef = useRef<number | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [randomCardAccepted, setRandomCardAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [usernameState, setUsernameState] =
    useState<UsernameState>("idle");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = useMemo(
    () =>
      typeof window === "undefined"
        ? "/hq"
        : getSafeNextPath(),
    [],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (data.session) {
        clearPendingRegistration();
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setPendingRegistration(readPendingRegistration());
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

    if (username.length < 3) return;

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

  function updateUsername(value: string) {
    const nextUsername = normaliseUsername(value);
    setUsername(nextUsername);
    setUsernameState(
      nextUsername.length >= 3
        ? "checking"
        : nextUsername
          ? "invalid"
          : "idle",
    );
  }

  async function resendRememberedConfirmation(
    registration = pendingRegistration,
  ) {
    if (!registration || resending) return;

    const cooldown = secondsUntilVerificationResend(registration);
    if (cooldown > 0) {
      setResendMessage(`You can send another email in ${cooldown}s.`);
      return;
    }

    setResending(true);
    setResendMessage(null);
    setErrorMessage(null);

    try {
      const refreshed = await resendSignupConfirmation(
        registration.email,
        registration.nextPath,
      );
      setPendingRegistration(refreshed);
      setResendMessage("A new verification email has been sent.");
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "The verification email could not be resent.",
        ),
      );
    } finally {
      setResending(false);
    }
  }

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

    const remembered = readPendingRegistration();
    if (remembered?.email === cleanEmail) {
      setPendingRegistration(remembered);
      setResendMessage(
        "A confirmation email is already waiting for you. Open the newest email, or resend one from the next screen if needed.",
      );
      router.replace(
        `/check-email?email=${encodeURIComponent(
          remembered.email,
        )}&next=${encodeURIComponent(remembered.nextPath)}`,
      );
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

    if (!ageConfirmed || !randomCardAccepted || !termsAccepted) {
      setErrorMessage(
        "Confirm all three account and purchase acknowledgements before creating your trainer account.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: cleanName,
          username: cleanUsername,
          nextPath,
          purchaseConsentVersion: PURCHASE_CONSENT_VERSION,
          ageConfirmed: true,
          randomCardAccepted: true,
          termsAccepted: true,
        }),
      });

      const payload =
        await response.json().catch(() => null) as
          | RegistrationGatewayResponse
          | null;

      if (!response.ok || payload?.ok !== true) {
        throw registrationGatewayError(payload);
      }

      const accessToken =
        typeof payload.session?.access_token === "string"
          ? payload.session.access_token
          : null;
      const refreshToken =
        typeof payload.session?.refresh_token === "string"
          ? payload.session.refresh_token
          : null;

      if (accessToken && refreshToken) {
        const { error: sessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (sessionError) {
          throw sessionError;
        }

        const { error: registrationError } = await supabase.rpc(
          "complete_player_registration",
        );

        if (registrationError) throw registrationError;

        clearPendingRegistration();

        router.replace(
          `/welcome?next=${encodeURIComponent(nextPath)}`,
        );
        router.refresh();
        return;
      }

      rememberPendingRegistration({
        email: cleanEmail,
        nextPath,
        lastSentAt: Date.now(),
      });

      router.replace(
        `/check-email?email=${encodeURIComponent(
          cleanEmail,
        )}&next=${encodeURIComponent(nextPath)}`,
      );
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "ancientpulls could not create your account.",
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
      {pendingRegistration ? (
        <div className="mb-6 rounded-2xl border border-cyan-100/20 bg-cyan-300/[0.08] p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100/70">
            Email confirmation still pending
          </p>
          <p className="mt-2 break-all text-base font-black text-white">
            {pendingRegistration.email}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/60">
            This browser remembers that account. You do not need to create it
            again—send a fresh verification link instead.
          </p>

          {resendMessage ? (
            <div className="mt-4">
              <AuthMessage tone="success">{resendMessage}</AuthMessage>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void resendRememberedConfirmation()}
              disabled={resending}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-black text-[#101427] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? "Sending verification..." : "Resend verification email"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearPendingRegistration();
                setPendingRegistration(null);
                setResendMessage(null);
                setEmail("");
              }}
              disabled={resending}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white"
            >
              Create a different account
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField label="Display name">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
              autoComplete="name"
              placeholder="Star Trainer"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </AuthField>

          <AuthField label="Username" hint={usernameHint}>
            <input
              value={username}
              onChange={(event) => updateUsername(event.target.value)}
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

        <div className="space-y-3 rounded-2xl border border-yellow-100/15 bg-yellow-200/[0.035] p-4">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-yellow-100/55">
              Before you create your account
            </p>
            <p className="mt-2 text-xs font-semibold leading-6 text-white/40">
              These confirmations are saved to your trainer account. You will not be asked again at every recharge unless the terms materially change.
            </p>
          </div>

          <ConsentCheckbox
            checked={ageConfirmed}
            onChange={setAgeConfirmed}
            disabled={submitting}
          >
            {PURCHASE_CONSENT_SUMMARY.age}
          </ConsentCheckbox>

          <ConsentCheckbox
            checked={randomCardAccepted}
            onChange={setRandomCardAccepted}
            disabled={submitting}
          >
            {PURCHASE_CONSENT_SUMMARY.randomPhysicalCard}
          </ConsentCheckbox>

          <ConsentCheckbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            disabled={submitting}
          >
            <span>
              I agree to the {" "}
              <Link href="/terms" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2">
                Terms
              </Link>
              {" "}and{" "}
              <Link href="/rules" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2">
                Wish Rules
              </Link>
              , including the{" "}
              <Link href="/returns" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2">
                Refunds &amp; Returns
              </Link>
              {" "}and{" "}
              <Link href="/shipping-policy" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2">
                Shipping
              </Link>
              {" "}terms, and I have read the{" "}
              <Link href="/player-protection" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2">
                Player Protection
              </Link>
              {" "}information.
            </span>
          </ConsentCheckbox>

          <p className="rounded-xl border border-cyan-100/10 bg-cyan-100/[0.035] p-3 text-xs font-semibold leading-6 text-white/45">
            We use your account details to provide and secure the service; this is not marketing consent. Read the{" "}
            <Link href="/privacy" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline underline-offset-2">Privacy Notice</Link>
            {" "}and{" "}
            <Link href="/cookies" target="_blank" rel="noreferrer" className="font-black text-cyan-100 underline underline-offset-2">Cookie Policy</Link>.
          </p>
        </div>

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


function ConsentCheckbox({
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3.5 transition hover:bg-white/[0.045]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 flex-none accent-cyan-200"
      />
      <span className="text-xs font-semibold leading-6 text-white/52">
        {children}
      </span>
    </label>
  );
}
