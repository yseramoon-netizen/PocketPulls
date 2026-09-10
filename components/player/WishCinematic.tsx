"use client";
/* eslint-disable @next/next/no-img-element -- Awarded card art is preloaded and revealed on the ceremony clock. */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import useModalFocus from "@/lib/client/useModalFocus";
import { publishPlayerPreferences } from "@/lib/player/preferences";
import { getWishRevealConfig, type WishRevealConfig } from "@/lib/player/wish-reveal";
import usePlayerPreferences from "./usePlayerPreferences";
import { primeWishAudio, startAstralWishAudio, type WishAudioSession } from "./wishAudio";
import { AstralRenderer, loadAstralArtwork } from "./astral/renderer";
import { AdaptiveResolution, CeremonyClock, ceremonyDuration, sampleAstral, type AstralOptions } from "./astral/timeline";
import styles from "./astral/AstralWish.module.css";
export type WishRevealCard = {
    id?: string | number;
    name: string;
    rarity?: string | null;
    imageUrl?: string | null;
    setName?: string | null;
    cardNumber?: string | null;
    marketValue?: number | null;
};
export type WishCinematicProps = {
    open: boolean;
    card: WishRevealCard | null;
    onClose: () => void;
    onFinished?: () => void;
    onWishAgain?: () => void;
    canWishAgain?: boolean;
    busy?: boolean;
    actionError?: string | null;
    allowSkip?: boolean;
    forceFullSequence?: boolean;
    respectPreferences?: boolean;
    cosmicIssueNumber?: number | null;
    cosmicBinderIssueNumber?: number | null;
    /** Accepted for older callers; character skins no longer control this animation. */
    cosmicSourceSkin?: string | null;
};
export function getWishRarityTheme(rarity: string | null | undefined): WishRevealConfig { return getWishRevealConfig(rarity); }
const subscribeToClient = () => () => { };
const clientSnapshot = () => true;
const serverSnapshot = () => false;
function readMuted() { try {
    return typeof window === "undefined" || window.localStorage.getItem("pocketpulls-wish-muted") === "true";
}
catch {
    return true;
} }
export default function WishCinematic(props: WishCinematicProps) {
    if (!props.open || !props.card)
        return null;
    return <AstralCeremony key={String(props.card.id ?? `${props.card.name}:${props.card.rarity}`)} {...props} card={props.card}/>;
}
function AstralCeremony({ card, onClose, onFinished, onWishAgain, canWishAgain = false, busy = false, actionError, allowSkip = true, forceFullSequence = false, respectPreferences = true, cosmicIssueNumber, cosmicBinderIssueNumber, }: WishCinematicProps & {
    card: WishRevealCard;
}) {
    const preferences = usePlayerPreferences();
    const mounted = useSyncExternalStore(subscribeToClient, clientSnapshot, serverSnapshot);
    const [stage, setStage] = useState<"loading" | "playing" | "revealing" | "complete">("loading");
    const [muted, setMuted] = useState(readMuted);
    const [paused, setPaused] = useState(false);
    const [fallback, setFallback] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const [canSkip, setCanSkip] = useState(false);
    const canvas = useRef<HTMLCanvasElement>(null);
    const scene = useRef<AstralRenderer | null>(null);
    const clock = useRef(new CeremonyClock());
    const audio = useRef<WishAudioSession | null>(null);
    const frameId = useRef(0);
    const completed = useRef(false);
    const revealStarted = useRef(false);
    const manuallyPaused = useRef(false);
    const skipUnlocked = useRef(false);
    const startAudio = useRef<() => void>(() => { });
    const prefs = useRef(preferences);
    const muteRef = useRef(muted);
    const config = useMemo(() => getWishRevealConfig(card.rarity, card.marketValue), [card.rarity, card.marketValue]);
    const options = useMemo<AstralOptions>(() => ({ tier: config.tier, blackHole: !!config.blackHole, primary: config.primary, secondary: config.secondary }), [config]);
    const reduced = respectPreferences && preferences.reducedMotion;
    const shouldSkip = respectPreferences && !forceFullSequence && preferences.skipPullCinematic && preferences.cinematicSeen;
    const finishEvent = useEffectEvent(() => {
        if (completed.current)
            return;
        completed.current = true;
        setStage("complete");
        setCanSkip(false);
        if (respectPreferences && !preferences.cinematicSeen)
            publishPlayerPreferences({ ...preferences, cinematicSeen: true });
        onFinished?.();
    });
    const exitEvent = useCallback(() => {
        window.dispatchEvent(new Event("pocketpulls:wish-cinematic-continued"));
        onClose();
    }, [onClose]);
    const revealNow = useCallback(() => {
        clock.current.seek(ceremonyDuration(options.blackHole));
        audio.current?.stop();
        audio.current = null;
        manuallyPaused.current = false;
        clock.current.setPaused(false);
        setPaused(false);
    }, [options.blackHole]);
    const modal = useModalFocus<HTMLDivElement>(mounted, () => {
        if (completed.current)
            exitEvent();
        else if (allowSkip)
            revealNow();
    });
    useEffect(() => {
        window.dispatchEvent(new CustomEvent("pocketpulls:wish-cinematic-visibility", { detail: { open: true } }));
        return () => { window.dispatchEvent(new CustomEvent("pocketpulls:wish-cinematic-visibility", { detail: { open: false } })); };
    }, []);
    useEffect(() => { prefs.current = preferences; audio.current?.setVolume(preferences.sfxVolume); }, [preferences]);
    useEffect(() => { muteRef.current = muted; audio.current?.setMuted(muted); }, [muted]);
    useEffect(() => {
        if (!mounted || !canvas.current || !modal.current || completed.current)
            return;
        let cancelled = false, observer: ResizeObserver | null = null, previous: number | null = null;
        const adaptive = new AdaptiveResolution(prefs.current.lowVisualEffects || prefs.current.dataSaver);
        const element = modal.current;
        const beginSound = () => {
            audio.current?.stop();
            audio.current = startAstralWishAudio(options, muteRef.current, prefs.current.sfxVolume, clock.current.time);
        };
        startAudio.current = beginSound;
        const onVisibility = () => {
            const suspend = document.hidden || manuallyPaused.current;
            clock.current.setPaused(suspend);
            previous = null;
            audio.current?.stop();
            audio.current = null;
            if (!suspend && !completed.current && !reduced)
                beginSound();
        };
        const tick = (now: number) => {
            if (cancelled)
                return;
            const elapsed = clock.current.tick(now);
            if (document.hidden || manuallyPaused.current) {
                previous = null;
                frameId.current = requestAnimationFrame(tick);
                return;
            }
            const state = scene.current?.render(elapsed, options) ?? sampleAstral(elapsed, options);
            const progress = reduced && !shouldSkip ? Math.min(1, elapsed / 900) : state.reveal;
            if (progress > 0) {
                element.style.setProperty("--reveal", String(progress));
                element.style.setProperty("--card-y", `${(1 - progress) * 45}px`);
                element.style.setProperty("--card-rotate", `${(1 - progress) * -24}deg`);
                element.style.setProperty("--card-scale", String(.76 + progress * .24));
            }
            if ((progress > 0 || reduced) && !revealStarted.current) {
                revealStarted.current = true;
                setStage("revealing");
            }
            if (elapsed >= 800 && !skipUnlocked.current) {
                skipUnlocked.current = true;
                setCanSkip(true);
            }
            if (state.finished || (reduced && elapsed >= 900)) {
                element.style.setProperty("--reveal", "1");
                element.style.setProperty("--card-y", "0px");
                element.style.setProperty("--card-rotate", "0deg");
                element.style.setProperty("--card-scale", "1");
                finishEvent();
                return; // Settled results cost zero animation frames.
            }
            if (previous !== null && !manuallyPaused.current && adaptive.observe(now - previous))
                scene.current?.resize(adaptive.scale);
            previous = now;
            frameId.current = requestAnimationFrame(tick);
        };
        const prepare = async () => {
            const artwork = reduced || shouldSkip ? null : await loadAstralArtwork();
            if (cancelled)
                return;
            if (!reduced && !shouldSkip && canvas.current) {
                try {
                    scene.current = new AstralRenderer(canvas.current, artwork, prefs.current.lowVisualEffects || prefs.current.dataSaver, () => {
                        if (cancelled)
                            return;
                        setFallback(true);
                        clock.current.seek(ceremonyDuration(options.blackHole) - 800);
                    });
                    if (!artwork) {
                        setFallback(true);
                        clock.current.seek(ceremonyDuration(options.blackHole) - 1100);
                    }
                    scene.current.resize(adaptive.scale);
                    observer = new ResizeObserver(() => scene.current?.resize(adaptive.scale));
                    observer.observe(canvas.current);
                }
                catch {
                    setFallback(true);
                    clock.current.seek(ceremonyDuration(options.blackHole) - 1100);
                }
            }
            if (shouldSkip)
                clock.current.seek(ceremonyDuration(options.blackHole));
            clock.current.setPaused(document.hidden || manuallyPaused.current);
            setStage("playing");
            if (!document.hidden && !manuallyPaused.current && !reduced && !shouldSkip)
                beginSound();
            document.addEventListener("visibilitychange", onVisibility);
            frameId.current = requestAnimationFrame(tick);
        };
        void prepare();
        return () => {
            cancelled = true;
            cancelAnimationFrame(frameId.current);
            observer?.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
            audio.current?.stop();
            audio.current = null;
            scene.current?.dispose();
            scene.current = null;
            startAudio.current = () => { };
        };
    }, [mounted, options, reduced, shouldSkip, modal]);
    useEffect(() => { if (card.imageUrl) {
        const image = new Image();
        image.src = card.imageUrl;
    } }, [card.imageUrl]);
    useEffect(() => { if (stage === "complete")
        modal.current?.querySelector<HTMLButtonElement>("[data-continue]")?.focus({ preventScroll: true }); }, [stage, modal]);
    const toggleSound = async () => {
        const next = !muted;
        setMuted(next);
        muteRef.current = next;
        try {
            window.localStorage.setItem("pocketpulls-wish-muted", String(next));
        }
        catch { /* Device-only preference. */ }
        await primeWishAudio();
        if (!next && !paused && !completed.current)
            startAudio.current();
    };
    const togglePause = () => {
        const next = !manuallyPaused.current;
        manuallyPaused.current = next;
        setPaused(next);
        clock.current.setPaused(next || document.hidden);
        if (next) {
            audio.current?.stop();
            audio.current = null;
        }
        else
            startAudio.current();
    };
    if (!mounted)
        return null;
    const complete = stage === "complete", revealed = stage === "revealing" || complete;
    const issue = cosmicBinderIssueNumber ?? cosmicIssueNumber;
    const shellStyle = { "--rarity": config.primary, "--rarity-secondary": config.secondary } as CSSProperties;
    return createPortal(<div ref={modal} className={`${styles.ceremony} ${fallback || reduced ? styles.still : ""}`} style={shellStyle} role="dialog" aria-modal="true" aria-label={complete ? `${card.name}, wish revealed` : "Wish ceremony"} tabIndex={-1} data-stage={stage} data-paused={paused}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true"/><div className={styles.vignette} aria-hidden="true"/>
      <header className={styles.topbar}>
        <span className={styles.brand}><span aria-hidden="true" className={styles.brandMark}>✧</span> ANCIENT PULLS</span>
        <div className={styles.controls}>
          {!complete && stage !== "loading" && !reduced && <button type="button" onClick={togglePause} aria-label={paused ? "Resume animation" : "Pause animation"} className={styles.iconButton}>{paused ? <PlayIcon /> : <PauseIcon />}</button>}
          <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Mute sound"} aria-pressed={!muted} className={styles.iconButton}><SoundIcon muted={muted}/></button>
          {!complete && allowSkip && <button type="button" disabled={!canSkip} onClick={revealNow} className={styles.skip}>Reveal <span aria-hidden="true">↗</span></button>}
        </div>
      </header>
      {stage === "loading" && <div className={styles.loading} role="status"><span className={styles.loadingStar} aria-hidden="true">✧</span><span>Gathering starlight</span></div>}
      {!revealed && stage !== "loading" && !paused && <div className={styles.caption} aria-hidden="true"><span className={styles.captionRule}/><span>A wish, written in the stars.</span><span className={styles.captionRule}/></div>}
      {paused && !complete && <div className={styles.pauseNotice} role="status">Your stars can wait.</div>}
      <p className={styles.srOnly} role="status" aria-live="polite">{complete ? `${config.label}. ${card.name}. Your card is ready.` : paused ? "Animation paused." : "Following your star."}</p>
      {revealed && <div className={styles.result} aria-hidden={!complete} inert={!complete}>
        <div className={styles.cardStage}>
          <div className={styles.cardHalo} aria-hidden="true"/><div className={styles.cardOrbit} aria-hidden="true"/>
          <div className={styles.card}>
            {card.imageUrl && !imageFailed ? <img src={card.imageUrl} alt={complete ? card.name : ""} onError={() => setImageFailed(true)} draggable={false} className={styles.cardImage}/> : <div className={styles.cardPlaceholder}><span aria-hidden="true">✧</span><span>{card.name}</span><small>Card artwork unavailable</small></div>}
            <div className={styles.cardSheen} aria-hidden="true"/>
          </div>
        </div>
        <div className={styles.details}>
          <p className={styles.eyebrow}><span aria-hidden="true">✦</span> {config.label} <span aria-hidden="true">✦</span></p>
          <h1 className={styles.cardName}>{card.name}</h1>
          <p className={styles.metadata}>{[card.setName, card.cardNumber ? `No. ${card.cardNumber}` : null].filter(Boolean).join(" · ") || "A new light in your constellation"}</p>
          {issue != null && <p className={styles.discovery}>Astral discovery · #{issue.toLocaleString("en-GB")}</p>}
          <div className={styles.actions}>
            <button type="button" data-continue className={styles.primary} onClick={() => exitEvent()} disabled={!complete || busy}>Continue <span aria-hidden="true">→</span></button>
            {onWishAgain && canWishAgain && <button type="button" className={styles.secondary} disabled={!complete || busy} onClick={onWishAgain}>{busy ? "Choosing your next card…" : "Wish again · 1 wish"}</button>}
          </div>
          {actionError && <p className={styles.error} role="alert">{actionError}</p>}
        </div>
      </div>}
      <footer className={styles.footer} aria-hidden="true"><span>THE ASTRAL CEREMONY</span><span className={styles.footerStar}>✧</span><span>{complete ? "YOURS TO DISCOVER" : "FOLLOW YOUR STAR"}</span></footer>
    </div>, document.body);
}
function SoundIcon({ muted }: {
    muted: boolean;
}) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>{muted ? <path d="m16 9 5 6m0-6-5 6"/> : <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>}</svg>; }
function PauseIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>; }
function PlayIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>; }
