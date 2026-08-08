export type PlayerPreferences = {
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  lowVisualEffects: boolean;
  largerText: boolean;
  skipPullCinematic: boolean;
  dataSaver: boolean;
  cinematicSeen: boolean;
};

export const PLAYER_PREFERENCES_EVENT = "pocketpulls:preferences-updated";
export const PLAYER_PREFERENCES_STORAGE_KEY = "pocketpulls:player-preferences-v1";

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  musicVolume: 35,
  sfxVolume: 72,
  reducedMotion: false,
  lowVisualEffects: false,
  largerText: false,
  skipPullCinematic: false,
  dataSaver: false,
  cinematicSeen: false,
};

function volume(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalisePlayerPreferences(
  value: unknown,
  fallback: PlayerPreferences = DEFAULT_PLAYER_PREFERENCES,
): PlayerPreferences {
  if (typeof value !== "object" || value === null) {
    return { ...fallback };
  }

  const row = value as Record<string, unknown>;

  return {
    musicVolume: volume(
      row.musicVolume ?? row.music_volume,
      fallback.musicVolume,
    ),
    sfxVolume: volume(row.sfxVolume ?? row.sfx_volume, fallback.sfxVolume),
    reducedMotion: boolean(
      row.reducedMotion ?? row.reduced_motion,
      fallback.reducedMotion,
    ),
    lowVisualEffects: boolean(
      row.lowVisualEffects ?? row.low_visual_effects,
      fallback.lowVisualEffects,
    ),
    largerText: boolean(
      row.largerText ?? row.larger_text,
      fallback.largerText,
    ),
    skipPullCinematic: boolean(
      row.skipPullCinematic ?? row.skip_pull_cinematic,
      fallback.skipPullCinematic,
    ),
    dataSaver: boolean(row.dataSaver ?? row.data_saver, fallback.dataSaver),
    cinematicSeen: boolean(
      row.cinematicSeen ?? row.cinematic_seen,
      fallback.cinematicSeen,
    ),
  };
}

export function readCachedPlayerPreferences(): PlayerPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PLAYER_PREFERENCES };
  }

  const systemReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const fallback = {
    ...DEFAULT_PLAYER_PREFERENCES,
    reducedMotion: systemReducedMotion,
  };

  try {
    const stored = window.localStorage.getItem(PLAYER_PREFERENCES_STORAGE_KEY);

    return stored
      ? normalisePlayerPreferences(JSON.parse(stored), fallback)
      : fallback;
  } catch {
    return fallback;
  }
}

export function applyPlayerPreferences(preferences: PlayerPreferences): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.dataset.ppReducedMotion = String(preferences.reducedMotion);
  root.dataset.ppLowEffects = String(preferences.lowVisualEffects);
  root.dataset.ppLargerText = String(preferences.largerText);
  root.dataset.ppDataSaver = String(preferences.dataSaver);
  root.style.setProperty("--pp-music-volume", String(preferences.musicVolume / 100));
  root.style.setProperty("--pp-sfx-volume", String(preferences.sfxVolume / 100));
}

export function cachePlayerPreferences(preferences: PlayerPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PLAYER_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Preferences still work for this page when browser storage is blocked.
  }
}

export function publishPlayerPreferences(preferences: PlayerPreferences): void {
  const normalised = normalisePlayerPreferences(preferences);

  applyPlayerPreferences(normalised);
  cachePlayerPreferences(normalised);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PlayerPreferences>(PLAYER_PREFERENCES_EVENT, {
        detail: normalised,
      }),
    );
  }
}

export function playerPreferencesRpcPayload(preferences: PlayerPreferences) {
  return {
    p_music_volume: preferences.musicVolume,
    p_sfx_volume: preferences.sfxVolume,
    p_reduced_motion: preferences.reducedMotion,
    p_low_visual_effects: preferences.lowVisualEffects,
    p_larger_text: preferences.largerText,
    p_skip_pull_cinematic: preferences.skipPullCinematic,
    p_data_saver: preferences.dataSaver,
  };
}
