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
    stretch?: number;
    pitch?: number;
    headTilt?: number;
    leftLeg?: number;
    rightLeg?: number;
    wind?: number;
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
const SINGLE_PATH: readonly Vec2[] = [[-.14,.78],[.12,.53],[.49,.24],[.78,.34],[.69,.64],[.34,.68],[.29,.42],[.47,.58]];
const TEN_PATH: readonly Vec2[] = [[.46,.76],[.48,.79],[.51,.54],[.48,-.18],[.71,.26],[.59,.47],[.5,.53]];
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
/** Authored camera beats share the neutral opening; no outcome can affect framing. */
export function sampleFlightCamera(ms:number,count:number){
    const t=Math.max(0,Number.isFinite(ms)?ms:0)/1000,ten=count===10,birth=revealTime(count)/1000;
    const gather=smooth(ten?6:4.5,birth-.5,t),release=smooth(birth,birth+2.1,t);
    const bank=Math.sin(smooth(.2,ten?6:5,t)*Math.PI*2)*(1-gather);
    return {zoom:1+gather*.065-release*.055,x:bank*.012,y:-gather*.012+release*.010,roll:bank*.012,
        hush:smooth(birth-1.05,birth-.16,t)*(1-smooth(birth,birth+.65,t)),reveal:release};
}
const TAU=Math.PI*2;
const pulse=(start:number,end:number,t:number)=>Math.sin(clamp((t-start)/(end-start))*Math.PI)**2;
function flightPosition(t:number,ten:boolean):Vec2 {
    const motion=smooth(.15,ten?6.4:5.2,t),path=curve(ten?TEN_PATH:SINGLE_PATH,motion);
    const casting=smooth(ten?6.2:4.9,ten?8.6:6.6,t),revealAt=ten?11.6:9.6,end=ten?16.4:12.8;
    const settle=smooth(revealAt+1.6,end,t),recoil=pulse(revealAt,revealAt+.95,t);
    return [lerp(lerp(path[0],ten?.5:.46,casting),ten?.5:.24,settle),
        lerp(path[1],ten?.53:.61,casting)+Math.sin(t*2.8)*.004+recoil*.028];
}
export function rigBodyScale(pose:FlightPose){
    const stretch=pose.stretch??1;
    return {x:(.65+Math.abs(Math.cos(pose.yaw))*.35)/Math.sqrt(stretch),y:stretch*(1-(pose.pitch??0)*.07)};
}
/** Shared attachment coordinates keep emitted light on the articulated hands. */
export function flightHand(pose:FlightPose,side:number,size:number,width:number,height:number){
    const rotation=(side<0?pose.leftArm:pose.rightArm)+side*.38,body=rigBodyScale(pose);
    const hx=side*9.5,hy=19;
    const x=(side*14+hx*Math.cos(rotation)-hy*Math.sin(rotation))*body.x*size/100;
    const y=(4+hx*Math.sin(rotation)+hy*Math.cos(rotation))*body.y*size/100;
    return {x:pose.x*width+x*Math.cos(pose.roll)-y*Math.sin(pose.roll),y:pose.y*height+x*Math.sin(pose.roll)+y*Math.cos(pose.roll)};
}
/** The complete anticipation is outcome-independent, including size, timing and lighting. */
export function sampleFlight(ms:number,count=1):FlightFrame {
    const t=Math.max(0,Number.isFinite(ms)?ms:0)/1000,ten=count===10,revealAt=revealTime(count)/1000,end=flightDuration(count)/1000;
    const [x,y]=flightPosition(t,ten),[px,py]=flightPosition(Math.max(0,t-.025),ten),[nx,ny]=flightPosition(t+.025,ten);
    const vx=(nx-px)/.05,vy=(ny-py)/.05,speed=Math.hypot(vx,vy);
    const casting=smooth(ten?6.2:4.9,ten?8.6:6.6,t),settle=smooth(revealAt+1.6,end,t);
    const gather=pulse(ten?6.5:5.3,ten?9.4:7.7,t),sweep=smooth(ten?7.1:5.8,ten?9.2:7.8,t);
    const suspense=smooth(revealAt-1.15,revealAt-.2,t)*(1-smooth(revealAt,revealAt+.12,t));
    const reveal=smooth(revealAt,revealAt+1.15,t),recoil=pulse(revealAt,revealAt+.95,t);
    const flutter=Math.sin(t*4.4)*.11*(1-casting),flight=smooth(.15,ten?6.4:5.2,t);
    const bank=clamp(-vx*1.8,-.88,.88)*(1-casting),barrel=TAU*smooth(ten?3.35:1.75,ten?5.9:4.5,t);
    const left=lerp(.62+flutter,1.6+1.12*sweep,casting)+gather*.28+recoil*.38;
    const right=lerp(-.65-flutter,-1.45-1.27*sweep,casting)-gather*.1-recoil*.38;
    const phase=t>=end?'ready':t>=revealAt+1.15?'orbit':t>=revealAt?'birth':t>=revealAt-1.2?'suspense':casting>.1?'casting':'flight';
    return {time:t,phase,cast:casting,disk:ten?smooth(6.1,9,t):0,ascent:ten?smooth(1.9,3.5,t)*(1-smooth(5,6.5,t)):0,
        reveal,burst:Math.sin(clamp((t-revealAt)/1.1)*Math.PI),ready:t>=end,
        pose:{x,y,scale:ten?lerp(.65,.94,smooth(5,6.5,t)):lerp(.70,.94,flight)-pulse(1.7,3.6,t)*.18,
            roll:barrel+bank+recoil*.11,yaw:TAU*smooth(ten?3.2:1.4,ten?5.8:4.7,t),
            leftArm:lerp(left,.6,settle),rightArm:lerp(right,-.55,settle),kick:Math.sin(t*5.8)*(1-casting)*.53,
            leftLeg:Math.sin(t*5.8)*.42*(1-casting)+gather*.15-recoil*.34,
            rightLeg:Math.sin(t*5.8+.9)*-.38*(1-casting)-gather*.23+recoil*.29,
            stretch:1+Math.min(.10,speed*.13)*(1-casting)-suspense*.055+recoil*.08,
            pitch:clamp(-vy*1.4,-1,1)*(1-casting),headTilt:-bank*.28+Math.sin(t*1.9)*.025-gather*.08,
            wind:Math.min(1,speed*2.8),gaze:casting,charge:casting*(.28+suspense*.65+recoil*.8),
            expression:reveal>.45?3:suspense>.3?2:casting>.3?1:0},
        seed:{x:.5,y:ten?.46:.37,radius:lerp(2,24,casting)*(1-suspense*.73)+reveal*28,opacity:smooth(ten?7.4:5.5,ten?8.6:6.5,t)},caption:''};
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
    return { t, pose: { x, y, scale: lerp(.8, .48, smooth(.2, .9, t)), roll: Math.sin(fly * Math.PI * 2) * .7, yaw: smooth(.1, .6, t) * Math.PI * 2, leftArm: .75+Math.sin(t*Math.PI)*1.65, rightArm: -.75-Math.sin(t*Math.PI)*1.35, kick: Math.sin(t*30)*.35, leftLeg:Math.sin(t*30)*.3, rightLeg:-Math.sin(t*30+.8)*.3, stretch:1+Math.sin(t*Math.PI)*.065, pitch:-Math.cos(t*Math.PI)*.25, headTilt:-Math.sin(t*Math.PI*2)*.13, wind:.65, gaze:1, charge:.35, expression:3 } as FlightPose, starProgress: (index: number) => smooth(.27 + index * .016, .7 + index * .016, t), fade: smooth(.86, 1, t), done: t >= 1, count };
}
