"use client";

import { useEffect, useMemo, useState } from "react";

import { PlayerPanel } from "@/components/player/PlayerUI";
import {
  applyNebuSkin,
  getNebuSkin,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  NEBU_SKINS,
  readNebuSkin,
  type NebuSkin,
  type NebuSkinKey,
} from "@/lib/player/nebu";
import { supabase } from "@/lib/supabase";

type AchievementUnlock = {
  key: string;
  unlockedAt: string | null;
};

type NebuWardrobeProps = {
  achievements: AchievementUnlock[];
  loading: boolean;
};

function unlockCopy(skin: NebuSkin, unlocked: boolean, loading: boolean) {
  if (!skin.achievementKey) {
    return "Original colours · always available";
  }

  if (loading) {
    return "Checking your badge...";
  }

  return unlocked
    ? `Unlocked by ${skin.achievementTitle}`
    : `Unlock badge: ${skin.achievementTitle}`;
}

export default function NebuWardrobe({
  achievements,
  loading,
}: NebuWardrobeProps) {
  const [selected, setSelected] = useState<NebuSkinKey>("midnight");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unlockedKeys = useMemo(
    () =>
      new Set(
        achievements
          .filter((achievement) => Boolean(achievement.unlockedAt))
          .map((achievement) => achievement.key),
      ),
    [achievements],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSelected(readNebuSkin());
    });

    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;

      if (isNebuSkinKey(key)) {
        setSelected(key);
      }
    };

    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  const selectSkin = async (skin: NebuSkin) => {
    const unlocked =
      !skin.achievementKey || unlockedKeys.has(skin.achievementKey);

    if (!unlocked || saving) {
      setMessage(
        skin.achievementTitle
          ? `Complete “${skin.achievementTitle}” to unlock ${skin.label}.`
          : null,
      );
      return;
    }

    setSelected(skin.key);
    setMessage(`${skin.label} is now equipped on Nebu.`);
    applyNebuSkin(skin.key);
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { nebu_skin: skin.key },
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      console.error("Nebu colour sync error:", error);
      setMessage(
        `${skin.label} is equipped on this device, but account sync could not be completed.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedSkin = getNebuSkin(selected);

  return (
    <PlayerPanel className="relative mt-6 overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-cyan-300/10 blur-[90px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-yellow-200/10 blur-[90px]" />

      <div className="relative grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
        <div className="rounded-[1.8rem] border border-yellow-100/15 bg-black/20 p-5 text-center">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-100/70">
            Nebu&apos;s colours
          </p>
          <img
            src="/ancient-pulls/celestial-cat.png"
            alt={`Nebu wearing the ${selectedSkin.label} colours`}
            draggable={false}
            className="mx-auto mt-2 aspect-square w-44 object-contain sm:w-52"
          />
          <p className="mt-1 text-xl font-black text-white">{selectedSkin.label}</p>
          <p className="mt-1 text-xs font-bold text-white/45">
            {selectedSkin.palette}
          </p>
        </div>

        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-100/65">
            Achievement wardrobe
          </p>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
            Give Nebu a new constellation coat.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/48">
            Earn the badge shown beneath a colour to unlock it. Your equipped
            choice is saved to your Ancient Pulls account and follows Nebu into
            the wish animations.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {NEBU_SKINS.map((skin) => {
              const unlocked =
                !skin.achievementKey || unlockedKeys.has(skin.achievementKey);
              const active = selected === skin.key;

              return (
                <button
                  key={skin.key}
                  type="button"
                  onClick={() => void selectSkin(skin)}
                  aria-pressed={active}
                  aria-disabled={!unlocked || saving}
                  className={`group min-h-24 rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
                    active
                      ? "border-yellow-100/35 bg-yellow-100/10 shadow-[0_0_26px_rgba(253,230,138,0.08)]"
                      : unlocked
                        ? "border-white/12 bg-white/[0.045] hover:border-cyan-100/25 hover:bg-cyan-100/[0.07]"
                        : "cursor-not-allowed border-white/[0.07] bg-black/15 opacity-55"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-10 w-10 flex-none rounded-full border-2 border-white/20 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                      style={{ background: skin.swatch }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">
                        {skin.label}
                      </span>
                      <span
                        className={`mt-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] ${
                          unlocked ? "text-cyan-50/55" : "text-white/35"
                        }`}
                      >
                        {active
                          ? "Equipped"
                          : unlockCopy(skin, unlocked, loading)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p
            className={`mt-4 min-h-5 text-xs font-black ${
              message ? "text-emerald-100" : "text-white/32"
            }`}
            aria-live="polite"
          >
            {message || "Choose any unlocked colour. The change is instant."}
          </p>
        </div>
      </div>
    </PlayerPanel>
  );
}
