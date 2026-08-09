"use client";

import { useEffect, useMemo, useState } from "react";

import NebuSprite from "@/components/player/NebuSprite";
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
  exclusiveSkins: NebuSkinKey[];
  exclusiveSkinsLoading: boolean;
};

function skinUnlockCopy(skin: NebuSkin, unlocked: boolean, loading: boolean) {
  if (skin.exclusiveOwner) {
    return `${skin.label} admin exclusive · this account only`;
  }

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
  exclusiveSkins,
  exclusiveSkinsLoading,
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

  const exclusiveSkinKeys = useMemo(
    () => new Set(exclusiveSkins),
    [exclusiveSkins],
  );

  const visibleSkins = useMemo(
    () =>
      NEBU_SKINS.filter(
        (skin) =>
          !skin.exclusiveOwner || exclusiveSkinKeys.has(skin.key),
      ),
    [exclusiveSkinKeys],
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

  useEffect(() => {
    if (exclusiveSkinsLoading) {
      return;
    }

    const currentSkin = getNebuSkin(selected);

    if (
      currentSkin.exclusiveOwner &&
      !exclusiveSkinKeys.has(currentSkin.key)
    ) {
      const frame = window.requestAnimationFrame(() => {
        setSelected("midnight");
        applyNebuSkin("midnight");
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [exclusiveSkinKeys, exclusiveSkinsLoading, selected]);

  const selectSkin = async (skin: NebuSkin) => {
    const unlocked =
      skin.exclusiveOwner
        ? exclusiveSkinKeys.has(skin.key)
        : !skin.achievementKey || unlockedKeys.has(skin.achievementKey);

    if (!unlocked || saving) {
      setMessage(
        skin.exclusiveOwner
          ? `${skin.label} belongs only to the ${skin.label} administrator account.`
          : skin.achievementTitle
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

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-100/75">
              Achievement wardrobe
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Make Nebu completely yours.
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/65">
              Badges unlock new constellation coats. Your equipped coat follows
              Nebu into every wish reveal.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
            <div className="rounded-[1.8rem] border border-yellow-100/20 bg-black/25 p-5 text-center">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-100/80">
                Equipped coat
              </p>
              {selectedSkin.heatAssets ? (
                <img
                  src={selectedSkin.heatAssets.portrait}
                  alt={`Nebu wearing the ${selectedSkin.label} colours`}
                  draggable={false}
                  className="mx-auto mt-2 aspect-square w-48 object-contain [image-rendering:pixelated] sm:w-52"
                />
              ) : (
                <NebuSprite
                  pose="sacred"
                  label={`Nebu wearing the ${selectedSkin.label} colours`}
                  className="mx-auto mt-2 w-48 sm:w-52"
                />
              )}
              <p className="mt-1 text-xl font-black text-white">
                {selectedSkin.label}
              </p>
              <p className="mt-1 text-xs font-bold text-white/60">
                {selectedSkin.palette}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSkins.map((skin) => {
                const unlocked =
                  skin.exclusiveOwner
                    ? exclusiveSkinKeys.has(skin.key)
                    : !skin.achievementKey || unlockedKeys.has(skin.achievementKey);
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
                        ? "border-yellow-100/45 bg-yellow-100/12 shadow-[0_0_26px_rgba(253,230,138,0.1)]"
                        : unlocked
                          ? "border-white/15 bg-white/[0.06] hover:border-cyan-100/35 hover:bg-cyan-100/[0.09]"
                          : "cursor-not-allowed border-white/10 bg-black/20 opacity-55"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {skin.heatAssets ? (
                        <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-black/25 shadow-[0_0_18px_rgba(255,255,255,0.08)]">
                          <img
                            src={skin.heatAssets.portrait}
                            alt=""
                            draggable={false}
                            className="h-12 w-12 max-w-none object-contain [image-rendering:pixelated]"
                          />
                        </span>
                      ) : (
                        <span
                          className="h-10 w-10 flex-none rounded-full border-2 border-white/25 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                          style={{ background: skin.swatch }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-white">
                          {skin.label}
                        </span>
                        <span className="mt-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-white/60">
                          {active
                            ? "Equipped"
                            : skinUnlockCopy(
                                skin,
                                unlocked,
                                loading || exclusiveSkinsLoading,
                              )}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
        </div>

        <p
          className={`mt-5 min-h-5 text-xs font-black ${
            message ? "text-emerald-100" : "text-white/55"
          }`}
          aria-live="polite"
        >
          {message || "Choose any unlocked coat. The change is instant."}
        </p>
      </div>
    </PlayerPanel>
  );
}
