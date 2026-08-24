export type CardRegionName =
  | "name"
  | "nameWide"
  | "hp"
  | "collector"
  | "collectorRight"
  | "footer"
  | "set"
  | "symbol"
  | "artwork";

export type CardRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const CARD_REGIONS: Record<CardRegionName, CardRegion> = {
  // The former regions covered attacks and the weakness bar. Tight lanes keep
  // high-weight OCR away from damage values, retreat costs and copyright years.
  name: { x: 0.18, y: 0.035, width: 0.55, height: 0.075 },
  nameWide: { x: 0.07, y: 0.022, width: 0.82, height: 0.105 },
  hp: { x: 0.69, y: 0.02, width: 0.285, height: 0.08 },
  collector: { x: 0.012, y: 0.922, width: 0.56, height: 0.072 },
  collectorRight: { x: 0.51, y: 0.912, width: 0.475, height: 0.082 },
  footer: { x: 0.008, y: 0.885, width: 0.984, height: 0.108 },
  set: { x: 0.008, y: 0.895, width: 0.68, height: 0.098 },
  symbol: { x: 0.008, y: 0.89, width: 0.255, height: 0.103 },
  artwork: { x: 0.055, y: 0.125, width: 0.89, height: 0.50 },
};

export type PreprocessVariant = "grey" | "adaptive" | "otsu" | "sharpen";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function cropRegion(
  source: HTMLCanvasElement,
  region: CardRegion,
  outputWidth = 900,
): HTMLCanvasElement {
  const sourceX = Math.round(source.width * region.x);
  const sourceY = Math.round(source.height * region.y);
  const sourceWidth = Math.max(1, Math.round(source.width * region.width));
  const sourceHeight = Math.max(1, Math.round(source.height * region.height));
  const outputHeight = Math.max(48, Math.round(outputWidth * sourceHeight / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The scanner could not prepare a card region.");
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
    outputWidth,
    outputHeight,
  );
  return canvas;
}

function otsuThreshold(values: Uint8ClampedArray): number {
  const histogram = new Uint32Array(256);
  for (const value of values) histogram[value] += 1;
  const total = values.length;
  let sum = 0;
  for (let index = 0; index < 256; index += 1) sum += index * histogram[index];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let index = 0; index < 256; index += 1) {
    backgroundWeight += histogram[index];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += index * histogram[index];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = index;
    }
  }
  return threshold;
}

export function preprocessRegion(
  source: HTMLCanvasElement,
  variant: PreprocessVariant,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The scanner could not preprocess a card region.");
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const grey = new Uint8ClampedArray(canvas.width * canvas.height);
  let min = 255;
  let max = 0;
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114);
    grey[pixel] = value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = Math.max(28, max - min);
  const stretched = new Uint8ClampedArray(grey.length);
  for (let index = 0; index < grey.length; index += 1) {
    stretched[index] = clamp(Math.round((grey[index] - min) * 255 / range), 0, 255);
  }
  const threshold = otsuThreshold(stretched);
  const radius = Math.max(7, Math.round(Math.min(canvas.width, canvas.height) * 0.12));
  let integral: Float64Array | null = null;
  if (variant === "adaptive") {
    const stride = canvas.width + 1;
    integral = new Float64Array(stride * (canvas.height + 1));
    for (let y = 1; y <= canvas.height; y += 1) {
      let row = 0;
      for (let x = 1; x <= canvas.width; x += 1) {
        row += stretched[(y - 1) * canvas.width + x - 1];
        integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
      }
    }
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixel = y * canvas.width + x;
      let value = stretched[pixel];
      if (variant === "otsu") value = value > threshold ? 255 : 0;
      if (variant === "adaptive" && integral) {
        const x0 = Math.max(0, x - radius);
        const y0 = Math.max(0, y - radius);
        const x1 = Math.min(canvas.width - 1, x + radius);
        const y1 = Math.min(canvas.height - 1, y + radius);
        const stride = canvas.width + 1;
        const sum = integral[(y1 + 1) * stride + x1 + 1]
          - integral[y0 * stride + x1 + 1]
          - integral[(y1 + 1) * stride + x0]
          + integral[y0 * stride + x0];
        const mean = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
        value = value > mean - 12 ? 255 : 0;
      }
      if (variant === "sharpen") {
        const left = stretched[y * canvas.width + Math.max(0, x - 1)];
        const right = stretched[y * canvas.width + Math.min(canvas.width - 1, x + 1)];
        const top = stretched[Math.max(0, y - 1) * canvas.width + x];
        const bottom = stretched[Math.min(canvas.height - 1, y + 1) * canvas.width + x];
        value = clamp(value * 2.2 - (left + right + top + bottom) * 0.3, 0, 255);
      }
      const target = pixel * 4;
      pixels[target] = value;
      pixels[target + 1] = value;
      pixels[target + 2] = value;
      pixels[target + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function rotateCanvas180(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The scanner could not rotate this card.");
  context.translate(canvas.width, canvas.height);
  context.rotate(Math.PI);
  context.drawImage(source, 0, 0);
  return canvas;
}

export function previewCanvas(source: HTMLCanvasElement, width = 360): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(width * source.height / source.width));
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.76);
}
