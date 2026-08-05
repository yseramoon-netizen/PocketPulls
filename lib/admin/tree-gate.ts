"use client";

const TREE_GATE_KEY =
  "pocketpulls:the-tree-we-grow:v9";

const TREE_GATE_LIFETIME_MS =
  30 * 60 * 1000;

export function openTreeGate(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    TREE_GATE_KEY,
    JSON.stringify({
      openedAt: Date.now(),
      token: crypto.randomUUID(),
    }),
  );
}

export function isTreeGateOpen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.sessionStorage.getItem(
    TREE_GATE_KEY,
  );

  if (!raw) {
    return false;
  }

  try {
    const value = JSON.parse(raw) as {
      openedAt?: unknown;
      token?: unknown;
    };

    const openedAt = Number(value.openedAt);

    const valid =
      Number.isFinite(openedAt) &&
      typeof value.token === "string" &&
      value.token.length > 8 &&
      Date.now() - openedAt <=
        TREE_GATE_LIFETIME_MS;

    if (!valid) {
      window.sessionStorage.removeItem(
        TREE_GATE_KEY,
      );
    }

    return valid;
  } catch {
    window.sessionStorage.removeItem(
      TREE_GATE_KEY,
    );
    return false;
  }
}

export function closeTreeGate(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(
    TREE_GATE_KEY,
  );
}
