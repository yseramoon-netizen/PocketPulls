"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import type {
  EmailOtpType,
} from "@supabase/supabase-js";

import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import {
  getAuthErrorMessage,
} from "@/lib/auth/helpers";
import {
  normaliseNextPath,
} from "@/lib/auth/navigation";
import {
  clearPendingRegistration,
} from "@/lib/auth/pending-registration";
import {
  supabase,
} from "@/lib/supabase";

const ALLOWED_EMAIL_TYPES =
  new Set<EmailOtpType>([
    "signup",
    "email",
    "magiclink",
    "invite",
    "recovery",
    "email_change",
  ]);

function readHashParameters():
  URLSearchParams {
  if (
    typeof window ===
    "undefined"
  ) {
    return new URLSearchParams();
  }

  return new URLSearchParams(
    window.location.hash
      .replace(/^#/, ""),
  );
}

function parseEmailType(
  value:
    | string
    | null,
): EmailOtpType {
  return value &&
    ALLOWED_EMAIL_TYPES.has(
      value as EmailOtpType,
    )
    ? (value as EmailOtpType)
    : "email";
}

export default function AuthCallbackPage() {
  const router =
    useRouter();

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    async function complete() {
      try {
        const search =
          new URLSearchParams(
            window.location.search,
          );

        const hash =
          readHashParameters();

        const nextPath =
          normaliseNextPath(
            search.get("next"),
          );

        const callbackError =
          search.get(
            "error_description",
          ) ||
          search.get("error") ||
          hash.get(
            "error_description",
          ) ||
          hash.get("error");

        if (callbackError) {
          throw new Error(
            callbackError,
          );
        }

        const tokenHash =
          search.get(
            "token_hash",
          );

        const emailType =
          parseEmailType(
            search.get(
              "type",
            ),
          );

        const code =
          search.get("code");

        const accessToken =
          hash.get("access_token");

        const refreshToken =
          hash.get("refresh_token");

        // Supabase can return a confirmed session in the URL hash (implicit
        // flow), a PKCE code, or a token hash depending on the email template
        // and project Auth settings. URL auto-detection is disabled globally so
        // this page is the only code allowed to consume a confirmation URL.
        if (accessToken && refreshToken) {
          const {
            error,
          } =
            await supabase.auth
              .setSession({
                access_token:
                  accessToken,
                refresh_token:
                  refreshToken,
              });

          if (error) {
            throw error;
          }
        } else if (code) {
          const {
            error,
          } =
            await supabase.auth
              .exchangeCodeForSession(
                code,
              );

          if (error) {
            throw error;
          }
        } else if (tokenHash) {
          const {
            error,
          } =
            await supabase.auth
              .verifyOtp({
                token_hash:
                  tokenHash,
                type:
                  emailType,
              });

          if (error) {
            throw error;
          }
        }

        const {
          data,
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!data.session) {
          throw new Error(
            "The confirmation link did not create a valid session. It may have expired or already been used.",
          );
        }

        if (
          emailType ===
          "recovery"
        ) {
          if (!active) {
            return;
          }

          router.replace(
            "/update-password",
          );
          router.refresh();
          return;
        }

        const {
          error:
            registrationError,
        } =
          await supabase.rpc(
            "complete_player_registration",
          );

        if (
          registrationError
        ) {
          throw registrationError;
        }

        clearPendingRegistration();

        if (!active) {
          return;
        }

        router.replace(
          `/welcome?next=${encodeURIComponent(
            nextPath,
          )}`,
        );

        router.refresh();
      } catch (
        error: unknown
      ) {
        if (!active) {
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
    return (
      <AuthLoading
        title="Binding your trainer symbol"
      />
    );
  }

  return (
    <AuthShell
      eyebrow="Confirmation interrupted"
      title="The Symbol Did Not Open"
      description="The confirmation link could not finish the account session."
    >
      <div className="space-y-5">
        <AuthMessage tone="error">
          {errorMessage}
        </AuthMessage>

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
