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
import { adminFetch } from "@/lib/admin/client-auth";

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

type PricePass = {
  price_pass_status: string | null;
  price_pass_started_at: string | null;
  price_pass_updated_at: string | null;
  price_pass_completed_at: string | null;
  price_pass_total: number | string | null;
  price_pass_processed: number | string | null;
  price_pass_priced: number | string | null;
  price_pass_unpriced: number | string | null;
  price_pass_failed: number | string | null;
};

type StatusResponse = {
  stats: TrackerStats | null;
  pricePass: PricePass | null;
  priceBatchSize: number;
  runs: SyncRun[];
  recentFiles: TrackedFile[];
  hasPokemonApiKey: boolean;
  hasJustTcgApiKey: boolean;
  justTcgRemaining: number;
  justTcgRequestsToday: number;
  justTcgDailyLimit: number;
  justTcgMinIntervalMs: number;
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
  batchSize: number;
  pricePass: PricePass;
  error?: string;
};

type JustTcgResponse = {
  processed: number;
  priced: number;
  remaining: number;
  done: boolean;
  available: boolean;
  dailyUsed: number;
  dailyLimit: number;
  minIntervalMs: number;
  plan: string | null;
  apiRequestsRemaining: number | null;
  rateLimited?: boolean;
  cardName?: string;
  message?: string;
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
  status: string;
  total: number;
  processed: number;
  priced: number;
  unpriced: number;
  failed: number;
  remaining: number;
  startedAt: string | null;
  updatedAt: string | null;
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
  status: "idle",
  total: 0,
  processed: 0,
  priced: 0,
  unpriced: 0,
  failed: 0,
  remaining: 0,
  startedAt: null,
  updatedAt: null,
};


const PRICE_RETRY_BASE_DELAY_MS = 1500;
const PRICE_RETRY_MAX_DELAY_MS = 30000;

function getPriceRetryDelay(
  consecutiveFailures: number,
): number {
  const exponent = Math.max(
    0,
    Math.min(
      consecutiveFailures - 1,
      5,
    ),
  );

  return Math.min(
    PRICE_RETRY_MAX_DELAY_MS,
    PRICE_RETRY_BASE_DELAY_MS *
      2 ** exponent,
  );
}

function isPermanentPriceError(
  error: unknown,
): boolean {
  const message = getErrorMessage(
    error,
    "",
  )
    .trim()
    .toLowerCase();

  if (!message) {
    return false;
  }

  return [
    "admin session",
    "sign in again",
    "not authorised",
    "not authorized",
    "unauthorised",
    "unauthorized",
    "forbidden",
    "permission denied",
    "row-level security",
    "missing server environment",
    "missing environment",
    "unknown card database action",
    "invalid api key",
    "api key is invalid",
    "does not exist",
    "schema cache",
  ].some((fragment) =>
    message.includes(fragment),
  );
}

async function waitForRetry(
  milliseconds: number,
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

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

function normalisePricePass(
  pass: PricePass | null | undefined,
  fallbackRemaining = 0,
): PriceProgress {
  const total = Math.max(
    0,
    toNumber(pass?.price_pass_total),
  );

  const processed = Math.min(
    total || Number.MAX_SAFE_INTEGER,
    Math.max(
      0,
      toNumber(
        pass?.price_pass_processed,
      ),
    ),
  );

  return {
    status:
      pass?.price_pass_status ||
      "idle",
    total,
    processed,
    priced: Math.max(
      0,
      toNumber(
        pass?.price_pass_priced,
      ),
    ),
    unpriced: Math.max(
      0,
      toNumber(
        pass?.price_pass_unpriced,
      ),
    ),
    failed: Math.max(
      0,
      toNumber(
        pass?.price_pass_failed,
      ),
    ),
    remaining: Math.max(
      0,
      total > 0
        ? total - processed
        : fallbackRemaining,
    ),
    startedAt:
      pass?.price_pass_started_at ||
      null,
    updatedAt:
      pass?.price_pass_updated_at ||
      null,
  };
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
  const [hasJustTcgApiKey, setHasJustTcgApiKey] = useState(false);
  const [justTcgRemaining, setJustTcgRemaining] = useState(0);
  const [justTcgRequestsToday, setJustTcgRequestsToday] = useState(0);
  const [justTcgDailyLimit, setJustTcgDailyLimit] = useState(100);
  const [justTcgMinIntervalMs, setJustTcgMinIntervalMs] = useState(6500);
  const [priceBatchSize, setPriceBatchSize] = useState(25);
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
  const [
    priceRetryStatus,
    setPriceRetryStatus,
  ] = useState<string | null>(
    null,
  );

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

  const postAction = useCallback(
    async <T,>(
      body: Record<string, unknown>,
    ): Promise<T> => {
      return adminFetch<T>(
        "/api/admin/card-database",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    [],
  );

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);

    try {
      const body =
        await adminFetch<StatusResponse>(
          "/api/admin/card-database",
        );

      setStats(body.stats);
      setRuns(body.runs || []);
      setRecentFiles(
        body.recentFiles || [],
      );
      setHasPokemonApiKey(
        body.hasPokemonApiKey,
      );
      setHasJustTcgApiKey(Boolean(body.hasJustTcgApiKey));
      setJustTcgRemaining(Math.max(0, toNumber(body.justTcgRemaining)));
      setJustTcgRequestsToday(Math.max(0, toNumber(body.justTcgRequestsToday)));
      setJustTcgDailyLimit(Math.max(1, toNumber(body.justTcgDailyLimit) || 100));
      setJustTcgMinIntervalMs(Math.max(500, toNumber(body.justTcgMinIntervalMs) || 6500));
      setPriceBatchSize(
        Math.max(
          1,
          toNumber(
            body.priceBatchSize,
          ) || 25,
        ),
      );
      setHasGithubToken(
        body.hasGithubToken,
      );
      setLocalPath(
        body.localPath || "",
      );
      setSourceRepository(
        body.sourceRepository || "",
      );
      setPkmnCardsReference(
        body.pkmnCardsReference || "",
      );

      setPriceProgress(
        normalisePricePass(
          body.pricePass,
          toNumber(
            body.stats
              ?.due_price_cards,
          ),
        ),
      );
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
  }, []);

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
    if (
      syncingLocal ||
      syncingPrices
    ) {
      return;
    }

    stopPricesRef.current = false;
    setSyncingPrices(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPriceRetryStatus(null);

    try {
      let aggregate = priceProgress;
      let consecutiveFailures = 0;
      let pokemonCompleted = false;

      const resumeExistingPass =
        (priceProgress.status === "paused" ||
          priceProgress.status === "running") &&
        priceProgress.remaining > 0;

      let restartPass = !resumeExistingPass;

      addLog(
        resumeExistingPass
          ? `Resuming the saved full market refresh at ${formatNumber(
              aggregate.processed,
            )}/${formatNumber(aggregate.total)}.`
          : hasPokemonApiKey
            ? `Starting a fresh full market refresh in ${formatNumber(
                priceBatchSize,
              )}-card Pokemon TCG API batches.`
            : `Starting a fresh full market refresh in ${formatNumber(
                priceBatchSize,
              )}-card public Pokemon TCG API batches.`,
      );

      addLog(
        "This refresh can be run again whenever you want. Existing JustTCG/manual fallback values are preserved if Pokemon TCG has no price.",
      );

      while (!stopPricesRef.current) {
        let result: PriceResponse;

        try {
          result = await postAction<PriceResponse>({
            action: "price_batch",
            force: true,
            restart: restartPass,
          });

          restartPass = false;
          consecutiveFailures = 0;
          setPriceRetryStatus(null);
          setErrorMessage(null);
        } catch (batchError: unknown) {
          const message = getErrorMessage(
            batchError,
            "The market price request failed.",
          );

          if (isPermanentPriceError(batchError)) {
            throw new Error(message);
          }

          consecutiveFailures += 1;
          const waitMs = getPriceRetryDelay(consecutiveFailures);
          const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
          const retryMessage =
            `Temporary market request failure. Retrying automatically in ${waitSeconds}s ` +
            `(attempt ${consecutiveFailures}).`;

          setPriceRetryStatus(retryMessage);
          setErrorMessage(null);
          addLog(`RETRY: ${message}`);
          addLog(retryMessage);
          await waitForRetry(waitMs);
          continue;
        }

        setHasPokemonApiKey(result.hasPokemonApiKey);
        setPriceBatchSize(Math.max(1, result.batchSize || 1));

        aggregate = {
          ...normalisePricePass(result.pricePass, result.remaining),
          remaining: result.remaining,
        };

        setPriceProgress(aggregate);

        addLog(
          `Pokemon batch: ${result.processed} checked; ` +
            `${result.priced} currently priced, ${result.unpriced} still without a source value; ` +
            `${formatNumber(aggregate.processed)}/${formatNumber(aggregate.total)} saved.`,
        );

        if (result.done || result.processed === 0) {
          pokemonCompleted = true;
          addLog("Pokemon TCG price pass complete. Starting fallback only for cards that still have no market value.");
          break;
        }

        await waitForRetry(result.hasPokemonApiKey ? 120 : 2200);
      }

      if (stopPricesRef.current && !pokemonCompleted) {
        setPriceRetryStatus(null);

        const paused = await postAction<{ pricePass: PricePass }>({
          action: "pause_prices",
        });

        aggregate = normalisePricePass(paused.pricePass, aggregate.remaining);
        setPriceProgress(aggregate);
        setSuccessMessage(
          `Price refresh paused at ${formatNumber(aggregate.processed)}/${formatNumber(
            aggregate.total,
          )}. The next run resumes from this saved point.`,
        );
        addLog(
          `Paused safely at ${formatNumber(aggregate.processed)} completed cards.`,
        );
      } else if (pokemonCompleted && !stopPricesRef.current) {
        if (!hasJustTcgApiKey) {
          addLog("JustTCG fallback skipped because JUSTTCG_API_KEY is not configured on the server.");
        } else {
          addLog(
            "JustTCG fallback started. Only genuinely unpriced cards are queried; already-priced cards are never sent to JustTCG.",
          );

          let fallbackProcessed = 0;
          let fallbackPriced = 0;
          let fallbackRemaining = justTcgRemaining;
          let fallbackDailyUsed = justTcgRequestsToday;

          while (!stopPricesRef.current) {
            const fallback = await postAction<JustTcgResponse>({
              action: "justtcg_unpriced",
            });

            setHasJustTcgApiKey(fallback.available);
            setJustTcgRemaining(Math.max(0, fallback.remaining));
            setJustTcgRequestsToday(Math.max(0, fallback.dailyUsed));
            setJustTcgDailyLimit(Math.max(1, fallback.dailyLimit || justTcgDailyLimit));
            setJustTcgMinIntervalMs(
              Math.max(500, fallback.minIntervalMs || justTcgMinIntervalMs),
            );

            fallbackProcessed += Math.max(0, fallback.processed || 0);
            fallbackPriced += Math.max(0, fallback.priced || 0);
            fallbackRemaining = Math.max(0, fallback.remaining || 0);
            fallbackDailyUsed = Math.max(0, fallback.dailyUsed || 0);

            if (fallback.message) {
              addLog(
                `JustTCG: ${fallback.message} ` +
                  `(${fallbackDailyUsed}/${fallback.dailyLimit} requests today)`,
              );
            }

            if (fallback.rateLimited) {
              setSuccessMessage(
                `Pokemon TCG refresh completed. JustTCG paused at its current API limit after pricing ${formatNumber(
                  fallbackPriced,
                )} additional cards. ${formatNumber(fallbackRemaining)} unpriced cards remain for a later pass.`,
              );
              break;
            }

            if (fallback.done || fallback.processed === 0) {
              setSuccessMessage(
                fallbackRemaining === 0
                  ? `Market refresh completed. JustTCG filled ${formatNumber(
                      fallbackPriced,
                    )} additional missing prices.`
                  : `Pokemon TCG refresh completed. JustTCG checked ${formatNumber(
                      fallbackProcessed,
                    )} missing cards and filled ${formatNumber(
                      fallbackPriced,
                    )}. ${formatNumber(fallbackRemaining)} remain for a later fallback pass.`,
              );
              break;
            }

            await waitForRetry(
              Math.max(500, fallback.minIntervalMs || justTcgMinIntervalMs),
            );
          }

          if (stopPricesRef.current) {
            setSuccessMessage(
              `Pokemon TCG refresh completed. JustTCG fallback stopped with ${formatNumber(
                fallbackRemaining,
              )} unpriced cards remaining.`,
            );
          }
        }

        if (!hasJustTcgApiKey) {
          setSuccessMessage(
            `Pokemon TCG refresh completed. ${formatNumber(
              aggregate.unpriced,
            )} cards still have no Pokemon TCG/Cardmarket source value.`,
          );
        }
      }

      await loadStatus();
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "The tracked price refresh failed.",
      );

      setPriceRetryStatus(null);
      setErrorMessage(message);
      addLog(`ERROR: ${message}`);
    } finally {
      setPriceRetryStatus(null);
      setSyncingPrices(false);
    }
  }, [
    syncingLocal,
    syncingPrices,
    priceProgress,
    hasPokemonApiKey,
    hasJustTcgApiKey,
    justTcgRemaining,
    justTcgRequestsToday,
    justTcgDailyLimit,
    justTcgMinIntervalMs,
    priceBatchSize,
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

  const priceTotal =
    Math.max(
      priceProgress.total,
      priceProgress.processed +
        priceProgress.remaining,
      toNumber(
        stats?.due_price_cards,
      ),
    );

  const pricePercent =
    priceTotal > 0
      ? Math.min(
          100,
          (
            priceProgress.processed /
            priceTotal
          ) * 100,
        )
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
            eyebrow="Market value refresh"
            title="Refresh prices whenever you want"
            description="Pokemon TCG is checked first in fast batches. Cards that still have no market value then fall back to JustTCG one at a time, so the secondary API is only spent on unresolved cards. Stored manual and JustTCG prices are preserved when Pokemon TCG has no replacement value."
            buttonLabel={
              syncingPrices
                ? priceRetryStatus
                  ? "Retrying automatically..."
                  : `Refreshing ${formatNumber(
                      priceProgress.processed,
                    )}/${formatNumber(
                      priceProgress.total,
                    )}...`
                : (priceProgress.status === "paused" ||
                    priceProgress.status === "running") &&
                    priceProgress.remaining > 0
                  ? `Resume at ${formatNumber(
                      priceProgress.processed,
                    )}/${formatNumber(
                      priceProgress.total,
                    )}`
                  : "Refresh market values"
            }
            disabled={
              syncingLocal ||
              syncingPrices
            }
            onStart={() =>
              void refreshDuePrices()
            }
            onStop={
              syncingPrices
                ? () => {
                    stopPricesRef.current =
                      true;
                  }
                : undefined
            }
            progress={pricePercent}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat
                label="Saved progress"
                value={`${formatNumber(
                  priceProgress.processed,
                )}/${formatNumber(
                  priceTotal,
                )}`}
              />
              <MiniStat
                label="Priced"
                value={formatNumber(
                  priceProgress.priced,
                )}
              />
              <MiniStat
                label="No price"
                value={formatNumber(
                  priceProgress.unpriced,
                )}
              />
              <MiniStat
                label="Remaining"
                value={formatNumber(
                  priceProgress.remaining ||
                    stats?.due_price_cards,
                )}
              />
            </div>

            <InfoBox
              label="Automatic retry"
              value={
                priceRetryStatus ||
                (
                  syncingPrices
                    ? "Active - temporary failures retry without another click"
                    : "Ready - temporary failures will retry automatically"
                )
              }
            />

            <InfoBox
              label="Pokemon API mode"
              value={
                hasPokemonApiKey
                  ? `API key active - ${formatNumber(
                      priceBatchSize,
                    )} cards per API request`
                  : `Public mode - ${formatNumber(
                      priceBatchSize,
                    )} cards per API request with safe spacing`
              }
            />

            <InfoBox
              label="JustTCG fallback"
              value={
                hasJustTcgApiKey
                  ? `${formatNumber(justTcgRemaining)} unresolved cards due · ${formatNumber(
                      justTcgRequestsToday,
                    )}/${formatNumber(justTcgDailyLimit)} requests used today`
                  : "Not configured - unresolved cards stay manual"
              }
            />

            <InfoBox
              label="Fallback policy"
              value="Only cards with no current market value are sent to JustTCG. Exact name + collector number + set must match before a price is accepted."
            />

            <InfoBox
              label="Saved pass state"
              value={`${priceProgress.status} · started ${formatDateTime(
                priceProgress.startedAt,
              )} · saved ${formatDateTime(
                priceProgress.updatedAt,
              )}`}
            />

            <InfoBox
              label="Last completed price pass"
              value={formatDateTime(
                stats?.last_price_sync_at,
              )}
            />

            <InfoBox
              label="Exchange rates"
              value={`USD ${toNumber(
                stats?.usd_to_gbp,
              ).toFixed(4)} · EUR ${toNumber(
                stats?.eur_to_gbp,
              ).toFixed(4)} · ${
                stats?.fx_date ||
                "not loaded"
              }`}
            />
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
                description="Kept as a manual visual reference only. Its own About page states that its database is unavailable for download and it provides no API, so ancientpulls does not scrape or mirror it."
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
