"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { completeWishRequest, getOrCreateWishRequest, readPendingWish } from '@/lib/player/wishRequest';
import { parseBatchAward, readWishBatch, type BatchAward } from '@/lib/player/wishBatch';
import { getErrorMessage } from '@/lib/player/format';

type SavedAward = { requestId: string; award: BatchAward };
const key = (user: string) => `ancientpulls:staff-award:${user}`;
function savedAward(user: string): SavedAward | null {
  try { const v = JSON.parse(sessionStorage.getItem(key(user)) || 'null') as SavedAward | null;
    return v?.requestId === readPendingWish(user) && v?.award?.wishId && v?.award?.cardId && Number.isFinite(v.award.wishBalance) ? v : null;
  } catch { return null; }
}

/** Keep the same request key until the player has seen AND placed the awarded card. */
export default function useStaffWish(userId: string) {
  const [award, setAward] = useState<BatchAward | null>(null), [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [batchPending, setBatchPending] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const lock = useRef(false), request = useRef<string | null>(null), alive = useRef(true), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    const frame = requestAnimationFrame(() => { setPending(!!readPendingWish(userId)); setBatchPending(!!readWishBatch(userId)); });
    const sync = () => { setPending(!!readPendingWish(userId)); setBatchPending(!!readWishBatch(userId)); };
    window.addEventListener('pocketpulls:profile-updated', sync); window.addEventListener('storage', sync);
    return () => { alive.current = false; cancelAnimationFrame(frame); controller.current?.abort(); window.removeEventListener('pocketpulls:profile-updated', sync); window.removeEventListener('storage', sync); };
  }, [userId]);
  const summon = useCallback(async () => {
    if (lock.current || award || batchPending) return;
    lock.current = true; setBusy(true); setError(''); setExhausted(false);
    const abort = new AbortController(); controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), 20000);
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data: { session }, error: sessionError } = await Promise.race([
        supabase.auth.getSession(), new Promise<never>((_, reject) => { authTimer = setTimeout(() => reject(new Error('Your session is taking too long. Try again.')), 5000); }),
      ]);
      clearTimeout(authTimer);
      if (sessionError || !session || session.user.id !== userId) throw new Error('Your account changed. Sign in again before making a wish.');
      const recovered = savedAward(userId);
      const requestId = request.current = getOrCreateWishRequest(userId);
      setPending(true);
      let next = recovered?.award;
      if (!next) {
        const { data, error: problem } = await supabase.rpc('make_player_wish', { p_idempotency_key: requestId }).abortSignal(abort.signal);
        if (problem) throw problem;
        next = parseBatchAward(data);
        try { sessionStorage.setItem(key(userId), JSON.stringify({ requestId, award: next })); } catch { /* Retained request key recovers the same server award. */ }
      }
      if (!alive.current) return;
      setAward(next);
      window.dispatchEvent(new CustomEvent('pocketpulls:wish-balance', { detail: { wishBalance: next.wishBalance } }));
    } catch (problem) {
      if (alive.current) {
        const message = getErrorMessage(problem, 'Your wish could not be reached. Recover it to check the same request.');
        if (/not enough wishes|insufficient wishes/i.test(message) && request.current) {
          // This is a confirmed rejection before spending, not an unknown network outcome.
          completeWishRequest(userId, request.current); request.current = null; setExhausted(true); setError('I have no power left');
          window.dispatchEvent(new CustomEvent('pocketpulls:wish-balance', { detail: { wishBalance: 0 } }));
        } else setError(abort.signal.aborted ? 'The stars are taking longer than expected. Recover this wish to check the same request.' : /fetch|network/i.test(message) ? 'I lost the connection to your wish. Let’s recover the same request.' : message);
      }
    } finally {
      clearTimeout(timer); clearTimeout(authTimer); controller.current = null; lock.current = false;
      if (alive.current) { setBusy(false); setPending(!!readPendingWish(userId)); }
    }
  }, [userId, award, batchPending]);
  const place = useCallback(() => {
    if (!award || !request.current) return;
    completeWishRequest(userId, request.current);
    try { sessionStorage.removeItem(key(userId)); } catch {}
    const ids = [award.wishId]; request.current = null; setAward(null); setPending(false);
    window.dispatchEvent(new CustomEvent('ancientpulls:sky-command', { detail: { action: 'arrive', ids } }));
    window.dispatchEvent(new Event('pocketpulls:profile-updated'));
  }, [award, userId]);
  return { award, pending, busy, error, exhausted, batchPending, summon, place };
}
