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

function getBrowserPublicOrigin():
  | string
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return normalisePublicOrigin(
    window.location.origin,
  );
}

export function getConfiguredPublicOrigin():
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
  fallback = "/hq",
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
  fallback = "/hq",
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
  // Account creation and resend requests happen in the browser, so the
  // domain the player is currently using is the safest return address.
  // This also prevents a stale localhost environment value from leaking
  // into confirmation emails on a deployed build.
  const publicOrigin =
    getBrowserPublicOrigin() ||
    getConfiguredPublicOrigin();

  if (publicOrigin) {
    return `${publicOrigin}/auth/callback?next=${encodeURIComponent(
      nextPath,
    )}`;
  }

  return `/auth/callback?next=${encodeURIComponent(
    nextPath,
  )}`;
}

export function buildPasswordRecoveryUrl():
  string {
  const publicOrigin =
    getBrowserPublicOrigin() ||
    getConfiguredPublicOrigin();

  if (publicOrigin) {
    return `${publicOrigin}/update-password`;
  }

  return "/update-password";
}
