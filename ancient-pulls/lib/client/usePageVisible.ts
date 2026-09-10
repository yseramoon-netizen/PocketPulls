"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export default function usePageVisible() {
  return useSyncExternalStore(subscribe, () => document.visibilityState === "visible", () => true);
}
