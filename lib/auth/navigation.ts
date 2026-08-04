function normalisePublicOrigin(
  value:
    | string
    | null
    | undefined,
): string | null {
  const cleaned =
    value?.trim();

  if (!cleaned) {
    return null;
  }

  const candidate =
    /^https?:\/\//i.test(
      cleaned,
    )
      ? cleaned
      : `https://${cleaned}`;

  try {
    const url =
      new URL(candidate);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredPublicOrigin():
  | string
  | null {
  return (
    normalisePublicOrigin(
      process.env
        .NEXT_PUBLIC_SITE_URL,
    ) ||
    normalisePublicOrigin(
      process.env
        .NEXT_PUBLIC_APP_URL,
    ) ||
    normalisePublicOrigin(
      process.env
        .NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    ) ||
    normalisePublicOrigin(
      process.env
        .NEXT_PUBLIC_VERCEL_URL,
    )
  );
}

export function getSafeNextPath(
  fallback = "/wishes",
): string {
  if (
    typeof window ===
    "undefined"
  ) {
    return fallback;
  }

  const value =
    new URLSearchParams(
      window.location.search,
    ).get("next");

  return normaliseNextPath(
    value,
    fallback,
  );
}

export function normaliseNextPath(
  value:
    | string
    | null
    | undefined,
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
): string | undefined {
  const configuredOrigin =
    getConfiguredPublicOrigin();

  if (configuredOrigin) {
    return `${configuredOrigin}/auth/callback?next=${encodeURIComponent(
      nextPath,
    )}`;
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return undefined;
  }

  const currentOrigin =
    normalisePublicOrigin(
      window.location.origin,
    );

  const hostname =
    window.location.hostname
      .trim()
      .toLowerCase();

  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  /*
   * When developing locally and no public URL is configured,
   * omit emailRedirectTo. Supabase will then use the hosted
   * Site URL configured in Authentication > URL Configuration
   * instead of emailing a localhost link.
   */
  if (isLocalHost) {
    return undefined;
  }

  return currentOrigin
    ? `${currentOrigin}/auth/callback?next=${encodeURIComponent(
        nextPath,
      )}`
    : undefined;
}

export function buildPasswordRecoveryUrl():
  | string
  | undefined {
  const configuredOrigin =
    getConfiguredPublicOrigin();

  if (configuredOrigin) {
    return `${configuredOrigin}/update-password`;
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return undefined;
  }

  const hostname =
    window.location.hostname
      .trim()
      .toLowerCase();

  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (isLocalHost) {
    return undefined;
  }

  return `${window.location.origin}/update-password`;
}
