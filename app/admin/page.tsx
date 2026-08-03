"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";

type PokemonCard = {
  id?: string;
  name?: string;
  rarity?: string;
  image_url?: string | null;
  market_value?: number | string | null;
};

type InventoryRow = {
  id: string;
  quantity: number | string | null;
  pokemon_cards: PokemonCard | PokemonCard[] | null;
};

type PullHistoryRow = {
  id: string;
  created_at: string;
  amount_paid: number | string | null;
  market_value: number | string | null;
  pokemon_cards: PokemonCard | PokemonCard[] | null;
};

type RecentPull = {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string | null;
  amountPaid: number;
  marketValue: number;
  createdAt: string;
};

type DashboardState = {
  uniqueCards: number;
  totalUnits: number;
  inventoryValue: number;
  pullsToday: number;
  revenueToday: number;
  lowStockCards: number;
  recentPulls: RecentPull[];
};

const INITIAL_STATE: DashboardState = {
  uniqueCards: 0,
  totalUnits: 0,
  inventoryValue: 0,
  pullsToday: 0,
  revenueToday: 0,
  lowStockCards: 0,
  recentPulls: [],
};

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatActivityTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-64 rounded-full bg-white/10" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-44 rounded-[2rem] border border-white/10 bg-white/5"
          />
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="h-[28rem] rounded-[2.5rem] border border-white/10 bg-white/5" />
        <div className="h-[28rem] rounded-[2.5rem] border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [dashboard, setDashboard] =
    useState<DashboardState>(INITIAL_STATE);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (backgroundRefresh = false) => {
    if (backgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        cardsResult,
        inventoryResult,
        todayPullsResult,
        recentPullsResult,
      ] = await Promise.all([
        supabase
          .from("pokemon_cards")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("inventory")
          .select(`
            id,
            quantity,
            pokemon_cards(
              id,
              name,
              rarity,
              image_url,
              market_value
            )
          `),

        supabase
          .from("pull_history")
          .select("id, amount_paid")
          .gte("created_at", todayStart.toISOString()),

        supabase
          .from("pull_history")
          .select(`
            id,
            created_at,
            amount_paid,
            market_value,
            pokemon_cards(
              id,
              name,
              rarity,
              image_url
            )
          `)
          .order("created_at", {
            ascending: false,
          })
          .limit(6),
      ]);

      if (cardsResult.error) {
        throw cardsResult.error;
      }

      if (inventoryResult.error) {
        throw inventoryResult.error;
      }

      if (todayPullsResult.error) {
        throw todayPullsResult.error;
      }

      if (recentPullsResult.error) {
        throw recentPullsResult.error;
      }

      const inventoryRows =
        (inventoryResult.data ?? []) as InventoryRow[];

      const todayPulls =
        (todayPullsResult.data ?? []) as Array<{
          id: string;
          amount_paid: number | string | null;
        }>;

      const historyRows =
        (recentPullsResult.data ?? []) as PullHistoryRow[];

      const totalUnits = inventoryRows.reduce((total, row) => {
        return total + toNumber(row.quantity);
      }, 0);

      const inventoryValue = inventoryRows.reduce((total, row) => {
        const card = getRelation(row.pokemon_cards);
        const quantity = toNumber(row.quantity);
        const marketValue = toNumber(card?.market_value);

        return total + quantity * marketValue;
      }, 0);

      const lowStockCards = inventoryRows.filter((row) => {
        const quantity = toNumber(row.quantity);

        return quantity > 0 && quantity <= 3;
      }).length;

      const revenueToday = todayPulls.reduce((total, pull) => {
        return total + toNumber(pull.amount_paid);
      }, 0);

      const recentPulls: RecentPull[] = historyRows.map((row) => {
        const card = getRelation(row.pokemon_cards);

        return {
          id: row.id,
          name: card?.name || "Unknown Pokémon",
          rarity: card?.rarity || "Unknown rarity",
          imageUrl: card?.image_url || null,
          amountPaid: toNumber(row.amount_paid),
          marketValue: toNumber(row.market_value),
          createdAt: row.created_at,
        };
      });

      setDashboard({
        uniqueCards: cardsResult.count ?? 0,
        totalUnits,
        inventoryValue,
        pullsToday: todayPulls.length,
        revenueToday,
        lowStockCards,
        recentPulls,
      });

      setLastUpdated(new Date());
    } catch (dashboardError: unknown) {
      console.error("Dashboard error:", dashboardError);

      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "The admin dashboard could not be loaded.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const averagePullRevenue = useMemo(() => {
    if (dashboard.pullsToday === 0) {
      return 0;
    }

    return dashboard.revenueToday / dashboard.pullsToday;
  }, [dashboard.pullsToday, dashboard.revenueToday]);

  const inventoryHealth = useMemo(() => {
    if (dashboard.uniqueCards === 0) {
      return 0;
    }

    const healthyCards =
      dashboard.uniqueCards - dashboard.lowStockCards;

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (healthyCards / dashboard.uniqueCards) * 100,
        ),
      ),
    );
  }, [dashboard.lowStockCards, dashboard.uniqueCards]);

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-gradient-to-br
        from-[#020617]
        via-[#052e16]
        to-[#064e3b]
        px-4
        pb-28
        pt-4
        text-white
        md:px-8
        md:pt-8
      "
    >
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            -left-40
            top-32
            h-[32rem]
            w-[32rem]
            rounded-full
            bg-emerald-400/10
            blur-[120px]
          "
        />

        <div
          className="
            absolute
            -right-40
            top-0
            h-[35rem]
            w-[35rem]
            rounded-full
            bg-cyan-300/10
            blur-[140px]
          "
        />

        <div
          className="
            absolute
            bottom-0
            left-1/3
            h-[28rem]
            w-[28rem]
            rounded-full
            bg-lime-300/5
            blur-[120px]
          "
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        <header
          className="
            relative
            mt-8
            overflow-hidden
            rounded-[2.75rem]
            border
            border-white/15
            bg-white/[0.08]
            p-6
            shadow-[0_40px_120px_rgba(0,0,0,0.35)]
            backdrop-blur-3xl
            md:p-10
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-gradient-to-br
              from-white/10
              via-transparent
              to-emerald-400/5
            "
          />

          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-emerald-200/20
                  bg-emerald-400/10
                  px-4
                  py-2
                  text-sm
                  font-black
                  text-emerald-100
                  shadow-[0_0_30px_rgba(52,211,153,0.12)]
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                    bg-emerald-300
                    shadow-[0_0_16px_rgba(110,231,183,1)]
                  "
                />

                PocketPulls Operations
              </div>

              <h1
                className="
                  mt-5
                  max-w-4xl
                  text-4xl
                  font-black
                  tracking-[-0.045em]
                  text-white
                  md:text-6xl
                "
              >
                The Forest
                <span className="text-emerald-300">
                  {" "}
                  Control Room
                </span>
              </h1>

              <p
                className="
                  mt-4
                  max-w-2xl
                  text-base
                  font-medium
                  leading-7
                  text-emerald-50/75
                  md:text-lg
                "
              >
                Inventory, pull activity and business performance
                gathered into one live operational view.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-white/15
                  bg-white/10
                  px-6
                  font-black
                  text-white
                  shadow-lg
                  transition
                  hover:border-emerald-200/30
                  hover:bg-white/15
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <span
                  className={refreshing ? "animate-spin" : ""}
                  aria-hidden="true"
                >
                  ↻
                </span>

                {refreshing ? "Synchronising" : "Refresh data"}
              </button>

              <Link
                href="/admin/pulls"
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-emerald-200/30
                  bg-emerald-300
                  px-6
                  font-black
                  text-emerald-950
                  shadow-[0_0_35px_rgba(110,231,183,0.25)]
                  transition
                  hover:-translate-y-0.5
                  hover:bg-emerald-200
                "
              >
                Open pull terminal
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="
              mt-6
              rounded-[2rem]
              border
              border-red-300/20
              bg-red-500/10
              px-6
              py-5
              font-bold
              text-red-100
              backdrop-blur-2xl
            "
          >
            <p className="text-sm uppercase tracking-[0.18em] text-red-200/70">
              Dashboard connection issue
            </p>

            <p className="mt-2">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="mt-8">
            <DashboardSkeleton />
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <article
                className="
                  group
                  relative
                  min-h-48
                  overflow-hidden
                  rounded-[2.25rem]
                  border
                  border-white/15
                  bg-white/[0.08]
                  p-6
                  shadow-[0_25px_70px_rgba(0,0,0,0.25)]
                  backdrop-blur-3xl
                  transition
                  hover:-translate-y-1
                  hover:border-emerald-200/30
                "
              >
                <div className="absolute right-5 top-4 text-6xl opacity-10">
                  🎴
                </div>

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-emerald-200/20
                    bg-emerald-400/15
                    text-xl
                    shadow-[0_0_25px_rgba(52,211,153,0.15)]
                  "
                >
                  🎴
                </div>

                <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-emerald-100/60">
                  Unique cards
                </p>

                <p className="mt-2 text-4xl font-black tracking-tight">
                  {dashboard.uniqueCards.toLocaleString("en-GB")}
                </p>

                <p className="mt-3 text-sm font-medium text-white/50">
                  Pokémon records in your database
                </p>
              </article>

              <article
                className="
                  group
                  relative
                  min-h-48
                  overflow-hidden
                  rounded-[2.25rem]
                  border
                  border-white/15
                  bg-white/[0.08]
                  p-6
                  shadow-[0_25px_70px_rgba(0,0,0,0.25)]
                  backdrop-blur-3xl
                  transition
                  hover:-translate-y-1
                  hover:border-cyan-200/30
                "
              >
                <div className="absolute right-5 top-4 text-6xl opacity-10">
                  📦
                </div>

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-cyan-200/20
                    bg-cyan-400/15
                    text-xl
                  "
                >
                  📦
                </div>

                <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-cyan-100/60">
                  Live inventory
                </p>

                <p className="mt-2 text-4xl font-black tracking-tight">
                  {dashboard.totalUnits.toLocaleString("en-GB")}
                </p>

                <p className="mt-3 text-sm font-medium text-white/50">
                  Physical cards available for pulls
                </p>
              </article>

              <article
                className="
                  group
                  relative
                  min-h-48
                  overflow-hidden
                  rounded-[2.25rem]
                  border
                  border-white/15
                  bg-white/[0.08]
                  p-6
                  shadow-[0_25px_70px_rgba(0,0,0,0.25)]
                  backdrop-blur-3xl
                  transition
                  hover:-translate-y-1
                  hover:border-violet-200/30
                "
              >
                <div className="absolute right-5 top-4 text-6xl opacity-10">
                  ✨
                </div>

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-violet-200/20
                    bg-violet-400/15
                    text-xl
                  "
                >
                  ✨
                </div>

                <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-violet-100/60">
                  Pulls today
                </p>

                <p className="mt-2 text-4xl font-black tracking-tight">
                  {dashboard.pullsToday.toLocaleString("en-GB")}
                </p>

                <p className="mt-3 text-sm font-medium text-white/50">
                  Discoveries completed since midnight
                </p>
              </article>

              <article
                className="
                  group
                  relative
                  min-h-48
                  overflow-hidden
                  rounded-[2.25rem]
                  border
                  border-emerald-200/20
                  bg-gradient-to-br
                  from-emerald-300/20
                  via-emerald-500/10
                  to-white/[0.06]
                  p-6
                  shadow-[0_25px_80px_rgba(16,185,129,0.18)]
                  backdrop-blur-3xl
                  transition
                  hover:-translate-y-1
                  hover:border-emerald-200/40
                "
              >
                <div className="absolute right-5 top-4 text-6xl opacity-10">
                  💎
                </div>

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-emerald-100/30
                    bg-emerald-200/20
                    text-xl
                  "
                >
                  💎
                </div>

                <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-emerald-100/70">
                  Revenue today
                </p>

                <p className="mt-2 text-4xl font-black tracking-tight text-emerald-100">
                  {formatCurrency(dashboard.revenueToday)}
                </p>

                <p className="mt-3 text-sm font-medium text-emerald-50/60">
                  {formatCurrency(averagePullRevenue)} average per pull
                </p>
              </article>
            </section>

            <section className="mt-8 grid gap-8 xl:grid-cols-[1.45fr_0.8fr]">
              <div
                className="
                  overflow-hidden
                  rounded-[2.75rem]
                  border
                  border-white/15
                  bg-white/[0.075]
                  shadow-[0_35px_100px_rgba(0,0,0,0.3)]
                  backdrop-blur-3xl
                "
              >
                <div className="flex flex-col gap-5 border-b border-white/10 p-6 md:flex-row md:items-center md:justify-between md:p-8">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/60">
                      Live activity
                    </p>

                    <h2 className="mt-2 text-3xl font-black tracking-tight">
                      Recent discoveries
                    </h2>
                  </div>

                  <Link
                    href="/admin/pulls"
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-white/10
                      bg-white/[0.07]
                      px-4
                      py-3
                      text-sm
                      font-black
                      text-emerald-100
                      transition
                      hover:bg-white/10
                    "
                  >
                    View pull terminal
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>

                <div className="divide-y divide-white/[0.08]">
                  {dashboard.recentPulls.length === 0 ? (
                    <div className="px-8 py-20 text-center">
                      <div className="text-5xl">🌙</div>

                      <h3 className="mt-5 text-xl font-black">
                        The forest is quiet
                      </h3>

                      <p className="mt-2 text-white/50">
                        Completed pulls will appear here.
                      </p>
                    </div>
                  ) : (
                    dashboard.recentPulls.map((pull, index) => (
                      <article
                        key={pull.id}
                        className="
                          group
                          flex
                          flex-col
                          gap-5
                          px-6
                          py-5
                          transition
                          hover:bg-white/[0.04]
                          sm:flex-row
                          sm:items-center
                          sm:justify-between
                          md:px-8
                        "
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className="
                              relative
                              flex
                              h-16
                              w-16
                              flex-none
                              items-center
                              justify-center
                              overflow-hidden
                              rounded-2xl
                              border
                              border-white/10
                              bg-black/20
                            "
                          >
                            {pull.imageUrl ? (
                              <img
                                src={pull.imageUrl}
                                alt={pull.name}
                                className="h-full w-full object-contain p-1.5"
                              />
                            ) : (
                              <span className="text-2xl">🎴</span>
                            )}

                            {index === 0 && (
                              <span
                                className="
                                  absolute
                                  right-1
                                  top-1
                                  h-2
                                  w-2
                                  rounded-full
                                  bg-emerald-300
                                  shadow-[0_0_10px_rgba(110,231,183,1)]
                                "
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-lg font-black text-white">
                              {pull.name}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span
                                className="
                                  rounded-full
                                  border
                                  border-emerald-200/15
                                  bg-emerald-400/10
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-bold
                                  text-emerald-100
                                "
                              >
                                {pull.rarity}
                              </span>

                              <span className="text-xs font-semibold text-white/40">
                                {formatActivityTime(pull.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-8 sm:justify-end">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
                              Paid
                            </p>

                            <p className="mt-1 font-black text-white/80">
                              {formatCurrency(pull.amountPaid)}
                            </p>
                          </div>

                          <div className="min-w-24 text-right">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
                              Card value
                            </p>

                            <p className="mt-1 font-black text-emerald-300">
                              {formatCurrency(pull.marketValue)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <section
                  className="
                    rounded-[2.75rem]
                    border
                    border-white/15
                    bg-white/[0.075]
                    p-6
                    shadow-[0_30px_90px_rgba(0,0,0,0.25)]
                    backdrop-blur-3xl
                    md:p-8
                  "
                >
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/60">
                    Inventory health
                  </p>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-5xl font-black tracking-tight">
                        {inventoryHealth}%
                      </p>

                      <p className="mt-2 text-sm font-medium text-white/50">
                        Stock coverage score
                      </p>
                    </div>

                    <div
                      className="
                        rounded-2xl
                        border
                        border-white/10
                        bg-black/20
                        px-4
                        py-3
                        text-right
                      "
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
                        Stock value
                      </p>

                      <p className="mt-1 font-black text-emerald-200">
                        {formatCurrency(dashboard.inventoryValue)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 h-3 overflow-hidden rounded-full bg-black/30">
                    <div
                      className="
                        h-full
                        rounded-full
                        bg-gradient-to-r
                        from-emerald-500
                        via-emerald-300
                        to-cyan-300
                        shadow-[0_0_20px_rgba(110,231,183,0.45)]
                        transition-all
                        duration-700
                      "
                      style={{
                        width: `${inventoryHealth}%`,
                      }}
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div
                      className="
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.05]
                        p-4
                      "
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
                        Low stock
                      </p>

                      <p className="mt-2 text-2xl font-black">
                        {dashboard.lowStockCards}
                      </p>

                      <p className="mt-1 text-xs font-medium text-white/40">
                        Three or fewer remaining
                      </p>
                    </div>

                    <div
                      className="
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.05]
                        p-4
                      "
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
                        Total units
                      </p>

                      <p className="mt-2 text-2xl font-black">
                        {dashboard.totalUnits.toLocaleString("en-GB")}
                      </p>

                      <p className="mt-1 text-xs font-medium text-white/40">
                        Ready for customers
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/admin/inventory"
                    className="
                      mt-6
                      flex
                      min-h-14
                      w-full
                      items-center
                      justify-between
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.06]
                      px-5
                      font-black
                      text-white
                      transition
                      hover:border-emerald-200/25
                      hover:bg-white/10
                    "
                  >
                    Manage inventory
                    <span className="text-emerald-300">→</span>
                  </Link>
                </section>

                <section
                  className="
                    rounded-[2.75rem]
                    border
                    border-emerald-200/20
                    bg-gradient-to-br
                    from-emerald-300/15
                    via-white/[0.07]
                    to-cyan-300/5
                    p-6
                    shadow-[0_30px_90px_rgba(16,185,129,0.12)]
                    backdrop-blur-3xl
                    md:p-8
                  "
                >
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-100/60">
                    Quick actions
                  </p>

                  <div className="mt-5 space-y-3">
                    <Link
                      href="/admin/add"
                      className="
                        flex
                        min-h-16
                        items-center
                        gap-4
                        rounded-2xl
                        border
                        border-white/10
                        bg-black/15
                        px-4
                        transition
                        hover:translate-x-1
                        hover:bg-black/25
                      "
                    >
                      <span
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          bg-emerald-300/15
                        "
                      >
                        ＋
                      </span>

                      <span className="flex-1">
                        <span className="block font-black">
                          Add Pokémon cards
                        </span>

                        <span className="text-sm text-white/45">
                          Expand the master database
                        </span>
                      </span>

                      <span className="text-emerald-300">→</span>
                    </Link>

                    <Link
                      href="/admin/inventory"
                      className="
                        flex
                        min-h-16
                        items-center
                        gap-4
                        rounded-2xl
                        border
                        border-white/10
                        bg-black/15
                        px-4
                        transition
                        hover:translate-x-1
                        hover:bg-black/25
                      "
                    >
                      <span
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          bg-cyan-300/15
                        "
                      >
                        📦
                      </span>

                      <span className="flex-1">
                        <span className="block font-black">
                          Update quantities
                        </span>

                        <span className="text-sm text-white/45">
                          Control physical stock
                        </span>
                      </span>

                      <span className="text-cyan-200">→</span>
                    </Link>

                    <Link
                      href="/admin/pulls"
                      className="
                        flex
                        min-h-16
                        items-center
                        gap-4
                        rounded-2xl
                        border
                        border-white/10
                        bg-black/15
                        px-4
                        transition
                        hover:translate-x-1
                        hover:bg-black/25
                      "
                    >
                      <span
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          bg-violet-300/15
                        "
                      >
                        ✨
                      </span>

                      <span className="flex-1">
                        <span className="block font-black">
                          Test pull system
                        </span>

                        <span className="text-sm text-white/45">
                          Verify pricing and rewards
                        </span>
                      </span>

                      <span className="text-violet-200">→</span>
                    </Link>
                  </div>
                </section>
              </div>
            </section>

            <footer
              className="
                mt-8
                flex
                flex-col
                gap-3
                rounded-[2rem]
                border
                border-white/10
                bg-black/15
                px-6
                py-5
                text-sm
                font-semibold
                text-white/40
                backdrop-blur-2xl
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <p>
                PocketPulls internal operations dashboard
              </p>

              <p>
                {lastUpdated
                  ? `Last synchronised ${lastUpdated.toLocaleTimeString(
                      "en-GB",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}`
                  : "Waiting for synchronisation"}
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}