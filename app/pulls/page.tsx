"use client";

import { useMemo, useState } from "react";
import CardReveal from "@/components/CardReveal";
import PullHistory from "@/components/PullHistory";
import PullMachine from "@/components/PullMachine";
import PullStats from "@/components/PullStats";

export default function PullsPage() {
  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready to open a pull");
  const [card, setCard] = useState<any>(null);

  const history = useMemo(
    () => [
      { id: "1", name: "Shaymin EX", rarity: "Secret Rare", value: 84.5, created_at: "2m ago" },
      { id: "2", name: "Pikachu VMAX", rarity: "Ultra Rare", value: 42.0, created_at: "12m ago" },
    ],
    []
  );

  async function handleOpenPull() {
    setOpening(true);
    setProgress(0);
    setCard(null);
    setStage("🌲 Searching the forest...");

    const steps = [
      { label: "🌲 Searching the forest...", progress: 20 },
      { label: "✨ Something is moving...", progress: 45 },
      { label: "🌟 Rare energy detected...", progress: 75 },
      { label: "🎴 Discovery complete!", progress: 100 },
    ];

    for (const step of steps) {
      setStage(step.label);
      setProgress(step.progress);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setCard({
      name: "Shaymin EX",
      rarity: "Secret Rare",
      image_url: "/ancient-pulls/celestial-cat.png",
      market_value: 84.5,
    });
    setOpening(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(135deg,_#f8fff9,_#ffffff,_#f5f3ff)] px-6 py-10 text-emerald-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2.5rem] border border-emerald-200 bg-white/80 p-8 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">Ancient Pulls</p>
          <h1 className="mt-2 text-4xl font-black">Pull experience</h1>
          <p className="mt-3 max-w-2xl text-sm text-emerald-700">
            A polished pack opening flow with animated reveal, stats, and recent pull history.
          </p>
        </header>

        <button
          onClick={handleOpenPull}
          className="w-fit rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700"
        >
          {opening ? "Opening..." : "Open a pull"}
        </button>

        <PullMachine opening={opening} stage={stage} progress={progress} />

        <PullStats cost={5} totalValue={84.5} bestPull={{ name: "Shaymin EX", value: 84.5 }} count={2} />

        {card && <CardReveal card={card} />}

        <PullHistory items={history} />
      </div>
    </main>
  );
}
