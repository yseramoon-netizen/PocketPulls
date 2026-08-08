"use client";

import { adminSupabase as supabase } from "@/lib/admin/supabase";

const ADMIN_GATE_KEY =
  "pocketpulls:shaymin-admin-gate:v8";

export type AdminGate = {
  userId: string;
  email: string;
  verifiedAt: number;
};

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

export function readAdminGate(): AdminGate | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored =
    window.sessionStorage.getItem(
      ADMIN_GATE_KEY,
    );

  if (!stored) {
    return null;
  }

  try {
    const value = JSON.parse(
      stored,
    ) as Partial<AdminGate>;

    if (
      typeof value.userId !== "string" ||
      !value.userId.trim() ||
      typeof value.email !== "string" ||
      !value.email.trim() ||
      typeof value.verifiedAt !== "number" ||
      !Number.isFinite(value.verifiedAt)
    ) {
      throw new Error(
        "Invalid admin gate.",
      );
    }

    return {
      userId: value.userId,
      email: value.email,
      verifiedAt: value.verifiedAt,
    };
  } catch {
    window.sessionStorage.removeItem(
      ADMIN_GATE_KEY,
    );
    return null;
  }
}

export function writeAdminGate(
  gate: AdminGate,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    ADMIN_GATE_KEY,
    JSON.stringify(gate),
  );
}

export function clearAdminGate(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(
    ADMIN_GATE_KEY,
  );
}

async function getAccessToken(
  forceRefresh = false,
): Promise<string> {
  const gate = readAdminGate();

  if (!gate) {
    throw new AdminClientError(
      "The administration area is locked. Sign in through the administrator gateway first.",
      401,
      "admin_fresh_login_required",
    );
  }

  if (forceRefresh) {
    const {
      data,
      error,
    } = await supabase.auth.refreshSession();

    if (
      error ||
      !data.session?.access_token
    ) {
      clearAdminGate();
      throw new AdminClientError(
        "Your admin session expired. Sign in again.",
        401,
        "admin_session_refresh_failed",
      );
    }

    if (
      data.session.user.id !==
      gate.userId
    ) {
      clearAdminGate();
      throw new AdminClientError(
        "The active account changed. Sign in to the administration area again.",
        401,
        "admin_session_changed",
      );
    }

    return data.session.access_token;
  }

  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (
    error ||
    !data.session?.access_token
  ) {
    clearAdminGate();
    throw new AdminClientError(
      "No active administrator session was found. Sign in again.",
      401,
      "admin_session_missing",
    );
  }

  if (
    data.session.user.id !==
    gate.userId
  ) {
    clearAdminGate();
    throw new AdminClientError(
      "The active account no longer matches the administrator who unlocked this session.",
      401,
      "admin_session_changed",
    );
  }

  const expiresAt =
    typeof data.session.expires_at ===
      "number"
      ? data.session.expires_at
      : 0;

  const expiresSoon =
    expiresAt > 0 &&
    expiresAt * 1000 <=
      Date.now() + 120_000;

  if (expiresSoon) {
    return getAccessToken(true);
  }

  return data.session.access_token;
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const text = await response.text();

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
    const record = body as Record<
      string,
      unknown
    >;

    const error =
      typeof record.error === "object" &&
      record.error !== null
        ? (record.error as Record<
            string,
            unknown
          >)
        : null;

    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof record.message === "string"
          ? record.message
          : fallback;

    const code =
      typeof error?.code === "string"
        ? error.code
        : typeof record.code === "string"
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
  const makeRequest = async (
    forceRefresh: boolean,
  ) => {
    const token = await getAccessToken(
      forceRefresh,
    );

    const headers = new Headers(
      init.headers,
    );

    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );

    if (
      init.body &&
      !headers.has("Content-Type")
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

  let response = await makeRequest(false);

  if (response.status === 401) {
    response = await makeRequest(true);
  }

  const body = await readResponseBody(
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

    if (response.status === 401) {
      clearAdminGate();
    }

    throw new AdminClientError(
      message,
      response.status,
      code,
    );
  }

  return body as T;
}

export async function signOutAdmin(): Promise<void> {
  clearAdminGate();

  try {
    await supabase.auth.signOut();
  } finally {
    window.location.assign(
      "/admin/sign-in",
    );
  }
}
