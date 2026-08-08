"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { buildAuthCallbackUrl, normaliseNextPath } from "@/lib/auth/navigation";
import { supabase } from "@/lib/supabase";

export default function CheckEmailPage() {
  const [cooldown, setCooldown] = useState(45);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return { email: "", next: "/hq" };
    }

    const search = new URLSearchParams(window.location.search);
    return {
      email: search.get("email") || "",
      next: normaliseNextPath(search.get("next")),
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (!params.email || cooldown > 0 || resending) return;

    setResending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: params.email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(params.next),
        },
      });

      if (error) throw error;
      setMessage("A new confirmation email has been sent.");
      setCooldown(60);
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
            {params.email || "your email address"}
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
          disabled={!params.email || cooldown > 0 || resending}
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-violet-100/15 bg-violet-300/[0.08] px-5 text-sm font-black text-violet-50 transition hover:bg-violet-300/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {resending
            ? "Sending again..."
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend confirmation email"}
        </button>
      </div>
    </AuthShell>
  );
}
