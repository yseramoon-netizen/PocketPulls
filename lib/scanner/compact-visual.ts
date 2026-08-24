import { CARD_REGIONS, cropRegion, rotateCanvas180 } from "./regions";

export const COMPACT_VISUAL_VERSION = 1;

export type CompactVisualFingerprint = {
  version: number;
  full: string;
  artwork: string;
  colour: string;
};

export type CompactVisualDecoded = {
  full: Uint8Array;
  artwork: Uint8Array;
  colour: Uint8Array;
};

export type CompactVisualComparison = {
  combined: number;
  artwork: number;
  fullCard: number;
  colour: number;
  edge: number;
};

const FULL_WIDTH = 12;
const FULL_HEIGHT = 17;
const ART_WIDTH = 12;
const ART_HEIGHT = 8;
const COLOUR_WIDTH = 6;
const COLOUR_HEIGHT = 4;

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

function structureBytes(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const luma = new Float32Array(Math.floor(rgba.length / 4));
  let mean = 0;
  for (let source = 0, pixel = 0; source < rgba.length; source += 4, pixel += 1) {
    const value = rgba[source] * 0.299 + rgba[source + 1] * 0.587 + rgba[source + 2] * 0.114;
    luma[pixel] = value;
    mean += value;
  }
  mean /= Math.max(1, luma.length);
  let variance = 0;
  for (const value of luma) variance += (value - mean) ** 2;
  const deviation = Math.max(8, Math.sqrt(variance / Math.max(1, luma.length)));
  const output = new Uint8Array(luma.length);
  for (let index = 0; index < luma.length; index += 1) {
    output[index] = Math.max(1, Math.min(255, Math.round(128 + (luma[index] - mean) / deviation * 38)));
  }
  return output;
}

function colourBytes(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const output = new Uint8Array(Math.floor(rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    const total = Math.max(48, rgba[source] + rgba[source + 1] + rgba[source + 2]);
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
  return {
    version: COMPACT_VISUAL_VERSION,
    full: bytesToBase64(structureBytes(fullRgba)),
    artwork: bytesToBase64(structureBytes(artworkRgba)),
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
  const decoded = {
    full: base64ToBytes(fingerprint.full),
    artwork: base64ToBytes(fingerprint.artwork),
    colour: base64ToBytes(fingerprint.colour),
  };
  if (
    decoded.full.length !== FULL_WIDTH * FULL_HEIGHT ||
    decoded.artwork.length !== ART_WIDTH * ART_HEIGHT ||
    decoded.colour.length !== COLOUR_WIDTH * COLOUR_HEIGHT * 3
  ) {
    throw new Error("Visual fingerprint dimensions are invalid.");
  }
  return decoded;
}

function structureSimilarity(first: Uint8Array, second: Uint8Array): number {
  if (first.length !== second.length || !first.length) return 0;
  let dot = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;
  for (let index = 0; index < first.length; index += 1) {
    const left = first[index] - 128;
    const right = second[index] - 128;
    dot += left * right;
    firstMagnitude += left * left;
    secondMagnitude += right * right;
  }
  if (!firstMagnitude || !secondMagnitude) return 0;
  return clamp((dot / Math.sqrt(firstMagnitude * secondMagnitude) + 1) / 2);
}

function edgeSimilarity(first: Uint8Array, second: Uint8Array, width: number): number {
  if (first.length !== second.length || first.length <= width) return 0;
  let difference = 0;
  let count = 0;
  for (let index = width + 1; index < first.length; index += 1) {
    if (index % width === 0) continue;
    const firstEdge = Math.abs(first[index] - first[index - 1]) + Math.abs(first[index] - first[index - width]);
    const secondEdge = Math.abs(second[index] - second[index - 1]) + Math.abs(second[index] - second[index - width]);
    difference += Math.abs(firstEdge - secondEdge);
    count += 1;
  }
  return clamp(1 - difference / Math.max(1, count) / 92);
}

function colourSimilarity(first: Uint8Array, second: Uint8Array): number {
  if (first.length !== second.length || !first.length) return 0;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference += Math.abs(first[index] - second[index]);
  return clamp(1 - difference / first.length / 105);
}

export function compareCompactDecoded(
  first: CompactVisualDecoded,
  second: CompactVisualDecoded,
): CompactVisualComparison {
  const artwork = structureSimilarity(first.artwork, second.artwork);
  const fullCard = structureSimilarity(first.full, second.full);
  const colour = colourSimilarity(first.colour, second.colour);
  const edge = edgeSimilarity(first.artwork, second.artwork, ART_WIDTH);
  return {
    combined: clamp(artwork * 0.48 + fullCard * 0.25 + colour * 0.19 + edge * 0.08),
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
