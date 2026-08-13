"use client";

import { useEffect, useRef } from "react";
import { ZODIAC_SHAPES, type ZodiacSign } from "@/lib/player/zodiac-constellations";

export type DuatConstellation = {
  zodiacSign: string | null;
  stars: Array<{ id: string; cardId: string; rarity: string; marketValue: number }>;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function random(seed: number) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function starColour(rarity: string) {
  const name = rarity.toLowerCase();
  if (name.includes("secret") || name.includes("hyper") || name.includes("special")) return "#ffe59a";
  if (name.includes("illustration") || name.includes("rainbow") || name.includes("ultra")) return "#d6b4ff";
  if (name.includes("rare") || name.includes("ex") || name.includes("v")) return "#8dd7ff";
  return "#f3f1e8";
}

function isZodiac(value: string | null): value is ZodiacSign {
  return Boolean(value && value in ZODIAC_SHAPES);
}

export default function DuatConstellationBackdrop({ constellation }: { constellation: DuatConstellation }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.clearRect(0, 0, width, height);

      const stars = constellation.stars.slice(-420);
      const shape = isZodiac(constellation.zodiacSign) ? ZODIAC_SHAPES[constellation.zodiacSign] : null;
      const cx = width * 0.62;
      const cy = height * 0.47;
      const scale = Math.min(width, height) * 0.0062;
      const points = shape?.points.map((point) => ({ x: cx + (point.x - 50) * scale, y: cy + (point.y - 50) * scale })) || [];

      if (shape && points.length) {
        context.strokeStyle = "rgba(211, 174, 255, .24)";
        context.lineWidth = 1;
        context.beginPath();
        for (const [from, to] of shape.segments) {
          context.moveTo(points[from].x, points[from].y);
          context.lineTo(points[to].x, points[to].y);
        }
        context.stroke();
      }

      const ordered = [...stars].sort((a, b) => b.marketValue - a.marketValue);
      ordered.forEach((star, index) => {
        const seed = random(hash(`${star.id}:${star.cardId}`));
        const anchored = points[index];
        const x = anchored ? anchored.x : width * (0.12 + seed() * 0.8);
        const y = anchored ? anchored.y : height * (0.12 + seed() * 0.76);
        const size = anchored ? 2.6 + Math.min(4, Math.log10(star.marketValue + 1)) : 0.65 + seed() * 1.35;
        const colour = starColour(star.rarity);
        context.save();
        context.shadowBlur = anchored ? 16 : 5;
        context.shadowColor = colour;
        context.fillStyle = colour;
        context.globalAlpha = anchored ? 0.92 : 0.44;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      if (!stars.length) {
        const seed = random(hash(constellation.zodiacSign || "duat"));
        context.fillStyle = "rgba(243, 241, 232, .3)";
        for (let index = 0; index < 60; index += 1) {
          context.fillRect(width * seed(), height * seed(), 1, 1);
        }
      }
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [constellation]);

  return <div className="duat-player-constellation" aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
