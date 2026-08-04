"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AuthField, {
  AUTH_INPUT_CLASS,
} from "@/components/auth/AuthField";
import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { supabase } from "@/lib/supabase";
import {
  getAuthErrorDetails,
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
  | "invalid"
  | "unavailable";

type RegistrationHealth = {
  ok?: boolean;
  profiles_table?: boolean;
  wallets_table?: boolean;
  username_function?: boolean;
  registration_function?: boolean;
  signup_trigger?: boolean;
};

type SetupState =
  | "checking"
  | "ready"
  | "missing";

type TechnicalError = {
  code: string | null;
  status: number | null;
  details: string | null;
  hint: string | null;
  rawSummary: string | null;
};

type AuthGatewayHealth = {
  ok: boolean;
  service?: {
    host?: string;
    status?: number;
    latencyMs?: number;
    response?: unknown;
  };
  error?: {
    message?: string;
    code?: string | null;
    details?: string | null;
    upstreamStatus?: number | null;
    rawBody?: string | null;
    requestId?: string;
  };
};

type AuthGatewayRegisterResponse = {
  ok: boolean;
  user?: Record<string, unknown> | null;
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number | null;
    expires_at?: number | null;
    token_type?: string | null;
  } | null;
  confirmationRequired?: boolean;
  requestId?: string;
  error?: {
    message?: string;
    code?: string | null;
    details?: string | null;
    upstreamStatus?: number | null;
    rawBody?: string | null;
    requestId?: string;
  };
};

type AuthGatewayState =
  | "checking"
  | "healthy"
  | "unavailable";

const EMPTY_TECHNICAL_ERROR: TechnicalError = {
  code: null,
  status: null,
  details: null,
  hint: null,
  rawSummary: null,
};

export default function CreateAccountPage() {
  const router = useRouter();

  const usernameTimerRef =
    useRef<number | null>(null);

  const usernameRequestRef =
    useRef(0);

  const [displayName, setDisplayName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [accepted, setAccepted] =
    useState(false);

  const [
    usernameState,
    setUsernameState,
  ] = useState<UsernameState>("idle");

  const [checking, setChecking] =
    useState(true);

  const [setupState, setSetupState] =
    useState<SetupState>("checking");

  const [
    authGatewayState,
    setAuthGatewayState,
  ] = useState<AuthGatewayState>(
    "checking",
  );

  const [
    authGatewayMessage,
    setAuthGatewayMessage,
  ] = useState<string | null>(
    null,
  );

  const [submitting, setSubmitting] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    technicalError,
    setTechnicalError,
  ] = useState<TechnicalError>(
    EMPTY_TECHNICAL_ERROR,
  );

  const nextPath = useMemo(
    () =>
      typeof window === "undefined"
        ? "/wishes"
        : getSafeNextPath(),
    [],
  );

  useEffect(() => {
    let active = true;

    async function preparePage() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (sessionError) {
          console.warn(
            "Create-account session check:",
            sessionError,
          );
        }

        if (session) {
          router.replace(nextPath);
          router.refresh();
          return;
        }

        const [
          databaseResult,
          gatewayResponse,
        ] = await Promise.all([
          supabase.rpc(
            "unknown_pulls_registration_health",
          ),

          fetch(
            "/api/auth/register",
            {
              method: "GET",
              cache: "no-store",
            },
          ),
        ]);

        if (!active) {
          return;
        }

        const {
          data: healthData,
          error: healthError,
        } = databaseResult;

        if (healthError) {
          console.error(
            "Registration database health check failed:",
            healthError,
          );

          setSetupState("missing");
        } else {
          const health =
            healthData as
              | RegistrationHealth
              | null;

          setSetupState(
            health?.ok === true
              ? "ready"
              : "missing",
          );
        }

        let gatewayBody:
          | AuthGatewayHealth
          | null = null;

        try {
          gatewayBody =
            (await gatewayResponse.json()) as
              AuthGatewayHealth;
        } catch {
          gatewayBody = null;
        }

        if (
          gatewayResponse.ok &&
          gatewayBody?.ok === true
        ) {
          setAuthGatewayState(
            "healthy",
          );

          setAuthGatewayMessage(
            null,
          );
        } else {
          const message =
            gatewayBody?.error?.message ||
            `Authentication gateway returned HTTP ${gatewayResponse.status}.`;

          const details =
            gatewayBody?.error?.details;

          setAuthGatewayState(
            "unavailable",
          );

          setAuthGatewayMessage(
            details
              ? `${message} ${details}`
              : message,
          );
        }
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        console.error(
          "Create-account preparation failed:",
          error,
        );

        setAuthGatewayState(
          "unavailable",
        );

        setAuthGatewayMessage(
          error instanceof Error &&
          error.message
            ? error.message
            : "The authentication gateway could not be checked.",
        );
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void preparePage();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  useEffect(() => {
    if (usernameTimerRef.current !== null) {
      window.clearTimeout(
        usernameTimerRef.current,
      );
    }

    const cleanUsername =
      normaliseUsername(username);

    if (cleanUsername.length < 3) {
      setUsernameState(
        cleanUsername
          ? "invalid"
          : "idle",
      );

      return;
    }

    if (setupState !== "ready") {
      setUsernameState("unavailable");
      return;
    }

    const requestId =
      usernameRequestRef.current + 1;

    usernameRequestRef.current =
      requestId;

    setUsernameState("checking");

    usernameTimerRef.current =
      window.setTimeout(() => {
        void supabase
          .rpc(
            "check_player_username_available",
            {
              p_username: cleanUsername,
            },
          )
          .then(({ data, error }) => {
            if (
              requestId !==
              usernameRequestRef.current
            ) {
              return;
            }

            if (error) {
              console.error(
                "Username availability check failed:",
                error,
              );

              setUsernameState(
                "unavailable",
              );

              return;
            }

            setUsernameState(
              data === true
                ? "available"
                : "taken",
            );
          });
      }, 420);

    return () => {
      if (
        usernameTimerRef.current !== null
      ) {
        window.clearTimeout(
          usernameTimerRef.current,
        );
      }
    };
  }, [setupState, username]);

  function clearError() {
    setErrorMessage(null);

    setTechnicalError(
      EMPTY_TECHNICAL_ERROR,
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    clearError();

    const cleanName =
      displayName.trim();

    const cleanUsername =
      normaliseUsername(username);

    const cleanEmail =
      email.trim().toLowerCase();

    const strength =
      getPasswordStrength(password);

    if (
      authGatewayState !== "healthy"
    ) {
      setErrorMessage(
        authGatewayMessage ||
          "Supabase Auth is not currently reachable through the registration gateway.",
      );

      return;
    }

    if (setupState !== "ready") {
      setErrorMessage(
        "The registration database upgrade is not active. Run the supplied Supabase migration before creating accounts.",
      );

      return;
    }

    if (
      cleanName.length < 2 ||
      cleanName.length > 60
    ) {
      setErrorMessage(
        "Display name must be between 2 and 60 characters.",
      );

      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage(
        "Username must contain at least 3 characters.",
      );

      return;
    }

    if (
      usernameState !== "available"
    ) {
      setErrorMessage(
        usernameState === "taken"
          ? "That username is already travelling with another trainer."
          : "Wait for the username availability check to finish successfully.",
      );

      return;
    }

    if (!cleanEmail) {
      setErrorMessage(
        "Enter your email address.",
      );

      return;
    }

    /*
     * Previous version treated checks as an array.
     * It is an object, so checks.length was always
     * undefined and every password was rejected.
     */
    if (strength.score < 3) {
      setErrorMessage(
        "Choose a stronger password and complete at least three strength rules.",
      );

      return;
    }

    if (
      password !== confirmPassword
    ) {
      setErrorMessage(
        "The two passwords do not match.",
      );

      return;
    }

    if (!accepted) {
      setErrorMessage(
        "Confirm that you understand how the account and physical-card collection work.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            email: cleanEmail,
            password,
            displayName: cleanName,
            username: cleanUsername,
            nextPath,
          }),
        },
      );

      let result:
        | AuthGatewayRegisterResponse
        | null = null;

      try {
        result =
          (await response.json()) as
            AuthGatewayRegisterResponse;
      } catch {
        result = null;
      }

      if (
        !response.ok ||
        result?.ok !== true
      ) {
        throw {
          code:
            result?.error?.code ||
            "registration_gateway_error",
          status:
            result?.error
              ?.upstreamStatus ||
            response.status,
          message:
            result?.error?.message ||
            `Registration gateway returned HTTP ${response.status}.`,
          details:
            result?.error?.details ||
            result?.error?.rawBody ||
            "The server route did not return a readable Supabase Auth error.",
          hint:
            result?.error?.requestId
              ? `Request ID: ${result.error.requestId}`
              : null,
        };
      }

      const data = {
        user:
          result.user || null,
        session:
          result.session || null,
      };

      if (!data.user) {
        throw {
          code:
            "empty_signup_response",
          message:
            "The registration gateway returned no user.",
          details:
            `Request ID: ${
              result.requestId ||
              "unavailable"
            }`,
        };
      }

      if (
        data.session?.access_token &&
        data.session?.refresh_token
      ) {
        const {
          error: sessionError,
        } = await supabase.auth.setSession({
          access_token:
            data.session.access_token,
          refresh_token:
            data.session.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }
      }

      if (data.session) {
        const {
          error: registrationError,
        } = await supabase.rpc(
          "complete_player_registration",
        );

        if (registrationError) {
          console.error(
            "Immediate player setup failed:",
            registrationError,
          );

          /*
           * The database trigger already attempted
           * the same idempotent setup. Continue to
           * welcome and let the player layout repair
           * the account on the next authenticated load.
           */
        }

        router.replace(
          `/welcome?next=${encodeURIComponent(
            nextPath,
          )}`,
        );

        router.refresh();
        return;
      }

      router.replace(
        `/check-email?email=${encodeURIComponent(
          cleanEmail,
        )}&next=${encodeURIComponent(
          nextPath,
        )}`,
      );
    } catch (error: unknown) {
      console.error(
        "Unknown Pulls signup failure:",
        error,
      );

      const details =
        getAuthErrorDetails(
          error,
          "Unknown Pulls could not create your account.",
        );

      setErrorMessage(details.message);

      setTechnicalError({
        code: details.code,
        status: details.status,
        details: details.details,
        hint: details.hint,
        rawSummary:
          details.rawSummary,
      });

      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <AuthLoading title="Preparing a new symbol" />
    );
  }

  const usernameHint = {
    idle:
      "letters, numbers and underscores",
    checking:
      "checking availability...",
    available:
      "available",
    taken:
      "already taken",
    invalid:
      "minimum 3 characters",
    unavailable:
      "database check unavailable",
  }[usernameState];

  const hasTechnicalError =
    Object.values(
      technicalError,
    ).some((value) => value !== null);

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
            href={`/sign-in?next=${encodeURIComponent(
              nextPath,
            )}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-300/[0.07] px-5 text-sm font-black text-violet-50 hover:bg-violet-300/12"
          >
            Return to sign in
          </Link>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {setupState === "missing" ? (
          <AuthMessage tone="error">
            Registration setup is incomplete.
            Run{" "}
            <strong>
              20260804_unknown_pulls_core_access_repair.sql
            </strong>{" "}
            in the Supabase SQL Editor, then
            refresh this page.
          </AuthMessage>
        ) : null}

        {authGatewayState ===
        "unavailable" ? (
          <AuthMessage tone="error">
            <span className="block font-black">
              Supabase Auth is unavailable
            </span>

            <span className="mt-2 block">
              {authGatewayMessage ||
                "The registration gateway could not reach Supabase Auth."}
            </span>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-red-100/15 bg-red-100/[0.06] px-4 text-xs font-black text-red-50"
            >
              Test Auth again
            </button>
          </AuthMessage>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField label="Display name">
            <input
              value={displayName}
              onChange={(event) =>
                setDisplayName(
                  event.target.value.slice(
                    0,
                    60,
                  ),
                )
              }
              autoComplete="name"
              placeholder="Pokemon Trainer"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </AuthField>

          <AuthField
            label="Username"
            hint={usernameHint}
          >
            <input
              value={username}
              onChange={(event) =>
                setUsername(
                  normaliseUsername(
                    event.target.value,
                  ),
                )
              }
              autoComplete="username"
              placeholder="ancient_trainer"
              disabled={submitting}
              className={`${AUTH_INPUT_CLASS} ${
                usernameState ===
                "available"
                  ? "border-emerald-200/25"
                  : usernameState ===
                      "taken"
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
            onChange={(event) =>
              setEmail(event.target.value)
            }
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
                autoComplete="new-password"
                placeholder="Create a strong password"
                disabled={submitting}
                className={`${AUTH_INPUT_CLASS} pr-20`}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                className="absolute inset-y-0 right-0 px-4 text-[0.62rem] font-black uppercase tracking-[0.1em] text-white/35 hover:text-white"
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </AuthField>

          <AuthField label="Confirm password">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              placeholder="Repeat your password"
              disabled={submitting}
              className={AUTH_INPUT_CLASS}
            />
          </AuthField>
        </div>

        <PasswordStrength
          password={password}
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) =>
              setAccepted(
                event.target.checked,
              )
            }
            className="mt-1 h-4 w-4 accent-cyan-200"
          />

          <span className="text-xs font-semibold leading-6 text-white/38">
            I understand that my account stores
            my digital wish history and ownership
            records for real physical cards, and
            that delivery details are added
            separately inside the Shipping Centre.
          </span>
        </label>

        {errorMessage ? (
          <AuthMessage tone="error">
            {errorMessage}
          </AuthMessage>
        ) : null}

        {hasTechnicalError ? (
          <details className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/45">
            <summary className="cursor-pointer font-black text-white/65">
              Technical details
            </summary>

            <div className="mt-3 space-y-2 break-words font-mono leading-5">
              {technicalError.code ? (
                <p>
                  Code:{" "}
                  {technicalError.code}
                </p>
              ) : null}

              {technicalError.status ? (
                <p>
                  Status:{" "}
                  {technicalError.status}
                </p>
              ) : null}

              {technicalError.details ? (
                <p>
                  Details:{" "}
                  {technicalError.details}
                </p>
              ) : null}

              {technicalError.hint ? (
                <p>
                  Hint:{" "}
                  {technicalError.hint}
                </p>
              ) : null}

              {technicalError.rawSummary ? (
                <p>
                  Raw:{" "}
                  {technicalError.rawSummary}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        <button
          type="submit"
          disabled={
            submitting ||
            setupState !== "ready" ||
            authGatewayState !==
              "healthy" ||
            usernameState !==
              "available"
          }
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_0_35px_rgba(103,232,249,0.11)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Binding your symbol..."
            : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
