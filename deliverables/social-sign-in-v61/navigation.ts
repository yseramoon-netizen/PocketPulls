function normalisePublicOrigin(
  value: string | null | undefined,
): string | null {
  const cleaned = value?.trim();

  if (!cleaned) return null;

  const candidate = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getBrowserPublicOrigin(): string | null {
  if (typeof window === "undefined") return null;

  return normalisePublicOrigin(window.location.origin);
}

export function getConfiguredPublicOrigin(): string | null {
  return (
    normalisePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalisePublicOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalisePublicOrigin(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ||
    normalisePublicOrigin(process.env.NEXT_PUBLIC_VERCEL_URL)
  );
}

export function getSafeNextPath(fallback = "/hq"): string {
  if (typeof window === "undefined") return fallback;

  return normaliseNextPath(
    new URLSearchParams(window.location.search).get("next"),
    fallback,
  );
}

/**
 * Keeps auth redirects inside this Next.js application. Query strings are
 * allowed (some existing player routes use them), but protocol-relative and
 * escaped paths are rejected so this can never become an open redirect.
 */
export function normaliseNextPath(
  value: string | null | undefined,
  fallback = "/hq",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\u0000")
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://ancientpulls.invalid");
    const destination = new URL(value, base);

    if (destination.origin !== base.origin) return fallback;

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAuthCallbackUrl(nextPath: string): string {
  // Browser origin takes priority: it prevents an old localhost variable from
  // leaking into production confirmation/OAuth return addresses.
  const publicOrigin = getBrowserPublicOrigin() || getConfiguredPublicOrigin();
  const safeNextPath = normaliseNextPath(nextPath);
  const callbackPath = `/auth/callback?next=${encodeURIComponent(safeNextPath)}`;

  return publicOrigin ? `${publicOrigin}${callbackPath}` : callbackPath;
}

export function buildPasswordRecoveryUrl(): string {
  return buildAuthCallbackUrl("/update-password");
}
