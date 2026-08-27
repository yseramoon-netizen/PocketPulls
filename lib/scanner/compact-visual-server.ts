import "server-only";

import sharp from "sharp";

import {
  COMPACT_SAMPLE_DIMENSIONS,
  createCompactFingerprintFromSamples,
  type CompactVisualFingerprint,
} from "./compact-visual";
import { CARD_REGIONS } from "./regions";

const CANONICAL_WIDTH = 756;
const CANONICAL_HEIGHT = 1056;

async function rgbaSample(
  pipeline: sharp.Sharp,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const buffer = await pipeline
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export async function fingerprintReferenceImage(
  bytes: ArrayBuffer | Uint8Array,
): Promise<CompactVisualFingerprint> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const canonicalBytes = await sharp(input)
    .rotate()
    .resize(CANONICAL_WIDTH, CANONICAL_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const regionBox = (region: (typeof CARD_REGIONS)[keyof typeof CARD_REGIONS]) => ({
    left: Math.round(CANONICAL_WIDTH * region.x),
    top: Math.round(CANONICAL_HEIGHT * region.y),
    width: Math.round(CANONICAL_WIDTH * region.width),
    height: Math.round(CANONICAL_HEIGHT * region.height),
  });
  const artworkBox = regionBox(CARD_REGIONS.artwork);
  const nameBox = regionBox(CARD_REGIONS.nameWide);
  const footerBox = regionBox(CARD_REGIONS.footer);
  const [
    fullRgba,
    artworkRgba,
    colourRgba,
    fullHashRgba,
    artworkHashRgba,
    nameRgba,
    footerRgba,
  ] = await Promise.all([
    rgbaSample(
      sharp(canonicalBytes),
      COMPACT_SAMPLE_DIMENSIONS.full.width,
      COMPACT_SAMPLE_DIMENSIONS.full.height,
    ),
    rgbaSample(
      sharp(canonicalBytes).extract(artworkBox),
      COMPACT_SAMPLE_DIMENSIONS.artwork.width,
      COMPACT_SAMPLE_DIMENSIONS.artwork.height,
    ),
    rgbaSample(
      sharp(canonicalBytes).extract(artworkBox),
      COMPACT_SAMPLE_DIMENSIONS.colour.width,
      COMPACT_SAMPLE_DIMENSIONS.colour.height,
    ),
    rgbaSample(
      sharp(canonicalBytes),
      COMPACT_SAMPLE_DIMENSIONS.hash.width,
      COMPACT_SAMPLE_DIMENSIONS.hash.height,
    ),
    rgbaSample(
      sharp(canonicalBytes).extract(artworkBox),
      COMPACT_SAMPLE_DIMENSIONS.hash.width,
      COMPACT_SAMPLE_DIMENSIONS.hash.height,
    ),
    rgbaSample(
      sharp(canonicalBytes).extract(nameBox),
      COMPACT_SAMPLE_DIMENSIONS.name.width,
      COMPACT_SAMPLE_DIMENSIONS.name.height,
    ),
    rgbaSample(
      sharp(canonicalBytes).extract(footerBox),
      COMPACT_SAMPLE_DIMENSIONS.footer.width,
      COMPACT_SAMPLE_DIMENSIONS.footer.height,
    ),
  ]);
  return createCompactFingerprintFromSamples(
    fullRgba,
    artworkRgba,
    colourRgba,
    fullHashRgba,
    artworkHashRgba,
    nameRgba,
    footerRgba,
  );
}
