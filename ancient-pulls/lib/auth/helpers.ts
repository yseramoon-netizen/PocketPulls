export type AuthErrorDetails = {
  message: string;
  code: string | null;
  status: number | null;
  details: string | null;
  hint: string | null;
  rawSummary: string | null;
};

function readString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function readNumber(
  value: unknown,
): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
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

function safeStringify(
  value: unknown,
): string | null {
  try {
    const serialised = JSON.stringify(value);

    if (
      serialised &&
      serialised !== "{}" &&
      serialised !== "null"
    ) {
      return serialised.slice(0, 800);
    }
  } catch {
    return null;
  }

  return null;
}

export function getAuthErrorDetails(
  error: unknown,
  fallback: string,
): AuthErrorDetails {
  if (error instanceof Error) {
    const record = readRecord(error);
    const message =
      readString(error.message) ||
      fallback;

    return {
      message: translateAuthMessage(
        message,
        readString(record?.code),
      ),
      code: readString(record?.code),
      status: readNumber(record?.status),
      details:
        readString(record?.details) ||
        readString(record?.error_description),
      hint: readString(record?.hint),
      rawSummary: safeStringify({
        name: error.name,
        message: error.message,
        code: record?.code,
        status: record?.status,
        details: record?.details,
        hint: record?.hint,
      }),
    };
  }

  if (typeof error === "string") {
    const message = error.trim();

    return {
      message: translateAuthMessage(
        message || fallback,
        null,
      ),
      code: null,
      status: null,
      details: null,
      hint: null,
      rawSummary:
        message && message !== "{}"
          ? message.slice(0, 800)
          : null,
    };
  }

  const record = readRecord(error);

  if (record) {
    const nestedError =
      readRecord(record.error);

    const code =
      readString(record.code) ||
      readString(record.error_code) ||
      readString(nestedError?.code);

    const message =
      readString(record.message) ||
      readString(record.msg) ||
      readString(record.error_description) ||
      readString(nestedError?.message) ||
      readString(record.details) ||
      readString(record.hint);

    const objectIsEmpty =
      Object.keys(record).length === 0;

    return {
      message: objectIsEmpty
        ? `${fallback} Supabase returned an empty error object instead of a readable reason.`
        : translateAuthMessage(
            message || fallback,
            code,
          ),
      code,
      status:
        readNumber(record.status) ||
        readNumber(nestedError?.status),
      details:
        readString(record.details) ||
        readString(nestedError?.details),
      hint:
        readString(record.hint) ||
        readString(nestedError?.hint),
      rawSummary: safeStringify(error),
    };
  }

  return {
    message: fallback,
    code: null,
    status: null,
    details: null,
    hint: null,
    rawSummary: null,
  };
}

export function getAuthErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return getAuthErrorDetails(
    error,
    fallback,
  ).message;
}

function translateAuthMessage(
  message: string,
  code: string | null,
): string {
  const lower = message
    .trim()
    .toLowerCase();

  const normalisedCode =
    code?.trim().toLowerCase() || "";

  if (
    lower === "{}" ||
    lower === "[object object]"
  ) {
    return "Supabase rejected registration without a readable reason. Run the ancientpulls registration repair migration, then check Authentication > Logs if the problem remains.";
  }

  if (
    normalisedCode === "invalid_credentials" ||
    lower.includes(
      "invalid login credentials",
    )
  ) {
    return "The email or password is incorrect.";
  }

  if (
    normalisedCode ===
      "email_not_confirmed" ||
    lower.includes("email not confirmed")
  ) {
    return "Confirm your email address before signing in.";
  }

  if (
    normalisedCode === "email_exists" ||
    normalisedCode ===
      "user_already_exists" ||
    lower.includes("user already registered") ||
    lower.includes("already been registered")
  ) {
    return "An account already exists for this email address.";
  }

  if (
    normalisedCode ===
      "email_provider_disabled" ||
    lower.includes("signup is disabled") ||
    lower.includes("signups not allowed")
  ) {
    return "Email account registration is disabled in Supabase Authentication settings.";
  }

  if (
    normalisedCode === "weak_password" ||
    lower.includes("password should be") ||
    lower.includes("weak password")
  ) {
    return "Choose a stronger password with at least 10 characters.";
  }

  if (
    normalisedCode ===
      "over_email_send_rate_limit" ||
    normalisedCode ===
      "over_request_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "Too many registration or email attempts were made. Wait a moment and try again.";
  }

  if (
    lower.includes(
      "database error saving new user",
    ) ||
    lower.includes(
      "unexpected_failure",
    )
  ) {
    return "Supabase created the authentication request, but a database trigger or Auth Hook failed while saving the player. Run the registration repair migration and inspect Authentication > Logs.";
  }

  if (
    normalisedCode === "42702" ||
    (lower.includes("wish_balance") && lower.includes("ambiguous"))
  ) {
    return "Your email is confirmed, but the player profile could not finish preparing. The ancientpulls registration repair must be applied, then you can sign in again without creating another account.";
  }

  if (
    lower.includes("same password")
  ) {
    return "Your new password must be different from the previous password.";
  }

  return message;
}

export function normaliseUsername(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export type PasswordStrength = {
  score: number;
  label: string;
  checks: {
    length: boolean;
    mixedCase: boolean;
    number: boolean;
    symbol: boolean;
  };
};

export function getPasswordStrength(
  password: string,
): PasswordStrength {
  const checks = {
    length: password.length >= 10,
    mixedCase:
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(
    checks,
  ).filter(Boolean).length;

  const labels = [
    "Waiting",
    "Fragile",
    "Developing",
    "Strong",
    "Ancient",
  ];

  return {
    score,
    label: labels[score] || "Waiting",
    checks,
  };
}
