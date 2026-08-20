"use client";

import { adminFetch, adminFetchBlob } from "@/lib/admin/client-auth";
import { buildConsensus, evidenceLooksUseful } from "./consensus";
import { ScannerOcrEngine } from "./ocr-engine";
import { previewCanvas } from "./regions";
import {
  applyVisualEvidence,
  calibrateCandidates,
  scoreCandidates,
} from "./scoring";
import type {
  CandidateRequest,
  CandidateResponse,
  ScannerCandidate,
  ScannerIdentification,
  TrackedFrame,
} from "./types";

type ProgressCallback = (status: string, progress: number) => void;

function loadBlobImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const finish = (value: HTMLImageElement | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

async function loadReference(cardId: string): Promise<HTMLImageElement | null> {
  try {
    const blob = await adminFetchBlob("/api/admin/scanner/reference-image", {
      method: "POST",
      body: JSON.stringify({ cardId }),
      headers: { "Content-Type": "application/json" },
    });
    return loadBlobImage(blob);
  } catch {
    return null;
  }
}

async function mapLimited<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export class CardIdentifier {
  private readonly ocr: ScannerOcrEngine;
  private readonly onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
    this.ocr = new ScannerOcrEngine(onProgress);
  }

  async identify(frames: TrackedFrame[], captureMs: number): Promise<ScannerIdentification> {
    const totalStarted = performance.now();
    const recognised = await this.ocr.recogniseFrames(frames);
    const evidence = buildConsensus(recognised.observations);
    this.onProgress("Searching the card catalogue", 72);
    const candidateStarted = performance.now();
    let cards: CandidateResponse["cards"] = [];
    if (evidenceLooksUseful(evidence)) {
      const request: CandidateRequest = {
        names: evidence.names.map((item) => item.value),
        collectorNumbers: [
          ...evidence.collectorFractions.map((item) => item.numerator),
          ...evidence.collectorNumbers.map((item) => item.value),
        ],
        denominators: evidence.collectorFractions
          .map((item) => item.denominator)
          .filter((value): value is number => value !== null),
        setCodes: evidence.setCodes.map((item) => item.value),
        limit: 180,
      };
      const response = await adminFetch<CandidateResponse>("/api/admin/scanner/candidates", {
        method: "POST",
        body: JSON.stringify(request),
      });
      cards = response.cards;
    }
    const candidateMs = performance.now() - candidateStarted;
    let candidates = scoreCandidates(cards, evidence).slice(0, 12);
    this.onProgress("Comparing artwork and card layout", 84);
    const visualStarted = performance.now();
    const captured = recognised.canonicalFrames[0];
    if (captured && candidates.length) {
      candidates = await mapLimited(candidates.slice(0, 10), 3, async (candidate) => {
        const reference = await loadReference(candidate.card.id);
        return reference ? applyVisualEvidence(candidate, captured, reference) : candidate;
      });
    }
    candidates = calibrateCandidates(candidates).slice(0, 5);
    const visualMs = performance.now() - visualStarted;
    const confidence = candidates[0]?.confidence || 0;
    const margin = candidates.length > 1
      ? candidates[0].confidence - candidates[1].confidence
      : confidence;
    this.onProgress(
      candidates.length ? `${candidates[0].card.name} identified` : "No confident card match",
      100,
    );
    const timings = {
      captureMs,
      ocrMs: recognised.ocrMs,
      candidateMs,
      visualMs,
      totalMs: performance.now() - totalStarted,
    };
    return {
      candidates,
      evidence,
      confidence,
      margin,
      debug: {
        original: frames[0]?.preview || "",
        canonical: captured ? previewCanvas(captured, 420) : "",
        regions: recognised.debugRegions,
        observations: recognised.observations,
        evidence,
        candidates,
        timings,
      },
    };
  }

  async dispose(): Promise<void> {
    await this.ocr.dispose();
  }
}

export function shouldAutomaticallyAccept(candidates: ScannerCandidate[]): boolean {
  const best = candidates[0];
  if (!best || best.confidence < 95 || best.evidenceCount < 3) return false;
  const second = candidates[1];
  const margin = second ? best.confidence - second.confidence : 20;
  return margin >= 5 && (
    (best.exactCollector && best.exactSet) ||
    (best.exactCollector && (best.visualConfidence || 0) >= 84)
  );
}
