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

export class CardIdentifier {
  private readonly ocr: ScannerOcrEngine;
  private readonly onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
    this.ocr = new ScannerOcrEngine(onProgress);
  }

  async identify(frames: TrackedFrame[], captureMs: number): Promise<ScannerIdentification> {
    const totalStarted = performance.now();
    const selectedFrames = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, 3);
    this.onProgress("Searching the visual card index", 7);
    const visualStarted = performance.now();
    const visualRequest = adminFetch<VisualSearchResponse>("/api/admin/scanner/visual-search", {
      method: "POST",
      body: JSON.stringify({
        frames: selectedFrames.map((frame) => fingerprintCanvasOrientations(frame.canvas)),
      }),
    }).catch((error: unknown): VisualSearchResponse => ({
      ok: true,
      ready: false,
      indexedCount: 0,
      totalCount: 0,
      error: error instanceof Error ? error.message : "The visual search request failed.",
      matches: [],
    }));
    // OCR is deliberately parallel supporting evidence. It no longer decides
    // which cards the visual engine is allowed to inspect.
    const [visualResponse, recognised] = await Promise.all([
      visualRequest,
      this.ocr.recogniseFrames(selectedFrames),
    ]);
    const visualMs = performance.now() - visualStarted;
    const evidence = buildConsensus(recognised.observations);
    this.onProgress("Verifying the visual matches", 74);
    const candidateStarted = performance.now();
    let ocrCards: CandidateResponse["cards"] = [];
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
      ocrCards = response.cards;
    }
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
        original: frames[0]?.preview || "",
        canonical: captured ? previewCanvas(captured, 420) : "",
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
