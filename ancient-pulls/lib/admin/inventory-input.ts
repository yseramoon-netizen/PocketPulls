export function readInventoryQuantity(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  if (typeof value === "string" && !value.trim()) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 9999 ? parsed : 0;
}
