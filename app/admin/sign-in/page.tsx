"use client";

import Link from "next/link";
import {
  Suspense,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import ForestBackground from "@/components/ForestBackground";
import {
  adminFetch,
} from "@/lib/admin/client-auth";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL =
  "pullspocket@gmail.com";

function safeNextPath(
  value: string | null,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    !value.startsWith(
      "/admin",
    )
  ) {
    return "/admin/add";
  }

  return value;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
        "string" &&
      message.trim()
    ) {
      return message.trim();
    }
  }

  return "The admin sign-in request failed.";
}

function AdminSignInContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const nextPath =
    safeNextPath(
      searchParams.get("next"),
    );

  const [
    email,
    setEmail,
  ] = useState(
    ADMIN_EMAIL,
  );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    checking,
    setChecking,
  ] = useState(true);

  const [
    signingIn,
    setSigningIn,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        await adminFetch(
          "/api/admin/session",
        );

        if (!active) {
          return;
        }

        router.replace(nextPath);
        router.refresh();
      } catch {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (signingIn) {
      return;
    }

    setSigningIn(true);
    setError("");

    try {
      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      if (
        cleanEmail !==
        ADMIN_EMAIL
      ) {
        throw new Error(
          `This admin gateway is currently assigned to ${ADMIN_EMAIL}.`,
        );
      }

      const {
        error:
          signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              cleanEmail,
            password,
          });

      if (signInError) {
        throw signInError;
      }

      const session =
        await adminFetch<{
          ok: true;
          admin: {
            email: string;
          };
        }>(
          "/api/admin/session",
        );

      if (
        session.admin.email !==
        ADMIN_EMAIL
      ) {
        await supabase.auth
          .signOut();

        throw new Error(
          "The signed-in account is not the PocketPulls admin account.",
        );
      }

      router.replace(nextPath);
      router.refresh();
    } catch (
      signInFailure: unknown
    ) {
      console.error(
        "Admin sign-in error:",
        signInFailure,
      );

      setError(
        getErrorMessage(
          signInFailure,
        ),
      );

      setSigningIn(false);
    }
  }

  if (checking) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-5 text-white">
        <ForestBackground />

        <div className="relative z-10 rounded-[2rem] border border-emerald-100/15 bg-black/25 px-8 py-7 text-center backdrop-blur-3xl">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-100/20 border-t-emerald-200" />

          <p className="mt-4 text-sm font-black text-emerald-50/70">
            Checking the forest key...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-4 py-12 text-white">
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 top-24 h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-[130px]" />
        <div className="absolute -right-48 bottom-0 h-[36rem] w-[36rem] rounded-full bg-cyan-300/10 blur-[140px]" />
      </div>

      <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[0.08] shadow-[0_40px_140px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        <div className="h-1 bg-gradient-to-r from-emerald-300 via-cyan-200 to-lime-200" />

        <div className="p-6 sm:p-9">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-100/20 bg-emerald-300/10 text-4xl shadow-[0_0_45px_rgba(52,211,153,0.14)]">
            🌿
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100/45">
              Shaymin administration
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Unlock the Forest Vault
            </h1>

            <p className="mt-4 text-sm font-semibold leading-7 text-emerald-50/55">
              Sign in with the authorised PocketPulls admin account. The session is refreshed automatically before protected actions.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200/20 bg-red-400/10 px-5 py-4 text-sm font-bold leading-6 text-red-50">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >
            <label className="block">
              <span className="text-sm font-black text-white">
                Admin email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="username"
                disabled={signingIn}
                className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-black/25 px-5 font-bold text-white outline-none placeholder:text-white/25 focus:border-emerald-200/45 disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-white">
                Password
              </span>

              <div className="relative mt-2">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="current-password"
                  disabled={signingIn}
                  className="min-h-14 w-full rounded-2xl border border-white/15 bg-black/25 px-5 pr-20 font-bold text-white outline-none placeholder:text-white/25 focus:border-emerald-200/45 disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                  className="absolute inset-y-0 right-0 px-5 text-xs font-black uppercase tracking-[0.1em] text-white/40 hover:text-white"
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={
                signingIn ||
                !password
              }
              className="flex min-h-15 w-full items-center justify-center rounded-2xl border border-emerald-100/25 bg-emerald-300 px-6 text-base font-black text-emerald-950 shadow-[0_0_45px_rgba(110,231,183,0.2)] transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingIn
                ? "Verifying admin access..."
                : "Enter the admin site"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3 text-center text-xs font-semibold text-white/35 sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <Link
              href="/forgot-password"
              className="hover:text-white"
            >
              Reset Supabase password
            </Link>

            <Link
              href="/sign-in"
              className="hover:text-white"
            >
              Player sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}


function AdminSignInFallback() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-5 text-white">
      <ForestBackground />

      <div className="relative z-10 rounded-[2rem] border border-emerald-100/15 bg-black/25 px-8 py-7 text-center backdrop-blur-3xl">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-100/20 border-t-emerald-200" />

        <p className="mt-4 text-sm font-black text-emerald-50/70">
          Opening the forest gateway...
        </p>
      </div>
    </main>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <AdminSignInFallback />
      }
    >
      <AdminSignInContent />
    </Suspense>
  );
}
