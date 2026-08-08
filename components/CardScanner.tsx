"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import {
  averageFrameFingerprints,
  captureFrameFingerprint,
  changedPixelFraction,
  compareVisionSignatures,
  cornerJitter,
  createVisionSignature,
  detectCardGeometry,
  frameFingerprintDifference,
  measureCardQuality,
  rectifyCard,
  type CardGeometry,
  type CardQuality,
  type FrameFingerprint,
  type ScannerSourceCrop,
} from "@/lib/scanner/card-vision";

export type ScannerPokemonCard = {
  id: string;
  name: string;
  rarity: string | null;
  set_name: string | null;
  set_id: string | null;
  set_printed_total: number | string | null;
  card_no: string | null;
  hp: number | string | null;
  image_url: string | null;
  image_url_large: string | null;
  market_value: number | string | null;
  api_id: string | null;
  supertype: string | null;
  subtypes: string[] | null;
};

export type ScannerAutoAddResult = {
  message: string;
};

type CardScannerProps = {
  disabled?: boolean;
  resetKey?: number;
  onSelect: (card: ScannerPokemonCard) => void;
  onAutoAdd?: (card: ScannerPokemonCard) => Promise<ScannerAutoAddResult>;
  autoIntakeLabel?: string;
};

type ScannerCandidate = {
  card: ScannerPokemonCard;
  confidence: number;
  textConfidence: number;
  visualConfidence: number | null;
  collectorScore: number;
  nameScore: number;
  setScore: number;
  hpScore: number;
  hardRejected: boolean;
  hardRejectReasons: string[];
  evidenceCount: number;
  visualBreakdown?: {
    structure: number;
    edge: number;
    dhash: number;
    colour: number;
    histogram: number;
  };
  reasons: string[];
};

type ScannerState =
  | "idle"
  | "camera"
  | "captured"
  | "reading"
  | "matching"
  | "results"
  | "error";

type AutoPhase =
  | "off"
  | "calibrating"
  | "ready"
  | "settling"
  | "processing"
  | "remove";

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence?: number } }>;
  setParameters: (parameters: Record<string, unknown>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type PsmValues = {
  SPARSE_TEXT: string | number;
  SINGLE_BLOCK: string | number;
  SINGLE_LINE: string | number;
};

type NameHypothesis = {
  raw: string;
  corrected: string;
  score: number;
  margin: number;
};

type CollectorFraction = {
  numerator: string;
  denominator: number | null;
  raw: string;
};

type ExtractedScan = {
  fullText: string;
  topText: string;
  bottomText: string;
  hpText: string;
  names: string[];
  collectorNumbers: string[];
  collectorFractions: CollectorFraction[];
  hpValues: number[];
  setCodes: string[];
  printedTotals: number[];
  nameHypotheses: NameHypothesis[];
  fieldConfidence: {
    name: number;
    hp: number;
    collector: number;
  };
  geometryConfidence: number | null;
  quality: CardQuality | null;
};


type ScannerMetadataResponse = {
  ok: true;
  cards: Array<{
    id: string;
    hp: number | null;
    setPrintedTotal: number | null;
    setId: string | null;
    setName: string | null;
    imageUrlLarge: string | null;
  }>;
};

type ScannerSetMetadata = {
  setId: string;
  setName: string;
  ptcgoCode: string | null;
  printedTotal: number | null;
  total: number | null;
};

type ReviewItem = {
  id: string;
  preview: string;
  scan: ExtractedScan;
  candidates: ScannerCandidate[];
};

type RecentAutoAdd = {
  id: string;
  card: ScannerPokemonCard;
  message: string;
};

type FrameSignature = FrameFingerprint;
type SourceCrop = ScannerSourceCrop;

const CARD_ASPECT_RATIO = 63 / 88;
const AUTO_SAMPLE_MS = 180;
const AUTO_CALIBRATION_FRAMES = 7;
const AUTO_MIN_PRESENCE_THRESHOLD = 2.0;
const AUTO_MAX_PRESENCE_THRESHOLD = 8.0;
const AUTO_STABLE_FRAMES = 4;
const AUTO_REMOVAL_FRAMES = 3;
const AUTO_MIN_CHANGED_FRACTION = 0.10;
const AUTO_GEOMETRY_CONFIDENCE = 0.47;
const SCANNER_VERSION = "40.0-research";

const CARD_SELECT = `
  id,
  name,
  rarity,
  set_name,
  set_id,
  set_printed_total,
  card_no,
  hp,
  image_url,
  image_url_large,
  market_value,
  api_id,
  supertype,
  subtypes
`;

const IGNORED_NAME_WORDS = new Set([
  "ability",
  "basic",
  "bench",
  "card",
  "damage",
  "energy",
  "evolves",
  "from",
  "heal",
  "item",
  "pokemon",
  "pokémon",
  "resistance",
  "retreat",
  "rule",
  "stage",
  "trainer",
  "weakness",
]);

const NAME_SUFFIXES = new Set([
  "ex",
  "gx",
  "v",
  "vmax",
  "vstar",
  "break",
  "lvx",
  "prime",
]);

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | string | null): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(toNumber(value));
}

async function scannerAdminFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your admin session expired. Sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T | { error?: { message?: string } };
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message;
    throw new Error(message || "Scanner metadata request failed.");
  }
  return payload as T;
}

function cleanSearchValue(value: string): string {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


async function scannerAdminBlobFetch(url: string, body: unknown): Promise<Blob | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let finished = false;
    const finish = (value: HTMLImageElement | null) => {
      if (finished) return;
      finished = true;
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 3000);
    image.onload = () => {
      window.clearTimeout(timer);
      finish(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    image.src = url;
  });
}

function normaliseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normaliseWords(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normaliseCollector(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]*)(\d+)([A-Z]*)$/);

  if (!match) {
    return compact;
  }

  return `${match[1]}${String(Number(match[2]))}${match[3]}`;
}

function levenshteinDistance(first: string, second: string): number {
  if (first === second) return 0;
  if (!first.length) return second.length;
  if (!second.length) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const insertion = current[secondIndex - 1] + 1;
      const deletion = previous[secondIndex] + 1;
      const substitution =
        previous[secondIndex - 1] +
        (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1);

      current[secondIndex] = Math.min(insertion, deletion, substitution);
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[second.length];
}

function basicSimilarity(first: string, second: string): number {
  const a = normaliseText(first);
  const b = normaliseText(second);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const longest = Math.max(a.length, b.length);
  return Math.max(0, 1 - levenshteinDistance(a, b) / longest);
}

function nameCore(value: string): string {
  const words = normaliseWords(value);

  while (words.length > 1 && NAME_SUFFIXES.has(words.at(-1) || "")) {
    words.pop();
  }

  return words.join("");
}

function pokemonIdentityCore(value: string): string {
  const words = normaliseWords(value);
  while (words.length > 1 && NAME_SUFFIXES.has(words.at(-1) || "")) words.pop();
  if (words.length > 1 && (words[0] === "mega" || words[0] === "m")) words.shift();
  return words.join("");
}

function bigramSimilarity(first: string, second: string): number {
  const a = normaliseText(first);
  const b = normaliseText(second);

  if (a.length < 2 || b.length < 2) {
    return basicSimilarity(a, b);
  }

  const grams = (value: string) => {
    const output: string[] = [];
    for (let index = 0; index < value.length - 1; index += 1) {
      output.push(value.slice(index, index + 2));
    }
    return output;
  };

  const firstGrams = grams(a);
  const secondGrams = [...grams(b)];
  let matches = 0;

  for (const gram of firstGrams) {
    const index = secondGrams.indexOf(gram);
    if (index >= 0) {
      matches += 1;
      secondGrams.splice(index, 1);
    }
  }

  return (2 * matches) / (firstGrams.length + grams(b).length);
}

function jaroWinklerSimilarity(first: string, second: string): number {
  const a = normaliseText(first);
  const b = normaliseText(second);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = Array.from({ length: a.length }, () => false);
  const bMatches = Array.from({ length: b.length }, () => false);
  let matches = 0;

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (!matches) return 0;

  const aSequence: string[] = [];
  const bSequence: string[] = [];
  for (let i = 0; i < a.length; i += 1) if (aMatches[i]) aSequence.push(a[i]);
  for (let i = 0; i < b.length; i += 1) if (bMatches[i]) bSequence.push(b[i]);

  let transpositions = 0;
  for (let i = 0; i < Math.min(aSequence.length, bSequence.length); i += 1) {
    if (aSequence[i] !== bSequence[i]) transpositions += 1;
  }
  transpositions /= 2;

  const jaro = (
    matches / a.length +
    matches / b.length +
    (matches - transpositions) / matches
  ) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i += 1) {
    if (a[i] !== b[i]) break;
    prefix += 1;
  }

  return Math.min(1, jaro + prefix * 0.1 * (1 - jaro));
}

function pokemonNameSimilarity(first: string, second: string): number {
  const full = basicSimilarity(first, second);
  const coreFirst = nameCore(first);
  const coreSecond = nameCore(second);
  const core = basicSimilarity(coreFirst, coreSecond);
  const grams = bigramSimilarity(coreFirst || first, coreSecond || second);
  const jaro = jaroWinklerSimilarity(coreFirst || first, coreSecond || second);
  const prefix =
    coreFirst.length >= 2 && coreSecond.length >= 2 && coreFirst.slice(0, 2) === coreSecond.slice(0, 2)
      ? 0.025
      : 0;

  let score = Math.max(
    full,
    jaro,
    Math.min(1, core * 0.56 + grams * 0.19 + jaro * 0.25 + prefix),
  );

  const firstWords = normaliseWords(first);
  const secondWords = normaliseWords(second);
  const firstHasEx = firstWords.includes("ex");
  const secondHasEx = secondWords.includes("ex");
  const firstMega = firstWords.includes("mega");
  const secondMega = secondWords.includes("mega");

  if (firstHasEx !== secondHasEx && (firstHasEx || secondHasEx)) score *= 0.93;
  if (firstMega !== secondMega && (firstMega || secondMega)) score *= 0.86;

  return Math.max(0, Math.min(1, score));
}
function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractNameCandidates(topText: string, fullText: string): string[] {
  const lines = [...topText.split(/\r?\n/), ...fullText.split(/\r?\n/).slice(0, 6)];
  const names: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine
      .replace(/\b\d{2,3}\s*HP\b/gi, "")
      .replace(/\bHP\s*\d{2,3}\b/gi, "")
      .replace(/\bBASIC\b/gi, "")
      .replace(/\bSTAGE\s*[12I]\b/gi, "")
      .replace(/[^A-Za-zÀ-ÿ0-9.'’\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (line.length < 3 || line.length > 30) continue;

    const words = line.split(" ").filter(Boolean);
    if (words.length === 0 || words.length > 4) continue;

    const meaningful = words.filter((word) => {
      const normalised = normaliseText(word);
      return (
        normalised.length >= 1 &&
        !IGNORED_NAME_WORDS.has(normalised) &&
        !/^\d+$/.test(normalised)
      );
    });

    if (meaningful.length === 0) continue;

    line = meaningful.join(" ");
    if (line.length >= 3) names.push(line);
  }

  return uniqueValues(names).slice(0, 10);
}

function extractCollectorNumbers(text: string): string[] {
  const results: string[] = [];
  const fractionPattern =
    /\b([A-Z]{0,5}\s*-?\s*\d{1,4}[A-Z]?)\s*[\/|]\s*([A-Z]{0,5}\s*-?\s*\d{1,4}[A-Z]?)\b/gi;

  for (const match of text.matchAll(fractionPattern)) {
    const rawLeft = match[1].trim();
    const compactLeft = rawLeft.replace(/\s+/g, "").trim();
    if (!compactLeft) continue;

    // Modern cards often print the set abbreviation before the number, e.g.
    // "PBL 038/084". The database card_no is 38, not PBL038. By contrast,
    // genuine prefixed numbers such as TG01/TG30 have no separating space.
    const separatedSetCode = /^[A-Z]{2,5}\s+-?\s*\d/i.test(rawLeft);
    if (separatedSetCode) {
      const numericPart = rawLeft.match(/(\d{1,4}[A-Z]?)\s*$/i)?.[1] || "";
      if (numericPart) results.push(numericPart, normaliseCollector(numericPart));
    } else {
      results.push(compactLeft, normaliseCollector(compactLeft));
    }
  }

  const promoPattern = /\b(SVP|SWSH|SM|XY|BW|DP|HGSS)\s*-?\s*(\d{1,4})\b/gi;
  for (const match of text.matchAll(promoPattern)) {
    results.push(`${match[1]}${match[2]}`);
  }

  return uniqueValues(results).filter((value) => value.length <= 10).slice(0, 8);
}

function normaliseSetCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/0/g, "O")
    .trim();
}

function extractSetSignals(text: string): { setCodes: string[]; printedTotals: number[] } {
  const setCodes: string[] = [];
  const printedTotals: number[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const fraction = line.match(/(?:^|\s)([A-Z0-9]{2,5})?\s*0*(\d{1,4})\s*[\/|]\s*0*(\d{1,4})(?:\s|$)/i);
    if (!fraction) continue;

    const rawCode = fraction[1]?.trim() || "";
    const denominator = Number(fraction[3]);

    if (rawCode && /[A-Z]/i.test(rawCode)) {
      setCodes.push(normaliseSetCode(rawCode));
    }

    if (Number.isFinite(denominator) && denominator > 0 && denominator < 1000) {
      printedTotals.push(denominator);
    }

    const prefix = line.slice(0, Math.max(0, fraction.index ?? 0) + Math.max(0, fraction[0].indexOf(fraction[2])));
    const codeCandidates = prefix.match(/\b[A-Z0-9]{2,5}\b/gi) || [];
    for (const candidate of codeCandidates.slice(-2)) {
      if (/[A-Z]/i.test(candidate)) setCodes.push(normaliseSetCode(candidate));
    }
  }

  // Also catch common set-code + collector-number forms such as "PBL 038/084".
  for (const match of text.matchAll(/\b([A-Z0-9]{2,5})\s+0*\d{1,4}\s*[\/|]\s*0*(\d{1,4})\b/gi)) {
    if (/[A-Z]/i.test(match[1])) setCodes.push(normaliseSetCode(match[1]));
    const denominator = Number(match[2]);
    if (Number.isFinite(denominator) && denominator > 0 && denominator < 1000) {
      printedTotals.push(denominator);
    }
  }

  return {
    setCodes: uniqueValues(setCodes).slice(0, 6),
    printedTotals: [...new Set(printedTotals)].slice(0, 6),
  };
}

function extractCollectorFractions(text: string): CollectorFraction[] {
  const output: CollectorFraction[] = [];
  const numericSafeText = text
    .replace(/\b[Oo](?=\d{1,4}\s*[\/|])/g, "0")
    .replace(/\/\s*[Oo](?=\d{1,4}\b)/g, "/0")
    .replace(/\|\s*[Oo](?=\d{1,4}\b)/g, "|0")
    .replace(/\b[IiLl](?=\d{1,3}\s*[\/|])/g, "1")
    .replace(/\/\s*[IiLl](?=\d{1,3}\b)/g, "/1")
    .replace(/\|\s*[IiLl](?=\d{1,3}\b)/g, "|1");
  const pattern = /(?:\b([A-Z0-9]{2,5})\s+)?([A-Z]{0,5}\s*-?\s*\d{1,4}[A-Z]?)\s*[\/|]\s*0*(\d{1,4})\b/gi;

  for (const match of numericSafeText.matchAll(pattern)) {
    const rawNumerator = match[2]?.trim() || "";
    const separatedSetCode = /^[A-Z]{2,5}\s+-?\s*\d/i.test(rawNumerator);
    const numericPart = separatedSetCode
      ? rawNumerator.match(/(\d{1,4}[A-Z]?)\s*$/i)?.[1] || ""
      : rawNumerator.replace(/\s+/g, "");
    const denominator = Number(match[3]);
    if (!numericPart) continue;
    output.push({
      numerator: normaliseCollector(numericPart),
      denominator:
        Number.isFinite(denominator) && denominator > 0 && denominator < 1000
          ? denominator
          : null,
      raw: match[0].trim(),
    });
  }

  return output.filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.numerator === item.numerator &&
          candidate.denominator === item.denominator,
      ) === index,
  ).slice(0, 6);
}

function extractHpValues(text: string): number[] {
  const values: number[] = [];
  const hpSafeText = text
    .replace(/HP\s*[Oo](?=\d{1,2}\b)/gi, (value) => value.replace(/[Oo]/, "0"))
    .replace(/(HP\s*\d{1,2})[Oo]\b/gi, (_value, prefix: string) => `${prefix}0`)
    .replace(/\b([1-9]\d?)[Oo](?=\s*HP\b)/gi, (_value, prefix: string) => `${prefix}0`);
  const patterns = [
    /\bHP\s*([1-9]\d{1,2})\b/gi,
    /\b([1-9]\d{1,2})\s*HP\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of hpSafeText.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 20 && value <= 990 && value % 10 === 0) {
        values.push(value);
      }
    }
  }

  return [...new Set(values)].slice(0, 4);
}

function buildNameHypotheses(rawNames: string[], dictionary: string[]): NameHypothesis[] {
  if (rawNames.length === 0 || dictionary.length === 0) return [];

  const output: NameHypothesis[] = [];

  for (const raw of rawNames.slice(0, 8)) {
    const ranked = dictionary
      .map((databaseName) => ({
        name: databaseName,
        score: pokemonNameSimilarity(raw, databaseName),
      }))
      .sort((first, second) => second.score - first.score)
      .slice(0, 2);

    const best = ranked[0];
    const second = ranked[1];
    if (!best) continue;

    const rawLength = normaliseText(raw).length;
    const threshold = rawLength >= 8 ? 0.72 : rawLength >= 5 ? 0.75 : 0.80;
    const margin = best.score - (second?.score || 0);

    // Retrieval may be fuzzy, but fuzzy correction is never allowed to manufacture
    // certainty. A weak/ambiguous title remains ambiguous and must go to review.
    if (best.score >= threshold && (margin >= 0.035 || best.score >= 0.90)) {
      output.push({ raw, corrected: best.name, score: best.score, margin });
    }
  }

  return output
    .sort((first, second) => second.score - first.score || second.margin - first.margin)
    .filter(
      (item, index, array) =>
        array.findIndex(
          (candidate) => normaliseText(candidate.corrected) === normaliseText(item.corrected),
        ) === index,
    )
    .slice(0, 4);
}

function getCardCropBounds(width: number, height: number) {
  const sourceAspect = width / height;
  let cropWidth = width;
  let cropHeight = height;

  if (
    sourceAspect > CARD_ASPECT_RATIO * 1.2 ||
    sourceAspect < CARD_ASPECT_RATIO * 0.8
  ) {
    cropHeight = height * 0.86;
    cropWidth = cropHeight * CARD_ASPECT_RATIO;

    if (cropWidth > width * 0.82) {
      cropWidth = width * 0.82;
      cropHeight = cropWidth / CARD_ASPECT_RATIO;
    }
  }

  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

function getGuideSourceCrop(
  video: HTMLVideoElement,
  viewport: HTMLElement,
  guide: HTMLElement,
): SourceCrop | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const viewportRect = viewport.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (!viewportRect.width || !viewportRect.height || !guideRect.width || !guideRect.height) {
    return null;
  }

  // The video uses object-fit: cover. Translate the visible guide rectangle
  // back into the camera's native pixel coordinates instead of assuming the
  // centre of a landscape stream matches the portrait guide on an iPhone.
  const scale = Math.max(
    viewportRect.width / video.videoWidth,
    viewportRect.height / video.videoHeight,
  );
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (viewportRect.width - renderedWidth) / 2;
  const offsetY = (viewportRect.height - renderedHeight) / 2;

  const visibleX = guideRect.left - viewportRect.left;
  const visibleY = guideRect.top - viewportRect.top;
  const sourceX = (visibleX - offsetX) / scale;
  const sourceY = (visibleY - offsetY) / scale;
  const sourceWidth = guideRect.width / scale;
  const sourceHeight = guideRect.height / scale;

  const x = Math.max(0, Math.min(video.videoWidth - 1, sourceX));
  const y = Math.max(0, Math.min(video.videoHeight - 1, sourceY));
  const width = Math.max(1, Math.min(video.videoWidth - x, sourceWidth));
  const height = Math.max(1, Math.min(video.videoHeight - y, sourceHeight));

  return { x, y, width, height };
}

function extractVideoGuideCanvas(
  video: HTMLVideoElement,
  viewport: HTMLElement,
  guide: HTMLElement,
): HTMLCanvasElement {
  const crop = getGuideSourceCrop(video, viewport, guide);
  if (!crop) return extractCardCanvas(video);

  const outputWidth = 1008;
  const outputHeight = Math.round(outputWidth / CARD_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The scanner could not prepare the card image.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return canvas;
}

function extractCardCanvas(source: HTMLVideoElement | HTMLImageElement): HTMLCanvasElement {
  const sourceWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sourceHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("The captured image has no usable dimensions.");
  }

  const crop = getCardCropBounds(sourceWidth, sourceHeight);
  const outputWidth = 1008;
  const outputHeight = Math.round(outputWidth / CARD_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("The scanner could not prepare the card image.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvas;
}

function createProcessedRegion(
  source: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
  binary: boolean,
): HTMLCanvasElement {
  const sourceX = Math.max(0, Math.floor(source.width * xRatio));
  const sourceY = Math.max(0, Math.floor(source.height * yRatio));
  const sourceWidth = Math.max(1, Math.floor(source.width * widthRatio));
  const sourceHeight = Math.max(1, Math.floor(source.height * heightRatio));
  const scale = Math.max(1.6, 1800 / source.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The scanner could not prepare OCR regions.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const grey = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.7 + 128));
    const value = binary ? (contrasted > 148 ? 255 : 0) : contrasted;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}


type OcrVariant = "grey" | "otsu" | "adaptive" | "sharpen";

type OcrRead = {
  text: string;
  confidence: number;
};

function otsuThreshold(values: number[]): number {
  const histogram = Array.from({ length: 256 }, () => 0);
  for (const value of values) histogram[Math.max(0, Math.min(255, Math.round(value)))] += 1;
  const total = values.length || 1;
  let sum = 0;
  for (let index = 0; index < 256; index += 1) sum += index * histogram[index];
  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let index = 0; index < 256; index += 1) {
    weightBackground += histogram[index];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += index * histogram[index];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > bestVariance) {
      bestVariance = between;
      threshold = index;
    }
  }
  return threshold;
}

function createOcrRegion(
  source: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
  variant: OcrVariant,
  scaleOverride?: number,
): HTMLCanvasElement {
  const sourceX = Math.max(0, Math.floor(source.width * xRatio));
  const sourceY = Math.max(0, Math.floor(source.height * yRatio));
  const sourceWidth = Math.max(1, Math.min(source.width - sourceX, Math.floor(source.width * widthRatio)));
  const sourceHeight = Math.max(1, Math.min(source.height - sourceY, Math.floor(source.height * heightRatio)));
  const scale = scaleOverride ?? Math.max(2.2, 1900 / Math.max(630, source.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The scanner could not prepare OCR regions.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const grey: number[] = new Array(canvas.width * canvas.height);
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    grey[pixel] = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
  }

  const sorted = [...grey].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.04)] ?? 0;
  const high = sorted[Math.floor(sorted.length * 0.96)] ?? 255;
  const range = Math.max(32, high - low);
  const stretched = grey.map((value) => Math.max(0, Math.min(255, ((value - low) / range) * 255)));
  const mean = stretched.reduce((sum, value) => sum + value, 0) / Math.max(1, stretched.length);
  const threshold = otsuThreshold(stretched);

  let integral: Float64Array | null = null;
  if (variant === "adaptive") {
    integral = new Float64Array((canvas.width + 1) * (canvas.height + 1));
    for (let y = 1; y <= canvas.height; y += 1) {
      let row = 0;
      for (let x = 1; x <= canvas.width; x += 1) {
        row += stretched[(y - 1) * canvas.width + (x - 1)];
        integral[y * (canvas.width + 1) + x] = integral[(y - 1) * (canvas.width + 1) + x] + row;
      }
    }
  }

  const block = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.14));
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixelIndex = y * canvas.width + x;
      let value = stretched[pixelIndex];

      if (variant === "otsu") {
        value = value > threshold ? 255 : 0;
      } else if (variant === "adaptive" && integral) {
        const x0 = Math.max(0, x - block);
        const y0 = Math.max(0, y - block);
        const x1 = Math.min(canvas.width - 1, x + block);
        const y1 = Math.min(canvas.height - 1, y + block);
        const stride = canvas.width + 1;
        const sum =
          integral[(y1 + 1) * stride + (x1 + 1)] -
          integral[y0 * stride + (x1 + 1)] -
          integral[(y1 + 1) * stride + x0] +
          integral[y0 * stride + x0];
        const localMean = sum / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
        value = value > localMean - 7 ? 255 : 0;
      } else if (variant === "sharpen") {
        const contrast = (value - 128) * 1.28 + 128;
        value = Math.max(0, Math.min(255, contrast));
      }

      // OCR engines generally prefer dark glyphs on a light field. Some card
      // headers are dark, so invert the whole ROI when its background is dark.
      if (mean < 112) value = 255 - value;
      const target = pixelIndex * 4;
      pixels[target] = value;
      pixels[target + 1] = value;
      pixels[target + 2] = value;
      pixels[target + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be opened."));
    image.src = source;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function createReviewPreview(source: HTMLCanvasElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = Math.round(canvas.width / CARD_ASPECT_RATIO);
  const context = canvas.getContext("2d");
  if (!context) return source.toDataURL("image/jpeg", 0.7);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function sourceDimensions(source: HTMLCanvasElement | HTMLImageElement): {
  width: number;
  height: number;
} {
  return source instanceof HTMLCanvasElement
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

function createDifferenceHash(
  source: HTMLCanvasElement | HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
): number[] {
  const hashWidth = 18;
  const hashHeight = 24;
  const canvas = document.createElement("canvas");
  canvas.width = hashWidth + 1;
  canvas.height = hashHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const dimensions = sourceDimensions(source);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    dimensions.width * crop.x,
    dimensions.height * crop.y,
    dimensions.width * crop.width,
    dimensions.height * crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const luma: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    luma.push(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
  }

  const hash: number[] = [];
  for (let y = 0; y < hashHeight; y += 1) {
    for (let x = 0; x < hashWidth; x += 1) {
      const row = y * (hashWidth + 1);
      hash.push(luma[row + x] > luma[row + x + 1] ? 1 : 0);
    }
  }
  return hash;
}

function compareDifferenceHashes(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let equal = 0;
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] === second[index]) equal += 1;
  }
  return equal / first.length;
}

function createColourHistogram(
  source: HTMLCanvasElement | HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = 28;
  canvas.height = 36;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const dimensions = sourceDimensions(source);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    dimensions.width * crop.x,
    dimensions.height * crop.y,
    dimensions.width * crop.width,
    dimensions.height * crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const bins = Array.from({ length: 64 }, () => 0);
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const r = Math.min(3, Math.floor(data[index] / 64));
    const g = Math.min(3, Math.floor(data[index + 1] / 64));
    const b = Math.min(3, Math.floor(data[index + 2] / 64));
    bins[r * 16 + g * 4 + b] += 1;
    count += 1;
  }

  if (!count) return bins;
  return bins.map((value) => value / count);
}

function compareColourHistograms(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let intersection = 0;
  for (let index = 0; index < first.length; index += 1) {
    intersection += Math.min(first[index], second[index]);
  }
  return Math.max(0, Math.min(1, intersection));
}

function loadRemoteImageForFingerprint(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!source) return resolve(null);

    const image = new Image();
    let finished = false;
    const finish = (value: HTMLImageElement | null) => {
      if (finished) return;
      finished = true;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 3000);

    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      window.clearTimeout(timer);
      finish(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    image.src = source;
  });
}

async function hydrateScannerCards(
  cards: ScannerPokemonCard[],
): Promise<ScannerPokemonCard[]> {
  if (!cards.length) return cards;
  try {
    const response = await scannerAdminFetch<ScannerMetadataResponse>(
      "/api/admin/scanner/card-metadata",
      {
        method: "POST",
        body: JSON.stringify({ cardIds: cards.slice(0, 8).map((card) => card.id) }),
      },
    );
    const map = new Map(response.cards.map((card) => [String(card.id), card]));
    return cards.map((card) => {
      const metadata = map.get(String(card.id));
      if (!metadata) return card;
      return {
        ...card,
        hp: metadata.hp ?? card.hp,
        set_printed_total: metadata.setPrintedTotal ?? card.set_printed_total,
        set_id: metadata.setId ?? card.set_id,
        set_name: metadata.setName ?? card.set_name,
        image_url_large: metadata.imageUrlLarge ?? card.image_url_large,
      };
    });
  } catch (error) {
    console.warn("Scanner metadata hydration unavailable:", error);
    return cards;
  }
}

function scoreSetMetadata(
  card: ScannerPokemonCard,
  scan: ExtractedScan,
  metadataMap: Map<string, ScannerSetMetadata>,
): number {
  const setId = card.set_id?.trim() || "";
  const metadata = setId ? metadataMap.get(setId) : undefined;
  const printedTotal = toNumber(card.set_printed_total) || metadata?.printedTotal || null;

  let codeScore = 0;
  if (scan.setCodes.length > 0 && metadata?.ptcgoCode) {
    const target = normaliseSetCode(metadata.ptcgoCode);
    for (const scannedCode of scan.setCodes) {
      const source = normaliseSetCode(scannedCode);
      const exact = source === target ? 1 : 0;
      const fuzzy = basicSimilarity(source, target);
      codeScore = Math.max(codeScore, exact, fuzzy >= 0.76 ? fuzzy : 0);
    }
  }

  let totalScore = 0;
  if (scan.printedTotals.length > 0 && printedTotal) {
    totalScore = scan.printedTotals.includes(printedTotal) ? 1 : 0;
  }

  const hasComparableCode = scan.setCodes.length > 0 && Boolean(metadata?.ptcgoCode);
  if (hasComparableCode && scan.printedTotals.length > 0) {
    // The denominator is generally more reliable than tiny set-code OCR, so it
    // carries the larger share when both are available.
    return Math.max(0, Math.min(1, codeScore * 0.38 + totalScore * 0.62));
  }
  if (scan.printedTotals.length > 0) return totalScore;
  if (hasComparableCode) return codeScore;
  return 0;
}

function scoreCandidate(
  card: ScannerPokemonCard,
  scan: ExtractedScan,
  metadataMap: Map<string, ScannerSetMetadata>,
): ScannerCandidate {
  let rawNameScore = 0;
  for (const rawName of scan.names) {
    rawNameScore = Math.max(rawNameScore, pokemonNameSimilarity(card.name, rawName));
  }

  let hypothesisNameScore = 0;
  for (const hypothesis of scan.nameHypotheses) {
    const candidateSimilarity = pokemonNameSimilarity(card.name, hypothesis.corrected);
    // Important: equality with a fuzzy correction does NOT become 1.0. The
    // correction carries only the evidence supplied by its original OCR score.
    hypothesisNameScore = Math.max(
      hypothesisNameScore,
      candidateSimilarity * hypothesis.score,
    );
  }
  const nameScore = Math.max(rawNameScore, hypothesisNameScore);

  const cardCollector = normaliseCollector(card.card_no || "");
  let collectorScore = 0;
  const scannedNumerators = uniqueValues([
    ...scan.collectorFractions.map((fraction) => fraction.numerator),
    ...scan.collectorNumbers.map((number) => normaliseCollector(number)),
  ]);
  for (const scannedCollector of scannedNumerators) {
    if (!cardCollector || !scannedCollector) continue;
    if (scannedCollector === cardCollector) {
      collectorScore = 1;
      break;
    }
    if (
      cardCollector.endsWith(scannedCollector) ||
      scannedCollector.endsWith(cardCollector)
    ) {
      collectorScore = Math.max(collectorScore, 0.62);
    }
  }

  const setScore = scoreSetMetadata(card, scan, metadataMap);
  const cardHp = toNumber(card.hp) || null;
  let hpScore = 0;
  if (scan.hpValues.length > 0 && cardHp) {
    hpScore = scan.hpValues.includes(cardHp) ? 1 : 0;
  }

  const hardRejectReasons: string[] = [];
  const nameEvidenceStrong = scan.nameHypotheses.length > 0 || scan.names.length > 0;
  if (nameEvidenceStrong && nameScore < 0.70) {
    hardRejectReasons.push("Pokemon identity contradicts the title OCR");
  }

  if (
    scan.collectorFractions.length > 0 &&
    scan.fieldConfidence.collector >= 0.68 &&
    cardCollector &&
    !scan.collectorFractions.some((fraction) => fraction.numerator === cardCollector)
  ) {
    hardRejectReasons.push("Collector number conflicts");
  }

  const printedTotal =
    toNumber(card.set_printed_total) ||
    (card.set_id ? metadataMap.get(card.set_id)?.printedTotal || 0 : 0);
  if (
    scan.printedTotals.length > 0 &&
    scan.fieldConfidence.collector >= 0.68 &&
    printedTotal > 0 &&
    !scan.printedTotals.includes(printedTotal)
  ) {
    hardRejectReasons.push("Set printed total conflicts");
  }

  if (
    scan.hpValues.length > 0 &&
    scan.fieldConfidence.hp >= 0.66 &&
    cardHp &&
    !scan.hpValues.includes(cardHp)
  ) {
    hardRejectReasons.push(`HP conflicts (${cardHp} vs ${scan.hpValues.join("/")})`);
  }

  const observedWeights: Array<[number, number]> = [[nameScore, 0.50]];
  if (scan.collectorNumbers.length || scan.collectorFractions.length) {
    observedWeights.push([collectorScore, 0.20]);
  }
  if (scan.setCodes.length || scan.printedTotals.length) {
    observedWeights.push([setScore, 0.13]);
  }
  if (scan.hpValues.length && cardHp) {
    observedWeights.push([hpScore, 0.17]);
  }
  const totalWeight = observedWeights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const weighted = observedWeights.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight;
  const textConfidence = Math.max(1, Math.min(99, Math.round(weighted * 100)));

  const reasons: string[] = [];
  const bestCorrection = scan.nameHypotheses.find(
    (hypothesis) => normaliseText(hypothesis.corrected) === normaliseText(card.name),
  );
  if (bestCorrection) {
    if (normaliseText(bestCorrection.raw) !== normaliseText(bestCorrection.corrected)) {
      reasons.push(
        `Name “${bestCorrection.raw}” → ${bestCorrection.corrected} (${Math.round(bestCorrection.score * 100)}%)`,
      );
    } else {
      reasons.push("Pokemon name matched");
    }
  } else if (nameScore >= 0.88) {
    reasons.push("Pokemon name matched closely");
  } else if (nameScore >= 0.72) {
    reasons.push("Pokemon name is plausible");
  }

  if (collectorScore === 1) reasons.push("Collector number exact");
  else if (collectorScore >= 0.60) reasons.push("Collector number close");
  if (setScore >= 0.96) reasons.push("Set / printed total exact");
  else if (setScore >= 0.75) reasons.push("Set evidence compatible");
  if (hpScore === 1) reasons.push(`HP ${cardHp} exact`);

  const evidenceCount = [
    nameScore >= 0.88,
    collectorScore === 1,
    setScore >= 0.90,
    hpScore === 1,
  ].filter(Boolean).length;

  return {
    card,
    confidence: hardRejectReasons.length ? Math.min(20, textConfidence) : textConfidence,
    textConfidence,
    visualConfidence: null,
    collectorScore,
    nameScore,
    setScore,
    hpScore,
    hardRejected: hardRejectReasons.length > 0,
    hardRejectReasons,
    evidenceCount,
    reasons: reasons.length ? reasons : ["Possible identity match"],
  };
}

async function rerankWithArtwork(
  candidates: ScannerCandidate[],
  capturedCard: HTMLCanvasElement,
): Promise<ScannerCandidate[]> {
  if (!candidates.length) return candidates;

  const fullCrop = { x: 0.025, y: 0.02, width: 0.95, height: 0.96 };
  const artCrop = { x: 0.055, y: 0.125, width: 0.89, height: 0.50 };
  const capturedFull = createVisionSignature(capturedCard, fullCrop);
  const capturedArt = createVisionSignature(capturedCard, artCrop);

  const enriched = await Promise.all(
    candidates.slice(0, 8).map(async (candidate) => {
      if (candidate.hardRejected) return candidate;
      const source =
        candidate.card.image_url_large?.trim() ||
        candidate.card.image_url?.trim() ||
        "";
      let image = await loadRemoteImageForFingerprint(source);
      if (!image) {
        const blob = await scannerAdminBlobFetch(
          "/api/admin/scanner/reference-image",
          { cardId: candidate.card.id },
        );
        if (!blob) return candidate;
        image = await loadBlobImage(blob);
        if (!image) return candidate;
      }

      try {
        let referenceImage = image;
        let referenceArt: ReturnType<typeof createVisionSignature>;
        let referenceFull: ReturnType<typeof createVisionSignature>;
        try {
          referenceArt = createVisionSignature(referenceImage, artCrop);
          referenceFull = createVisionSignature(referenceImage, fullCrop);
        } catch {
          const blob = await scannerAdminBlobFetch(
            "/api/admin/scanner/reference-image",
            { cardId: candidate.card.id },
          );
          if (!blob) return candidate;
          const proxied = await loadBlobImage(blob);
          if (!proxied) return candidate;
          referenceImage = proxied;
          referenceArt = createVisionSignature(referenceImage, artCrop);
          referenceFull = createVisionSignature(referenceImage, fullCrop);
        }
        const art = compareVisionSignatures(capturedArt, referenceArt);
        const full = compareVisionSignatures(capturedFull, referenceFull);
        // Artwork region has priority; the whole-card score is mainly useful for
        // layout/border checks and cannot override a Pokemon-name contradiction.
        const visual = Math.max(0, Math.min(1, art.combined * 0.72 + full.combined * 0.28));
        const visualConfidence = Math.round(visual * 100);
        const text = candidate.textConfidence / 100;
        let combined = text * 0.70 + visual * 0.30;

        if (candidate.nameScore < 0.72) combined = Math.min(combined, 0.25);
        if (visual < 0.46 && candidate.collectorScore !== 1) combined *= 0.84;

        const reasons = [...candidate.reasons];
        if (visual >= 0.86) reasons.push("Artwork structure matched strongly");
        else if (visual >= 0.74) reasons.push("Artwork looks compatible");
        else if (visual < 0.48) reasons.push("Artwork is a weak match");

        return {
          ...candidate,
          confidence: Math.max(1, Math.min(99, Math.round(combined * 100))),
          visualConfidence,
          evidenceCount: candidate.evidenceCount + (visual >= 0.82 ? 1 : 0),
          visualBreakdown: {
            structure: Math.round((art.structure * 0.72 + full.structure * 0.28) * 100),
            edge: Math.round((art.edge * 0.72 + full.edge * 0.28) * 100),
            dhash: Math.round((art.dhash * 0.72 + full.dhash * 0.28) * 100),
            colour: Math.round((art.colour * 0.72 + full.colour * 0.28) * 100),
            histogram: Math.round((art.histogram * 0.72 + full.histogram * 0.28) * 100),
          },
          reasons,
        };
      } catch {
        return candidate;
      }
    }),
  );

  return enriched.sort((first, second) => {
    if (first.hardRejected !== second.hardRejected) return first.hardRejected ? 1 : -1;
    if (Math.abs(second.nameScore - first.nameScore) >= 0.06) return second.nameScore - first.nameScore;
    if (second.collectorScore !== first.collectorScore) return second.collectorScore - first.collectorScore;
    if (Math.abs(second.setScore - first.setScore) >= 0.08) return second.setScore - first.setScore;
    if (second.hpScore !== first.hpScore) return second.hpScore - first.hpScore;
    return second.confidence - first.confidence;
  });
}

function frameDifference(first: FrameSignature | null, second: FrameSignature | null): number {
  return frameFingerprintDifference(first, second);
}

function averageFrameSignatures(signatures: FrameSignature[]): FrameSignature | null {
  return averageFrameFingerprints(signatures);
}

function captureFrameSignature(
  video: HTMLVideoElement,
  cropOverride?: SourceCrop | null,
): FrameSignature | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const crop = cropOverride || getCardCropBounds(video.videoWidth, video.videoHeight);
  return captureFrameFingerprint(video, crop);
}

function shouldAutoAdd(candidates: ScannerCandidate[], scan: ExtractedScan): boolean {
  const best = candidates[0];
  if (!best || best.hardRejected) return false;

  const second = candidates.find((candidate, index) => index > 0 && !candidate.hardRejected);
  const margin = second ? best.confidence - second.confidence : 99;
  const exactCollector = best.collectorScore === 1;
  const exactSet = best.setScore >= 0.90;
  const exactHp = best.hpScore === 1;
  const strongArtwork = (best.visualConfidence ?? 0) >= 82;
  const strongName = best.nameScore >= 0.90;
  const nameMargin = scan.nameHypotheses[0]?.margin ?? 0;
  const secondaryEvidence = [exactCollector, exactSet, exactHp, strongArtwork].filter(Boolean).length;

  return (
    strongName &&
    nameMargin >= 0.045 &&
    best.confidence >= 92 &&
    margin >= 8 &&
    secondaryEvidence >= 2 &&
    best.evidenceCount >= 3 &&
    best.hardRejectReasons.length === 0
  );
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CardScanner({
  disabled = false,
  resetKey = 0,
  onSelect,
  onAutoAdd,
  autoIntakeLabel = "1 card · Normal finish · current location",
}: CardScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraViewportRef = useRef<HTMLDivElement | null>(null);
  const cardGuideRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const psmRef = useRef<PsmValues | null>(null);
  const workerPromiseRef = useRef<Promise<OcrWorker> | null>(null);
  const mountedRef = useRef(true);
  const nameDictionaryRef = useRef<string[]>([]);
  const nameDictionaryPromiseRef = useRef<Promise<string[]> | null>(null);
  const setMetadataRef = useRef<Map<string, ScannerSetMetadata>>(new Map());
  const setMetadataPromiseRef = useRef<Promise<Map<string, ScannerSetMetadata>> | null>(null);

  const autoPhaseRef = useRef<AutoPhase>("off");
  const autoBusyRef = useRef(false);
  const baselineRef = useRef<FrameSignature | null>(null);
  const previousFrameRef = useRef<FrameSignature | null>(null);
  const calibrationFramesRef = useRef<FrameSignature[]>([]);
  const stableFramesRef = useRef(0);
  const presenceFramesRef = useRef(0);
  const removalFramesRef = useRef(0);
  const presenceThresholdRef = useRef(AUTO_MIN_PRESENCE_THRESHOLD);
  const stableThresholdRef = useRef(2.8);
  const calibrationNoiseRef = useRef<number[]>([]);
  const lastGeometryRef = useRef<CardGeometry | null>(null);
  const previousGeometryRef = useRef<CardGeometry | null>(null);
  const baselineGeometryRef = useRef<CardGeometry | null>(null);
  const lastQualityRef = useRef<CardQuality | null>(null);

  const [state, setState] = useState<ScannerState>("idle");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [autoPhase, setAutoPhase] = useState<AutoPhase>("off");
  const [capturedImage, setCapturedImage] = useState("");
  const [candidates, setCandidates] = useState<ScannerCandidate[]>([]);
  const [scanDetails, setScanDetails] = useState<ExtractedScan | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [recentAdds, setRecentAdds] = useState<RecentAutoAdd[]>([]);
  const [sessionAddedCount, setSessionAddedCount] = useState(0);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Ready to scan a card");
  const [error, setError] = useState("");

  const scanning = state === "reading" || state === "matching";
  const bestConfidence = useMemo(() => candidates[0]?.confidence || 0, [candidates]);

  const setPhase = useCallback((phase: AutoPhase) => {
    autoPhaseRef.current = phase;
    setAutoPhase(phase);
  }, []);

  const getLiveGuideCrop = useCallback((): SourceCrop | null => {
    if (!videoRef.current || !cameraViewportRef.current || !cardGuideRef.current) {
      return null;
    }
    return getGuideSourceCrop(
      videoRef.current,
      cameraViewportRef.current,
      cardGuideRef.current,
    );
  }, []);

  const captureLiveCardCanvas = useCallback((): HTMLCanvasElement => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("The camera is not ready.");
    }

    const guideCrop = getLiveGuideCrop();
    const geometry = detectCardGeometry(video, guideCrop);
    lastGeometryRef.current = geometry;

    let canvas: HTMLCanvasElement;
    if (geometry && geometry.confidence >= 0.40 && geometry.aspectScore >= 0.58) {
      canvas = rectifyCard(video, geometry, 756);
    } else if (cameraViewportRef.current && cardGuideRef.current) {
      canvas = extractVideoGuideCanvas(
        video,
        cameraViewportRef.current,
        cardGuideRef.current,
      );
    } else {
      canvas = extractCardCanvas(video);
    }

    lastQualityRef.current = measureCardQuality(canvas);
    return canvas;
  }, [getLiveGuideCrop]);

  const signal = useCallback((type: "success" | "review" | "ready") => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (type === "success") navigator.vibrate?.([45, 35, 45]);
      else if (type === "review") navigator.vibrate?.([80]);
      else navigator.vibrate?.([25]);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setHandsFree(false);
    setPhase("off");
    baselineRef.current = null;
    previousFrameRef.current = null;
    previousGeometryRef.current = null;
    lastGeometryRef.current = null;
    baselineGeometryRef.current = null;
    lastQualityRef.current = null;
    calibrationFramesRef.current = [];
    stableFramesRef.current = 0;
    presenceFramesRef.current = 0;
    removalFramesRef.current = 0;
    presenceThresholdRef.current = AUTO_MIN_PRESENCE_THRESHOLD;
    stableThresholdRef.current = 2.8;
    calibrationNoiseRef.current = [];
    autoBusyRef.current = false;
  }, [setPhase]);

  const resetScanner = useCallback(() => {
    stopCamera();
    setState("idle");
    setCapturedImage("");
    setCandidates([]);
    setScanDetails(null);
    setProgress(0);
    setStatus("Ready to scan a card");
    setError("");
  }, [stopCamera]);

  useEffect(() => {
    resetScanner();
  }, [resetKey, resetScanner]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
      if (workerRef.current) {
        void workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [stopCamera]);

  async function ensureWorker(): Promise<OcrWorker> {
    if (workerRef.current) return workerRef.current;
    if (workerPromiseRef.current) return workerPromiseRef.current;

    workerPromiseRef.current = (async () => {
      setStatus("Loading the recognition engine");
      const tesseract = await import("tesseract.js");
      psmRef.current = tesseract.PSM as PsmValues;
      const worker = (await tesseract.createWorker("eng", 1, {
        logger: (message: { progress?: number }) => {
          if (!mountedRef.current || typeof message.progress !== "number") return;
          setProgress(Math.max(5, Math.min(80, Math.round(message.progress * 75))));
        },
      })) as unknown as OcrWorker;

      await worker.setParameters({ preserve_interword_spaces: "1" });
      workerRef.current = worker;
      return worker;
    })();

    try {
      return await workerPromiseRef.current;
    } finally {
      workerPromiseRef.current = null;
    }
  }

  async function ensureNameDictionary(): Promise<string[]> {
    if (nameDictionaryRef.current.length) return nameDictionaryRef.current;
    if (nameDictionaryPromiseRef.current) return nameDictionaryPromiseRef.current;

    nameDictionaryPromiseRef.current = (async () => {
      const { data, error: dictionaryError } = await supabase.rpc("get_scanner_card_names");
      if (dictionaryError) {
        console.warn("Scanner name dictionary RPC unavailable:", dictionaryError);
        return [];
      }

      const names = Array.isArray(data)
        ? data
            .map((row: unknown) => {
              if (typeof row === "string") return row.trim();
              if (row && typeof row === "object" && "card_name" in row) {
                const value = (row as { card_name?: unknown }).card_name;
                return typeof value === "string" ? value.trim() : "";
              }
              return "";
            })
            .filter(Boolean)
        : [];

      nameDictionaryRef.current = uniqueValues(names);
      return nameDictionaryRef.current;
    })();

    try {
      return await nameDictionaryPromiseRef.current;
    } finally {
      nameDictionaryPromiseRef.current = null;
    }
  }

  async function ensureSetMetadata(): Promise<Map<string, ScannerSetMetadata>> {
    if (setMetadataRef.current.size > 0) return setMetadataRef.current;
    if (setMetadataPromiseRef.current) return setMetadataPromiseRef.current;

    setMetadataPromiseRef.current = (async () => {
      const { data, error: metadataError } = await supabase.rpc("get_scanner_set_metadata");
      if (metadataError) {
        console.warn("Scanner set metadata RPC unavailable:", metadataError);
        return new Map<string, ScannerSetMetadata>();
      }

      const map = new Map<string, ScannerSetMetadata>();
      if (Array.isArray(data)) {
        for (const row of data as Array<Record<string, unknown>>) {
          const setId = typeof row.set_id === "string" ? row.set_id.trim() : "";
          if (!setId) continue;
          map.set(setId, {
            setId,
            setName: typeof row.set_name === "string" ? row.set_name.trim() : "",
            ptcgoCode:
              typeof row.ptcgo_code === "string" && row.ptcgo_code.trim()
                ? row.ptcgo_code.trim()
                : null,
            printedTotal: Number.isFinite(Number(row.printed_total))
              ? Number(row.printed_total)
              : null,
            total: Number.isFinite(Number(row.total)) ? Number(row.total) : null,
          });
        }
      }

      setMetadataRef.current = map;
      return map;
    })();

    try {
      return await setMetadataPromiseRef.current;
    } finally {
      setMetadataPromiseRef.current = null;
    }
  }

  async function runRecognition(
    worker: OcrWorker,
    canvas: HTMLCanvasElement,
    mode: "sparse" | "block" | "line",
    whitelist?: string,
  ): Promise<OcrRead> {
    const psm = psmRef.current;
    await worker.setParameters({
      ...(psm
        ? {
            tessedit_pageseg_mode:
              mode === "line"
                ? psm.SINGLE_LINE
                : mode === "block"
                  ? psm.SINGLE_BLOCK
                  : psm.SPARSE_TEXT,
          }
        : {}),
      tessedit_char_whitelist: whitelist ?? "",
      preserve_interword_spaces: "1",
    });

    const result = await worker.recognize(canvas);
    return {
      text: result.data.text || "",
      confidence: Math.max(0, Math.min(1, Number(result.data.confidence ?? 0) / 100)),
    };
  }

  async function recogniseCard(cardCanvas: HTMLCanvasElement): Promise<ExtractedScan> {
    setState("reading");
    setProgress(3);
    setStatus("Reading the Pokemon identity");

    const [worker, dictionary] = await Promise.all([
      ensureWorker(),
      ensureNameDictionary(),
    ]);

    const titleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .:'’-éÉ";
    const hpCharacters = "HP0123456789 ";
    const numberCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/-| .";

    const titleReads: OcrRead[] = [];
    const titleGrey = createOcrRegion(cardCanvas, 0.025, 0.0, 0.95, 0.115, "grey", 2.8);
    const titleOtsu = createOcrRegion(cardCanvas, 0.025, 0.0, 0.95, 0.115, "otsu", 2.8);
    const titleFocused = createOcrRegion(cardCanvas, 0.07, 0.0, 0.82, 0.105, "adaptive", 3.0);

    titleReads.push(await runRecognition(worker, titleGrey, "line", titleCharacters));
    setProgress(16);
    titleReads.push(await runRecognition(worker, titleOtsu, "line", titleCharacters));

    let topText = titleReads.map((read) => read.text).filter(Boolean).join("\n");
    let names = extractNameCandidates(topText, topText);
    let hypotheses = buildNameHypotheses(names, dictionary);

    if (
      !hypotheses.length ||
      hypotheses[0].score < 0.84 ||
      hypotheses[0].margin < 0.055
    ) {
      setStatus("Double-checking the Pokemon name");
      titleReads.push(await runRecognition(worker, titleFocused, "line", titleCharacters));
      topText = titleReads.map((read) => read.text).filter(Boolean).join("\n");
      names = extractNameCandidates(topText, topText);
      hypotheses = buildNameHypotheses(names, dictionary);
    }

    setProgress(38);
    setStatus("Reading HP");
    const hpGrey = createOcrRegion(cardCanvas, 0.66, 0.0, 0.33, 0.12, "grey", 3.3);
    const hpOtsu = createOcrRegion(cardCanvas, 0.66, 0.0, 0.33, 0.12, "otsu", 3.3);
    const hpReads: OcrRead[] = [
      await runRecognition(worker, hpGrey, "line", hpCharacters),
      await runRecognition(worker, hpOtsu, "line", hpCharacters),
    ];
    const hpText = hpReads.map((read) => read.text).filter(Boolean).join("\n");
    let hpValues = extractHpValues(hpText);

    setProgress(56);
    setStatus("Reading collector number and set");
    const bottomGrey = createOcrRegion(cardCanvas, 0.0, 0.835, 1.0, 0.165, "grey", 2.8);
    const bottomAdaptive = createOcrRegion(cardCanvas, 0.0, 0.835, 1.0, 0.165, "adaptive", 2.8);
    const bottomReads: OcrRead[] = [
      await runRecognition(worker, bottomGrey, "sparse", numberCharacters),
      await runRecognition(worker, bottomAdaptive, "sparse", numberCharacters),
    ];
    let bottomText = bottomReads.map((read) => read.text).filter(Boolean).join("\n");
    let collectorFractions = extractCollectorFractions(bottomText);
    let collectorNumbers = extractCollectorNumbers(bottomText);
    let setSignals = extractSetSignals(bottomText);

    // Only broaden OCR when a key identity field is still missing. We never OCR
    // attacks/rules text as a normal path because those words can look like names.
    let fallbackText = "";
    if (!hypotheses.length || !collectorFractions.length || !hpValues.length) {
      setProgress(72);
      setStatus("Checking the card header and footer once more");
      const headerBlock = createOcrRegion(cardCanvas, 0.0, 0.0, 1.0, 0.18, "sharpen", 2.5);
      const footerBlock = createOcrRegion(cardCanvas, 0.0, 0.78, 1.0, 0.22, "otsu", 2.5);
      const headerRead = await runRecognition(worker, headerBlock, "sparse", titleCharacters + "HP");
      const footerRead = await runRecognition(worker, footerBlock, "sparse", numberCharacters);
      fallbackText = [headerRead.text, footerRead.text].filter(Boolean).join("\n");
      topText = [topText, headerRead.text].filter(Boolean).join("\n");
      bottomText = [bottomText, footerRead.text].filter(Boolean).join("\n");
      names = extractNameCandidates(topText, topText);
      hypotheses = buildNameHypotheses(names, dictionary);
      hpValues = extractHpValues([hpText, headerRead.text].join("\n"));
      collectorFractions = extractCollectorFractions(bottomText);
      collectorNumbers = extractCollectorNumbers(bottomText);
      setSignals = extractSetSignals(bottomText);
    }

    const combinedText = [topText, hpText, bottomText, fallbackText]
      .filter(Boolean)
      .join("\n");
    const finalNames = extractNameCandidates(topText, topText);
    const finalHypotheses = buildNameHypotheses(finalNames, dictionary);
    const finalFractions = extractCollectorFractions(combinedText);
    const finalSignals = extractSetSignals(combinedText);
    const finalCollectorNumbers = uniqueValues([
      ...extractCollectorNumbers(combinedText),
      ...finalFractions.map((fraction) => fraction.numerator),
    ]);
    const finalPrintedTotals = [...new Set([
      ...finalSignals.printedTotals,
      ...finalFractions
        .map((fraction) => fraction.denominator)
        .filter((value): value is number => value !== null),
    ])];
    const titleOcrConfidence = Math.max(0, ...titleReads.map((read) => read.confidence));
    const hpOcrConfidence = Math.max(0, ...hpReads.map((read) => read.confidence));
    const collectorOcrConfidence = Math.max(0, ...bottomReads.map((read) => read.confidence));

    const hpPerRead = hpReads.map((read) => extractHpValues(read.text));
    const hpConsensus = hpPerRead.length >= 2 && hpPerRead[0].some((value) => hpPerRead.slice(1).some((values) => values.includes(value)))
      ? 1
      : 0.52;
    const fractionPerRead = bottomReads.map((read) => extractCollectorFractions(read.text));
    const collectorConsensus = fractionPerRead.length >= 2 && fractionPerRead[0].some((value) =>
      fractionPerRead.slice(1).some((values) =>
        values.some((candidate) => candidate.numerator === value.numerator && candidate.denominator === value.denominator),
      ),
    )
      ? 1
      : 0.50;

    return {
      topText,
      bottomText,
      hpText,
      fullText: combinedText,
      names: finalNames,
      collectorNumbers: finalCollectorNumbers,
      collectorFractions: finalFractions,
      hpValues: extractHpValues(combinedText),
      setCodes: finalSignals.setCodes,
      printedTotals: finalPrintedTotals,
      nameHypotheses: finalHypotheses,
      fieldConfidence: {
        name: Math.max(
          0,
          Math.min(
            1,
            (finalHypotheses[0]?.score || 0) * 0.72 + titleOcrConfidence * 0.28,
          ),
        ),
        hp: hpValues.length
          ? Math.max(0.42, Math.min(1, hpOcrConfidence * 0.66 + hpConsensus * 0.34))
          : 0,
        collector: finalFractions.length
          ? Math.max(0.46, Math.min(1, collectorOcrConfidence * 0.66 + collectorConsensus * 0.34))
          : collectorNumbers.length
            ? Math.max(0.38, collectorOcrConfidence * 0.72)
            : 0,
      },
      geometryConfidence: lastGeometryRef.current?.confidence ?? null,
      quality: lastQualityRef.current,
    };
  }

  async function findMatches(
    scan: ExtractedScan,
    cardCanvas: HTMLCanvasElement,
  ): Promise<ScannerCandidate[]> {
    const metadataMap = await ensureSetMetadata();
    const strongHypotheses = scan.nameHypotheses
      .filter((hypothesis) => hypothesis.score >= 0.72)
      .slice(0, 3);

    // This is the main P0 safety rule from the research: a collector number can
    // identify a printing only after the Pokemon identity is believable.
    if (!strongHypotheses.length) return [];

    const correctedNames = uniqueValues(strongHypotheses.map((item) => item.corrected));
    const identityRoots = new Set(
      correctedNames.map((name) => pokemonIdentityCore(name)).filter(Boolean),
    );
    const dictionary = await ensureNameDictionary();
    const identityVariants = dictionary.filter((name) => {
      const root = pokemonIdentityCore(name);
      return root && identityRoots.has(root);
    });
    // Expand only within the same Pokémon/card identity family. This recovers a
    // missed form marker such as "Mega" without reopening dangerous global
    // collector-number searching. Secondary fields decide the exact printing.
    const names = uniqueValues([...correctedNames, ...identityVariants]).slice(0, 40);

    const { data, error: nameError } = await supabase
      .from("pokemon_cards")
      .select(CARD_SELECT)
      .in("name", names)
      .limit(260);

    if (nameError) {
      console.error("Scanner identity search error:", nameError);
      return [];
    }

    const retrieved = ((data || []) as ScannerPokemonCard[]).filter((card) =>
      names.some((name) => normaliseText(name) === normaliseText(card.name)),
    );
    if (!retrieved.length) return [];

    // First pass identifies the most plausible printings without spending API
    // quota. Only those few cards are lazily hydrated with HP/set metadata.
    const firstPass = retrieved
      .map((card) => scoreCandidate(card, scan, metadataMap))
      .filter((candidate) => !candidate.hardRejected)
      .sort((first, second) => {
        if (second.nameScore !== first.nameScore) return second.nameScore - first.nameScore;
        if (second.collectorScore !== first.collectorScore) return second.collectorScore - first.collectorScore;
        if (second.setScore !== first.setScore) return second.setScore - first.setScore;
        return second.textConfidence - first.textConfidence;
      })
      .slice(0, 12);

    if (!firstPass.length) return [];

    const hydrated = await hydrateScannerCards(firstPass.map((candidate) => candidate.card));
    let rescored = hydrated
      .map((card) => scoreCandidate(card, scan, metadataMap))
      .filter((candidate) => !candidate.hardRejected)
      .sort((first, second) => {
        if (second.nameScore !== first.nameScore) return second.nameScore - first.nameScore;
        if (second.collectorScore !== first.collectorScore) return second.collectorScore - first.collectorScore;
        if (second.setScore !== first.setScore) return second.setScore - first.setScore;
        if (second.hpScore !== first.hpScore) return second.hpScore - first.hpScore;
        return second.textConfidence - first.textConfidence;
      })
      .slice(0, 8);

    rescored = await rerankWithArtwork(rescored, cardCanvas);
    const valid = rescored.filter((candidate) => !candidate.hardRejected);
    if (!valid.length) return [];

    const best = valid[0];
    return valid
      .filter((candidate, index) => {
        if (index === 0) return true;
        if (candidate.nameScore < Math.max(0.72, best.nameScore - 0.08)) return false;
        return candidate.confidence >= Math.max(54, best.confidence - 16);
      })
      .slice(0, 3);
  }

  async function processCanvas(cardCanvas: HTMLCanvasElement) {
    setError("");
    const scan = await recogniseCard(cardCanvas);
    setScanDetails(scan);
    setState("matching");
    setProgress(82);
    setStatus("Finding the exact printing");
    const matches = await findMatches(scan, cardCanvas);
    setCandidates(matches);
    setProgress(100);
    setState("results");

    if (!matches.length) {
      if (!scan.nameHypotheses.length) {
        setStatus("Could not read a believable Pokémon name — review or rescan");
      } else {
        setStatus("Pokémon identity was read, but no safe printing matched — check catalogue or review");
      }
    } else if (
      matches[0].confidence >= 94 &&
      (matches.length === 1 || matches[0].confidence - matches[1].confidence >= 8)
    )
      setStatus("High-confidence match found");
    else if (matches[0].confidence >= 82) setStatus("Likely match found");
    else setStatus("Review the closest matches");

    return { scan, matches };
  }

  async function startCamera(mode: "manual" | "handsfree") {
    if (disabled || scanning) return;
    setError("");
    setCandidates([]);
    setCapturedImage("");
    setScanDetails(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("This browser does not provide camera access. Use Upload photo instead.");
      return;
    }

    try {
      stopCamera();
      setState("camera");
      setHandsFree(mode === "handsfree");
      setCameraOpen(true);
      setStatus("Requesting camera access");

      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
      });

      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
            exposureMode?: string[];
            whiteBalanceMode?: string[];
          };
          const advanced: MediaTrackConstraintSet[] = [];
          if (capabilities?.focusMode?.includes("continuous")) {
            advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
          }
          if (capabilities?.exposureMode?.includes("continuous")) {
            advanced.push({ exposureMode: "continuous" } as MediaTrackConstraintSet);
          }
          if (capabilities?.whiteBalanceMode?.includes("continuous")) {
            advanced.push({ whiteBalanceMode: "continuous" } as MediaTrackConstraintSet);
          }
          if (advanced.length) await videoTrack.applyConstraints({ advanced });
        } catch {
          // Camera controls vary by Safari/Chrome/device. Recognition continues without them.
        }
      }

      if (!videoRef.current) throw new Error("The camera viewer was not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (mode === "handsfree") {
        setPhase("calibrating");
        baselineRef.current = null;
        calibrationFramesRef.current = [];
        calibrationNoiseRef.current = [];
        previousFrameRef.current = null;
        previousGeometryRef.current = null;
        lastGeometryRef.current = null;
        baselineGeometryRef.current = null;
        lastQualityRef.current = null;
        stableFramesRef.current = 0;
        presenceFramesRef.current = 0;
        removalFramesRef.current = 0;
        presenceThresholdRef.current = AUTO_MIN_PRESENCE_THRESHOLD;
        stableThresholdRef.current = 2.8;
        setStatus("Keep the guide empty for one second to calibrate");
      } else {
        setPhase("off");
        setStatus("Place one card inside the frame");
      }
    } catch (cameraError: unknown) {
      stopCamera();
      setState("error");
      setError(
        cameraError instanceof Error
          ? cameraError.message
          : "Camera access failed. Check browser permission or upload a photo.",
      );
    }
  }

  async function captureManual() {
    if (!videoRef.current || scanning) return;
    try {
      const canvas = captureLiveCardCanvas();
      const preview = canvas.toDataURL("image/jpeg", 0.92);
      stopCamera();
      setCapturedImage(preview);
      setState("captured");
      await processCanvas(canvas);
    } catch (captureError: unknown) {
      setState("error");
      setError(captureError instanceof Error ? captureError.message : "The card could not be captured.");
    }
  }

  async function processHandsFreeCapture(canvas: HTMLCanvasElement) {
    if (autoBusyRef.current) return;
    autoBusyRef.current = true;
    setPhase("processing");
    const preview = createReviewPreview(canvas);
    setCapturedImage(preview);

    try {
      const { scan, matches } = await processCanvas(canvas);
      const best = matches[0];

      if (best && onAutoAdd && shouldAutoAdd(matches, scan)) {
        setStatus(`Adding ${best.card.name} to inventory`);
        const result = await onAutoAdd(best.card);
        setRecentAdds((current) => [
          { id: makeId("add"), card: best.card, message: result.message },
          ...current,
        ].slice(0, 8));
        setSessionAddedCount((current) => current + 1);
        setStatus(`${best.card.name} added — remove the card`);
        signal("success");
      } else {
        setReviewQueue((current) => [
          ...current,
          { id: makeId("review"), preview, scan, candidates: matches },
        ].slice(-100));
        setStatus(matches.length ? "Saved for review — remove the card" : "No match; saved for review — remove the card");
        signal("review");
      }
    } catch (scanError: unknown) {
      console.error("Hands-free scanner error:", scanError);
      setReviewQueue((current) => [
        ...current,
        {
          id: makeId("review"),
          preview,
          scan: {
            fullText: "",
            topText: "",
            bottomText: "",
            hpText: "",
            names: [],
            collectorNumbers: [],
            collectorFractions: [],
            hpValues: [],
            setCodes: [],
            printedTotals: [],
            nameHypotheses: [],
            fieldConfidence: { name: 0, hp: 0, collector: 0 },
            geometryConfidence: lastGeometryRef.current?.confidence ?? null,
            quality: lastQualityRef.current,
          },
          candidates: [],
        },
      ].slice(-100));
      setStatus("Scan saved for review — remove the card");
      signal("review");
    } finally {
      autoBusyRef.current = false;
      setState("camera");
      setPhase("remove");
      removalFramesRef.current = 0;
      previousFrameRef.current = null;
    }
  }

  const recalibrateHandsFree = useCallback(() => {
    if (!cameraOpen || !handsFree) return;
    baselineRef.current = null;
    previousFrameRef.current = null;
    previousGeometryRef.current = null;
    lastGeometryRef.current = null;
    baselineGeometryRef.current = null;
    lastQualityRef.current = null;
    calibrationFramesRef.current = [];
    stableFramesRef.current = 0;
    presenceFramesRef.current = 0;
    removalFramesRef.current = 0;
    calibrationNoiseRef.current = [];
    presenceThresholdRef.current = AUTO_MIN_PRESENCE_THRESHOLD;
    stableThresholdRef.current = 2.8;
    setPhase("calibrating");
    setStatus("Keep the guide empty for one second to recalibrate");
  }, [cameraOpen, handsFree, setPhase]);

  useEffect(() => {
    if (!cameraOpen || !handsFree) return;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || autoBusyRef.current || !video.videoWidth || !video.videoHeight) return;

      const liveCrop = getLiveGuideCrop();
      if (!liveCrop) return;
      const current = captureFrameSignature(video, liveCrop);
      if (!current) return;
      const geometry = detectCardGeometry(video, liveCrop);
      const phase = autoPhaseRef.current;

      if (phase === "calibrating") {
        const previous = previousFrameRef.current;
        const noise = previous ? frameDifference(previous, current) : 0;
        previousFrameRef.current = current;

        // Calibration learns the user's actual desk/background. We intentionally
        // do not block calibration just because the background contains a strong
        // rectangle; some card mats and phone stands do. Movement is the only
        // reason to restart this short baseline pass.
        if (previous && noise > 4.2) {
          calibrationFramesRef.current = [];
          calibrationNoiseRef.current = [];
          setStatus("Leave the guide empty and still for calibration");
          return;
        }

        if (previous) calibrationNoiseRef.current.push(noise);
        calibrationFramesRef.current.push(current);

        if (calibrationFramesRef.current.length >= AUTO_CALIBRATION_FRAMES) {
          const baseline = averageFrameSignatures(calibrationFramesRef.current);
          if (!baseline) return;
          baselineRef.current = baseline;
          const noiseSamples = calibrationNoiseRef.current.filter(Number.isFinite);
          const averageNoise = noiseSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, noiseSamples.length);
          presenceThresholdRef.current = Math.max(
            AUTO_MIN_PRESENCE_THRESHOLD,
            Math.min(AUTO_MAX_PRESENCE_THRESHOLD, averageNoise * 4.2 + 1.15),
          );
          stableThresholdRef.current = Math.max(0.65, Math.min(3.4, averageNoise * 2.3 + 0.45));
          calibrationFramesRef.current = [];
          calibrationNoiseRef.current = [];
          stableFramesRef.current = 0;
          presenceFramesRef.current = 0;
          previousFrameRef.current = current;
          previousGeometryRef.current = null;
          baselineGeometryRef.current = geometry && geometry.aspectScore >= 0.58 ? geometry : null;
          setPhase("ready");
          setStatus("Ready — place a card inside the guide");
          signal("ready");
        }
        return;
      }

      const baseline = baselineRef.current;
      if (!baseline) {
        setPhase("calibrating");
        return;
      }

      const presenceDifference = frameDifference(baseline, current);
      const changedFraction = changedPixelFraction(
        baseline,
        current,
        Math.max(0.045, Math.min(0.085, presenceThresholdRef.current / 100 + 0.025)),
      );
      const geometryStrong = Boolean(geometry && geometry.confidence >= AUTO_GEOMETRY_CONFIDENCE && geometry.aspectScore >= 0.58);
      const diagonal = Math.hypot(video.videoWidth, video.videoHeight);
      const backgroundGeometry = baselineGeometryRef.current;
      const geometryNovel = geometryStrong && Boolean(
        !backgroundGeometry ||
        cornerJitter(backgroundGeometry, geometry, diagonal) >= 0.018 ||
        changedFraction >= 0.055 ||
        presenceDifference >= presenceThresholdRef.current * 0.42
      );
      const changedStrong =
        changedFraction >= AUTO_MIN_CHANGED_FRACTION &&
        presenceDifference >= presenceThresholdRef.current * 0.62;
      const cardPresent = geometryNovel || changedStrong;

      if (phase === "ready" || phase === "settling") {
        if (!cardPresent) {
          stableFramesRef.current = 0;
          presenceFramesRef.current = 0;
          previousGeometryRef.current = null;
          setPhase("ready");
          setStatus("Ready — place a card inside the guide");

          // Slowly follow ordinary exposure/white-balance drift only while the
          // guide is confidently empty.
          baseline.values = baseline.values.map(
            (value, index) => value * 0.992 + current.values[index] * 0.008,
          );
          baseline.contrast = baseline.contrast * 0.992 + current.contrast * 0.008;
          previousFrameRef.current = current;
          return;
        }

        presenceFramesRef.current += 1;
        const frameMovement = frameDifference(previousFrameRef.current, current);
        const geometryMovement = cornerJitter(previousGeometryRef.current, geometry, diagonal);
        previousFrameRef.current = current;
        previousGeometryRef.current = geometry;

        if (presenceFramesRef.current < 2) {
          setStatus("Card detected...");
          return;
        }

        setPhase("settling");
        const geometryStable = geometryStrong && geometryMovement <= 0.012;
        const fallbackStable = !geometryStrong && frameMovement <= stableThresholdRef.current;
        const motionStable = frameMovement <= stableThresholdRef.current * 1.8;

        if ((geometryStable && motionStable) || fallbackStable) {
          stableFramesRef.current += 1;
        } else {
          stableFramesRef.current = 0;
        }

        if (geometryStrong) {
          setStatus(
            stableFramesRef.current > 0
              ? `Card locked ${stableFramesRef.current}/${AUTO_STABLE_FRAMES} — hold still`
              : "Card found — hold still",
          );
        } else {
          setStatus("Card detected — aligning...");
        }

        if (stableFramesRef.current >= AUTO_STABLE_FRAMES) {
          stableFramesRef.current = 0;
          presenceFramesRef.current = 0;
          try {
            const canvas = captureLiveCardCanvas();
            const quality = lastQualityRef.current ?? measureCardQuality(canvas);
            // Only reject genuinely unusable captures. Slight glare should lower
            // visual confidence later, not stop a fast bulk workflow.
            if (
              quality.sharpness < 3.8 ||
              quality.clippedRatio > 0.30 ||
              quality.titleGlareRatio > 0.24
            ) {
              setStatus(
                quality.titleGlareRatio > 0.24
                  ? "Too much reflection over the title — tilt the card slightly"
                  : quality.sharpness < 3.8
                    ? "Card is out of focus — hold it still a moment longer"
                    : "Exposure is too harsh — adjust the card or light",
              );
              previousGeometryRef.current = geometry;
              return;
            }
            void processHandsFreeCapture(canvas);
          } catch (captureError: unknown) {
            console.error("Hands-free capture error:", captureError);
            setStatus("Could not flatten the card — hold it inside the guide and try again");
            setPhase("ready");
          }
        }
        return;
      }

      if (phase === "remove") {
        const removed =
          !geometryStrong &&
          changedFraction < 0.09 &&
          presenceDifference < Math.max(1.5, presenceThresholdRef.current * 0.64);
        if (removed) removalFramesRef.current += 1;
        else removalFramesRef.current = 0;

        if (removalFramesRef.current >= AUTO_REMOVAL_FRAMES) {
          removalFramesRef.current = 0;
          previousFrameRef.current = current;
          previousGeometryRef.current = null;
          setCapturedImage("");
          setCandidates([]);
          setScanDetails(null);
          setPhase("ready");
          setStatus("Ready — place the next card inside the guide");
          signal("ready");
        }
      }
    }, AUTO_SAMPLE_MS);

    return () => window.clearInterval(timer);
  }, [
    cameraOpen,
    handsFree,
    getLiveGuideCrop,
    captureLiveCardCanvas,
    setPhase,
    signal,
  ]);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setCandidates([]);
    setScanDetails(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      const geometry = detectCardGeometry(image, null);
      lastGeometryRef.current = geometry;
      const canvas = geometry && geometry.confidence >= 0.40 && geometry.aspectScore >= 0.58
        ? rectifyCard(image, geometry, 756)
        : extractCardCanvas(image);
      lastQualityRef.current = measureCardQuality(canvas);
      setCapturedImage(canvas.toDataURL("image/jpeg", 0.92));
      setState("captured");
      await processCanvas(canvas);
    } catch (uploadError: unknown) {
      setState("error");
      setError(uploadError instanceof Error ? uploadError.message : "The selected card could not be scanned.");
    }
  }

  async function confirmReview(item: ReviewItem, candidate: ScannerCandidate) {
    if (reviewBusyId) return;

    if (!onAutoAdd) {
      onSelect(candidate.card);
      return;
    }

    setReviewBusyId(item.id);
    try {
      const result = await onAutoAdd(candidate.card);
      setReviewQueue((current) => current.filter((entry) => entry.id !== item.id));
      setRecentAdds((current) => [
        { id: makeId("add"), card: candidate.card, message: result.message },
        ...current,
      ].slice(0, 8));
      setSessionAddedCount((current) => current + 1);
      signal("success");
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : "That card could not be added.");
    } finally {
      setReviewBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.075] shadow-[0_35px_100px_rgba(0,0,0,0.3)] backdrop-blur-3xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200/55">Camera intake</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Unown Pulls Card Scanner</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/45">
            Hands-free mode detects a card, waits for it to stop moving, scans it and rearms only after the card leaves the frame.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/30">Scanner status</p>
          <p className="mt-1 max-w-sm text-sm font-black text-white/80">{status}</p>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] md:p-8">
        <div>
          <div ref={cameraViewportRef} className="relative flex min-h-[34rem] items-center justify-center overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-black/40 via-emerald-950/30 to-black/40">
            {cameraOpen ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-black/20" />
                <div ref={cardGuideRef} className="pointer-events-none relative aspect-[63/88] h-[78%] max-w-[78%] rounded-[2rem] border-2 border-cyan-200/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28),0_0_45px_rgba(165,243,252,0.3)]">
                  <span className="absolute -left-1 -top-1 h-12 w-12 rounded-tl-[2rem] border-l-4 border-t-4 border-white" />
                  <span className="absolute -right-1 -top-1 h-12 w-12 rounded-tr-[2rem] border-r-4 border-t-4 border-white" />
                  <span className="absolute -bottom-1 -left-1 h-12 w-12 rounded-bl-[2rem] border-b-4 border-l-4 border-white" />
                  <span className="absolute -bottom-1 -right-1 h-12 w-12 rounded-br-[2rem] border-b-4 border-r-4 border-white" />
                </div>

                {handsFree ? (
                  <div className="absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/15 bg-black/65 px-4 py-3 backdrop-blur-xl">
                    <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-cyan-100/45">Hands-free intake</p>
                    <p className="mt-1 text-xs font-bold text-white/75">{autoIntakeLabel}</p>
                    <p className="mt-1 text-[0.68rem] font-semibold text-white/35">
                      Auto-add only happens for strong matches. Anything uncertain goes to Review.
                    </p>
                  </div>
                ) : null}

                {capturedImage && handsFree && autoPhase === "processing" ? (
                  <div className="absolute right-4 top-4 h-36 w-24 overflow-hidden rounded-xl border border-cyan-100/25 bg-black/50 p-1 shadow-2xl">
                    <img src={capturedImage} alt="Current card scan" className="h-full w-full object-contain" />
                  </div>
                ) : null}

                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
                  {!handsFree ? (
                    <button
                      type="button"
                      onClick={() => void captureManual()}
                      disabled={scanning}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-cyan-200 shadow-[0_0_35px_rgba(165,243,252,0.4)] transition hover:scale-105 disabled:opacity-40"
                      aria-label="Capture card"
                    >
                      <span className="h-10 w-10 rounded-full bg-white" />
                    </button>
                  ) : null}

                  {handsFree ? (
                    <button
                      type="button"
                      onClick={recalibrateHandsFree}
                      disabled={autoPhase === "processing"}
                      className="flex h-14 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-300/10 px-4 text-sm font-black text-cyan-50 backdrop-blur-xl disabled:opacity-40"
                    >
                      Recalibrate
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={resetScanner}
                    className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-black/65 px-5 font-black text-white backdrop-blur-xl"
                  >
                    Stop scanner
                  </button>
                </div>
              </>
            ) : capturedImage ? (
              <>
                <img src={capturedImage} alt="Captured Pokemon card" className="absolute inset-0 h-full w-full object-contain p-5" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <button
                  type="button"
                  onClick={resetScanner}
                  disabled={scanning}
                  className="absolute bottom-5 right-5 rounded-2xl border border-white/15 bg-black/55 px-5 py-3 font-black text-white backdrop-blur-xl disabled:opacity-40"
                >
                  Scan another
                </button>
              </>
            ) : (
              <div className="relative z-10 flex max-w-lg flex-col items-center px-6 text-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-cyan-200/20 bg-cyan-300/10 text-5xl shadow-[0_0_55px_rgba(165,243,252,0.12)]">◉</div>
                <h3 className="mt-7 text-2xl font-black text-white">Build inventory without touching the phone</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-white/45">
                  Put the phone on a stand, start Hands-free, leave the guide empty for calibration, then pass one card at a time through the frame.
                </p>

                <div className="mt-7 grid w-full gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void startCamera("handsfree")}
                    disabled={disabled}
                    className="min-h-14 rounded-2xl border border-cyan-100/25 bg-cyan-200 px-5 font-black text-cyan-950 transition hover:-translate-y-0.5 hover:bg-cyan-100 disabled:opacity-40"
                  >
                    Start hands-free
                  </button>
                  <button
                    type="button"
                    onClick={() => void startCamera("manual")}
                    disabled={disabled}
                    className="min-h-14 rounded-2xl border border-white/15 bg-white/[0.07] px-5 font-black text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    Manual camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="min-h-14 rounded-2xl border border-white/15 bg-white/[0.07] px-5 font-black text-white transition hover:bg-white/10 disabled:opacity-40 sm:col-span-2"
                  >
                    Upload photo
                  </button>
                </div>
              </div>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />

          {(scanning || autoPhase === "processing") && (
            <div className="mt-5 rounded-[1.75rem] border border-cyan-200/15 bg-cyan-300/[0.06] p-5">
              <div className="flex items-center justify-between gap-4 text-sm font-black">
                <span className="text-cyan-100">{status}</span>
                <span className="text-white/40">{progress}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/10 bg-black/30 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-200 to-emerald-200 shadow-[0_0_20px_rgba(165,243,252,0.45)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-5 rounded-[1.75rem] border border-red-300/20 bg-red-500/10 px-5 py-4 font-bold text-red-100">{error}</div>
          ) : null}
        </div>

        <div className="min-h-[34rem] space-y-5 rounded-[2.25rem] border border-white/10 bg-black/15 p-5 md:p-6">
          {handsFree || reviewQueue.length > 0 || recentAdds.length > 0 ? (
            <>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Batch intake</p>
                <h3 className="mt-2 text-2xl font-black text-white">Hands-free session</h3>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/30">Added</span>
                  <strong className="mt-1 block text-xl text-emerald-200">{sessionAddedCount}</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/30">Review</span>
                  <strong className="mt-1 block text-xl text-amber-200">{reviewQueue.length}</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/30">Mode</span>
                  <strong className="mt-1 block truncate text-sm text-cyan-100">{handsFree ? "AUTO" : "PAUSED"}</strong>
                </div>
              </div>

              {reviewQueue.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-white">Needs review</h4>
                    <span className="text-xs font-bold text-white/35">Only uncertain scans stop here</span>
                  </div>
                  <div className="mt-3 max-h-[31rem] space-y-3 overflow-y-auto pr-1">
                    {reviewQueue.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.05] p-3">
                        <div className="flex gap-3">
                          <img src={item.preview} alt="Uncertain scan" className="h-28 w-20 flex-none rounded-xl border border-white/10 object-contain bg-black/25 p-1" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-100/45">
                              {item.scan.nameHypotheses[0]
                                ? `Read “${item.scan.nameHypotheses[0].raw}” · suggests ${item.scan.nameHypotheses[0].corrected}`
                                : item.scan.names[0]
                                  ? `Read “${item.scan.names[0]}”`
                                  : "Name unclear"}
                            </p>
                            <div className="mt-2 space-y-2">
                              {item.candidates.length ? item.candidates.map((candidate) => (
                                <button
                                  key={candidate.card.id}
                                  type="button"
                                  disabled={reviewBusyId === item.id}
                                  onClick={() => void confirmReview(item, candidate)}
                                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-cyan-100/25 hover:bg-cyan-300/[0.06] disabled:opacity-40"
                                >
                                  <span className="min-w-0">
                                    <strong className="block truncate text-sm text-white">{candidate.card.name}</strong>
                                    <span className="block truncate text-[0.68rem] text-white/35">
                                      {candidate.card.set_name || "Unknown set"}{candidate.card.card_no ? ` · #${candidate.card.card_no}` : ""}{toNumber(candidate.card.hp) > 0 ? ` · ${toNumber(candidate.card.hp)} HP` : ""}
                                    </span>
                                  </span>
                                  <span className="flex-none text-xs font-black text-cyan-100">{candidate.confidence}%</span>
                                </button>
                              )) : (
                                <span className="text-xs font-semibold text-white/35">No safe candidate. Use manual search for this card.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200/10 bg-emerald-300/[0.04] p-5 text-center">
                  <p className="font-black text-emerald-100">No cards waiting for review.</p>
                  <p className="mt-1 text-xs font-semibold text-white/30">Strong matches are being added automatically.</p>
                </div>
              )}

              {recentAdds.length > 0 ? (
                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <summary className="cursor-pointer text-sm font-black text-white/55">Recent automatic adds</summary>
                  <div className="mt-3 space-y-2">
                    {recentAdds.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl bg-black/15 p-2">
                        {item.card.image_url ? <img src={item.card.image_url} alt="" className="h-14 w-10 rounded object-contain" /> : null}
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-white">{item.card.name}</strong>
                          <span className="block truncate text-[0.68rem] text-white/35">{item.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : candidates.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Recognition results</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Confirm the card</h3>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${bestConfidence >= 85 ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100" : "border-amber-200/20 bg-amber-300/10 text-amber-100"}`}>
                  Best {bestConfidence}%
                </span>
              </div>

              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <button
                    key={candidate.card.id}
                    type="button"
                    onClick={() => onSelect(candidate.card)}
                    className="group flex w-full items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-left transition hover:border-emerald-200/25 hover:bg-emerald-300/[0.08]"
                  >
                    <div className="flex h-24 w-17 flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
                      {candidate.card.image_url ? (
                        <img src={candidate.card.image_url} alt={candidate.card.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-2xl">🎴</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-white">{candidate.card.name}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-white/40">
                            {candidate.card.set_name || "Unknown set"}{candidate.card.card_no ? ` · #${candidate.card.card_no}` : ""}{toNumber(candidate.card.hp) > 0 ? ` · ${toNumber(candidate.card.hp)} HP` : ""}
                          </p>
                        </div>
                        <span className={`flex-none rounded-xl px-2.5 py-1.5 text-xs font-black ${index === 0 ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/60"}`}>
                          {candidate.confidence}%
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {candidate.reasons.map((reason) => (
                          <span key={reason} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[0.65rem] font-bold text-white/40">{reason}</span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-bold text-violet-200/70">{candidate.card.rarity || "Unknown rarity"}</span>
                        <span className="text-sm font-black text-emerald-200">{formatCurrency(candidate.card.market_value)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : state === "results" ? (
            <div className="flex min-h-[25rem] flex-col items-center justify-center text-center">
              <div className="text-5xl">⌕</div>
              <h4 className="mt-5 text-xl font-black text-white">No database match</h4>
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/40">Retake with less glare or use manual database search.</p>
            </div>
          ) : (
            <div className="flex min-h-[25rem] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.045] text-4xl">✦</div>
              <h4 className="mt-5 text-xl font-black text-white">Accuracy before speed</h4>
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/40">
                The scanner identifies the card name first, then cross-checks HP, collector number, set total, artwork structure and colour to choose the exact printing. A card number by itself can never select an unrelated card.
              </p>
            </div>
          )}

          {scanDetails && !handsFree ? (
            <details className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <summary className="cursor-pointer text-sm font-black text-white/55">Scanner diagnostics</summary>
              <div className="mt-4 space-y-3 text-xs font-semibold text-white/35">
                <p>Scanner: {SCANNER_VERSION}</p>
                <p>OCR names: {scanDetails.names.join(", ") || "None"} · identity confidence {Math.round(scanDetails.fieldConfidence.name * 100)}%</p>
                <p>
                  Corrections: {scanDetails.nameHypotheses.map((item) => `${item.raw} → ${item.corrected} (${Math.round(item.score * 100)}%, margin ${Math.round(item.margin * 100)}%)`).join(", ") || "None"}
                </p>
                <p>HP: {scanDetails.hpValues.join(", ") || "None"} · OCR confidence {Math.round(scanDetails.fieldConfidence.hp * 100)}%</p>
                <p>Numbers: {scanDetails.collectorNumbers.join(", ") || "None"}</p>
                <p>Fractions: {scanDetails.collectorFractions.map((item) => `${item.numerator}/${item.denominator ?? "?"}`).join(", ") || "None"} · OCR confidence {Math.round(scanDetails.fieldConfidence.collector * 100)}%</p>
                <p>Set codes: {scanDetails.setCodes.join(", ") || "None"}</p>
                <p>Printed totals: {scanDetails.printedTotals.join(", ") || "None"}</p>
                <p>Geometry: {scanDetails.geometryConfidence == null ? "fallback crop" : `${Math.round(scanDetails.geometryConfidence * 100)}%`}</p>
                {scanDetails.quality ? (
                  <p>Quality: sharp {scanDetails.quality.sharpness.toFixed(1)} · clipped {Math.round(scanDetails.quality.clippedRatio * 100)}% · title glare {Math.round(scanDetails.quality.titleGlareRatio * 100)}%</p>
                ) : null}
                {candidates.length ? (
                  <div className="space-y-2">
                    {candidates.map((candidate) => (
                      <div key={`diag-${candidate.card.id}`} className="rounded-xl border border-white/8 bg-black/20 p-3">
                        <strong className="text-white/60">{candidate.card.name}</strong>
                        <p className="mt-1">name {Math.round(candidate.nameScore * 100)} · no. {Math.round(candidate.collectorScore * 100)} · set {Math.round(candidate.setScore * 100)} · HP {Math.round(candidate.hpScore * 100)} · art {candidate.visualConfidence ?? 0}</p>
                        {candidate.visualBreakdown ? (
                          <p>art detail: structure {Math.round(candidate.visualBreakdown.structure * 100)} · edges {Math.round(candidate.visualBreakdown.edge * 100)} · colour {Math.round(candidate.visualBreakdown.colour * 100)} · hash {Math.round(candidate.visualBreakdown.dhash * 100)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[0.65rem] leading-5 text-white/30">{scanDetails.fullText}</pre>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
