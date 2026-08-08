"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatDate,
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
} from "@/lib/player/format";

type AchievementRow = {
  achievement_key: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  icon: string | null;
  current_value: number | string | null;
  target_value: number | string | null;
  progress_percent: number | string | null;
  reward_wishes: number | string | null;
  reward_claimed_at: string | null;
  unlocked_at: string | null;
};

type Achievement = {
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  currentValue: number;
  targetValue: number;
  progress: number;
  rewardWishes: number;
  rewardClaimedAt: string | null;
  unlockedAt: string | null;
};

type ClaimRow = {
  achievement_key: string | null;
  reward_wishes: number | string | null;
  wish_balance: number | string | null;
  claimed_at: string | null;
};

function parseRows(value: unknown): Achievement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as AchievementRow[]).map((row) => ({
    key: row.achievement_key || "",
    title: row.title || "Unknown badge",
    description: row.description || "",
    category: row.category || "Journey",
    icon: row.icon || "★",
    currentValue: toNumber(row.current_value),
    targetValue: Math.max(1, toNumber(row.target_value)),
    progress: Math.min(100, Math.max(0, toNumber(row.progress_percent))),
    rewardWishes: Math.max(0, Math.floor(toNumber(row.reward_wishes))),
    rewardClaimedAt: row.reward_claimed_at,
    unlockedAt: row.unlocked_at,
  }));
}

function formatProgressValue(achievement: Achievement): string {
  if (achievement.category === "Value" || achievement.key.startsWith("best_card_")) {
    return `${formatMoney(achievement.currentValue)} / ${formatMoney(
      achievement.targetValue,
    )}`;
  }

  return `${formatWholeNumber(achievement.currentValue)} / ${formatWholeNumber(
    achievement.targetValue,
  )}`;
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_player_achievements");

      if (error) {
        throw error;
      }

      setAchievements(parseRows(data));
    } catch (error: unknown) {
      console.error("Achievements error:", error);
      setErrorMessage(
        getErrorMessage(error, "Your achievements could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const claimReward = useCallback(
    async (achievement: Achievement) => {
      if (
        claimingKey ||
        !achievement.unlockedAt ||
        achievement.rewardClaimedAt ||
        achievement.rewardWishes <= 0
      ) {
        return;
      }

      setClaimingKey(achievement.key);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const { data, error } = await supabase.rpc(
          "claim_player_achievement_reward",
          { p_achievement_key: achievement.key },
        );

        if (error) {
          throw error;
        }

        const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null;
        const reward = Math.max(
          0,
          Math.floor(toNumber(row?.reward_wishes ?? achievement.rewardWishes)),
        );
        const wishBalance = Math.max(0, Math.floor(toNumber(row?.wish_balance)));

        setSuccessMessage(
          `${achievement.title} rewarded you with ${reward} free wish${
            reward === 1 ? "" : "es"
          }.`
        );

        window.dispatchEvent(
          new CustomEvent("pocketpulls:wish-balance", {
            detail: { wishBalance },
          }),
        );
        window.dispatchEvent(new Event("pocketpulls:achievement-reward-claimed"));

        await loadAchievements();
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(error, "That badge reward could not be claimed."),
        );
      } finally {
        setClaimingKey(null);
      }
    },
    [claimingKey, loadAchievements],
  );

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(achievements.map((achievement) => achievement.category)),
      ),
    ],
    [achievements],
  );

  const visible = useMemo(
    () =>
      category === "All"
        ? achievements
        : achievements.filter(
            (achievement) => achievement.category === category,
          ),
    [achievements, category],
  );

  const unlocked = achievements.filter(
    (achievement) => achievement.unlockedAt,
  ).length;
  const claimable = achievements.filter(
    (achievement) =>
      achievement.unlockedAt &&
      !achievement.rewardClaimedAt &&
      achievement.rewardWishes > 0,
  );
  const nearlyThere = achievements.filter(
    (achievement) => !achievement.unlockedAt && achievement.progress >= 70,
  ).length;
  const completion =
    achievements.length > 0 ? (unlocked / achievements.length) * 100 : 0;
  const unclaimedWishes = claimable.reduce(
    (sum, achievement) => sum + achievement.rewardWishes,
    0,
  );

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Milestones beneath the stars"
        title="Badges"
        description="Complete milestones, unlock badges and claim free wishes. Harder badges give bigger rewards."
        actions={
          <PlayerSecondaryButton onClick={() => void loadAchievements()}>
            Check progress
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadAchievements()}
      />

      {successMessage ? (
        <div className="mt-5 rounded-2xl border border-emerald-100/20 bg-emerald-300/[0.08] px-5 py-4 text-sm font-black text-emerald-50">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlayerStatCard
          label="Unlocked"
          value={formatWholeNumber(unlocked)}
          detail={`${achievements.length} badges available`}
          accent="yellow"
        />

        <PlayerStatCard
          label="Completion"
          value={`${Math.round(completion)}%`}
          detail="Across every badge"
          accent="violet"
        />

        <PlayerStatCard
          label="Free wishes ready"
          value={formatWholeNumber(unclaimedWishes)}
          detail={`${claimable.length} rewards waiting`}
          accent="cyan"
        />

        <PlayerStatCard
          label="Nearly there"
          value={formatWholeNumber(nearlyThere)}
          detail="Badges above 70% progress"
          accent="pink"
        />
      </div>

      <PlayerPanel className="mt-6 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`min-h-9 rounded-full border px-3 text-[0.65rem] font-black uppercase tracking-[0.1em] transition ${
                category === item
                  ? "border-cyan-100/20 bg-cyan-100/10 text-cyan-50"
                  : "border-white/10 bg-white/[0.035] text-white/35"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </PlayerPanel>

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <PlayerEmptyState
          title="No badges in this category."
          description="Choose another category to see the rest of your journey."
        />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((achievement) => (
            <AchievementCard
              key={achievement.key}
              achievement={achievement}
              claiming={claimingKey === achievement.key}
              onClaim={() => void claimReward(achievement)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AchievementCard({
  achievement,
  claiming,
  onClaim,
}: {
  achievement: Achievement;
  claiming: boolean;
  onClaim: () => void;
}) {
  const unlocked = Boolean(achievement.unlockedAt);
  const claimed = Boolean(achievement.rewardClaimedAt);
  const canClaim = unlocked && !claimed && achievement.rewardWishes > 0;

  return (
    <PlayerPanel
      className={`relative overflow-hidden p-6 ${
        unlocked ? "border-yellow-100/18" : "opacity-80"
      }`}
    >
      {unlocked ? (
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-yellow-200/10 blur-[70px]" />
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`grid h-16 w-16 flex-none place-items-center rounded-2xl border text-3xl ${
            unlocked
              ? "border-yellow-100/20 bg-yellow-100/10 text-yellow-50 shadow-[0_0_30px_rgba(253,230,138,0.08)]"
              : "border-white/10 bg-white/[0.035] text-white/22 grayscale"
          }`}
        >
          {achievement.icon}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full border px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.12em] ${
              unlocked
                ? "border-emerald-100/20 bg-emerald-300/10 text-emerald-50"
                : "border-white/10 bg-white/[0.035] text-white/28"
            }`}
          >
            {unlocked ? "Unlocked" : achievement.category}
          </span>

          <span className="rounded-full border border-yellow-100/20 bg-yellow-200/[0.08] px-3 py-1 text-[0.62rem] font-black text-yellow-50">
            +{achievement.rewardWishes} wish{achievement.rewardWishes === 1 ? "" : "es"}
          </span>
        </div>
      </div>

      <h2 className="relative mt-5 text-xl font-black text-white">
        {achievement.title}
      </h2>

      <p className="relative mt-2 min-h-12 text-sm font-semibold leading-6 text-white/38">
        {achievement.description}
      </p>

      <div className="relative mt-6">
        <div className="flex items-center justify-between gap-3 text-xs font-bold">
          <span className="text-white/28">{formatProgressValue(achievement)}</span>
          <span className="text-cyan-100/40">{Math.round(achievement.progress)}%</span>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/10 bg-black/25">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              unlocked
                ? "bg-gradient-to-r from-[#e7ad46] via-[#48d5ca] to-[#d84f78]"
                : "bg-gradient-to-r from-violet-400/60 to-cyan-300/60"
            }`}
            style={{ width: `${achievement.progress}%` }}
          />
        </div>
      </div>

      {canClaim ? (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="relative mt-5 min-h-11 w-full rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-4 text-sm font-black text-[#111329] transition hover:brightness-105 disabled:opacity-50"
        >
          {claiming
            ? "Claiming..."
            : `Claim ${achievement.rewardWishes} free wish${
                achievement.rewardWishes === 1 ? "" : "es"
              }`}
        </button>
      ) : (
        <p className="relative mt-5 text-[0.62rem] font-bold text-white/22">
          {unlocked
            ? claimed
              ? `Reward claimed${
                  achievement.rewardClaimedAt
                    ? ` · ${formatDate(achievement.rewardClaimedAt)}`
                    : ""
                }`
              : `Unlocked ${formatDate(achievement.unlockedAt)}`
            : "Keep building your Unown Pulls journey."}
        </p>
      )}
    </PlayerPanel>
  );
}
