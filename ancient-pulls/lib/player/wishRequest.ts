const PREFIX = "ancientpulls:pending-wish:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const memory = new Map<string, string>();
function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}
export function readPendingWish(userId: string): string | null {
  if (!userId) return null;
  try {
    const stored = storage()?.getItem(PREFIX + userId);
    if (stored && UUID.test(stored)) { memory.set(userId, stored); return stored; }
  } catch { /* Private browsing may deny storage; the in-memory retry still works. */ }
  return memory.get(userId) || null;
}
export function getOrCreateWishRequest(userId: string): string {
  if (!userId) throw new Error("Sign in again before making a wish.");
  const requestId = readPendingWish(userId) || crypto.randomUUID();
  memory.set(userId, requestId);
  try { storage()?.setItem(PREFIX + userId, requestId); } catch { /* Keep the memory fallback. */ }
  return requestId;
}
export function completeWishRequest(userId: string, requestId: string): void {
  if (readPendingWish(userId) !== requestId) return;
  memory.delete(userId);
  try { storage()?.removeItem(PREFIX + userId); } catch { /* No further write is needed. */ }
}
