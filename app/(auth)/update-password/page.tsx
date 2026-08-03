"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AuthField, { AUTH_INPUT_CLASS } from "@/components/auth/AuthField";
import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { getAuthErrorMessage, getPasswordStrength } from "@/lib/auth/helpers";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (event === "PASSWORD_RECOVERY" || session) {
          setReady(true);
        }
      },
    );

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
    });

    const timeout = window.setTimeout(() => {
      if (active && !ready) {
        setErrorMessage("This recovery link is missing, expired or has already been used.");
        setReady(true);
      }
    }, 4500);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [ready]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const strength = getPasswordStrength(password);

    if (!strength.checks.length || strength.score < 3) {
      setErrorMessage("Choose a stronger password and complete at least three strength rules.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      router.replace("/sign-in?password=updated");
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "Your password could not be updated.",
        ),
      );
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <AuthLoading title="Following the recovery trail" />;
  }

  return (
    <AuthShell
      eyebrow="Secure recovery"
      title="Choose A New Key"
      description="Create a new password for the trainer account connected to this recovery link."
      storyTitle="The old gate closes behind you"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="New password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Create a strong password"
              disabled={submitting || Boolean(errorMessage?.includes("expired"))}
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

        <AuthField label="Confirm new password">
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat the new password"
            disabled={submitting || Boolean(errorMessage?.includes("expired"))}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        <PasswordStrength password={password} />

        {errorMessage ? (
          <AuthMessage tone="error">{errorMessage}</AuthMessage>
        ) : null}

        <button
          type="submit"
          disabled={submitting || Boolean(errorMessage?.includes("expired"))}
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Changing the key..." : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
