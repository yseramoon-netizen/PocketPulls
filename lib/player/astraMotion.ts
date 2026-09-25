import { flightHand, type FlightPose } from '../../components/player/astral/flight';
import { STAFF_PIVOT } from './astraInteraction';
export type AstraMood = 'idle' | 'greeting' | 'listening' | 'charging' | 'celebrating' | 'resting';
export type StaffMotion = { target: number; angle: number; velocity: number; dragging: boolean; valid: boolean };
export const createStaffMotion = (): StaffMotion => ({ target: 0, angle: 0, velocity: 0, dragging: false, valid: true });

/** Exact critically-damped spring: the same trajectory at 30, 60 or 120 Hz. */
export function stepStaffSpring(position: number, velocity: number, target: number, seconds: number, speed = 25) {
  const dt = Math.max(0, Math.min(.1, seconds)), offset = position - target, impulse = velocity + speed * offset, decay = Math.exp(-speed * dt);
  return { position: target + (offset + impulse * dt) * decay, velocity: (velocity - speed * impulse * dt) * decay };
}
const pulse = (t: number, start: number, end: number) => t <= start || t >= end ? 0 : Math.sin((t - start) / (end - start) * Math.PI) ** 2;
/** Continuous articulated poses. The grip remains anchored while Astra breathes, waves and kicks. */
export function sampleAstraPose(time: number, angle: number, mood: AstraMood, moodTime: number, reduced = false): FlightPose {
  const t = reduced ? 1 : time, a = angle / 45;
  const hello = reduced ? 0 : mood === 'greeting' && moodTime < 2.4 ? pulse(moodTime, 0, 2.4) : pulse(t % 8.8, 5.1, 7.5) * .55;
  const joy = reduced ? 0 : mood === 'celebrating' ? pulse(moodTime, 0, 2.1) : 0;
  const listening = mood === 'listening' ? 1 : 0, sleepy = mood === 'resting' ? 1 : 0;
  const breath = reduced ? 0 : Math.sin(t * 2.3);
  const smile = Math.max(hello, joy, listening * .7, reduced ? 0 : pulse(t % 5.9, 4.9, 5.4));
  const pose: FlightPose = {
    x: .405, y: .51, scale: 1,
    roll: reduced ? 0 : Math.sin(t * 1.15) * .038 + a * .08 - joy * .13,
    yaw: reduced ? 0 : Math.sin(t * .7) * .07 - listening * .07,
    leftArm: .42 + breath * .1 + hello * (1.05 + Math.sin(t * 12) * .22) + joy * 1.45 + a * .36,
    rightArm: -1.68 + (reduced ? 0 : Math.sin(t * 1.45) * .085) + a * .26 - joy * .10,
    kick: 0, leftLeg: .13 + breath * .12 - a * .3 + joy * .36,
    rightLeg: -.14 - Math.sin(t * 2.3 + .9) * (reduced ? 0 : .12) + a * .2 - joy * .3,
    stretch: 1 + breath * .018 - a * .04 + joy * .07,
    headTilt: (reduced ? 0 : Math.sin(t * 1.4) * .045) - hello * .11 - listening * .06 + sleepy * .1 - a * .09,
    wind: .12 + hello * .18 + joy * .65 + a * .22,
    gaze: listening, charge: a, expression: a > .5 ? 1 : smile > .01 ? 3 : 0,
    expressionBlend: a > .5 ? Math.min(1, (a - .5) * 4) : smile,
  };
  const hand = flightHand(pose, 1, 180, 260, 320);
  pose.x += (STAFF_PIVOT.x - hand.x) / 260;
  pose.y += (STAFF_PIVOT.y - hand.y) / 320;
  return pose;
}
