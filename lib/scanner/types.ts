export type ScannerPokemonCard = {
  id: string | number;
  name: string;
  rarity: string | null;
  set_name: string | null;
  set_id: string | null;
  set_printed_total: number | string | null;
  card_no: string | null;
  hp: number | string | null;
  image_url: string | null;
  image_url_large: string | null;
  market_value: number | string | null;
  api_id: string | null;
  supertype: string | null;
  subtypes: string[] | null;
  set_code?: string | null;
};

export type ScannerAutoAddResult = {
  message: string;
};

export type ScannerField = "name" | "collector" | "set" | "hp";

export type OcrReading = {
  text: string;
  confidence: number;
  variant: string;
};

export type CollectorFraction = {
  numerator: string;
  denominator: number | null;
  raw: string;
  confidence: number;
};

export type FrameObservation = {
  frameId: string;
  qualityWeight: number;
  orientation: 0 | 180;
  names: string[];
  collectorNumbers: string[];
  collectorFractions: CollectorFraction[];
  setCodes: string[];
  hpValues: number[];
  reads: {
    name: OcrReading[];
    collector: OcrReading[];
    set: OcrReading[];
    hp: OcrReading[];
  };
};

export type ScannerEvidence = {
  names: Array<{ value: string; weight: number }>;
  collectorNumbers: Array<{ value: string; weight: number }>;
  collectorFractions: Array<CollectorFraction & { weight: number }>;
  setCodes: Array<{ value: string; weight: number }>;
  hpValues: Array<{ value: number; weight: number }>;
  observations: number;
};

export type VisualBreakdown = {
  artwork: number;
  fullCard: number;
  symbol: number;
  structure: number;
  edge: number;
  colour: number;
};

export type CandidateEvidence = {
  collector: number;
  set: number;
  name: number;
  visual: number;
  secondary: number;
};

export type ScannerCandidate = {
  card: ScannerPokemonCard;
  confidence: number;
  rawScore: number;
  evidence: CandidateEvidence;
  evidenceCount: number;
  exactCollector: boolean;
  exactSet: boolean;
  visualConfidence: number | null;
  visualBreakdown: VisualBreakdown | null;
  reasons: string[];
};

export type ScannerTiming = {
  captureMs: number;
  ocrMs: number;
  candidateMs: number;
  visualMs: number;
  totalMs: number;
};

export type ScannerDebugSnapshot = {
  original: string;
  canonical: string;
  regions: Record<string, string>;
  observations: FrameObservation[];
  evidence: ScannerEvidence;
  candidates: ScannerCandidate[];
  timings: ScannerTiming;
  visualIndex: {
    ready: boolean;
    indexedCount: number;
  };
};

export type ScannerIdentification = {
  candidates: ScannerCandidate[];
  evidence: ScannerEvidence;
  confidence: number;
  margin: number;
  debug: ScannerDebugSnapshot;
};

export type CandidateRequest = {
  names: string[];
  collectorNumbers: string[];
  denominators: number[];
  setCodes: string[];
  limit?: number;
};

export type CandidateResponse = {
  ok: true;
  cards: ScannerPokemonCard[];
  generatedBy: string[];
};

export type IndexedVisualMatch = {
  card: ScannerPokemonCard;
  similarity: number;
  agreement: number;
  breakdown: {
    combined: number;
    artwork: number;
    fullCard: number;
    colour: number;
    edge: number;
  };
};

export type VisualSearchResponse = {
  ok: true;
  ready: boolean;
  indexedCount: number;
  matches: IndexedVisualMatch[];
};

export type TrackedFrame = {
  id: string;
  canvas: HTMLCanvasElement;
  preview: string;
  qualityWeight: number;
  geometryConfidence: number | null;
  capturedAt: number;
};

export type ScannerMachinePhase =
  | "off"
  | "calibrating"
  | "searching"
  | "card-entering"
  | "tracking"
  | "queued"
  | "waiting-removal";

export type ScannerMode = "automatic" | "confirm";
