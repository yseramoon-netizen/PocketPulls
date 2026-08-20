import { readFile } from "node:fs/promises";
import process from "node:process";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function metrics(records) {
  const resolved = records.filter((record) => record.predictedCardId);
  const correct = records.filter((record) => record.predictedCardId === record.expectedCardId);
  const incorrect = resolved.filter((record) => record.predictedCardId !== record.expectedCardId);
  const unresolved = records.filter((record) => !record.predictedCardId);
  const totalMs = records.map((record) => Number(record.timings?.totalMs || 0)).filter(Number.isFinite);
  const captureMs = records.map((record) => Number(record.timings?.captureMs || 0)).filter(Number.isFinite);
  const ocrMs = records.map((record) => Number(record.timings?.ocrMs || 0)).filter(Number.isFinite);
  return {
    samples: records.length,
    correct: correct.length,
    incorrect: incorrect.length,
    unresolved: unresolved.length,
    correctRate: round(correct.length / Math.max(1, records.length) * 100),
    incorrectRate: round(incorrect.length / Math.max(1, records.length) * 100),
    unresolvedRate: round(unresolved.length / Math.max(1, records.length) * 100),
    top3Rate: round(records.filter((record) => record.candidateIds?.slice(0, 3).includes(record.expectedCardId)).length / Math.max(1, records.length) * 100),
    averageConfidence: round(mean(records.map((record) => Number(record.confidence || 0)))),
    averageLatencyMs: round(mean(totalMs)),
    p95LatencyMs: round(percentile(totalMs, 0.95)),
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
if (!Array.isArray(parsed) || !parsed.length) {
  console.error("Benchmark input must be a non-empty JSON array exported from scanner diagnostics.");
  process.exit(2);
}

const result = { overall: metrics(parsed), byTag: {} };
const tags = [...new Set(parsed.flatMap((record) => Array.isArray(record.tags) ? record.tags : []))];
for (const tag of tags) result.byTag[tag] = metrics(parsed.filter((record) => record.tags?.includes(tag)));
console.log(JSON.stringify(result, null, 2));
