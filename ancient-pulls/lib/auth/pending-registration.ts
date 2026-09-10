import { buildAuthCallbackUrl, normaliseNextPath } from "@/lib/auth/navigation";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "unknown-pulls:pending-registration:v1";
const MAX_PENDING_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

export type PendingRegistration = {
  email: string;
  nextPath: string;
  createdAt: number;
  lastSentAt: number;
};

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function cleanTimestamp(value: unknown): number | null {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0
    ? timestamp
    : null;
}

export function readPendingRegistration(): PendingRegistration | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingRegistration>;
    const email = cleanEmail(parsed.email);
    const createdAt = cleanTimestamp(parsed.createdAt);
    const lastSentAt = cleanTimestamp(parsed.lastSentAt);

    if (!email || createdAt === null || lastSentAt === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - createdAt > MAX_PENDING_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      email,
      nextPath: normaliseNextPath(parsed.nextPath),
      createdAt,
      lastSentAt,
    };
  } catch {
    return null;
  }
}

export function rememberPendingRegistration({
  email,
  nextPath,
  lastSentAt,
}: {
  email: string;
  nextPath: string;
  lastSentAt?: number;
}): PendingRegistration {
  const normalisedEmail = cleanEmail(email) || email.trim().toLowerCase();
  const existing = readPendingRegistration();
  const sameAccount = existing?.email === normalisedEmail;

  const pending: PendingRegistration = {
    email: normalisedEmail,
    nextPath: normaliseNextPath(nextPath),
    createdAt: sameAccount ? existing.createdAt : Date.now(),
    lastSentAt:
      typeof lastSentAt === "number"
        ? lastSentAt
        : sameAccount
          ? existing.lastSentAt
          : 0,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch {
      // Private browsing and strict storage settings can block localStorage.
      // The current page can still use the returned in-memory record.
    }
  }

  return pending;
}

export function clearPendingRegistration(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required if storage is unavailable.
  }
}

export function secondsUntilVerificationResend(
  pending: PendingRegistration | null,
  now = Date.now(),
): number {
  if (!pending?.lastSentAt) return 0;

  return Math.max(
    0,
    Math.ceil(
      (pending.lastSentAt + VERIFICATION_RESEND_COOLDOWN_MS - now) /
        1000,
    ),
  );
}

export async function resendSignupConfirmation(
  email: string,
  nextPath: string,
): Promise<PendingRegistration> {
  const normalisedEmail = cleanEmail(email);
  if (!normalisedEmail) {
    throw new Error("Enter a valid email address before resending confirmation.");
  }

  const safeNextPath = normaliseNextPath(nextPath);
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalisedEmail,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(safeNextPath),
    },
  });

  if (error) throw error;

  return rememberPendingRegistration({
    email: normalisedEmail,
    nextPath: safeNextPath,
    lastSentAt: Date.now(),
  });
}
