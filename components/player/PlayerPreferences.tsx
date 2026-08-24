"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  applyPlayerPreferences,
  DEFAULT_PLAYER_PREFERENCES,
  normalisePlayerPreferences,
  playerPreferencesRpcPayload,
  publishPlayerPreferences,
  readCachedPlayerPreferences,
  type PlayerPreferences,
} from "@/lib/player/preferences";
import { supabase } from "@/lib/supabase";

type SaveState = "idle" | "saving" | "saved" | "local";

export default function PlayerPreferencesPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const initialPreferencesRef = useRef<PlayerPreferences | null>(null);
  if (initialPreferencesRef.current === null) {
    initialPreferencesRef.current = readCachedPlayerPreferences();
  }
  const latestPreferencesRef = useRef<PlayerPreferences>(
    initialPreferencesRef.current,
  );

  const [mounted] = useState(() => typeof document !== "undefined");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [preferences, setPreferences] = useState<PlayerPreferences>(
    initialPreferencesRef.current,
  );

  const savePreferences = useCallback(async (next: PlayerPreferences) => {
    setSaveState("saving");

    const { data, error } = await supabase.rpc(
      "update_player_preferences",
      playerPreferencesRpcPayload(next),
    );

    if (error) {
      console.warn("Player preferences could not sync:", error.message);
      setServerAvailable(false);
      setSaveState("local");
      return;
    }

    const saved = normalisePlayerPreferences(
      Array.isArray(data) ? data[0] : data,
      next,
    );

    latestPreferencesRef.current = saved;
    setPreferences(saved);
    publishPlayerPreferences(saved);
    setServerAvailable(true);
    setSaveState("saved");
  }, []);

  const queueSave = useCallback(
    (next: PlayerPreferences) => {
      latestPreferencesRef.current = next;
      publishPlayerPreferences(next);

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      setSaveState(serverAvailable ? "saving" : "local");

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void savePreferences(latestPreferencesRef.current);
      }, 520);
    },
    [savePreferences, serverAvailable],
  );

  const updatePreferences = useCallback(
    (change: Partial<PlayerPreferences>) => {
      setPreferences((current) => {
        const next = normalisePlayerPreferences({ ...current, ...change }, current);
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  useEffect(() => {
    const cached = initialPreferencesRef.current ?? DEFAULT_PLAYER_PREFERENCES;
    publishPlayerPreferences(cached);

    let active = true;

    void supabase.rpc("get_player_preferences").then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        console.warn("Player preferences are using device storage:", error.message);
        setServerAvailable(false);
        setSaveState("local");
        setLoaded(true);
        return;
      }

      const synced = normalisePlayerPreferences(
        Array.isArray(data) ? data[0] : data,
        cached,
      );

      latestPreferencesRef.current = synced;
      setPreferences(synced);
      publishPlayerPreferences(synced);
      setServerAvailable(true);
      setSaveState("saved");
      setLoaded(true);
    });

    return () => {
      active = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      applyPlayerPreferences(DEFAULT_PLAYER_PREFERENCES);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const statusLabel = saveState === "saving"
    ? "Saving…"
    : serverAvailable
      ? "Synced to account"
      : "Saved on this device";

  const panel = open ? (
    <div className="fixed inset-0 z-[165]">
      <button
        type="button"
        aria-label="Close player preferences"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-[#02030d]/78 backdrop-blur-sm"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-preferences-title"
        className="absolute inset-x-3 top-10 mx-auto flex max-h-[calc(100dvh-5rem)] w-auto max-w-xl flex-col overflow-hidden rounded-[2rem] border border-violet-100/20 bg-[#080a24]/98 shadow-[0_40px_140px_rgba(0,0,0,0.78)] backdrop-blur-3xl sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[34rem]"
      >
        <div className="h-1 flex-none bg-gradient-to-r from-violet-300 via-cyan-200 to-yellow-100" />

        <header className="flex flex-none items-start gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border border-violet-200/20 bg-violet-200/[0.09] text-xl text-violet-50">
            ⚙
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/45">
              Comfort and performance
            </p>
            <h2
              id="player-preferences-title"
              className="mt-1 text-xl font-black text-white"
            >
              Player preferences
            </h2>
            <p className="mt-1 text-xs font-bold text-white/38">
              {loaded ? statusLabel : "Reading your settings…"}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close player preferences"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg font-black text-white/70 transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <section>
            <SectionTitle
              glyph="♫"
              title="Sound"
              detail="Pull effects respond immediately. Music volume is ready for ambient tracks."
            />

            <div className="mt-3 space-y-3">
              <VolumeControl
                label="Music volume"
                value={preferences.musicVolume}
                onChange={(musicVolume) => updatePreferences({ musicVolume })}
              />
              <VolumeControl
                label="Sound-effect volume"
                value={preferences.sfxVolume}
                onChange={(sfxVolume) => updatePreferences({ sfxVolume })}
              />
            </div>
          </section>

          <section className="mt-6 border-t border-white/[0.08] pt-6">
            <SectionTitle
              glyph="◌"
              title="Comfort"
              detail="Make the magical interface calmer or easier to read."
            />

            <div className="mt-3 space-y-2">
              <ToggleRow
                title="Reduced motion"
                description="Stops non-essential movement, pulsing and transitions."
                checked={preferences.reducedMotion}
                onChange={(reducedMotion) => updatePreferences({ reducedMotion })}
              />
              <ToggleRow
                title="Lower visual effects"
                description="Removes heavy blur, glow and animated background layers."
                checked={preferences.lowVisualEffects}
                onChange={(lowVisualEffects) =>
                  updatePreferences({ lowVisualEffects })
                }
              />
              <ToggleRow
                title="Larger interface text"
                description="Increases text and control sizing throughout the player site."
                checked={preferences.largerText}
                onChange={(largerText) => updatePreferences({ largerText })}
              />
            </div>
          </section>

          <section className="mt-6 border-t border-white/[0.08] pt-6">
            <SectionTitle
              glyph="✦"
              title="Pull ceremony"
              detail="Keep the first reveal cinematic while making later pulls quicker."
            />

            <div className="mt-3 space-y-2">
              <ToggleRow
                title="Skip cinematics after the first viewing"
                description="Future pulls reveal immediately after you have watched one full ceremony."
                checked={preferences.skipPullCinematic}
                onChange={(skipPullCinematic) =>
                  updatePreferences({ skipPullCinematic })
                }
              />
              <ToggleRow
                title="Mobile data-saving mode"
                description="Uses lighter backgrounds and immediate card reveals."
                checked={preferences.dataSaver}
                onChange={(dataSaver) => updatePreferences({ dataSaver })}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);

                if (pathname === "/wishes") {
                  window.dispatchEvent(
                    new Event("pocketpulls:replay-latest-wish"),
                  );
                  return;
                }

                router.push("/wishes?replay=latest");
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-yellow-100/20 bg-yellow-200/[0.07] px-4 text-left transition hover:border-yellow-100/30 hover:bg-yellow-200/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100"
            >
              <span>
                <span className="block text-sm font-black text-yellow-50">
                  Replay latest pull cinematic
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-white/35">
                  Rewatch your most recent card without spending a wish.
                </span>
              </span>
              <span aria-hidden="true" className="ml-3 text-yellow-100/65">
                →
              </span>
            </button>
          </section>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
            <p className="max-w-xs text-[0.67rem] font-semibold leading-5 text-white/28">
              System reduced-motion preferences are respected automatically on a
              new device.
            </p>
            <button
              type="button"
              onClick={() =>
                updatePreferences({
                  ...DEFAULT_PLAYER_PREFERENCES,
                  cinematicSeen: preferences.cinematicSeen,
                })
              }
              className="flex-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/55 transition hover:bg-white/[0.08] hover:text-white"
            >
              Restore defaults
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open player preferences"
        aria-expanded={open}
        title="Player preferences"
        className="relative flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-violet-100/15 bg-violet-200/[0.055] text-lg text-violet-50 transition hover:border-violet-100/25 hover:bg-violet-200/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
      >
        <span aria-hidden="true">⚙</span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function SectionTitle({
  glyph,
  title,
  detail,
}: {
  glyph: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-cyan-100/14 bg-cyan-200/[0.055] text-sm font-black text-cyan-50">
        {glyph}
      </span>
      <div>
        <h3 className="text-sm font-black text-white">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-white/35">
          {detail}
        </p>
      </div>
    </div>
  );
}

function VolumeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-black text-white/75">{label}</span>
        <span className="min-w-10 text-right text-xs font-black text-cyan-100/65">
          {value}%
        </span>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer accent-cyan-200"
        aria-label={label}
      />
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 transition hover:bg-white/[0.055]">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-white/78">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-white/34">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-7 w-12 flex-none rounded-full border border-white/10 bg-white/[0.08] transition after:absolute after:left-1 after:top-1 after:h-[1.125rem] after:w-[1.125rem] after:rounded-full after:bg-white/55 after:shadow after:transition peer-checked:border-cyan-100/30 peer-checked:bg-cyan-300/35 peer-checked:after:translate-x-5 peer-checked:after:bg-cyan-50 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200" />
    </label>
  );
}
