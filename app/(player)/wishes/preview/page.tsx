"use client";

import { useMemo, useState } from "react";

import WishCinematic, {
  type WishRevealCard,
  getWishRarityTheme,
} from "@/components/player/WishCinematic";

const DEMO_CARDS: WishRevealCard[] = [
  {
    id: "common-preview",
    name: "Pikachu",
    rarity: "Common",
    setName: "Ancient Pulls Preview",
    cardNumber: "001",
    marketValue: 0.12,
  },
  {
    id: "uncommon-preview",
    name: "Ivysaur",
    rarity: "Uncommon",
    setName: "Ancient Pulls Preview",
    cardNumber: "002",
    marketValue: 0.28,
  },
  {
    id: "rare-preview",
    name: "Gengar",
    rarity: "Rare Holo",
    setName: "Ancient Pulls Preview",
    cardNumber: "003",
    marketValue: 1.45,
  },
  {
    id: "double-preview",
    name: "Mew ex",
    rarity: "Double Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "004",
    marketValue: 3.8,
  },
  {
    id: "ultra-preview",
    name: "Charizard ex",
    rarity: "Ultra Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "005",
    marketValue: 18.4,
  },
  {
    id: "illustration-preview",
    name: "Eevee",
    rarity: "Illustration Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "006",
    marketValue: 11.25,
  },
  {
    id: "special-preview",
    name: "Greninja ex",
    rarity: "Special Illustration Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "007",
    marketValue: 79.5,
  },
  {
    id: "hyper-preview",
    name: "Golden Arceus",
    rarity: "Hyper Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "008",
    marketValue: 125,
  },
  {
    id: "crown-preview",
    name: "Wishmaker Jirachi",
    rarity: "Crown Rare",
    setName: "Ancient Pulls Preview",
    cardNumber: "009",
    marketValue: 500,
  },
];

export default function WishPreviewPage() {
  const [selectedIndex, setSelectedIndex] =
    useState(6);

  const [open, setOpen] = useState(false);
  const [runNumber, setRunNumber] = useState(0);

  const selectedCard = useMemo(() => {
    const card = DEMO_CARDS[selectedIndex];

    return {
      ...card,
      id: `${card.id}-${runNumber}`,
    };
  }, [selectedIndex, runNumber]);

  function playPreview(index: number) {
    setSelectedIndex(index);
    setRunNumber((current) => current + 1);
    setOpen(true);
  }

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/85 p-6 backdrop-blur-xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
          Final cinematic laboratory
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Ancient Pulls Wish Ceremony
        </h1>

        <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
          Nebu performs first, then the falling star carries the
          card into its reveal. Common ceremonies take about four
          seconds, while Crown Rare builds to roughly ten. Test
          every rarity here before a real wish. The current pacing is
          deliberately relaxed so every Nebu pose has time to read.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_CARDS.map((card, index) => {
            const theme = getWishRarityTheme(
              card.rarity,
            );

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => playPreview(index)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div
                  className="absolute inset-y-0 left-0 w-1"
                  style={{
                    background: theme.primary,
                  }}
                />

                <p
                  className="text-[0.6rem] font-black uppercase tracking-[0.16em]"
                  style={{
                    color: theme.primary,
                  }}
                >
                  Tier {theme.tier}
                </p>

                <h2 className="mt-2 text-lg font-black text-white">
                  {theme.label}
                </h2>

                <p className="mt-2 text-sm font-semibold text-white/35">
                  {card.name}
                </p>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-white/35">
                    Play full ceremony
                  </span>

                  <span
                    className="h-3 w-3 rounded-full transition group-hover:scale-125"
                    style={{
                      background: theme.primary,
                      boxShadow: `0 0 18px ${theme.glow}`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <WishCinematic
        open={open}
        card={selectedCard}
        allowSkip
        respectPreferences={false}
        onFinished={() => {
          console.log(
            "Ancient Pulls wish ceremony completed.",
          );
        }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
