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

export type ScannerPokemonCard = {
  id: string;
  name: string;
  rarity: string | null;
  set_name: string | null;
  card_no: string | null;
  image_url: string | null;
  market_value: number | string | null;
  api_id: string | null;
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
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
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
};

type ExtractedScan = {
  fullText: string;
  topText: string;
  bottomText: string;
  names: string[];
  collectorNumbers: string[];
  nameHypotheses: NameHypothesis[];
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

type FrameSignature = {
  values: number[];
  contrast: number;
};

const CARD_ASPECT_RATIO = 63 / 88;
const AUTO_SAMPLE_MS = 190;
const AUTO_CALIBRATION_FRAMES = 7;
const AUTO_MIN_PRESENCE_THRESHOLD = 3.2;
const AUTO_STABLE_THRESHOLD = 3.4;
const AUTO_STABLE_FRAMES = 3;
const AUTO_REMOVAL_FRAMES = 2;

const CARD_SELECT = `
  id,
  name,
  rarity,
  set_name,
  card_no,
  image_url,
  market_value,
  api_id
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

function cleanSearchValue(value: string): string {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function pokemonNameSimilarity(first: string, second: string): number {
  const full = basicSimilarity(first, second);
  const coreFirst = nameCore(first);
  const coreSecond = nameCore(second);
  const core = basicSimilarity(coreFirst, coreSecond);
  const grams = bigramSimilarity(coreFirst || first, coreSecond || second);
  const prefix =
    coreFirst.length >= 2 && coreSecond.length >= 2 && coreFirst.slice(0, 2) === coreSecond.slice(0, 2)
      ? 0.04
      : 0;

  return Math.max(full, Math.min(1, core * 0.7 + grams * 0.3 + prefix));
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
    const left = match[1].replace(/\s+/g, "").trim();
    if (left) {
      results.push(left, normaliseCollector(left));
    }
  }

  const promoPattern = /\b(SVP|SWSH|SM|XY|BW|DP|HGSS)\s*-?\s*(\d{1,4})\b/gi;
  for (const match of text.matchAll(promoPattern)) {
    results.push(`${match[1]}${match[2]}`);
  }

  return uniqueValues(results).filter((value) => value.length <= 10).slice(0, 8);
}

function buildNameHypotheses(rawNames: string[], dictionary: string[]): NameHypothesis[] {
  if (rawNames.length === 0 || dictionary.length === 0) return [];

  const output: NameHypothesis[] = [];

  for (const raw of rawNames.slice(0, 6)) {
    let bestName = "";
    let bestScore = 0;

    for (const databaseName of dictionary) {
      const score = pokemonNameSimilarity(raw, databaseName);
      if (score > bestScore) {
        bestScore = score;
        bestName = databaseName;
      }
    }

    const rawLength = normaliseText(raw).length;
    const threshold = rawLength >= 7 ? 0.58 : rawLength >= 5 ? 0.64 : 0.72;

    if (bestName && bestScore >= threshold) {
      output.push({ raw, corrected: bestName, score: bestScore });
    }
  }

  return output
    .sort((first, second) => second.score - first.score)
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

function sourceDimensions(source: HTMLCanvasElement | HTMLImageElement): { width: number; height: number } {
  return source instanceof HTMLCanvasElement
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

function createDifferenceHash(
  source: HTMLCanvasElement | HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
): number[] {
  const hashWidth = 20;
  const hashHeight = 26;
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
  canvas.width = 32;
  canvas.height = 40;
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
  const bins = Array.from({ length: 125 }, () => 0);
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const r = Math.min(4, Math.floor(data[index] / 51.2));
    const g = Math.min(4, Math.floor(data[index + 1] / 51.2));
    const b = Math.min(4, Math.floor(data[index + 2] / 51.2));
    bins[r * 25 + g * 5 + b] += 1;
    count += 1;
  }

  return count ? bins.map((value) => value / count) : bins;
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

function scoreCandidate(card: ScannerPokemonCard, scan: ExtractedScan): ScannerCandidate {
  let rawNameScore = 0;
  for (const rawName of scan.names) {
    rawNameScore = Math.max(rawNameScore, pokemonNameSimilarity(card.name, rawName));
  }

  let correctedNameScore = 0;
  let correctedExact = false;
  for (const hypothesis of scan.nameHypotheses) {
    const candidateSimilarity = pokemonNameSimilarity(card.name, hypothesis.corrected);
    correctedNameScore = Math.max(
      correctedNameScore,
      candidateSimilarity * (0.72 + hypothesis.score * 0.28),
    );
    if (normaliseText(card.name) === normaliseText(hypothesis.corrected)) {
      correctedExact = true;
    }
  }

  const nameScore = Math.max(rawNameScore, correctedExact ? 1 : correctedNameScore);
  const cardCollector = normaliseCollector(card.card_no || "");
  let collectorScore = 0;

  for (const scannedCollector of scan.collectorNumbers) {
    const normalisedScanned = normaliseCollector(scannedCollector);

    if (cardCollector && normalisedScanned === cardCollector) {
      collectorScore = 1;
      break;
    }

    if (
      cardCollector &&
      normalisedScanned &&
      (cardCollector.endsWith(normalisedScanned) || normalisedScanned.endsWith(cardCollector))
    ) {
      collectorScore = Math.max(collectorScore, 0.68);
    }
  }

  const hasStrongNameHypothesis =
    scan.nameHypotheses.some((hypothesis) => hypothesis.score >= 0.64) ||
    scan.names.some((name) => pokemonNameSimilarity(name, card.name) >= 0.72);

  let weightedScore: number;

  if (scan.collectorNumbers.length > 0) {
    weightedScore = nameScore * 0.55 + collectorScore * 0.43 + (correctedExact ? 0.02 : 0);

    // A collector-number hit is not allowed to bulldoze a clearly different Pokemon name.
    if (hasStrongNameHypothesis && nameScore < 0.46) {
      weightedScore = Math.min(weightedScore, 0.28);
    } else if (collectorScore === 0 && nameScore < 0.72) {
      weightedScore = Math.min(weightedScore, 0.5);
    }
  } else {
    weightedScore = nameScore * 0.98 + (correctedExact ? 0.02 : 0);
  }

  const textConfidence = Math.max(1, Math.min(99, Math.round(weightedScore * 100)));
  const reasons: string[] = [];

  if (correctedExact && scan.nameHypotheses[0]) {
    const bestCorrection = scan.nameHypotheses.find(
      (hypothesis) => normaliseText(hypothesis.corrected) === normaliseText(card.name),
    );
    if (bestCorrection && normaliseText(bestCorrection.raw) !== normaliseText(bestCorrection.corrected)) {
      reasons.push(`OCR corrected “${bestCorrection.raw}” → ${bestCorrection.corrected}`);
    } else {
      reasons.push("Pokemon name matched");
    }
  } else if (nameScore >= 0.88) {
    reasons.push("Pokemon name matched closely");
  } else if (nameScore >= 0.68) {
    reasons.push("Pokemon name is plausible");
  }

  if (collectorScore === 1) reasons.push("Collector number matched exactly");
  else if (collectorScore >= 0.65) reasons.push("Collector number is close");

  if (hasStrongNameHypothesis && nameScore < 0.46) {
    reasons.push("Name conflicts with OCR");
  }

  return {
    card,
    confidence: textConfidence,
    textConfidence,
    visualConfidence: null,
    collectorScore,
    nameScore,
    reasons: reasons.length ? reasons : ["Possible database match"],
  };
}

async function rerankWithArtwork(
  candidates: ScannerCandidate[],
  capturedCard: HTMLCanvasElement,
): Promise<ScannerCandidate[]> {
  if (candidates.length <= 1) return candidates;

  const fullCrop = { x: 0.045, y: 0.045, width: 0.91, height: 0.91 };
  const artCrop = { x: 0.07, y: 0.14, width: 0.86, height: 0.50 };
  const capturedFullHash = createDifferenceHash(capturedCard, fullCrop);
  const capturedArtHash = createDifferenceHash(capturedCard, artCrop);
  const capturedColour = createColourHistogram(capturedCard, artCrop);

  if (!capturedFullHash.length || !capturedArtHash.length) return candidates;

  const enriched = await Promise.all(
    candidates.slice(0, 8).map(async (candidate) => {
      const image = await loadRemoteImageForFingerprint(candidate.card.image_url?.trim() || "");
      if (!image) return candidate;

      try {
        const fullHash = compareDifferenceHashes(
          capturedFullHash,
          createDifferenceHash(image, fullCrop),
        );
        const artHash = compareDifferenceHashes(
          capturedArtHash,
          createDifferenceHash(image, artCrop),
        );
        const colour = compareColourHistograms(
          capturedColour,
          createColourHistogram(image, artCrop),
        );

        // Artwork comparison is only a printing discriminator after Pokemon identity.
        // Colour prevents generic card-frame similarities from reporting false strong matches.
        const visualSimilarity = artHash * 0.46 + colour * 0.40 + fullHash * 0.14;
        const visualConfidence = Math.round(visualSimilarity * 100);

        let confidence = candidate.textConfidence;
        if (candidate.nameScore >= 0.82) {
          const adjustment = Math.round((visualSimilarity - 0.58) * 18);
          confidence = Math.max(
            candidate.textConfidence - 7,
            Math.min(candidate.textConfidence + 8, candidate.textConfidence + adjustment),
          );
        }

        if (
          candidate.nameScore >= 0.94 &&
          candidate.collectorScore === 1 &&
          visualConfidence >= 76
        ) {
          confidence = Math.max(confidence, 96);
        }

        const reasons = [...candidate.reasons];
        if (visualConfidence >= 88 && candidate.nameScore >= 0.82) {
          reasons.push("Artwork supports this printing");
        } else if (visualConfidence >= 78 && candidate.nameScore >= 0.82) {
          reasons.push("Artwork looks compatible");
        }

        return {
          ...candidate,
          confidence: Math.max(1, Math.min(99, confidence)),
          visualConfidence,
          reasons,
        };
      } catch {
        return candidate;
      }
    }),
  );

  return enriched.sort((first, second) => {
    if (Math.abs(second.nameScore - first.nameScore) >= 0.04) {
      return second.nameScore - first.nameScore;
    }
    if (second.collectorScore !== first.collectorScore) {
      return second.collectorScore - first.collectorScore;
    }
    if ((second.visualConfidence ?? 0) !== (first.visualConfidence ?? 0)) {
      return (second.visualConfidence ?? 0) - (first.visualConfidence ?? 0);
    }
    return second.confidence - first.confidence;
  });
}

function frameDifference(first: FrameSignature | null, second: FrameSignature | null): number {
  if (!first || !second || first.values.length !== second.values.length) return 999;
  let difference = 0;
  for (let index = 0; index < first.values.length; index += 1) {
    difference += Math.abs(first.values[index] - second.values[index]);
  }
  return difference / first.values.length;
}

function averageFrameSignatures(signatures: FrameSignature[]): FrameSignature | null {
  if (!signatures.length) return null;
  const length = signatures[0].values.length;
  const values = Array.from({ length }, () => 0);

  for (const signature of signatures) {
    if (signature.values.length !== length) continue;
    for (let index = 0; index < length; index += 1) values[index] += signature.values[index];
  }

  for (let index = 0; index < values.length; index += 1) values[index] /= signatures.length;
  return {
    values,
    contrast: signatures.reduce((sum, signature) => sum + signature.contrast, 0) / signatures.length,
  };
}

function captureFrameSignature(video: HTMLVideoElement): FrameSignature | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const crop = getCardCropBounds(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 36;
  canvas.height = 50;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values: number[] = [];
  let sum = 0;

  for (let index = 0; index < data.length; index += 4) {
    const luma = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    values.push(luma);
    sum += luma;
  }

  const mean = sum / Math.max(1, values.length);
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / Math.max(1, values.length);

  return { values, contrast: Math.sqrt(variance) };
}

function shouldAutoAdd(candidates: ScannerCandidate[], scan: ExtractedScan): boolean {
  const best = candidates[0];
  if (!best) return false;

  const margin = candidates.length > 1 ? best.confidence - candidates[1].confidence : 99;
  const exactCollector = best.collectorScore === 1;
  const strongArtwork = (best.visualConfidence ?? 0) >= 84;
  const strongName = best.nameScore >= 0.86;
  const strongCorrection = scan.nameHypotheses.some(
    (hypothesis) =>
      normaliseText(hypothesis.corrected) === normaliseText(best.card.name) && hypothesis.score >= 0.72,
  );

  return (
    best.confidence >= 91 &&
    margin >= 9 &&
    strongName &&
    (exactCollector || strongArtwork) &&
    (strongCorrection || best.nameScore >= 0.94)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const psmRef = useRef<PsmValues | null>(null);
  const workerPromiseRef = useRef<Promise<OcrWorker> | null>(null);
  const mountedRef = useRef(true);
  const nameDictionaryRef = useRef<string[]>([]);
  const nameDictionaryPromiseRef = useRef<Promise<string[]> | null>(null);

  const autoPhaseRef = useRef<AutoPhase>("off");
  const autoBusyRef = useRef(false);
  const baselineRef = useRef<FrameSignature | null>(null);
  const previousFrameRef = useRef<FrameSignature | null>(null);
  const calibrationFramesRef = useRef<FrameSignature[]>([]);
  const stableFramesRef = useRef(0);
  const removalFramesRef = useRef(0);
  const baselineNoiseRef = useRef(1.2);

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
    calibrationFramesRef.current = [];
    stableFramesRef.current = 0;
    removalFramesRef.current = 0;
    baselineNoiseRef.current = 1.2;
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

  async function runRecognition(
    worker: OcrWorker,
    canvas: HTMLCanvasElement,
    mode: "sparse" | "block" | "line",
  ): Promise<string> {
    const psm = psmRef.current;
    if (psm) {
      await worker.setParameters({
        tessedit_pageseg_mode:
          mode === "line" ? psm.SINGLE_LINE : mode === "block" ? psm.SINGLE_BLOCK : psm.SPARSE_TEXT,
      });
    }

    const result = await worker.recognize(canvas);
    return result.data.text || "";
  }

  async function recogniseCard(cardCanvas: HTMLCanvasElement): Promise<ExtractedScan> {
    setState("reading");
    setProgress(3);
    setStatus("Reading the Pokemon name");

    const [worker, dictionary] = await Promise.all([ensureWorker(), ensureNameDictionary()]);

    // Pokemon names sit in the upper title strip, but modern cards vary in layout.
    // Read several overlapping title crops before ever considering the collector number.
    const titleTightGrey = createProcessedRegion(cardCanvas, 0.025, 0.005, 0.95, 0.12, false);
    const titleTightBinary = createProcessedRegion(cardCanvas, 0.025, 0.005, 0.95, 0.12, true);
    const titleWideGrey = createProcessedRegion(cardCanvas, 0.02, 0.0, 0.96, 0.19, false);
    const titleWideBinary = createProcessedRegion(cardCanvas, 0.02, 0.0, 0.96, 0.19, true);

    const numberGrey = createProcessedRegion(cardCanvas, 0.015, 0.825, 0.97, 0.17, false);
    const numberBinary = createProcessedRegion(cardCanvas, 0.015, 0.825, 0.97, 0.17, true);

    const titleReads: string[] = [];
    titleReads.push(await runRecognition(worker, titleTightGrey, "line"));
    setProgress(18);
    titleReads.push(await runRecognition(worker, titleTightBinary, "line"));
    setProgress(30);

    let topText = titleReads.filter(Boolean).join("\n");
    let names = extractNameCandidates(topText, topText);
    let hypotheses = buildNameHypotheses(names, dictionary);

    // If the tight title strip did not produce a believable database name, widen it.
    if (hypotheses.length === 0 || hypotheses[0].score < 0.68) {
      setStatus("Double-checking the Pokemon name");
      titleReads.push(await runRecognition(worker, titleWideGrey, "sparse"));
      setProgress(42);
      titleReads.push(await runRecognition(worker, titleWideBinary, "block"));
      topText = titleReads.filter(Boolean).join("\n");
      names = extractNameCandidates(topText, topText);
      hypotheses = buildNameHypotheses(names, dictionary);
    }

    setStatus("Reading the collector number");
    const numberPrimary = await runRecognition(worker, numberGrey, "sparse");
    setProgress(58);
    const numberSecondary = await runRecognition(worker, numberBinary, "sparse");
    let bottomText = `${numberPrimary}\n${numberSecondary}`;

    let fullText = "";
    let collectorNumbers = extractCollectorNumbers(`${bottomText}\n${topText}`);

    // Last-resort OCR is only for diagnostics / number recovery. It is NOT allowed
    // to invent a Pokemon identity from attacks or rules text.
    if (hypotheses.length === 0 || collectorNumbers.length === 0) {
      setProgress(70);
      setStatus("Checking the card details");
      const fullCanvas = createProcessedRegion(cardCanvas, 0, 0, 1, 1, false);
      fullText = await runRecognition(worker, fullCanvas, "sparse");
      collectorNumbers = extractCollectorNumbers(`${bottomText}\n${topText}\n${fullText}`);

      // Only use lines near the top of the full read as additional name evidence.
      if (hypotheses.length === 0) {
        const fullTop = fullText.split(/\r?\n/).slice(0, 4).join("\n");
        const extraNames = extractNameCandidates(fullTop, fullTop);
        names = uniqueValues([...names, ...extraNames]);
        hypotheses = buildNameHypotheses(names, dictionary);
      }
    }

    const combinedText = [topText, bottomText, fullText].filter(Boolean).join("\n");

    return {
      topText,
      bottomText,
      fullText: combinedText,
      names,
      collectorNumbers,
      nameHypotheses: hypotheses,
    };
  }

  async function findMatches(
    scan: ExtractedScan,
    cardCanvas: HTMLCanvasElement,
  ): Promise<ScannerCandidate[]> {
    const resultMap = new Map<string, ScannerPokemonCard>();
    const correctedNames = uniqueValues(scan.nameHypotheses.map((item) => item.corrected));

    // Identity gate: never let collector number produce unrelated Pokemon.
    // If OCR cannot map the title to a believable Pokemon name, return no result.
    const strongHypotheses = scan.nameHypotheses.filter((item) => item.score >= 0.62);
    if (strongHypotheses.length === 0) {
      return [];
    }

    for (const hypothesis of strongHypotheses.slice(0, 4)) {
      const cleanName = cleanSearchValue(hypothesis.corrected);
      if (cleanName.length < 2) continue;

      const { data, error: nameError } = await supabase
        .from("pokemon_cards")
        .select(CARD_SELECT)
        .ilike("name", cleanName)
        .limit(80);

      if (nameError) {
        console.error("Scanner name search error:", nameError);
        continue;
      }

      for (const card of (data || []) as ScannerPokemonCard[]) {
        resultMap.set(String(card.id), card);
      }
    }

    // If the exact corrected-name query missed because of punctuation / Mega naming,
    // use a prefix search but still only within names related to the OCR identity.
    if (resultMap.size === 0) {
      for (const name of correctedNames.slice(0, 3)) {
        const letters = name.replace(/[^A-Za-z]/g, "");
        const prefix = letters.slice(0, Math.min(6, Math.max(3, letters.length - 2)));
        if (prefix.length < 3) continue;

        const { data, error: prefixError } = await supabase
          .from("pokemon_cards")
          .select(CARD_SELECT)
          .ilike("name", `${prefix}%`)
          .limit(80);

        if (prefixError) continue;
        for (const card of (data || []) as ScannerPokemonCard[]) {
          resultMap.set(String(card.id), card);
        }
      }
    }

    let scored = [...resultMap.values()]
      .map((card) => scoreCandidate(card, scan))
      .filter((candidate) => candidate.nameScore >= 0.58)
      .sort((first, second) => {
        if (Math.abs(second.nameScore - first.nameScore) >= 0.04) {
          return second.nameScore - first.nameScore;
        }
        if (second.collectorScore !== first.collectorScore) {
          return second.collectorScore - first.collectorScore;
        }
        return second.textConfidence - first.textConfidence;
      })
      .slice(0, 8);

    scored = await rerankWithArtwork(scored, cardCanvas);
    if (!scored.length) return [];

    const best = scored[0];
    return scored
      .filter((candidate, index) =>
        index === 0 ||
        (candidate.nameScore >= best.nameScore - 0.10 &&
          candidate.confidence >= Math.max(45, best.confidence - 14)),
      )
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

    if (!matches.length) setStatus("No reliable match was found");
    else if (
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
        },
      });

      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
          };
          if (capabilities?.focusMode?.includes("continuous")) {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
          }
        } catch {
          // Autofocus constraints are optional and browser/device dependent.
        }
      }

      if (!videoRef.current) throw new Error("The camera viewer was not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      if (mode === "handsfree") {
        setPhase("calibrating");
        calibrationFramesRef.current = [];
        previousFrameRef.current = null;
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
      const canvas = extractCardCanvas(videoRef.current);
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
            names: [],
            collectorNumbers: [],
            nameHypotheses: [],
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
    calibrationFramesRef.current = [];
    stableFramesRef.current = 0;
    removalFramesRef.current = 0;
    baselineNoiseRef.current = 1.2;
    setPhase("calibrating");
    setStatus("Keep the guide empty for one second to recalibrate");
  }, [cameraOpen, handsFree, setPhase]);

  useEffect(() => {
    if (!cameraOpen || !handsFree) return;

    const timer = window.setInterval(() => {
      if (!videoRef.current || autoBusyRef.current) return;
      const current = captureFrameSignature(videoRef.current);
      if (!current) return;
      const phase = autoPhaseRef.current;

      if (phase === "calibrating") {
        const previous = previousFrameRef.current;
        const moving = previous ? frameDifference(previous, current) > 5.5 : false;
        previousFrameRef.current = current;

        if (moving) {
          calibrationFramesRef.current = [];
          setStatus("Keep the guide empty and still while calibrating");
          return;
        }

        calibrationFramesRef.current.push(current);
        if (calibrationFramesRef.current.length >= AUTO_CALIBRATION_FRAMES) {
          const calibration = calibrationFramesRef.current;
          baselineRef.current = averageFrameSignatures(calibration);

          const pairDiffs: number[] = [];
          for (let index = 1; index < calibration.length; index += 1) {
            pairDiffs.push(frameDifference(calibration[index - 1], calibration[index]));
          }
          baselineNoiseRef.current = pairDiffs.length
            ? Math.max(0.7, pairDiffs.reduce((sum, value) => sum + value, 0) / pairDiffs.length)
            : 1.2;

          calibrationFramesRef.current = [];
          stableFramesRef.current = 0;
          previousFrameRef.current = current;
          setPhase("ready");
          setStatus("Ready — place a card in the guide");
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
      const presenceThreshold = Math.max(
        AUTO_MIN_PRESENCE_THRESHOLD,
        Math.min(8.5, baselineNoiseRef.current * 3.2 + 1.4),
      );
      const removalThreshold = Math.max(1.8, presenceThreshold * 0.58);

      if (phase === "ready" || phase === "settling") {
        if (presenceDifference < presenceThreshold) {
          stableFramesRef.current = 0;
          setPhase("ready");
          setStatus("Ready — place a card in the guide");

          // Slowly adapt the empty-frame baseline to small lighting changes.
          baseline.values = baseline.values.map((value, index) => value * 0.96 + current.values[index] * 0.04);
          baseline.contrast = baseline.contrast * 0.96 + current.contrast * 0.04;
          previousFrameRef.current = current;
          return;
        }

        const frameMovement = frameDifference(previousFrameRef.current, current);
        previousFrameRef.current = current;
        setPhase("settling");
        setStatus("Card detected — hold still");

        if (frameMovement <= AUTO_STABLE_THRESHOLD) {
          stableFramesRef.current += 1;
        } else {
          stableFramesRef.current = 0;
        }

        if (stableFramesRef.current >= AUTO_STABLE_FRAMES) {
          stableFramesRef.current = 0;
          const canvas = extractCardCanvas(videoRef.current);
          void processHandsFreeCapture(canvas);
        }
        return;
      }

      if (phase === "remove") {
        if (presenceDifference <= removalThreshold) {
          removalFramesRef.current += 1;
        } else {
          removalFramesRef.current = 0;
        }

        if (removalFramesRef.current >= AUTO_REMOVAL_FRAMES) {
          removalFramesRef.current = 0;
          previousFrameRef.current = current;
          setCapturedImage("");
          setCandidates([]);
          setScanDetails(null);
          setPhase("ready");
          setStatus("Ready — place the next card in the guide");
          signal("ready");
        }
      }
    }, AUTO_SAMPLE_MS);

    return () => window.clearInterval(timer);
  }, [cameraOpen, handsFree, setPhase, signal]);

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
      const canvas = extractCardCanvas(image);
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
          <div className="relative flex min-h-[34rem] items-center justify-center overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-black/40 via-emerald-950/30 to-black/40">
            {cameraOpen ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-black/20" />
                <div className="pointer-events-none relative aspect-[63/88] h-[78%] max-w-[78%] rounded-[2rem] border-2 border-cyan-200/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28),0_0_45px_rgba(165,243,252,0.3)]">
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
                                      {candidate.card.set_name || "Unknown set"}{candidate.card.card_no ? ` · #${candidate.card.card_no}` : ""}
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
                            {candidate.card.set_name || "Unknown set"}{candidate.card.card_no ? ` · #${candidate.card.card_no}` : ""}
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
                The scanner corrects OCR against the Pokemon names already in your database, then uses collector number and artwork to identify the printing.
              </p>
            </div>
          )}

          {scanDetails && !handsFree ? (
            <details className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <summary className="cursor-pointer text-sm font-black text-white/55">Scanner diagnostics</summary>
              <div className="mt-4 space-y-3 text-xs font-semibold text-white/35">
                <p>OCR names: {scanDetails.names.join(", ") || "None"}</p>
                <p>
                  Corrections: {scanDetails.nameHypotheses.map((item) => `${item.raw} → ${item.corrected} (${Math.round(item.score * 100)}%)`).join(", ") || "None"}
                </p>
                <p>Numbers: {scanDetails.collectorNumbers.join(", ") || "None"}</p>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[0.65rem] leading-5 text-white/30">{scanDetails.fullText}</pre>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
