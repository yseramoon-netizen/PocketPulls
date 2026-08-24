"use client";

import type { ScannerDebugSnapshot, ScannerIdentification } from "./types";

export type ScannerBenchmarkRecord = {
  caseId: string;
  recordedAt: string;
  expectedCardId: string;
  predictedCardId: string | null;
  candidateIds: string[];
  confidence: number;
  correct: boolean;
  timings: ScannerIdentification["debug"]["timings"];
  tags: string[];
};

const STORAGE_KEY = "ancient-pulls.scanner-benchmark.v1";
const MAX_RECORDS = 500;

function readRecords(): ScannerBenchmarkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value as ScannerBenchmarkRecord[] : [];
  } catch {
    return [];
  }
}

export function recordBenchmarkDecision(
  identification: ScannerIdentification,
  expectedCardId: string | number,
  tags: string[] = ["operator-confirmed"],
): ScannerBenchmarkRecord {
  const expected = String(expectedCardId);
  const predictedCardId = identification.candidates[0]?.card.id === undefined
    ? null
    : String(identification.candidates[0].card.id);
  const record: ScannerBenchmarkRecord = {
    caseId: `case-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recordedAt: new Date().toISOString(),
    expectedCardId: expected,
    predictedCardId,
    candidateIds: identification.candidates.map((candidate) => String(candidate.card.id)),
    confidence: identification.confidence,
    correct: predictedCardId === expected,
    timings: identification.debug.timings,
    tags,
  };
  if (typeof window !== "undefined") {
    const records = [...readRecords(), record].slice(-MAX_RECORDS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  return record;
}

export function benchmarkRecordCount(): number {
  return readRecords().length;
}

export function clearBenchmarkRecords(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function downloadBenchmarkRecords(): void {
  if (typeof window === "undefined") return;
  const records = readRecords();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ancient-pulls-scanner-benchmark-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadDiagnosticSnapshot(snapshot: ScannerDebugSnapshot): void {
  if (typeof window === "undefined") return;
  const payload = {
    scannerVersion: "52.0-visual-consensus",
    exportedAt: new Date().toISOString(),
    timings: snapshot.timings,
    visualIndex: snapshot.visualIndex,
    evidence: snapshot.evidence,
    observations: snapshot.observations,
    candidates: snapshot.candidates.map((candidate) => ({
      card: {
        id: String(candidate.card.id),
        name: candidate.card.name,
        set: candidate.card.set_name || candidate.card.set_id,
        collectorNumber: candidate.card.card_no,
        printedTotal: candidate.card.set_printed_total,
      },
      confidence: candidate.confidence,
      rawScore: candidate.rawScore,
      evidence: candidate.evidence,
      evidenceCount: candidate.evidenceCount,
      exactCollector: candidate.exactCollector,
      exactSet: candidate.exactSet,
      visualConfidence: candidate.visualConfidence,
      visualBreakdown: candidate.visualBreakdown,
      reasons: candidate.reasons,
    })),
    regionNames: Object.keys(snapshot.regions),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ancient-pulls-current-scan-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
