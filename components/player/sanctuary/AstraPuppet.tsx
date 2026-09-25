"use client";
import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { AstraRig } from '../astral/AstraRig';
import { loadAstraAtlas } from '../astral/AstraCompanion';
import { flightHand, type FlightPose } from '../astral/flight';

export default function AstraPuppet({ pull, colour, reduced, low, casting, staffRef, children }: {
  pull: number; colour: string; reduced: boolean; low: boolean; casting: boolean;
  staffRef: RefObject<HTMLDivElement | null>; children: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ pull, colour, reduced, low, casting });
  const wake = useRef(() => {});
  useEffect(() => { state.current = { pull, colour, reduced, low, casting }; wake.current(); }, [pull, colour, reduced, low, casting]);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    let frame = 0, active = true, rig: AstraRig | null = null, time = 0, last = 0, currentPull = 0;
    const draw = (now: number) => {
      frame = 0; if (!active || document.hidden) { last = 0; return; }
      const s = state.current, dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60; last = now;
      if (!s.reduced) time += dt;
      currentPull += (s.pull - currentPull) * (1 - Math.exp(-26 * dt));
      const t = s.reduced ? 0 : time, amount = currentPull / 118, width = 260, height = 320, size = 180;
      const density = Math.min(devicePixelRatio || 1, s.low ? 1 : 2);
      if (element.width !== width * density) { element.width = width * density; element.height = height * density; }
      context.setTransform(density, 0, 0, density, 0, 0); context.clearRect(0, 0, width, height);
      const pose: FlightPose = { x: .405 - amount * .02, y: .51 + currentPull / 380,
        scale: 1, roll: -.04 * amount, yaw: .02, leftArm: .35 + Math.sin(t * 1.7) * .06 + amount * .3,
        rightArm: -1.68 + amount * .48, kick: 0, leftLeg: .08 + amount * .17, rightLeg: -.1 - amount * .24,
        stretch: 1 - amount * .045, headTilt: -.04 * amount, wind: amount * .2, gaze: 0, charge: amount,
        expression: amount > .55 ? 1 : s.casting ? 3 : 0 };
      const hand = flightHand(pose, 1, size, width, height), top = hand.y - 82;
      if (staffRef.current) staffRef.current.style.transform = `translate3d(${hand.x - 28}px,${top - 28}px,0)`;
      // The staff is drawn behind the articulated palm, using the rig's actual hand attachment.
      const metal = context.createLinearGradient(hand.x - 3, 0, hand.x + 3, 0);
      metal.addColorStop(0, '#766142'); metal.addColorStop(.48, '#eed6a1'); metal.addColorStop(1, '#8b7355');
      context.fillStyle = metal; context.beginPath(); context.roundRect(hand.x - 2.5, top + 10, 5, 126, 2.5); context.fill();
      context.strokeStyle = '#e9d5a580'; context.lineWidth = 1;
      for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(hand.x, top + 22 + i * 5, 5, 2, 0, 0, Math.PI * 2); context.stroke(); }
      if (rig) rig.draw(context, pose, t, size, width, height, { colour: s.colour, amount: .05 + amount * .12 });
      else {
        // A visible vector fallback keeps the interaction usable while artwork loads or fails.
        context.fillStyle = '#e9d2a0'; context.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 27 : 54; const x = 105 + Math.cos(a) * r, y = 135 + Math.sin(a) * r; if (i) context.lineTo(x, y); else context.moveTo(x, y); }
        context.closePath(); context.fill(); context.fillStyle = '#111c36';
        context.beginPath(); context.ellipse(92, 145, 4, 6, 0, 0, Math.PI * 2); context.ellipse(116, 145, 4, 6, 0, 0, Math.PI * 2); context.fill();
      }
      if (!s.reduced || Math.abs(currentPull - s.pull) > .05) frame = requestAnimationFrame(draw); else last = 0;
    };
    const queue = () => { if (active && !document.hidden && !frame) frame = requestAnimationFrame(draw); }; wake.current = queue;
    const visibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else queue(); };
    document.addEventListener('visibilitychange', visibility);
    void loadAstraAtlas().then(image => { if (active) { rig = new AstraRig(image); queue(); } }).catch(() => {}); queue();
    return () => { active = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); wake.current = () => {}; };
  }, [staffRef]);
  return <div className="as-puppet"><canvas ref={canvas} width="520" height="640" aria-label="Astra holding his star staff" role="img" />{children}</div>;
}
