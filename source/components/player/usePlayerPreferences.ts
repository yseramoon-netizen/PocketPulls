"use client";
import { useSyncExternalStore } from "react";
import { DEFAULT_PLAYER_PREFERENCES, PLAYER_PREFERENCES_EVENT, PLAYER_PREFERENCES_STORAGE_KEY, readCachedPlayerPreferences, type PlayerPreferences } from "@/lib/player/preferences";

let snapshot: PlayerPreferences = DEFAULT_PLAYER_PREFERENCES;
let serialized = "";
function readSnapshot() {
  const next = readCachedPlayerPreferences();
  const key = JSON.stringify(next);
  if (key !== serialized) { serialized = key; snapshot = next; }
  return snapshot;
}
function subscribe(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PLAYER_PREFERENCES_STORAGE_KEY) notify();
  };
  window.addEventListener(PLAYER_PREFERENCES_EVENT, notify);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", notify);
  return () => {
    window.removeEventListener(PLAYER_PREFERENCES_EVENT, notify);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", notify);
  };
}
export default function usePlayerPreferences(): PlayerPreferences {
  return useSyncExternalStore(subscribe, readSnapshot, () => DEFAULT_PLAYER_PREFERENCES);
}
