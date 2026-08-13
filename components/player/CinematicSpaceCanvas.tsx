"use client";

import { useEffect, useRef } from "react";

type CinematicSpaceCanvasProps = {
  accent: string;
  className?: string;
  lowEffects?: boolean;
  travelling: boolean;
  travelDurationMs: number;
  travelSerial: number;
};

type StarParticle = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  luminosity: number;
  temperature: number;
};

const STAR_TEMPERATURES = [
  [255, 244, 219],
  [255, 251, 242],
  [224, 238, 255],
  [190, 216, 255],
  [255, 224, 191],
] as const;

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHexColor(value: string): readonly [number, number, number] {
  const normalized = value.trim().replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return [147, 197, 253];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function createStars(count: number, seed: number): StarParticle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const radius = Math.pow(random(), 0.62) * 1.38 + 0.018;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: 0.16 + random() * 1.2,
      size: 0.34 + Math.pow(random(), 4) * 2.45,
      phase: random() * Math.PI * 2,
      luminosity: 0.34 + random() * 0.66,
      temperature: Math.floor(random() * STAR_TEMPERATURES.length),
    };
  });
}

export default function CinematicSpaceCanvas({
  accent,
  className,
  lowEffects = false,
  travelling,
  travelDurationMs,
  travelSerial,
}: CinematicSpaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;

    const stars = createStars(lowEffects ? 190 : 760, 9187 + travelSerial * 101);
    const accentRgb = parseHexColor(accent);
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let animationFrame = 0;
    let lastTime = performance.now();
    const travelStartedAt = lastTime;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelBudgetRatio = Math.sqrt(14_000_000 / (width * height));
      pixelRatio = Math.max(
        1,
        Math.min(window.devicePixelRatio || 1, lowEffects ? 1.25 : 2.5, pixelBudgetRatio),
      );
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.lineCap = "round";
    };

    const respawnStar = (star: StarParticle, index: number) => {
      const random = seededRandom(30_071 + travelSerial * 997 + index * 83 + Math.round(lastTime));
      const angle = random() * Math.PI * 2;
      const radius = Math.pow(random(), 0.56) * 1.28 + 0.025;
      star.x = Math.cos(angle) * radius;
      star.y = Math.sin(angle) * radius;
      star.z = 1.08 + random() * 0.34;
      star.size = 0.38 + Math.pow(random(), 3.8) * 2.4;
      star.phase = random() * Math.PI * 2;
      star.luminosity = 0.38 + random() * 0.62;
    };

    const render = (now: number) => {
      const deltaSeconds = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsed = now - travelStartedAt;
      const travelProgress = travelling
        ? Math.min(1, elapsed / Math.max(1, travelDurationMs))
        : 0;
      const acceleration = travelling
        ? 0.13 + Math.pow(travelProgress, 3.15) * 3.65
        : 0.003;
      const centerX = width * 0.5;
      const centerY = height * 0.46;
      const focalX = width * 0.62;
      const focalY = height * 0.68;

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (let index = 0; index < stars.length; index += 1) {
        const star = stars[index];
        const previousZ = star.z;
        star.z -= acceleration * deltaSeconds;
        if (star.z < 0.025) {
          respawnStar(star, index);
          continue;
        }

        const depth = 1 / star.z;
        const previousDepth = 1 / previousZ;
        const currentX = centerX + star.x * focalX * depth;
        const currentY = centerY + star.y * focalY * depth;
        const previousX = centerX + star.x * focalX * previousDepth;
        const previousY = centerY + star.y * focalY * previousDepth;

        if (
          currentX < -width * 0.3
          || currentX > width * 1.3
          || currentY < -height * 0.3
          || currentY > height * 1.3
        ) {
          if (travelling) respawnStar(star, index);
          continue;
        }

        const temperature = STAR_TEMPERATURES[star.temperature];
        const accentMix = travelling ? Math.min(0.42, travelProgress * 0.42) : 0.08;
        const red = Math.round(temperature[0] * (1 - accentMix) + accentRgb[0] * accentMix);
        const green = Math.round(temperature[1] * (1 - accentMix) + accentRgb[1] * accentMix);
        const blue = Math.round(temperature[2] * (1 - accentMix) + accentRgb[2] * accentMix);
        const twinkle = 0.72 + Math.sin(now * 0.0017 + star.phase) * 0.2;
        const alpha = Math.min(1, star.luminosity * twinkle * (0.5 + depth * 0.3));
        const radius = Math.min(4.6, star.size * Math.max(0.7, depth * 0.58));

        if (travelling) {
          const stretch = 1 + Math.pow(travelProgress, 2.2) * 15;
          const tailX = previousX - (currentX - previousX) * stretch;
          const tailY = previousY - (currentY - previousY) * stretch;
          const gradient = context.createLinearGradient(tailX, tailY, currentX, currentY);
          gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0)`);
          gradient.addColorStop(0.72, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.62})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);
          context.strokeStyle = gradient;
          context.lineWidth = Math.max(0.5, radius * (0.56 + travelProgress * 0.44));
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(currentX, currentY);
          context.stroke();
        } else {
          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
          context.shadowColor = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.72})`;
          context.shadowBlur = radius > 1.5 ? radius * 4.4 : 0;
          context.beginPath();
          context.arc(currentX, currentY, radius, 0, Math.PI * 2);
          context.fill();

          if (!lowEffects && radius > 1.7) {
            context.shadowBlur = 0;
            context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.34})`;
            context.lineWidth = 0.55;
            context.beginPath();
            context.moveTo(currentX - radius * 4.6, currentY);
            context.lineTo(currentX + radius * 4.6, currentY);
            context.moveTo(currentX, currentY - radius * 3.2);
            context.lineTo(currentX, currentY + radius * 3.2);
            context.stroke();
          }
        }
      }

      context.shadowBlur = 0;
      context.globalCompositeOperation = "source-over";
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [accent, lowEffects, travelDurationMs, travelSerial, travelling]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
