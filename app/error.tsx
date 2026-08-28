"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-5 py-16 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#090b27]/90 p-7 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/45">
          Ancient Pulls
        </p>
        <h1 className="mt-3 text-2xl font-black">This page couldn’t load</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/45">
          Check your connection, then try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-12 w-full rounded-xl bg-cyan-100 px-5 text-sm font-black text-[#08152d] transition hover:bg-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
