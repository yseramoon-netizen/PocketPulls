export default function PlayerLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <div className="h-3 w-24 animate-pulse rounded-full bg-cyan-100/10" />
      <div className="mt-3 h-10 w-64 max-w-full animate-pulse rounded-xl bg-white/[0.07]" />
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]"
          />
        ))}
      </div>
      <div className="mt-5 h-72 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
      <p className="sr-only">Loading your account</p>
    </main>
  );
}
