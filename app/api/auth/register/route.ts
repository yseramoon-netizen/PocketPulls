import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegisterRequest = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  username?: unknown;
  nextPath?: unknown;
};

type AuthServicePayload =
  Record<string, unknown> & {
    user?: Record<string, unknown> | null;
    session?: Record<string, unknown> | null;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    id?: string;
    email?: string;
    confirmation_sent_at?: string;
    code?: string;
    error_code?: string;
    error?: string | Record<string, unknown>;
    message?: string;
    msg?: string;
    error_description?: string;
  };

class RegisterRouteError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: string | null;
  readonly upstreamStatus: number | null;
  readonly rawBody: string | null;
  readonly upstreamRequestId:
    string | null;

  constructor({
    message,
    status,
    code = null,
    details = null,
    upstreamStatus = null,
    rawBody = null,
    upstreamRequestId = null,
  }: {
    message: string;
    status: number;
    code?: string | null;
    details?: string | null;
    upstreamStatus?: number | null;
    rawBody?: string | null;
    upstreamRequestId?:
      string | null;
  }) {
    super(message);
    this.name = "RegisterRouteError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.upstreamStatus = upstreamStatus;
    this.rawBody = rawBody;
    this.upstreamRequestId =
      upstreamRequestId;
  }
}

function readString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function readRecord(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getSupabaseConfiguration() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const publicKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new RegisterRouteError({
      status: 500,
      code: "missing_supabase_url",
      message:
        "NEXT_PUBLIC_SUPABASE_URL is missing from the server environment.",
    });
  }

  if (!publicKey) {
    throw new RegisterRouteError({
      status: 500,
      code: "missing_supabase_public_key",
      message:
        "No Supabase publishable or anon key is available to the server route.",
      details:
        "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new RegisterRouteError({
      status: 500,
      code: "invalid_supabase_url",
      message:
        "The configured Supabase URL is invalid.",
    });
  }

  return {
    baseUrl:
      parsedUrl.toString().replace(/\/+$/, ""),
    publicKey,
    projectHost: parsedUrl.host,
  };
}

function normaliseNextPath(
  value: unknown,
): string {
  const path = readString(value);

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "/wishes";
  }

  return path.slice(0, 500);
}

function buildCallbackUrl(
  request: Request,
  nextPath: string,
): string {
  const requestUrl = new URL(request.url);
  const callback = new URL(
    "/auth/callback",
    requestUrl.origin,
  );

  callback.searchParams.set(
    "next",
    nextPath,
  );

  return callback.toString();
}

function parseJsonBody(
  text: string,
): AuthServicePayload | null {
  if (!text.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    return readRecord(parsed) as
      | AuthServicePayload
      | null;
  } catch {
    return null;
  }
}

function extractUpstreamError(
  payload: AuthServicePayload | null,
  response: Response,
  rawText: string,
): {
  code: string | null;
  message: string;
  details: string | null;
} {
  const nestedError =
    readRecord(payload?.error);

  const code =
    readString(payload?.code) ||
    readString(payload?.error_code) ||
    readString(nestedError?.code);

  const upstreamMessage =
    readString(payload?.message) ||
    readString(payload?.msg) ||
    readString(payload?.error_description) ||
    readString(payload?.error) ||
    readString(nestedError?.message);

  if (response.status === 503) {
    return {
      code:
        code ||
        "auth_service_unavailable",
      message:
        upstreamMessage ||
        "Supabase Auth is unavailable with HTTP 503.",
      details:
        "Check Supabase Dashboard > Authentication > Sessions. An invalid Timebox duration can prevent the Auth service from starting; restore a normal value such as 4320 hours.",
    };
  }

  if (response.status === 429) {
    return {
      code:
        code ||
        "auth_rate_limit",
      message:
        upstreamMessage ||
        "Supabase is temporarily rate-limiting registration or confirmation emails.",
      details:
        "The built-in email service has strict limits. Wait before retrying or configure custom SMTP.",
    };
  }

  if (
    response.status === 500 &&
    (
      code === "unexpected_failure" ||
      upstreamMessage
        ?.toLowerCase()
        .includes(
          "database error saving new user",
        )
    )
  ) {
    return {
      code:
        code ||
        "database_signup_transaction_failure",
      message:
        upstreamMessage ||
        "Supabase could not commit the new Auth user.",
      details:
        "The public Auth API intentionally hides the underlying Postgres error. Possible causes include a custom trigger on any Auth table, a constraint on auth.users, damaged auth-schema ownership or privileges, forced RLS, or a configured Before User Created Hook. Run 20260804_unknown_pulls_auth_transaction_repair.sql, retry once, then use the included Auth and Postgres Log Explorer queries if the 500 remains.",
    };
  }

  if (response.status >= 500) {
    return {
      code:
        code ||
        "auth_upstream_failure",
      message:
        upstreamMessage ||
        `Supabase Auth returned HTTP ${response.status}.`,
      details:
        "Open Supabase Dashboard > Authentication > Logs and Postgres Logs to inspect the matching request.",
    };
  }

  return {
    code,
    message:
      upstreamMessage ||
      response.statusText ||
      "Supabase rejected the registration request.",
    details:
      rawText.trim() &&
      rawText.trim() !== "{}"
        ? rawText.trim().slice(0, 1200)
        : null,
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  requestId: string =
    crypto.randomUUID(),
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      "X-Unknown-Pulls-Request-Id":
        requestId,
    },
  });
}

function errorResponse(
  error: unknown,
  requestId: string,
) {
  if (error instanceof RegisterRouteError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          upstreamStatus:
            error.upstreamStatus,
          rawBody: error.rawBody,
          upstreamRequestId:
            error.upstreamRequestId,
          requestId,
        },
      },
      error.status,
      requestId,
    );
  }

  const record = readRecord(error);

  const message =
    error instanceof Error &&
    error.message.trim()
      ? error.message.trim()
      : readString(record?.message) ||
        "The registration gateway failed.";

  return jsonResponse(
    {
      ok: false,
      error: {
        message,
        code:
          readString(record?.code) ||
          "registration_gateway_failure",
        details: null,
        upstreamStatus: null,
        rawBody: null,
        requestId,
      },
    },
    500,
    requestId,
  );
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const {
      baseUrl,
      publicKey,
      projectHost,
    } = getSupabaseConfiguration();

    const startedAt = Date.now();

    let response: Response;

    try {
      response = await fetchWithTimeout(
        `${baseUrl}/auth/v1/health`,
        {
          method: "GET",
          headers: {
            apikey: publicKey,
            Accept: "application/json",
            "X-Client-Info":
              "unknown-pulls-auth-gateway/1.1",
            "X-Request-ID":
              requestId,
          },
        },
        10000,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error &&
        error.name === "AbortError"
          ? "Supabase Auth health check timed out after 10 seconds."
          : error instanceof Error
            ? error.message
            : "Supabase Auth health check could not connect.";

      throw new RegisterRouteError({
        status: 503,
        code:
          "auth_health_network_failure",
        message,
        details:
          `The configured Auth host is ${projectHost}.`,
      });
    }

    const rawText =
      await response.text();

    const upstreamRequestId =
      response.headers.get(
        "x-request-id",
      ) ||
      response.headers.get(
        "sb-request-id",
      ) ||
      response.headers.get(
        "x-supabase-request-id",
      ) ||
      response.headers.get(
        "cf-ray",
      );

    const payload =
      parseJsonBody(rawText);

    if (!response.ok) {
      const upstream =
        extractUpstreamError(
          payload,
          response,
          rawText,
        );

      throw new RegisterRouteError({
        status: 503,
        code: upstream.code,
        message: upstream.message,
        details: upstream.details,
        upstreamStatus:
          response.status,
        rawBody:
          rawText.trim()
            ? rawText.slice(0, 1200)
            : null,
        upstreamRequestId,
      });
    }

    return jsonResponse(
      {
        ok: true,
        service: {
          host: projectHost,
          status: response.status,
          latencyMs:
            Date.now() - startedAt,
          response:
            payload ||
            rawText.trim() ||
            "healthy",
        },
        requestId,
        upstreamRequestId,
      },
      200,
      requestId,
    );
  } catch (error: unknown) {
    return errorResponse(
      error,
      requestId,
    );
  }
}

export async function POST(
  request: Request,
) {
  const requestId = crypto.randomUUID();

  try {
    const requestUrl =
      new URL(request.url);

    const requestOrigin =
      request.headers.get("origin");

    if (
      requestOrigin &&
      requestOrigin !==
        requestUrl.origin
    ) {
      throw new RegisterRouteError({
        status: 403,
        code:
          "cross_origin_registration_blocked",
        message:
          "Cross-origin registration requests are not allowed.",
      });
    }

    const {
      baseUrl,
      publicKey,
      projectHost,
    } = getSupabaseConfiguration();

    let body: RegisterRequest;

    try {
      body =
        (await request.json()) as RegisterRequest;
    } catch {
      throw new RegisterRouteError({
        status: 400,
        code: "invalid_json",
        message:
          "The registration request body was invalid.",
      });
    }

    const email =
      readString(body.email)
        ?.toLowerCase() || "";

    const password =
      readString(body.password) || "";

    const displayName =
      readString(body.displayName) || "";

    const username =
      readString(body.username)
        ?.toLowerCase() || "";

    const nextPath =
      normaliseNextPath(body.nextPath);

    if (
      !email ||
      !email.includes("@")
    ) {
      throw new RegisterRouteError({
        status: 400,
        code: "invalid_email",
        message:
          "Enter a valid email address.",
      });
    }

    if (password.length < 10) {
      throw new RegisterRouteError({
        status: 400,
        code: "weak_password",
        message:
          "Password must contain at least 10 characters.",
      });
    }

    if (
      displayName.length < 2 ||
      displayName.length > 60
    ) {
      throw new RegisterRouteError({
        status: 400,
        code: "invalid_display_name",
        message:
          "Display name must be between 2 and 60 characters.",
      });
    }

    if (
      !/^[a-z0-9_]{3,24}$/.test(
        username,
      )
    ) {
      throw new RegisterRouteError({
        status: 400,
        code: "invalid_username",
        message:
          "Username must contain 3 to 24 lowercase letters, numbers or underscores.",
      });
    }

    const callbackUrl =
      buildCallbackUrl(
        request,
        nextPath,
      );

    const signupUrl = new URL(
      `${baseUrl}/auth/v1/signup`,
    );

    signupUrl.searchParams.set(
      "redirect_to",
      callbackUrl,
    );

    let response: Response;

    try {
      response = await fetchWithTimeout(
        signupUrl.toString(),
        {
          method: "POST",
          headers: {
            apikey: publicKey,
            Authorization:
              `Bearer ${publicKey}`,
            "Content-Type":
              "application/json",
            Accept: "application/json",
            "X-Client-Info":
              "unknown-pulls-auth-gateway/1.1",
            "X-Request-ID":
              requestId,
          },
          body: JSON.stringify({
            email,
            password,
            data: {
              display_name:
                displayName,
              username,
              brand:
                "Ancient Pulls",
            },
          }),
        },
        25000,
      );
    } catch (error: unknown) {
      const timedOut =
        error instanceof Error &&
        error.name === "AbortError";

      throw new RegisterRouteError({
        status: 503,
        code: timedOut
          ? "auth_signup_timeout"
          : "auth_signup_network_failure",
        message: timedOut
          ? "Supabase Auth did not answer the signup request within 25 seconds."
          : "The server could not connect to Supabase Auth.",
        details:
          `Auth host: ${projectHost}. Because signup is not safely repeatable after a lost response, the gateway did not submit a second automatic request. Check your email or try signing in before retrying registration.`,
      });
    }

    const rawText =
      await response.text();

    const upstreamRequestId =
      response.headers.get(
        "x-request-id",
      ) ||
      response.headers.get(
        "sb-request-id",
      ) ||
      response.headers.get(
        "x-supabase-request-id",
      ) ||
      response.headers.get(
        "cf-ray",
      );

    const payload =
      parseJsonBody(rawText);

    if (!response.ok) {
      const upstream =
        extractUpstreamError(
          payload,
          response,
          rawText,
        );

      throw new RegisterRouteError({
        status:
          response.status >= 400 &&
          response.status <= 599
            ? response.status
            : 502,
        code: upstream.code,
        message: upstream.message,
        details: upstream.details,
        upstreamStatus:
          response.status,
        rawBody:
          rawText.trim()
            ? rawText.slice(0, 1200)
            : null,
        upstreamRequestId,
      });
    }

    if (!payload) {
      throw new RegisterRouteError({
        status: 502,
        code:
          "empty_auth_success_response",
        message:
          "Supabase Auth returned an empty success response for password signup.",
        details:
          "Check Authentication > Logs for the request and verify that no proxy or Auth Hook is replacing the response body.",
        upstreamStatus:
          response.status,
      });
    }

    const nestedUser =
      readRecord(payload.user);

    const user =
      nestedUser ||
      (readString(payload.id)
        ? payload
        : null);

    const accessToken =
      readString(payload.access_token);

    const refreshToken =
      readString(payload.refresh_token);

    const session =
      accessToken && refreshToken
        ? {
            access_token:
              accessToken,
            refresh_token:
              refreshToken,
            expires_in:
              typeof payload.expires_in ===
                "number"
                ? payload.expires_in
                : null,
            expires_at:
              typeof payload.expires_at ===
                "number"
                ? payload.expires_at
                : null,
            token_type:
              readString(
                payload.token_type,
              ) || "bearer",
          }
        : readRecord(payload.session);

    if (!user) {
      throw new RegisterRouteError({
        status: 502,
        code:
          "missing_user_in_auth_response",
        message:
          "Supabase accepted the request but did not return a user record.",
        details:
          rawText.trim().slice(0, 1200),
        upstreamStatus:
          response.status,
      });
    }

    return jsonResponse(
      {
        ok: true,
        user,
        session,
        confirmationRequired:
          !session,
        requestId,
        upstreamRequestId,
      },
      200,
      requestId,
    );
  } catch (error: unknown) {
    return errorResponse(
      error,
      requestId,
    );
  }
}
