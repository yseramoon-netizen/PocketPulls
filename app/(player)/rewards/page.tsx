"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerPrimaryButton,
  PlayerSecondaryButton,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatDate,
  formatWholeNumber,
  getErrorMessage,
  toWholeNumber,
} from "@/lib/player/format";

type StatusRow = {
  claimed_today: boolean | null;
  current_streak: number | string | null;
  longest_streak: number | string | null;
  total_claims: number | string | null;
  total_wishes_awarded: number | string | null;
  cycle_day: number | string | null;
  reward_today: number | string | null;
  reward_tomorrow: number | string | null;
  wish_balance: number | string | null;
  last_claim_date: string | null;
};

type ClaimRow = {
  awarded_wishes: number | string | null;
  wish_balance: number | string | null;
  current_streak: number | string | null;
  longest_streak: number | string | null;
  total_claims: number | string | null;
  cycle_day: number | string | null;
};

type RewardStatus = {
  claimedToday: boolean;
  currentStreak: number;
  longestStreak: number;
  totalClaims: number;
  totalWishesAwarded: number;
  cycleDay: number;
  rewardToday: number;
  rewardTomorrow: number;
  wishBalance: number;
  lastClaimDate: string | null;
};

const EMPTY_STATUS: RewardStatus = {
  claimedToday: false,
  currentStreak: 0,
  longestStreak: 0,
  totalClaims: 0,
  totalWishesAwarded: 0,
  cycleDay: 1,
  rewardToday: 1,
  rewardTomorrow: 1,
  wishBalance: 0,
  lastClaimDate: null,
};

const REWARDS = [1, 1, 1, 2, 2, 3, 5];

function getNextRewardTime(now = new Date()): number {
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function parseStatus(value: unknown): RewardStatus {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return EMPTY_STATUS;
  }

  const data = row as StatusRow;

  return {
    claimedToday: data.claimed_today === true,
    currentStreak: toWholeNumber(data.current_streak),
    longestStreak: toWholeNumber(data.longest_streak),
    totalClaims: toWholeNumber(data.total_claims),
    totalWishesAwarded: toWholeNumber(
      data.total_wishes_awarded,
    ),
    cycleDay: Math.max(
      1,
      Math.min(7, toWholeNumber(data.cycle_day) || 1),
    ),
    rewardToday: Math.max(
      1,
      toWholeNumber(data.reward_today),
    ),
    rewardTomorrow: Math.max(
      1,
      toWholeNumber(data.reward_tomorrow),
    ),
    wishBalance: toWholeNumber(data.wish_balance),
    lastClaimDate: data.last_claim_date,
  };
}

export default function RewardsPage() {
  const [status, setStatus] =
    useState<RewardStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [celebration, setCelebration] =
    useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const loadStatus = useCallback(async () => {
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "get_daily_reward_status",
      );

      if (error) {
        throw error;
      }

      setStatus(parseStatus(data));
    } catch (error: unknown) {
      console.error("Daily reward error:", error);
      setErrorMessage(
        getErrorMessage(
          error,
          "Aaru's daily gift could not be loaded.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const claim = useCallback(async () => {
    if (claiming || status.claimedToday) {
      return;
    }

    setClaiming(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "claim_daily_reward",
      );

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || typeof row !== "object") {
        throw new Error(
          "The reward result was incomplete.",
        );
      }

      const result = row as ClaimRow;
      const awarded = toWholeNumber(
        result.awarded_wishes,
      );
      const nextBalance = toWholeNumber(
        result.wish_balance,
      );

      setCelebration(awarded);

      setStatus((current) => ({
        ...current,
        claimedToday: true,
        currentStreak: toWholeNumber(
          result.current_streak,
        ),
        longestStreak: toWholeNumber(
          result.longest_streak,
        ),
        totalClaims: toWholeNumber(
          result.total_claims,
        ),
        totalWishesAwarded:
          current.totalWishesAwarded + awarded,
        cycleDay: Math.max(
          1,
          Math.min(
            7,
            toWholeNumber(result.cycle_day),
          ),
        ),
        wishBalance: nextBalance,
        lastClaimDate: new Date()
          .toISOString()
          .slice(0, 10),
      }));

      window.dispatchEvent(
        new CustomEvent("pocketpulls:wish-balance", {
          detail: {
            wishBalance: nextBalance,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("pocketpulls:reward-claimed"),
      );

      window.setTimeout(() => {
        setCelebration(null);
      }, 3600);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Aaru could not complete today's gift.",
        ),
      );
    } finally {
      setClaiming(false);
    }
  }, [claiming, status.claimedToday]);

  const cycleProgress = useMemo(() => {
    return status.claimedToday
      ? status.cycleDay
      : Math.max(0, status.cycleDay - 1);
  }, [status.claimedToday, status.cycleDay]);

  const dailyCountdown = useMemo(() => {
    if (!status.claimedToday) {
      return "Ready to claim";
    }

    const remaining = getNextRewardTime(new Date(nowTs)) - nowTs;

    if (remaining <= 0) {
      return "Ready to claim";
    }

    return formatCountdown(remaining);
  }, [nowTs, status.claimedToday]);

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="A gift beneath the stars"
        title="Aaru's Daily Gift"
        description="Return once each day to keep your streak alive. The seventh night awards five wishes before the cycle begins again."
        actions={
          <PlayerSecondaryButton
            onClick={() => void loadStatus()}
          >
            Refresh gift
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadStatus()}
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlayerStatCard
          label="Current streak"
          value={`${formatWholeNumber(
            status.currentStreak,
          )} days`}
          detail="Consecutive daily claims"
          accent="yellow"
        />

        <PlayerStatCard
          label="Longest streak"
          value={`${formatWholeNumber(
            status.longestStreak,
          )} days`}
          detail="Your personal record"
          accent="violet"
        />

        <PlayerStatCard
          label="Gifts opened"
          value={formatWholeNumber(status.totalClaims)}
          detail="Lifetime daily claims"
          accent="cyan"
        />

        <PlayerStatCard
          label="Wishes received"
          value={formatWholeNumber(
            status.totalWishesAwarded,
          )}
          detail="Awarded by daily gifts"
          accent="pink"
        />
      </div>

      <PlayerPanel className="relative mt-6 overflow-hidden p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-yellow-200/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-violet-400/10 blur-[110px]" />

        <div className="relative grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-center">
          <div className="relative flex min-h-72 items-center justify-center">
            <div className="absolute h-52 w-52 animate-pulse rounded-full bg-yellow-200/15 blur-3xl" />
            <div className="absolute h-60 w-60 animate-spin rounded-full border border-transparent border-r-cyan-100/20 border-t-yellow-100/55 [animation-duration:12s]" />

            <img
              src="/ancient-pulls/celestial-cat.png"
              alt="Aaru"
              draggable={false}
              className="relative z-10 h-52 w-52 object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.5)]"
            />

            {celebration ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                {Array.from({ length: 18 }).map(
                  (_, index) => (
                    <span
                      key={index}
                      className="absolute animate-ping text-2xl text-yellow-100"
                      style={{
                        transform: `rotate(${
                          index * 20
                        }deg) translateY(-120px)`,
                        animationDelay: `${
                          (index % 6) * 70
                        }ms`,
                      }}
                    >
                      *
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-100/45">
              Day {status.cycleDay} of 7
            </p>

            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              {loading
                ? "Aaru is checking the sky..."
                : status.claimedToday
                  ? "Today's gift is yours."
                  : `${status.rewardToday} wish${
                      status.rewardToday === 1
                        ? ""
                        : "es"
                    } are waiting.`}
            </h2>

            <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/42">
              {status.claimedToday
                ? `You last claimed on ${formatDate(
                    status.lastClaimDate,
                  )}. Return tomorrow for ${
                    status.rewardTomorrow
                  } more wish${
                    status.rewardTomorrow === 1
                      ? ""
                      : "es"
                  }.`
                : "Claim before the day ends to continue your streak. Missing a day resets the current streak, but your longest record remains."}
            </p>

            <div className="mt-6">
              <PlayerPrimaryButton
                onClick={() => void claim()}
                disabled={
                  loading ||
                  claiming ||
                  status.claimedToday
                }
                className="w-full sm:w-auto"
              >
                {claiming
                  ? "Opening the gift..."
                  : status.claimedToday
                    ? "Gift claimed today"
                    : `Claim ${status.rewardToday} wish${
                        status.rewardToday === 1
                          ? ""
                          : "es"
                      }`}
              </PlayerPrimaryButton>
            </div>

            <p className="mt-4 text-xs font-bold text-white/25">
              Current wish balance:{" "}
              {formatWholeNumber(status.wishBalance)}
            </p>
          </div>
        </div>
      </PlayerPanel>

      <PlayerPanel className="mt-6 p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
              Seven-night cycle
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Keep the stars connected
            </h2>
          </div>

          <span className="text-xs font-bold text-white/30">
            {cycleProgress} / 7 complete
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {REWARDS.map((reward, index) => {
            const day = index + 1;
            const completed =
              day <= cycleProgress;
            const current =
              day === status.cycleDay &&
              !status.claimedToday;

            return (
              <div
                key={day}
                className={`relative rounded-2xl border p-4 text-center ${
                  completed
                    ? "border-emerald-100/20 bg-emerald-300/[0.08]"
                    : current
                      ? "border-yellow-100/25 bg-yellow-200/[0.1] shadow-[0_0_30px_rgba(253,230,138,0.08)]"
                      : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-white/28">
                  Day {day}
                </p>

                <p className="mt-3 text-2xl font-black text-white">
                  {reward}
                </p>

                <p className="mt-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-yellow-100/45">
                  wish{reward === 1 ? "" : "es"}
                </p>

                {completed ? (
                  <span className="absolute right-2 top-2 text-xs text-emerald-100">
                    ✓
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </PlayerPanel>
    </section>
  );
}
