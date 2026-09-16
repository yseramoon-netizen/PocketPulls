import { clamp, curve, ease, lerp, smooth, type AstralOptions, type Vec2 } from './timeline';
export type FlightPose = {
    x: number;
    y: number;
    scale: number;
    roll: number;
    yaw: number;
    leftArm: number;
    rightArm: number;
    kick: number;
    gaze: number;
    charge: number;
    expression?: number;
};
export type FlightFrame = {
    time: number;
    pose: FlightPose;
    phase: 'flight' | 'casting' | 'suspense' | 'birth' | 'orbit' | 'ready';
    cast: number;
    disk: number;
    ascent: number;
    reveal: number;
    burst: number;
    ready: boolean;
    seed: {
        x: number;
        y: number;
        radius: number;
        opacity: number;
    };
    caption: string;
};
export const FLIGHT_TIMING = Object.freeze({ singleReveal: 9600, singleReady: 12800, tenReveal: 11600, tenReady: 16400, arrival: 5800 });
const SINGLE_PATH: readonly Vec2[] = [[-.13, .76], [.15, .47], [.54, .28], [.8, .4], [.58, .68], [.3, .49], [.48, .57]];
const TEN_PATH: readonly Vec2[] = [[.46, .74], [.5, .65], [.48, .35], [.55, -.16], [.62, .34], [.5, .52]];
/** Integral of the ascent speed envelope: background stars never reverse on deceleration. */
export function ascentDistance(seconds: number): number {
    const integral = (start: number, end: number) => {
        const span = end - start, x = clamp((seconds - start) / span);
        return span * (x ** 3 - .5 * x ** 4) + Math.max(0, seconds - end);
    };
    return integral(1.9, 3.5) - integral(5, 6.5);
}
export const flightDuration = (count: number) => count === 10 ? FLIGHT_TIMING.tenReady : FLIGHT_TIMING.singleReady;
export const revealTime = (count: number) => count === 10 ? FLIGHT_TIMING.tenReveal : FLIGHT_TIMING.singleReveal;
/** Outcome-independent anticipation prevents an opening colour or duration revealing rarity. */
export function sampleFlight(ms: number, count = 1): FlightFrame {
    const t = Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000, ten = count === 10, revealAt = revealTime(count) / 1000, end = flightDuration(count) / 1000;
    const flight = smooth(.15, ten ? 6.4 : 5.1, t);
    let [x, y] = curve(ten ? TEN_PATH : SINGLE_PATH, flight);
    const casting = smooth(ten ? 6.2 : 4.9, ten ? 8.6 : 6.4, t), recoil = Math.sin(clamp((t - revealAt) / .8) * Math.PI), settle = smooth(revealAt + 1.6, end, t);
    x = lerp(x, ten ? .5 : .46, casting);
    y = lerp(y, ten ? .53 : .61, casting);
    y += Math.sin(t * 2.8) * .006 + recoil * .025;
    const bank = (ten ? Math.sin(t * 2) * .24 : Math.sin(flight * Math.PI * 4) * .68) * (1 - casting), yaw = (ten ? smooth(3.2, 5.8, t) : smooth(1.4, 4.7, t)) * Math.PI * 2, flutter = Math.sin(t * 4.1) * .12 * (1 - casting);
    const leftArm = lerp(.72 + flutter, 2.1, casting) + recoil * .24, rightArm = lerp(-.66 - flutter, -2.1, casting) - recoil * .24;
    const suspense = smooth(revealAt - 1.1, revealAt - .22, t) * (1 - smooth(revealAt, revealAt + .12, t)), reveal = smooth(revealAt, revealAt + 1.15, t);
    const phase = t >= end ? 'ready' : t >= revealAt + 1.15 ? 'orbit' : t >= revealAt ? 'birth' : t >= revealAt - 1.2 ? 'suspense' : casting > .1 ? 'casting' : 'flight';
    return { time: t, phase, cast: casting, disk: ten ? smooth(6.1, 9, t) : 0, ascent: ten ? smooth(1.9, 3.5, t) * (1 - smooth(5, 6.5, t)) : 0, reveal, burst: Math.sin(clamp((t - revealAt) / 1.1) * Math.PI), ready: t >= end,
        pose: { x: lerp(x, ten ? .5 : .24, settle), y: lerp(y, ten ? .53 : .6, settle), scale: ten ? lerp(.7, 1, smooth(5, 6.5, t)) : lerp(.72, 1, flight), roll: bank + recoil * .08, yaw, leftArm: lerp(leftArm, .6, settle), rightArm: lerp(rightArm, -.55, settle), kick: Math.sin(t * 5.8) * (1 - casting) * .5, gaze: casting, charge: casting * (.28 + suspense * .65 + recoil * .8), expression: reveal > .45 ? 3 : suspense > .3 ? 2 : casting > .3 ? 1 : 0 },
        seed: { x: .5, y: ten ? .46 : .37, radius: lerp(2, 24, casting) * (1 - suspense * .73) + reveal * 28, opacity: smooth(ten ? 7.4 : 5.5, ten ? 8.6 : 6.5, t) },
        caption: phase === 'flight' ? (ten ? 'Beyond the familiar sky.' : 'Astra follows your wish.') : phase === 'casting' ? (ten ? 'Ten wishes. One moment.' : 'A spark, becoming a star.') : phase === 'suspense' ? 'Hold your breath.' : phase === 'birth' ? (ten ? 'Your stars are waking.' : 'Your star is waking.') : phase === 'ready' ? '' : 'A new light in your story.' };
}
export function visibleOptions(ms: number, options: readonly AstralOptions[]): readonly AstralOptions[] {
    return ms < revealTime(options.length) ? options.map(() => ({ tier: 1, blackHole: false, primary: '#d6ebff', secondary: '#86b8de' })) : options;
}
export type ArrivalTarget = {
    id: string;
    x: number;
    y: number;
    colour: string;
    secondary?: string;
};
export function sampleArrival(ms: number, count: number) {
    const t = clamp(ms / FLIGHT_TIMING.arrival), fly = ease(clamp(t / .82)), [x, y] = curve([[.15, .67], [.26, .34], [.57, .24], [.73, .43], [.56, .55]], fly);
    return { t, pose: { x, y, scale: lerp(.8, .48, smooth(.2, .9, t)), roll: Math.sin(fly * Math.PI * 2) * .7, yaw: smooth(.1, .6, t) * Math.PI * 2, leftArm: .75, rightArm: -.75, kick: Math.sin(t * 30) * .35, gaze: 1, charge: .35, expression: 3 } as FlightPose, starProgress: (index: number) => smooth(.27 + index * .016, .7 + index * .016, t), fade: smooth(.86, 1, t), done: t >= 1, count };
}
