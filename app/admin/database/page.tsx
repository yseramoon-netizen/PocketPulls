"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import { supabase } from "@/lib/supabase";

type DatabaseStats = {
  total_cards: number | string | null;
  cards_with_api_id: number | string | null;
  cards_with_prices: number | string | null;
  cards_without_prices: number | string | null;
  cards_without_images: number | string | null;
  stale_price_cards: number | string | null;
  last_full_sync_at: string | null;
  last_price_sync_at: string | null;
  usd_to_gbp: number | string | null;
  eur_to_gbp: number | string | null;
  fx_date: string | null;
};

type SyncRun = {
  id: string;
  mode: string;
  status: string;
  current_page: number | string | null;
  total_pages: number | string | null;
  cards_received: number | string | null;
  cards_inserted: number | string | null;
  cards_updated: number | string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type StatusResponse = {
  stats: DatabaseStats | null;
  runs: SyncRun[];
  hasPokemonApiKey: boolean;
  error?: string;
};

type SyncResponse = {
  runId: string;
  mode: "full" | "prices";
  page: number;
  totalPages: number;
  totalCount: number;
  received: number;
  inserted: number;
  updated: number;
  finalPage: boolean;
  rates: {
    usdToGbp: number;
    eurToGbp: number;
    date: string;
  };
  hasPokemonApiKey: boolean;
  error?: string;
};

type SyncMode = "full" | "prices";

type ProgressState = {
  runId: string | null;
  mode: SyncMode;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  received: number;
  inserted: number;
  updated: number;
  startedAt: number | null;
};

const EMPTY_PROGRESS: ProgressState = {
  runId: null,
  mode: "full",
  currentPage: 0,
  totalPages: 0,
  totalCount: 0,
  received: 0,
  inserted: 0,
  updated: 0,
  startedAt: null,
};

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.floor(toNumber(value))),
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error ===
      "string"
  ) {
    return (value as { error: string }).error;
  }

  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}

export default function CardDatabasePage() {
  const cancelRef = useRef(false);

  const [stats, setStats] =
    useState<DatabaseStats | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [progress, setProgress] =
    useState<ProgressState>(EMPTY_PROGRESS);
  const [syncing, setSyncing] = useState(false);
  const [loadingStatus, setLoadingStatus] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>(
    [],
  );

  const getToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error(
        "Your admin session could not be verified.",
      );
    }

    return session.access_token;
  }, []);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
    );

    setLogLines((current) =>
      [`${time}  ${message}`, ...current].slice(
        0,
        120,
      ),
    );
  }, []);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setErrorMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(
        "/api/admin/card-database",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const body =
        (await response.json()) as StatusResponse;

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Database status could not be loaded.",
        );
      }

      setStats(body.stats);
      setRuns(body.runs || []);
      setHasApiKey(body.hasPokemonApiKey);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Database status could not be loaded.",
        ),
      );
    } finally {
      setLoadingStatus(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startSync = useCallback(
    async (mode: SyncMode) => {
      if (syncing) {
        return;
      }

      cancelRef.current = false;
      setSyncing(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setLogLines([]);

      let nextProgress: ProgressState = {
        ...EMPTY_PROGRESS,
        mode,
        startedAt: Date.now(),
      };

      setProgress(nextProgress);

      try {
        const token = await getToken();
        let page = 1;

        addLog(
          mode === "full"
            ? "Starting complete card and price sync."
            : "Starting complete price refresh.",
        );

        while (!cancelRef.current) {
          addLog(`Requesting API page ${page}...`);

          const response = await fetch(
            "/api/admin/card-database",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                page,
                mode,
                runId: nextProgress.runId,
              }),
            },
          );

          const body =
            (await response.json()) as SyncResponse;

          if (!response.ok) {
            throw new Error(
              body.error ||
                `Page ${page} could not be synced.`,
            );
          }

          nextProgress = {
            runId: body.runId,
            mode,
            currentPage: body.page,
            totalPages: body.totalPages,
            totalCount: body.totalCount,
            received:
              nextProgress.received +
              body.received,
            inserted:
              nextProgress.inserted +
              body.inserted,
            updated:
              nextProgress.updated +
              body.updated,
            startedAt:
              nextProgress.startedAt ||
              Date.now(),
          };

          setProgress(nextProgress);
          setHasApiKey(body.hasPokemonApiKey);

          addLog(
            `Page ${body.page}/${body.totalPages}: ` +
              `${body.received} received, ` +
              `${body.inserted} new, ` +
              `${body.updated} refreshed.`,
          );

          if (body.finalPage) {
            setSuccessMessage(
              mode === "full"
                ? `Database sync complete. ${formatNumber(
                    nextProgress.inserted,
                  )} cards were added and ${formatNumber(
                    nextProgress.updated,
                  )} were refreshed.`
                : `Price refresh complete for ${formatNumber(
                    nextProgress.updated,
                  )} existing cards.`,
            );

            addLog("Sync completed successfully.");
            break;
          }

          page += 1;

          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              body.hasPokemonApiKey ? 180 : 2200,
            ),
          );
        }

        if (cancelRef.current) {
          addLog(
            "Sync stopped locally. Completed pages remain saved.",
          );
          setSuccessMessage(
            "Sync stopped. You can safely start again; existing pages remain imported.",
          );
        }

        await loadStatus();
      } catch (error: unknown) {
        const message = getErrorMessage(
          error,
          "The card database sync failed.",
        );

        setErrorMessage(message);
        addLog(`ERROR: ${message}`);
      } finally {
        setSyncing(false);
      }
    },
    [
      syncing,
      getToken,
      addLog,
      loadStatus,
    ],
  );

  const progressPercent =
    progress.totalPages > 0
      ? Math.min(
          100,
          (progress.currentPage /
            progress.totalPages) *
            100,
        )
      : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-4 pb-28 pt-4 text-white md:px-8 md:pt-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        <header className="relative mt-8 overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.08] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-3xl md:p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cyan-300/10 blur-[140px]" />

          <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/55">
                Shaymin's master archive
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] md:text-6xl">
                Card Database Sync
              </h1>

              <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-emerald-50/70 md:text-lg">
                Import missing cards, refresh images and
                replace stale prices with finish-specific
                GBP values from the live card APIs.
              </p>
            </div>

            <Link
              href="/admin/add"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] px-6 font-black text-white transition hover:bg-white/10"
            >
              Back to Add Cards
            </Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-[1.75rem] border border-red-300/20 bg-red-500/10 px-6 py-5 font-bold text-red-100 backdrop-blur-2xl">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-[1.75rem] border border-emerald-200/20 bg-emerald-300/10 px-6 py-5 font-bold leading-6 text-emerald-100 backdrop-blur-2xl">
            {successMessage}
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Total cards"
            value={
              loadingStatus
                ? "..."
                : formatNumber(stats?.total_cards)
            }
            detail="Local catalogue rows"
          />

          <StatCard
            label="API connected"
            value={
              loadingStatus
                ? "..."
                : formatNumber(
                    stats?.cards_with_api_id,
                  )
            }
            detail="Cards with source IDs"
          />

          <StatCard
            label="Priced cards"
            value={
              loadingStatus
                ? "..."
                : formatNumber(
                    stats?.cards_with_prices,
                  )
            }
            detail="Positive GBP value"
          />

          <StatCard
            label="Missing prices"
            value={
              loadingStatus
                ? "..."
                : formatNumber(
                    stats?.cards_without_prices,
                  )
            }
            detail="Need source pricing"
          />

          <StatCard
            label="Missing images"
            value={
              loadingStatus
                ? "..."
                : formatNumber(
                    stats?.cards_without_images,
                  )
            }
            detail="No scanner reference art"
          />

          <StatCard
            label="Stale prices"
            value={
              loadingStatus
                ? "..."
                : formatNumber(
                    stats?.stale_price_cards,
                  )
            }
            detail="Older than seven days"
          />
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] shadow-[0_35px_100px_rgba(0,0,0,0.3)] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6 md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200/55">
                Sync controls
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Rebuild the archive
              </h2>

              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/40">
                A complete sync walks through every API page.
                It is resumable and updates existing rows
                instead of duplicating them.
              </p>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void startSync("full")
                  }
                  disabled={syncing}
                  className="min-h-36 rounded-[1.75rem] border border-emerald-100/25 bg-emerald-300/15 p-5 text-left transition hover:-translate-y-0.5 hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="text-3xl">+</span>
                  <strong className="mt-4 block text-lg text-emerald-50">
                    Import everything
                  </strong>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-emerald-50/45">
                    Adds missing cards and refreshes all
                    card details, images and prices.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void startSync("prices")
                  }
                  disabled={syncing}
                  className="min-h-36 rounded-[1.75rem] border border-cyan-100/25 bg-cyan-200/12 p-5 text-left transition hover:-translate-y-0.5 hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="text-3xl">£</span>
                  <strong className="mt-4 block text-lg text-cyan-50">
                    Refresh all prices
                  </strong>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-cyan-50/45">
                    Re-checks normal, holo and reverse
                    holo values for the full database.
                  </span>
                </button>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/30">
                      Current progress
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {syncing
                        ? `Page ${progress.currentPage || 1} of ${
                            progress.totalPages || "?"
                          }`
                        : "Ready"}
                    </p>
                  </div>

                  <span className="text-xs font-bold text-white/35">
                    {hasApiKey
                      ? "API key active - fast mode"
                      : "No API key - safe throttled mode"}
                  </span>
                </div>

                <div className="mt-5 h-4 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-200 to-yellow-200 transition-[width] duration-500"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <MiniStat
                    label="Received"
                    value={progress.received}
                  />
                  <MiniStat
                    label="New"
                    value={progress.inserted}
                  />
                  <MiniStat
                    label="Updated"
                    value={progress.updated}
                  />
                </div>

                {syncing ? (
                  <button
                    type="button"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                    className="mt-5 min-h-12 w-full rounded-xl border border-red-100/15 bg-red-400/[0.08] px-4 font-black text-red-100"
                  >
                    Stop after current page
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void loadStatus()
                    }
                    className="mt-5 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 font-black text-white/55 transition hover:bg-white/10 hover:text-white"
                  >
                    Refresh statistics
                  </button>
                )}
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] shadow-[0_35px_100px_rgba(0,0,0,0.3)] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6 md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-200/55">
                Pricing health
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Live reference rates
              </h2>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <RateCard
                  label="USD to GBP"
                  value={stats?.usd_to_gbp}
                />
                <RateCard
                  label="EUR to GBP"
                  value={stats?.eur_to_gbp}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/28">
                  Exchange-rate date
                </p>
                <p className="mt-2 font-black text-white/70">
                  {stats?.fx_date || "Not loaded yet"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <InfoRow
                  label="Last full sync"
                  value={formatDateTime(
                    stats?.last_full_sync_at || null,
                  )}
                />
                <InfoRow
                  label="Last price sync"
                  value={formatDateTime(
                    stats?.last_price_sync_at || null,
                  )}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-yellow-100/15 bg-yellow-200/[0.06] p-4 text-xs font-semibold leading-6 text-yellow-50/55">
                Add{" "}
                <code className="font-black text-yellow-50">
                  POKEMON_TCG_API_KEY
                </code>{" "}
                to <code>.env.local</code> for faster
                syncing. The page still works without it,
                but pauses between API pages.
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-2xl font-black">
                Live sync log
              </h2>
            </div>

            <div className="h-96 overflow-y-auto bg-black/20 p-5 font-mono text-xs leading-6 text-emerald-100/65">
              {logLines.length > 0 ? (
                logLines.map((line, index) => (
                  <div key={`${line}-${index}`}>
                    {line}
                  </div>
                ))
              ) : (
                <p className="text-white/25">
                  Start a sync to see each page here.
                </p>
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-2xl font-black">
                Recent sync runs
              </h2>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {runs.length > 0 ? (
                runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.1em] ${
                            run.status === "completed"
                              ? "border-emerald-100/15 bg-emerald-300/[0.08] text-emerald-50"
                              : run.status === "failed"
                                ? "border-red-100/15 bg-red-400/[0.08] text-red-100"
                                : "border-cyan-100/15 bg-cyan-300/[0.08] text-cyan-50"
                          }`}
                        >
                          {run.status}
                        </span>

                        <strong className="text-sm capitalize text-white">
                          {run.mode} sync
                        </strong>
                      </div>

                      <p className="mt-2 text-xs font-semibold text-white/28">
                        {formatDateTime(run.started_at)}
                      </p>
                    </div>

                    <div className="text-left text-xs font-bold text-white/38 sm:text-right">
                      <p>
                        Page {formatNumber(run.current_page)}
                        {toNumber(run.total_pages) > 0
                          ? ` / ${formatNumber(
                              run.total_pages,
                            )}`
                          : ""}
                      </p>
                      <p className="mt-1">
                        {formatNumber(run.cards_inserted)} new
                        ·{" "}
                        {formatNumber(run.cards_updated)} updated
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-6 text-sm font-semibold text-white/30">
                  No database sync has been recorded yet.
                </p>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-2xl">
      <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-white/25">
        {detail}
      </p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <p className="text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/25">
        {label}
      </p>
      <p className="mt-1 font-black">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function RateCard({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const number = toNumber(value);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-white/28">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-cyan-50">
        {number > 0 ? number.toFixed(4) : "Not loaded"}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <span className="text-xs font-bold text-white/28">
        {label}
      </span>
      <strong className="text-right text-xs text-white/65">
        {value}
      </strong>
    </div>
  );
}
