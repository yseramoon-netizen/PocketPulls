"use client";

import { useEffect, useMemo, useState } from "react";

import NebuSprite, { type NebuPose } from "@/components/player/NebuSprite";
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
import {
  applyNebuPerformances,
  DEFAULT_NEBU_PERFORMANCES,
  getPerformancesForScene,
  NEBU_PERFORMANCE_CHANGE_EVENT,
  NEBU_SCENE_LABELS,
  normaliseNebuPerformances,
  readNebuPerformances,
  type NebuPerformance,
  type NebuPerformanceSelections,
  type NebuSceneKey,
} from "@/lib/player/nebuPerformances";
import { supabase } from "@/lib/supabase";

type AchievementUnlock = {
  key: string;
  unlockedAt: string | null;
};

type NebuWardrobeProps = {
  achievements: AchievementUnlock[];
  loading: boolean;
};

type WardrobeTab = "colours" | "performances";

const SCENES = Object.keys(DEFAULT_NEBU_PERFORMANCES) as NebuSceneKey[];

const SCENE_PREVIEW_POSES: Record<NebuSceneKey, NebuPose> = {
  common: "smug",
  uncommon: "swipe",
  rare: "yarn",
  doubleRare: "groom",
  ultraRare: "sacred",
  illustrationRare: "back",
  specialIllustrationRare: "catnip",
  hyperRare: "leap",
  crownRare: "crown",
};

function skinUnlockCopy(skin: NebuSkin, unlocked: boolean, loading: boolean) {
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

function performanceUnlockCopy(
  performance: NebuPerformance,
  unlocked: boolean,
  loading: boolean,
) {
  if (!performance.achievementKey) {
    return "Signature performance · always available";
  }

  if (loading) {
    return "Checking your badge...";
  }

  return unlocked
    ? `Unlocked by ${performance.achievementTitle}`
    : `Unlock badge: ${performance.achievementTitle}`;
}

export default function NebuWardrobe({
  achievements,
  loading,
}: NebuWardrobeProps) {
  const [tab, setTab] = useState<WardrobeTab>("colours");
  const [selected, setSelected] = useState<NebuSkinKey>("midnight");
  const [performances, setPerformances] =
    useState<NebuPerformanceSelections>({
      ...DEFAULT_NEBU_PERFORMANCES,
    });
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
      setPerformances(readNebuPerformances());
    });

    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;

      if (isNebuSkinKey(key)) {
        setSelected(key);
      }
    };

    const handlePerformanceChange = (event: Event) => {
      setPerformances(
        normaliseNebuPerformances(
          (event as CustomEvent<NebuPerformanceSelections>).detail,
        ),
      );
    };

    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    window.addEventListener(
      NEBU_PERFORMANCE_CHANGE_EVENT,
      handlePerformanceChange,
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
      window.removeEventListener(
        NEBU_PERFORMANCE_CHANGE_EVENT,
        handlePerformanceChange,
      );
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

  const selectPerformance = async (performance: NebuPerformance) => {
    const unlocked =
      !performance.achievementKey ||
      unlockedKeys.has(performance.achievementKey);

    if (!unlocked || saving) {
      setMessage(
        performance.achievementTitle
          ? `Complete “${performance.achievementTitle}” to unlock ${performance.label}.`
          : null,
      );
      return;
    }

    const next = {
      ...performances,
      [performance.scene]: performance.id,
    };

    setPerformances(next);
    applyNebuPerformances(next);
    setMessage(
      `${performance.label} is now Nebu’s ${NEBU_SCENE_LABELS[performance.scene]} performance.`,
    );
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { nebu_performances: next },
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      console.error("Nebu performance sync error:", error);
      setMessage(
        `${performance.label} is equipped on this device, but account sync could not be completed.`,
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
              Badges unlock constellation coats and alternate performances.
              Everything you equip follows Nebu into every wish reveal.
            </p>
          </div>

          <div
            className="inline-flex rounded-full border border-white/15 bg-black/30 p-1"
            role="tablist"
            aria-label="Nebu wardrobe sections"
          >
            {(["colours", "performances"] as WardrobeTab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => {
                  setTab(item);
                  setMessage(null);
                }}
                className={`min-h-10 rounded-full px-5 text-xs font-black uppercase tracking-[0.1em] transition ${
                  tab === item
                    ? "bg-yellow-100 text-[#171026] shadow-[0_0_22px_rgba(253,230,138,0.16)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {tab === "colours" ? (
          <div className="mt-7 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
            <div className="rounded-[1.8rem] border border-yellow-100/20 bg-black/25 p-5 text-center">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-100/80">
                Equipped coat
              </p>
              <NebuSprite
                pose="sacred"
                label={`Nebu wearing the ${selectedSkin.label} colours`}
                className="mx-auto mt-2 w-48 sm:w-52"
              />
              <p className="mt-1 text-xl font-black text-white">
                {selectedSkin.label}
              </p>
              <p className="mt-1 text-xs font-bold text-white/60">
                {selectedSkin.palette}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                        ? "border-yellow-100/45 bg-yellow-100/12 shadow-[0_0_26px_rgba(253,230,138,0.1)]"
                        : unlocked
                          ? "border-white/15 bg-white/[0.06] hover:border-cyan-100/35 hover:bg-cyan-100/[0.09]"
                          : "cursor-not-allowed border-white/10 bg-black/20 opacity-55"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-10 w-10 flex-none rounded-full border-2 border-white/25 shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                        style={{ background: skin.swatch }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-white">
                          {skin.label}
                        </span>
                        <span className="mt-1 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-white/60">
                          {active ? "Equipped" : skinUnlockCopy(skin, unlocked, loading)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-7 grid gap-4">
            {SCENES.map((scene) => (
              <section
                key={scene}
                className="grid gap-4 rounded-[1.6rem] border border-white/12 bg-black/20 p-4 md:grid-cols-[9rem_minmax(0,1fr)] md:items-center sm:p-5"
              >
                <div className="flex items-center gap-3 md:block md:text-center">
                  <NebuSprite
                    pose={SCENE_PREVIEW_POSES[scene]}
                    label={`${NEBU_SCENE_LABELS[scene]} Nebu pose`}
                    className="w-20 flex-none md:mx-auto md:w-28"
                  />
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-yellow-100/70">
                      Rarity scene
                    </p>
                    <h3 className="mt-1 text-base font-black text-white">
                      {NEBU_SCENE_LABELS[scene]}
                    </h3>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {getPerformancesForScene(scene).map((performance) => {
                    const unlocked =
                      !performance.achievementKey ||
                      unlockedKeys.has(performance.achievementKey);
                    const active = performances[scene] === performance.id;

                    return (
                      <button
                        key={performance.id}
                        type="button"
                        onClick={() => void selectPerformance(performance)}
                        aria-pressed={active}
                        aria-disabled={!unlocked || saving}
                        className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
                          active
                            ? "border-yellow-100/45 bg-yellow-100/12 shadow-[0_0_24px_rgba(253,230,138,0.09)]"
                            : unlocked
                              ? "border-white/15 bg-white/[0.06] hover:border-cyan-100/35 hover:bg-cyan-100/[0.09]"
                              : "cursor-not-allowed border-white/10 bg-black/20 opacity-55"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-black text-white">
                            {performance.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.08em] ${
                              active
                                ? "bg-yellow-100 text-[#171026]"
                                : unlocked
                                  ? "bg-cyan-100/10 text-cyan-50"
                                  : "bg-white/10 text-white/70"
                            }`}
                          >
                            {active ? "Equipped" : unlocked ? "Ready" : "Locked"}
                          </span>
                        </span>
                        <span className="mt-2 block text-xs font-semibold leading-5 text-white/65">
                          {performance.description}
                        </span>
                        <span className="mt-3 block text-[0.58rem] font-black uppercase tracking-[0.08em] text-cyan-50/65">
                          {performanceUnlockCopy(performance, unlocked, loading)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p
          className={`mt-5 min-h-5 text-xs font-black ${
            message ? "text-emerald-100" : "text-white/55"
          }`}
          aria-live="polite"
        >
          {message ||
            (tab === "colours"
              ? "Choose any unlocked coat. The change is instant."
              : "Each rarity can use one equipped Nebu performance.")}
        </p>
      </div>
    </PlayerPanel>
  );
}
