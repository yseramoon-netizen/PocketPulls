"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";

import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { normaliseNextPath } from "@/lib/auth/navigation";
import { clearPendingRegistration } from "@/lib/auth/pending-registration";
import { supabase } from "@/lib/supabase";

const ALLOWED_EMAIL_TYPES = new Set<EmailOtpType>([
  "signup",
  "email",
  "magiclink",
  "invite",
  "recovery",
  "email_change",
]);

function readHashParameters(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();

  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function parseEmailType(value: string | null): EmailOtpType {
  return value && ALLOWED_EMAIL_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : "email";
}

function buildOAuthFailureUrl(nextPath: string, error: unknown): string {
  const message = getAuthErrorMessage(
    error,
    "Google or Discord could not complete the sign-in. Please try again.",
  ).slice(0, 240);
  const params = new URLSearchParams({ next: nextPath, oauth_error: message });

  return `/sign-in?${params.toString()}`;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function complete() {
      const search = new URLSearchParams(window.location.search);
      const hash = readHashParameters();
      const nextPath = normaliseNextPath(search.get("next"));
      const tokenHash = search.get("token_hash");
      const emailType = parseEmailType(search.get("type"));
      const code = search.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const providerError =
        search.get("error_description") ||
        search.get("error") ||
        hash.get("error_description") ||
        hash.get("error");
      const isOAuthFlow = Boolean(code) || (!tokenHash && Boolean(providerError));

      try {
        if (providerError) {
          throw new Error(providerError);
        }

        // Supabase may return an implicit session in the fragment, a PKCE code
        // after OAuth, or a token hash from an email template. Auto-detection
        // is disabled in lib/supabase.ts, making this the sole consumer.
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: emailType,
          });
          if (error) throw error;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error(
            "The sign-in link did not create a valid session. It may have expired or already been used.",
          );
        }

        if (emailType === "recovery") {
          if (!active) return;
          router.replace("/update-password");
          router.refresh();
          return;
        }

        // This routine is deliberately shared by email and OAuth users. It is
        // idempotent and creates the standard profile, wallet and promotion
        // records using the authenticated Supabase user ID.
        const { error: registrationError } = await supabase.rpc(
          "complete_player_registration",
        );
        if (registrationError) throw registrationError;

        clearPendingRegistration();
        if (!active) return;

        // OAuth is an already-authenticated sign-in, so it goes directly to
        // the protected destination. Email confirmation keeps its existing
        // confirmation screen so that flow remains familiar.
        if (isOAuthFlow) {
          router.replace(nextPath);
        } else {
          router.replace(`/welcome?next=${encodeURIComponent(nextPath)}`);
        }
        router.refresh();
      } catch (error: unknown) {
        if (!active) return;

        if (isOAuthFlow) {
          router.replace(buildOAuthFailureUrl(nextPath, error));
          router.refresh();
          return;
        }

        setErrorMessage(
          getAuthErrorMessage(
            error,
            "The account confirmation could not be completed.",
          ),
        );
      }
    }

    void complete();
    return () => {
      active = false;
    };
  }, [router]);

  if (!errorMessage) {
    return <AuthLoading title="Binding your trainer symbol" />;
  }

  return (
    <AuthShell
      eyebrow="Confirmation interrupted"
      title="The Symbol Did Not Open"
      description="The confirmation link could not finish the account session."
    >
      <div className="space-y-5">
        <AuthMessage tone="error">{errorMessage}</AuthMessage>
        <Link
          href="/sign-in"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-100 via-violet-200 to-pink-200 px-5 text-sm font-black text-[#111329]"
        >
          Return to sign in
        </Link>
        <Link
          href="/check-email"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-5 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          Send a fresh confirmation email
        </Link>
      </div>
    </AuthShell>
  );
}
