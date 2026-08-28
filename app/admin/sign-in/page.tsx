"use client";

import Link from "next/link";
import {
  Suspense,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ForestBackground from "@/components/ForestBackground";
import {
  clearAdminGate,
  readAdminGate,
  writeAdminGate,
} from "@/lib/admin/client-auth";
import { adminSupabase } from "@/lib/admin/supabase";

function safeNextPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    !value.startsWith("/admin") ||
    value.startsWith("/admin/sign-in")
  ) {
    return "/admin";
  }

  return value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return "The admin sign-in request failed.";
}

async function verifyAdminToken(accessToken: string) {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        admin?: {
          userId?: string;
          email?: string;
          founder?: "lukas" | "skye" | null;
          aal?: "aal1" | "aal2" | null;
          mfaRequired?: boolean;
        };
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload?.admin?.userId || !payload.admin.email) {
    throw new Error(
      payload?.error?.message || "This account does not have ancientpulls administrator access.",
    );
  }

  return {
    userId: payload.admin.userId,
    email: payload.admin.email.toLowerCase(),
    founder: payload.admin.founder || null,
    aal: payload.admin.aal || null,
  };
}

type VerifiedAdmin = Awaited<ReturnType<typeof verifyAdminToken>>;

type MfaState = {
  mode: "challenge" | "enrol";
  factorId: string;
  qrCode: string | null;
  secret: string | null;
};

function AdminSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [verifiedAdmin, setVerifiedAdmin] = useState<VerifiedAdmin | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function completeAdminSignIn(
    admin: VerifiedAdmin,
    accessToken: string,
  ) {
    const refreshed = admin.aal === "aal2"
      ? admin
      : await verifyAdminToken(accessToken);

    if (refreshed.aal !== "aal2") {
      throw new Error("Two-factor verification did not produce an AAL2 administrator session.");
    }

    writeAdminGate({
      userId: refreshed.userId,
      email: refreshed.email,
      founder: refreshed.founder,
      verifiedAt: Date.now(),
      aal2: true,
    });

    router.replace(nextPath);
    router.refresh();
  }

  async function prepareMfa(admin: VerifiedAdmin) {
    setVerifiedAdmin(admin);
    setMfaCode("");

    const factors = await adminSupabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;

    const verifiedTotp = factors.data?.totp?.[0];
    if (verifiedTotp) {
      setMfa({
        mode: "challenge",
        factorId: verifiedTotp.id,
        qrCode: null,
        secret: null,
      });
      return;
    }

    const unverified = factors.data?.all?.filter(
      (factor) => factor.factor_type === "totp" && factor.status !== "verified",
    ) || [];

    for (const factor of unverified) {
      await adminSupabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const enrolment = await adminSupabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Ancient Pulls Admin",
      issuer: "Ancient Pulls",
    });

    if (enrolment.error || !enrolment.data) {
      throw enrolment.error || new Error("The authenticator could not be enrolled.");
    }

    setMfa({
      mode: "enrol",
      factorId: enrolment.data.id,
      qrCode: enrolment.data.totp.qr_code,
      secret: enrolment.data.totp.secret,
    });
  }

  useEffect(() => {
    let active = true;

    async function checkExistingAdminSession() {
      try {
        const { data, error: sessionError } =
          await adminSupabase.auth.getSession();

        if (sessionError || !data.session?.access_token) {
          clearAdminGate();
          if (active) setChecking(false);
          return;
        }

        const admin = await verifyAdminToken(data.session.access_token);
        const gate = readAdminGate();

        if (admin.aal === "aal2") {
          if (!gate || gate.userId !== admin.userId) {
            writeAdminGate({
              userId: admin.userId,
              email: admin.email,
              founder: admin.founder,
              verifiedAt: Date.now(),
              aal2: true,
            });
          }

          if (active) {
            router.replace(nextPath);
            router.refresh();
          }
          return;
        }

        clearAdminGate();
        if (active) {
          await prepareMfa(admin);
          setChecking(false);
        }
      } catch {
        clearAdminGate();
        await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        if (active) setChecking(false);
      }
    }

    void checkExistingAdminSession();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (signingIn) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Enter your administrator email and password.");
      return;
    }

    setSigningIn(true);
    setError("");

    try {
      const { data, error: signInError } =
        await adminSupabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signInError || !data.session?.access_token) {
        throw signInError || new Error("No administrator session was returned.");
      }

      const admin = await verifyAdminToken(data.session.access_token);

      if (admin.email !== cleanEmail) {
        throw new Error("The verified administrator did not match the account entered.");
      }

      if (admin.aal === "aal2") {
        await completeAdminSignIn(admin, data.session.access_token);
      } else {
        clearAdminGate();
        await prepareMfa(admin);
        setSigningIn(false);
      }
    } catch (failure: unknown) {
      console.error("Admin sign-in error:", failure);
      clearAdminGate();
      await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setError(getErrorMessage(failure));
      setSigningIn(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mfa || !verifiedAdmin || signingIn) return;

    const code = mfaCode.replace(/\D/g, "").slice(0, 8);
    if (code.length < 6) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setSigningIn(true);
    setError("");

    try {
      const verification = await adminSupabase.auth.mfa.challengeAndVerify({
        factorId: mfa.factorId,
        code,
      });

      if (verification.error || !verification.data?.access_token) {
        throw verification.error || new Error("Two-factor verification failed.");
      }

      await completeAdminSignIn(verifiedAdmin, verification.data.access_token);
    } catch (failure: unknown) {
      setError(getErrorMessage(failure));
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

      <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[0.08] shadow-[0_40px_140px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        <div className="h-1 bg-gradient-to-r from-emerald-300 via-cyan-200 to-lime-200" />
        <div className="p-6 sm:p-9">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-100/20 bg-emerald-300/10 text-4xl shadow-[0_0_45px_rgba(52,211,153,0.14)]">
            🌿
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100/45">
              ancientpulls administration
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              Unlock the Forest Vault
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-7 text-emerald-50/55">
              Admin and Nebu player sessions are isolated, so signing into one no longer replaces the other.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200/20 bg-red-400/[0.09] px-5 py-4 text-sm font-bold leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          {mfa ? (
            <form onSubmit={handleMfaSubmit} className="mt-7 space-y-5">
              <div className="rounded-2xl border border-cyan-100/15 bg-cyan-100/[0.055] p-5 text-center">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-50/55">
                  {mfa.mode === "enrol" ? "Secure this administrator" : "Authenticator required"}
                </p>
                <h2 className="mt-2 text-xl font-black text-white">
                  {mfa.mode === "enrol" ? "Set up two-factor authentication" : "Enter your two-factor code"}
                </h2>
                {mfa.mode === "enrol" && mfa.qrCode ? (
                  <>
                    {/* Supabase returns an in-memory SVG data URL for this one-time QR. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mfa.qrCode}
                      alt="Ancient Pulls authenticator QR code"
                      className="mx-auto mt-5 h-48 w-48 rounded-2xl bg-white p-3"
                    />
                    <p className="mt-4 text-xs font-semibold leading-5 text-white/55">
                      Scan this with Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app.
                    </p>
                    {mfa.secret ? (
                      <details className="mt-3 text-left">
                        <summary className="cursor-pointer text-xs font-black text-cyan-100/65">
                          Enter a setup key instead
                        </summary>
                        <code className="mt-2 block break-all rounded-xl bg-black/30 p-3 text-xs text-white/70">
                          {mfa.secret}
                        </code>
                      </details>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-white/55">
                    Open the authenticator linked to {verifiedAdmin?.email || "this administrator"}.
                  </p>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-black text-white">Authenticator code</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  disabled={signingIn}
                  autoFocus
                  className="mt-2 min-h-14 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-center text-2xl font-black tracking-[0.35em] text-white outline-none focus:border-cyan-200/40"
                  placeholder="000000"
                />
              </label>

              <button
                type="submit"
                disabled={signingIn || mfaCode.replace(/\D/g, "").length < 6}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-100 via-emerald-100 to-lime-100 px-5 text-sm font-black text-[#082117] disabled:opacity-50"
              >
                {signingIn ? "Verifying..." : "Verify and enter admin vault"}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-white">Admin email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                disabled={signingIn}
                className="mt-2 min-h-14 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-200/35"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-white">Password</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={signingIn}
                  className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/25 px-4 pr-20 text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-200/35"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-5 text-xs font-black uppercase tracking-[0.1em] text-white/40 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={signingIn}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-200 via-lime-100 to-cyan-100 px-5 text-sm font-black text-[#082117] shadow-[0_18px_45px_rgba(52,211,153,0.18)] transition hover:brightness-105 disabled:opacity-50"
            >
              {signingIn ? "Opening the vault..." : "Enter admin vault"}
            </button>
          </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/sign-in" className="text-xs font-black text-emerald-100/45 hover:text-white">
              Go to Nebu player sign-in instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense>
      <AdminSignInContent />
    </Suspense>
  );
}
