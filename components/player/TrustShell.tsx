import Link from "next/link";
import type { ReactNode } from "react";

import {
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  LEGAL_LAST_UPDATED,
  supportLabel,
} from "@/lib/player/legal";

const LINKS = [
  { href: "/help", label: "Player Guide" },
  { href: "/how-wishes-work", label: "How Wishes Work" },
  { href: "/odds", label: "Live Odds" },
  { href: "/rules", label: "Rules" },
  { href: "/player-protection", label: "Player Protection" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/returns", label: "Returns" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
] as const;

const NEW_TAB_LINKS = new Set([
  "/rules",
  "/player-protection",
  "/terms",
  "/returns",
  "/privacy",
]);

export function TrustShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[1080px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#080b20]/90 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="border-b border-white/[0.08] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/wishes"
              className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-black text-white/55 transition hover:bg-white/[0.08] hover:text-white"
            >
              ← Wishes
            </Link>
            <span className="rounded-full border border-cyan-100/15 bg-cyan-100/[0.06] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.15em] text-cyan-50/65">
              {eyebrow}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            {title}
          </h1>

          {intro ? (
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/48">
              {intro}
            </p>
          ) : null}
        </div>

        <div className="grid gap-0 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav className="border-b border-white/10 bg-black/10 p-3 lg:border-b-0 lg:border-r lg:p-4">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
              {LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={NEW_TAB_LINKS.has(item.href) ? "_blank" : undefined}
                  rel={NEW_TAB_LINKS.has(item.href) ? "noreferrer" : undefined}
                  className="whitespace-nowrap rounded-xl border border-transparent px-3 py-2.5 text-xs font-black text-white/45 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white lg:whitespace-normal"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="min-w-0 p-5 sm:p-7">{children}</div>
        </div>
      </div>

      <footer className="px-2 py-5 text-center text-[0.68rem] font-semibold leading-5 text-white/28">
        <p>
          {BUSINESS_NAME} is an independent reseller and is not affiliated with,
          sponsored by or endorsed by Nintendo, The Pokémon Company or Game Freak.
        </p>
        <p className="mt-1">
          Pokémon and related names and marks belong to their respective owners. · Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="mt-1">
          Support: {supportLabel()}
          {BUSINESS_ADDRESS ? ` · ${BUSINESS_ADDRESS}` : ""}
        </p>
      </footer>
    </section>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/[0.07] py-6 first:pt-0 last:border-0 last:pb-0">
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm font-semibold leading-7 text-white/52">
        {children}
      </div>
    </section>
  );
}

export function CompactList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-2 pl-5 marker:text-cyan-200/45">{children}</ul>;
}

export function InfoCallout({
  title,
  children,
  tone = "cyan",
}: {
  title: string;
  children: ReactNode;
  tone?: "cyan" | "yellow" | "red" | "emerald";
}) {
  const classes = {
    cyan: "border-cyan-200/15 bg-cyan-200/[0.05] text-cyan-50/70",
    yellow: "border-yellow-200/15 bg-yellow-200/[0.05] text-yellow-50/75",
    red: "border-red-200/15 bg-red-300/[0.05] text-red-50/75",
    emerald: "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-50/75",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em]">{title}</p>
      <div className="mt-2 text-sm font-semibold leading-6">{children}</div>
    </div>
  );
}
