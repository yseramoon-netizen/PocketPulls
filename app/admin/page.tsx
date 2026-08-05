"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import { adminFetch } from "@/lib/admin/client-auth";

type Branch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
  activeThisWeek: boolean;
};

type TreeResponse = {
  ok: true;
  viewerEmail: string;
  generatedAt: string;
  tree: {
    stage: string;
    stageIndex: number;
    growthScore: number;
    rawGrowthScore: number;
    gardenVisits: number;
    persistentGrowth: boolean;
    stageFloor: number;
    nextStageScore: number;
    stageProgress: number;
    stockCards: number;
    trainers: number;
    cardsFound: number;
    availableWishes: number;
    wishesSpent: number;
    valueShared: number;
    sharedCards: number;
    cardsPlantedToday: number;
    wishesToday: number;
    latestActivityAt: string | null;
    bothActiveThisWeek: boolean;
    branches: Branch[];
  };
};

const QUICK_LINKS = [
  {
    href: "/admin/add",
    title: "Add cards",
    detail: "Scan, search and place new stock into inventory.",
    icon: "+",
  },
  {
    href: "/admin/inventory",
    title: "Inventory",
    detail: "Review quantities, values, finishes and locations.",
    icon: "▦",
  },
  {
    href: "/admin/pulls",
    title: "Pull operations",
    detail: "Test and manage the card distribution flow.",
    icon: "✦",
  },
  {
    href: "/admin/players",
    title: "Player accounts",
    detail: "Manage access, balances, cards and account status.",
    icon: "◎",
  },
  {
    href: "/admin/database",
    title: "Card database",
    detail: "Synchronise source data and refresh market values.",
    icon: "⌁",
  },
] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.round(value)),
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return "No recent activity";

  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function greeting(email: string): string {
  const hour = new Date().getHours();
  const moment =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
  const normalised = email.toLowerCase();
  const name =
    normalised === "pullspocket@gmail.com" ||
    normalised.includes("lukas")
      ? "Lukas"
      : normalised.includes("skye")
        ? "Skye"
        : email.split("@")[0] || "Admin";

  return `${moment}, ${name}`;
}

function Metric({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#071b14]/84 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full ${accent} blur-[52px]`}
      />
      <p className="relative text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/36">
        {label}
      </p>
      <p className="relative mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </p>
      <p className="relative mt-2 text-xs font-semibold leading-5 text-white/34">
        {detail}
      </p>
    </article>
  );
}

export default function AdminHomePage() {
  const [data, setData] =
    useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await adminFetch<TreeResponse>(
        "/api/admin/tree",
      );
      setData(response);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The operations overview could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activitySummary = useMemo(() => {
    if (!data) {
      return "Loading the latest operating position.";
    }

    if (
      data.tree.cardsPlantedToday === 0 &&
      data.tree.wishesToday === 0
    ) {
      return "No card or wish activity has been recorded today yet.";
    }

    return `${formatNumber(
      data.tree.cardsPlantedToday,
    )} cards added and ${formatNumber(
      data.tree.wishesToday,
    )} wishes completed today.`;
  }, [data]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1680px]">
        <AdminNav />

        <header className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-100/38">
              Operations overview
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              {data
                ? greeting(data.viewerEmail)
                : "PocketPulls administration"}
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50/42 sm:text-base">
              A concise view of stock, players, fulfilment and the work completed today.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-5 text-sm font-black text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            {loading ? "Refreshing..." : "Refresh overview"}
          </button>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Cards in stock"
            value={formatNumber(data?.tree.stockCards || 0)}
            detail={`${formatNumber(
              data?.tree.cardsPlantedToday || 0,
            )} added today.`}
            accent="bg-emerald-300/12"
          />
          <Metric
            label="Player accounts"
            value={formatNumber(data?.tree.trainers || 0)}
            detail={`${formatNumber(
              data?.tree.availableWishes || 0,
            )} wishes currently available.`}
            accent="bg-cyan-300/10"
          />
          <Metric
            label="Cards fulfilled"
            value={formatNumber(data?.tree.cardsFound || 0)}
            detail={`${formatNumber(
              data?.tree.wishesToday || 0,
            )} completed today.`}
            accent="bg-violet-300/10"
          />
          <Metric
            label="Value distributed"
            value={formatMoney(data?.tree.valueShared || 0)}
            detail={`${formatNumber(
              data?.tree.wishesSpent || 0,
            )} lifetime wishes spent.`}
            accent="bg-yellow-300/10"
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <article className="rounded-[2.2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/36">
                  Primary actions
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Continue operating
                </h2>
              </div>
              <p className="text-xs font-bold text-white/26">
                {activitySummary}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-5 transition hover:border-emerald-100/22 hover:bg-white/[0.065]"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/18 text-lg font-black text-emerald-100/70 transition group-hover:scale-105">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[0.67rem] font-semibold leading-5 text-white/30">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[2.2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/36">
              Operating pulse
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Latest position
            </h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/28">
                  Last activity
                </p>
                <p className="mt-2 text-sm font-black text-white/72">
                  {formatTime(data?.tree.latestActivityAt || null)}
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/28">
                      Shared admin activity
                    </p>
                    <p className="mt-2 text-sm font-black text-white/72">
                      {data?.tree.bothActiveThisWeek
                        ? "Both administrators active this week"
                        : "One administrator branch still quiet"}
                    </p>
                  </div>
                  <span
                    className={`h-3 w-3 rounded-full ${
                      data?.tree.bothActiveThisWeek
                        ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.75)]"
                        : "bg-white/20"
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/28">
                      Long-term growth score
                    </p>
                    <p className="mt-2 text-sm font-black text-white/72">
                      {formatNumber(data?.tree.growthScore || 0)}
                    </p>
                  </div>
                  <span className="text-lg text-lime-100/55">↗</span>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
