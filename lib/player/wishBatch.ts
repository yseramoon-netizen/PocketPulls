export type BatchAward = {
    wishId: string;
    cardId: string;
    name: string;
    rarity: string;
    imageUrl: string | null;
    setName: string;
    cardNumber: string;
    marketValue: number;
    wishBalance: number;
};
export type WishBatch = {
    version: 1;
    id: string;
    userId: string;
    keys: string[];
    results: BatchAward[];
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = (userId: string) => `pocketpulls:wish-batch-v1:${userId}`;
const inFlight = new Set<string>();
function parse(raw: string | null, userId: string): WishBatch | null {
    if (!raw)
        return null;
    try {
        const b = JSON.parse(raw) as WishBatch;
        if (b.version !== 1 || b.userId !== userId || !UUID.test(b.id) || !Array.isArray(b.keys) || b.keys.length !== 10 || !b.keys.every(k => UUID.test(k)) || new Set(b.keys).size !== 10 || !Array.isArray(b.results) || b.results.length > 10 || b.results.some(r => !r.wishId || !r.cardId || !Number.isFinite(r.wishBalance)) || new Set(b.results.map(r => r.wishId)).size !== b.results.length)
            return null;
        return b;
    }
    catch {
        return null;
    }
}
export function readWishBatch(userId: string): WishBatch | null {
    if (typeof window === 'undefined')
        return null;
    try {
        return parse(window.localStorage.getItem(key(userId)), userId);
    }
    catch {
        return null;
    }
}
function save(b: WishBatch) {
    try {
        const raw = JSON.stringify(b);
        window.localStorage.setItem(key(b.userId), raw);
        if (window.localStorage.getItem(key(b.userId)) !== raw)
            throw Error('storage verification');
    }
    catch {
        throw Error('Wish recovery could not be saved on this device. Free some browser storage and retry.');
    }
}
export function completeWishBatch(userId: string, id: string) {
    const b = readWishBatch(userId);
    if (b?.id === id && b.results.length === 10)
        window.localStorage.removeItem(key(userId));
}
export function parseBatchAward(value: unknown): BatchAward {
    const row = Array.isArray(value) ? value[0] : value;
    if (!row || typeof row !== 'object')
        throw Error('Your wish result is incomplete. Resume to recover the same request.');
    const r = row as Record<string, unknown>;
    if (!r.wish_id || !r.card_id || r.wish_balance === null || r.wish_balance === undefined || !Number.isFinite(Number(r.wish_balance)))
        throw Error('Your wish result is incomplete. Resume to recover the same request.');
    const txt = (v: unknown, fallback: string) => typeof v === 'string' && v.trim() ? v.trim() : fallback;
    return { wishId: String(r.wish_id), cardId: String(r.card_id), name: txt(r.name, 'Mystery card'), rarity: txt(r.rarity, 'Unlisted rarity'), imageUrl: txt(r.image_url, '') || null, setName: txt(r.set_name, 'Unknown set'), cardNumber: txt(r.card_no, '-'), marketValue: Number(r.market_value) || 0, wishBalance: Math.max(0, Math.floor(Number(r.wish_balance))) };
}
type Dependencies = {
    checkAccount: () => Promise<boolean>;
    claim: (requestKey: string) => Promise<BatchAward>;
    onProgress: (batch: WishBatch) => void;
};
/** Persist every idempotency key before spending. A lost response reuses the same key. */
export async function runWishBatch(userId: string, deps: Dependencies, expectedId?: string | null): Promise<WishBatch> {
    if (inFlight.has(userId))
        throw Error('These wishes are already being prepared.');
    inFlight.add(userId);
    const run = async () => {
        let b = readWishBatch(userId);
        if (expectedId && b?.id !== expectedId)
            throw Error('This batch was completed in another tab. Refresh your wishes.');
        if (!b) {
            // An unreadable recovery record must never silently become ten new charges.
            if (window.localStorage.getItem(key(userId)))
                throw Error('Your saved wishes could not be read. Keep this browser data and contact Help to recover the batch.');
            b = { version: 1, id: crypto.randomUUID(), userId, keys: Array.from({ length: 10 }, () => crypto.randomUUID()), results: [] };
            save(b);
        }
        deps.onProgress(b);
        while (b.results.length < 10) {
            if (!await deps.checkAccount())
                throw Error('Your account changed. Sign back into the original account to resume these wishes.');
            // Web Locks serialize supported browsers. Re-read the shared prefix as
            // well, so an older tab cannot overwrite another tab's newer progress.
            const before = readWishBatch(userId);
            if (!before || before.id !== b.id)
                throw Error('This batch was completed or changed in another tab. Refresh your wishes.');
            b = before;
            if (b.results.length === 10) break;
            const index = b.results.length;
            const reward = await deps.claim(b.keys[index]);
            if (!reward.wishId || !reward.cardId || !Number.isFinite(reward.wishBalance))
                throw Error('The server returned an incomplete award. Resume to recover the same request.');
            const latest = readWishBatch(userId);
            if (!latest || latest.id !== b.id)
                throw Error('This batch was completed or changed in another tab. Refresh your wishes.');
            if (latest.results.length > index) {
                if (latest.results[index].wishId !== reward.wishId)
                    throw Error('The server returned conflicting awards. Keep this browser data and contact Help.');
                b = latest;
            } else {
                if (latest.results.some(r => r.wishId === reward.wishId))
                    throw Error('The server repeated an award. Resume to recover the same request.');
                b = { ...latest, results: [...latest.results, reward] };
                save(b);
            }
            deps.onProgress(b);
        }
        if (!await deps.checkAccount())
            throw Error('Your account changed. Sign back into the original account to reveal these wishes.');
        return b;
    };
    try {
        if (typeof navigator !== 'undefined' && navigator.locks)
            return await navigator.locks.request(`pocketpulls:ten-wishes:${userId}`, run);
        return await run();
    }
    finally {
        inFlight.delete(userId);
    }
}
