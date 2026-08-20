import { calibrateCandidates, scoreCandidates } from "../lib/scanner/scoring";

const candidates = scoreCandidates([{
  id: "trumbeak-67",
  name: "Trumbeak",
  rarity: null,
  set_name: "Pitch Black",
  set_id: "BETS",
  set_code: "BETS",
  set_printed_total: 84,
  card_no: "67",
  hp: 90,
  image_url: null,
  image_url_large: null,
  market_value: null,
  api_id: null,
  supertype: "Pokémon",
  subtypes: null,
}], {
  names: [{ value: "Trumbeak", weight: 2.9 }],
  collectorNumbers: [{ value: "67", weight: 0.98 }],
  collectorFractions: [{ numerator: "67", denominator: 84, raw: "067/084", confidence: 0.22, weight: 0.35 }],
  setCodes: [{ value: "BETS", weight: 0.98 }],
  hpValues: [{ value: 90, weight: 0.99 }],
  observations: 3,
});

const best = calibrateCandidates(candidates)[0];
if (!best.exactCollector || !best.exactSet || best.confidence < 95 || best.evidenceCount < 3) {
  throw new Error(`Cross-field identity was not recovered: ${JSON.stringify(best)}`);
}

console.log(JSON.stringify(best, null, 2));
