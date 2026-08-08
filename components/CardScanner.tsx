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

type ScannerCandidate = {
  card: ScannerPokemonCard;
  confidence: number;
  textConfidence: number;
  visualConfidence: number | null;
  collectorScore: number;
  nameScore: number;
  reasons: string[];
};

type CardScannerProps = {
  disabled?: boolean;
  resetKey?: number;
  onSelect: (
    card: ScannerPokemonCard,
  ) => void;
};

type ScannerState =
  | "idle"
  | "camera"
  | "captured"
  | "reading"
  | "matching"
  | "results"
  | "error";

type OcrWorker = {
  recognize: (
    image: HTMLCanvasElement,
  ) => Promise<{
    data: {
      text: string;
    };
  }>;

  setParameters: (
    parameters: Record<
      string,
      unknown
    >,
  ) => Promise<unknown>;

  terminate: () => Promise<unknown>;
};

type PsmValues = {
  SPARSE_TEXT: string | number;
  SINGLE_BLOCK: string | number;
  SINGLE_LINE: string | number;
};

type ExtractedScan = {
  fullText: string;
  topText: string;
  bottomText: string;
  names: string[];
  collectorNumbers: string[];
};

const CARD_ASPECT_RATIO = 63 / 88;

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

function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatCurrency(
  value:
    | number
    | string
    | null,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    },
  ).format(toNumber(value));
}

function cleanSearchValue(
  value: string,
): string {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseText(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normaliseCollector(
  value: string,
): string {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const match = compact.match(
    /^([A-Z]*)(\d+)([A-Z]*)$/,
  );

  if (!match) {
    return compact;
  }

  const prefix = match[1];
  const number =
    String(Number(match[2]));
  const suffix = match[3];

  return `${prefix}${number}${suffix}`;
}

function levenshteinDistance(
  first: string,
  second: string,
): number {
  if (first === second) {
    return 0;
  }

  if (!first.length) {
    return second.length;
  }

  if (!second.length) {
    return first.length;
  }

  const previous = Array.from(
    {
      length:
        second.length + 1,
    },
    (_, index) => index,
  );

  for (
    let firstIndex = 1;
    firstIndex <= first.length;
    firstIndex += 1
  ) {
    const current = [
      firstIndex,
    ];

    for (
      let secondIndex = 1;
      secondIndex <=
      second.length;
      secondIndex += 1
    ) {
      const insertion =
        current[
          secondIndex - 1
        ] + 1;

      const deletion =
        previous[secondIndex] +
        1;

      const substitution =
        previous[
          secondIndex - 1
        ] +
        (first[
          firstIndex - 1
        ] ===
        second[
          secondIndex - 1
        ]
          ? 0
          : 1);

      current[secondIndex] =
        Math.min(
          insertion,
          deletion,
          substitution,
        );
    }

    for (
      let index = 0;
      index < current.length;
      index += 1
    ) {
      previous[index] =
        current[index];
    }
  }

  return previous[
    second.length
  ];
}

function similarity(
  first: string,
  second: string,
): number {
  const normalisedFirst =
    normaliseText(first);

  const normalisedSecond =
    normaliseText(second);

  if (
    !normalisedFirst ||
    !normalisedSecond
  ) {
    return 0;
  }

  if (
    normalisedFirst ===
    normalisedSecond
  ) {
    return 1;
  }

  const longestLength =
    Math.max(
      normalisedFirst.length,
      normalisedSecond.length,
    );

  return Math.max(
    0,
    1 -
      levenshteinDistance(
        normalisedFirst,
        normalisedSecond,
      ) /
        longestLength,
  );
}

function uniqueValues(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function extractNameCandidates(
  topText: string,
  fullText: string,
): string[] {
  const lines = [
    ...topText.split(/\r?\n/),
    ...fullText
      .split(/\r?\n/)
      .slice(0, 8),
  ];

  const names: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine
      .replace(
        /\b\d{2,3}\s*HP\b/gi,
        "",
      )
      .replace(
        /\bHP\s*\d{2,3}\b/gi,
        "",
      )
      .replace(
        /\bBASIC\b/gi,
        "",
      )
      .replace(
        /\bSTAGE\s*[12I]\b/gi,
        "",
      )
      .replace(
        /[^A-Za-zÀ-ÿ0-9.'’\-\s]/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    if (
      line.length < 3 ||
      line.length > 34
    ) {
      continue;
    }

    const words = line
      .split(" ")
      .filter(Boolean);

    if (
      words.length === 0 ||
      words.length > 4
    ) {
      continue;
    }

    const meaningfulWords =
      words.filter((word) => {
        const normalised =
          normaliseText(word);

        return (
          normalised.length >= 2 &&
          !IGNORED_NAME_WORDS.has(
            normalised,
          ) &&
          !/^\d+$/.test(
            normalised,
          )
        );
      });

    if (
      meaningfulWords.length === 0
    ) {
      continue;
    }

    line = meaningfulWords.join(
      " ",
    );

    if (
      line.length >= 3
    ) {
      names.push(line);
    }
  }

  return uniqueValues(names)
    .sort(
      (first, second) =>
        second.length -
        first.length,
    )
    .slice(0, 8);
}

function extractCollectorNumbers(
  text: string,
): string[] {
  const results: string[] = [];

  const fractionPattern =
    /\b([A-Z]{0,5}\s*-?\s*\d{1,4}[A-Z]?)\s*[\/|]\s*([A-Z]{0,5}\s*-?\s*\d{1,4}[A-Z]?)\b/gi;

  for (
    const match of text.matchAll(
      fractionPattern,
    )
  ) {
    const left = match[1]
      .replace(/\s+/g, "")
      .trim();

    if (left) {
      results.push(left);
      results.push(
        normaliseCollector(left),
      );
    }
  }

  const promoPattern =
    /\b(SVP|SWSH|SM|XY|BW|DP|HGSS)\s*-?\s*(\d{1,4})\b/gi;

  for (
    const match of text.matchAll(
      promoPattern,
    )
  ) {
    results.push(
      `${match[1]}${match[2]}`,
    );
  }

  return uniqueValues(results)
    .filter(
      (value) =>
        value.length >= 1 &&
        value.length <= 10,
    )
    .slice(0, 8);
}

function createProcessedCanvas(
  source: HTMLCanvasElement,
  startY: number,
  heightRatio: number,
  binary: boolean,
): HTMLCanvasElement {
  const sourceY = Math.max(
    0,
    Math.floor(
      source.height * startY,
    ),
  );

  const sourceHeight =
    Math.max(
      1,
      Math.floor(
        source.height *
          heightRatio,
      ),
    );

  const scale =
    Math.max(
      1.5,
      1700 / source.width,
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width = Math.round(
    source.width * scale,
  );

  canvas.height = Math.round(
    sourceHeight * scale,
  );

  const context =
    canvas.getContext("2d", {
      willReadFrequently: true,
    });

  if (!context) {
    throw new Error(
      "The scanner could not create an image-processing canvas.",
    );
  }

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    source,
    0,
    sourceY,
    source.width,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

  const pixels =
    imageData.data;

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const grey =
      pixels[index] * 0.299 +
      pixels[index + 1] *
        0.587 +
      pixels[index + 2] *
        0.114;

    const contrasted =
      Math.max(
        0,
        Math.min(
          255,
          (grey - 128) *
            1.65 +
            128,
        ),
      );

    const value = binary
      ? contrasted > 150
        ? 255
        : 0
      : contrasted;

    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }

  context.putImageData(
    imageData,
    0,
    0,
  );

  return canvas;
}

function extractCardCanvas(
  source:
    | HTMLVideoElement
    | HTMLImageElement,
): HTMLCanvasElement {
  const sourceWidth =
    source instanceof
    HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;

  const sourceHeight =
    source instanceof
    HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;

  if (
    !sourceWidth ||
    !sourceHeight
  ) {
    throw new Error(
      "The captured image has no usable dimensions.",
    );
  }

  const sourceAspect =
    sourceWidth / sourceHeight;

  let cropWidth =
    sourceWidth;

  let cropHeight =
    sourceHeight;

  /*
   * Images already close to card proportions are used
   * almost in full. Wider camera images use the centre
   * guide area.
   */

  if (
    sourceAspect >
      CARD_ASPECT_RATIO *
        1.2 ||
    sourceAspect <
      CARD_ASPECT_RATIO *
        0.8
  ) {
    cropHeight =
      sourceHeight * 0.86;

    cropWidth =
      cropHeight *
      CARD_ASPECT_RATIO;

    if (
      cropWidth >
      sourceWidth * 0.82
    ) {
      cropWidth =
        sourceWidth * 0.82;

      cropHeight =
        cropWidth /
        CARD_ASPECT_RATIO;
    }
  }

  const sourceX =
    (sourceWidth -
      cropWidth) /
    2;

  const sourceY =
    (sourceHeight -
      cropHeight) /
    2;

  const outputWidth = 1008;

  const outputHeight =
    Math.round(
      outputWidth /
        CARD_ASPECT_RATIO,
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "The scanner could not prepare the card image.",
    );
  }

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    source,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvas;
}

function loadImage(
  source: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image = new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        reject(
          new Error(
            "The selected image could not be opened.",
          ),
        );

      image.src = source;
    },
  );
}

function readFileAsDataUrl(
  file: File,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result ===
          "string"
        ) {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            "The image could not be read.",
          ),
        );
      };

      reader.onerror = () =>
        reject(
          new Error(
            "The image could not be read.",
          ),
        );

      reader.readAsDataURL(file);
    },
  );
}

function scoreCandidate(
  card: ScannerPokemonCard,
  scan: ExtractedScan,
): ScannerCandidate {
  let bestNameSimilarity = 0;

  for (const scannedName of scan.names) {
    bestNameSimilarity = Math.max(
      bestNameSimilarity,
      similarity(card.name, scannedName),
    );
  }

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
      (cardCollector.includes(normalisedScanned) ||
        normalisedScanned.includes(cardCollector))
    ) {
      collectorScore = Math.max(collectorScore, 0.72);
    }
  }

  const fullNormalised = normaliseText(scan.fullText);
  const setNormalised = normaliseText(card.set_name || "");
  const setScore =
    setNormalised.length >= 5 && fullNormalised.includes(setNormalised) ? 1 : 0;

  let weightedScore = 0;

  if (scan.collectorNumbers.length > 0) {
    weightedScore =
      collectorScore * 0.7 +
      bestNameSimilarity * 0.27 +
      setScore * 0.03;

    // Once the card actually exposes a collector number, candidates whose
    // number disagrees should not look like plausible matches just because a
    // noisy OCR line happened to resemble the name.
    if (collectorScore === 0) {
      weightedScore = Math.min(weightedScore, 0.34);
    }
  } else {
    weightedScore = bestNameSimilarity * 0.94 + setScore * 0.06;
  }

  const textConfidence = Math.max(
    1,
    Math.min(99, Math.round(weightedScore * 100)),
  );

  const reasons: string[] = [];

  if (collectorScore === 1) {
    reasons.push("Collector number matched exactly");
  } else if (collectorScore >= 0.7) {
    reasons.push("Collector number is very close");
  }

  if (bestNameSimilarity >= 0.93) {
    reasons.push("Name matched closely");
  } else if (bestNameSimilarity >= 0.72) {
    reasons.push("Name is similar");
  }

  if (setScore === 1) {
    reasons.push("Set text detected");
  }

  return {
    card,
    confidence: textConfidence,
    textConfidence,
    visualConfidence: null,
    collectorScore,
    nameScore: bestNameSimilarity,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Possible database match"],
  };
}

function createVisualFingerprint(
  source: HTMLCanvasElement | HTMLImageElement,
): number[] {
  const width = 18;
  const height = 25;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    return [];
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  const data = context.getImageData(0, 0, width, height).data;
  const values: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    values.push(
      data[index] * 0.299 +
        data[index + 1] * 0.587 +
        data[index + 2] * 0.114,
    );
  }

  if (values.length === 0) {
    return [];
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  const deviation = Math.max(10, Math.sqrt(variance));

  return values.map((value) => (value - mean) / deviation);
}

function compareVisualFingerprints(
  first: number[],
  second: number[],
): number {
  if (!first.length || first.length !== second.length) {
    return 0;
  }

  let dot = 0;
  let firstLength = 0;
  let secondLength = 0;

  for (let index = 0; index < first.length; index += 1) {
    dot += first[index] * second[index];
    firstLength += first[index] ** 2;
    secondLength += second[index] ** 2;
  }

  const denominator = Math.sqrt(firstLength * secondLength);

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  const correlation = dot / denominator;

  return Math.max(0, Math.min(1, (correlation + 1) / 2));
}

function loadRemoteImageForFingerprint(
  source: string,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }

    const image = new Image();
    let finished = false;

    const finish = (value: HTMLImageElement | null) => {
      if (finished) {
        return;
      }

      finished = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), 3500);

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

async function rerankWithArtwork(
  candidates: ScannerCandidate[],
  capturedCard: HTMLCanvasElement,
): Promise<ScannerCandidate[]> {
  if (candidates.length <= 1) {
    return candidates;
  }

  const capturedFingerprint = createVisualFingerprint(capturedCard);

  if (!capturedFingerprint.length) {
    return candidates;
  }

  const enriched = await Promise.all(
    candidates.slice(0, 10).map(async (candidate) => {
      const imageUrl = candidate.card.image_url?.trim() || "";
      const image = await loadRemoteImageForFingerprint(imageUrl);

      if (!image) {
        return candidate;
      }

      try {
        const candidateFingerprint = createVisualFingerprint(image);
        const visualSimilarity = compareVisualFingerprints(
          capturedFingerprint,
          candidateFingerprint,
        );
        const visualConfidence = Math.round(visualSimilarity * 100);

        const visualWeight =
          candidate.collectorScore === 1
            ? 0.16
            : candidate.collectorScore >= 0.7
              ? 0.24
              : 0.42;
        const textWeight = 1 - visualWeight;
        let confidence = Math.round(
          candidate.textConfidence * textWeight +
            visualConfidence * visualWeight,
        );

        if (
          candidate.collectorScore === 1 &&
          candidate.nameScore >= 0.9 &&
          visualConfidence >= 72
        ) {
          confidence = Math.max(confidence, 96);
        }

        const reasons = [...candidate.reasons];

        if (visualConfidence >= 88) {
          reasons.push("Artwork matched strongly");
        } else if (visualConfidence >= 76) {
          reasons.push("Artwork looks similar");
        }

        return {
          ...candidate,
          confidence: Math.max(1, Math.min(99, confidence)),
          visualConfidence,
          reasons,
        };
      } catch {
        // Some third-party image hosts do not allow canvas access. OCR still
        // remains fully usable if visual comparison cannot run.
        return candidate;
      }
    }),
  );

  return enriched.sort((first, second) => {
    if (second.collectorScore !== first.collectorScore) {
      return second.collectorScore - first.collectorScore;
    }

    return second.confidence - first.confidence;
  });
}

export default function CardScanner({
  disabled = false,
  resetKey = 0,
  onSelect,
}: CardScannerProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const workerRef =
    useRef<OcrWorker | null>(
      null,
    );

  const psmRef =
    useRef<PsmValues | null>(
      null,
    );

  const workerPromiseRef =
    useRef<
      Promise<OcrWorker> | null
    >(null);

  const mountedRef =
    useRef(true);

  const [state, setState] =
    useState<ScannerState>("idle");

  const [
    capturedImage,
    setCapturedImage,
  ] = useState("");

  const [
    candidates,
    setCandidates,
  ] = useState<
    ScannerCandidate[]
  >([]);

  const [
    scanDetails,
    setScanDetails,
  ] = useState<ExtractedScan | null>(
    null,
  );

  const [
    progress,
    setProgress,
  ] = useState(0);

  const [
    status,
    setStatus,
  ] = useState(
    "Ready to scan a card",
  );

  const [error, setError] =
    useState("");

  const cameraActive =
    state === "camera";

  const scanning =
    state === "reading" ||
    state === "matching";

  const bestConfidence =
    useMemo(
      () =>
        candidates[0]
          ?.confidence || 0,
      [candidates],
    );

  const stopCamera =
    useCallback(() => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }

        streamRef.current =
          null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }
    }, []);

  const resetScanner =
    useCallback(() => {
      stopCamera();

      setState("idle");
      setCapturedImage("");
      setCandidates([]);
      setScanDetails(null);
      setProgress(0);
      setStatus(
        "Ready to scan a card",
      );
      setError("");
    }, [stopCamera]);

  useEffect(() => {
    resetScanner();
  }, [
    resetKey,
    resetScanner,
  ]);

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
    if (workerRef.current) {
      return workerRef.current;
    }

    if (workerPromiseRef.current) {
      return workerPromiseRef.current;
    }

    workerPromiseRef.current =
      (async () => {
        setStatus(
          "Loading the recognition engine",
        );

        const tesseract =
          await import(
            "tesseract.js"
          );

        psmRef.current =
          tesseract.PSM as PsmValues;

        const worker =
          (await tesseract.createWorker(
            "eng",
            1,
            {
              logger: (
                message: {
                  status?: string;
                  progress?: number;
                },
              ) => {
                if (
                  !mountedRef.current ||
                  typeof
                    message.progress !==
                    "number"
                ) {
                  return;
                }

                const workerProgress =
                  Math.round(
                    message.progress *
                      75,
                  );

                setProgress(
                  Math.max(
                    5,
                    Math.min(
                      80,
                      workerProgress,
                    ),
                  ),
                );
              },
            },
          )) as unknown as OcrWorker;

        await worker.setParameters(
          {
            preserve_interword_spaces:
              "1",
          },
        );

        workerRef.current =
          worker;

        return worker;
      })();

    try {
      return await workerPromiseRef.current;
    } finally {
      workerPromiseRef.current =
        null;
    }
  }

  async function startCamera() {
    if (
      disabled ||
      scanning
    ) {
      return;
    }

    setError("");
    setCandidates([]);
    setCapturedImage("");
    setScanDetails(null);

    if (
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      setState("error");

      setError(
        "This browser does not provide camera access. Use Upload photo instead.",
      );

      return;
    }

    try {
      stopCamera();

      setState("camera");
      setStatus(
        "Requesting camera access",
      );

      await new Promise<void>(
        (resolve) => {
          window.requestAnimationFrame(
            () => resolve(),
          );
        },
      );

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: false,

            video: {
              facingMode: {
                ideal:
                  "environment",
              },

              width: {
                ideal: 1920,
              },

              height: {
                ideal: 1080,
              },
            },
          },
        );

      streamRef.current =
        stream;

      if (!videoRef.current) {
        throw new Error(
          "The camera viewer was not ready.",
        );
      }

      videoRef.current.srcObject =
        stream;

      await videoRef.current.play();

      setStatus(
        "Place one card inside the frame",
      );
    } catch (
      cameraError: unknown
    ) {
      stopCamera();

      setState("error");

      setError(
        cameraError instanceof Error
          ? cameraError.message
          : "Camera access failed. Check the browser permission or upload a photo.",
      );
    }
  }

  async function captureCamera() {
    if (
      !videoRef.current ||
      scanning
    ) {
      return;
    }

    try {
      const canvas =
        extractCardCanvas(
          videoRef.current,
        );

      const preview =
        canvas.toDataURL(
          "image/jpeg",
          0.92,
        );

      stopCamera();

      setCapturedImage(
        preview,
      );

      setState("captured");

      await scanCanvas(canvas);
    } catch (
      captureError: unknown
    ) {
      setState("error");

      setError(
        captureError instanceof Error
          ? captureError.message
          : "The card image could not be captured.",
      );
    }
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setCandidates([]);
    setScanDetails(null);

    try {
      const dataUrl =
        await readFileAsDataUrl(
          file,
        );

      const image =
        await loadImage(dataUrl);

      const canvas =
        extractCardCanvas(image);

      setCapturedImage(
        canvas.toDataURL(
          "image/jpeg",
          0.92,
        ),
      );

      setState("captured");

      await scanCanvas(canvas);
    } catch (
      uploadError: unknown
    ) {
      setState("error");

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The selected card image could not be scanned.",
      );
    }
  }

  async function runRecognition(
    worker: OcrWorker,
    canvas: HTMLCanvasElement,
    mode:
      | "sparse"
      | "block"
      | "line",
  ): Promise<string> {
    const psm = psmRef.current;

    if (psm) {
      const pageMode =
        mode === "line"
          ? psm.SINGLE_LINE
          : mode === "block"
            ? psm.SINGLE_BLOCK
            : psm.SPARSE_TEXT;

      await worker.setParameters({
        tessedit_pageseg_mode:
          pageMode,
      });
    }

    const result =
      await worker.recognize(
        canvas,
      );

    return (
      result.data.text || ""
    );
  }

  async function scanCanvas(
    cardCanvas: HTMLCanvasElement,
  ) {
    setState("reading");
    setProgress(3);
    setStatus("Preparing the card image");
    setError("");

    try {
      const worker = await ensureWorker();

      // Read the parts of a Pokemon card that identify the printing first.
      // This keeps the scanner fast and avoids attack text polluting the name.
      const topGreyCanvas = createProcessedCanvas(
        cardCanvas,
        0,
        0.24,
        false,
      );
      const topBinaryCanvas = createProcessedCanvas(
        cardCanvas,
        0,
        0.24,
        true,
      );
      const bottomBinaryCanvas = createProcessedCanvas(
        cardCanvas,
        0.74,
        0.26,
        true,
      );
      const bottomGreyCanvas = createProcessedCanvas(
        cardCanvas,
        0.74,
        0.26,
        false,
      );

      setStatus("Reading the Pokemon name");
      setProgress(14);

      const topPrimary = await runRecognition(
        worker,
        topGreyCanvas,
        "sparse",
      );

      setStatus("Reading the collector number");
      setProgress(38);

      const bottomPrimary = await runRecognition(
        worker,
        bottomBinaryCanvas,
        "sparse",
      );

      let topText = topPrimary;
      let bottomText = bottomPrimary;
      let fullText = "";

      let names = extractNameCandidates(topText, topText);
      let collectorNumbers = extractCollectorNumbers(
        `${bottomText}\n${topText}`,
      );

      // If either critical identifier is weak, make a second pass with the
      // opposite image treatment before falling back to the whole card.
      if (names.length === 0 || collectorNumbers.length === 0) {
        setStatus("Double-checking the card details");
        setProgress(56);

        const topSecondary = await runRecognition(
          worker,
          topBinaryCanvas,
          "sparse",
        );
        const bottomSecondary = await runRecognition(
          worker,
          bottomGreyCanvas,
          "sparse",
        );

        topText = `${topPrimary}\n${topSecondary}`;
        bottomText = `${bottomPrimary}\n${bottomSecondary}`;
        names = extractNameCandidates(topText, topText);
        collectorNumbers = extractCollectorNumbers(
          `${bottomText}\n${topText}`,
        );
      }

      if (names.length === 0 || collectorNumbers.length === 0) {
        setStatus("Reading the complete card");
        setProgress(68);

        const fullCanvas = createProcessedCanvas(
          cardCanvas,
          0,
          1,
          false,
        );
        fullText = await runRecognition(worker, fullCanvas, "sparse");
      }

      const combinedText = [
        topText,
        bottomText,
        fullText,
      ]
        .filter(Boolean)
        .join("\n");

      const scan: ExtractedScan = {
        topText,
        bottomText,
        fullText: combinedText,
        names: extractNameCandidates(topText, combinedText),
        collectorNumbers: extractCollectorNumbers(combinedText),
      };

      setScanDetails(scan);
      setState("matching");
      setStatus("Finding the exact printing");
      setProgress(82);

      const matches = await findMatches(scan, cardCanvas);

      if (!mountedRef.current) {
        return;
      }

      setCandidates(matches);
      setProgress(100);
      setState("results");

      if (matches.length === 0) {
        setStatus("No reliable match was found");
      } else if (
        matches[0].confidence >= 94 &&
        (matches.length === 1 ||
          matches[0].confidence - matches[1].confidence >= 8)
      ) {
        setStatus("High-confidence match found");
      } else if (matches[0].confidence >= 82) {
        setStatus("Likely match found");
      } else {
        setStatus("Review the closest matches");
      }
    } catch (scanError: unknown) {
      console.error("Card scanner error:", scanError);
      setState("error");
      setError(
        scanError instanceof Error
          ? scanError.message
          : "The card could not be recognised.",
      );
    }
  }

  async function findMatches(
    scan: ExtractedScan,
    cardCanvas: HTMLCanvasElement,
  ): Promise<ScannerCandidate[]> {
    const resultMap = new Map<string, ScannerPokemonCard>();

    const collectorSearches = uniqueValues(
      scan.collectorNumbers.flatMap((collector) => {
        const normalised = normaliseCollector(collector);
        const numeric = collector.match(/\d+/)?.[0] || "";
        const numericNormalised = numeric ? String(Number(numeric)) : "";

        return [
          collector,
          normalised,
          numeric,
          numericNormalised,
        ];
      }),
    )
      .filter(Boolean)
      .slice(0, 6);

    // Collector number is the strongest discriminator. Search exact values
    // first instead of `%25%`, which used to return dozens of unrelated cards.
    for (const collector of collectorSearches) {
      const cleanCollector = cleanSearchValue(collector);

      if (!cleanCollector) {
        continue;
      }

      const { data, error: collectorError } = await supabase
        .from("pokemon_cards")
        .select(CARD_SELECT)
        .ilike("card_no", cleanCollector)
        .limit(45);

      if (collectorError) {
        console.error("Collector search error:", collectorError);
        continue;
      }

      for (const card of (data || []) as ScannerPokemonCard[]) {
        resultMap.set(card.id, card);
      }
    }

    const nameSearches = uniqueValues(scan.names.slice(0, 5));

    // Exact Pokemon names are far more useful than searching every OCR token.
    for (const name of nameSearches) {
      const cleanName = cleanSearchValue(name);

      if (cleanName.length < 3) {
        continue;
      }

      const { data, error: nameError } = await supabase
        .from("pokemon_cards")
        .select(CARD_SELECT)
        .ilike("name", cleanName)
        .limit(35);

      if (nameError) {
        console.error("Name search error:", nameError);
        continue;
      }

      for (const card of (data || []) as ScannerPokemonCard[]) {
        resultMap.set(card.id, card);
      }
    }

    // Only broaden the query when exact identifiers found too little. This is
    // intentionally bounded so the UI never becomes a database dump.
    if (resultMap.size < 2) {
      for (const name of nameSearches.slice(0, 3)) {
        const cleanName = cleanSearchValue(name);

        if (cleanName.length < 4) {
          continue;
        }

        const { data, error: fuzzyError } = await supabase
          .from("pokemon_cards")
          .select(CARD_SELECT)
          .ilike("name", `%${cleanName}%`)
          .limit(30);

        if (fuzzyError) {
          console.error("Fallback name search error:", fuzzyError);
          continue;
        }

        for (const card of (data || []) as ScannerPokemonCard[]) {
          resultMap.set(card.id, card);
        }
      }
    }

    // If OCR captured a collector number but its punctuation/prefix was noisy,
    // allow one tightly bounded numeric fallback.
    if (resultMap.size === 0 && collectorSearches.length > 0) {
      const numeric = collectorSearches
        .map((value) => value.match(/\d+/)?.[0] || "")
        .find((value) => value.length >= 1);

      if (numeric) {
        const { data, error: collectorFallbackError } = await supabase
          .from("pokemon_cards")
          .select(CARD_SELECT)
          .ilike("card_no", `%${cleanSearchValue(numeric)}%`)
          .limit(45);

        if (collectorFallbackError) {
          console.error(
            "Collector fallback search error:",
            collectorFallbackError,
          );
        } else {
          for (const card of (data || []) as ScannerPokemonCard[]) {
            resultMap.set(card.id, card);
          }
        }
      }
    }

    let scored = [...resultMap.values()]
      .map((card) => scoreCandidate(card, scan))
      .sort((first, second) => {
        if (second.collectorScore !== first.collectorScore) {
          return second.collectorScore - first.collectorScore;
        }

        return second.textConfidence - first.textConfidence;
      });

    const exactCollectorMatches = scored.filter(
      (candidate) => candidate.collectorScore === 1,
    );

    if (exactCollectorMatches.length > 0) {
      const usefulExactMatches = exactCollectorMatches.filter(
        (candidate) => candidate.nameScore >= 0.38,
      );
      scored = usefulExactMatches.length > 0
        ? usefulExactMatches
        : exactCollectorMatches;
    } else {
      scored = scored.filter(
        (candidate, index) =>
          index < 10 &&
          (candidate.textConfidence >= 32 || candidate.nameScore >= 0.55),
      );
    }

    scored = await rerankWithArtwork(scored.slice(0, 10), cardCanvas);

    if (scored.length === 0) {
      return [];
    }

    const best = scored[0].confidence;

    return scored
      .filter(
        (candidate, index) =>
          index === 0 ||
          candidate.confidence >= Math.max(52, best - 18),
      )
      .slice(0, 3);
  }

  return (
    <section
      className="
        overflow-hidden
        rounded-[2.75rem]
        border
        border-white/15
        bg-white/[0.075]
        shadow-[0_35px_100px_rgba(0,0,0,0.3)]
        backdrop-blur-3xl
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          border-b
          border-white/10
          p-6
          sm:flex-row
          sm:items-center
          sm:justify-between
          md:p-8
        "
      >
        <div>
          <p
            className="
              text-sm
              font-black
              uppercase
              tracking-[0.2em]
              text-cyan-200/55
            "
          >
            Camera intake
          </p>

          <h2
            className="
              mt-2
              text-3xl
              font-black
              tracking-tight
              text-white
            "
          >
            Unown Pulls Card Scanner
          </h2>

          <p
            className="
              mt-2
              max-w-2xl
              text-sm
              font-medium
              leading-6
              text-white/45
            "
          >
            Centre one card, avoid glare and keep the name
            and collector number visible.
          </p>
        </div>

        <div
          className="
            flex
            items-center
            gap-3
            rounded-2xl
            border
            border-white/10
            bg-black/15
            px-4
            py-3
          "
        >
          <span
            className={`
              h-2.5
              w-2.5
              rounded-full
              ${
                scanning
                  ? "animate-pulse bg-cyan-200"
                  : cameraActive
                    ? "bg-red-300"
                    : "bg-emerald-300"
              }
            `}
          />

          <div>
            <p
              className="
                text-xs
                font-black
                uppercase
                tracking-[0.12em]
                text-white/35
              "
            >
              Scanner
            </p>

            <p
              className="
                text-sm
                font-black
                text-white/75
              "
            >
              {status}
            </p>
          </div>
        </div>
      </div>

      <div
        className="
          grid
          gap-6
          p-5
          lg:grid-cols-[1.1fr_0.9fr]
          md:p-8
        "
      >
        <div>
          <div
            className="
              relative
              flex
              min-h-[34rem]
              items-center
              justify-center
              overflow-hidden
              rounded-[2.25rem]
              border
              border-white/10
              bg-gradient-to-br
              from-black/40
              via-emerald-950/30
              to-black/40
            "
          >
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-black/20
                  "
                />

                <div
                  className="
                    pointer-events-none
                    relative
                    aspect-[63/88]
                    h-[78%]
                    max-w-[78%]
                    rounded-[2rem]
                    border-2
                    border-cyan-200/80
                    shadow-[0_0_0_999px_rgba(0,0,0,0.28),0_0_45px_rgba(165,243,252,0.3)]
                  "
                >
                  <span
                    className="
                      absolute
                      -left-1
                      -top-1
                      h-12
                      w-12
                      rounded-tl-[2rem]
                      border-l-4
                      border-t-4
                      border-white
                    "
                  />

                  <span
                    className="
                      absolute
                      -right-1
                      -top-1
                      h-12
                      w-12
                      rounded-tr-[2rem]
                      border-r-4
                      border-t-4
                      border-white
                    "
                  />

                  <span
                    className="
                      absolute
                      -bottom-1
                      -left-1
                      h-12
                      w-12
                      rounded-bl-[2rem]
                      border-b-4
                      border-l-4
                      border-white
                    "
                  />

                  <span
                    className="
                      absolute
                      -bottom-1
                      -right-1
                      h-12
                      w-12
                      rounded-br-[2rem]
                      border-b-4
                      border-r-4
                      border-white
                    "
                  />
                </div>

                <div
                  className="
                    absolute
                    bottom-5
                    left-1/2
                    flex
                    -translate-x-1/2
                    gap-3
                  "
                >
                  <button
                    type="button"
                    onClick={
                      captureCamera
                    }
                    className="
                      flex
                      h-16
                      w-16
                      items-center
                      justify-center
                      rounded-full
                      border-4
                      border-white
                      bg-cyan-200
                      shadow-[0_0_35px_rgba(165,243,252,0.4)]
                      transition
                      hover:scale-105
                    "
                    aria-label="Capture card"
                  >
                    <span
                      className="
                        h-10
                        w-10
                        rounded-full
                        bg-white
                      "
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      resetScanner
                    }
                    className="
                      flex
                      h-14
                      items-center
                      justify-center
                      self-center
                      rounded-2xl
                      border
                      border-white/15
                      bg-black/55
                      px-5
                      font-black
                      text-white
                      backdrop-blur-xl
                    "
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : capturedImage ? (
              <>
                <img
                  src={capturedImage}
                  alt="Captured Pokémon card"
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-contain
                    p-5
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/55
                    via-transparent
                    to-transparent
                  "
                />

                {scanning && (
                  <div
                    className="
                      absolute
                      inset-x-[12%]
                      top-[12%]
                      h-1
                      animate-[scanner-line_2s_ease-in-out_infinite]
                      bg-gradient-to-r
                      from-transparent
                      via-cyan-200
                      to-transparent
                      shadow-[0_0_25px_rgba(165,243,252,1)]
                    "
                  />
                )}

                <button
                  type="button"
                  onClick={
                    resetScanner
                  }
                  disabled={scanning}
                  className="
                    absolute
                    bottom-5
                    right-5
                    rounded-2xl
                    border
                    border-white/15
                    bg-black/55
                    px-5
                    py-3
                    font-black
                    text-white
                    backdrop-blur-xl
                    disabled:opacity-40
                  "
                >
                  Scan another
                </button>
              </>
            ) : (
              <div
                className="
                  relative
                  z-10
                  flex
                  max-w-md
                  flex-col
                  items-center
                  px-6
                  text-center
                "
              >
                <div
                  className="
                    flex
                    h-28
                    w-28
                    items-center
                    justify-center
                    rounded-[2rem]
                    border
                    border-cyan-200/20
                    bg-cyan-300/10
                    text-5xl
                    shadow-[0_0_55px_rgba(165,243,252,0.12)]
                  "
                >
                  ◉
                </div>

                <h3
                  className="
                    mt-7
                    text-2xl
                    font-black
                    text-white
                  "
                >
                  Scan a physical card
                </h3>

                <p
                  className="
                    mt-3
                    text-sm
                    font-medium
                    leading-6
                    text-white/45
                  "
                >
                  Use a dark background, fill the frame and
                  keep the camera parallel with the card.
                </p>

                <div
                  className="
                    mt-7
                    flex
                    w-full
                    flex-col
                    gap-3
                    sm:flex-row
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      void startCamera()
                    }
                    disabled={disabled}
                    className="
                      min-h-14
                      flex-1
                      rounded-2xl
                      border
                      border-cyan-100/25
                      bg-cyan-200
                      px-5
                      font-black
                      text-cyan-950
                      transition
                      hover:-translate-y-0.5
                      hover:bg-cyan-100
                      disabled:opacity-40
                    "
                  >
                    Open camera
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={disabled}
                    className="
                      min-h-14
                      flex-1
                      rounded-2xl
                      border
                      border-white/15
                      bg-white/[0.07]
                      px-5
                      font-black
                      text-white
                      transition
                      hover:bg-white/10
                      disabled:opacity-40
                    "
                  >
                    Upload photo
                  </button>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={
              handleImageUpload
            }
            className="hidden"
          />

          {scanning && (
            <div
              className="
                mt-5
                rounded-[1.75rem]
                border
                border-cyan-200/15
                bg-cyan-300/[0.06]
                p-5
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                  text-sm
                  font-black
                "
              >
                <span className="text-cyan-100">
                  {status}
                </span>

                <span className="text-white/40">
                  {progress}%
                </span>
              </div>

              <div
                className="
                  mt-3
                  h-3
                  overflow-hidden
                  rounded-full
                  border
                  border-white/10
                  bg-black/30
                  p-0.5
                "
              >
                <div
                  className="
                    h-full
                    rounded-full
                    bg-gradient-to-r
                    from-cyan-500
                    via-cyan-200
                    to-emerald-200
                    shadow-[0_0_20px_rgba(165,243,252,0.45)]
                    transition-[width]
                  "
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              className="
                mt-5
                rounded-[1.75rem]
                border
                border-red-300/20
                bg-red-500/10
                px-5
                py-4
                font-bold
                text-red-100
              "
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="
            min-h-[34rem]
            rounded-[2.25rem]
            border
            border-white/10
            bg-black/15
            p-5
            md:p-6
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-4
            "
          >
            <div>
              <p
                className="
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-white/35
                "
              >
                Recognition results
              </p>

              <h3
                className="
                  mt-2
                  text-2xl
                  font-black
                  text-white
                "
              >
                Confirm the card
              </h3>
            </div>

            {candidates.length >
              0 && (
              <span
                className={`
                  rounded-full
                  border
                  px-3
                  py-1.5
                  text-xs
                  font-black
                  ${
                    bestConfidence >=
                    85
                      ? `
                        border-emerald-200/20
                        bg-emerald-300/10
                        text-emerald-100
                      `
                      : `
                        border-amber-200/20
                        bg-amber-300/10
                        text-amber-100
                      `
                  }
                `}
              >
                Best match{" "}
                {bestConfidence}%
              </span>
            )}
          </div>

          {candidates.length >
          0 ? (
            <div
              className="
                mt-6
                max-h-[42rem]
                space-y-3
                overflow-y-auto
                pr-1
              "
            >
              {candidates.map(
                (
                  candidate,
                  index,
                ) => (
                  <button
                    key={
                      candidate.card.id
                    }
                    type="button"
                    onClick={() =>
                      onSelect(
                        candidate.card,
                      )
                    }
                    className="
                      group
                      flex
                      w-full
                      items-center
                      gap-4
                      rounded-[1.5rem]
                      border
                      border-white/10
                      bg-white/[0.045]
                      p-3
                      text-left
                      transition
                      hover:border-emerald-200/25
                      hover:bg-emerald-300/[0.08]
                    "
                  >
                    <div
                      className="
                        flex
                        h-24
                        w-17
                        flex-none
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-xl
                        border
                        border-white/10
                        bg-black/25
                      "
                    >
                      {candidate.card
                        .image_url ? (
                        <img
                          src={
                            candidate
                              .card
                              .image_url
                          }
                          alt={
                            candidate
                              .card.name
                          }
                          className="
                            h-full
                            w-full
                            object-contain
                            p-1
                          "
                        />
                      ) : (
                        <span className="text-2xl">
                          🎴
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div className="min-w-0">
                          <p
                            className="
                              truncate
                              text-lg
                              font-black
                              text-white
                            "
                          >
                            {
                              candidate
                                .card
                                .name
                            }
                          </p>

                          <p
                            className="
                              mt-1
                              truncate
                              text-xs
                              font-semibold
                              text-white/40
                            "
                          >
                            {candidate
                              .card
                              .set_name ||
                              "Unknown set"}

                            {candidate
                              .card
                              .card_no
                              ? ` · #${candidate.card.card_no}`
                              : ""}
                          </p>
                        </div>

                        <span
                          className={`
                            flex-none
                            rounded-xl
                            px-2.5
                            py-1.5
                            text-xs
                            font-black
                            ${
                              index === 0
                                ? `
                                  bg-emerald-300
                                  text-emerald-950
                                `
                                : `
                                  bg-white/10
                                  text-white/60
                                `
                            }
                          `}
                        >
                          {
                            candidate.confidence
                          }
                          %
                        </span>
                      </div>

                      <div
                        className="
                          mt-3
                          flex
                          flex-wrap
                          gap-2
                        "
                      >
                        {candidate.reasons.map(
                          (reason) => (
                            <span
                              key={
                                reason
                              }
                              className="
                                rounded-full
                                border
                                border-white/10
                                bg-black/15
                                px-2.5
                                py-1
                                text-[0.65rem]
                                font-bold
                                text-white/40
                              "
                            >
                              {reason}
                            </span>
                          ),
                        )}
                      </div>

                      <div
                        className="
                          mt-3
                          flex
                          items-center
                          justify-between
                          gap-3
                        "
                      >
                        <span
                          className="
                            truncate
                            text-xs
                            font-bold
                            text-violet-200/70
                          "
                        >
                          {candidate.card
                            .rarity ||
                            "Unknown rarity"}
                        </span>

                        <span
                          className="
                            text-sm
                            font-black
                            text-emerald-200
                          "
                        >
                          {formatCurrency(
                            candidate
                              .card
                              .market_value,
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
          ) : state ===
            "results" ? (
            <div
              className="
                flex
                min-h-[25rem]
                flex-col
                items-center
                justify-center
                text-center
              "
            >
              <div className="text-5xl">
                ⌕
              </div>

              <h4
                className="
                  mt-5
                  text-xl
                  font-black
                  text-white
                "
              >
                No database match
              </h4>

              <p
                className="
                  mt-3
                  max-w-sm
                  text-sm
                  font-medium
                  leading-6
                  text-white/40
                "
              >
                Retake the photo with less glare or use the
                manual database search below.
              </p>
            </div>
          ) : (
            <div
              className="
                flex
                min-h-[25rem]
                flex-col
                items-center
                justify-center
                text-center
              "
            >
              <div
                className="
                  flex
                  h-20
                  w-20
                  items-center
                  justify-center
                  rounded-[1.75rem]
                  border
                  border-white/10
                  bg-white/[0.045]
                  text-4xl
                "
              >
                ✦
              </div>

              <h4
                className="
                  mt-5
                  text-xl
                  font-black
                  text-white
                "
              >
                Matches appear here
              </h4>

              <p
                className="
                  mt-3
                  max-w-sm
                  text-sm
                  font-medium
                  leading-6
                  text-white/40
                "
              >
                The scanner checks the card name and
                collector number against your existing
                Unown Pulls database.
              </p>
            </div>
          )}

          {scanDetails && (
            <details
              className="
                mt-5
                rounded-2xl
                border
                border-white/10
                bg-black/15
                p-4
              "
            >
              <summary
                className="
                  cursor-pointer
                  text-sm
                  font-black
                  text-white/55
                "
              >
                Scanner diagnostics
              </summary>

              <div
                className="
                  mt-4
                  space-y-3
                  text-xs
                  font-semibold
                  text-white/35
                "
              >
                <p>
                  Names detected:{" "}
                  {scanDetails.names.join(
                    ", ",
                  ) || "None"}
                </p>

                <p>
                  Numbers detected:{" "}
                  {scanDetails.collectorNumbers.join(
                    ", ",
                  ) || "None"}
                </p>

                <pre
                  className="
                    max-h-32
                    overflow-auto
                    whitespace-pre-wrap
                    rounded-xl
                    bg-black/25
                    p-3
                    text-[0.65rem]
                    leading-5
                    text-white/30
                  "
                >
                  {
                    scanDetails.fullText
                  }
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}