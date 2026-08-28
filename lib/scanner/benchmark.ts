"use client";

import type { ScannerDebugSnapshot, ScannerIdentification } from "./types";
import { SCANNER_VERSION } from "./version";

export { SCANNER_VERSION } from "./version";

export type ScannerBenchmarkRecord = {
  caseId: string;
  recordedAt: string;
  acceptance: "auto" | "review";
  verificationStatus: "pending" | "verified";
  expectedCardId: string | null;
  predictedCardId: string | null;
  candidateIds: string[];
  confidence: number;
  correct: boolean | null;
  totalLatencyMs: number;
  timings: ScannerIdentification["debug"]["timings"];
  tags: string[];
};

export type ScannerBenchmarkExport = {
  schemaVersion: 2;
  scannerVersion: string;
  exportedAt: string;
  records: ScannerBenchmarkRecord[];
  summary: ReturnType<typeof summariseBenchmarkRecords>;
};

const STORAGE_KEY = "ancient-pulls.scanner-benchmark.v2";
const MAX_RECORDS = 2_000;

function totalLatency(
  timings: ScannerIdentification["debug"]["timings"],
): number {
  return Math.max(0, Number(timings.captureMs) || 0) +
    Math.max(0, Number(timings.totalMs) || 0);
}

function readRecords(): ScannerBenchmarkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value as ScannerBenchmarkRecord[] : [];
  } catch {
    return [];
  }
}

function writeRecords(records: ScannerBenchmarkRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1),
  );
  return Math.round(sorted[index]);
}

export function summariseBenchmarkRecords(records: ScannerBenchmarkRecord[]) {
  const verified = records.filter((record) => record.verificationStatus === "verified");
  const automatic = verified.filter((record) => record.acceptance === "auto");
  const wrongAutomatic = automatic.filter((record) => record.correct === false);
  const unresolved = verified.filter((record) => !record.predictedCardId);

  return {
    totalSamples: verified.length,
    pendingVerification: records.length - verified.length,
    autoAcceptedSamples: automatic.length,
    correctAutoAccepts: automatic.filter((record) => record.correct === true).length,
    wrongAutoWrites: wrongAutomatic.length,
    unresolvedSamples: unresolved.length,
    queueDrops: 0,
    duplicateWrites: 0,
    p95LatencyMs: percentile(verified.map((record) => record.totalLatencyMs), 0.95),
    autoCoveragePercent: verified.length
      ? Number((automatic.length / verified.length * 100).toFixed(2))
      : 0,
  };
}

function createRecord(
  identification: ScannerIdentification,
  input: {
    acceptance: "auto" | "review";
    expectedCardId: string | null;
    verificationStatus: "pending" | "verified";
    tags: string[];
  },
): ScannerBenchmarkRecord {
  const predictedCardId = identification.candidates[0]?.card.id === undefined
    ? null
    : String(identification.candidates[0].card.id);
  return {
    caseId: `case-${Date.now()}-${crypto.randomUUID()}`,
    recordedAt: new Date().toISOString(),
    acceptance: input.acceptance,
    verificationStatus: input.verificationStatus,
    expectedCardId: input.expectedCardId,
    predictedCardId,
    candidateIds: identification.candidates.map((candidate) => String(candidate.card.id)),
    confidence: identification.confidence,
    correct: input.verificationStatus === "verified"
      ? predictedCardId === input.expectedCardId
      : null,
    totalLatencyMs: totalLatency(identification.debug.timings),
    timings: identification.debug.timings,
    tags: input.tags,
  };
}

export function recordAutoPrediction(
  identification: ScannerIdentification,
): ScannerBenchmarkRecord {
  const record = createRecord(identification, {
    acceptance: "auto",
    expectedCardId: null,
    verificationStatus: "pending",
    tags: ["automatic-intake", "mobile"],
  });
  writeRecords([...readRecords(), record]);
  return record;
}

export function verifyBenchmarkPrediction(caseId: string, correct: boolean): void {
  writeRecords(readRecords().map((record) => {
    if (record.caseId !== caseId) return record;
    return {
      ...record,
      verificationStatus: "verified" as const,
      expectedCardId: correct ? record.predictedCardId : "__incorrect__",
      correct,
      tags: [...new Set([...record.tags, "operator-verified"])],
    };
  }));
}

export function recordBenchmarkDecision(
  identification: ScannerIdentification,
  expectedCardId: string | number,
  tags: string[] = ["operator-confirmed"],
): ScannerBenchmarkRecord {
  const expected = String(expectedCardId);
  const record = createRecord(identification, {
    acceptance: "review",
    expectedCardId: expected,
    verificationStatus: "verified",
    tags,
  });
  writeRecords([...readRecords(), record]);
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
  const payload: ScannerBenchmarkExport = {
    schemaVersion: 2,
    scannerVersion: SCANNER_VERSION,
    exportedAt: new Date().toISOString(),
    records,
    summary: summariseBenchmarkRecords(records),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
    scannerVersion: SCANNER_VERSION,
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
