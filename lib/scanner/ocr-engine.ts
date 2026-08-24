import {
  CARD_REGIONS,
  cropRegion,
  preprocessRegion,
  previewCanvas,
  rotateCanvas180,
  type PreprocessVariant,
} from "./regions";
import {
  extractCollectorFractions,
  extractCollectorNumbers,
  extractNameCandidates,
  extractSetCodes,
  normaliseName,
} from "./text";
import type { FrameObservation, OcrReading, TrackedFrame } from "./types";

type TesseractWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{
    data: { text?: string; confidence?: number };
  }>;
  setParameters: (parameters: Record<string, unknown>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type PsmValues = {
  SPARSE_TEXT: string | number;
  SINGLE_BLOCK: string | number;
  SINGLE_LINE: string | number;
};

type RecognitionProgress = (status: string, progress: number) => void;

export type FrameRecognitionResult = {
  observations: FrameObservation[];
  canonicalFrames: HTMLCanvasElement[];
  debugRegions: Record<string, string>;
  ocrMs: number;
};

const NAME_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .:'’-éÉ";
const NUMBER_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-| .";

function qualityVariant(frame: TrackedFrame, field: "name" | "collector"): PreprocessVariant {
  if (frame.qualityWeight >= 0.76) return field === "name" ? "grey" : "adaptive";
  return field === "name" ? "grey" : "otsu";
}

function usefulObservation(observation: FrameObservation): boolean {
  return Boolean(
    observation.names.length ||
    observation.collectorFractions.length ||
    observation.collectorNumbers.length ||
    observation.setCodes.length,
  );
}

export class ScannerOcrEngine {
  private worker: TesseractWorker | null = null;
  private workerPromise: Promise<TesseractWorker> | null = null;
  private psm: PsmValues | null = null;
  private disposed = false;
  private onProgress: RecognitionProgress;

  constructor(onProgress: RecognitionProgress) {
    this.onProgress = onProgress;
  }

  private async ensureWorker(): Promise<TesseractWorker> {
    if (this.disposed) throw new Error("The recognition engine has been closed.");
    if (this.worker) return this.worker;
    if (this.workerPromise) return this.workerPromise;
    this.workerPromise = (async () => {
      this.onProgress("Loading recognition engine", 3);
      const tesseract = await import("tesseract.js");
      this.psm = tesseract.PSM as PsmValues;
      const worker = await tesseract.createWorker("eng", 1, {
        logger: (message: { progress?: number; status?: string }) => {
          if (typeof message.progress !== "number") return;
          this.onProgress(message.status || "Reading card", 5 + Math.round(message.progress * 55));
        },
      }) as unknown as TesseractWorker;
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      this.worker = worker;
      return worker;
    })();
    try {
      return await this.workerPromise;
    } finally {
      this.workerPromise = null;
    }
  }

  private async read(
    worker: TesseractWorker,
    canvas: HTMLCanvasElement,
    mode: "line" | "block" | "sparse",
    whitelist: string,
    variant: string,
  ): Promise<OcrReading> {
    await worker.setParameters({
      ...(this.psm ? {
        tessedit_pageseg_mode: mode === "line"
          ? this.psm.SINGLE_LINE
          : mode === "block"
            ? this.psm.SINGLE_BLOCK
            : this.psm.SPARSE_TEXT,
      } : {}),
      tessedit_char_whitelist: whitelist,
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(canvas);
    return {
      text: result.data.text?.trim() || "",
      confidence: Math.max(0, Math.min(1, Number(result.data.confidence || 0) / 100)),
      variant,
    };
  }

  private async recogniseOne(
    worker: TesseractWorker,
    frame: TrackedFrame,
    source: HTMLCanvasElement,
    orientation: 0 | 180,
    index: number,
  ): Promise<FrameObservation> {
    const nameRaw = cropRegion(source, CARD_REGIONS.name, 920);
    const nameWideRaw = cropRegion(source, CARD_REGIONS.nameWide, 920);
    const footerRaw = cropRegion(source, CARD_REGIONS.footer, 1100);
    const nameVariant = qualityVariant(frame, "name");
    this.onProgress(`Reading frame ${index + 1} name`, 12 + index * 20);
    const nameReads: OcrReading[] = [];
    const nameRead = await this.read(
      worker,
      preprocessRegion(nameRaw, nameVariant),
      "line",
      NAME_WHITELIST,
      nameVariant,
    );
    nameReads.push(nameRead);
    // A wide fallback covers Trainer titles and older layouts. Do not pay for
    // it when the tight Pokémon-name lane already returned a plausible name.
    if (!extractNameCandidates(nameRead.text).length && index === 0) {
      nameReads.push(await this.read(
        worker,
        preprocessRegion(nameWideRaw, "adaptive"),
        "line",
        NAME_WHITELIST,
        "wide-adaptive",
      ));
    }
    this.onProgress(`Reading frame ${index + 1} footer`, 24 + index * 20);
    // One constrained footer read replaces the old collector + collector-right
    // + set + HP sequence. The parsers below only accept plausible fractions,
    // card numbers and known-style set-code tokens.
    const footerRead = await this.read(
      worker,
      preprocessRegion(footerRaw, qualityVariant(frame, "collector")),
      "sparse",
      NUMBER_WHITELIST,
      "footer-adaptive",
    );
    const nameText = nameReads.map((read) => read.text).filter(Boolean).join("\n");
    const footerText = footerRead.text;
    const collectorFractions = extractCollectorFractions(
      footerText,
      footerRead.confidence,
    ).filter((fraction, fractionIndex, items) => items.findIndex((candidate) =>
      candidate.numerator === fraction.numerator &&
      candidate.denominator === fraction.denominator
    ) === fractionIndex);
    const collectorNumbers = [...new Set([
      ...extractCollectorNumbers(footerText),
      ...collectorFractions.map((fraction) => fraction.numerator),
    ])];
    const observation: FrameObservation = {
      frameId: frame.id,
      qualityWeight: frame.qualityWeight,
      orientation,
      names: extractNameCandidates(nameText),
      collectorNumbers,
      collectorFractions,
      setCodes: extractSetCodes(footerText),
      hpValues: [],
      reads: {
        name: nameReads,
        collector: [footerRead],
        set: [footerRead],
        hp: [],
      },
    };
    return observation;
  }

  async recogniseFrames(frames: TrackedFrame[]): Promise<FrameRecognitionResult> {
    const started = performance.now();
    const worker = await this.ensureWorker();
    const selected = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, 2);
    if (!selected.length) throw new Error("No usable card frame was captured.");
    const observations: FrameObservation[] = [];
    const canonicalFrames: HTMLCanvasElement[] = [];
    let firstSource = selected[0].canvas;
    const first = await this.recogniseOne(worker, selected[0], firstSource, 0, 0);
    if (!usefulObservation(first)) {
      const rotated = rotateCanvas180(firstSource);
      const rotatedObservation = await this.recogniseOne(worker, selected[0], rotated, 180, 0);
      if (usefulObservation(rotatedObservation)) {
        observations.push(rotatedObservation);
        canonicalFrames.push(rotated);
        firstSource = rotated;
      } else {
        observations.push(first);
        canonicalFrames.push(selected[0].canvas);
      }
    } else {
      observations.push(first);
      canonicalFrames.push(firstSource);
    }
    for (
      let index = 1;
      index < selected.length && !(
        observations[0]?.names.length && observations[0]?.collectorFractions.length
      );
      index += 1
    ) {
      const source = observations[0]?.orientation === 180
        ? rotateCanvas180(selected[index].canvas)
        : selected[index].canvas;
      observations.push(await this.recogniseOne(
        worker,
        selected[index],
        source,
        observations[0]?.orientation || 0,
        index,
      ));
      canonicalFrames.push(source);
      const hasRepeatedFraction = observations.some((observation, observationIndex) =>
        observationIndex < observations.length - 1 &&
        observation.collectorFractions.some((fraction) =>
          observations.at(-1)?.collectorFractions.some((candidate) =>
            candidate.numerator === fraction.numerator &&
            candidate.denominator === fraction.denominator,
          ),
        ),
      );
      const latestNames = new Set(
        observations.at(-1)?.names
          .map(normaliseName)
          .filter((name) => name.length >= 3) ?? [],
      );
      const hasRepeatedName = observations.some((observation, observationIndex) =>
        observationIndex < observations.length - 1 &&
        observation.names.some((name) => latestNames.has(normaliseName(name))),
      );
      // Two agreeing observations are sufficient supporting evidence. Keep
      // the third OCR pass only as a recovery frame when the first pair is
      // inconsistent; visual retrieval still compares all captured frames.
      if ((hasRepeatedFraction || hasRepeatedName) && observations.length >= 2) break;
    }
    const debugRegions = {
      name: previewCanvas(cropRegion(firstSource, CARD_REGIONS.name, 720)),
      nameWide: previewCanvas(cropRegion(firstSource, CARD_REGIONS.nameWide, 720)),
      collector: previewCanvas(cropRegion(firstSource, CARD_REGIONS.collector, 720)),
      collectorRight: previewCanvas(cropRegion(firstSource, CARD_REGIONS.collectorRight, 720)),
      footer: previewCanvas(cropRegion(firstSource, CARD_REGIONS.footer, 900)),
      set: previewCanvas(cropRegion(firstSource, CARD_REGIONS.set, 720)),
      symbol: previewCanvas(cropRegion(firstSource, CARD_REGIONS.symbol, 420)),
      artwork: previewCanvas(cropRegion(firstSource, CARD_REGIONS.artwork, 720)),
    };
    return {
      observations,
      canonicalFrames,
      debugRegions,
      ocrMs: performance.now() - started,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}
