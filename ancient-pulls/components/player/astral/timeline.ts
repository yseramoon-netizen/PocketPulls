/** One continuous clock drives the scene, reveal and audio. No sprite-frame stepping. */
export const ASTRAL_TIMING = Object.freeze({
    awakening: 0,
    trace: 1700,
    gather: 4200,
    launch: 5900,
    rarity: 7100,
    impact: 9300,
    card: 9850,
    complete: 11300,
    horizonImpact: 11200,
    horizonCard: 12000,
    horizonComplete: 13450,
});
export type AstralOptions = {
    tier: number;
    blackHole: boolean;
    primary: string;
    secondary: string;
};
export type Vec2 = readonly [
    number,
    number
];
export type AstralFrame = {
    time: number;
    trace: number;
    gather: number;
    flight: number;
    colour: number;
    impact: number;
    horizon: number;
    engulf: number;
    reveal: number;
    finished: boolean;
    mascot: {
        x: number;
        y: number;
        scale: number;
        roll: number;
        opacity: number;
        stretch: number;
    };
    comet: {
        x: number;
        y: number;
        size: number;
        opacity: number;
    };
    primary: [
        number,
        number,
        number
    ];
    secondary: [
        number,
        number,
        number
    ];
};
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, value: number) => {
    const t = clamp((value - a) / (b - a));
    return t * t * (3 - 2 * t);
};
export const ease = (value: number) => {
    const t = clamp(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
};
export const rgb = (hex: string): [
    number,
    number,
    number
] => {
    const value = /^#[\da-f]{6}$/i.test(hex) ? Number.parseInt(hex.slice(1), 16) : 0xc5eaff;
    return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
};
const NEUTRAL: [
    number,
    number,
    number
] = [0.74, 0.86, 1];
const NEUTRAL_SECONDARY: [
    number,
    number,
    number
] = [0.52, 0.65, 0.87];
/** Uniform Catmull–Rom: continuous position and velocity through the star's arc. */
export function curve(points: readonly Vec2[], progress: number): Vec2 {
    const p = clamp(progress) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(p));
    const t = p - index;
    const a = points[Math.max(0, index - 1)];
    const b = points[index];
    const c = points[index + 1];
    const d = points[Math.min(points.length - 1, index + 2)];
    const coordinate = (axis: 0 | 1) => 0.5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t
        + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t
        + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t * t * t);
    return [coordinate(0), coordinate(1)];
}
const FLIGHT_PATH: readonly Vec2[] = [[0, 0.08], [-0.25, 0.30], [-0.13, 0.35], [0.26, 0.21], [0.15, -0.05], [0, 0]];
export const cometPosition = (flight: number): Vec2 => curve(FLIGHT_PATH, ease(flight));
export function ceremonyDuration(blackHole: boolean): number {
    return blackHole ? ASTRAL_TIMING.horizonComplete : ASTRAL_TIMING.complete;
}
/** The result cannot change the opening: colour, particles, movement and sound stay neutral until `rarity`. */
export function sampleAstral(elapsedMs: number, options: AstralOptions): AstralFrame {
    const ms = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
    const time = ms / 1000;
    const flight = clamp((ms - ASTRAL_TIMING.launch) / (ASTRAL_TIMING.impact - ASTRAL_TIMING.launch));
    const colour = smooth(ASTRAL_TIMING.rarity, ASTRAL_TIMING.rarity + 450, ms);
    const horizon = options.blackHole ? smooth(ASTRAL_TIMING.rarity, ASTRAL_TIMING.horizonImpact, ms) : 0;
    const impactAt = options.blackHole ? ASTRAL_TIMING.horizonImpact : ASTRAL_TIMING.impact;
    const cardAt = options.blackHole ? ASTRAL_TIMING.horizonCard : ASTRAL_TIMING.card;
    const reveal = smooth(cardAt, cardAt + 1300, ms);
    const gather = smooth(ASTRAL_TIMING.gather, ASTRAL_TIMING.launch, ms);
    const arrive = ease(ms / 1850);
    const orbit = smooth(1900, 4400, ms);
    const launch = smooth(ASTRAL_TIMING.launch, ASTRAL_TIMING.rarity, ms);
    let x = lerp(-0.38, 0, arrive) + Math.sin(orbit * Math.PI * 2) * 0.13 * (1 - gather);
    let y = lerp(-0.17, 0.01, arrive) + Math.sin(time * 1.6) * 0.012 * (1 - launch);
    let scale = lerp(0.12, 0.43, arrive) * (1 - gather * 0.12);
    const [cx, cy] = cometPosition(flight);
    x = lerp(x, cx, launch);
    y = lerp(y, cy, launch);
    scale *= 1 - launch * 0.55;
    let opacity = smooth(150, 1100, ms) * (1 - smooth(7100, 7750, ms));
    let stretch = 0;
    // This branch is strictly dormant until the result is allowed to become visible.
    if (options.blackHole && ms >= ASTRAL_TIMING.rarity) {
        const pull = smooth(ASTRAL_TIMING.rarity, 10600, ms);
        x = lerp(cx, 0, pull);
        y = lerp(cy, 0.06, pull);
        opacity = 1 - smooth(9300, 10800, ms);
        scale *= 1 - pull * 0.65;
        stretch = pull * 2.6;
    }
    const p = rgb(options.primary);
    const s = rgb(options.secondary);
    return {
        time, trace: smooth(1400, 4400, ms), gather, flight, colour,
        impact: smooth(impactAt - 110, impactAt + 200, ms) * (1 - smooth(impactAt + 230, cardAt + 500, ms)),
        horizon, engulf: options.blackHole ? smooth(10200, 11800, ms) : 0,
        reveal, finished: ms >= ceremonyDuration(options.blackHole),
        mascot: { x, y, scale, roll: Math.sin(orbit * Math.PI * 2) * 0.18 - launch * 0.6, opacity, stretch },
        comet: { x: cx, y: cy, size: lerp(0.013, 0.115, flight * flight), opacity: smooth(5650, 6150, ms) * (1 - smooth(impactAt, impactAt + 200, ms)) * (1 - horizon) },
        primary: NEUTRAL.map((v, i) => lerp(v, p[i], colour)) as AstralFrame["primary"],
        secondary: NEUTRAL_SECONDARY.map((v, i) => lerp(v, s[i], colour)) as AstralFrame["secondary"],
    };
}
/** Pausing freezes elapsed time instead of jumping to a result after tab restoration. */
export class CeremonyClock {
    private elapsed = 0;
    private last: number | null = null;
    private paused = false;
    tick(now: number): number {
        if (!Number.isFinite(now))
            return this.elapsed;
        if (!this.paused && this.last !== null)
            this.elapsed += Math.max(0, now - this.last);
        this.last = now;
        return this.elapsed;
    }
    setPaused(paused: boolean) { this.paused = paused; this.last = null; }
    seek(elapsed: number) { this.elapsed = Math.max(0, elapsed); this.last = null; }
    get time() { return this.elapsed; }
}
/** Reduce pixels, never cadence. A 60 Hz display still receives one render per rAF. */
export class AdaptiveResolution {
    scale: number;
    private samples = 0;
    private slow = 0;
    constructor(lowEffects = false) { this.scale = lowEffects ? 0.7 : 1; }
    observe(deltaMs: number): boolean {
        if (deltaMs <= 0 || deltaMs > 100)
            return false;
        this.samples++;
        if (deltaMs > 21)
            this.slow++;
        if (this.samples < 90)
            return false;
        const previous = this.scale;
        if (this.slow > 25)
            this.scale = Math.max(0.55, this.scale - 0.15);
        this.samples = 0;
        this.slow = 0;
        return previous !== this.scale;
    }
}
