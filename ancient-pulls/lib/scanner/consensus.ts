import type { FrameObservation, ScannerEvidence } from "./types";
import { normaliseCollector, normaliseSetCode, normaliseText } from "./text";

function rankedValues<T>(
  items: Array<{ value: T; weight: number }>,
  key: (value: T) => string,
): Array<{ value: T; weight: number }> {
  const map = new Map<string, { value: T; weight: number }>();
  for (const item of items) {
    const id = key(item.value);
    if (!id) continue;
    const existing = map.get(id);
    if (existing) existing.weight += item.weight;
    else map.set(id, { ...item });
  }
  return [...map.values()].sort((left, right) => right.weight - left.weight);
}

export function buildConsensus(observations: FrameObservation[]): ScannerEvidence {
  const names: Array<{ value: string; weight: number }> = [];
  const collectorNumbers: Array<{ value: string; weight: number }> = [];
  const collectorFractions: ScannerEvidence["collectorFractions"] = [];
  const setCodes: Array<{ value: string; weight: number }> = [];
  const hpValues: Array<{ value: number; weight: number }> = [];
  for (const observation of observations) {
    const frameWeight = Math.max(0.2, observation.qualityWeight);
    for (const name of observation.names) names.push({ value: name, weight: frameWeight });
    for (const number of observation.collectorNumbers) {
      collectorNumbers.push({ value: number, weight: frameWeight });
    }
    for (const fraction of observation.collectorFractions) {
      collectorFractions.push({ ...fraction, weight: frameWeight * Math.max(0.35, fraction.confidence) });
    }
    for (const code of observation.setCodes) setCodes.push({ value: code, weight: frameWeight });
    for (const hp of observation.hpValues) hpValues.push({ value: hp, weight: frameWeight });
  }
  const fractionMap = new Map<string, ScannerEvidence["collectorFractions"][number]>();
  for (const fraction of collectorFractions) {
    const key = `${normaliseCollector(fraction.numerator)}/${fraction.denominator ?? ""}`;
    const existing = fractionMap.get(key);
    if (existing) existing.weight += fraction.weight;
    else fractionMap.set(key, { ...fraction });
  }
  return {
    names: rankedValues(names, (value) => normaliseText(value)).slice(0, 8),
    collectorNumbers: rankedValues(collectorNumbers, normaliseCollector).slice(0, 8),
    collectorFractions: [...fractionMap.values()].sort((a, b) => b.weight - a.weight).slice(0, 8),
    setCodes: rankedValues(setCodes, normaliseSetCode).slice(0, 8),
    hpValues: rankedValues(hpValues, (value) => String(value)).slice(0, 6),
    observations: observations.length,
  };
}

export function evidenceLooksUseful(evidence: ScannerEvidence): boolean {
  return Boolean(
    evidence.collectorFractions.length ||
    evidence.collectorNumbers.length ||
    evidence.names.length ||
    evidence.setCodes.length,
  );
}
