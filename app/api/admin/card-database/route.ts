import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SOURCE_NAME = "pokemon-tcg-data";
const REPOSITORY = "PokemonTCG/pokemon-tcg-data";
const REPOSITORY_BRANCH = "master";
const SETS_FILE_PATH = "sets/en.json";
const CARD_FILE_PATTERN = /^cards\/en\/[A-Za-z0-9._-]+\.json$/;
const LOCAL_ROOT = path.join(
  process.cwd(),
  ".pocketpulls-data",
  "pokemon-tcg-data",
);

class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

type SyncAction =
  | "prepare_local"
  | "sync_local_file"
  | "complete_local"
  | "price_batch";

type SyncRequest = {
  action?: unknown;
  runId?: unknown;
  commitSha?: unknown;
  filePath?: unknown;
  remoteSha?: unknown;
};

type GithubCommitResponse = {
  sha?: string;
};

type GithubTreeEntry = {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
};

type GithubTreeResponse = {
  sha?: string;
  url?: string;
  truncated?: boolean;
  tree?: GithubTreeEntry[];
};

type SourceFile = {
  path: string;
  sha: string;
  size: number;
};

type LocalSet = {
  id?: string;
  name?: string;
  series?: string;
  releaseDate?: string;
  updatedAt?: string;
};

type LocalCard = {
  id?: string;
  name?: string;
  supertype?: string;
  subtypes?: string[];
  number?: string;
  artist?: string;
  rarity?: string;
  nationalPokedexNumbers?: number[];
  images?: {
    small?: string;
    large?: string;
  };
};

type PokemonPrice = {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
};

type PokemonApiCard = LocalCard & {
  set?: LocalSet;
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      normal?: PokemonPrice;
      holofoil?: PokemonPrice;
      reverseHolofoil?: PokemonPrice;
      "1stEditionHolofoil"?: PokemonPrice;
      unlimitedHolofoil?: PokemonPrice;
    };
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
      reverseHoloSell?: number | null;
      reverseHoloLow?: number | null;
      reverseHoloTrend?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
      reverseHoloAvg1?: number | null;
      reverseHoloAvg7?: number | null;
      reverseHoloAvg30?: number | null;
    };
  };
};

type PokemonCardResponse = {
  data?: PokemonApiCard;
  error?: {
    message?: string;
    code?: number;
  };
};

type FxRateResponse = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireUser(
  request: Request,
  admin: ReturnType<typeof getAdminClient>,
) {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new HttpError("Missing authentication token.", 401);
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user) {
    console.warn(
      "Card database authentication rejected:",
      error?.message || "No authenticated user returned.",
    );

    throw new HttpError(
      "Your admin session expired or became invalid.",
      401,
    );
  }

  const allowedEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedEmails.length > 0 &&
    !allowedEmails.includes((user.email || "").toLowerCase())
  ) {
    throw new HttpError(
      "This account is not allowed to run database syncs.",
      403,
    );
  }

  return user;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function jsonError(
  error: unknown,
  fallback: string,
  status = 500,
) {
  return NextResponse.json(
    {
      error: getErrorMessage(error, fallback),
    },
    {
      status: error instanceof HttpError ? error.status : status,
    },
  );
}

function cleanNumber(value: unknown): number | null {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Math.round(number * 10000) / 10000;
}

function firstPositive(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    const cleaned = cleanNumber(value);

    if (cleaned !== null) {
      return cleaned;
    }
  }

  return null;
}

function convert(value: unknown, rate: number): number | null {
  const number = cleanNumber(value);

  if (number === null) {
    return null;
  }

  return Math.round(number * rate * 100) / 100;
}

function parseDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value.replace(/\//g, "-"));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalised = value
    .replace(/\//g, "-")
    .replace(" ", "T");

  const date = new Date(
    normalised.endsWith("Z") ? normalised : `${normalised}Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function gitBlobSha(value: Buffer): string {
  const header = Buffer.from(`blob ${value.length}\0`, "utf8");

  return createHash("sha1")
    .update(Buffer.concat([header, value]))
    .digest("hex");
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PocketPulls-Card-Database",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 5,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
      });

      if (
        response.ok ||
        ![429, 500, 502, 503, 504].includes(response.status)
      ) {
        return response;
      }

      const retryAfter = Number(
        response.headers.get("retry-after"),
      );

      const waitMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(15000, 800 * 2 ** (attempt - 1));

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch (error: unknown) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(15000, 800 * 2 ** (attempt - 1)),
          ),
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The remote source did not respond.");
}

function isAllowedSourceFile(filePath: string): boolean {
  return filePath === SETS_FILE_PATH || CARD_FILE_PATTERN.test(filePath);
}

function resolveLocalPath(filePath: string): string {
  if (!isAllowedSourceFile(filePath)) {
    throw new HttpError("That source file path is not allowed.", 400);
  }

  const destination = path.resolve(LOCAL_ROOT, filePath);
  const rootWithSeparator = `${path.resolve(LOCAL_ROOT)}${path.sep}`;

  if (!destination.startsWith(rootWithSeparator)) {
    throw new HttpError("Unsafe local database path rejected.", 400);
  }

  return destination;
}

async function localFileExists(filePath: string): Promise<boolean> {
  try {
    await access(resolveLocalPath(filePath));
    return true;
  } catch {
    return false;
  }
}

async function getLatestSourceState(): Promise<{
  commitSha: string;
  files: SourceFile[];
}> {
  const commitResponse = await fetchWithRetry(
    `https://api.github.com/repos/${REPOSITORY}/commits/${REPOSITORY_BRANCH}`,
    {
      headers: githubHeaders(),
    },
  );

  if (!commitResponse.ok) {
    throw new Error(
      `GitHub commit request failed with ${commitResponse.status}.`,
    );
  }

  const commit = (await commitResponse.json()) as GithubCommitResponse;
  const commitSha = commit.sha?.trim();

  if (!commitSha) {
    throw new Error("GitHub did not return a source commit SHA.");
  }

  const treeResponse = await fetchWithRetry(
    `https://api.github.com/repos/${REPOSITORY}/git/trees/${commitSha}?recursive=1`,
    {
      headers: githubHeaders(),
    },
  );

  if (!treeResponse.ok) {
    throw new Error(
      `GitHub tree request failed with ${treeResponse.status}.`,
    );
  }

  const tree = (await treeResponse.json()) as GithubTreeResponse;

  if (tree.truncated) {
    throw new Error(
      "GitHub returned a truncated repository tree. Add GITHUB_TOKEN and retry.",
    );
  }

  const files = (tree.tree || [])
    .filter(
      (entry) =>
        entry.type === "blob" &&
        typeof entry.path === "string" &&
        typeof entry.sha === "string" &&
        isAllowedSourceFile(entry.path),
    )
    .map((entry) => ({
      path: entry.path as string,
      sha: entry.sha as string,
      size: Math.max(0, Number(entry.size) || 0),
    }))
    .sort((first, second) => {
      if (first.path === SETS_FILE_PATH) {
        return -1;
      }

      if (second.path === SETS_FILE_PATH) {
        return 1;
      }

      return first.path.localeCompare(second.path);
    });

  if (files.length < 2) {
    throw new Error("The downloadable card repository looked incomplete.");
  }

  return {
    commitSha,
    files,
  };
}

async function downloadSourceFile(
  commitSha: string,
  sourceFile: SourceFile,
): Promise<Buffer> {
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) {
    throw new HttpError("Invalid source commit SHA.", 400);
  }

  const response = await fetchWithRetry(
    `https://raw.githubusercontent.com/${REPOSITORY}/${commitSha}/${sourceFile.path}`,
    {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "PocketPulls-Card-Database",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `${sourceFile.path} download failed with ${response.status}.`,
    );
  }

  const content = Buffer.from(await response.arrayBuffer());
  const calculatedGitSha = gitBlobSha(content);

  if (calculatedGitSha !== sourceFile.sha) {
    throw new Error(
      `${sourceFile.path} failed Git blob verification.`,
    );
  }

  const destination = resolveLocalPath(sourceFile.path);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);

  return content;
}

async function readLocalSets(): Promise<Map<string, LocalSet>> {
  const content = await readFile(resolveLocalPath(SETS_FILE_PATH), "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("The local sets database is invalid.");
  }

  const map = new Map<string, LocalSet>();

  for (const item of parsed as LocalSet[]) {
    if (typeof item.id === "string" && item.id.trim()) {
      map.set(item.id, item);
    }
  }

  return map;
}

function mapLocalCard(
  card: LocalCard,
  set: LocalSet | undefined,
  sourceFilePath: string,
) {
  const storedRecord = {
    api_id: card.id || null,
    name: card.name || "Unknown card",
    rarity: card.rarity || null,
    set_name: set?.name || null,
    card_no: card.number || null,
    image_url: card.images?.small || null,
    image_url_large: card.images?.large || null,
    set_id: set?.id || null,
    set_series: set?.series || null,
    set_release_date: parseDate(set?.releaseDate),
    source_updated_at: parseTimestamp(set?.updatedAt),
    supertype: card.supertype || null,
    subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],
    artist: card.artist || null,
    national_pokedex_numbers: Array.isArray(
      card.nationalPokedexNumbers,
    )
      ? card.nationalPokedexNumbers
      : null,
  };

  return {
    ...storedRecord,
    source_record_hash: sha256(JSON.stringify(storedRecord)),
    source_file_path: sourceFilePath,
  };
}

async function updateRunProgress(
  admin: ReturnType<typeof getAdminClient>,
  runId: string,
  counts: {
    received: number;
    inserted: number;
    updated: number;
    skipped: number;
  },
) {
  const { data, error } = await admin
    .from("card_sync_runs")
    .select(
      "current_page,cards_received,cards_inserted,cards_updated,cards_skipped",
    )
    .eq("id", runId)
    .single();

  if (error) {
    throw error;
  }

  const existingSkipped = Math.max(
    0,
    Number(data.cards_skipped) || 0,
  );

  const updatePayload: Record<string, unknown> = {
    current_page: Math.max(0, Number(data.current_page) || 0) + 1,
    cards_received:
      Math.max(0, Number(data.cards_received) || 0) + counts.received,
    cards_inserted:
      Math.max(0, Number(data.cards_inserted) || 0) + counts.inserted,
    cards_updated:
      Math.max(0, Number(data.cards_updated) || 0) + counts.updated,
  };

  updatePayload.cards_skipped = existingSkipped + counts.skipped;

  const { error: updateError } = await admin
    .from("card_sync_runs")
    .update(updatePayload)
    .eq("id", runId);

  if (updateError) {
    throw updateError;
  }
}

async function fetchFxRate(
  base: "USD" | "EUR",
): Promise<{ rate: number; date: string }> {
  const response = await fetchWithRetry(
    `https://api.frankfurter.dev/v2/rate/${base}/GBP?providers=ECB`,
    {
      headers: {
        Accept: "application/json",
      },
    },
    4,
  );

  if (!response.ok) {
    throw new Error(
      `GBP exchange-rate request failed with ${response.status}.`,
    );
  }

  const body = (await response.json()) as FxRateResponse;
  const rate = cleanNumber(body.rate);

  if (rate === null || !body.date) {
    throw new Error(
      `The ${base}/GBP exchange-rate response was incomplete.`,
    );
  }

  return {
    rate,
    date: body.date,
  };
}

async function getRates(
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ usdToGbp: number; eurToGbp: number; date: string }> {
  const { data: stored, error: storedError } = await admin
    .from("card_sync_settings")
    .select("usd_to_gbp,eur_to_gbp,fx_date")
    .eq("id", 1)
    .maybeSingle();

  if (storedError) {
    throw storedError;
  }

  const today = new Date().toISOString().slice(0, 10);
  const storedUsd = cleanNumber(stored?.usd_to_gbp);
  const storedEur = cleanNumber(stored?.eur_to_gbp);

  if (
    stored?.fx_date === today &&
    storedUsd !== null &&
    storedEur !== null
  ) {
    return {
      usdToGbp: storedUsd,
      eurToGbp: storedEur,
      date: today,
    };
  }

  const [usdResult, eurResult] = await Promise.allSettled([
    fetchFxRate("USD"),
    fetchFxRate("EUR"),
  ]);

  if (
    usdResult.status === "fulfilled" &&
    eurResult.status === "fulfilled"
  ) {
    const date =
      usdResult.value.date < eurResult.value.date
        ? usdResult.value.date
        : eurResult.value.date;

    const { error } = await admin
      .from("card_sync_settings")
      .update({
        usd_to_gbp: usdResult.value.rate,
        eur_to_gbp: eurResult.value.rate,
        fx_date: date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      throw error;
    }

    return {
      usdToGbp: usdResult.value.rate,
      eurToGbp: eurResult.value.rate,
      date,
    };
  }

  if (storedUsd !== null && storedEur !== null) {
    return {
      usdToGbp: storedUsd,
      eurToGbp: storedEur,
      date:
        typeof stored?.fx_date === "string"
          ? stored.fx_date
          : today,
    };
  }

  throw new Error(
    "GBP exchange rates could not be loaded and no stored fallback exists.",
  );
}

function mapPriceUpdate(
  card: PokemonApiCard,
  usdToGbp: number,
  eurToGbp: number,
) {
  const tcg = card.tcgplayer?.prices;
  const market = card.cardmarket?.prices;

  const normalUsd = firstPositive(
    tcg?.normal?.market,
    tcg?.normal?.mid,
  );

  const holoUsd = firstPositive(
    tcg?.holofoil?.market,
    tcg?.holofoil?.mid,
    tcg?.["1stEditionHolofoil"]?.market,
    tcg?.unlimitedHolofoil?.market,
  );

  const reverseUsd = firstPositive(
    tcg?.reverseHolofoil?.market,
    tcg?.reverseHolofoil?.mid,
  );

  const cardmarketMainEur = firstPositive(
    market?.trendPrice,
    market?.averageSellPrice,
    market?.avg7,
    market?.avg30,
    market?.lowPrice,
  );

  const cardmarketReverseEur = firstPositive(
    market?.reverseHoloTrend,
    market?.reverseHoloSell,
    market?.reverseHoloAvg7,
    market?.reverseHoloAvg30,
    market?.reverseHoloLow,
  );

  const normalGbp = firstPositive(
    convert(normalUsd, usdToGbp),
    holoUsd === null
      ? convert(cardmarketMainEur, eurToGbp)
      : null,
  );

  const holoGbp = firstPositive(
    convert(holoUsd, usdToGbp),
    normalUsd === null
      ? convert(cardmarketMainEur, eurToGbp)
      : null,
  );

  const reverseGbp = firstPositive(
    convert(cardmarketReverseEur, eurToGbp),
    convert(reverseUsd, usdToGbp),
  );

  const genericGbp = firstPositive(
    convert(cardmarketMainEur, eurToGbp),
    normalGbp,
    holoGbp,
    reverseGbp,
  );

  const sources: string[] = [];

  if (normalUsd !== null || holoUsd !== null || reverseUsd !== null) {
    sources.push("TCGplayer");
  }

  if (
    cardmarketMainEur !== null ||
    cardmarketReverseEur !== null
  ) {
    sources.push("Cardmarket");
  }

  const hasPrice = genericGbp !== null;
  const now = new Date().toISOString();

  return {
    hasPrice,
    market_value: genericGbp,
    price_normal_usd: normalUsd,
    price_holo_usd: holoUsd,
    price_reverse_holo_usd: reverseUsd,
    price_cardmarket_eur: cardmarketMainEur,
    price_reverse_holo_eur: cardmarketReverseEur,
    market_value_normal_gbp: normalGbp,
    market_value_holo_gbp: holoGbp,
    market_value_reverse_holo_gbp: reverseGbp,
    price_source: sources.length > 0 ? sources.join(" + ") : null,
    price_updated_at: hasPrice ? now : null,
    price_checked_at: now,
    price_status: hasPrice ? "priced" : "unpriced",
    price_error: null,
    price_retry_after: null,
    tcgplayer_url: card.tcgplayer?.url || null,
    tcgplayer_updated_at: parseDate(card.tcgplayer?.updatedAt),
    cardmarket_url: card.cardmarket?.url || null,
    cardmarket_updated_at: parseDate(card.cardmarket?.updatedAt),
  };
}

async function prepareLocalSync(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
) {
  const source = await getLatestSourceState();

  const { data: trackedRows, error: trackedError } = await admin
    .from("card_sync_files")
    .select("file_path,remote_sha")
    .eq("source", SOURCE_NAME);

  if (trackedError) {
    throw trackedError;
  }

  const tracked = new Map<string, string>();

  for (const row of trackedRows || []) {
    if (
      typeof row.file_path === "string" &&
      typeof row.remote_sha === "string"
    ) {
      tracked.set(row.file_path, row.remote_sha);
    }
  }

  const changedFiles: SourceFile[] = [];
  const setsSource = source.files.find(
    (file) => file.path === SETS_FILE_PATH,
  );
  const setsSameSha = setsSource
    ? tracked.get(SETS_FILE_PATH) === setsSource.sha
    : false;
  const setsExistsLocally = setsSameSha
    ? await localFileExists(SETS_FILE_PATH)
    : false;
  const setsChanged = !setsSameSha || !setsExistsLocally;

  for (const file of source.files) {
    const sameSha = tracked.get(file.path) === file.sha;
    const existsLocally = sameSha
      ? await localFileExists(file.path)
      : false;
    const mustRecalculateCards =
      setsChanged && CARD_FILE_PATTERN.test(file.path);

    if (!sameSha || !existsLocally || mustRecalculateCards) {
      changedFiles.push(file);
    }
  }

  const completeImmediately = changedFiles.length === 0;

  const { data: run, error: runError } = await admin
    .from("card_sync_runs")
    .insert({
      started_by: userId,
      mode: "local",
      status: completeImmediately ? "completed" : "running",
      current_page: 0,
      total_pages: changedFiles.length,
      cards_received: 0,
      cards_inserted: 0,
      cards_updated: 0,
      completed_at: completeImmediately
        ? new Date().toISOString()
        : null,
    })
    .select("id")
    .single();

  if (runError) {
    throw runError;
  }

  const now = new Date().toISOString();
  const settingsPayload: Record<string, unknown> = {
    last_local_check_at: now,
    local_source_path: LOCAL_ROOT,
    local_source_file_count: source.files.length,
    updated_at: now,
  };

  if (completeImmediately) {
    settingsPayload.local_source_commit_sha = source.commitSha;
    settingsPayload.last_local_sync_at = now;
  }

  const { error: settingsError } = await admin
    .from("card_sync_settings")
    .update(settingsPayload)
    .eq("id", 1);

  if (settingsError) {
    throw settingsError;
  }

  return {
    runId: run.id as string,
    commitSha: source.commitSha,
    files: changedFiles,
    totalFiles: source.files.length,
    changedFiles: changedFiles.length,
    unchangedFiles: source.files.length - changedFiles.length,
    completeImmediately,
    localPath: LOCAL_ROOT,
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
  };
}

async function syncLocalFile(
  admin: ReturnType<typeof getAdminClient>,
  body: SyncRequest,
) {
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const commitSha =
    typeof body.commitSha === "string" ? body.commitSha.trim() : "";
  const filePath =
    typeof body.filePath === "string" ? body.filePath.trim() : "";
  const remoteSha =
    typeof body.remoteSha === "string" ? body.remoteSha.trim() : "";

  if (!runId || !commitSha || !filePath || !remoteSha) {
    throw new HttpError("The local sync file request was incomplete.", 400);
  }

  if (!isAllowedSourceFile(filePath)) {
    throw new HttpError("That local source file is not allowed.", 400);
  }

  const sourceFile: SourceFile = {
    path: filePath,
    sha: remoteSha,
    size: 0,
  };

  const content = await downloadSourceFile(commitSha, sourceFile);
  const text = content.toString("utf8");
  const parsed = JSON.parse(text) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} did not contain a JSON array.`);
  }

  const localHash = sha256(content);
  let received = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  if (filePath !== SETS_FILE_PATH) {
    const sets = await readLocalSets();
    const setId = path.basename(filePath, ".json");
    const set = sets.get(setId);
    const cards = (parsed as LocalCard[])
      .filter(
        (card) =>
          typeof card.id === "string" &&
          card.id.trim().length > 0,
      )
      .map((card) => mapLocalCard(card, set, filePath));

    const chunkSize = 200;

    for (let index = 0; index < cards.length; index += chunkSize) {
      const chunk = cards.slice(index, index + chunkSize);

      const { data, error } = await admin.rpc(
        "merge_local_pokemon_card_batch",
        {
          p_cards: chunk,
          p_source_file_path: filePath,
          p_source_commit_sha: commitSha,
        },
      );

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      received += Math.max(0, Number(row?.received_count) || 0);
      inserted += Math.max(0, Number(row?.inserted_count) || 0);
      updated += Math.max(0, Number(row?.updated_count) || 0);
      skipped += Math.max(0, Number(row?.skipped_count) || 0);
    }
  }

  const { error: fileError } = await admin
    .from("card_sync_files")
    .upsert(
      {
        source: SOURCE_NAME,
        file_path: filePath,
        remote_sha: remoteSha,
        local_sha256: localHash,
        source_commit_sha: commitSha,
        card_count: received,
        inserted_count: inserted,
        updated_count: updated,
        skipped_count: skipped,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      },
      {
        onConflict: "source,file_path",
      },
    );

  if (fileError) {
    throw fileError;
  }

  await updateRunProgress(admin, runId, {
    received,
    inserted,
    updated,
    skipped,
  });

  return {
    runId,
    filePath,
    received,
    inserted,
    updated,
    skipped,
    localHash,
  };
}

async function completeLocalSync(
  admin: ReturnType<typeof getAdminClient>,
  body: SyncRequest,
) {
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const commitSha =
    typeof body.commitSha === "string" ? body.commitSha.trim() : "";

  if (!runId || !commitSha) {
    throw new HttpError("The local sync completion was incomplete.", 400);
  }

  const now = new Date().toISOString();

  const { error: runError } = await admin
    .from("card_sync_runs")
    .update({
      status: "completed",
      completed_at: now,
      error_message: null,
    })
    .eq("id", runId);

  if (runError) {
    throw runError;
  }

  const { count: fileCount, error: fileCountError } = await admin
    .from("card_sync_files")
    .select("file_path", {
      count: "exact",
      head: true,
    })
    .eq("source", SOURCE_NAME);

  if (fileCountError) {
    throw fileCountError;
  }

  const { error: settingsError } = await admin
    .from("card_sync_settings")
    .update({
      local_source_commit_sha: commitSha,
      local_source_path: LOCAL_ROOT,
      local_source_file_count: Math.max(0, fileCount || 0),
      last_local_sync_at: now,
      last_local_check_at: now,
      updated_at: now,
    })
    .eq("id", 1);

  if (settingsError) {
    throw settingsError;
  }

  return {
    runId,
    commitSha,
    completedAt: now,
    localPath: LOCAL_ROOT,
  };
}

async function processPriceBatch(
  admin: ReturnType<typeof getAdminClient>,
) {
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  const batchSize = apiKey ? 12 : 1;

  const { data: dueRows, error: dueError } = await admin.rpc(
    "get_due_price_card_ids",
    {
      p_limit: batchSize,
      p_force: false,
    },
  );

  if (dueError) {
    throw dueError;
  }

  const ids = (dueRows || [])
    .map((row: { api_id?: unknown }) =>
      typeof row.api_id === "string" ? row.api_id.trim() : "",
    )
    .filter(Boolean);

  if (ids.length === 0) {
    const now = new Date().toISOString();

    await admin
      .from("card_sync_settings")
      .update({
        last_price_sync_at: now,
        updated_at: now,
      })
      .eq("id", 1);

    return {
      processed: 0,
      priced: 0,
      unpriced: 0,
      failed: 0,
      remaining: 0,
      done: true,
      hasPokemonApiKey: Boolean(apiKey),
    };
  }

  const rates = await getRates(admin);
  let priced = 0;
  let unpriced = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (apiKey) {
        headers["X-Api-Key"] = apiKey;
      }

      const response = await fetchWithRetry(
        `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`,
        {
          headers,
        },
        4,
      );

      const body = (await response.json()) as PokemonCardResponse;

      if (!response.ok || !body.data) {
        throw new Error(
          body.error?.message ||
            `Pokemon TCG API returned ${response.status} for ${id}.`,
        );
      }

      const update = mapPriceUpdate(
        body.data,
        rates.usdToGbp,
        rates.eurToGbp,
      );

      const {
        hasPrice,
        ...pricePayload
      } = update;

      const updatePayload: Record<string, unknown> = {
        price_checked_at: pricePayload.price_checked_at,
        price_status: pricePayload.price_status,
        price_error: null,
        price_retry_after: null,
        tcgplayer_url: pricePayload.tcgplayer_url,
        tcgplayer_updated_at:
          pricePayload.tcgplayer_updated_at,
        cardmarket_url: pricePayload.cardmarket_url,
        cardmarket_updated_at:
          pricePayload.cardmarket_updated_at,
      };

      if (hasPrice) {
        Object.assign(updatePayload, pricePayload);
      }

      const { error: updateError } = await admin
        .from("pokemon_cards")
        .update(updatePayload)
        .eq("api_id", id);

      if (updateError) {
        throw updateError;
      }

      if (hasPrice) {
        priced += 1;
      } else {
        unpriced += 1;
      }
    } catch (error: unknown) {
      failed += 1;

      const checkedAt = new Date();
      const retryAt = new Date(checkedAt.getTime() + 60 * 60 * 1000);

      await admin
        .from("pokemon_cards")
        .update({
          price_checked_at: checkedAt.toISOString(),
          price_status: "failed",
          price_error: getErrorMessage(
            error,
            "Price request failed.",
          ).slice(0, 500),
          price_retry_after: retryAt.toISOString(),
        })
        .eq("api_id", id);
    }

    if (!apiKey) {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }
  }

  const { data: statsData, error: statsError } = await admin.rpc(
    "get_card_database_tracker_stats",
  );

  if (statsError) {
    throw statsError;
  }

  const stats = Array.isArray(statsData) ? statsData[0] : statsData;
  const remaining = Math.max(0, Number(stats?.due_price_cards) || 0);
  const done = remaining === 0;
  const now = new Date().toISOString();

  const settingsUpdate: Record<string, unknown> = {
    updated_at: now,
  };

  if (done) {
    settingsUpdate.last_price_sync_at = now;
  }

  const { error: settingsError } = await admin
    .from("card_sync_settings")
    .update(settingsUpdate)
    .eq("id", 1);

  if (settingsError) {
    throw settingsError;
  }

  return {
    processed: ids.length,
    priced,
    unpriced,
    failed,
    remaining,
    done,
    hasPokemonApiKey: Boolean(apiKey),
    rates,
  };
}

export async function GET(request: Request) {
  try {
    const admin = getAdminClient();
    await requireUser(request, admin);

    const [statsResult, runResult, fileResult] = await Promise.all([
      admin.rpc("get_card_database_tracker_stats"),
      admin
        .from("card_sync_runs")
        .select(
          "id,mode,status,current_page,total_pages,cards_received,cards_inserted,cards_updated,cards_skipped,error_message,started_at,completed_at",
        )
        .order("started_at", { ascending: false })
        .limit(12),
      admin
        .from("card_sync_files")
        .select(
          "file_path,remote_sha,source_commit_sha,card_count,inserted_count,updated_count,skipped_count,last_error,last_synced_at",
        )
        .eq("source", SOURCE_NAME)
        .order("last_synced_at", { ascending: false })
        .limit(12),
    ]);

    if (statsResult.error) {
      throw statsResult.error;
    }

    if (runResult.error) {
      throw runResult.error;
    }

    if (fileResult.error) {
      throw fileResult.error;
    }

    return NextResponse.json({
      stats: Array.isArray(statsResult.data)
        ? statsResult.data[0] || null
        : statsResult.data,
      runs: runResult.data || [],
      recentFiles: fileResult.data || [],
      hasPokemonApiKey: Boolean(process.env.POKEMON_TCG_API_KEY),
      hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
      localPath: LOCAL_ROOT,
      sourceRepository: `https://github.com/${REPOSITORY}`,
      pkmnCardsReference: "https://pkmncards.com/",
    });
  } catch (error: unknown) {
    return jsonError(
      error,
      "Card database status could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = getAdminClient();
    const user = await requireUser(request, admin);
    const body = (await request.json()) as SyncRequest;
    const action = body.action as SyncAction;

    switch (action) {
      case "prepare_local":
        return NextResponse.json(
          await prepareLocalSync(admin, user.id),
        );

      case "sync_local_file":
        return NextResponse.json(
          await syncLocalFile(admin, body),
        );

      case "complete_local":
        return NextResponse.json(
          await completeLocalSync(admin, body),
        );

      case "price_batch":
        return NextResponse.json(
          await processPriceBatch(admin),
        );

      default:
        throw new HttpError("Unknown card database action.", 400);
    }
  } catch (error: unknown) {
    return jsonError(
      error,
      "The card database action failed.",
    );
  }
}
