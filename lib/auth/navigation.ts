export function getSafeNextPath(
  fallback = "/wishes",
): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = new URLSearchParams(
    window.location.search,
  ).get("next");

  return normaliseNextPath(value, fallback);
}

export function normaliseNextPath(
  value: string | null | undefined,
  fallback = "/wishes",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  return value;
}

export function buildAuthCallbackUrl(
  nextPath: string,
): string {
  if (typeof window === "undefined") {
    return `/auth/callback?next=${encodeURIComponent(
      nextPath,
    )}`;
  }

  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    nextPath,
  )}`;
}

export function buildPasswordRecoveryUrl(): string {
  if (typeof window === "undefined") {
    return "/update-password";
  }

  return `${window.location.origin}/update-password`;
}
