"use client";

import Link from "next/link";
import { useState } from "react";

import AuthField, { AUTH_INPUT_CLASS } from "@/components/auth/AuthField";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { buildPasswordRecoveryUrl } from "@/lib/auth/navigation";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: buildPasswordRecoveryUrl() },
      );

      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(
          error,
          "The recovery message could not be sent.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Find Your Way Home"
      description="Enter the email connected to your trainer account. We will send a secure link for choosing a new password."
      storyTitle="Even lost symbols leave a trail"
      footer={
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/62 hover:bg-white/10 hover:text-white"
        >
          Return to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="Email address">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="trainer@example.com"
            disabled={submitting || sent}
            className={AUTH_INPUT_CLASS}
          />
        </AuthField>

        {sent ? (
          <AuthMessage tone="success">
            The recovery path has been sent. Check your inbox and spam folder.
          </AuthMessage>
        ) : null}

        {errorMessage ? (
          <AuthMessage tone="error">{errorMessage}</AuthMessage>
        ) : null}

        <button
          type="submit"
          disabled={submitting || sent}
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-100 via-violet-200 to-pink-200 px-5 text-sm font-black text-[#111329] transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Sending the trail..." : sent ? "Recovery email sent" : "Send recovery link"}
        </button>
      </form>
    </AuthShell>
  );
}
