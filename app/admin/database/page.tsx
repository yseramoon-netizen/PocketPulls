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

type TrackerStats = {
  total_cards: number | string | null;
  local_files_tracked: number | string | null;
  local_cards_tracked: number | string | null;
  priced_cards: number | string | null;
  unpriced_cards: number | string | null;
  failed_price_cards: number | string | null;
  due_price_cards: number | string | null;
  last_local_sync_at: string | null;
  last_local_check_at: string | null;
  local_source_commit_sha: string | null;
  local_source_path: string | null;
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
  cards_skipped: number | string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type TrackedFile = {
  file_path: string;
  remote_sha: string | null;
  source_commit_sha: string | null;
  card_count: number | string | null;
  inserted_count: number | string | null;
  updated_count: number | string | null;
  skipped_count: number | string | null;
  last_error: string | null;
  last_synced_at: string | null;
};

type SourceFile = {
  path: string;
  sha: string;
  size: number;
};

type StatusResponse = {
  stats: TrackerStats | null;
  runs: SyncRun[];
  recentFiles: TrackedFile[];
  hasPokemonApiKey: boolean;
  hasGithubToken: boolean;
  localPath: string;
  sourceRepository: string;
  pkmnCardsReference: string;
  error?: string;
};

type PrepareResponse = {
  runId: string;
  commitSha: string;
  files: SourceFile[];
  totalFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  completeImmediately: boolean;
  localPath: string;
  hasGithubToken: boolean;
  error?: string;
};

type FileResponse = {
  runId: string;
  filePath: string;
  received: number;
  inserted: number;
  updated: number;
  skipped: number;
  localHash: string;
  error?: string;
};

type PriceResponse = {
  processed: number;
  priced: number;
  unpriced: number;
  failed: number;
  remaining: number;
  done: boolean;
  hasPokemonApiKey: boolean;
  error?: string;
};

type LocalProgress = {
  currentFile: number;
  totalFiles: number;
  inserted: number;
  updated: number;
  skipped: number;
  received: number;
  currentPath: string;
  commitSha: string;
};

type PriceProgress = {
  processed: number;
  priced: number;
  unpriced: number;
  failed: number;
  remaining: number;
};

const EMPTY_LOCAL_PROGRESS: LocalProgress = {
  currentFile: 0,
  totalFiles: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  received: 0,
  currentPath: "",
  commitSha: "",
};

const EMPTY_PRICE_PROGRESS: PriceProgress = {
  processed: 0,
  priced: 0,
  unpriced: 0,
  failed: 0,
  remaining: 0,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.floor(toNumber(value))),
  );
}

function formatDateTime(value: string | null | undefined): string {
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

function getErrorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  ) {
    return (value as { error: string }).error;
  }

  if (value instanceof Error && value.message.trim()) {
    return value.message.trim();
  }

  return fallback;
}

export default function CardDatabasePage() {
  const stopLocalRef = useRef(false);
  const stopPricesRef = useRef(false);

  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [recentFiles, setRecentFiles] = useState<TrackedFile[]>([]);
  const [hasPokemonApiKey, setHasPokemonApiKey] = useState(false);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [localPath, setLocalPath] = useState("");
  const [sourceRepository, setSourceRepository] = useState("");
  const [pkmnCardsReference, setPkmnCardsReference] = useState("");

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [localProgress, setLocalProgress] =
    useState<LocalProgress>(EMPTY_LOCAL_PROGRESS);
  const [priceProgress, setPriceProgress] =
    useState<PriceProgress>(EMPTY_PRICE_PROGRESS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLogLines((current) =>
      [`${time}  ${message}`, ...current].slice(0, 180),
    );
  }, []);

  const getToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      if (forceRefresh) {
        const { data, error } = await supabase.auth.refreshSession();

        if (error || !data.session?.access_token) {
          throw new Error(
            "Your admin session expired. Sign out and sign in again.",
          );
        }

        return data.session.access_token;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        throw new Error("Your admin session could not be verified.");
      }

      const expiresAt =
        typeof session.expires_at === "number" ? session.expires_at : 0;

      if (
        expiresAt > 0 &&
        expiresAt * 1000 <= Date.now() + 120_000
      ) {
        const { data, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError || !data.session?.access_token) {
          throw new Error(
            "Your admin session expired. Sign out and sign in again.",
          );
        }

        return data.session.access_token;
      }

      return session.access_token;
    },
    [],
  );

  const authenticatedFetch = useCallback(
    async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ): Promise<Response> => {
      const makeRequest = async (forceRefresh: boolean) => {
        const token = await getToken(forceRefresh);
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);

        return fetch(input, {
          ...init,
          headers,
          cache: "no-store",
        });
      };

      let response = await makeRequest(false);

      if (response.status === 401) {
        addLog("Session refreshed; retrying the same database action.");
        response = await makeRequest(true);
      }

      return response;
    },
    [addLog, getToken],
  );

  const postAction = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<T> => {
      const response = await authenticatedFetch(
        "/api/admin/card-database",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = (await response.json()) as T & { error?: string };

      if (!response.ok) {
        throw new Error(
          data.error || "The database action was rejected.",
        );
      }

      return data;
    },
    [authenticatedFetch],
  );

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);

    try {
      const response = await authenticatedFetch(
        "/api/admin/card-database",
      );
      const body = (await response.json()) as StatusResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Database status could not be loaded.",
        );
      }

      setStats(body.stats);
      setRuns(body.runs || []);
      setRecentFiles(body.recentFiles || []);
      setHasPokemonApiKey(body.hasPokemonApiKey);
      setHasGithubToken(body.hasGithubToken);
      setLocalPath(body.localPath || "");
      setSourceRepository(body.sourceRepository || "");
      setPkmnCardsReference(body.pkmnCardsReference || "");
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "Database status could not be loaded."),
      );
    } finally {
      setLoadingStatus(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const syncLocalDatabase = useCallback(async () => {
    if (syncingLocal || syncingPrices) {
      return;
    }

    stopLocalRef.current = false;
    setSyncingLocal(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLogLines([]);
    setLocalProgress(EMPTY_LOCAL_PROGRESS);

    try {
      addLog("Checking the official downloadable repository for changes...");

      const preparation = await postAction<PrepareResponse>({
        action: "prepare_local",
      });

      setHasGithubToken(preparation.hasGithubToken);
      setLocalPath(preparation.localPath);
      setLocalProgress({
        ...EMPTY_LOCAL_PROGRESS,
        totalFiles: preparation.changedFiles,
        commitSha: preparation.commitSha,
      });

      addLog(
        `${preparation.totalFiles} source files found: ` +
          `${preparation.changedFiles} changed, ` +
          `${preparation.unchangedFiles} already current.`,
      );

      if (preparation.completeImmediately) {
        setSuccessMessage(
          "The local card database is already current. No cards were rewritten.",
        );
        addLog("No changed files. Sync complete.");
        await loadStatus();
        return;
      }

      let aggregate: LocalProgress = {
        ...EMPTY_LOCAL_PROGRESS,
        totalFiles: preparation.files.length,
        commitSha: preparation.commitSha,
      };

      for (let index = 0; index < preparation.files.length; index += 1) {
        if (stopLocalRef.current) {
          addLog("Stopped safely. Completed files remain tracked locally.");
          setSuccessMessage(
            "Local sync paused safely. Start it again to continue with only the remaining changed files.",
          );
          return;
        }

        const file = preparation.files[index];
        aggregate = {
          ...aggregate,
          currentFile: index + 1,
          currentPath: file.path,
        };
        setLocalProgress(aggregate);
        addLog(`Downloading changed file ${index + 1}/${preparation.files.length}: ${file.path}`);

        const result = await postAction<FileResponse>({
          action: "sync_local_file",
          runId: preparation.runId,
          commitSha: preparation.commitSha,
          filePath: file.path,
          remoteSha: file.sha,
        });

        aggregate = {
          ...aggregate,
          received: aggregate.received + result.received,
          inserted: aggregate.inserted + result.inserted,
          updated: aggregate.updated + result.updated,
          skipped: aggregate.skipped + result.skipped,
        };
        setLocalProgress(aggregate);

        addLog(
          `${file.path}: ${result.inserted} new, ${result.updated} changed, ${result.skipped} unchanged cards.`,
        );
      }

      await postAction({
        action: "complete_local",
        runId: preparation.runId,
        commitSha: preparation.commitSha,
      });

      setSuccessMessage(
        `Local database updated. ${formatNumber(aggregate.inserted)} cards added, ` +
          `${formatNumber(aggregate.updated)} changed cards updated, and ` +
          `${formatNumber(aggregate.skipped)} unchanged cards skipped.`,
      );
      addLog("Local database sync completed successfully.");
      await loadStatus();
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "The local database sync failed.",
      );
      setErrorMessage(message);
      addLog(`ERROR: ${message}`);
    } finally {
      setSyncingLocal(false);
    }
  }, [
    syncingLocal,
    syncingPrices,
    addLog,
    postAction,
    loadStatus,
  ]);

  const refreshDuePrices = useCallback(async () => {
    if (syncingLocal || syncingPrices) {
      return;
    }

    stopPricesRef.current = false;
    setSyncingPrices(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPriceProgress({
      ...EMPTY_PRICE_PROGRESS,
      remaining: Math.max(0, toNumber(stats?.due_price_cards)),
    });

    try {
      let aggregate: PriceProgress = {
        ...EMPTY_PRICE_PROGRESS,
        remaining: Math.max(0, toNumber(stats?.due_price_cards)),
      };
      let sessionProcessed = 0;
      const sessionLimit = hasPokemonApiKey ? 600 : 30;

      addLog(
        hasPokemonApiKey
          ? "Refreshing only missing or seven-day-old prices in tracked batches."
          : "No Pokemon API key found. Refreshing one due card at a time safely.",
      );

      while (!stopPricesRef.current && sessionProcessed < sessionLimit) {
        const result = await postAction<PriceResponse>({
          action: "price_batch",
        });

        setHasPokemonApiKey(result.hasPokemonApiKey);

        aggregate = {
          processed: aggregate.processed + result.processed,
          priced: aggregate.priced + result.priced,
          unpriced: aggregate.unpriced + result.unpriced,
          failed: aggregate.failed + result.failed,
          remaining: result.remaining,
        };
        sessionProcessed += result.processed;
        setPriceProgress(aggregate);

        addLog(
          `Price batch: ${result.priced} priced, ${result.unpriced} without market data, ` +
            `${result.failed} deferred after errors, ${result.remaining} currently due.`,
        );

        if (result.done || result.processed === 0) {
          setSuccessMessage(
            `Price tracker is current. ${formatNumber(aggregate.priced)} cards received prices ` +
              `and ${formatNumber(aggregate.unpriced)} were confirmed without source pricing.`,
          );
          break;
        }

        if (!result.hasPokemonApiKey) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
      }

      if (stopPricesRef.current) {
        setSuccessMessage(
          "Price refresh paused safely. Every processed card is tracked, so the next run resumes with the remaining due cards.",
        );
      } else if (sessionProcessed >= sessionLimit && aggregate.remaining > 0) {
        setSuccessMessage(
          `This safe session processed ${formatNumber(sessionProcessed)} cards. ` +
            `${formatNumber(aggregate.remaining)} due cards remain and the next run will continue from them.`,
        );
      }

      await loadStatus();
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "The tracked price refresh failed.",
      );
      setErrorMessage(message);
      addLog(`ERROR: ${message}`);
    } finally {
      setSyncingPrices(false);
    }
  }, [
    syncingLocal,
    syncingPrices,
    stats?.due_price_cards,
    hasPokemonApiKey,
    addLog,
    postAction,
    loadStatus,
  ]);

  const localPercent =
    localProgress.totalFiles > 0
      ? Math.min(
          100,
          (localProgress.currentFile / localProgress.totalFiles) * 100,
        )
      : 0;

  const dueAtStart = Math.max(
    priceProgress.processed + priceProgress.remaining,
    toNumber(stats?.due_price_cards),
  );
  const pricePercent =
    dueAtStart > 0
      ? Math.min(100, (priceProgress.processed / dueAtStart) * 100)
      : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-4 pb-28 pt-4 text-white md:px-8 md:pt-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto max-w-[1550px]">
        <AdminNav />

        <header className="relative mt-8 overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.08] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-3xl md:p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cyan-300/10 blur-[140px]" />
          <div className="pointer-events-none absolute -bottom-32 left-20 h-80 w-80 rounded-full bg-emerald-300/10 blur-[120px]" />

          <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/55">
                Shaymin&apos;s resilient archive
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] md:text-6xl">
                Incremental Card Database
              </h1>

              <p className="mt-4 max-w-4xl text-base font-medium leading-7 text-emerald-50/70 md:text-lg">
                Card metadata now comes from a local downloadable archive.
                File SHAs and individual card hashes prevent unchanged cards
                from being rewritten. Prices run through their own resumable
                missing-and-stale queue.
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
          <div className="mt-6 rounded-[1.75rem] border border-red-300/20 bg-red-500/10 px-6 py-5 font-bold leading-6 text-red-100 backdrop-blur-2xl">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-[1.75rem] border border-emerald-200/20 bg-emerald-300/10 px-6 py-5 font-bold leading-6 text-emerald-100 backdrop-blur-2xl">
            {successMessage}
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard label="Cards" value={loadingStatus ? "..." : formatNumber(stats?.total_cards)} detail="Local catalogue rows" />
          <StatCard label="Tracked locally" value={loadingStatus ? "..." : formatNumber(stats?.local_cards_tracked)} detail="Per-card hashes" />
          <StatCard label="Source files" value={loadingStatus ? "..." : formatNumber(stats?.local_files_tracked)} detail="Set files with SHAs" />
          <StatCard label="Priced" value={loadingStatus ? "..." : formatNumber(stats?.priced_cards)} detail="Positive GBP price" />
          <StatCard label="Unpriced" value={loadingStatus ? "..." : formatNumber(stats?.unpriced_cards)} detail="No current source value" />
          <StatCard label="Price failures" value={loadingStatus ? "..." : formatNumber(stats?.failed_price_cards)} detail="Deferred for retry" />
          <StatCard label="Prices due" value={loadingStatus ? "..." : formatNumber(stats?.due_price_cards)} detail="Missing or 7+ days old" />
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-2">
          <SyncPanel
            eyebrow="Official local card library"
            title="Download only changed set files"
            description="The first run downloads every English set JSON file. Future runs compare the latest repository commit and each file SHA, then download only new or changed files. Inside changed files, unchanged card hashes are skipped."
            buttonLabel={syncingLocal ? "Syncing local files..." : "Check and sync local database"}
            disabled={syncingLocal || syncingPrices}
            onStart={() => void syncLocalDatabase()}
            onStop={syncingLocal ? () => { stopLocalRef.current = true; } : undefined}
            progress={localPercent}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="File" value={localProgress.totalFiles > 0 ? `${localProgress.currentFile}/${localProgress.totalFiles}` : "Ready"} />
              <MiniStat label="New cards" value={formatNumber(localProgress.inserted)} />
              <MiniStat label="Changed" value={formatNumber(localProgress.updated)} />
              <MiniStat label="Skipped" value={formatNumber(localProgress.skipped)} />
            </div>

            <InfoBox label="Current file" value={localProgress.currentPath || "No file running"} />
            <InfoBox label="Tracked commit" value={(localProgress.commitSha || stats?.local_source_commit_sha || "Not downloaded yet").slice(0, 16)} />
            <InfoBox label="Local folder" value={localPath || stats?.local_source_path || "Not prepared yet"} mono />
          </SyncPanel>

          <SyncPanel
            eyebrow="Resumable price queue"
            title="Refresh only prices that are due"
            description="This never walks every card automatically. It selects only cards with no previous check, prices older than seven days, or failed cards whose retry delay has expired. Every result is saved before the next request."
            buttonLabel={syncingPrices ? "Refreshing due prices..." : "Refresh due prices"}
            disabled={syncingLocal || syncingPrices || toNumber(stats?.due_price_cards) <= 0}
            onStart={() => void refreshDuePrices()}
            onStop={syncingPrices ? () => { stopPricesRef.current = true; } : undefined}
            progress={pricePercent}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Processed" value={formatNumber(priceProgress.processed)} />
              <MiniStat label="Priced" value={formatNumber(priceProgress.priced)} />
              <MiniStat label="No price" value={formatNumber(priceProgress.unpriced)} />
              <MiniStat label="Remaining" value={formatNumber(priceProgress.remaining || stats?.due_price_cards)} />
            </div>

            <InfoBox label="Pokemon API mode" value={hasPokemonApiKey ? "API key active - 12 tracked cards per batch" : "No API key - 1 tracked card per batch"} />
            <InfoBox label="Last completed price pass" value={formatDateTime(stats?.last_price_sync_at)} />
            <InfoBox label="Exchange rates" value={`USD ${toNumber(stats?.usd_to_gbp).toFixed(4)} · EUR ${toNumber(stats?.eur_to_gbp).toFixed(4)} · ${stats?.fx_date || "not loaded"}`} />
          </SyncPanel>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6 md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200/55">
                Source policy
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Downloadable source, without scraping
              </h2>
            </div>

            <div className="space-y-4 p-6 md:p-8">
              <SourceCard
                title="PokemonTCG card data repository"
                description="Used for the local JSON database. It is the downloadable data behind the Pokemon TCG API and is checked by repository commit and Git blob SHA."
                href={sourceRepository}
                action="Open official repository"
                status={hasGithubToken ? "GitHub token active" : "Public GitHub mode"}
              />

              <SourceCard
                title="PkmnCards"
                description="Kept as a manual visual reference only. Its own About page states that its database is unavailable for download and it provides no API, so PocketPulls does not scrape or mirror it."
                href={pkmnCardsReference}
                action="Open manual reference"
                status="No automated import"
              />

              <InfoBox label="Last local check" value={formatDateTime(stats?.last_local_check_at)} />
              <InfoBox label="Last completed local sync" value={formatDateTime(stats?.last_local_sync_at)} />
            </div>
          </article>

          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6 md:p-8">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-200/55">
                  Live operations
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Tracker log
                </h2>
              </div>

              <button
                type="button"
                onClick={() => void loadStatus()}
                disabled={loadingStatus}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white/55 disabled:opacity-40"
              >
                Refresh stats
              </button>
            </div>

            <div className="h-[31rem] overflow-y-auto bg-black/20 p-5 font-mono text-xs leading-6 text-emerald-100/65">
              {logLines.length > 0 ? (
                logLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))
              ) : (
                <p className="text-white/25">
                  Start a local sync or price refresh to see tracked work here.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-2">
          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-2xl font-black">Recently changed files</h2>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {recentFiles.length > 0 ? (
                recentFiles.map((file) => (
                  <div key={file.file_path} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-black text-cyan-50/75">
                          {file.file_path}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-white/25">
                          {formatDateTime(file.last_synced_at)}
                        </p>
                      </div>

                      <div className="text-left text-xs font-bold text-white/38 sm:text-right">
                        <p>{formatNumber(file.card_count)} cards</p>
                        <p className="mt-1">
                          {formatNumber(file.inserted_count)} new · {formatNumber(file.updated_count)} changed · {formatNumber(file.skipped_count)} skipped
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-6 text-sm font-semibold text-white/30">
                  No local files have been tracked yet.
                </p>
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] backdrop-blur-3xl">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-2xl font-black">Recent sync runs</h2>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {runs.length > 0 ? (
                runs.map((run) => (
                  <div key={run.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.1em] ${run.status === "completed" ? "border-emerald-100/15 bg-emerald-300/[0.08] text-emerald-50" : run.status === "failed" ? "border-red-100/15 bg-red-400/[0.08] text-red-100" : "border-cyan-100/15 bg-cyan-300/[0.08] text-cyan-50"}`}>
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
                        File {formatNumber(run.current_page)}
                        {toNumber(run.total_pages) > 0 ? ` / ${formatNumber(run.total_pages)}` : ""}
                      </p>
                      <p className="mt-1">
                        {formatNumber(run.cards_inserted)} new · {formatNumber(run.cards_updated)} changed · {formatNumber(run.cards_skipped)} skipped
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-6 text-sm font-semibold text-white/30">
                  No sync run has been recorded yet.
                </p>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function SyncPanel({
  eyebrow,
  title,
  description,
  buttonLabel,
  disabled,
  onStart,
  onStop,
  progress,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  onStart: () => void;
  onStop?: () => void;
  progress: number;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] shadow-[0_35px_100px_rgba(0,0,0,0.3)] backdrop-blur-3xl">
      <div className="border-b border-white/10 p-6 md:p-8">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/55">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/40">
          {description}
        </p>
      </div>

      <div className="p-6 md:p-8">
        <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-200 to-yellow-200 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-5 space-y-3">{children}</div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="min-h-14 flex-1 rounded-2xl bg-gradient-to-r from-emerald-200 via-cyan-100 to-yellow-100 px-5 font-black text-[#06251a] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {buttonLabel}
          </button>

          {onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="min-h-14 rounded-2xl border border-red-100/15 bg-red-400/[0.08] px-5 font-black text-red-100"
            >
              Stop safely
            </button>
          ) : null}
        </div>
      </div>
    </article>
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
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/25">{detail}</p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <p className="text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/25">
        {label}
      </p>
      <p className="mt-1 truncate font-black text-white/75">{value}</p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
      <p className="text-[0.54rem] font-black uppercase tracking-[0.12em] text-white/25">
        {label}
      </p>
      <p className={`mt-2 break-all text-xs font-bold leading-5 text-white/58 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SourceCard({
  title,
  description,
  href,
  action,
  status,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-black text-white">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/36">
            {description}
          </p>
        </div>
        <span className="flex-none rounded-full border border-cyan-100/15 bg-cyan-200/[0.06] px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-cyan-50/65">
          {status}
        </span>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          {action}
        </a>
      ) : null}
    </div>
  );
}
