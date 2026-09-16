"use client";
/* eslint-disable @next/next/no-img-element -- Awarded artwork is preloaded. */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import useModalFocus from '@/lib/client/useModalFocus';
import { publishPlayerPreferences } from '@/lib/player/preferences';
import { getWishRevealConfig } from '@/lib/player/wish-reveal';
import type { WishCinematicProps, WishRevealCard } from '../WishCinematic';
import usePlayerPreferences from '../usePlayerPreferences';
import { primeWishAudio, startAstralWishAudio, type WishAudioSession } from '../wishAudio';
import { FlightRenderer, loadAstraRig } from './FlightRenderer';
import { flightDuration, FLIGHT_TIMING, type ArrivalTarget } from './flight';
import { AdaptiveResolution, CeremonyClock, type AstralOptions } from './timeline';
import styles from './AstralWish.module.css';
const subscribe = () => () => {
};
function initialMute() {
    try {
        return window.localStorage.getItem('pocketpulls-wish-muted') === 'true';
    }
    catch {
        return true;
    }
}
type Stage = 'loading' | 'playing' | 'ready' | 'placing';
export default function FlightCeremony(props: WishCinematicProps) {
    const rewards = useMemo(() => props.cards?.length ? props.cards : props.card ? [props.card] : [], [props.cards, props.card]);
    if (!props.open || !rewards.length)
        return null;
    return <Ceremony key={rewards.map(c => String(c.id ?? c.name)).join(':')} {...props} rewards={rewards}/>;
}
function Ceremony({ rewards, onClose, onFinished, onPlace, busy = false, actionError, allowSkip = true, forceFullSequence = false, respectPreferences = true, cosmicIssueNumber, cosmicBinderIssueNumber }: WishCinematicProps & {
    rewards: readonly WishRevealCard[];
}) {
    const mounted = useSyncExternalStore(subscribe, () => true, () => false), preferences = usePlayerPreferences();
    const [stage, setStage] = useState<Stage>('loading'), [muted, setMuted] = useState(initialMute), [paused, setPaused] = useState(false), [still, setStill] = useState(false), [canSkip, setCanSkip] = useState(false), [caption, setCaption] = useState('');
    const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<FlightRenderer | null>(null), clock = useRef(new CeremonyClock()), audio = useRef<WishAudioSession | null>(null), frame = useRef(0);
    const phase = useRef<Stage>('loading'), finished = useRef(false), manualPause = useRef(false), tickRef = useRef<(now: number) => void>(() => {
    }), audioRef = useRef(() => {
    }), muteRef = useRef(muted), prefs = useRef(preferences), placementSent = useRef(false), closeCallback = useRef(onClose);
    const configs = useMemo(() => rewards.map(c => getWishRevealConfig(c.rarity, c.marketValue)), [rewards]);
    const options = useMemo<AstralOptions[]>(() => configs.map(c => ({ tier: c.tier, blackHole: c.blackHole, primary: c.primary, secondary: c.secondary })), [configs]);
    const strongest = useMemo(() => configs.reduce((a, b) => b.tier > a.tier || b.blackHole ? b : a, configs[0]), [configs]);
    const reduced = respectPreferences && preferences.reducedMotion, skip = useRef(respectPreferences && !forceFullSequence && preferences.skipPullCinematic && preferences.cinematicSeen).current;
    const announceReady = useEffectEvent(() => {
        phase.current = 'ready';
        setStage('ready');
        setCaption('');
        setCanSkip(false);
        audio.current?.stop();
        if (finished.current)
            return;
        finished.current = true;
        if (respectPreferences && !preferences.cinematicSeen)
            publishPlayerPreferences({ ...preferences, cinematicSeen: true });
        onFinished?.();
    });
    useEffect(() => {
        closeCallback.current = onClose;
    }, [onClose]);
    const close = useCallback(() => {
        window.dispatchEvent(new Event('pocketpulls:wish-cinematic-continued'));
        closeCallback.current();
    }, []);
    const place = useCallback(() => {
        if (phase.current !== 'ready' || busy || placementSent.current)
            return;
        placementSent.current = true;
        audio.current?.stop();
        if (onPlace) {
            onPlace(rewards);
            return;
        }
        if (reduced || !renderer.current) {
            close();
            return;
        }
        phase.current = 'placing';
        setStage('placing');
        setCanSkip(true);
        setCaption('A place among your stars.');
        clock.current.seek(0);
        clock.current.setPaused(false);
        manualPause.current = false;
        setPaused(false);
        frame.current = requestAnimationFrame(tickRef.current);
    }, [busy, onPlace, rewards, reduced, close]);
    const revealNow = useCallback(() => {
        if (phase.current === 'placing') {
            close();
            return;
        }
        clock.current.seek(flightDuration(rewards.length));
        clock.current.setPaused(false);
        manualPause.current = false;
        setPaused(false);
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(tickRef.current);
    }, [rewards.length, close]);
    const modal = useModalFocus<HTMLDivElement>(mounted, () => {
        if (phase.current === 'ready')
            place();
        else if (allowSkip)
            revealNow();
    });
    useEffect(() => {
        prefs.current = preferences;
        audio.current?.setVolume(preferences.sfxVolume);
    }, [preferences]);
    useEffect(() => {
        muteRef.current = muted;
        audio.current?.setMuted(muted);
    }, [muted]);
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('pocketpulls:wish-cinematic-visibility', { detail: { open: true } }));
        return () => {
            window.dispatchEvent(new CustomEvent('pocketpulls:wish-cinematic-visibility', { detail: { open: false } }));
        };
    }, []);
    useEffect(() => {
        if (!mounted || !canvas.current)
            return;
        let disposed = false, previous: number | null = null, observer: ResizeObserver | null = null, lastCaption = '', unlocked = false;
        const adaptive = new AdaptiveResolution(prefs.current.lowVisualEffects || prefs.current.dataSaver);
        const playAudio = () => {
            audio.current?.stop();
            audio.current = startAstralWishAudio({ ...options[0], flightV72: true, count: rewards.length }, muteRef.current, prefs.current.sfxVolume, clock.current.time);
        };
        audioRef.current = playAudio;
        const demoTargets: ArrivalTarget[] = options.map((o, i) => ({ id: String(i), colour: o.primary, x: options.length === 1 ? .64 : .22 + ((i * 37) % 63) / 100, y: options.length === 1 ? .41 : .28 + ((i * 29) % 41) / 100 }));
        const tick = (now: number) => {
            if (disposed || document.hidden || manualPause.current)
                return;
            const ms = clock.current.tick(now);
            if (phase.current === 'placing') {
                const s = renderer.current?.renderArrival(ms, demoTargets);
                if (s?.done || ms >= FLIGHT_TIMING.arrival) {
                    close();
                    return;
                }
            }
            else {
                const s = renderer.current?.render(ms, options);
                if (s && s.caption !== lastCaption) {
                    lastCaption = s.caption;
                    setCaption(lastCaption);
                }
                if (ms >= 800 && !unlocked) {
                    unlocked = true;
                    setCanSkip(true);
                }
                if (ms >= flightDuration(rewards.length) || (reduced && ms >= 650) || skip) {
                    announceReady();
                    return;
                }
            }
            if (previous !== null && adaptive.observe(now - previous))
                renderer.current?.resize(adaptive.scale);
            previous = now;
            frame.current = requestAnimationFrame(tick);
        };
        tickRef.current = tick;
        const visibility = () => {
            cancelAnimationFrame(frame.current);
            previous = null;
            clock.current.setPaused(document.hidden || manualPause.current);
            audio.current?.stop();
            if (!document.hidden && !manualPause.current && phase.current !== 'ready') {
                if (phase.current === 'playing' && !reduced)
                    playAudio();
                frame.current = requestAnimationFrame(tick);
            }
        };
        document.addEventListener('visibilitychange', visibility);
        void (async () => {
            const image = reduced || skip ? null : await loadAstraRig();
            if (disposed)
                return;
            if (image && canvas.current) {
                try {
                    renderer.current = new FlightRenderer(canvas.current, image, prefs.current.lowVisualEffects || prefs.current.dataSaver);
                    renderer.current.resize(adaptive.scale);
                    observer = new ResizeObserver(() => renderer.current?.resize(adaptive.scale));
                    observer.observe(canvas.current);
                }
                catch {
                    setStill(true);
                }
            }
            else
                setStill(true);
            phase.current = 'playing';
            setStage('playing');
            clock.current.setPaused(document.hidden || manualPause.current);
            if ((!renderer.current && !reduced) || skip || finished.current)
                clock.current.seek(flightDuration(rewards.length));
            if (image && !document.hidden)
                playAudio();
            frame.current = requestAnimationFrame(tick);
        })();
        return () => {
            disposed = true;
            cancelAnimationFrame(frame.current);
            observer?.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            audio.current?.stop();
            renderer.current?.dispose();
            renderer.current = null;
        };
    }, [mounted, options, rewards.length, reduced, skip, close]);
    useEffect(() => {
        for (const c of rewards)
            if (c.imageUrl) {
                const img = new Image();
                img.src = c.imageUrl;
            }
    }, [rewards]);
    useEffect(() => {
        if (stage === 'ready')
            modal.current?.querySelector<HTMLButtonElement>('[data-continue]')?.focus({ preventScroll: true });
    }, [stage, modal]);
    const togglePause = () => {
        manualPause.current = !manualPause.current;
        setPaused(manualPause.current);
        clock.current.setPaused(manualPause.current || document.hidden);
        cancelAnimationFrame(frame.current);
        audio.current?.stop();
        if (!manualPause.current) {
            if (phase.current === 'playing')
                audioRef.current();
            frame.current = requestAnimationFrame(tickRef.current);
        }
    };
    const toggleSound = async () => {
        const next = !muted;
        setMuted(next);
        muteRef.current = next;
        try {
            localStorage.setItem('pocketpulls-wish-muted', String(next));
        }
        catch {
        }
        await primeWishAudio();
        if (!next && !manualPause.current && phase.current === 'playing')
            audioRef.current();
    };
    if (!mounted)
        return null;
    const ready = stage === 'ready', batch = rewards.length > 1, issue = cosmicBinderIssueNumber ?? cosmicIssueNumber;
    return createPortal(<div ref={modal} className={`${styles.ceremony} ${still ? styles.still : ''}`} style={{ '--rarity': strongest.primary, '--rarity-secondary': strongest.secondary, '--reveal': ready ? 1 : 0, '--card-y': '0px', '--card-rotate': '0deg', '--card-scale': 1 } as CSSProperties} role="dialog" aria-modal="true" aria-label={ready ? `${rewards.length} wish${batch ? 'es' : ''} revealed` : 'Astra wish ceremony'} tabIndex={-1} data-stage={stage} data-paused={paused}>
 <canvas ref={canvas} className={styles.canvas} aria-hidden="true"/><div className={styles.vignette}/>
 <header className={styles.topbar}><span className={styles.brand}><span className={styles.brandMark}>✧</span> ANCIENT PULLS</span><div className={styles.controls}>{!ready && stage !== 'loading' && !reduced && <button className={styles.iconButton} aria-label={paused ? 'Resume animation' : 'Pause animation'} onClick={togglePause}>{paused ? '▷' : 'Ⅱ'}</button>}<button className={styles.iconButton} aria-label={muted ? 'Turn sound on' : 'Mute sound'} aria-pressed={!muted} onClick={() => void toggleSound()}><SoundIcon muted={muted}/></button>{!ready && allowSkip && <button className={styles.skip} disabled={!canSkip} onClick={revealNow}>{stage === 'placing' ? 'Finish' : 'Reveal'} ↗</button>}</div></header>
 {stage === 'loading' && <div className={styles.loading} role="status"><span className={styles.loadingStar}>✧</span><span>Gathering starlight</span></div>}{caption && !ready && !paused && <p className={styles.flightCaption}>{caption}</p>}{paused && <p className={styles.pauseNotice}>Your stars can wait.</p>}
 <p className={styles.srOnly} role="status" aria-live="polite">{ready ? `${rewards.map((c, i) => `${c.name}, ${configs[i].label}`).join('. ')}. Continue to place your stars.` : paused ? 'Animation paused.' : stage === 'placing' ? 'Astra is placing your stars.' : 'Astra is following your wishes.'}</p>
 {ready && (batch ? <div className={styles.batchResult}><div className={styles.batchHeading}><p className={styles.eyebrow}>YOUR WISHES</p><h1 className={styles.cardName}>{rewards.length} new lights.</h1><p className={styles.metadata}>Every star has a place in your sky.</p></div><div className={styles.batchGrid}>{rewards.map((c, i) => <div key={String(c.id ?? i)} className={styles.batchItem} style={{ '--rarity': configs[i].primary } as CSSProperties}><CardArtwork card={c}/><span className={styles.batchRarity}>{configs[i].label}</span><strong>{c.name}</strong></div>)}</div><div className={styles.batchActions}><button data-continue className={styles.primary} onClick={place} disabled={busy}>Continue to constellation <span>→</span></button>{actionError && <p className={styles.error} role="alert">{actionError}</p>}</div></div> : <div className={styles.result}><div className={styles.cardStage}><div className={styles.cardHalo}/><div className={styles.cardOrbit}/><CardArtwork card={rewards[0]}/></div><div className={styles.details}><p className={styles.eyebrow}>✦ {configs[0].label} ✦</p><h1 className={styles.cardName}>{rewards[0].name}</h1><p className={styles.metadata}>{[rewards[0].setName, rewards[0].cardNumber ? `No. ${rewards[0].cardNumber}` : null].filter(Boolean).join(' · ') || 'A new light in your constellation'}</p>{issue != null && <p className={styles.discovery}>Astral discovery · #{issue.toLocaleString('en-GB')}</p>}<div className={styles.actions}><button data-continue className={styles.primary} onClick={place} disabled={busy}>Continue to constellation <span>→</span></button></div>{actionError && <p className={styles.error} role="alert">{actionError}</p>}</div></div>)}
 {!ready && <footer className={styles.footer}><span>ASTRA · THE STARKEEPER</span><span>FOLLOW YOUR STAR</span></footer>}</div>, document.body);
}
function CardArtwork({ card }: {
    card: WishRevealCard;
}) {
    const [failed, setFailed] = useState(false);
    return <div className={styles.card}>{card.imageUrl && !failed ? <img src={card.imageUrl} alt={card.name} onError={() => setFailed(true)} draggable={false} className={styles.cardImage}/> : <div className={styles.cardPlaceholder}><span>✦</span><span>{card.name}</span><small>Artwork unavailable</small></div>}<div className={styles.cardSheen}/></div>;
}
function SoundIcon({ muted }: {
    muted: boolean;
}) {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>{muted ? <path d="m16 9 5 6m0-6-5 6"/> : <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>}</svg>;
}
