"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import UnknownPullsBackdrop from "@/components/player/UnknownPullsBackdrop";
import UnownText from "@/components/player/UnownText";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  storyTitle = "ancientpulls",
  storyDescription =
    "Real Pokemon cards wait within a living constellation of wishes, memories and ancient symbols.",
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  storyTitle?: string;
  storyDescription?: string;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#040617] px-4 py-10 text-white sm:px-6">
      <UnknownPullsBackdrop />

      <section className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-[#080a24]/90 shadow-[0_45px_150px_rgba(0,0,0,0.72)] backdrop-blur-2xl lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(145deg,rgba(14,16,52,0.94),rgba(12,29,52,0.9)_48%,rgba(42,18,54,0.9))] p-7 lg:flex lg:min-h-[44rem] lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:p-10">
          <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-cyan-300/12 blur-[105px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-pink-300/10 blur-[105px]" />
          <div className="pointer-events-none absolute inset-5 rounded-[1.4rem] border border-yellow-100/[0.07]" />

          <div className="relative">
            <Link href="/sign-in" className="inline-flex items-center gap-3">
              <div className="relative grid h-20 w-20 place-items-center">
                <div className="absolute inset-3 rounded-full bg-cyan-200/12 blur-2xl" />
                <img
                  src="/ancient-pulls/celestial-cat.webp"
                  alt=""
                  draggable={false}
                  className="relative h-16 w-16 object-contain opacity-90 drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div>
                <UnownText
                  text="ANCIENT PULLS"
                  translation="ancientpulls"
                  size="1.15rem"
                  tone="holo"
                  wrap={false}
                />
              </div>
            </Link>

            <div className="mt-10 hidden lg:block">
              <UnownText
                text={storyTitle}
                translation={storyTitle}
                size="2.25rem"
                tone="ancient"
              />

              <p className="mt-6 max-w-md text-sm font-semibold leading-7 text-white/48">
                {storyDescription}
              </p>
            </div>
          </div>

          <div className="relative mt-7 hidden grid-cols-3 gap-3 lg:grid">
            <StoryStat value="Real" label="Cards" />
            <StoryStat value="Living" label="Sky" />
            <StoryStat value="Yours" label="Collection" />
          </div>
        </aside>

        <div className="relative p-6 sm:p-9 lg:p-12">
          <div className="pointer-events-none absolute right-6 top-6 h-28 w-28 rounded-full bg-violet-400/[0.06] blur-3xl" />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/45">
              {eyebrow}
            </p>

            <div className="mt-4">
              <UnownText
                text={title}
                translation={title}
                size="2.15rem"
                tone="moon"
              />
            </div>

            <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/44">
              {description}
            </p>

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-white/10 pt-6">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function StoryStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-white/30">
        {label}
      </p>
    </div>
  );
}
