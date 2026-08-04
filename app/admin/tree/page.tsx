"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import {
  adminFetch,
} from "@/lib/admin/client-auth";

type Branch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
};

type TreeResponse = {
  ok: true;
  viewerEmail: string;
  generatedAt: string;
  tree: {
    stage: string;
    growthScore: number;
    stockCards: number;
    trainers: number;
    cardsFound: number;
    availableWishes: number;
    wishesSpent: number;
    valueShared: number;
    sharedCards: number;
    branches: Branch[];
  };
};

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
  ).format(
    Math.max(0, value),
  );
}

function formatMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    },
  ).format(
    Math.max(0, value),
  );
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "No planting recorded yet";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Planting date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-emerald-100/12 bg-[#092219]/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-2xl">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/38">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold leading-5 text-white/40">
        {detail}
      </p>
    </article>
  );
}

function BranchCard({
  branch,
  index,
}: {
  branch: Branch;
  index: number;
}) {
  const isFirst = index === 0;

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-emerald-100/14 bg-gradient-to-br from-[#0a2a1d]/95 via-[#0b241b]/92 to-[#071812]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
      <div
        className={[
          "pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl",
          isFirst
            ? "bg-lime-300/12"
            : "bg-pink-300/10",
        ].join(" ")}
      />

      <div className="relative flex items-start gap-4">
        <div
          className={[
            "flex h-14 w-14 flex-none items-center justify-center rounded-2xl border text-2xl",
            isFirst
              ? "border-lime-100/20 bg-lime-300/10"
              : "border-pink-100/20 bg-pink-300/10",
          ].join(" ")}
        >
          {isFirst ? "🌱" : "🌸"}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/35">
            Keeper of a branch
          </p>

          <h2 className="mt-1 truncate text-2xl font-black text-white">
            {branch.name}
          </h2>

          <p className="mt-1 truncate text-xs font-semibold text-white/32">
            {branch.email}
          </p>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <p className="text-xs font-black text-white/35">
            Cards planted
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-100">
            {formatNumber(
              branch.cardsPlanted,
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <p className="text-xs font-black text-white/35">
            Planting sessions
          </p>
          <p className="mt-2 text-2xl font-black text-cyan-100">
            {formatNumber(
              branch.plantingSessions,
            )}
          </p>
        </div>
      </div>

      <p className="relative mt-4 text-xs font-semibold text-white/35">
        Last contribution: {formatDate(
          branch.lastPlantedAt,
        )}
      </p>
    </article>
  );
}

export default function TreePage() {
  const [data, setData] =
    useState<TreeResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadTree = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await adminFetch<TreeResponse>(
            "/api/admin/tree",
          );

        setData(response);
      } catch (
        loadError: unknown
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The shared tree could not be measured.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const tree = data?.tree;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-32 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-lime-300/8 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        <header className="relative mt-8 overflow-hidden rounded-[2.75rem] border border-emerald-100/15 bg-[#082219]/88 p-7 shadow-[0_35px_120px_rgba(0,0,0,0.35)] backdrop-blur-3xl sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-300/10 blur-[90px]" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-100/45">
                Lukas &amp; Skye · shared stewardship
              </p>

              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl">
                The Tree We Grow
              </h1>

              <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-emerald-50/55 sm:text-base">
                Not a wallet. This is the living record of what you and Skye
                are building together: every card planted, every trainer
                reached, and every wish that leaves the forest as something
                real.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadTree()
              }
              disabled={loading}
              className="min-h-12 rounded-2xl border border-emerald-100/18 bg-emerald-200/[0.08] px-5 text-sm font-black text-emerald-50 transition hover:bg-emerald-200/[0.14] disabled:opacity-45"
            >
              {loading
                ? "Reading the rings..."
                : "Refresh the tree"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {tree ? (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Canopy stage"
                value={tree.stage}
                detail={`${formatNumber(
                  tree.growthScore,
                )} growth rings across the whole project.`}
              />

              <Metric
                label="Cards in the roots"
                value={formatNumber(
                  tree.stockCards,
                )}
                detail="Physical stock currently supporting future pulls."
              />

              <Metric
                label="Trainers beneath it"
                value={formatNumber(
                  tree.trainers,
                )}
                detail="Player profiles now connected to the forest."
              />

              <Metric
                label="Value already shared"
                value={formatMoney(
                  tree.valueShared,
                )}
                detail={`${formatNumber(
                  tree.cardsFound,
                )} cards have already found a trainer.`}
              />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              {tree.branches.map(
                (branch, index) => (
                  <BranchCard
                    key={branch.email}
                    branch={branch}
                    index={index}
                  />
                ),
              )}
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[2.25rem] border border-emerald-100/14 bg-[#071d15]/88 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.25)] backdrop-blur-3xl sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100/38">
                  What the roots are holding
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
                    <p className="text-xs font-bold text-white/38">
                      Shared planting
                    </p>
                    <p className="mt-2 text-3xl font-black text-lime-100">
                      {formatNumber(
                        tree.sharedCards,
                      )}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-white/30">
                      Older or unassigned stock belonging to both branches.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
                    <p className="text-xs font-bold text-white/38">
                      Wishes waiting
                    </p>
                    <p className="mt-2 text-3xl font-black text-cyan-100">
                      {formatNumber(
                        tree.availableWishes,
                      )}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-white/30">
                      Wishes currently held by trainers across the site.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
                    <p className="text-xs font-bold text-white/38">
                      Wishes fulfilled
                    </p>
                    <p className="mt-2 text-3xl font-black text-pink-100">
                      {formatNumber(
                        tree.wishesSpent,
                      )}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-white/30">
                      The lifetime number of wishes spent by trainers.
                    </p>
                  </div>
                </div>
              </article>

              <aside className="relative overflow-hidden rounded-[2.25rem] border border-lime-100/16 bg-gradient-to-br from-lime-300/[0.09] via-[#0a251a]/92 to-[#071811]/95 p-7 shadow-[0_25px_90px_rgba(0,0,0,0.25)]">
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-lime-300/12 blur-[80px]" />

                <p className="relative text-xs font-black uppercase tracking-[0.2em] text-lime-100/45">
                  The promise behind it
                </p>

                <p className="relative mt-5 text-2xl font-black leading-tight text-white">
                  Two keepers. One tree. Every branch feeds the same future.
                </p>

                <p className="relative mt-5 text-sm font-semibold leading-7 text-white/48">
                  The point is not which of you planted more. The point is that
                  Lukas and Skye can see the thing you are growing together get
                  stronger, one real operation at a time.
                </p>
              </aside>
            </section>
          </>
        ) : loading ? (
          <section className="mt-6 rounded-[2.25rem] border border-emerald-100/12 bg-[#071d15]/80 p-12 text-center backdrop-blur-3xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-100/15 border-t-lime-200" />
            <p className="mt-5 font-black text-white/55">
              Reading the tree rings...
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
