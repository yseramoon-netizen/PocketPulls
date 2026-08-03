export function getAuthErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.trim()) {
    return translateAuthMessage(error.message.trim());
  }

  if (typeof error === "string" && error.trim()) {
    return translateAuthMessage(error.trim());
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return translateAuthMessage(message.trim());
    }
  }

  return fallback;
}

function translateAuthMessage(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (lower.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (lower.includes("user already registered")) {
    return "An account already exists for this email address.";
  }

  if (lower.includes("password should be")) {
    return "Choose a stronger password with at least 10 characters.";
  }

  if (lower.includes("rate limit")) {
    return "Too many attempts were made. Wait a moment and try again.";
  }

  if (lower.includes("signup is disabled")) {
    return "New account registration is currently closed.";
  }

  if (lower.includes("same password")) {
    return "Your new password must be different from the previous password.";
  }

  return message;
}

export function normaliseUsername(value: string): string {
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
      /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

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
