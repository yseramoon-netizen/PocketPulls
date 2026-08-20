import {
  compareVisionSignatures,
  createVisionSignature,
} from "./card-vision";
import { CARD_REGIONS } from "./regions";
import {
  nameSimilarity,
  normaliseCollector,
  setCodeSimilarity,
} from "./text";
import type {
  CandidateEvidence,
  IndexedVisualMatch,
  ScannerCandidate,
  ScannerEvidence,
  ScannerPokemonCard,
  VisualBreakdown,
} from "./types";

export const SCANNER_WEIGHTS = {
  collector: 0.42,
  set: 0.22,
  name: 0.21,
  visual: 0.11,
  secondary: 0.04,
} as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function numeric(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectorScore(card: ScannerPokemonCard, evidence: ScannerEvidence): {
  score: number;
  exact: boolean;
} {
  const cardNumber = normaliseCollector(card.card_no || "");
  if (!cardNumber) return { score: 0, exact: false };
  let score = 0;
  let exact = false;
  for (const fraction of evidence.collectorFractions) {
    const numerator = normaliseCollector(fraction.numerator);
    if (numerator === cardNumber) {
      const denominatorMatches = fraction.denominator === null ||
        numeric(card.set_printed_total) === fraction.denominator;
      const repeated = fraction.weight >= 1.25;
      const reliableSingle = fraction.confidence >= 0.82;
      score = Math.max(score, denominatorMatches
        ? repeated ? 1 : reliableSingle ? 0.92 : 0.84
        : 0.66);
      if (denominatorMatches && (repeated || reliableSingle)) exact = true;
    }
  }
  for (const item of evidence.collectorNumbers) {
    const value = normaliseCollector(item.value);
    if (value === cardNumber) {
      // A numerator without a denominator is useful for candidate generation,
      // but it is not an exact identity signal. This prevents attack damage or
      // a copyright digit from receiving the old 90% collector score.
      score = Math.max(score, item.weight >= 1.25 ? 0.74 : 0.52);
    } else if (value.endsWith(cardNumber) || cardNumber.endsWith(value)) {
      score = Math.max(score, 0.58);
    }
  }
  return { score, exact };
}

function setScore(card: ScannerPokemonCard, evidence: ScannerEvidence): {
  score: number;
  exact: boolean;
} {
  const total = numeric(card.set_printed_total);
  let score = 0;
  let exact = false;
  for (const fraction of evidence.collectorFractions) {
    if (fraction.denominator && total === fraction.denominator) {
      const reliable = fraction.weight >= 1.25 || fraction.confidence >= 0.82;
      score = Math.max(score, reliable ? 0.88 : 0.70);
      if (reliable) exact = true;
    }
  }
  const code = card.set_code || card.set_id || "";
  for (const item of evidence.setCodes) {
    const similarity = setCodeSimilarity(code, item.value);
    const reliability = item.weight >= 1.25 ? 1 : 0.78;
    if (similarity >= 0.99 && item.weight >= 1.25) exact = true;
    score = Math.max(score, similarity * reliability);
  }
  return { score, exact };
}

function cardNameScore(card: ScannerPokemonCard, evidence: ScannerEvidence): number {
  let score = 0;
  for (const item of evidence.names) score = Math.max(score, nameSimilarity(card.name, item.value));
  return score;
}

function secondaryScore(card: ScannerPokemonCard, evidence: ScannerEvidence): number {
  const hp = numeric(card.hp);
  if (hp && evidence.hpValues.some((item) => item.value === hp)) return 1;
  return 0;
}

export function scoreCandidates(
  cards: ScannerPokemonCard[],
  evidence: ScannerEvidence,
): ScannerCandidate[] {
  return cards.map((card) => {
    const collector = collectorScore(card, evidence);
    const set = setScore(card, evidence);
    const name = cardNameScore(card, evidence);
    const secondary = secondaryScore(card, evidence);
    const available: Array<[keyof CandidateEvidence, number, number]> = [];
    if (evidence.collectorNumbers.length || evidence.collectorFractions.length) {
      available.push(["collector", collector.score, SCANNER_WEIGHTS.collector]);
    }
    if (evidence.collectorFractions.some((item) => item.denominator) || evidence.setCodes.length) {
      available.push(["set", set.score, SCANNER_WEIGHTS.set]);
    }
    if (evidence.names.length) available.push(["name", name, SCANNER_WEIGHTS.name]);
    if (evidence.hpValues.length && numeric(card.hp)) {
      available.push(["secondary", secondary, SCANNER_WEIGHTS.secondary]);
    }
    const weight = available.reduce((sum, item) => sum + item[2], 0) || 1;
    let rawScore = available.reduce((sum, item) => sum + item[1] * item[2], 0) / weight;
    if (collector.exact && set.exact) rawScore = Math.max(rawScore, 0.88);
    if (collector.exact && name >= 0.84) rawScore = Math.max(rawScore, 0.86);
    const reasons: string[] = [];
    if (collector.exact) reasons.push(`Number ${card.card_no} matched`);
    else if (collector.score >= 0.55) reasons.push("Collector number is compatible");
    if (set.exact) reasons.push(`Set ${card.set_code || card.set_name || card.set_id || "matched"}`);
    if (name >= 0.94) reasons.push("Name matched");
    else if (name >= 0.72) reasons.push("Name is a close OCR match");
    if (secondary === 1) reasons.push(`HP ${card.hp} matched`);
    const evidenceCount = [collector.score >= 0.88, set.score >= 0.84, name >= 0.84, secondary === 1]
      .filter(Boolean).length;
    return {
      card,
      confidence: Math.round(rawScore * 100),
      rawScore,
      evidence: {
        collector: collector.score,
        set: set.score,
        name,
        visual: 0,
        secondary,
      },
      evidenceCount,
      exactCollector: collector.exact,
      exactSet: set.exact,
      visualConfidence: null,
      visualBreakdown: null,
      reasons,
    };
  }).sort((left, right) => right.rawScore - left.rawScore);
}

export function scoreImageFirstMatches(
  matches: IndexedVisualMatch[],
  evidence: ScannerEvidence,
): ScannerCandidate[] {
  const textById = new Map(scoreCandidates(
    matches.map((match) => match.card),
    evidence,
  ).map((candidate) => [String(candidate.card.id), candidate]));
  const hasTextEvidence = Boolean(
    evidence.names.length || evidence.collectorFractions.length ||
    evidence.collectorNumbers.length || evidence.setCodes.length || evidence.hpValues.length,
  );
  return matches.map((match) => {
    const text = textById.get(String(match.card.id));
    const visual = clamp(match.similarity);
    const support = text?.rawScore || 0;
    // OCR can add a small confirmation bonus, but disagreement never drags a
    // visually correct card below an OCR hallucination. Visual retrieval owns
    // identity; text only breaks close visual ties.
    const supportBonus = hasTextEvidence ? Math.max(0, support - 0.60) * 0.12 : 0;
    let rawScore = clamp(visual + supportBonus);
    if (visual >= 0.92 && match.agreement >= 0.94) rawScore = Math.max(rawScore, 0.94);
    const visualSignals = visual >= 0.78 ? 1 : 0;
    const agreementSignal = visual >= 0.78 && match.agreement >= 0.92 ? 1 : 0;
    const breakdown: VisualBreakdown = {
      artwork: match.breakdown.artwork,
      fullCard: match.breakdown.fullCard,
      symbol: 0,
      structure: match.breakdown.artwork,
      edge: match.breakdown.edge,
      colour: match.breakdown.colour,
    };
    return {
      ...(text || {
        card: match.card,
        confidence: 0,
        rawScore: 0,
        evidence: { collector: 0, set: 0, name: 0, visual: 0, secondary: 0 },
        evidenceCount: 0,
        exactCollector: false,
        exactSet: false,
        visualConfidence: null,
        visualBreakdown: null,
        reasons: [],
      }),
      rawScore,
      confidence: Math.round(rawScore * 100),
      evidence: { ...(text?.evidence || { collector: 0, set: 0, name: 0, secondary: 0 }), visual },
      evidenceCount: (text?.evidenceCount || 0) + visualSignals + agreementSignal,
      visualConfidence: Math.round(visual * 100),
      visualBreakdown: breakdown,
      reasons: [
        `Whole-catalogue image match ${Math.round(visual * 100)}%`,
        ...(match.agreement >= 0.92 ? ["Artwork agreed across captured frames"] : []),
        ...(text?.reasons || []),
      ],
    };
  }).sort((left, right) => right.rawScore - left.rawScore);
}

export function applyVisualEvidence(
  candidate: ScannerCandidate,
  captured: HTMLCanvasElement,
  reference: HTMLImageElement,
): ScannerCandidate {
  const fullCrop = { x: 0.025, y: 0.02, width: 0.95, height: 0.96 };
  const artwork = compareVisionSignatures(
    createVisionSignature(captured, CARD_REGIONS.artwork),
    createVisionSignature(reference, CARD_REGIONS.artwork),
  );
  const full = compareVisionSignatures(
    createVisionSignature(captured, fullCrop),
    createVisionSignature(reference, fullCrop),
  );
  const symbol = compareVisionSignatures(
    createVisionSignature(captured, CARD_REGIONS.symbol),
    createVisionSignature(reference, CARD_REGIONS.symbol),
  );
  const visual = clamp(artwork.combined * 0.62 + full.combined * 0.28 + symbol.combined * 0.10);
  const textWeight = 1 - SCANNER_WEIGHTS.visual;
  let rawScore = candidate.rawScore * textWeight + visual * SCANNER_WEIGHTS.visual;
  if (candidate.exactCollector && candidate.exactSet && visual >= 0.72) rawScore = Math.max(rawScore, 0.955);
  if (candidate.exactCollector && visual >= 0.84) rawScore = Math.max(rawScore, 0.93);
  const breakdown: VisualBreakdown = {
    artwork: artwork.combined,
    fullCard: full.combined,
    symbol: symbol.combined,
    structure: artwork.structure,
    edge: artwork.edge,
    colour: artwork.colour,
  };
  return {
    ...candidate,
    rawScore,
    confidence: Math.round(clamp(rawScore) * 100),
    evidence: { ...candidate.evidence, visual },
    evidenceCount: candidate.evidenceCount + (visual >= 0.78 ? 1 : 0),
    visualConfidence: Math.round(visual * 100),
    visualBreakdown: breakdown,
    reasons: [
      ...candidate.reasons,
      ...(visual >= 0.84 ? ["Artwork matched strongly"] : visual >= 0.70 ? ["Artwork is compatible"] : []),
      ...(symbol.combined >= 0.82 ? ["Set symbol region matched"] : []),
    ],
  };
}

export function calibrateCandidates(candidates: ScannerCandidate[]): ScannerCandidate[] {
  const sorted = [...candidates].sort((left, right) => right.rawScore - left.rawScore);
  return sorted.map((candidate, index) => {
    const next = sorted[index + 1];
    const margin = next ? candidate.rawScore - next.rawScore : 0.2;
    let confidence = candidate.confidence;
    if (candidate.evidenceCount >= 3 && margin >= 0.06) confidence = Math.max(confidence, 95);
    if (candidate.evidenceCount < 2) confidence = Math.min(confidence, 79);
    if (margin < 0.025) confidence = Math.min(confidence, 89);
    return { ...candidate, confidence: Math.max(1, Math.min(99, confidence)) };
  });
}
