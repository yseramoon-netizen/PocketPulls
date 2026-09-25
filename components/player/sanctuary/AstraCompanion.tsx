"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ASTRA_REQUESTS, staffGesture, staffPower, STAFF_MAX_DISTANCE, STAFF_PULL_DISTANCE, type AstraRequest } from '@/lib/player/astraInteraction';
import useModalFocus from '@/lib/client/useModalFocus';
import AstraPuppet from './AstraPuppet';
import RequestIcon from './RequestIcon';
import type { AstraAudio } from './AstraAudio';

export default function AstraCompanion({ balance, reduced, low, audio, onRequest, onWish, onRecharge, busy, pending, error, serverExhausted, batchPending, onBatch, maintenance }: {
  balance: number; reduced: boolean; low: boolean; audio: AstraAudio | null;
  onRequest: (id: AstraRequest) => void; onWish: (source: { x: number; y: number }) => void; onRecharge: () => void;
  busy: boolean; pending: boolean; error: string; serverExhausted: boolean; batchPending: boolean; onBatch: () => void; maintenance: boolean;
}) {
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(false), [pull, setPull] = useState(0);
  const [armed, setArmed] = useState(false), [exhausted, setExhausted] = useState(false), [casting, setCasting] = useState<AstraRequest | null>(null);
  const [speech, setSpeech] = useState('Tap my star to talk. Pull my staff to make a wish.');
  const staff = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), portal = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; travel: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), actionLock = useRef(false), preventClick = useRef(false);
  const power = staffPower(balance), modal = useModalFocus<HTMLDivElement>(menu, () => setMenu(false));
  const disabled = busy || casting !== null;

  const cancel = useCallback(() => { gesture.current = null; setPull(0); setArmed(false); audio?.stopPull(); }, [audio]);
  useEffect(() => {
    const pendingTimers = timers.current;
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden);
    window.addEventListener('resize', cancel);
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel); document.removeEventListener('visibilitychange', hidden); pendingTimers.forEach(clearTimeout); audio?.stopPull(); };
  }, [audio, cancel]);
  useEffect(() => {
    const show = () => { setOpen(true); setMenu(false); setSpeech('Tap my star to talk. Pull my staff to make a wish.'); };
    window.addEventListener('ancientpulls:call-astra', show);
    return () => window.removeEventListener('ancientpulls:call-astra', show);
  }, []);
  useEffect(() => { if (open) { const frame = requestAnimationFrame(() => button.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); } }, [open]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ancientpulls:astra-menu', { detail: { open: menu } }));
    return () => { window.dispatchEvent(new CustomEvent('ancientpulls:astra-menu', { detail: { open: false } })); };
  }, [menu]);

  const talk = () => {
    if (disabled) return;
    setArmed(false); setPull(0); setExhausted(false); setSpeech('What would you like to do?'); setMenu(value => !value); audio?.cue('menu');
  };
  const summon = () => {
    if (disabled) return;
    cancel(); setMenu(false);
    if (maintenance) { setSpeech('Wishes are resting during maintenance. Your cards are safe.'); return; }
    if (batchPending) { setSpeech('You have an unfinished set of wishes. Let’s recover those first.'); return; }
    if (balance < 1 && !pending) { setExhausted(true); setSpeech('I have no power left'); audio?.cue('rest'); return; }
    setExhausted(false); setSpeech('Let’s call a new star.'); audio?.cue('release');
    const rect = button.current?.getBoundingClientRect();
    onWish({ x: rect ? rect.left + rect.width / 2 : window.innerWidth * .8, y: rect ? rect.top + rect.height / 2 : 180 });
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    audio?.unlock(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 }; preventClick.current = false;
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    g.travel = Math.max(g.travel, Math.hypot(dx, dy));
    if (g.travel < 7) return;
    setMenu(false); setExhausted(false);
    const distance = Math.min(STAFF_MAX_DISTANCE, Math.max(0, dy)); setPull(distance);
    const ready = staffGesture(dx, dy, g.travel) === 'pull'; setArmed(ready);
    setSpeech(ready ? (pending ? 'Release to recover your wish.' : balance ? 'Release to make one wish.' : 'Release to call a star.') : 'A little further…');
    audio?.tension(distance / STAFF_PULL_DISTANCE);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    const action = staffGesture(dx, dy, Math.max(g.travel, Math.hypot(dx, dy)));
    gesture.current = null; preventClick.current = true;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    audio?.stopPull(); setPull(0); setArmed(false);
    if (action === 'pull') summon(); else if (action === 'tap') talk(); else setSpeech('Tap to talk. Pull down and release to wish.');
  };
  const request = (id: AstraRequest) => {
    if (actionLock.current || disabled) return;
    actionLock.current = true; setCasting(id); setMenu(false); setExhausted(false);
    setSpeech(ASTRA_REQUESTS.find(item => item.id === id)?.reply || 'Of course.'); audio?.cue('magic');
    timers.current.push(setTimeout(() => { setCasting(null); actionLock.current = false; onRequest(id); }, reduced ? 150 : 1000));
  };
  const accessiblePull = () => {
    if (armed) { summon(); return; }
    setArmed(true); setPull(STAFF_PULL_DISTANCE); audio?.tension(1); setMenu(false);
    setSpeech(pending ? 'Ready to recover the same wish.' : balance ? 'Ready. One wish will be used.' : 'Shall we call a star?');
  };
  return <div className="as-astra" data-expanded={open} data-reduced={reduced} style={{ '--staff-colour': power.primary, '--staff-secondary': power.secondary } as CSSProperties}>
    <button ref={portal} className="as-portal" aria-label={open ? 'Send Astra back to his star' : 'Call Astra'} aria-expanded={open} aria-controls="astra-companion" disabled={disabled}
      onClick={() => { cancel(); setMenu(false); setExhausted(false); setOpen(!open); if (!open) audio?.cue('portal'); else portal.current?.focus(); }}>
      <span className="as-portal-orbit" /><span key={String(open)} className="as-jelly-star"><RequestIcon name="star" /></span><span className="as-portal-name">ASTRA</span>
    </button>
    {!open && <div className="as-call-hint">Your guide is a star away.</div>}
    {open && <div ref={modal} id="astra-companion" className="as-companion-layer" role={menu ? 'dialog' : undefined} aria-modal={menu || undefined} aria-label={menu ? 'Talk to Astra' : undefined} tabIndex={-1}
      onKeyDown={event => { if (event.key === 'Escape' && !menu && !disabled) { event.preventDefault(); cancel(); setOpen(false); portal.current?.focus(); } }}>
      <div className="as-speech" role="status" aria-live="polite"><span className="as-eyebrow">ASTRA</span><p>{menu || casting ? speech : error || speech}</p>
        {(exhausted || serverExhausted) && !menu && !casting && balance === 0 && !pending && <button className="as-recharge" onClick={onRecharge}><RequestIcon name="star" />Recharge wishes</button>}
        {pending && !busy && <button className="as-text-action" onClick={summon}>Recover my wish <span>↗</span></button>}
        {batchPending && <button className="as-text-action" onClick={onBatch}>Resume unfinished wishes <span>↗</span></button>}
      </div>
      <AstraPuppet pull={pull} colour={power.primary} reduced={reduced} low={low} casting={!!casting} staffRef={staff}>
        <div ref={staff} className="as-staff" data-armed={armed} data-speaking={menu} data-dormant={power.dormant} data-busy={busy}>
          <div className="as-staff-glow" aria-hidden="true" />
          <button ref={button} className="as-staff-star" data-testid="astra-staff" disabled={disabled} aria-label={`Astra’s staff. ${power.count} wishes. Tap to talk, or pull down to make one wish.`} aria-expanded={menu} aria-controls="astra-requests" aria-describedby="astra-staff-instructions"
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { preventClick.current = true; cancel(); }} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
            onClick={event => { const ignore = preventClick.current && event.detail > 0; preventClick.current = false; if (!ignore) talk(); }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault(); if (!disabled && !armed && !event.repeat) accessiblePull(); }
              if ((event.key === 'Enter' || event.key === ' ') && armed) { event.preventDefault(); summon(); }
              if (event.key === 'Escape' && armed) { event.preventDefault(); event.stopPropagation(); cancel(); }
            }}><RequestIcon name="star" /></button>
          {casting && <div className="as-spell-orbit" aria-hidden="true">{[0, 1, 2, 3].map(index => <span key={index} style={{ '--orbit-start': `${index * 90}deg` } as CSSProperties}><RequestIcon name={casting} /></span>)}</div>}
          {pull > 8 && <div className="as-pull-meter" aria-hidden="true"><i style={{ transform: `scaleY(${Math.min(1, pull / STAFF_PULL_DISTANCE)})` }} /><span>{armed ? 'RELEASE' : 'PULL'}</span></div>}
        </div>
      </AstraPuppet>
      <div className="as-staff-help" id="astra-staff-instructions"><span className="as-wish-count"><i />{power.count.toLocaleString('en-GB')} {power.count === 1 ? 'wish' : 'wishes'}</span><p>Tap to talk · pull down to wish</p>
        <button disabled={disabled} className="as-accessible-pull" onClick={accessiblePull}>{armed ? (pending ? 'Recover this wish' : 'Release staff · 1 wish') : 'Use the staff without dragging'}<RequestIcon name="down" /></button>
        <span className="sr-only">Keyboard: Down to pull, Enter to release, Escape to cancel. The colour represents your balance, not your chances.</span>
      </div>
      {menu && <section id="astra-requests" className="as-requests" aria-label="Requests for Astra"><header><span className="as-eyebrow">A LITTLE HELP FROM THE STARS</span><button data-autofocus aria-label="Close Astra requests" onClick={() => setMenu(false)}><RequestIcon name="close" /></button><h2>What would you<br />like to do?</h2></header>
        <div className="as-request-list">{ASTRA_REQUESTS.map(item => <button key={item.id} onClick={() => request(item.id)}><RequestIcon name={item.id} /><span>{item.label}</span><span className="as-request-arrow">↗</span></button>)}</div>
        <footer>Always here. Just a star away.</footer>
      </section>}
    </div>}
  </div>;
}
