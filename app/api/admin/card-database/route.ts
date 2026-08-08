import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

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

const JUSTTCG_BASE_URL = "https://api.justtcg.com/v1/cards";
const JUSTTCG_DEFAULT_DAILY_LIMIT = 100;
const JUSTTCG_DEFAULT_MIN_INTERVAL_MS = 6500;

type AdminClient = Awaited<
  ReturnType<typeof requireAdmin>
>["admin"];

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
  | "price_batch"
  | "justtcg_unpriced"
  | "pause_prices";

type SyncRequest = {
  action?: unknown;
  runId?: unknown;
  commitSha?: unknown;
  filePath?: unknown;
  remoteSha?: unknown;
  force?: unknown;
  restart?: unknown;
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

type PokemonCardSearchResponse = {
  data?: PokemonApiCard[];
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
  error?: {
    message?: string;
    code?: number;
  };
};

type ExistingPriceRow = {
  api_id?: string | null;
  market_value?: number | string | null;
  price_normal_usd?: number | string | null;
  price_holo_usd?: number | string | null;
  price_reverse_holo_usd?: number | string | null;
  price_cardmarket_eur?: number | string | null;
  price_reverse_holo_eur?: number | string | null;
  market_value_normal_gbp?: number | string | null;
  market_value_holo_gbp?: number | string | null;
  market_value_reverse_holo_gbp?: number | string | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  tcgplayer_url?: string | null;
  tcgplayer_updated_at?: string | null;
  cardmarket_url?: string | null;
  cardmarket_updated_at?: string | null;
};

type JustTcgCandidateRow = {
  card_id?: string | null;
  api_id?: string | null;
  name?: string | null;
  set_name?: string | null;
  card_no?: string | null;
  rarity?: string | null;
};

type JustTcgVariant = {
  id?: string | null;
  uuid?: string | null;
  condition?: string | null;
  printing?: string | null;
  price?: number | string | null;
  lastUpdated?: number | string | null;
};

type JustTcgCard = {
  id?: string | null;
  uuid?: string | null;
  name?: string | null;
  game?: string | null;
  set?: string | null;
  set_name?: string | null;
  number?: string | null;
  rarity?: string | null;
  tcgplayerId?: string | null;
  variants?: JustTcgVariant[] | null;
};

type JustTcgResponse = {
  data?: JustTcgCard[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
  _metadata?: {
    apiPlan?: string;
    apiRequestsRemaining?: number;
  };
  error?: string;
  code?: string;
};

type PricePassRow = {
  price_pass_status?: string | null;
  price_pass_started_at?: string | null;
  price_pass_updated_at?: string | null;
  price_pass_completed_at?: string | null;
  price_pass_total?: number | string | null;
  price_pass_processed?: number | string | null;
  price_pass_priced?: number | string | null;
  price_pass_unpriced?: number | string | null;
  price_pass_failed?: number | string | null;
};

type ApplyPriceRefreshBatchRow = {
  processed_count?: number | string | null;
  priced_count?: number | string | null;
  unpriced_count?: number | string | null;
  failed_count?: number | string | null;
};

type FxRateResponse = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

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

function routeErrorResponse(
  error: unknown,
  fallback: string,
) {
  if (error instanceof HttpError) {
    return jsonError(
      error,
      fallback,
      error.status,
    );
  }

  return adminErrorResponse(
    error instanceof Error
      ? error
      : new Error(
          getErrorMessage(
            error,
            fallback,
          ),
        ),
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

function normaliseLookupText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normaliseCardNumber(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .split("/")[0]
    ?.trim() || "";

  if (!raw) {
    return "";
  }

  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const match = cleaned.match(/^0*(\d+)([a-z]*)$/);
  if (!match) {
    return cleaned;
  }

  return `${Number(match[1])}${match[2] || ""}`;
}

function getJustTcgDailyLimit(): number {
  const configured = Number(process.env.JUSTTCG_DAILY_LIMIT);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.floor(configured));
  }

  return JUSTTCG_DEFAULT_DAILY_LIMIT;
}

function getJustTcgMinIntervalMs(): number {
  const configured = Number(process.env.JUSTTCG_MIN_INTERVAL_MS);

  if (Number.isFinite(configured) && configured >= 500) {
    return Math.floor(configured);
  }

  return JUSTTCG_DEFAULT_MIN_INTERVAL_MS;
}

function chooseJustTcgCard(
  candidate: JustTcgCandidateRow,
  cards: JustTcgCard[],
): JustTcgCard | null {
  const wantedName = normaliseLookupText(candidate.name);
  const wantedSet = normaliseLookupText(candidate.set_name);
  const wantedNumber = normaliseCardNumber(candidate.card_no);
  const wantedRarity = normaliseLookupText(candidate.rarity);

  const ranked = cards
    .map((card) => {
      const cardName = normaliseLookupText(card.name);
      const cardSet = normaliseLookupText(card.set_name);
      const cardNumber = normaliseCardNumber(card.number);
      const cardRarity = normaliseLookupText(card.rarity);

      const nameExact = wantedName.length > 0 && cardName === wantedName;
      const numberExact = wantedNumber.length > 0 && cardNumber === wantedNumber;
      const setExact = wantedSet.length > 0 && cardSet === wantedSet;
      const rarityExact = wantedRarity.length > 0 && cardRarity === wantedRarity;

      let score = 0;
      if (nameExact) score += 100;
      if (numberExact) score += 120;
      if (setExact) score += 160;
      if (rarityExact) score += 18;

      if (!nameExact || !numberExact) {
        score -= 300;
      }

      if (wantedSet && !setExact) {
        score -= 180;
      }

      return { card, score, nameExact, numberExact, setExact };
    })
    .filter((item) => item.nameExact && item.numberExact)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) {
    return null;
  }

  if (wantedSet && !best.setExact) {
    return null;
  }

  return best.card;
}

function chooseJustTcgVariant(card: JustTcgCard): JustTcgVariant | null {
  const variants = Array.isArray(card.variants) ? card.variants : [];

  const priced = variants
    .map((variant) => ({
      variant,
      price: cleanNumber(variant.price),
      condition: normaliseLookupText(variant.condition),
      printing: normaliseLookupText(variant.printing),
    }))
    .filter((item): item is {
      variant: JustTcgVariant;
      price: number;
      condition: string;
      printing: string;
    } => item.price !== null);

  if (priced.length === 0) {
    return null;
  }

  const nearMint = priced.filter((item) =>
    item.condition === "near mint" || item.condition === "nm",
  );
  const pool = nearMint.length > 0 ? nearMint : priced;

  pool.sort((a, b) => {
    const aPreferred = /^(normal|unlimited|holofoil|reverse holofoil)$/.test(a.printing) ? 1 : 0;
    const bPreferred = /^(normal|unlimited|holofoil|reverse holofoil)$/.test(b.printing) ? 1 : 0;

    if (aPreferred !== bPreferred) {
      return bPreferred - aPreferred;
    }

    return a.price - b.price;
  });

  return pool[0]?.variant || null;
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
  admin: AdminClient,
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
  admin: AdminClient,
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
  admin: AdminClient,
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
  admin: AdminClient,
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
  admin: AdminClient,
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

function getPriceBatchSize(
  hasApiKey: boolean,
): number {
  return hasApiKey ? 100 : 25;
}

function buildPriceSearchUrl(
  ids: string[],
): string {
  const safeIds = ids.filter(
    (id) =>
      /^[A-Za-z0-9._-]+$/.test(id),
  );

  if (safeIds.length === 0) {
    throw new HttpError(
      "The due price batch contained no valid API IDs.",
      400,
    );
  }

  const query = safeIds
    .map((id) => `id:"${id}"`)
    .join(" OR ");

  const url = new URL(
    "https://api.pokemontcg.io/v2/cards",
  );

  url.searchParams.set(
    "q",
    `(${query})`,
  );

  url.searchParams.set(
    "page",
    "1",
  );

  url.searchParams.set(
    "pageSize",
    String(safeIds.length),
  );

  url.searchParams.set(
    "select",
    "id,tcgplayer,cardmarket",
  );

  return url.toString();
}

function createMissingPriceUpdate(
  id: string,
) {
  const now =
    new Date().toISOString();

  return {
    api_id: id,
    has_price: false,
    market_value: null,
    price_normal_usd: null,
    price_holo_usd: null,
    price_reverse_holo_usd: null,
    price_cardmarket_eur: null,
    price_reverse_holo_eur: null,
    market_value_normal_gbp: null,
    market_value_holo_gbp: null,
    market_value_reverse_holo_gbp:
      null,
    price_source: null,
    price_updated_at: null,
    price_checked_at: now,
    price_status: "unpriced",
    price_error: null,
    price_retry_after: null,
    tcgplayer_url: null,
    tcgplayer_updated_at: null,
    cardmarket_url: null,
    cardmarket_updated_at: null,
  };
}

async function getPricePass(
  admin: AdminClient,
): Promise<PricePassRow> {
  const {
    data,
    error,
  } = await admin
    .from("card_sync_settings")
    .select(
      [
        "price_pass_status",
        "price_pass_started_at",
        "price_pass_updated_at",
        "price_pass_completed_at",
        "price_pass_total",
        "price_pass_processed",
        "price_pass_priced",
        "price_pass_unpriced",
        "price_pass_failed",
      ].join(","),
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ||
    {}) as PricePassRow;
}

async function ensurePricePass(
  admin: AdminClient,
  dueCount: number,
): Promise<PricePassRow> {
  const current =
    await getPricePass(admin);

  const status =
    typeof current.price_pass_status ===
      "string"
      ? current.price_pass_status
      : "idle";

  const total = Math.max(
    0,
    Number(
      current.price_pass_total,
    ) || 0,
  );

  const processed = Math.max(
    0,
    Number(
      current.price_pass_processed,
    ) || 0,
  );

  const canResume =
    dueCount > 0 &&
    total > 0 &&
    processed < total &&
    (
      status === "running" ||
      status === "paused"
    );

  if (
    dueCount === 0 &&
    total > 0 &&
    processed >= total
  ) {
    return current;
  }

  if (canResume) {
    if (status === "paused") {
      const now =
        new Date().toISOString();

      const { error } =
        await admin
          .from(
            "card_sync_settings",
          )
          .update({
            price_pass_status:
              "running",
            price_pass_updated_at:
              now,
            updated_at: now,
          })
          .eq("id", 1);

      if (error) {
        throw error;
      }
    }

    return {
      ...current,
      price_pass_status:
        "running",
    };
  }

  const now =
    new Date().toISOString();

  const next: PricePassRow = {
    price_pass_status:
      dueCount > 0
        ? "running"
        : "completed",
    price_pass_started_at: now,
    price_pass_updated_at: now,
    price_pass_completed_at:
      dueCount > 0 ? null : now,
    price_pass_total: dueCount,
    price_pass_processed: 0,
    price_pass_priced: 0,
    price_pass_unpriced: 0,
    price_pass_failed: 0,
  };

  const { error } =
    await admin
      .from("card_sync_settings")
      .update({
        ...next,
        updated_at: now,
        ...(dueCount === 0
          ? {
              last_price_sync_at:
                now,
            }
          : {}),
      })
      .eq("id", 1);

  if (error) {
    throw error;
  }

  return next;
}

async function completePricePass(
  admin: AdminClient,
) {
  const now =
    new Date().toISOString();

  const { error } =
    await admin
      .from("card_sync_settings")
      .update({
        price_pass_status:
          "completed",
        price_pass_updated_at:
          now,
        price_pass_completed_at:
          now,
        last_price_sync_at: now,
        updated_at: now,
      })
      .eq("id", 1);

  if (error) {
    throw error;
  }
}

async function pausePricePass(
  admin: AdminClient,
) {
  const now =
    new Date().toISOString();

  const { error } =
    await admin
      .from("card_sync_settings")
      .update({
        price_pass_status:
          "paused",
        price_pass_updated_at:
          now,
        updated_at: now,
      })
      .eq("id", 1);

  if (error) {
    throw error;
  }

  return getPricePass(admin);
}

async function getDuePriceCount(
  admin: AdminClient,
): Promise<number> {
  const {
    data,
    error,
  } = await admin.rpc(
    "get_due_price_card_count",
  );

  if (error) {
    throw error;
  }

  const value =
    Array.isArray(data)
      ? data[0]
      : data;

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    return Math.max(
      0,
      Number(
        record
          .get_due_price_card_count ??
          Object.values(record)[0],
      ) || 0,
    );
  }

  return Math.max(
    0,
    Number(value) || 0,
  );
}

async function getAllPriceCardCount(
  admin: AdminClient,
): Promise<number> {
  const { count, error } = await admin
    .from("pokemon_cards")
    .select("id", {
      count: "exact",
      head: true,
    })
    .not("api_id", "is", null)
    .neq("api_id", "");

  if (error) {
    throw error;
  }

  return Math.max(0, count || 0);
}

async function resetPricePass(
  admin: AdminClient,
  total: number,
) {
  const now = new Date().toISOString();

  const { error } = await admin
    .from("card_sync_settings")
    .update({
      price_pass_status: total > 0 ? "running" : "completed",
      price_pass_started_at: now,
      price_pass_updated_at: now,
      price_pass_completed_at: total > 0 ? null : now,
      price_pass_total: total,
      price_pass_processed: 0,
      price_pass_priced: 0,
      price_pass_unpriced: 0,
      price_pass_failed: 0,
      updated_at: now,
    })
    .eq("id", 1);

  if (error) {
    throw error;
  }
}

async function getExistingPriceRows(
  admin: AdminClient,
  ids: string[],
): Promise<Map<string, ExistingPriceRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await admin
    .from("pokemon_cards")
    .select([
      "api_id",
      "market_value",
      "price_normal_usd",
      "price_holo_usd",
      "price_reverse_holo_usd",
      "price_cardmarket_eur",
      "price_reverse_holo_eur",
      "market_value_normal_gbp",
      "market_value_holo_gbp",
      "market_value_reverse_holo_gbp",
      "price_source",
      "price_updated_at",
      "tcgplayer_url",
      "tcgplayer_updated_at",
      "cardmarket_url",
      "cardmarket_updated_at",
    ].join(","))
    .in("api_id", ids);

  if (error) {
    throw error;
  }

  const map = new Map<string, ExistingPriceRow>();

  for (const row of (data || []) as ExistingPriceRow[]) {
    const id = typeof row.api_id === "string" ? row.api_id.trim() : "";
    if (id && !map.has(id)) {
      map.set(id, row);
    }
  }

  return map;
}

function preserveExistingPriceUpdate(
  apiId: string,
  existing: ExistingPriceRow | undefined,
) {
  const marketValue = cleanNumber(existing?.market_value);

  if (marketValue === null) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    api_id: apiId,
    has_price: true,
    market_value: marketValue,
    price_normal_usd: cleanNumber(existing?.price_normal_usd),
    price_holo_usd: cleanNumber(existing?.price_holo_usd),
    price_reverse_holo_usd: cleanNumber(existing?.price_reverse_holo_usd),
    price_cardmarket_eur: cleanNumber(existing?.price_cardmarket_eur),
    price_reverse_holo_eur: cleanNumber(existing?.price_reverse_holo_eur),
    market_value_normal_gbp: cleanNumber(existing?.market_value_normal_gbp),
    market_value_holo_gbp: cleanNumber(existing?.market_value_holo_gbp),
    market_value_reverse_holo_gbp: cleanNumber(existing?.market_value_reverse_holo_gbp),
    price_source: existing?.price_source || "Stored fallback",
    price_updated_at: existing?.price_updated_at || now,
    price_checked_at: now,
    price_status: "priced",
    price_error: null,
    price_retry_after: null,
    tcgplayer_url: existing?.tcgplayer_url || null,
    tcgplayer_updated_at: existing?.tcgplayer_updated_at || null,
    cardmarket_url: existing?.cardmarket_url || null,
    cardmarket_updated_at: existing?.cardmarket_updated_at || null,
  };
}

async function getJustTcgUnpricedCount(
  admin: AdminClient,
): Promise<number> {
  const { data, error } = await admin.rpc("get_unpriced_justtcg_count");

  if (error) {
    throw error;
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (typeof raw === "object" && raw !== null) {
    const values = Object.values(raw as Record<string, unknown>);
    return Math.max(0, Number(values[0]) || 0);
  }

  return Math.max(0, Number(raw) || 0);
}

async function getJustTcgRequestsToday(
  admin: AdminClient,
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from("pokemon_cards")
    .select("id", {
      count: "exact",
      head: true,
    })
    .gte("justtcg_checked_at", start.toISOString());

  if (error) {
    throw error;
  }

  return Math.max(0, count || 0);
}

function buildJustTcgSearchUrl(candidate: JustTcgCandidateRow): string {
  const url = new URL(JUSTTCG_BASE_URL);
  url.searchParams.set("game", "pokemon");
  url.searchParams.set("q", String(candidate.name || "").trim());

  const cardNumber = String(candidate.card_no || "").trim();
  if (cardNumber) {
    url.searchParams.set("number", cardNumber);
  }

  url.searchParams.set("condition", "NM");
  url.searchParams.set("limit", "20");
  url.searchParams.set("include_price_history", "false");
  url.searchParams.set("include_statistics", "false");
  return url.toString();
}

async function processJustTcgUnpriced(
  admin: AdminClient,
) {
  const apiKey = process.env.JUSTTCG_API_KEY?.trim();
  const dailyLimit = getJustTcgDailyLimit();
  const minIntervalMs = getJustTcgMinIntervalMs();

  if (!apiKey) {
    return {
      processed: 0,
      priced: 0,
      remaining: await getJustTcgUnpricedCount(admin),
      done: true,
      available: false,
      dailyUsed: await getJustTcgRequestsToday(admin),
      dailyLimit,
      minIntervalMs,
      plan: null,
      apiRequestsRemaining: null,
      message: "JUSTTCG_API_KEY is not configured on the server.",
    };
  }

  const dailyUsedBefore = await getJustTcgRequestsToday(admin);
  if (dailyUsedBefore >= dailyLimit) {
    return {
      processed: 0,
      priced: 0,
      remaining: await getJustTcgUnpricedCount(admin),
      done: true,
      available: true,
      dailyUsed: dailyUsedBefore,
      dailyLimit,
      minIntervalMs,
      plan: null,
      apiRequestsRemaining: null,
      rateLimited: true,
      message: `JustTCG daily safety limit reached (${dailyUsedBefore}/${dailyLimit}).`,
    };
  }

  const { data: candidateData, error: candidateError } = await admin.rpc(
    "get_unpriced_justtcg_candidates",
    { p_limit: 1 },
  );

  if (candidateError) {
    throw candidateError;
  }

  const candidate = Array.isArray(candidateData)
    ? (candidateData[0] as JustTcgCandidateRow | undefined)
    : (candidateData as JustTcgCandidateRow | null | undefined);

  if (!candidate?.card_id || !candidate.name) {
    return {
      processed: 0,
      priced: 0,
      remaining: 0,
      done: true,
      available: true,
      dailyUsed: dailyUsedBefore,
      dailyLimit,
      minIntervalMs,
      plan: null,
      apiRequestsRemaining: null,
      message: "No unpriced cards are currently due for JustTCG fallback.",
    };
  }

  const response = await fetch(buildJustTcgSearchUrl(candidate), {
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });

  const rawText = await response.text();
  let body: JustTcgResponse | null = null;

  try {
    body = JSON.parse(rawText) as JustTcgResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body?.error ||
      rawText.trim() ||
      `JustTCG returned HTTP ${response.status}.`;

    if (response.status === 429 || body?.code === "DAILY_LIMIT_EXCEEDED" || body?.code === "REQUEST_LIMIT_EXCEEDED") {
      return {
        processed: 0,
        priced: 0,
        remaining: await getJustTcgUnpricedCount(admin),
        done: true,
        available: true,
        dailyUsed: dailyUsedBefore,
        dailyLimit,
        minIntervalMs,
        plan: body?._metadata?.apiPlan || null,
        apiRequestsRemaining: body?._metadata?.apiRequestsRemaining ?? null,
        rateLimited: true,
        message,
      };
    }

    throw new HttpError(`JustTCG: ${message}`, response.status || 502);
  }

  const cards = Array.isArray(body?.data) ? body!.data! : [];
  const matched = chooseJustTcgCard(candidate, cards);
  const variant = matched ? chooseJustTcgVariant(matched) : null;
  const usdPrice = variant ? cleanNumber(variant.price) : null;
  const now = new Date().toISOString();

  let priced = 0;
  let resultMessage = "No exact JustTCG match was found.";

  if (matched && usdPrice !== null) {
    const rates = await getRates(admin);
    const gbpPrice = convert(usdPrice, rates.usdToGbp);

    if (gbpPrice !== null) {
      const { error: updateError } = await admin
        .from("pokemon_cards")
        .update({
          market_value: gbpPrice,
          price_source: "JustTCG",
          price_updated_at: now,
          price_status: "priced",
          price_error: null,
          price_retry_after: null,
          justtcg_checked_at: now,
          justtcg_price_usd: usdPrice,
          justtcg_card_id: matched.id || matched.uuid || null,
          justtcg_variant_id: variant?.id || variant?.uuid || null,
          justtcg_error: null,
        })
        .eq("id", candidate.card_id);

      if (updateError) {
        throw updateError;
      }

      priced = 1;
      resultMessage = `${candidate.name} priced from JustTCG.`;
    }
  } else {
    const detail = matched
      ? "Exact card matched, but no usable Near Mint raw price was returned."
      : "No exact name + collector number + set match was returned.";

    const { error: missError } = await admin
      .from("pokemon_cards")
      .update({
        justtcg_checked_at: now,
        justtcg_error: detail,
      })
      .eq("id", candidate.card_id);

    if (missError) {
      throw missError;
    }

    resultMessage = detail;
  }

  const [remaining, dailyUsedAfter] = await Promise.all([
    getJustTcgUnpricedCount(admin),
    getJustTcgRequestsToday(admin),
  ]);

  return {
    processed: 1,
    priced,
    remaining,
    done: remaining === 0 || dailyUsedAfter >= dailyLimit,
    available: true,
    dailyUsed: dailyUsedAfter,
    dailyLimit,
    minIntervalMs,
    plan: body?._metadata?.apiPlan || null,
    apiRequestsRemaining: body?._metadata?.apiRequestsRemaining ?? null,
    cardName: candidate.name,
    message: resultMessage,
  };
}

async function processPriceBatch(
  admin: AdminClient,
  options: { force: boolean; restart: boolean },
) {
  const apiKey =
    process.env.POKEMON_TCG_API_KEY;

  const hasApiKey =
    Boolean(apiKey);

  const batchSize =
    getPriceBatchSize(
      hasApiKey,
    );

  const force = options.force;
  const restart = options.restart;

  const eligibleBefore = force
    ? await getAllPriceCardCount(admin)
    : await getDuePriceCount(admin);

  if (restart) {
    await resetPricePass(admin, eligibleBefore);
  } else {
    await ensurePricePass(admin, eligibleBefore);
  }

  const passBefore = await getPricePass(admin);
  const passTotal = Math.max(0, Number(passBefore.price_pass_total) || 0);
  const passProcessed = Math.max(0, Number(passBefore.price_pass_processed) || 0);

  if (
    eligibleBefore === 0 ||
    (force && !restart && passTotal > 0 && passProcessed >= passTotal)
  ) {
    await completePricePass(admin);

    return {
      processed: 0,
      priced: 0,
      unpriced: 0,
      failed: 0,
      remaining: 0,
      done: true,
      hasPokemonApiKey: hasApiKey,
      batchSize,
      pricePass: await getPricePass(admin),
    };
  }

  const {
    data: dueRows,
    error: dueError,
  } = await admin.rpc(
    "get_due_price_card_ids",
    {
      p_limit: batchSize,
      p_force: force,
    },
  );

  if (dueError) {
    throw dueError;
  }

  const ids: string[] =
    Array.from(
      new Set<string>(
        (
          (dueRows ||
            []) as Array<{
            api_id?: unknown;
          }>
        )
          .map((row) =>
            typeof row.api_id ===
              "string"
              ? row.api_id.trim()
              : "",
          )
          .filter(
            (id): id is string =>
              id.length > 0,
          ),
      ),
    );

  if (ids.length === 0) {
    await completePricePass(
      admin,
    );

    return {
      processed: 0,
      priced: 0,
      unpriced: 0,
      failed: 0,
      remaining: 0,
      done: true,
      hasPokemonApiKey:
        hasApiKey,
      batchSize,
      pricePass:
        await getPricePass(
          admin,
        ),
    };
  }

  const rates =
    await getRates(admin);

  const headers:
    Record<string, string> = {
      Accept: "application/json",
    };

  if (apiKey) {
    headers["X-Api-Key"] =
      apiKey;
  }

  const response =
    await fetchWithRetry(
      buildPriceSearchUrl(ids),
      {
        headers,
      },
      4,
    );

  const rawText =
    await response.text();

  let body:
    | PokemonCardSearchResponse
    | null = null;

  try {
    body =
      JSON.parse(
        rawText,
      ) as PokemonCardSearchResponse;
  } catch {
    body = null;
  }

  if (
    !response.ok ||
    !Array.isArray(body?.data)
  ) {
    throw new Error(
      body?.error?.message ||
        rawText.trim() ||
        `Pokemon TCG API returned ${response.status} for a ${ids.length}-card price batch.`,
    );
  }

  const cardsById =
    new Map<string, PokemonApiCard>();

  for (const card of body.data) {
    if (
      typeof card.id === "string" &&
      card.id.trim()
    ) {
      cardsById.set(
        card.id.trim(),
        card,
      );
    }
  }

  const existingById = await getExistingPriceRows(admin, ids);

  const updates =
    ids.map((id) => {
      const card = cardsById.get(id);
      const existing = existingById.get(id);

      if (!card) {
        return (
          preserveExistingPriceUpdate(id, existing) ||
          createMissingPriceUpdate(id)
        );
      }

      const {
        hasPrice,
        ...priceUpdate
      } = mapPriceUpdate(
        card,
        rates.usdToGbp,
        rates.eurToGbp,
      );

      if (!hasPrice) {
        const preserved = preserveExistingPriceUpdate(id, existing);
        if (preserved) {
          return preserved;
        }
      }

      return {
        api_id: id,
        has_price: hasPrice,
        ...priceUpdate,
      };
    });

  const {
    data: applyData,
    error: applyError,
  } = await admin.rpc(
    "apply_price_refresh_batch",
    {
      p_updates: updates,
    },
  );

  if (applyError) {
    throw applyError;
  }

  const rawApplyRow =
    Array.isArray(applyData)
      ? applyData[0]
      : applyData;

  const applyRow:
    | ApplyPriceRefreshBatchRow
    | null =
    typeof rawApplyRow === "object" &&
    rawApplyRow !== null
      ? (
          rawApplyRow as
            ApplyPriceRefreshBatchRow
        )
      : null;

  const processed =
    Math.max(
      0,
      Number(
        applyRow?.processed_count,
      ) || 0,
    );

  const priced =
    Math.max(
      0,
      Number(
        applyRow?.priced_count,
      ) || 0,
    );

  const unpriced =
    Math.max(
      0,
      Number(
        applyRow?.unpriced_count,
      ) || 0,
    );

  const failed =
    Math.max(
      0,
      Number(
        applyRow?.failed_count,
      ) || 0,
    );

  let pricePass = await getPricePass(admin);

  const remaining = force
    ? Math.max(
        0,
        (Number(pricePass.price_pass_total) || 0) -
          (Number(pricePass.price_pass_processed) || 0),
      )
    : await getDuePriceCount(admin);

  const done = remaining === 0;

  if (done) {
    await completePricePass(admin);
    pricePass = await getPricePass(admin);
  }

  return {
    processed,
    priced,
    unpriced,
    failed,
    remaining,
    done,
    hasPokemonApiKey: hasApiKey,
    batchSize,
    rates,
    pricePass,
  };
}

export async function GET(request: Request) {
  try {
    const {
      admin,
    } = await requireAdmin(request);

    const [
      statsResult,
      runResult,
      fileResult,
      settingsResult,
    ] = await Promise.all([
      admin.rpc(
        "get_card_database_tracker_stats",
      ),

      admin
        .from("card_sync_runs")
        .select(
          "id,mode,status,current_page,total_pages,cards_received,cards_inserted,cards_updated,cards_skipped,error_message,started_at,completed_at",
        )
        .order("started_at", {
          ascending: false,
        })
        .limit(12),

      admin
        .from("card_sync_files")
        .select(
          "file_path,remote_sha,source_commit_sha,card_count,inserted_count,updated_count,skipped_count,last_error,last_synced_at",
        )
        .eq("source", SOURCE_NAME)
        .order("last_synced_at", {
          ascending: false,
        })
        .limit(12),

      admin
        .from(
          "card_sync_settings",
        )
        .select(
          [
            "price_pass_status",
            "price_pass_started_at",
            "price_pass_updated_at",
            "price_pass_completed_at",
            "price_pass_total",
            "price_pass_processed",
            "price_pass_priced",
            "price_pass_unpriced",
            "price_pass_failed",
          ].join(","),
        )
        .eq("id", 1)
        .maybeSingle(),
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

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    const [justTcgRemaining, justTcgRequestsToday] = await Promise.all([
      getJustTcgUnpricedCount(admin).catch(() => 0),
      getJustTcgRequestsToday(admin).catch(() => 0),
    ]);

    return NextResponse.json({
      stats:
        Array.isArray(
          statsResult.data,
        )
          ? statsResult.data[0] ||
            null
          : statsResult.data,

      pricePass:
        settingsResult.data ||
        null,

      runs:
        runResult.data || [],

      recentFiles:
        fileResult.data || [],

      hasPokemonApiKey:
        Boolean(
          process.env
            .POKEMON_TCG_API_KEY,
        ),

      hasJustTcgApiKey:
        Boolean(
          process.env
            .JUSTTCG_API_KEY,
        ),

      justTcgRemaining,
      justTcgRequestsToday,
      justTcgDailyLimit: getJustTcgDailyLimit(),
      justTcgMinIntervalMs: getJustTcgMinIntervalMs(),

      priceBatchSize:
        getPriceBatchSize(
          Boolean(
            process.env
              .POKEMON_TCG_API_KEY,
          ),
        ),

      hasGithubToken:
        Boolean(
          process.env.GITHUB_TOKEN,
        ),

      localPath:
        LOCAL_ROOT,

      sourceRepository:
        `https://github.com/${REPOSITORY}`,

      pkmnCardsReference:
        "https://pkmncards.com/",
    });
  } catch (error: unknown) {
    return routeErrorResponse(
      error,
      "Card database status could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      admin,
      user,
    } = await requireAdmin(
      request,
    );

    const body =
      (await request.json()) as SyncRequest;

    const action =
      body.action as SyncAction;

    switch (action) {
      case "prepare_local":
        return NextResponse.json(
          await prepareLocalSync(
            admin,
            user.id,
          ),
        );

      case "sync_local_file":
        return NextResponse.json(
          await syncLocalFile(
            admin,
            body,
          ),
        );

      case "complete_local":
        return NextResponse.json(
          await completeLocalSync(
            admin,
            body,
          ),
        );

      case "price_batch":
        return NextResponse.json(
          await processPriceBatch(
            admin,
            {
              force: body.force === true,
              restart: body.restart === true,
            },
          ),
        );

      case "justtcg_unpriced":
        return NextResponse.json(
          await processJustTcgUnpriced(admin),
        );

      case "pause_prices":
        return NextResponse.json({
          pricePass:
            await pausePricePass(
              admin,
            ),
        });

      default:
        throw new HttpError(
          "Unknown card database action.",
          400,
        );
    }
  } catch (error: unknown) {
    return routeErrorResponse(
      error,
      "The card database action failed.",
    );
  }
}
