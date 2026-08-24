export type ScannerPoint = {
  x: number;
  y: number;
};

export type ScannerSourceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CardGeometry = {
  corners: [ScannerPoint, ScannerPoint, ScannerPoint, ScannerPoint];
  confidence: number;
  aspectScore: number;
  edgeScore: number;
  coverageScore: number;
  sourceCrop: ScannerSourceCrop;
};

export type CardQuality = {
  sharpness: number;
  clippedRatio: number;
  titleGlareRatio: number;
  artGlareRatio: number;
};

export type VisionSignature = {
  dhash: number[];
  edge: number[];
  colourGrid: number[];
  histogram: number[];
  structure: number[];
};

export type VisionComparison = {
  combined: number;
  dhash: number;
  edge: number;
  colour: number;
  histogram: number;
  structure: number;
};

export type FrameFingerprint = {
  values: number[];
  contrast: number;
};

const CARD_ASPECT_RATIO = 63 / 88;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dimensions(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
): { width: number; height: number } {
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.naturalWidth, height: source.naturalHeight };
}

export function expandSourceCrop(
  crop: ScannerSourceCrop,
  sourceWidth: number,
  sourceHeight: number,
  fraction = 0.12,
): ScannerSourceCrop {
  const addX = crop.width * fraction;
  const addY = crop.height * fraction;
  const x = clamp(crop.x - addX, 0, sourceWidth - 1);
  const y = clamp(crop.y - addY, 0, sourceHeight - 1);
  const right = clamp(crop.x + crop.width + addX, x + 1, sourceWidth);
  const bottom = clamp(crop.y + crop.height + addY, y + 1, sourceHeight);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function drawCrop(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  crop: ScannerSourceCrop,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Scanner canvas is unavailable.");
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

function greyPixels(canvas: HTMLCanvasElement): Float32Array {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return new Float32Array();
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const grey = new Float32Array(canvas.width * canvas.height);
  for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel += 1) {
    grey[pixel] = rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114;
  }
  return grey;
}

function fitXByY(
  grey: Float32Array,
  width: number,
  height: number,
  seedX: number,
): { a: number; b: number; score: number; coverage: number } | null {
  const radius = Math.max(5, Math.round(width * 0.055));
  const yStart = Math.round(height * 0.08);
  const yEnd = Math.round(height * 0.92);
  let sw = 0;
  let sy = 0;
  let sx = 0;
  let syy = 0;
  let syx = 0;
  let accepted = 0;
  let strength = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    let bestX = -1;
    let best = 0;
    const from = Math.max(2, Math.round(seedX - radius));
    const to = Math.min(width - 3, Math.round(seedX + radius));
    for (let x = from; x <= to; x += 1) {
      const idx = y * width + x;
      const gx = Math.abs(grey[idx + 1] - grey[idx - 1]);
      if (gx > best) {
        best = gx;
        bestX = x;
      }
    }
    if (bestX < 0 || best < 10) continue;
    const weight = Math.min(80, Math.max(1, best));
    sw += weight;
    sy += weight * y;
    sx += weight * bestX;
    syy += weight * y * y;
    syx += weight * y * bestX;
    accepted += 1;
    strength += best;
  }

  if (accepted < Math.max(12, (yEnd - yStart) / 12) || sw <= 0) return null;
  const denominator = sw * syy - sy * sy;
  const a = Math.abs(denominator) < 1e-6 ? 0 : (sw * syx - sy * sx) / denominator;
  const b = (sx - a * sy) / sw;
  return {
    a,
    b,
    score: clamp(strength / accepted / 42, 0, 1),
    coverage: clamp(accepted / Math.max(1, (yEnd - yStart) / 2), 0, 1),
  };
}

function fitYByX(
  grey: Float32Array,
  width: number,
  height: number,
  seedY: number,
): { a: number; b: number; score: number; coverage: number } | null {
  const radius = Math.max(5, Math.round(height * 0.045));
  const xStart = Math.round(width * 0.08);
  const xEnd = Math.round(width * 0.92);
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let accepted = 0;
  let strength = 0;

  for (let x = xStart; x < xEnd; x += 2) {
    let bestY = -1;
    let best = 0;
    const from = Math.max(2, Math.round(seedY - radius));
    const to = Math.min(height - 3, Math.round(seedY + radius));
    for (let y = from; y <= to; y += 1) {
      const idx = y * width + x;
      const gy = Math.abs(grey[idx + width] - grey[idx - width]);
      if (gy > best) {
        best = gy;
        bestY = y;
      }
    }
    if (bestY < 0 || best < 10) continue;
    const weight = Math.min(80, Math.max(1, best));
    sw += weight;
    sx += weight * x;
    sy += weight * bestY;
    sxx += weight * x * x;
    sxy += weight * x * bestY;
    accepted += 1;
    strength += best;
  }

  if (accepted < Math.max(12, (xEnd - xStart) / 12) || sw <= 0) return null;
  const denominator = sw * sxx - sx * sx;
  const a = Math.abs(denominator) < 1e-6 ? 0 : (sw * sxy - sx * sy) / denominator;
  const b = (sy - a * sx) / sw;
  return {
    a,
    b,
    score: clamp(strength / accepted / 42, 0, 1),
    coverage: clamp(accepted / Math.max(1, (xEnd - xStart) / 2), 0, 1),
  };
}

function intersection(
  vertical: { a: number; b: number },
  horizontal: { a: number; b: number },
): ScannerPoint | null {
  // vertical: x = a*y+b; horizontal: y = a*x+b
  const denominator = 1 - horizontal.a * vertical.a;
  if (Math.abs(denominator) < 1e-6) return null;
  const y = (horizontal.a * vertical.b + horizontal.b) / denominator;
  const x = vertical.a * y + vertical.b;
  return { x, y };
}

function distance(first: ScannerPoint, second: ScannerPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function polygonArea(points: ScannerPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) / 2;
}

function strongestProfilePosition(
  grey: Float32Array,
  width: number,
  height: number,
  axis: "vertical" | "horizontal",
  fromRatio: number,
  toRatio: number,
): { position: number; score: number } | null {
  let bestPosition = -1;
  let best = 0;

  if (axis === "vertical") {
    const from = Math.max(2, Math.round(width * fromRatio));
    const to = Math.min(width - 3, Math.round(width * toRatio));
    for (let x = from; x <= to; x += 1) {
      let total = 0;
      let count = 0;
      for (let y = Math.round(height * 0.1); y < Math.round(height * 0.9); y += 2) {
        const idx = y * width + x;
        total += Math.abs(grey[idx + 1] - grey[idx - 1]);
        count += 1;
      }
      const average = total / Math.max(1, count);
      if (average > best) {
        best = average;
        bestPosition = x;
      }
    }
  } else {
    const from = Math.max(2, Math.round(height * fromRatio));
    const to = Math.min(height - 3, Math.round(height * toRatio));
    for (let y = from; y <= to; y += 1) {
      let total = 0;
      let count = 0;
      for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x += 2) {
        const idx = y * width + x;
        total += Math.abs(grey[idx + width] - grey[idx - width]);
        count += 1;
      }
      const average = total / Math.max(1, count);
      if (average > best) {
        best = average;
        bestPosition = y;
      }
    }
  }

  if (bestPosition < 0) return null;
  return { position: bestPosition, score: clamp(best / 32, 0, 1) };
}

export function detectCardGeometry(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  requestedCrop?: ScannerSourceCrop | null,
): CardGeometry | null {
  const size = dimensions(source);
  if (!size.width || !size.height) return null;

  const baseCrop = requestedCrop ?? {
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
  };
  const crop = requestedCrop
    ? expandSourceCrop(baseCrop, size.width, size.height, 0.14)
    : baseCrop;

  const analysisWidth = 180;
  const analysisHeight = Math.max(180, Math.round(analysisWidth * crop.height / crop.width));
  const canvas = drawCrop(source, crop, analysisWidth, analysisHeight);
  const grey = greyPixels(canvas);
  if (!grey.length) return null;

  const leftSeed = strongestProfilePosition(grey, analysisWidth, analysisHeight, "vertical", 0.02, 0.34);
  const rightSeed = strongestProfilePosition(grey, analysisWidth, analysisHeight, "vertical", 0.66, 0.98);
  const topSeed = strongestProfilePosition(grey, analysisWidth, analysisHeight, "horizontal", 0.02, 0.30);
  const bottomSeed = strongestProfilePosition(grey, analysisWidth, analysisHeight, "horizontal", 0.70, 0.98);
  if (!leftSeed || !rightSeed || !topSeed || !bottomSeed) return null;

  const left = fitXByY(grey, analysisWidth, analysisHeight, leftSeed.position);
  const right = fitXByY(grey, analysisWidth, analysisHeight, rightSeed.position);
  const top = fitYByX(grey, analysisWidth, analysisHeight, topSeed.position);
  const bottom = fitYByX(grey, analysisWidth, analysisHeight, bottomSeed.position);
  if (!left || !right || !top || !bottom) return null;

  const tl = intersection(left, top);
  const tr = intersection(right, top);
  const br = intersection(right, bottom);
  const bl = intersection(left, bottom);
  if (!tl || !tr || !br || !bl) return null;

  const points = [tl, tr, br, bl];
  if (points.some((point) => point.x < -8 || point.y < -8 || point.x > analysisWidth + 8 || point.y > analysisHeight + 8)) {
    return null;
  }

  const topWidth = distance(tl, tr);
  const bottomWidth = distance(bl, br);
  const leftHeight = distance(tl, bl);
  const rightHeight = distance(tr, br);
  const meanWidth = (topWidth + bottomWidth) / 2;
  const meanHeight = (leftHeight + rightHeight) / 2;
  if (meanWidth < analysisWidth * 0.44 || meanHeight < analysisHeight * 0.52) return null;

  const ratio = meanWidth / Math.max(1, meanHeight);
  const ratioError = Math.abs(ratio - CARD_ASPECT_RATIO) / CARD_ASPECT_RATIO;
  const aspectScore = clamp(1 - ratioError / 0.38, 0, 1);
  const areaRatio = polygonArea(points) / (analysisWidth * analysisHeight);
  if (areaRatio < 0.32 || areaRatio > 0.97) return null;

  const edgeScore = clamp(
    (left.score + right.score + top.score + bottom.score + leftSeed.score + rightSeed.score + topSeed.score + bottomSeed.score) / 8,
    0,
    1,
  );
  const coverageScore = clamp((left.coverage + right.coverage + top.coverage + bottom.coverage) / 4, 0, 1);
  const areaScore = clamp((areaRatio - 0.32) / 0.34, 0, 1);
  const confidence = clamp(edgeScore * 0.38 + coverageScore * 0.24 + aspectScore * 0.25 + areaScore * 0.13, 0, 1);
  if (confidence < 0.36) return null;

  const scaleX = crop.width / analysisWidth;
  const scaleY = crop.height / analysisHeight;
  const translate = (point: ScannerPoint): ScannerPoint => ({
    x: crop.x + point.x * scaleX,
    y: crop.y + point.y * scaleY,
  });

  return {
    corners: [translate(tl), translate(tr), translate(br), translate(bl)],
    confidence,
    aspectScore,
    edgeScore,
    coverageScore,
    sourceCrop: crop,
  };
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] | null {
  const n = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let item = column; item <= n; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= n; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }
  return augmented.map((row) => row[n]);
}

function homographyFromDestinationToSource(
  width: number,
  height: number,
  corners: [ScannerPoint, ScannerPoint, ScannerPoint, ScannerPoint],
): number[] | null {
  const destination = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  const matrix: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const d = destination[index];
    const s = corners[index];
    matrix.push([d.x, d.y, 1, 0, 0, 0, -s.x * d.x, -s.x * d.y]);
    values.push(s.x);
    matrix.push([0, 0, 0, d.x, d.y, 1, -s.y * d.x, -s.y * d.y]);
    values.push(s.y);
  }
  const solution = solveLinearSystem(matrix, values);
  if (!solution) return null;
  return [...solution, 1];
}

function projectDestinationToSource(matrix: number[], x: number, y: number): ScannerPoint {
  const denominator = matrix[6] * x + matrix[7] * y + 1;
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
  };
}

function drawMappedTriangle(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  sourcePoints: [ScannerPoint, ScannerPoint, ScannerPoint],
  destinationPoints: [ScannerPoint, ScannerPoint, ScannerPoint],
  sourceWidth: number,
  sourceHeight: number,
): void {
  const [s0, s1, s2] = sourcePoints;
  const [d0, d1, d2] = destinationPoints;
  const determinant = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(determinant) < 1e-6) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / determinant;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / determinant;
  const e = (
    d0.x * (s1.x * s2.y - s2.x * s1.y) +
    d1.x * (s2.x * s0.y - s0.x * s2.y) +
    d2.x * (s0.x * s1.y - s1.x * s0.y)
  ) / determinant;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / determinant;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / determinant;
  const f = (
    d0.y * (s1.x * s2.y - s2.x * s1.y) +
    d1.y * (s2.x * s0.y - s0.x * s2.y) +
    d2.y * (s0.x * s1.y - s1.x * s0.y)
  ) / determinant;
  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  context.restore();
}

export function rectifyCard(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  geometry: CardGeometry,
  outputWidth = 630,
): HTMLCanvasElement {
  const outputHeight = Math.round(outputWidth / CARD_ASPECT_RATIO);
  const size = dimensions(source);
  const matrix = homographyFromDestinationToSource(outputWidth, outputHeight, geometry.corners);
  if (!matrix) throw new Error("The scanner could not flatten this card.");

  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Scanner output canvas is unavailable.");
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.fillStyle = "#101010";
  outputContext.fillRect(0, 0, outputWidth, outputHeight);

  // Canvas has no native projective draw. A small affine mesh delegates the
  // resampling to the browser/GPU and avoids the old 800k-pixel JavaScript loop.
  const columns = 8;
  const rows = 12;
  for (let row = 0; row < rows; row += 1) {
    const y0 = row / rows * outputHeight;
    const y1 = (row + 1) / rows * outputHeight;
    for (let column = 0; column < columns; column += 1) {
      const x0 = column / columns * outputWidth;
      const x1 = (column + 1) / columns * outputWidth;
      const d00 = { x: x0, y: y0 };
      const d10 = { x: x1, y: y0 };
      const d11 = { x: x1, y: y1 };
      const d01 = { x: x0, y: y1 };
      const s00 = projectDestinationToSource(matrix, x0, y0);
      const s10 = projectDestinationToSource(matrix, x1, y0);
      const s11 = projectDestinationToSource(matrix, x1, y1);
      const s01 = projectDestinationToSource(matrix, x0, y1);
      drawMappedTriangle(outputContext, source, [s00, s10, s11], [d00, d10, d11], size.width, size.height);
      drawMappedTriangle(outputContext, source, [s00, s11, s01], [d00, d11, d01], size.width, size.height);
    }
  }
  return output;
}

export function measureCardQuality(source: HTMLCanvasElement): CardQuality {
  const canvas = document.createElement("canvas");
  canvas.width = 252;
  canvas.height = 352;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { sharpness: 0, clippedRatio: 1, titleGlareRatio: 1, artGlareRatio: 1 };
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const grey = new Float32Array(canvas.width * canvas.height);
  let clipped = 0;
  let titleGlare = 0;
  let titleCount = 0;
  let artGlare = 0;
  let artCount = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const r = rgba[index];
      const g = rgba[index + 1];
      const b = rgba[index + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      grey[y * canvas.width + x] = luma;
      if (luma < 5 || luma > 250) clipped += 1;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const glare = luma > 235 && max - min < 20;
      if (y < canvas.height * 0.14) {
        titleCount += 1;
        if (glare) titleGlare += 1;
      }
      if (y >= canvas.height * 0.13 && y <= canvas.height * 0.62) {
        artCount += 1;
        if (glare) artGlare += 1;
      }
    }
  }

  let gradientTotal = 0;
  let gradientSquared = 0;
  let gradientCount = 0;
  for (let y = 1; y < canvas.height - 1; y += 2) {
    for (let x = 1; x < canvas.width - 1; x += 2) {
      const idx = y * canvas.width + x;
      const gx = grey[idx + 1] - grey[idx - 1];
      const gy = grey[idx + canvas.width] - grey[idx - canvas.width];
      const magnitude = Math.hypot(gx, gy);
      gradientTotal += magnitude;
      gradientSquared += magnitude * magnitude;
      gradientCount += 1;
    }
  }
  const mean = gradientTotal / Math.max(1, gradientCount);
  const variance = gradientSquared / Math.max(1, gradientCount) - mean * mean;
  return {
    sharpness: Math.max(0, Math.sqrt(Math.max(0, variance))),
    clippedRatio: clipped / Math.max(1, canvas.width * canvas.height),
    titleGlareRatio: titleGlare / Math.max(1, titleCount),
    artGlareRatio: artGlare / Math.max(1, artCount),
  };
}

function sampleCrop(
  source: HTMLCanvasElement | HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): Uint8ClampedArray | null {
  const size = dimensions(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    size.width * crop.x,
    size.height * crop.y,
    size.width * crop.width,
    size.height * crop.height,
    0,
    0,
    width,
    height,
  );
  return context.getImageData(0, 0, width, height).data;
}

function cosine(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstNorm += first[index] * first[index];
    secondNorm += second[index] * second[index];
  }
  if (firstNorm <= 0 || secondNorm <= 0) return 0;
  return clamp(dot / Math.sqrt(firstNorm * secondNorm), 0, 1);
}

function meanAbsoluteSimilarity(first: number[], second: number[], range: number): number {
  if (!first.length || first.length !== second.length) return 0;
  let error = 0;
  for (let index = 0; index < first.length; index += 1) error += Math.abs(first[index] - second[index]);
  return clamp(1 - error / first.length / range, 0, 1);
}

export function createVisionSignature(
  source: HTMLCanvasElement | HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
): VisionSignature {
  const hashData = sampleCrop(source, crop, 19, 24);
  const gridData = sampleCrop(source, crop, 12, 16);
  const structureData = sampleCrop(source, crop, 16, 22);
  if (!hashData || !gridData || !structureData) {
    return { dhash: [], edge: [], colourGrid: [], histogram: [], structure: [] };
  }

  const dhash: number[] = [];
  for (let y = 0; y < 24; y += 1) {
    for (let x = 0; x < 18; x += 1) {
      const leftIndex = (y * 19 + x) * 4;
      const rightIndex = (y * 19 + x + 1) * 4;
      const left = hashData[leftIndex] * 0.299 + hashData[leftIndex + 1] * 0.587 + hashData[leftIndex + 2] * 0.114;
      const right = hashData[rightIndex] * 0.299 + hashData[rightIndex + 1] * 0.587 + hashData[rightIndex + 2] * 0.114;
      dhash.push(left > right ? 1 : 0);
    }
  }

  const colourGrid: number[] = [];
  const histogram = Array.from({ length: 48 }, () => 0);
  for (let index = 0; index < gridData.length; index += 4) {
    const r = gridData[index] / 255;
    const g = gridData[index + 1] / 255;
    const b = gridData[index + 2] / 255;
    const total = Math.max(0.12, r + g + b);
    colourGrid.push(r / total, g / total, b / total);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta > 1e-5) {
      if (max === r) hue = ((g - b) / delta + 6) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue /= 6;
    }
    const saturation = max <= 0 ? 0 : delta / max;
    const hueBin = Math.min(11, Math.floor(hue * 12));
    const satBin = Math.min(3, Math.floor(saturation * 4));
    histogram[satBin * 12 + hueBin] += 1;
  }
  const histogramTotal = histogram.reduce((sum, value) => sum + value, 0) || 1;
  for (let index = 0; index < histogram.length; index += 1) histogram[index] /= histogramTotal;

  const structure: number[] = [];
  for (let index = 0; index < structureData.length; index += 4) {
    structure.push(structureData[index] * 0.299 + structureData[index + 1] * 0.587 + structureData[index + 2] * 0.114);
  }
  const structureMean = structure.reduce((sum, value) => sum + value, 0) / Math.max(1, structure.length);
  let structureStd = 0;
  for (const value of structure) structureStd += (value - structureMean) ** 2;
  structureStd = Math.sqrt(structureStd / Math.max(1, structure.length)) || 1;
  for (let index = 0; index < structure.length; index += 1) structure[index] = (structure[index] - structureMean) / structureStd;

  const edge: number[] = [];
  const sw = 16;
  const sh = 22;
  for (let y = 1; y < sh - 1; y += 1) {
    for (let x = 1; x < sw - 1; x += 1) {
      const idx = y * sw + x;
      const gx = structure[idx + 1] - structure[idx - 1];
      const gy = structure[idx + sw] - structure[idx - sw];
      edge.push(Math.hypot(gx, gy));
    }
  }

  return { dhash, edge, colourGrid, histogram, structure };
}

function hashSimilarity(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let equal = 0;
  for (let index = 0; index < first.length; index += 1) if (first[index] === second[index]) equal += 1;
  return equal / first.length;
}

function histogramIntersection(first: number[], second: number[]): number {
  if (!first.length || first.length !== second.length) return 0;
  let total = 0;
  for (let index = 0; index < first.length; index += 1) total += Math.min(first[index], second[index]);
  return clamp(total, 0, 1);
}

export function compareVisionSignatures(
  first: VisionSignature,
  second: VisionSignature,
): VisionComparison {
  const dhash = hashSimilarity(first.dhash, second.dhash);
  const edge = cosine(first.edge, second.edge);
  const colour = meanAbsoluteSimilarity(first.colourGrid, second.colourGrid, 0.58);
  const histogram = histogramIntersection(first.histogram, second.histogram);
  const structure = clamp((cosine(first.structure, second.structure) + 1) / 2, 0, 1);
  const combined = clamp(
    structure * 0.29 + edge * 0.25 + dhash * 0.18 + colour * 0.16 + histogram * 0.12,
    0,
    1,
  );
  return { combined, dhash, edge, colour, histogram, structure };
}

export function captureFrameFingerprint(
  source: HTMLVideoElement,
  crop: ScannerSourceCrop,
): FrameFingerprint | null {
  if (!source.videoWidth || !source.videoHeight) return null;
  const canvas = drawCrop(source, crop, 48, 67);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values: number[] = [];
  let lumaSum = 0;
  const lumas: number[] = [];
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index] / 255;
    const g = rgba[index + 1] / 255;
    const b = rgba[index + 2] / 255;
    values.push(r, g, b);
    const luma = (rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114);
    lumas.push(luma);
    lumaSum += luma;
  }
  const mean = lumaSum / Math.max(1, lumas.length);
  const variance = lumas.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, lumas.length);
  return { values, contrast: Math.sqrt(variance) };
}

export function frameFingerprintDifference(first: FrameFingerprint | null, second: FrameFingerprint | null): number {
  if (!first || !second || first.values.length !== second.values.length) return 999;
  let total = 0;
  for (let index = 0; index < first.values.length; index += 1) {
    total += Math.abs(first.values[index] - second.values[index]);
  }
  return (total / first.values.length) * 100;
}

export function changedPixelFraction(
  baseline: FrameFingerprint | null,
  current: FrameFingerprint | null,
  channelThreshold = 0.07,
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
    if (delta >= channelThreshold) changed += 1;
    pixels += 1;
  }
  return changed / Math.max(1, pixels);
}

export function averageFrameFingerprints(signatures: FrameFingerprint[]): FrameFingerprint | null {
  if (!signatures.length) return null;
  const length = signatures[0].values.length;
  const values = Array.from({ length }, () => 0);
  let contrast = 0;
  for (const signature of signatures) {
    if (signature.values.length !== length) continue;
    for (let index = 0; index < length; index += 1) values[index] += signature.values[index];
    contrast += signature.contrast;
  }
  for (let index = 0; index < length; index += 1) values[index] /= signatures.length;
  return { values, contrast: contrast / signatures.length };
}

export function cornerJitter(first: CardGeometry | null, second: CardGeometry | null, diagonal: number): number {
  if (!first || !second || diagonal <= 0) return 1;
  let sum = 0;
  for (let index = 0; index < 4; index += 1) {
    sum += distance(first.corners[index], second.corners[index]);
  }
  return sum / 4 / diagonal;
}
