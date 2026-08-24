import { CARD_REGIONS, cropRegion, rotateCanvas180 } from "./regions";

/**
 * Version 1 reduced artwork to a 12x8 average and converted an uncorrelated
 * Pearson score into 50% similarity. Unrelated cards therefore clustered near
 * 50-55%, which is exactly what the failed diagnostics showed. Version 2 keeps
 * a compact two-stage descriptor: gradient histograms for catalogue retrieval and
 * a normalised artwork structure for discriminative re-ranking.
 */
export const COMPACT_VISUAL_VERSION = 2;

export type CompactVisualFingerprint = {
  version: number;
  full: string;
  artwork: string;
  colour: string;
};

export type CompactVisualDecoded = {
  fullHog: Uint8Array;
  artworkHog: Uint8Array;
  coarseLuma: Uint8Array;
  artworkLuma: Uint8Array;
  colour: Uint8Array;
};

export type CompactVisualComparison = {
  combined: number;
  artwork: number;
  fullCard: number;
  colour: number;
  edge: number;
};

const FULL_WIDTH = 17;
const FULL_HEIGHT = 24;
const ART_WIDTH = 25;
const ART_HEIGHT = 18;
const COLOUR_WIDTH = 12;
const COLOUR_HEIGHT = 8;

const HOG_BINS = 8;
const FULL_HOG_CELLS = { x: 4, y: 6 };
const ART_HOG_CELLS = { x: 5, y: 3 };
const FULL_HOG_BYTES = FULL_HOG_CELLS.x * FULL_HOG_CELLS.y * HOG_BINS;
const ART_HOG_BYTES = ART_HOG_CELLS.x * ART_HOG_CELLS.y * HOG_BINS;
const COARSE_LUMA_BYTES = COLOUR_WIDTH * COLOUR_HEIGHT;
const ART_LUMA_BYTES = ART_WIDTH * ART_HEIGHT;
const COLOUR_BYTES = COLOUR_WIDTH * COLOUR_HEIGHT * 3;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function lumaValues(rgba: Uint8Array | Uint8ClampedArray): Float32Array {
  const output = new Float32Array(Math.floor(rgba.length / 4));
  for (let source = 0, pixel = 0; source < rgba.length; source += 4, pixel += 1) {
    output[pixel] = rgba[source] * 0.299 + rgba[source + 1] * 0.587 + rgba[source + 2] * 0.114;
  }
  return output;
}

function hogBytes(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  cellsX: number,
  cellsY: number,
): Uint8Array {
  const luma = lumaValues(rgba);
  const histogram = new Float32Array(cellsX * cellsY * HOG_BINS);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const dx = luma[index + 1] - luma[index - 1];
      const dy = luma[index + width] - luma[index - width];
      const magnitude = Math.hypot(dx, dy);
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI;
      if (angle >= Math.PI) angle -= Math.PI;
      const cellX = Math.min(cellsX - 1, Math.floor(x / width * cellsX));
      const cellY = Math.min(cellsY - 1, Math.floor(y / height * cellsY));
      const bin = Math.min(HOG_BINS - 1, Math.floor(angle / Math.PI * HOG_BINS));
      histogram[(cellY * cellsX + cellX) * HOG_BINS + bin] += magnitude;
    }
  }
  const output = new Uint8Array(histogram.length);
  for (let cell = 0; cell < cellsX * cellsY; cell += 1) {
    let total = 0;
    for (let bin = 0; bin < HOG_BINS; bin += 1) total += histogram[cell * HOG_BINS + bin];
    for (let bin = 0; bin < HOG_BINS; bin += 1) {
      output[cell * HOG_BINS + bin] = Math.round(
        histogram[cell * HOG_BINS + bin] / Math.max(1, total) * 255,
      );
    }
  }
  return output;
}

function normalisedLumaBytes(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const luma = lumaValues(rgba);
  let mean = 0;
  for (const value of luma) mean += value;
  mean /= Math.max(1, luma.length);
  let variance = 0;
  for (const value of luma) variance += (value - mean) ** 2;
  const deviation = Math.max(6, Math.sqrt(variance / Math.max(1, luma.length)));
  const output = new Uint8Array(luma.length);
  for (let index = 0; index < luma.length; index += 1) {
    output[index] = Math.round(clamp(128 + (luma[index] - mean) / deviation * 34, 1, 255));
  }
  return output;
}

function colourBytes(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const output = new Uint8Array(Math.floor(rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    const total = Math.max(36, rgba[source] + rgba[source + 1] + rgba[source + 2]);
    output[target] = Math.round(rgba[source] / total * 255);
    output[target + 1] = Math.round(rgba[source + 1] / total * 255);
    output[target + 2] = Math.round(rgba[source + 2] / total * 255);
  }
  return output;
}

function sampleCanvas(source: HTMLCanvasElement, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Visual fingerprint canvas is unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

export function createCompactFingerprintFromSamples(
  fullRgba: Uint8Array | Uint8ClampedArray,
  artworkRgba: Uint8Array | Uint8ClampedArray,
  colourRgba: Uint8Array | Uint8ClampedArray,
): CompactVisualFingerprint {
  const fullHog = hogBytes(
    fullRgba,
    FULL_WIDTH,
    FULL_HEIGHT,
    FULL_HOG_CELLS.x,
    FULL_HOG_CELLS.y,
  );
  const artworkHog = hogBytes(
    artworkRgba,
    ART_WIDTH,
    ART_HEIGHT,
    ART_HOG_CELLS.x,
    ART_HOG_CELLS.y,
  );
  const artworkLuma = normalisedLumaBytes(artworkRgba);
  const coarseLuma = normalisedLumaBytes(colourRgba);
  const full = new Uint8Array(fullHog.length + coarseLuma.length);
  full.set(fullHog);
  full.set(coarseLuma, fullHog.length);
  const artwork = new Uint8Array(artworkHog.length + artworkLuma.length);
  artwork.set(artworkHog);
  artwork.set(artworkLuma, artworkHog.length);
  return {
    version: COMPACT_VISUAL_VERSION,
    full: bytesToBase64(full),
    artwork: bytesToBase64(artwork),
    colour: bytesToBase64(colourBytes(colourRgba)),
  };
}

export function fingerprintCanvas(source: HTMLCanvasElement): CompactVisualFingerprint {
  const artwork = cropRegion(source, CARD_REGIONS.artwork, 720);
  return createCompactFingerprintFromSamples(
    sampleCanvas(source, FULL_WIDTH, FULL_HEIGHT),
    sampleCanvas(artwork, ART_WIDTH, ART_HEIGHT),
    sampleCanvas(artwork, COLOUR_WIDTH, COLOUR_HEIGHT),
  );
}

export function fingerprintCanvasOrientations(
  source: HTMLCanvasElement,
): [CompactVisualFingerprint, CompactVisualFingerprint] {
  return [fingerprintCanvas(source), fingerprintCanvas(rotateCanvas180(source))];
}

export function decodeCompactFingerprint(fingerprint: CompactVisualFingerprint): CompactVisualDecoded {
  if (fingerprint.version !== COMPACT_VISUAL_VERSION) {
    throw new Error(`Unsupported visual fingerprint version ${fingerprint.version}.`);
  }
  const full = base64ToBytes(fingerprint.full);
  const artwork = base64ToBytes(fingerprint.artwork);
  const colour = base64ToBytes(fingerprint.colour);
  if (
    full.length !== FULL_HOG_BYTES + COARSE_LUMA_BYTES ||
    artwork.length !== ART_HOG_BYTES + ART_LUMA_BYTES ||
    colour.length !== COLOUR_BYTES
  ) {
    throw new Error("Visual fingerprint dimensions are invalid.");
  }
  return {
    fullHog: full.slice(0, FULL_HOG_BYTES),
    coarseLuma: full.slice(FULL_HOG_BYTES),
    artworkHog: artwork.slice(0, ART_HOG_BYTES),
    artworkLuma: artwork.slice(ART_HOG_BYTES),
    colour,
  };
}

function correlationAtShift(
  first: Uint8Array,
  second: Uint8Array,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): number {
  const fromY = Math.max(0, -offsetY);
  const toY = Math.min(height, height - offsetY);
  const fromX = Math.max(0, -offsetX);
  const toX = Math.min(width, width - offsetX);
  let count = 0;
  let firstSum = 0;
  let secondSum = 0;
  let firstSquared = 0;
  let secondSquared = 0;
  let product = 0;
  for (let y = fromY; y < toY; y += 1) {
    for (let x = fromX; x < toX; x += 1) {
      const left = first[y * width + x];
      const right = second[(y + offsetY) * width + x + offsetX];
      count += 1;
      firstSum += left;
      secondSum += right;
      firstSquared += left * left;
      secondSquared += right * right;
      product += left * right;
    }
  }
  if (!count) return 0;
  const dot = product - firstSum * secondSum / count;
  const firstMagnitude = firstSquared - firstSum * firstSum / count;
  const secondMagnitude = secondSquared - secondSum * secondSum / count;
  if (!firstMagnitude || !secondMagnitude) return 0;
  return clamp(dot / Math.sqrt(firstMagnitude * secondMagnitude));
}

function shiftedCorrelation(
  first: Uint8Array,
  second: Uint8Array,
  width: number,
  height: number,
  radius: number,
): number {
  let best = 0;
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      best = Math.max(best, correlationAtShift(
        first,
        second,
        width,
        height,
        offsetX,
        offsetY,
      ));
    }
  }
  return best;
}

function cosine(first: Uint8Array, second: Uint8Array): number {
  if (first.length !== second.length || !first.length) return 0;
  let dot = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstMagnitude += first[index] * first[index];
    secondMagnitude += second[index] * second[index];
  }
  if (!firstMagnitude || !secondMagnitude) return 0;
  return clamp(dot / Math.sqrt(firstMagnitude * secondMagnitude));
}

function discriminativeHogSimilarity(first: Uint8Array, second: Uint8Array): number {
  return clamp((cosine(first, second) - 0.50) / 0.42);
}

function gradientVectors(values: Uint8Array): { horizontal: Uint8Array; vertical: Uint8Array } {
  const horizontal = new Uint8Array((ART_WIDTH - 1) * ART_HEIGHT);
  const vertical = new Uint8Array(ART_WIDTH * (ART_HEIGHT - 1));
  let target = 0;
  for (let y = 0; y < ART_HEIGHT; y += 1) {
    for (let x = 0; x < ART_WIDTH - 1; x += 1) {
      const index = y * ART_WIDTH + x;
      horizontal[target++] = clamp(values[index + 1] - values[index] + 128, 0, 255);
    }
  }
  target = 0;
  for (let y = 0; y < ART_HEIGHT - 1; y += 1) {
    for (let x = 0; x < ART_WIDTH; x += 1) {
      const index = y * ART_WIDTH + x;
      vertical[target++] = clamp(values[index + ART_WIDTH] - values[index] + 128, 0, 255);
    }
  }
  return { horizontal, vertical };
}

function edgeSimilarity(first: Uint8Array, second: Uint8Array): number {
  const left = gradientVectors(first);
  const right = gradientVectors(second);
  return (
    shiftedCorrelation(left.horizontal, right.horizontal, ART_WIDTH - 1, ART_HEIGHT, 3) +
    shiftedCorrelation(left.vertical, right.vertical, ART_WIDTH, ART_HEIGHT - 1, 3)
  ) / 2;
}

function colourSimilarity(first: Uint8Array, second: Uint8Array): number {
  if (first.length !== second.length || !first.length) return 0;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference += Math.abs(first[index] - second[index]);
  return clamp(Math.exp(-(difference / first.length) / 30));
}

export function compareCompactCoarse(
  first: CompactVisualDecoded,
  second: CompactVisualDecoded,
): number {
  const structure = shiftedCorrelation(
    first.coarseLuma,
    second.coarseLuma,
    COLOUR_WIDTH,
    COLOUR_HEIGHT,
    1,
  );
  const artwork = cosine(first.artworkHog, second.artworkHog);
  const full = cosine(first.fullHog, second.fullHog);
  const colour = colourSimilarity(first.colour, second.colour);
  return clamp(structure * 0.62 + artwork * 0.25 + full * 0.05 + colour * 0.08);
}

export function compareCompactDecoded(
  first: CompactVisualDecoded,
  second: CompactVisualDecoded,
): CompactVisualComparison {
  const artwork = shiftedCorrelation(first.artworkLuma, second.artworkLuma, ART_WIDTH, ART_HEIGHT, 3);
  const edge = edgeSimilarity(first.artworkLuma, second.artworkLuma);
  const fullCard = discriminativeHogSimilarity(first.fullHog, second.fullHog);
  const artworkHog = discriminativeHogSimilarity(first.artworkHog, second.artworkHog);
  const hash = artworkHog * 0.78 + fullCard * 0.22;
  const colour = colourSimilarity(first.colour, second.colour);
  return {
    combined: clamp(artwork * 0.52 + edge * 0.23 + hash * 0.17 + colour * 0.08),
    artwork,
    fullCard,
    colour,
    edge,
  };
}

export const COMPACT_SAMPLE_DIMENSIONS = {
  full: { width: FULL_WIDTH, height: FULL_HEIGHT },
  artwork: { width: ART_WIDTH, height: ART_HEIGHT },
  colour: { width: COLOUR_WIDTH, height: COLOUR_HEIGHT },
} as const;
