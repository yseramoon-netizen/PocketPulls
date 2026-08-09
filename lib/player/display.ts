const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["\u00e2\u0153\u00a6", "✦"],
  ["\u00e2\u0153\u00aa", "✪"],
  ["\u00e2\u0153\u00a7", "✧"],
  ["\u00e2\u20ac\u201d", "—"],
  ["\u00e2\u20ac\u201c", "–"],
  ["\u00e2\u20ac\u2122", "’"],
  ["\u00e2\u20ac\u0153", "“"],
  ["\u00e2\u20ac\u009d", "”"],
  ["\u00e2\u20ac\u00a6", "…"],
  ["\u00c2\u00a3", "£"],
  ["\u00c3\u00a9", "é"],
] as const;

export function repairMojibakeText(value: string): string {
  return MOJIBAKE_REPLACEMENTS.reduce(
    (result, [broken, replacement]) => result.split(broken).join(replacement),
    value,
  );
}

export function normaliseDisplayGlyph(
  value: unknown,
  fallback = "✦",
): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const repaired = repairMojibakeText(value).trim();
  return repaired.length <= 4 ? repaired : fallback;
}

export function modernisePlayerCopy(value: string): string {
  return repairMojibakeText(value)
    .replace(/Jirachi's Chosen/gi, "Nebu's Chosen")
    .replace(/Living Pok(?:e|é)dex Energy/gi, "Living Archive")
    .replace(/\bJirachi\b/gi, "Nebu")
    .replace(/\bPok(?:e|é)mon Trainer\b/gi, "Star Trainer");
}
