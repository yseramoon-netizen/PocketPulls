"use client";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalFocus from '@/lib/client/useModalFocus';
import usePlayerPreferences from '../usePlayerPreferences';
import { FlightRenderer, loadAstraRig } from './FlightRenderer';
import { CeremonyClock, AdaptiveResolution } from './timeline';
import { FLIGHT_TIMING, type ArrivalTarget } from './flight';
import styles from './AstralWish.module.css';
export default function AstraArrival({ getTargets, onArrived, onDone }: {
    getTargets: () => ArrivalTarget[];
    onArrived: (id: string) => void;
    onDone: () => void;
}) {
    const p = usePlayerPreferences(), canvas = useRef<HTMLCanvasElement>(null), finish = useRef(onDone), arrived = useRef(onArrived), [waiting, setWaiting] = useState(true);
    const modal = useModalFocus<HTMLDivElement>(true, () => finish.current());
    useEffect(() => {
        finish.current = onDone;
        arrived.current = onArrived;
    }, [onDone, onArrived]);
    useEffect(() => {
        let disposed = false, frame = 0, renderer: FlightRenderer | null = null, observer: ResizeObserver | null = null, last: number | null = null, started = false, waitStart: number | null = null;
        const clock = new CeremonyClock(), resolution = new AdaptiveResolution(p.lowVisualEffects || p.dataSaver), shown = new Set<string>();
        const visibility = () => {
            clock.setPaused(document.hidden);
            last = null;
        };
        document.addEventListener('visibilitychange', visibility);
        const tick = (now: number) => {
            if (disposed)
                return;
            if (document.hidden) {
                frame = requestAnimationFrame(tick);
                return;
            }
            const targets = getTargets();
            if (!targets.length) {
                waitStart ??= now;
                if (now - waitStart > 5000) {
                    finish.current();
                    return;
                }
                frame = requestAnimationFrame(tick);
                return;
            }
            if (!started) {
                started = true;
                setWaiting(false);
            }
            const ms = clock.tick(now);
            if (p.reducedMotion || !renderer) {
                targets.forEach(t => arrived.current(t.id));
                finish.current();
                return;
            }
            const state = renderer.renderArrival(ms, targets, true);
            targets.forEach((t, i) => {
                if (state.starProgress(i) >= .999 && !shown.has(t.id)) {
                    shown.add(t.id);
                    arrived.current(t.id);
                }
            });
            if (state.done || ms >= FLIGHT_TIMING.arrival) {
                finish.current();
                return;
            }
            if (last !== null && resolution.observe(now - last))
                renderer.resize(resolution.scale);
            last = now;
            frame = requestAnimationFrame(tick);
        };
        void (async () => {
            const image = p.reducedMotion ? null : await loadAstraRig();
            if (disposed)
                return;
            if (image && canvas.current) {
                try {
                    renderer = new FlightRenderer(canvas.current, image, p.lowVisualEffects || p.dataSaver);
                    renderer.resize(resolution.scale);
                    observer = new ResizeObserver(() => renderer?.resize(resolution.scale));
                    observer.observe(canvas.current);
                }
                catch {
                }
            }
            frame = requestAnimationFrame(tick);
        })();
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer?.disconnect();
            renderer?.dispose();
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [getTargets, p.reducedMotion, p.lowVisualEffects, p.dataSaver]);
    return createPortal(<div ref={modal} className={styles.arrivalOverlay} role="dialog" aria-modal="true" aria-label="Astra is placing your stars" tabIndex={-1}><canvas ref={canvas} aria-hidden="true"/><p className={styles.arrivalCaption} role="status">{waiting ? 'Finding a place in your sky…' : 'A place among your stars.'}</p><button className={styles.arrivalSkip} onClick={() => finish.current()}>Finish <span aria-hidden="true">↗</span></button></div>, document.body);
}
