"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import {
  AdminClientError,
  adminFetch,
} from "@/lib/admin/client-auth";

type TestPullCard = {
  testId: string;
  sequence: number;
  inventoryId: string;
  cardId: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  marketValue: number;
  imageUrl: string | null;
  finish: string;
  stockSnapshot: number;
  location: string;
};

type TestPullResponse = {
  ok: true;
  mode: "read_only_test";
  inventoryChanged: false;
  adminEmail: string;
  pulledAt: string;
  results: TestPullCard[];
};

function formatMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    Number.isFinite(value)
      ? value
      : 0,
  );
}

function formatFinish(
  finish: string,
): string {
  if (
    finish === "reverse_holo"
  ) {
    return "Reverse Holo";
  }

  if (finish === "holo") {
    return "Holo";
  }

  return "Normal";
}

function rarityClass(
  rarity: string,
): string {
  const value =
    rarity.toLowerCase();

  if (
    value.includes(
      "special illustration",
    ) ||
    value.includes("hyper") ||
    value.includes("secret")
  ) {
    return "border-fuchsia-200/30 bg-fuchsia-300/15 text-fuchsia-50";
  }

  if (
    value.includes("ultra") ||
    value.includes(
      "illustration rare",
    )
  ) {
    return "border-violet-200/30 bg-violet-300/15 text-violet-50";
  }

  if (
    value.includes(
      "double rare",
    )
  ) {
    return "border-indigo-200/30 bg-indigo-300/15 text-indigo-50";
  }

  if (
    value.includes("rare") ||
    value.includes("holo")
  ) {
    return "border-cyan-200/30 bg-cyan-300/15 text-cyan-50";
  }

  if (
    value.includes(
      "uncommon",
    )
  ) {
    return "border-emerald-200/25 bg-emerald-300/12 text-emerald-50";
  }

  return "border-white/15 bg-white/[0.07] text-white/70";
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return "The test pull could not be completed.";
}

export default function AdminPullsPage() {
  const [
    pullCount,
    setPullCount,
  ] = useState(1);

  const [
    pulling,
    setPulling,
  ] = useState(false);

  const [
    results,
    setResults,
  ] = useState<TestPullCard[]>(
    [],
  );

  const [
    sessionEmail,
    setSessionEmail,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    needsSignIn,
    setNeedsSignIn,
  ] = useState(false);

  const totalValue =
    useMemo(
      () =>
        results.reduce(
          (
            total,
            card,
          ) =>
            total +
            card.marketValue,
          0,
        ),
      [results],
    );

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const response =
          await adminFetch<{
            ok: true;
            admin: {
              email: string;
            };
          }>(
            "/api/admin/session",
          );

        if (active) {
          setSessionEmail(
            response.admin.email,
          );
          setNeedsSignIn(false);
        }
      } catch (
        sessionError: unknown
      ) {
        if (!active) {
          return;
        }

        setError(
          getErrorMessage(
            sessionError,
          ),
        );

        setNeedsSignIn(
          sessionError instanceof
            AdminClientError &&
            (
              sessionError.status ===
                401 ||
              sessionError.status ===
                403
            ),
        );
      }
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, []);

  async function runTestPull() {
    if (pulling) {
      return;
    }

    setPulling(true);
    setError("");
    setNeedsSignIn(false);

    try {
      const response =
        await adminFetch<TestPullResponse>(
          "/api/admin/test-pull",
          {
            method: "POST",
            body: JSON.stringify({
              count: pullCount,
            }),
          },
        );

      if (
        response.inventoryChanged !==
          false ||
        response.mode !==
          "read_only_test"
      ) {
        throw new Error(
          "The server did not confirm read-only test mode.",
        );
      }

      setSessionEmail(
        response.adminEmail,
      );

      setResults(
        response.results,
      );
    } catch (
      pullError: unknown
    ) {
      console.error(
        "Read-only test pull error:",
        pullError,
      );

      setError(
        getErrorMessage(
          pullError,
        ),
      );

      setNeedsSignIn(
        pullError instanceof
          AdminClientError &&
          (
            pullError.status ===
              401 ||
            pullError.status ===
              403
          ),
      );
    } finally {
      setPulling(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#052e16] to-[#064e3b] px-4 pb-28 pt-4 text-white md:px-8 md:pt-8">
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-52 top-20 h-[38rem] w-[38rem] rounded-full bg-emerald-400/10 blur-[140px]" />
        <div className="absolute -right-52 top-12 h-[40rem] w-[40rem] rounded-full bg-cyan-300/10 blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        <header className="relative mt-8 overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/[0.08] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-3xl md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-cyan-400/[0.05]" />

          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-50">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,1)]" />
                Read-only test sandbox
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] md:text-6xl">
                Shaymin Test
                <span className="text-cyan-200">
                  {" "}
                  Pull Chamber
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-emerald-50/70 md:text-lg">
                Preview weighted pull results from the current stock pool without removing cards, changing quantities, spending wallets or creating permanent pull history.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100/15 bg-black/20 px-5 py-4 text-sm backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
                Admin session
              </p>

              <p className="mt-2 font-black text-emerald-100">
                {sessionEmail ||
                  "Checking..."}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-7 grid gap-7 xl:grid-cols-[0.72fr_1.28fr]">
          <article className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-white/[0.075] p-6 backdrop-blur-3xl md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-300/10 blur-[80px]" />

            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/45">
                Test controls
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Choose a batch
              </h2>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[1, 5, 10].map(
                  (count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() =>
                        setPullCount(
                          count,
                        )
                      }
                      disabled={pulling}
                      className={`min-h-14 rounded-2xl border text-lg font-black transition ${
                        pullCount ===
                        count
                          ? "border-cyan-100/35 bg-cyan-200 text-cyan-950 shadow-[0_0_30px_rgba(165,243,252,0.15)]"
                          : "border-white/10 bg-black/20 text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {count}
                    </button>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  void runTestPull()
                }
                disabled={
                  pulling ||
                  needsSignIn
                }
                className="mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border border-emerald-100/25 bg-emerald-300 px-6 text-lg font-black text-emerald-950 shadow-[0_0_45px_rgba(110,231,183,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pulling ? (
                  <>
                    <span className="animate-spin">
                      ◌
                    </span>
                    Reading the test pool
                  </>
                ) : (
                  <>
                    Run {pullCount} test
                    {pullCount === 1
                      ? " pull"
                      : " pulls"}
                    <span>✦</span>
                  </>
                )}
              </button>

              <div className="mt-5 rounded-2xl border border-amber-100/15 bg-amber-300/[0.07] p-4">
                <p className="font-black text-amber-50">
                  Inventory protection active
                </p>

                <p className="mt-2 text-xs font-semibold leading-6 text-amber-50/55">
                  The server endpoint contains SELECT queries only. Repeating this test cannot lower physical quantities or award cards to a player.
                </p>
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-400/10 px-5 py-4 text-sm font-bold leading-6 text-red-50">
                  {error}

                  {needsSignIn ? (
                    <Link
                      href="/admin/sign-in?next=/admin/pulls"
                      className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-red-100 px-4 text-xs font-black text-red-950"
                    >
                      Sign in as admin
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {results.length ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <SmallStat
                    label="Test cards"
                    value={String(
                      results.length,
                    )}
                  />

                  <SmallStat
                    label="Preview value"
                    value={formatMoney(
                      totalValue,
                    )}
                  />
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-[2.25rem] border border-white/15 bg-white/[0.075] p-5 backdrop-blur-3xl md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/45">
                  Temporary results
                </p>

                <h2 className="mt-3 text-2xl font-black">
                  Sandbox reveal
                </h2>
              </div>

              {results.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setResults([])
                  }
                  className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-4 text-xs font-black text-white/55 hover:bg-white/10 hover:text-white"
                >
                  Clear screen
                </button>
              ) : null}
            </div>

            {!results.length ? (
              <div className="mt-8 flex min-h-[28rem] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/12 bg-black/15 px-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-cyan-100/15 bg-cyan-300/[0.07] text-4xl">
                  ✦
                </div>

                <h3 className="mt-5 text-xl font-black">
                  No test pull yet
                </h3>

                <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/35">
                  Results exist only inside this browser view. Refreshing or clearing the screen removes them.
                </p>
              </div>
            ) : (
              <div className="mt-7 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {results.map(
                  (card) => (
                    <TestCard
                      key={
                        card.testId
                      }
                      card={card}
                    />
                  ),
                )}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function TestCard({
  card,
}: {
  card: TestPullCard;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-black/20 shadow-[0_25px_70px_rgba(0,0,0,0.28)]">
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            🎴
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full border border-amber-100/20 bg-amber-300/90 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-950">
          Test only
        </div>
      </div>

      <div className="p-5">
        <h3 className="truncate text-lg font-black">
          {card.name}
        </h3>

        <p className="mt-1 truncate text-xs font-semibold text-white/40">
          {card.setName}
          {card.cardNumber
            ? ` · #${card.cardNumber}`
            : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-black ${rarityClass(
              card.rarity,
            )}`}
          >
            {card.rarity}
          </span>

          <span className="rounded-full border border-emerald-100/15 bg-emerald-300/[0.07] px-2.5 py-1 text-[0.65rem] font-black text-emerald-50">
            {formatFinish(
              card.finish,
            )}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/25">
              Preview value
            </p>

            <p className="mt-1 font-black text-emerald-200">
              {formatMoney(
                card.marketValue,
              )}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/25">
              Stock unchanged
            </p>

            <p className="mt-1 font-black text-cyan-100">
              {card.stockSnapshot}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
