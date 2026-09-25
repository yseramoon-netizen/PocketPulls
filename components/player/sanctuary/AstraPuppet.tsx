"use client";
import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { AstraRig } from '../astral/AstraRig';
import { loadAstraAtlas } from '../astral/AstraCompanion';
import { flightHand, type FlightPose } from '../astral/flight';
import { sampleAstraPose, stepStaffSpring, type StaffMotion, type AstraMood } from '@/lib/player/astraMotion';
import { STAFF_PIVOT, STAFF_RADIUS } from '@/lib/player/astraInteraction';

export default function AstraPuppet({ motion, colour, reduced, low, mood, celebration, suspended, staffRef, children }: {
  motion: RefObject<StaffMotion>; colour: string; reduced: boolean; low: boolean; mood: AstraMood; celebration: number; suspended: boolean;
  staffRef: RefObject<HTMLDivElement | null>; children: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), arc = useRef<SVGPathElement>(null);
  const state = useRef({ colour, reduced, low, mood, celebration, suspended });
  const wake = useRef(() => {});
  useEffect(() => { state.current = { colour, reduced, low, mood, celebration, suspended }; wake.current(); }, [colour, reduced, low, mood, celebration, suspended]);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    let frame = 0, active = true, rig: AstraRig | null = null, time = 0, last = 0, moodStart = 0, previousMood = '', previousCelebration = state.current.celebration;
    let lastPose: FlightPose | null = null, densityLimit = 1.5, samples = 0, slowFrames = 0;
    const profiling = new URLSearchParams(location.search).has('astra-profile'), paints: number[] = [], gaps: number[] = [];
    const metal = context.createLinearGradient(-3, 0, 3, 0);
    metal.addColorStop(0, '#766142'); metal.addColorStop(.48, '#eed6a1'); metal.addColorStop(1, '#8b7355');
    const draw = (now: number) => {
      frame = 0;
      const s = state.current;
      if (!active || document.hidden || s.suspended) { last = 0; return; }
      const started = performance.now(), gap = last ? now - last : 0, dt = last ? Math.min(gap / 1000, .05) : 1 / 60; last = now;
      if (!s.reduced) time += dt;
      if (previousMood !== s.mood || previousCelebration !== s.celebration) { moodStart = time; previousMood = s.mood; previousCelebration = s.celebration; }
      const m = motion.current;
      const spring = stepStaffSpring(m.angle, m.velocity, m.target, dt, m.dragging ? 40 : 24);
      m.angle = s.reduced ? m.target : spring.position; m.velocity = s.reduced ? 0 : spring.velocity;
      if (Math.abs(m.angle - m.target) < .005 && Math.abs(m.velocity) < .02) { m.angle = m.target; m.velocity = 0; }
      const density = Math.min(devicePixelRatio || 1, s.low ? 1 : densityLimit), width = 260, height = 320;
      if (element.width !== Math.round(width * density)) { element.width = Math.round(width * density); element.height = Math.round(height * density); }
      context.setTransform(density, 0, 0, density, 0, 0); context.clearRect(0, 0, width, height);
      const pose = sampleAstraPose(time, m.angle, s.mood, time - moodStart, s.reduced);
      if (lastPose && !s.reduced) {
        const blend = 1 - Math.exp(-18 * dt);
        for (const key of ['roll', 'yaw', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'stretch', 'headTilt', 'wind', 'gaze'] as const) { const previous = lastPose[key] ?? 0; pose[key] = previous + ((pose[key] ?? 0) - previous) * blend; }
        const hand = flightHand(pose, 1, 180, width, height);
        pose.x += (STAFF_PIVOT.x - hand.x) / width; pose.y += (STAFF_PIVOT.y - hand.y) / height;
      }
      lastPose = pose;
      if (staffRef.current) {
        staffRef.current.style.transform = `translate3d(${STAFF_PIVOT.x - 28}px,${STAFF_PIVOT.y - STAFF_RADIUS - 28}px,0) rotate(${m.angle}deg)`;
        staffRef.current.dataset.dragging = String(m.dragging);
      }
      if (arc.current) arc.current.style.strokeDashoffset = String(64.4 * (1 - m.angle / 45));
      context.save(); context.translate(STAFF_PIVOT.x, STAFF_PIVOT.y); context.rotate(m.angle * Math.PI / 180);
      context.fillStyle = metal; context.beginPath(); context.roundRect(-2.5, -72, 5, 126, 2.5); context.fill();
      context.strokeStyle = '#e9d5a580'; context.lineWidth = 1;
      for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(0, -60 + i * 5, 5, 2, 0, 0, Math.PI * 2); context.stroke(); }
      context.restore();
      if (rig) rig.draw(context, pose, time, 180, width, height, { colour: s.colour, amount: .05 + m.angle / 45 * .12 });
      else {
        context.fillStyle = '#e9d2a0'; context.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 27 : 54; const x = 105 + Math.cos(a) * r, y = 135 + Math.sin(a) * r; if (i) context.lineTo(x, y); else context.moveTo(x, y); }
        context.closePath(); context.fill(); context.fillStyle = '#111c36'; context.beginPath(); context.ellipse(92, 145, 4, 6, 0, 0, Math.PI * 2); context.ellipse(116, 145, 4, 6, 0, 0, Math.PI * 2); context.fill();
      }
      const cost = performance.now() - started;
      // Reduce raster resolution under sustained load; never throttle the animation cadence.
      samples++; if (cost > 8) slowFrames++;
      if (samples === 120) { if (slowFrames > 24) densityLimit = 1; samples = 0; slowFrames = 0; }
      if (profiling) {
        paints.push(cost); if (gap) gaps.push(gap); if (paints.length > 600) paints.shift(); if (gaps.length > 600) gaps.shift();
        if (paints.length % 60 === 0) {
          const sorted = [...paints].sort((a, b) => a - b), elapsed = gaps.reduce((a, b) => a + b, 0);
          element.dataset.performance = JSON.stringify({ samples: paints.length, paintP95Ms: +sorted[Math.floor(sorted.length * .95)].toFixed(2), fps: +(1000 * gaps.length / elapsed).toFixed(1), longFrames: gaps.filter(ms => ms > 25).length, density });
        }
      }
      // Continuous rendering follows the display refresh rate. Reduced motion draws only when needed.
      if (!s.reduced || m.dragging || m.angle !== m.target) frame = requestAnimationFrame(draw); else last = 0;
    };
    const queue = () => { if (active && !document.hidden && !state.current.suspended && !frame) frame = requestAnimationFrame(draw); }; wake.current = queue;
    const visibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else queue(); };
    document.addEventListener('visibilitychange', visibility);
    void loadAstraAtlas().then(image => { if (active) { rig = new AstraRig(image); queue(); } }).catch(() => {}); queue();
    return () => { active = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); wake.current = () => {}; };
  }, [motion, staffRef]);
  return <div className="as-puppet"><canvas ref={canvas} width="390" height="480" aria-label="Astra holding his star staff" role="img" /><svg className="as-arc" viewBox="0 0 260 320" aria-hidden="true"><path d="M168 81 A82 82 0 0 1 226 105" /><path ref={arc} className="as-arc-progress" d="M168 81 A82 82 0 0 1 226 105" /><circle cx="226" cy="105" r="3" /><text x="215" y="78">45°</text></svg>{children}</div>;
}
