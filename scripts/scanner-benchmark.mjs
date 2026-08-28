import { readFile } from "node:fs/promises";
import process from "node:process";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index];
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function readLatency(record) {
  const explicit = Number(record.totalLatencyMs);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const capture = Number(record.timings?.captureMs || 0);
  const recognition = Number(record.timings?.totalMs || 0);
  return Math.max(0, capture) + Math.max(0, recognition);
}

function metrics(records) {
  const resolved = records.filter((record) => record.predictedCardId);
  const correct = records.filter((record) => record.correct === true || (
    record.correct == null && record.expectedCardId &&
    record.predictedCardId === record.expectedCardId
  ));
  const incorrect = records.filter((record) => record.correct === false || (
    record.correct == null && record.predictedCardId && record.expectedCardId &&
    record.predictedCardId !== record.expectedCardId
  ));
  const unresolved = records.filter((record) => !record.predictedCardId);
  const automatic = records.filter((record) => record.acceptance === "auto");
  const wrongAutomatic = automatic.filter((record) => record.correct !== true);
  const latencies = records.map(readLatency).filter(Number.isFinite);
  const captureMs = records
    .map((record) => Number(record.timings?.captureMs || 0))
    .filter(Number.isFinite);
  const ocrMs = records
    .map((record) => Number(record.timings?.ocrMs || 0))
    .filter(Number.isFinite);

  return {
    samples: records.length,
    resolved: resolved.length,
    correct: correct.length,
    incorrect: incorrect.length,
    unresolved: unresolved.length,
    automatic: automatic.length,
    wrongAutomatic: wrongAutomatic.length,
    correctRate: round(correct.length / Math.max(1, records.length) * 100),
    incorrectRate: round(incorrect.length / Math.max(1, records.length) * 100),
    unresolvedRate: round(unresolved.length / Math.max(1, records.length) * 100),
    autoCoverageRate: round(automatic.length / Math.max(1, records.length) * 100),
    top3Rate: round(records.filter((record) =>
      record.candidateIds?.slice(0, 3).includes(record.expectedCardId),
    ).length / Math.max(1, records.length) * 100),
    averageConfidence: round(mean(records.map((record) => Number(record.confidence || 0)))),
    averageLatencyMs: round(mean(latencies)),
    p95LatencyMs: round(percentile(latencies, 0.95)),
    averageCaptureMs: round(mean(captureMs)),
    averageOcrMs: round(mean(ocrMs)),
  };
}

const input = valueAfter("--input") || process.argv[2];
if (!input) {
  console.error("Usage: npm run benchmark:scanner -- --input ./scanner-results.json");
  process.exit(2);
}

const parsed = JSON.parse(await readFile(input, "utf8"));
const allRecords = Array.isArray(parsed) ? parsed : parsed?.records;
if (!Array.isArray(allRecords) || !allRecords.length) {
  console.error("Benchmark input must be a non-empty scanner export or record array.");
  process.exit(2);
}

const verified = allRecords.filter((record) =>
  !record.verificationStatus || record.verificationStatus === "verified",
);
const pendingVerification = allRecords.length - verified.length;
const overall = metrics(verified);
const tags = [...new Set(verified.flatMap((record) =>
  Array.isArray(record.tags) ? record.tags : [],
))];
const byTag = Object.fromEntries(tags.map((tag) => [
  tag,
  metrics(verified.filter((record) => record.tags?.includes(tag))),
]));
const releaseGate = {
  passed: overall.samples >= 1_000 &&
    overall.automatic >= 500 &&
    overall.wrongAutomatic === 0 &&
    overall.p95LatencyMs <= 1_000,
  requirements: {
    verifiedSamples: `${overall.samples}/1000`,
    automaticSamples: `${overall.automatic}/500`,
    wrongAutomatic: `${overall.wrongAutomatic}/0`,
    p95LatencyMs: `${overall.p95LatencyMs}/1000`,
  },
};

console.log(JSON.stringify({
  schemaVersion: Array.isArray(parsed) ? 1 : parsed.schemaVersion || null,
  scannerVersion: Array.isArray(parsed) ? null : parsed.scannerVersion || null,
  pendingVerification,
  overall,
  byTag,
  releaseGate,
}, null, 2));
