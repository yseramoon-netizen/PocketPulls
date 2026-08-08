"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_PLAYER_PREFERENCES,
  PLAYER_PREFERENCES_EVENT,
  readCachedPlayerPreferences,
  type PlayerPreferences,
} from "@/lib/player/preferences";

export default function usePlayerPreferences(): PlayerPreferences {
  const [preferences, setPreferences] = useState<PlayerPreferences>(
    DEFAULT_PLAYER_PREFERENCES,
  );

  useEffect(() => {
    const refresh = (event: Event) => {
      const customEvent = event as CustomEvent<PlayerPreferences>;

      setPreferences(customEvent.detail || readCachedPlayerPreferences());
    };

    setPreferences(readCachedPlayerPreferences());
    window.addEventListener(PLAYER_PREFERENCES_EVENT, refresh);

    return () => {
      window.removeEventListener(PLAYER_PREFERENCES_EVENT, refresh);
    };
  }, []);

  return preferences;
}
