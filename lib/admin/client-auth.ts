"use client";

import { supabase } from "@/lib/supabase";

export class AdminClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    message: string,
    status = 0,
    code: string | null = null,
  ) {
    super(message);
    this.name = "AdminClientError";
    this.status = status;
    this.code = code;
  }
}

async function getAccessToken(
  forceRefresh = false,
): Promise<string> {
  if (forceRefresh) {
    const {
      data,
      error,
    } =
      await supabase.auth
        .refreshSession();

    if (
      error ||
      !data.session
        ?.access_token
    ) {
      throw new AdminClientError(
        "Your admin session expired. Sign in again.",
        401,
        "admin_session_refresh_failed",
      );
    }

    return data.session
      .access_token;
  }

  const {
    data,
    error,
  } =
    await supabase.auth
      .getSession();

  if (
    error ||
    !data.session
      ?.access_token
  ) {
    throw new AdminClientError(
      "No active Shaymin administrator session was found. Sign in again.",
      401,
      "admin_session_missing",
    );
  }

  const expiresAt =
    typeof data.session
      .expires_at === "number"
      ? data.session.expires_at
      : 0;

  const expiresSoon =
    expiresAt > 0 &&
    expiresAt * 1000 <=
      Date.now() + 120_000;

  if (expiresSoon) {
    return getAccessToken(true);
  }

  return data.session
    .access_token;
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(
  body: unknown,
  fallback: string,
): {
  message: string;
  code: string | null;
} {
  if (
    typeof body === "string" &&
    body.trim()
  ) {
    return {
      message: body.trim(),
      code: null,
    };
  }

  if (
    typeof body === "object" &&
    body !== null
  ) {
    const record =
      body as Record<
        string,
        unknown
      >;

    const error =
      typeof record.error ===
        "object" &&
      record.error !== null
        ? (record.error as Record<
            string,
            unknown
          >)
        : null;

    const message =
      typeof error?.message ===
        "string"
        ? error.message
        : typeof record.message ===
            "string"
          ? record.message
          : fallback;

    const code =
      typeof error?.code ===
        "string"
        ? error.code
        : typeof record.code ===
            "string"
          ? record.code
          : null;

    return {
      message,
      code,
    };
  }

  return {
    message: fallback,
    code: null,
  };
}

export async function adminFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const makeRequest =
    async (
      forceRefresh: boolean,
    ) => {
      const token =
        await getAccessToken(
          forceRefresh,
        );

      const headers =
        new Headers(init.headers);

      headers.set(
        "Authorization",
        `Bearer ${token}`,
      );

      if (
        init.body &&
        !headers.has(
          "Content-Type",
        )
      ) {
        headers.set(
          "Content-Type",
          "application/json",
        );
      }

      return fetch(input, {
        ...init,
        headers,
        cache: "no-store",
      });
    };

  let response =
    await makeRequest(false);

  if (response.status === 401) {
    response =
      await makeRequest(true);
  }

  const body =
    await readResponseBody(
      response,
    );

  if (!response.ok) {
    const {
      message,
      code,
    } = extractMessage(
      body,
      `Admin request returned HTTP ${response.status}.`,
    );

    throw new AdminClientError(
      message,
      response.status,
      code,
    );
  }

  return body as T;
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
  window.location.assign(
    "/admin/sign-in",
  );
}
