import {
  captureFrameFingerprint,
  detectCardGeometry,
  measureCardQuality,
  rectifyCard,
  type CardGeometry,
  type CardQuality,
  type FrameFingerprint,
  type ScannerSourceCrop,
} from "./card-vision";
import { previewCanvas } from "./regions";
import type { TrackedFrame } from "./types";

const CARD_ASPECT_RATIO = 63 / 88;

export function centredCardCrop(width: number, height: number): ScannerSourceCrop {
  let cropHeight = height * 0.86;
  let cropWidth = cropHeight * CARD_ASPECT_RATIO;
  if (cropWidth > width * 0.84) {
    cropWidth = width * 0.84;
    cropHeight = cropWidth / CARD_ASPECT_RATIO;
  }
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export function guideSourceCrop(
  video: HTMLVideoElement,
  viewport: HTMLElement,
  guide: HTMLElement,
): ScannerSourceCrop {
  const viewportRect = viewport.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (!video.videoWidth || !video.videoHeight || !viewportRect.width || !viewportRect.height) {
    return centredCardCrop(video.videoWidth || 1, video.videoHeight || 1);
  }
  const scale = Math.max(
    viewportRect.width / video.videoWidth,
    viewportRect.height / video.videoHeight,
  );
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (viewportRect.width - renderedWidth) / 2;
  const offsetY = (viewportRect.height - renderedHeight) / 2;
  const sourceX = (guideRect.left - viewportRect.left - offsetX) / scale;
  const sourceY = (guideRect.top - viewportRect.top - offsetY) / scale;
  const sourceWidth = guideRect.width / scale;
  const sourceHeight = guideRect.height / scale;
  const mapped = {
    x: Math.max(0, Math.min(video.videoWidth - 1, sourceX)),
    y: Math.max(0, Math.min(video.videoHeight - 1, sourceY)),
    width: Math.max(1, Math.min(video.videoWidth, sourceWidth)),
    height: Math.max(1, Math.min(video.videoHeight, sourceHeight)),
  };
  if (
    mapped.width < video.videoWidth * 0.14 ||
    mapped.height < video.videoHeight * 0.22
  ) {
    return centredCardCrop(video.videoWidth, video.videoHeight);
  }
  return mapped;
}

function cropVideo(
  video: HTMLVideoElement,
  crop: ScannerSourceCrop,
  outputWidth = 756,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(outputWidth / CARD_ASPECT_RATIO);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The scanner could not capture the camera frame.");
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
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function qualityWeight(quality: CardQuality, geometry: CardGeometry | null): number {
  const sharpness = Math.min(1, quality.sharpness / 22);
  const glare = 1 - Math.min(1, quality.titleGlareRatio * 2.5 + quality.artGlareRatio * 0.8);
  const exposure = 1 - Math.min(1, quality.clippedRatio * 2.2);
  const geometryScore = geometry?.confidence ?? 0.48;
  return Math.max(0.12, Math.min(1,
    sharpness * 0.40 + glare * 0.20 + exposure * 0.18 + geometryScore * 0.22,
  ));
}

export function captureTrackedFrame(
  video: HTMLVideoElement,
  crop: ScannerSourceCrop,
): TrackedFrame {
  const started = performance.now();
  const geometry = detectCardGeometry(video, crop);
  const canvas = geometry && geometry.confidence >= 0.36 && geometry.aspectScore >= 0.50
    ? rectifyCard(video, geometry, 756)
    : cropVideo(video, crop, 756);
  const quality = measureCardQuality(canvas);
  return {
    id: `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    canvas,
    preview: previewCanvas(canvas, 280),
    qualityWeight: qualityWeight(quality, geometry),
    geometryConfidence: geometry?.confidence ?? null,
    capturedAt: started,
  };
}

export function frameFingerprint(
  video: HTMLVideoElement,
  crop: ScannerSourceCrop,
): FrameFingerprint | null {
  return captureFrameFingerprint(video, crop);
}

export function frameDifference(
  first: FrameFingerprint | null,
  second: FrameFingerprint | null,
): number {
  if (!first || !second || first.values.length !== second.values.length) return 999;
  let total = 0;
  for (let index = 0; index < first.values.length; index += 1) {
    total += Math.abs(first.values[index] - second.values[index]);
  }
  return total / first.values.length * 100;
}

export function changedFraction(
  baseline: FrameFingerprint | null,
  current: FrameFingerprint | null,
  threshold = 0.035,
): number {
  if (!baseline || !current || baseline.values.length !== current.values.length) return 0;
  let changed = 0;
  let pixels = 0;
  for (let index = 0; index < baseline.values.length; index += 3) {
    const delta = (
      Math.abs(baseline.values[index] - current.values[index]) +
      Math.abs(baseline.values[index + 1] - current.values[index + 1]) +
      Math.abs(baseline.values[index + 2] - current.values[index + 2])
    ) / 3;
    if (delta >= threshold) changed += 1;
    pixels += 1;
  }
  return changed / Math.max(1, pixels);
}

export function averageFingerprints(frames: FrameFingerprint[]): FrameFingerprint | null {
  if (!frames.length) return null;
  const values = new Array<number>(frames[0].values.length).fill(0);
  let contrast = 0;
  for (const frame of frames) {
    if (frame.values.length !== values.length) continue;
    for (let index = 0; index < values.length; index += 1) values[index] += frame.values[index];
    contrast += frame.contrast;
  }
  for (let index = 0; index < values.length; index += 1) values[index] /= frames.length;
  return { values, contrast: contrast / frames.length };
}
