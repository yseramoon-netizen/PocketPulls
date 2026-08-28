"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import AsterismSigil from "@/components/player/AsterismSigil";
import NebuPortrait from "@/components/player/NebuPortrait";
import { NEBU_SKIN_CHANGE_EVENT } from "@/lib/player/nebu";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-nebu-skin"],
  });
  window.addEventListener(NEBU_SKIN_CHANGE_EVENT, onChange);

  return () => {
    observer.disconnect();
    window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): boolean {
  return document.documentElement.dataset.nebuSkin === "cosmic_nebu";
}

function getServerSnapshot(): boolean {
  return false;
}

export default function CosmicNebuNexus({
  trainerName,
}: {
  trainerName: string;
}) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!active) return null;

  return (
    <section
      data-cosmic-hq-nexus
      aria-label="Cosmic Nebu mode"
      className="relative mt-6 min-h-52 overflow-hidden rounded-2xl border border-cyan-100/20 bg-[linear-gradient(120deg,rgba(7,18,62,.96),rgba(57,17,92,.82)_64%,rgba(5,30,66,.88))] p-6 shadow-[0_24px_75px_rgba(36,18,92,.24)] sm:p-8"
    >
      <AsterismSigil
        seed={`cosmic-hq:${trainerName}`}
        points={9}
        className="pointer-events-none absolute -right-4 -top-14 w-72 rotate-12 text-cyan-100/20"
      />
      <div className="relative z-10 max-w-lg pr-20 sm:pr-28">
        <p className="text-[0.61rem] font-black uppercase tracking-[0.2em] text-cyan-100/55">
          Numbered form active
        </p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          Cosmic Mode
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/48">
          Cosmic Nebu now shapes the site and every wish reveal.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/wishes" className="flex min-h-11 items-center rounded-xl bg-cyan-100 px-4 text-xs font-black text-[#07132e]">
            Make a wish
          </Link>
          <Link href="/constellation" className="flex min-h-11 items-center rounded-xl border border-white/12 bg-white/[0.06] px-4 text-xs font-black text-white/70">
            Constellation
          </Link>
        </div>
      </div>
      <NebuPortrait
        alt="Cosmic Nebu"
        draggable={false}
        className="absolute -bottom-8 right-1 z-10 h-48 w-48 object-contain sm:-bottom-12 sm:right-5 sm:h-64 sm:w-64"
      />
    </section>
  );
}
