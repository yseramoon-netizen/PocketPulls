"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#02030d] font-sans text-white">
        <main className="grid min-h-screen place-items-center px-5 py-16">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#090b27] p-7 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/50">
              Ancient Pulls
            </p>
            <h1 className="mt-3 text-2xl font-black">Something went wrong</h1>
            <p className="mt-2 text-sm font-semibold text-white/45">
              Your account is safe. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 min-h-12 w-full rounded-xl bg-[#cffafe] px-5 text-sm font-black text-[#08152d]"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
