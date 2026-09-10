"use client";
import { ASTRAL_TIMING, type AstralOptions } from "./astral/timeline";
export type WishAudioSession = {
    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
    stop: () => void;
};
export type WishAudioTimeline = {
    impactAtMs: number;
    revealAtMs: number;
    mode?: "journey" | "cosmic" | "convergence" | "binder";
    travelWindows?: readonly {
        startAtMs: number;
        durationMs: number;
        intensity: number;
    }[];
};
let context: AudioContext | null = null;
function audioContext(): AudioContext | null {
    if (typeof window === "undefined")
        return null;
    try {
        const Constructor = window.AudioContext || (window as Window & {
            webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
        if (!Constructor)
            return null;
        if (!context || context.state === "closed")
            context = new Constructor();
        return context;
    }
    catch {
        return null;
    }
}
/** Retains the purchase/preview gesture hook so Safari can unlock sound before the award arrives. */
export async function primeWishAudio(): Promise<void> {
    const ctx = audioContext();
    if (ctx?.state === "suspended") {
        try {
            await ctx.resume();
        }
        catch { /* Silent playback remains available. */ }
    }
}
export function startAstralWishAudio(options: AstralOptions, muted: boolean, volume = 72, offsetMs = 0): WishAudioSession | null {
    const ctx = audioContext();
    if (!ctx || ctx.state !== "running")
        return null;
    const offset = offsetMs / 1000, now = ctx.currentTime + .025;
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    nodes.push(master, compressor);
    let currentMuted = muted, currentVolume = Math.max(0, Math.min(100, volume)) / 100, stopped = false;
    master.gain.value = currentMuted ? 0 : currentVolume * .56;
    compressor.threshold.value = -20;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = .008;
    compressor.release.value = .3;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    const delay = ctx.createDelay(1), feedback = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = .31;
    feedback.gain.value = .19;
    wet.gain.value = .12;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    nodes.push(delay, feedback, wet);
    const tone = (at: number, duration: number, hz: number, gain: number, type: OscillatorType = "sine", bend = 1) => {
        if (at + duration <= offset)
            return;
        const start = now + Math.max(0, at - offset), remaining = at + duration - Math.max(at, offset);
        const osc = ctx.createOscillator(), envelope = ctx.createGain();
        nodes.push(osc, envelope);
        sources.push(osc);
        const consumed = Math.max(0, offset - at) / duration;
        osc.type = type;
        osc.frequency.setValueAtTime(hz * Math.pow(bend, consumed), start);
        osc.frequency.exponentialRampToValueAtTime(hz * bend, start + remaining);
        const attack = Math.min(.18, remaining * .15);
        envelope.gain.setValueAtTime(.0001, start);
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + attack);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + remaining);
        osc.connect(envelope);
        envelope.connect(master);
        envelope.connect(delay);
        osc.start(start);
        osc.stop(start + remaining + .025);
    };
    const air = (at: number, duration: number, gain: number, from: number, to: number) => {
        if (at + duration <= offset)
            return;
        const start = now + Math.max(0, at - offset), remaining = at + duration - Math.max(at, offset);
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate), data = buffer.getChannelData(0);
        let seed = 81473;
        for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            data[i] = (seed / 4294967296 - .5) * .6;
        }
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "bandpass";
        filter.Q.value = .65;
        filter.frequency.setValueAtTime(from * Math.pow(to / from, Math.max(0, offset - at) / duration), start);
        filter.frequency.exponentialRampToValueAtTime(to, start + remaining);
        envelope.gain.setValueAtTime(.0001, start);
        envelope.gain.exponentialRampToValueAtTime(gain, start + remaining * .52);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + remaining);
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(master);
        sources.push(source);
        nodes.push(source, filter, envelope);
        source.start(start);
        source.stop(start + remaining + .03);
    };
    // Original score: a quiet fifth, glass harmonics, then a breath before the final chord.
    // These cues are identical for every outcome, including the black hole.
    tone(0, 5.9, 130.81, .075);
    tone(.18, 5.5, 196, .040);
    tone(.6, 4.8, 261.63, .023);
    const notes = [523.25, 783.99, 1046.50, 1174.66, 1567.98, 1046.50];
    notes.forEach((hz, i) => { tone(1.55 + i * .44, 1.5, hz, .038); tone(1.565 + i * .44, .8, hz * 2.003, .008); });
    tone(4.25, 2.6, 196, .055, "sine", 2);
    air(4.2, 2.85, .2, 420, 3500);
    air(5.85, 1.25, .25, 800, 5000);
    tone(5.9, 1.15, 392, .045, "sine", 2);
    const final = ASTRAL_TIMING.rarity / 1000, tier = Math.max(1, Math.min(9, options.tier));
    if (options.blackHole) {
        tone(final, 4.6, 98, .15, "sine", .32);
        tone(final + .2, 4, 147, .055, "sine", .35);
        air(final, 4.3, .29, 2400, 95);
        tone(11.8, 2.8, 261.63, .12);
        tone(11.92, 2.6, 392, .08);
        tone(12.1, 2.4, 659.25, .065);
        tone(12.3, 2, 1046.5, .04);
    }
    else {
        const root = tier >= 7 ? 293.66 : tier >= 4 ? 261.63 : 220;
        tone(final, 2.25, root, .075);
        tone(final + .07, 2.25, root * 1.5, .055);
        air(final, 2.15, .27, 1100, 6300);
        const impact = ASTRAL_TIMING.impact / 1000;
        tone(impact, .65, 82.41, .2, "sine", .58);
        [1, 1.5, 2, 2.5].forEach((ratio, i) => tone(impact + i * .055, 3.0 - i * .15, root * ratio, .09 - i * .015));
        if (tier >= 6)
            tone(impact + .3, 2.7, root * 4, .022);
    }
    return {
        setMuted(value) { currentMuted = value; master.gain.setTargetAtTime(currentMuted ? 0 : currentVolume * .56, ctx.currentTime, .06); },
        setVolume(value) { currentVolume = Math.max(0, Math.min(100, value)) / 100; master.gain.setTargetAtTime(currentMuted ? 0 : currentVolume * .56, ctx.currentTime, .06); },
        stop() {
            if (stopped)
                return;
            stopped = true;
            master.gain.cancelScheduledValues(ctx.currentTime);
            master.gain.setTargetAtTime(0, ctx.currentTime, .018);
            for (const source of sources) {
                try {
                    source.stop(ctx.currentTime + .09);
                }
                catch { /* Already ended. */ }
            }
            window.setTimeout(() => nodes.forEach(node => node.disconnect()), 130);
        },
    };
}
/** Compatibility for older preview callers. */
export function startWishAudio(tier: number, muted: boolean, volume = 72, timeline?: WishAudioTimeline): WishAudioSession | null {
    return startAstralWishAudio({ tier, blackHole: timeline?.mode === "convergence", primary: "#c5eaff", secondary: "#8ba8df" }, muted, volume);
}
