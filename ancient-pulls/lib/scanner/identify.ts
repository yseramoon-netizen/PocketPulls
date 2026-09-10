"use client";

import { adminFetch } from "@/lib/admin/client-auth";
import { fingerprintCanvasOrientations } from "./compact-visual";
import { buildConsensus, evidenceLooksUseful } from "./consensus";
import { ScannerOcrEngine } from "./ocr-engine";
import { previewCanvas } from "./regions";
import {
  calibrateCandidates,
  scoreImageFirstMatches,
  scoreCandidates,
} from "./scoring";
import type {
  CandidateRequest,
  CandidateResponse,
  ScannerCandidate,
  ScannerIdentification,
  TrackedFrame,
  VisualSearchResponse,
} from "./types";

type ProgressCallback = (status: string, progress: number) => void;
type IdentifyOptions = {
  automatic?: boolean;
  diagnostics?: boolean;
  signal?: AbortSignal;
};

function supportsFastVerification(response: VisualSearchResponse): boolean {
  const best = response.matches[0];
  if (!response.ready || !best || best.similarity < 0.84 || best.agreement < 0.88) return false;
  const second = response.matches[1];
  return !second || best.similarity - second.similarity >= 0.025;
}

export class CardIdentifier {
  private readonly ocr: ScannerOcrEngine;
  private readonly onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
    this.ocr = new ScannerOcrEngine(onProgress);
  }

  async warmup(): Promise<void> {
    await this.ocr.warmup();
  }

  async identify(
    frames: TrackedFrame[],
    captureMs: number,
    options: IdentifyOptions = {},
  ): Promise<ScannerIdentification> {
    options.signal?.throwIfAborted();
    const totalStarted = performance.now();
    const selectedFrames = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, 3);
    if (!selectedFrames.length) throw new Error("No usable card frame was captured.");

    this.onProgress("Searching the visual card index", 7);
    const visualStarted = performance.now();
    const visualResponse = await adminFetch<VisualSearchResponse>(
      "/api/admin/scanner/visual-search",
      {
        signal: options.signal,
        method: "POST",
        body: JSON.stringify({
          frames: selectedFrames.slice(0, 2)
            .map((frame) => fingerprintCanvasOrientations(frame.canvas)),
        }),
      },
    ).catch((error: unknown): VisualSearchResponse => ({
      ok: true,
      ready: false,
      indexedCount: 0,
      totalCount: 0,
      error: error instanceof Error ? error.message : "The visual search request failed.",
      matches: [],
    }));
    options.signal?.throwIfAborted();
    const visualMs = performance.now() - visualStarted;

    const fastVisual = supportsFastVerification(visualResponse);
    const strategy = fastVisual
      ? options.automatic && selectedFrames.length >= 2 ? "visual-verify" : "visual-only"
      : "recovery";
    this.onProgress(
      strategy === "visual-only"
        ? "Visual match ready"
        : strategy === "visual-verify"
          ? "Verifying the visual match"
          : "Running recovery recognition",
      55,
    );
    const recognised = strategy === "visual-only"
      ? {
        observations: [],
        canonicalFrames: [selectedFrames[0].canvas],
        debugRegions: {},
        ocrMs: 0,
      }
      : strategy === "visual-verify"
        ? await this.ocr.recogniseVerificationFrame(
          selectedFrames[0],
          visualResponse.matches[0].orientation,
          options,
        )
        : await this.ocr.recogniseFrames(selectedFrames, options);
    options.signal?.throwIfAborted();
    const evidence = buildConsensus(recognised.observations);

    this.onProgress("Calibrating match confidence", 74);
    const candidateStarted = performance.now();
    let ocrCards: CandidateResponse["cards"] = [];
    // Strong visual retrieval already returned the relevant catalogue rows.
    // The database candidate fan-out is recovery work, not a normal scan cost.
    if (strategy === "recovery" && evidenceLooksUseful(evidence)) {
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
        signal: options.signal,
        method: "POST",
        body: JSON.stringify(request),
      });
      ocrCards = response.cards;
    }
    options.signal?.throwIfAborted();
    const candidateMs = performance.now() - candidateStarted;

    let candidates = scoreImageFirstMatches(visualResponse.matches, evidence);
    const visualIds = new Set(candidates.map((candidate) => String(candidate.card.id)));
    const ocrOnly = scoreCandidates(
      ocrCards.filter((card) => !visualIds.has(String(card.id))),
      evidence,
    ).map((candidate) => visualResponse.ready ? {
      ...candidate,
      rawScore: candidate.rawScore * 0.35,
      confidence: Math.round(candidate.confidence * 0.35),
      reasons: [...candidate.reasons, "OCR-only fallback; no strong image retrieval"],
    } : candidate);
    if (!visualResponse.ready) {
      this.onProgress("Visual index is not built — using limited OCR fallback", 84);
    }
    candidates = calibrateCandidates([...candidates, ...ocrOnly]).slice(0, 5);
    const captured = recognised.canonicalFrames[0];
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
        strategy,
        original: options.diagnostics ? frames[0]?.preview || "" : "",
        canonical: options.diagnostics && captured ? previewCanvas(captured, 420) : "",
        regions: recognised.debugRegions,
        observations: recognised.observations,
        evidence,
        candidates,
        timings,
        visualIndex: {
          ready: visualResponse.ready,
          indexedCount: visualResponse.indexedCount,
          totalCount: visualResponse.totalCount,
          error: visualResponse.error || null,
        },
      },
    };
  }

  async dispose(): Promise<void> {
    await this.ocr.dispose();
  }
}

export { shouldAutomaticallyAccept } from "./acceptance";
