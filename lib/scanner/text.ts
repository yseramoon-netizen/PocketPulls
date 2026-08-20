import type { CollectorFraction } from "./types";

const NAME_SUFFIXES = new Set([
  "ex",
  "gx",
  "v",
  "vmax",
  "vstar",
  "break",
  "lvx",
]);

const OCR_DIGIT_CORRECTIONS: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
};

export function normaliseText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-zA-Z0-9']/g, "")
    .toLowerCase();
}

export function normaliseName(value: string): string {
  return normaliseText(value)
    .replace(/pokemon/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normaliseCollector(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+(?=\d)/, "");
}

export function normaliseSetCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function levenshteinDistance(first: string, second: string): number {
  if (first === second) return 0;
  if (!first.length) return second.length;
  if (!second.length) return first.length;
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  const current = new Array<number>(second.length + 1);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    current[0] = firstIndex;
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const cost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + cost,
      );
    }
    for (let index = 0; index < previous.length; index += 1) previous[index] = current[index];
  }
  return previous[second.length];
}

export function jaroWinkler(firstValue: string, secondValue: string): number {
  const first = normaliseText(firstValue);
  const second = normaliseText(secondValue);
  if (first === second) return first ? 1 : 0;
  if (!first || !second) return 0;
  const range = Math.max(0, Math.floor(Math.max(first.length, second.length) / 2) - 1);
  const firstMatched = new Array(first.length).fill(false);
  const secondMatched = new Array(second.length).fill(false);
  let matches = 0;
  for (let index = 0; index < first.length; index += 1) {
    const from = Math.max(0, index - range);
    const to = Math.min(second.length - 1, index + range);
    for (let candidate = from; candidate <= to; candidate += 1) {
      if (secondMatched[candidate] || first[index] !== second[candidate]) continue;
      firstMatched[index] = true;
      secondMatched[candidate] = true;
      matches += 1;
      break;
    }
  }
  if (!matches) return 0;
  const firstChars = first.split("").filter((_, index) => firstMatched[index]);
  const secondChars = second.split("").filter((_, index) => secondMatched[index]);
  let transpositions = 0;
  for (let index = 0; index < firstChars.length; index += 1) {
    if (firstChars[index] !== secondChars[index]) transpositions += 1;
  }
  const jaro = (
    matches / first.length +
    matches / second.length +
    (matches - transpositions / 2) / matches
  ) / 3;
  let prefix = 0;
  while (prefix < 4 && first[prefix] === second[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function bigramSimilarity(firstValue: string, secondValue: string): number {
  const first = normaliseName(firstValue);
  const second = normaliseName(secondValue);
  if (first === second) return first ? 1 : 0;
  if (first.length < 2 || second.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let index = 0; index < first.length - 1; index += 1) {
    const pair = first.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < second.length - 1; index += 1) {
    const pair = second.slice(index, index + 2);
    const count = counts.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(pair, count - 1);
    }
  }
  return (2 * overlap) / (first.length + second.length - 2);
}

export function nameSimilarity(firstValue: string, secondValue: string): number {
  const first = normaliseName(firstValue);
  const second = normaliseName(secondValue);
  if (!first || !second) return 0;
  if (first === second) return 1;
  const distance = levenshteinDistance(first, second);
  const edit = Math.max(0, 1 - distance / Math.max(first.length, second.length));
  const jaro = jaroWinkler(first, second);
  const bigram = bigramSimilarity(first, second);
  const contains = first.includes(second) || second.includes(first)
    ? Math.min(first.length, second.length) / Math.max(first.length, second.length)
    : 0;
  return Math.max(edit * 0.45 + jaro * 0.40 + bigram * 0.15, contains * 0.92);
}

export function setCodeSimilarity(first: string, second: string): number {
  const left = normaliseSetCode(first);
  const right = normaliseSetCode(second);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length !== right.length && Math.abs(left.length - right.length) > 1) return 0;
  return Math.max(
    1 - levenshteinDistance(left, right) / Math.max(left.length, right.length),
    jaroWinkler(left, right),
  );
}

function correctDigitToken(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .map((character) => /\d/.test(character) ? character : OCR_DIGIT_CORRECTIONS[character] || "")
    .join("");
}

export function extractCollectorFractions(text: string, confidence = 0.5): CollectorFraction[] {
  const cleaned = text
    .toUpperCase()
    .replace(/[|\\]/g, "/")
    .replace(/[—–_]/g, "-");
  const found = new Map<string, CollectorFraction>();
  const patterns = [
    /([0-9OQILZSBGD]{1,4})\s*[/\-]\s*([0-9OQILZSBGD]{2,4})/g,
    /([A-Z]{0,4}[0-9OQILZSBGD]{1,4})\s+([0-9OQILZSBGD]{2,4})/g,
  ];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const numeratorDigits = correctDigitToken(match[1]);
      const denominatorDigits = correctDigitToken(match[2]);
      const numerator = normaliseCollector(numeratorDigits);
      const denominator = Number(denominatorDigits);
      if (!numerator || !Number.isFinite(denominator) || denominator < 10 || denominator > 9999) continue;
      const numericNumerator = Number(numerator);
      if (Number.isFinite(numericNumerator) && numericNumerator > denominator + 500) continue;
      const key = `${numerator}/${denominator}`;
      found.set(key, {
        numerator,
        denominator,
        raw: match[0],
        confidence: Math.max(0, Math.min(1, confidence)),
      });
    }
  }
  return [...found.values()];
}

export function extractCollectorNumbers(text: string): string[] {
  const fractions = extractCollectorFractions(text);
  const found = new Set(fractions.map((fraction) => fraction.numerator));
  const cleaned = text.toUpperCase();
  for (const match of cleaned.matchAll(/(?:NO\.?\s*)?([A-Z]{0,4}[0-9OQILZSBGD]{1,4})/g)) {
    const prefix = match[1].match(/^[A-Z]+/)?.[0] || "";
    const digits = correctDigitToken(match[1].slice(prefix.length));
    if (!digits) continue;
    const value = normaliseCollector(`${prefix}${digits}`);
    if (value && value.length <= 8) found.add(value);
  }
  return [...found];
}

export function extractSetCodes(text: string): string[] {
  const found = new Set<string>();
  const upper = text.toUpperCase();
  for (const match of upper.matchAll(/\b[A-Z0-9]{2,5}\b/g)) {
    const value = normaliseSetCode(match[0]);
    if (/^\d+$/.test(value) || value === "BASIC" || value === "TRAINER") continue;
    if (value.length >= 2) found.add(value);
  }
  return [...found];
}

export function extractHpValues(text: string): number[] {
  const values = new Set<number>();
  const upper = text.toUpperCase();
  for (const match of upper.matchAll(/(?:HP\s*)?([0-9OQILZSBGD]{2,3})\s*(?:HP)?/g)) {
    const value = Number(correctDigitToken(match[1]));
    if (Number.isFinite(value) && value >= 20 && value <= 400 && value % 10 === 0) values.add(value);
  }
  return [...values];
}

export function extractNameCandidates(text: string): string[] {
  const candidates = new Set<string>();
  for (const rawLine of text.split(/[\r\n]+/)) {
    const line = rawLine
      .replace(/[^A-Za-z0-9À-ÿ'’ .:-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!line || line.length < 2 || line.length > 42) continue;
    const words = line.split(" ").filter(Boolean);
    if (!words.some((word) => /[A-Za-zÀ-ÿ]/.test(word))) continue;
    if (/^(basic|stage|trainer|item|supporter|stadium|energy|ability|hp)\b/i.test(line)) continue;
    candidates.add(line);
    if (words.length > 1 && NAME_SUFFIXES.has(words.at(-1)?.toLowerCase() || "")) {
      candidates.add(words.slice(-3).join(" "));
    }
  }
  return [...candidates].slice(0, 12);
}

export function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}
