import Link from "next/link";

import { TrustShell } from "@/components/player/TrustShell";

const CARDS = [
  {
    href: "/how-wishes-work",
    glyph: "✦",
    title: "How Wishes Work",
    body: "From buying wishes to the card landing in your collection.",
  },
  {
    href: "/odds",
    glyph: "％",
    title: "Live Odds",
    body: "See the current rarity mix in the physical wish pool.",
  },
  {
    href: "/rules",
    glyph: "◆",
    title: "Rules",
    body: "The short rules that apply every time you make a wish.",
  },
  {
    href: "/player-protection",
    glyph: "◇",
    title: "Player Protection",
    body: "How random purchases, failures, payments and records are handled.",
  },
  {
    href: "/faq",
    glyph: "?",
    title: "FAQ",
    body: "Quick answers about pulls, duplicates, shipping, trades and payments.",
  },
  {
    href: "/terms",
    glyph: "▤",
    title: "Terms",
    body: "The full terms for using ancientpulls and purchasing wishes.",
  },
] as const;

export default function HelpPage() {
  return (
    <TrustShell
      eyebrow="Player guide"
      title="Everything you need, without the fine-print maze."
      intro="Wishes are random physical-card purchases. The important rules, live odds and protections are kept here in plain English."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-100/20 hover:bg-white/[0.055]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-100/[0.06] text-lg font-black text-cyan-50/80">
              {card.glyph}
            </span>
            <h2 className="mt-4 text-lg font-black text-white">{card.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/42">
              {card.body}
            </p>
          </Link>
        ))}
      </div>
    </TrustShell>
  );
}
