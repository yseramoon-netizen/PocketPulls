"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ASTRA_REQUESTS, searchAstraRequests, staffArc, staffGesture, staffPower, STAFF_MAX_ANGLE, STAFF_RELEASE_ANGLE, STAFF_PIVOT, STAFF_RADIUS, STAFF_POWER_STEPS, type AstraRequest } from '@/lib/player/astraInteraction';
import { createStaffMotion, type AstraMood } from '@/lib/player/astraMotion';
import useModalFocus from '@/lib/client/useModalFocus';
import { loadAstraAtlas } from '../astral/AstraCompanion';
import AstraPuppet from './AstraPuppet';
import { AstraRig } from '../astral/AstraRig';
import RequestIcon from './RequestIcon';
import type { AstraAudio } from './AstraAudio';
const INSTRUCTIONS = 'Tap my star to talk. Swing my staff to the right to make a wish.';
type Gesture = { id: number; x: number; y: number; travel: number; px: number; py: number; radius: number; offset: number };
export default function AstraCompanion({ balance, reduced, low, audio, onRequest, onWish, onRecharge, busy, pending, error, serverExhausted, batchPending, onBatch, maintenance, suspended = false, celebration = 0 }: {
  balance: number; reduced: boolean; low: boolean; audio: AstraAudio | null;
  onRequest: (id: AstraRequest) => void; onWish: (source: { x: number; y: number }) => void; onRecharge: () => void;
  busy: boolean; pending: boolean; error: string; serverExhausted: boolean; batchPending: boolean; onBatch: () => void; maintenance: boolean; suspended?: boolean; celebration?: number;
}) {
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(false), [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false), [exhausted, setExhausted] = useState(false), [casting, setCasting] = useState<AstraRequest | null>(null);
  const [speech, setSpeech] = useState(INSTRUCTIONS), [query, setQuery] = useState(''), [guide, setGuide] = useState<'power' | 'controls' | null>(null);
  const staff = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), portal = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null), motion = useRef(createStaffMotion()), readiness = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), actionLock = useRef(false), preventClick = useRef(false);
  const power = staffPower(balance), modal = useModalFocus<HTMLDivElement>(menu || !!guide, () => { setMenu(false); setGuide(null); });
  const disabled = busy || casting !== null, modalOpen = menu || !!guide;
  const mood: AstraMood = dragging || armed ? 'charging' : menu || casting ? 'listening' : exhausted ? 'resting' : celebration ? 'celebrating' : 'greeting';
  const preload = useCallback(() => { void loadAstraAtlas().then(image => { new AstraRig(image); }).catch(() => {}); }, []);
  useEffect(() => {
    if (low) return;
    if ('requestIdleCallback' in window) { const id = window.requestIdleCallback(preload, { timeout: 1800 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(preload, 800); return () => clearTimeout(id);
  }, [low, preload]);
  const cancel = useCallback(() => { gesture.current = null; motion.current.target = 0; motion.current.dragging = false; readiness.current = false; setDragging(false); setArmed(false); audio?.stopPull(); }, [audio]);
  useEffect(() => {
    const pendingTimers = timers.current;
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden); window.addEventListener('resize', cancel);
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel); document.removeEventListener('visibilitychange', hidden); pendingTimers.forEach(clearTimeout); audio?.stopPull(); };
  }, [audio, cancel]);
  useEffect(() => {
    const show = () => { setOpen(true); setMenu(false); setGuide(null); setSpeech(INSTRUCTIONS); };
    window.addEventListener('ancientpulls:call-astra', show);
    return () => window.removeEventListener('ancientpulls:call-astra', show);
  }, []);
  useEffect(() => { if (open) { const frame = requestAnimationFrame(() => button.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); } }, [open]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ancientpulls:astra-menu', { detail: { open: modalOpen } }));
    return () => { window.dispatchEvent(new CustomEvent('ancientpulls:astra-menu', { detail: { open: false } })); };
  }, [modalOpen]);
  const talk = () => {
    if (disabled) return;
    cancel(); setGuide(null); setQuery(''); setExhausted(false); setSpeech('What would you like to do?'); setMenu(value => !value); audio?.cue('menu');
  };
  const summon = () => {
    if (disabled) return;
    const rect = button.current?.getBoundingClientRect();
    cancel(); setMenu(false); setGuide(null);
    if (maintenance) { setSpeech('Wishes are resting during maintenance. Your cards are safe.'); return; }
    if (batchPending) { setSpeech('You have an unfinished set of wishes. Let’s recover those first.'); return; }
    if (balance < 1 && !pending) { setExhausted(true); setSpeech('I have no power left'); audio?.cue('rest'); return; }
    setExhausted(false); setSpeech('Let’s call a new star.'); audio?.cue('release');
    onWish({ x: rect ? rect.left + rect.width / 2 : window.innerWidth * .8, y: rect ? rect.top + rect.height / 2 : 180 });
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const rect = event.currentTarget.closest('.as-puppet')!.getBoundingClientRect(), scale = rect.width / 260;
    const px = rect.left + STAFF_PIVOT.x * scale, py = rect.top + STAFF_PIVOT.y * scale;
    audio?.unlock(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0, px, py, radius: STAFF_RADIUS * scale, offset: Math.atan2(event.clientX - px, py - event.clientY) * 180 / Math.PI - motion.current.angle };
    preventClick.current = false;
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    g.travel = Math.max(g.travel, Math.hypot(event.clientX - g.x, event.clientY - g.y));
    if (g.travel <= 7) return;
    if (!motion.current.dragging) { setMenu(false); setGuide(null); setExhausted(false); setDragging(true); setSpeech('Follow the arc to 45°…'); }
    const arc = staffArc(event.clientX, event.clientY, g.px, g.py, g.radius, g.offset);
    motion.current.target = arc.angle; motion.current.dragging = true; motion.current.valid = arc.valid;
    const ready = arc.valid && arc.angle >= STAFF_RELEASE_ANGLE;
    if (ready !== readiness.current) { readiness.current = ready; setArmed(ready); setSpeech(ready ? pending ? 'Release to recover your wish.' : balance ? 'Release to make one wish.' : 'Release to call a star.' : 'Follow the arc to 45°…'); }
    audio?.tension(arc.valid ? arc.angle / STAFF_MAX_ANGLE : 0);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    const arc = staffArc(event.clientX, event.clientY, g.px, g.py, g.radius, g.offset);
    const action = staffGesture(arc.angle, arc.valid, Math.max(g.travel, Math.hypot(event.clientX - g.x, event.clientY - g.y)));
    gesture.current = null; preventClick.current = true;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (action === 'pull') summon(); else { cancel(); if (action === 'tap') talk(); else setSpeech(INSTRUCTIONS); }
  };
  const request = (id: AstraRequest) => {
    if (actionLock.current || disabled) return;
    actionLock.current = true; setCasting(id); setMenu(false); setExhausted(false);
    setSpeech(ASTRA_REQUESTS.find(item => item.id === id)?.reply || 'Of course.'); audio?.cue('magic');
    timers.current.push(setTimeout(() => { setCasting(null); actionLock.current = false; onRequest(id); }, reduced ? 150 : 1000));
  };
  const accessiblePull = () => {
    if (armed) { summon(); return; }
    setArmed(true); readiness.current = true; motion.current.target = STAFF_MAX_ANGLE; audio?.tension(1); setMenu(false); setGuide(null);
    setSpeech(pending ? 'Ready to recover the same wish.' : balance ? 'Ready. One wish will be used.' : 'Shall we call a star?');
  };
  const requests = searchAstraRequests(query);
  return <div className="as-astra" data-expanded={open} data-reduced={reduced} data-dragging={dragging} style={{ '--staff-colour': power.primary, '--staff-secondary': power.secondary } as CSSProperties}>
    <button ref={portal} className="as-portal" aria-label={open ? 'Send Astra back to his star' : 'Call Astra'} aria-expanded={open} aria-controls="astra-companion" disabled={disabled} onPointerEnter={preload} onFocus={preload} onPointerDown={preload}
      onClick={() => { cancel(); setMenu(false); setGuide(null); setExhausted(false); setSpeech(INSTRUCTIONS); setOpen(!open); if (!open) audio?.cue('portal'); else portal.current?.focus(); }}>
      <span className="as-portal-orbit" /><span key={String(open)} className="as-jelly-star"><RequestIcon name="star" /></span><span className="as-portal-name">ASTRA</span>
    </button>
    {!open && <div className="as-call-hint">Your guide is a star away. <kbd>A</kbd></div>}
    {open && <div ref={modal} id="astra-companion" className="as-companion-layer" role={modalOpen ? 'dialog' : undefined} aria-modal={modalOpen || undefined} aria-label={menu ? 'Talk to Astra' : guide ? 'Astra’s guide' : undefined} tabIndex={-1}
      onKeyDown={event => { if (event.key === 'Escape' && !modalOpen && !disabled) { event.preventDefault(); cancel(); setOpen(false); portal.current?.focus(); } }}>
      <div className="as-speech" role="status" aria-live="polite"><span className="as-eyebrow">ASTRA</span><p>{menu || casting ? speech : error || speech}</p>
        {(exhausted || serverExhausted) && !modalOpen && !casting && balance === 0 && !pending && <button className="as-recharge" onClick={onRecharge}><RequestIcon name="star" />Recharge wishes</button>}
        {pending && !busy && <button className="as-text-action" onClick={summon}>Recover my wish <span>↗</span></button>}
        {batchPending && <button className="as-text-action" onClick={onBatch}>Resume unfinished wishes <span>↗</span></button>}
      </div>
      <AstraPuppet motion={motion} colour={power.primary} reduced={reduced} low={low} mood={mood} celebration={celebration} suspended={suspended} staffRef={staff}>
        <div ref={staff} className="as-staff" data-armed={armed} data-speaking={menu} data-dormant={power.dormant} data-busy={busy}>
          <div className="as-staff-glow" aria-hidden="true" />
          <button ref={button} className="as-staff-star" data-testid="astra-staff" disabled={disabled} aria-label={`Astra’s staff. ${power.count} wishes. Tap to talk, or swing clockwise to 45 degrees and release to make one wish.`} aria-expanded={menu} aria-controls="astra-requests" aria-describedby="astra-staff-instructions"
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { preventClick.current = true; cancel(); }} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
            onClick={event => { const ignore = preventClick.current && event.detail > 0; preventClick.current = false; if (!ignore) talk(); }}
            onKeyDown={event => {
              if (event.key === 'ArrowRight') { event.preventDefault(); if (!disabled && !armed && !event.repeat) accessiblePull(); }
              if ((event.key === 'Enter' || event.key === ' ') && armed) { event.preventDefault(); summon(); }
              if (event.key === 'Escape' && armed) { event.preventDefault(); event.stopPropagation(); cancel(); }
            }}><RequestIcon name="star" /></button>
          {casting && <div className="as-spell-orbit" aria-hidden="true">{[0, 1, 2, 3].map(index => <span key={index} style={{ '--orbit-start': `${index * 90}deg` } as CSSProperties}><RequestIcon name={casting} /></span>)}</div>}
        </div>
        {armed && <span className="as-release-cue" aria-hidden="true">RELEASE TO WISH</span>}
      </AstraPuppet>
      <div className="as-staff-help" id="astra-staff-instructions"><button className="as-wish-count" aria-label={`${power.count} wishes. About staff colours`} onClick={() => { cancel(); setMenu(false); setGuide('power'); }}><i />{power.count.toLocaleString('en-GB')} {power.count === 1 ? 'wish' : 'wishes'}<RequestIcon name="help" /></button><p>Tap to talk · swing 0° → 45° to wish</p>
        <button disabled={disabled} className="as-accessible-pull" onClick={accessiblePull}>{armed ? (pending ? 'Recover this wish' : 'Release staff · 1 wish') : 'Use the staff without dragging'}<span aria-hidden="true">↗</span></button>
        <button className="as-controls-link" onClick={() => { cancel(); setMenu(false); setGuide('controls'); }}>How to play</button>
        <span className="sr-only">Keyboard: Right to swing, Enter to release, Escape to cancel. The colour represents your balance, not your chances.</span>
      </div>
      {menu && <section id="astra-requests" className="as-requests" aria-label="Requests for Astra"><header><span className="as-eyebrow">A LITTLE HELP FROM THE STARS</span><button data-autofocus aria-label="Close Astra requests" onClick={() => setMenu(false)}><RequestIcon name="close" /></button><h2>What would you <br />like to do?</h2></header>
        <div className="as-request-search"><input type="search" aria-label="Find an Astra request" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ask about cards, sound, friends…" />{query && <button aria-label="Clear request search" onClick={() => setQuery('')}><RequestIcon name="close" /></button>}</div>
        <div className="as-request-list">{requests.map(item => <button key={item.id} onClick={() => request(item.id)}><RequestIcon name={item.id} /><span>{item.label}</span><span className="as-request-arrow">↗</span></button>)}</div>
        {!requests.length && <p className="as-search-empty" role="status">No requests found. Try “cards”, “sound” or “help”.</p>}
        <footer>Always here. Just a star away.</footer>
      </section>}
      {guide && <section className="as-requests as-guide-card"><header><span className="as-eyebrow">A LITTLE GUIDANCE</span><button data-autofocus aria-label="Close Astra guide" onClick={() => setGuide(null)}><RequestIcon name="close" /></button><h2>{guide === 'power' ? 'A star full of wishes.' : 'A little star magic.'}</h2></header>
        {guide === 'power' ? <><p>Your staff takes its colour from your wish balance. Colours stop changing at 250 wishes. Your balance keeps counting.</p><ul className="as-power-legend">{STAFF_POWER_STEPS.map(step => <li key={step.at}><i style={{ background: staffPower(step.at).primary }} /><span>{step.rarity}</span><b>{step.at}+</b></li>)}</ul><p>The colour is cosmetic. Every wish uses the published card odds.</p></> : <><p>Tap the star to speak with me. To summon a card, swing it clockwise along the arc from upright to 45°, then release. Each completed swing uses one wish.</p><p>Change your mind? Return the staff upright before releasing.</p><dl className="as-key-guide"><dt>A</dt><dd>Call Astra from your sky</dd><dt>/</dt><dd>Find a card in your sky</dd><dt>→ then Enter</dt><dd>Swing and release the focused staff</dd><dt>Escape</dt><dd>Cancel a swing or close a panel</dd></dl><p>You can also use the two-step button below my staff. Sound and reduced motion are in settings.</p></>}
      </section>}
    </div>}
  </div>;
}
