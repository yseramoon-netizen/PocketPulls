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
  extractHpValues,
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
const HP_WHITELIST = "HP0123456789 ";

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
    const collectorRaw = cropRegion(source, CARD_REGIONS.collector, 920);
    const collectorRightRaw = cropRegion(source, CARD_REGIONS.collectorRight, 820);
    const setRaw = cropRegion(source, CARD_REGIONS.set, 920);
    const hpRaw = cropRegion(source, CARD_REGIONS.hp, 620);
    const nameVariant = qualityVariant(frame, "name");
    const collectorVariant = qualityVariant(frame, "collector");
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
    this.onProgress(`Reading frame ${index + 1} number`, 20 + index * 20);
    const collectorReads: OcrReading[] = [];
    const collectorRead = await this.read(
      worker,
      preprocessRegion(collectorRaw, collectorVariant),
      "line",
      NUMBER_WHITELIST,
      collectorVariant,
    );
    collectorReads.push(collectorRead);
    // Some WOTC/legacy layouts print the collector line on the opposite side.
    if (index === 0) {
      collectorReads.push(await this.read(
        worker,
        preprocessRegion(collectorRightRaw, "grey"),
        "line",
        NUMBER_WHITELIST,
        "right-grey",
      ));
    }
    // Set and HP are supporting evidence. Read them on the sharpest two frames;
    // a third frame is reserved for recovery rather than repeated expensive OCR.
    const setReads: OcrReading[] = [];
    const hpReads: OcrReading[] = [];
    if (index < 2) {
      this.onProgress(`Reading frame ${index + 1} set`, 27 + index * 20);
      setReads.push(await this.read(
        worker,
        preprocessRegion(setRaw, "adaptive"),
        "sparse",
        NUMBER_WHITELIST,
        "adaptive",
      ));
    }
    if (index === 0) {
      hpReads.push(await this.read(
        worker,
        preprocessRegion(hpRaw, "grey"),
        "line",
        HP_WHITELIST,
        "grey",
      ));
    }
    const nameText = nameReads.map((read) => read.text).filter(Boolean).join("\n");
    const collectorText = collectorReads.map((read) => read.text).filter(Boolean).join("\n");
    const setText = setReads.map((read) => read.text).filter(Boolean).join("\n");
    const collectorConfidence = collectorReads.length
      ? Math.max(...collectorReads.map((read) => read.confidence))
      : 0;
    const setConfidence = setReads.length
      ? Math.max(...setReads.map((read) => read.confidence))
      : 0;
    // The printed fraction drifts between the collector and set crops across
    // layouts (and with small perspective errors). Parse both lanes, but only
    // promote strict numerator/denominator pairs from the broader set crop.
    // This recovers reads such as "BETS 067/084" without treating attack text
    // or copyright digits as standalone collector numbers.
    const collectorFractions = [
      ...extractCollectorFractions(collectorText, collectorConfidence),
      ...extractCollectorFractions(setText, setConfidence),
    ].filter((fraction, index, items) => items.findIndex((candidate) =>
      candidate.numerator === fraction.numerator &&
      candidate.denominator === fraction.denominator
    ) === index);
    const collectorNumbers = [...new Set([
      ...extractCollectorNumbers(collectorText),
      ...collectorFractions.map((fraction) => fraction.numerator),
    ])];
    const observation: FrameObservation = {
      frameId: frame.id,
      qualityWeight: frame.qualityWeight,
      orientation,
      names: extractNameCandidates(nameText),
      collectorNumbers,
      collectorFractions,
      setCodes: extractSetCodes(setText),
      hpValues: extractHpValues(hpReads.map((read) => read.text).join("\n")),
      reads: {
        name: nameReads,
        collector: collectorReads,
        set: setReads,
        hp: hpReads,
      },
    };
    return observation;
  }

  async recogniseFrames(frames: TrackedFrame[]): Promise<FrameRecognitionResult> {
    const started = performance.now();
    const worker = await this.ensureWorker();
    const selected = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, 3);
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
    for (let index = 1; index < selected.length; index += 1) {
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
