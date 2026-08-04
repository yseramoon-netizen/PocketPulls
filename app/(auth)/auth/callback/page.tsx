"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import {
  getAuthErrorDetails,
} from "@/lib/auth/helpers";
import {
  normaliseNextPath,
} from "@/lib/auth/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    technicalMessage,
    setTechnicalMessage,
  ] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function complete() {
      try {
        const query =
          new URLSearchParams(
            window.location.search,
          );

        const fragment =
          new URLSearchParams(
            window.location.hash.replace(
              /^#/,
              "",
            ),
          );

        const code = query.get("code");

        const nextPath =
          normaliseNextPath(
            query.get("next"),
          );

        const callbackError =
          query.get(
            "error_description",
          ) ||
          query.get("error") ||
          fragment.get(
            "error_description",
          ) ||
          fragment.get("error");

        if (callbackError) {
          throw new Error(callbackError);
        }

        if (code) {
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
        }

        const {
          data,
          error: sessionError,
        } =
          await supabase.auth
            .getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!data.session) {
          throw new Error(
            "The confirmation link did not create a valid session. It may have expired or the redirect URL is not allowed in Supabase.",
          );
        }

        const {
          error:
            registrationError,
        } = await supabase.rpc(
          "complete_player_registration",
        );

        if (registrationError) {
          throw registrationError;
        }

        if (!active) {
          return;
        }

        router.replace(
          `/welcome?next=${encodeURIComponent(
            nextPath,
          )}`,
        );

        router.refresh();
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        console.error(
          "Unknown Pulls callback failure:",
          error,
        );

        const details =
          getAuthErrorDetails(
            error,
            "The account confirmation could not be completed.",
          );

        setErrorMessage(
          details.message,
        );

        setTechnicalMessage(
          [
            details.code
              ? `Code: ${details.code}`
              : null,
            details.status
              ? `Status: ${details.status}`
              : null,
            details.details,
            details.hint,
            details.rawSummary,
          ]
            .filter(Boolean)
            .join(" | ") ||
            null,
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
      <AuthLoading title="Binding your trainer symbol" />
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

        {technicalMessage ? (
          <details className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/45">
            <summary className="cursor-pointer font-black text-white/65">
              Technical details
            </summary>

            <p className="mt-3 break-words font-mono leading-5">
              {technicalMessage}
            </p>
          </details>
        ) : null}

        <Link
          href="/sign-in"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-100 via-violet-200 to-pink-200 px-5 text-sm font-black text-[#111329]"
        >
          Return to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
