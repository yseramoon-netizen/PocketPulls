import type { ScannerCandidate } from "./types";

/** Automatic inventory writes need identity proof as well as visual similarity. */
export function shouldAutomaticallyAccept(candidates: ScannerCandidate[]): boolean {
  const best = candidates[0];
  if (!best || best.confidence < 95 || best.evidenceCount < 4 ||
    best.visualFrameCount < 2 || (best.visualAgreement ?? 0) < 0.94 ||
    (best.visualConfidence ?? 0) < 84 || best.evidence.name < 0.84 ||
    !best.exactCollector || !best.exactSet || best.identityConflicts?.length) return false;
  const second = candidates[1];
  return !second || best.confidence - second.confidence >= 5;
}
