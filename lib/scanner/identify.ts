"use client";

import { adminFetch } from "@/lib/admin/client-auth";
import { fingerprintCanvasOrientations } from "./compact-visual";
import { buildConsensus, evidenceLooksUseful } from "./consensus";
import { ScannerOcrEngine, type FrameRecognitionResult } from "./ocr-engine";
import { CARD_REGIONS, cropRegion, previewCanvas } from "./regions";
import {
  calibrateCandidates,
  scoreCandidates,
  scoreImageFirstMatches,
} from "./scoring";
import type {
  CandidateRequest,
  CandidateResponse,
  ScannerCandidate,
  ScannerEvidence,
  ScannerIdentification,
  TrackedFrame,
  VisualSearchResponse,
} from "./types";

type ProgressCallback = (status: string, progress: number) => void;

const EMPTY_EVIDENCE: ScannerEvidence = {
  names: [],
  collectorNumbers: [],
  collectorFractions: [],
  setCodes: [],
  hpValues: [],
  observations: 0,
};

function debugRegions(source: HTMLCanvasElement): Record<string, string> {
  return {
    name: previewCanvas(cropRegion(source, CARD_REGIONS.name, 720)),
    nameWide: previewCanvas(cropRegion(source, CARD_REGIONS.nameWide, 720)),
    collector: previewCanvas(cropRegion(source, CARD_REGIONS.collector, 720)),
    collectorRight: previewCanvas(cropRegion(source, CARD_REGIONS.collectorRight, 720)),
    footer: previewCanvas(cropRegion(source, CARD_REGIONS.footer, 900)),
    set: previewCanvas(cropRegion(source, CARD_REGIONS.set, 720)),
    symbol: previewCanvas(cropRegion(source, CARD_REGIONS.symbol, 420)),
    artwork: previewCanvas(cropRegion(source, CARD_REGIONS.artwork, 720)),
  };
}

function emptyRecognition(frames: TrackedFrame[]): FrameRecognitionResult {
  const canonicalFrames = frames.map((frame) => frame.canvas);
  return {
    observations: [],
    canonicalFrames,
    debugRegions: canonicalFrames[0] ? debugRegions(canonicalFrames[0]) : {},
    ocrMs: 0,
  };
}

function visualIsDecisive(matches: VisualSearchResponse["matches"]): boolean {
  const first = matches[0];
  if (!first || first.frameCount < 2 || first.agreement < 0.90 || first.similarity < 0.58) return false;
  const second = matches[1];
  return !second || first.similarity - second.similarity >= 0.08;
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
    const selectedFrames = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, 3);
    if (!selectedFrames.length) throw new Error("No usable card frame was captured.");

    this.onProgress("Matching card artwork", 8);
    const visualStarted = performance.now();
    const visualResponse = await adminFetch<VisualSearchResponse>("/api/admin/scanner/visual-search", {
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
    const visualMs = performance.now() - visualStarted;

    let recognised = emptyRecognition(selectedFrames);
    let evidence = EMPTY_EVIDENCE;
    let ocrCards: CandidateResponse["cards"] = [];
    let candidateMs = 0;

    // Strong, repeatable image evidence is already the fastest and most
    // discriminative identity signal. OCR is lazy recovery, not a mandatory
    // multi-second toll on every card.
    if (!visualResponse.ready || !visualIsDecisive(visualResponse.matches)) {
      this.onProgress("Image match needs text verification", 56);
      recognised = await this.ocr.recogniseFrames(selectedFrames);
      evidence = buildConsensus(recognised.observations);

      const visualBest = visualResponse.matches[0]?.similarity || 0;
      if (evidenceLooksUseful(evidence) && (!visualResponse.ready || visualBest < 0.42)) {
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
        const candidateStarted = performance.now();
        const response = await adminFetch<CandidateResponse>("/api/admin/scanner/candidates", {
          method: "POST",
          body: JSON.stringify(request),
        });
        candidateMs = performance.now() - candidateStarted;
        ocrCards = response.cards;
      }
    }

    this.onProgress("Ranking database cards", 88);
    let candidates = scoreImageFirstMatches(visualResponse.matches, evidence);
    const visualIds = new Set(candidates.map((candidate) => String(candidate.card.id)));
    const ocrOnly = scoreCandidates(
      ocrCards.filter((card) => !visualIds.has(String(card.id))),
      evidence,
    ).map((candidate) => visualResponse.ready ? {
      ...candidate,
      rawScore: candidate.rawScore * 0.35,
      confidence: Math.round(candidate.confidence * 0.35),
      reasons: [...candidate.reasons, "OCR-only fallback; no supporting image retrieval"],
    } : candidate);
    candidates = calibrateCandidates([...candidates, ...ocrOnly]).slice(0, 5);

    const confidence = candidates[0]?.confidence || 0;
    const margin = candidates.length > 1
      ? candidates[0].confidence - candidates[1].confidence
      : confidence;
    const captured = recognised.canonicalFrames[0] || selectedFrames[0].canvas;
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
        canonical: previewCanvas(captured, 420),
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
  if (!best || best.confidence < 95) return false;
  const second = candidates[1];
  const rawMargin = second ? best.rawScore - second.rawScore : 0.2;
  const stableVisual = (best.visualConfidence || 0) >= 58 &&
    best.visualFrameCount >= 2 && (best.visualAgreement || 0) >= 0.90 && rawMargin >= 0.08;
  const textVerified = best.evidenceCount >= 3 && (
    (best.exactCollector && best.exactSet) ||
    (best.exactCollector && (best.visualConfidence || 0) >= 58)
  );
  return stableVisual || textVerified;
}
