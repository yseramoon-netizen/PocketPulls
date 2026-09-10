"use client";

import Link from "next/link";
import Image from "next/image";
import {
  type ReactNode,
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

type LabTier = {
  rarityTier: string;
  displayName: string;
  weight: number;
  sortOrder: number;
  enabled: boolean;
  cardsInPool: number;
};

type LabConfigResponse = {
  ok: true;
  mode: "read_only_test";
  inventoryChanged: false;
  adminEmail: string;
  maxSimulationPulls: number;
  tiers: LabTier[];
  pool: {
    totalCards: number;
    brokenCardLinks: number;
  };
};

type DistributionRow = {
  rarityTier: string;
  displayName: string;
  enabled: boolean;
  configuredWeight: number;
  targetPercent: number;
  expectedCount: number;
  actualCount: number;
  observedPercent: number;
  variancePoints: number;
  cardsInPool: number;
};

type SampleCard = {
  testId: string;
  sequence: number;
  cardId: string;
  rarityTier: string;
  name: string;
  setName: string;
  cardNumber: string;
  printedRarity: string;
  imageUrl: string | null;
  brokenLink: boolean;
};

type SimulationResponse = {
  ok: true;
  mode: "read_only_test";
  inventoryChanged: false;
  adminEmail: string;
  simulatedAt: string;
  inputs: {
    count: number;
    pricePerWish: number;
    chaseCardSpend: number;
    sourcingSpend: number;
    configuredWeightTotal: number;
  };
  analytics: {
    revenue: number;
    chaseCardSpend: number;
    sourcingSpend: number;
    totalCost: number;
    grossProfit: number;
    grossMarginPercent: number;
    returnOnCostPercent: number;
    costPerWish: number;
    breakEvenWishPrice: number;
    breakEvenWishCount: number;
    brokenPulls: number;
  };
  distribution: DistributionRow[];
  samples: SampleCard[];
  pool: {
    totalCards: number;
    brokenCardLinks: number;
  };
  warnings: string[];
};

type SaveOddsResponse = {
  ok: true;
  action: "save_odds";
  adminEmail: string;
  tiers: LabTier[];
  savedAt: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "The Wish Lab request could not be completed.";
}

function toneForProfit(value: number): string {
  return value >= 0 ? "text-emerald-200" : "text-red-200";
}

export default function AdminPullsPage() {
  const [pullCount, setPullCount] = useState(1000);
  const [pricePerWish, setPricePerWish] = useState(0.5);
  const [chaseCardSpend, setChaseCardSpend] = useState(500);
  const [sourcingSpend, setSourcingSpend] = useState(0);
  const [tiers, setTiers] = useState<LabTier[]>([]);
  const [poolCards, setPoolCards] = useState(0);
  const [brokenPoolLinks, setBrokenPoolLinks] = useState(0);
  const [maxPulls, setMaxPulls] = useState(100000);
  const [sessionEmail, setSessionEmail] = useState("");
  const [oddsReason, setOddsReason] = useState("");
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const enabledWeightTotal = useMemo(
    () =>
      tiers
        .filter((tier) => tier.enabled)
        .reduce((sum, tier) => sum + tier.weight, 0),
    [tiers],
  );

  const forecast = useMemo(() => {
    const revenue = Math.max(0, pullCount) * Math.max(0, pricePerWish);
    const totalCost =
      Math.max(0, chaseCardSpend) + Math.max(0, sourcingSpend);
    const profit = revenue - totalCost;

    return {
      revenue,
      totalCost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      roi: totalCost > 0 ? (profit / totalCost) * 100 : 0,
      costPerWish: pullCount > 0 ? totalCost / pullCount : 0,
      breakEvenWishCount:
        pricePerWish > 0 ? Math.ceil(totalCost / pricePerWish) : 0,
    };
  }, [chaseCardSpend, pricePerWish, pullCount, sourcingSpend]);

  useEffect(() => {
    let active = true;

    async function loadLab() {
      setLoading(true);
      setError("");

      try {
        const response = await adminFetch<LabConfigResponse>(
          "/api/admin/test-pull",
        );

        if (!active) {
          return;
        }

        setSessionEmail(response.adminEmail);
        setTiers(response.tiers);
        setPoolCards(response.pool.totalCards);
        setBrokenPoolLinks(response.pool.brokenCardLinks);
        setMaxPulls(response.maxSimulationPulls);
        setNeedsSignIn(false);
      } catch (loadError: unknown) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
        setNeedsSignIn(
          loadError instanceof AdminClientError &&
            (loadError.status === 401 || loadError.status === 403),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLab();

    return () => {
      active = false;
    };
  }, []);

  function changeTier(
    rarityTier: string,
    update: Partial<Pick<LabTier, "weight" | "enabled">>,
  ) {
    setTiers((current) =>
      current.map((tier) =>
        tier.rarityTier === rarityTier ? { ...tier, ...update } : tier,
      ),
    );
    setSuccess("");
  }

  function balanceOdds() {
    const active = tiers.filter((tier) => tier.enabled);
    const total = active.reduce((sum, tier) => sum + tier.weight, 0);

    if (!active.length) {
      setError("Enable at least one rarity before balancing the odds.");
      return;
    }

    setError("");
    setTiers((current) =>
      current.map((tier, index) => {
        if (!tier.enabled) {
          return tier;
        }

        if (total <= 0) {
          const equal = 100 / active.length;
          return { ...tier, weight: equal };
        }

        const normalized = (tier.weight / total) * 100;
        const isLastEnabled =
          tier.rarityTier === active[active.length - 1].rarityTier;

        if (!isLastEnabled) {
          return { ...tier, weight: Math.round(normalized * 10000) / 10000 };
        }

        const earlierTotal = current
          .slice(0, index)
          .filter((candidate) => candidate.enabled)
          .reduce(
            (sum, candidate) =>
              sum +
              Math.round(((candidate.weight / total) * 100) * 10000) / 10000,
            0,
          );

        return {
          ...tier,
          weight: Math.max(0.0001, 100 - earlierTotal),
        };
      }),
    );
  }

  async function runSimulation() {
    if (running || saving || !tiers.length) {
      return;
    }

    setRunning(true);
    setError("");
    setSuccess("");

    try {
      const response = await adminFetch<SimulationResponse>(
        "/api/admin/test-pull",
        {
          method: "POST",
          body: JSON.stringify({
            action: "simulate",
            count: pullCount,
            pricePerWish,
            chaseCardSpend,
            sourcingSpend,
            tiers: tiers.map((tier) => ({
              rarityTier: tier.rarityTier,
              weight: tier.weight,
              enabled: tier.enabled,
            })),
          }),
        },
      );

      if (
        response.mode !== "read_only_test" ||
        response.inventoryChanged !== false
      ) {
        throw new Error("The server did not confirm read-only simulation mode.");
      }

      setResult(response);
      setSessionEmail(response.adminEmail);
      setPoolCards(response.pool.totalCards);
      setBrokenPoolLinks(response.pool.brokenCardLinks);
      setNeedsSignIn(false);
      setSuccess(
        `${formatNumber(response.inputs.count)} wishes simulated without changing inventory or any player account.`,
      );
    } catch (simulationError: unknown) {
      setError(getErrorMessage(simulationError));
      setNeedsSignIn(
        simulationError instanceof AdminClientError &&
          (simulationError.status === 401 || simulationError.status === 403),
      );
    } finally {
      setRunning(false);
    }
  }

  async function saveLiveOdds() {
    if (saving || running || !tiers.length) {
      return;
    }

    if (Math.abs(enabledWeightTotal - 100) > 0.01) {
      setError(
        `Live rarity chances must total 100%. They currently total ${enabledWeightTotal.toFixed(2)}%.`,
      );
      return;
    }

    if (oddsReason.trim().length < 5) {
      setError("Add a short audit reason before changing the live wish odds.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await adminFetch<SaveOddsResponse>(
        "/api/admin/test-pull",
        {
          method: "POST",
          body: JSON.stringify({
            action: "save_odds",
            reason: oddsReason.trim(),
            tiers: tiers.map((tier) => ({
              rarityTier: tier.rarityTier,
              weight: tier.weight,
              enabled: tier.enabled,
            })),
          }),
        },
      );

      setTiers(response.tiers);
      setSessionEmail(response.adminEmail);
      setOddsReason("");
      setSuccess(
        "Live player rarity odds saved. New wishes now use these values.",
      );
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError));
      setNeedsSignIn(
        saveError instanceof AdminClientError &&
          (saveError.status === 401 || saveError.status === 403),
      );
    } finally {
      setSaving(false);
    }
  }

  const analytics = result?.analytics;
  const displayedRevenue = analytics?.revenue ?? forecast.revenue;
  const displayedTotalCost = analytics?.totalCost ?? forecast.totalCost;
  const displayedProfit = analytics?.grossProfit ?? forecast.profit;
  const displayedMargin = analytics?.grossMarginPercent ?? forecast.margin;
  const displayedRoi = analytics?.returnOnCostPercent ?? forecast.roi;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03120d] px-4 pb-28 pt-4 text-white md:px-8 md:pt-8">
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(52,211,153,0.18),transparent_32%),radial-gradient(circle_at_88%_16%,rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.94),rgba(3,58,43,0.86),rgba(2,30,24,0.94))]" />

      <div className="relative z-10 mx-auto max-w-[1700px]">
        <AdminNav />

        <header className="mt-7 overflow-hidden rounded-[2.5rem] border border-emerald-100/20 bg-[#071f18]/90 p-6 shadow-[0_36px_110px_rgba(0,0,0,0.4)] backdrop-blur-3xl md:p-9">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/25 bg-cyan-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-50">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(165,243,252,0.9)]" />
                Exact live wish engine · read-only tests
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white md:text-6xl">
                Shaymin <span className="text-cyan-200">Wish Lab</span>
              </h1>

              <p className="mt-4 max-w-4xl text-base font-semibold leading-7 text-emerald-50/75 md:text-lg">
                Stress-test up to {formatNumber(maxPulls)} wishes at once, inspect
                rarity accuracy and campaign profit, then adjust the same rarity
                weights used by real player wishes. Financial results use only
                your chase-card and sourcing spend. Simulations never spend
                wishes, award cards, alter stock or create pull history.
              </p>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
              <HeaderStat label="Admin" value={sessionEmail || "Checking..."} />
              <HeaderStat label="Pool cards" value={formatNumber(poolCards)} />
              <HeaderStat
                label="Pool health"
                value={brokenPoolLinks ? `${brokenPoolLinks} broken` : "Healthy"}
                danger={brokenPoolLinks > 0}
              />
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200/30 bg-red-500/15 px-5 py-4 font-bold text-red-50">
            {error}
            {needsSignIn ? (
              <Link
                href="/admin/sign-in"
                className="ml-3 inline-flex rounded-lg bg-red-100 px-3 py-1.5 text-xs font-black text-red-950"
              >
                Sign in again
              </Link>
            ) : null}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-2xl border border-emerald-100/25 bg-emerald-300/12 px-5 py-4 font-bold text-emerald-50">
            {success}
          </div>
        ) : null}

        <section className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
          <div className="space-y-7">
            <LabPanel
              eyebrow="Simulation controls"
              title="Run any-sized pull test"
              description="Enter the complete cost of the chase card and the complete cost of sourcing every other card for this campaign. Individual card values never affect profit."
            >
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Number of wishes">
                  <input
                    type="number"
                    min="1"
                    max={maxPulls}
                    step="1"
                    value={pullCount}
                    onChange={(event) =>
                      setPullCount(
                        Math.max(
                          1,
                          Math.min(
                            maxPulls,
                            Math.floor(toNumber(event.target.value) || 1),
                          ),
                        ),
                      )
                    }
                    className="min-h-14 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-lg font-black text-white outline-none focus:border-cyan-200/50"
                  />
                </Field>

                <Field label="Average price per wish">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-100/70">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="0.01"
                      value={pricePerWish}
                      onChange={(event) =>
                        setPricePerWish(
                          Math.max(0, Math.min(10000, toNumber(event.target.value))),
                        )
                      }
                      className="min-h-14 w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-4 text-lg font-black text-white outline-none focus:border-cyan-200/50"
                    />
                  </div>
                </Field>

                <Field label="Chase card spend">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-yellow-100/70">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      value={chaseCardSpend}
                      onChange={(event) =>
                        setChaseCardSpend(
                          Math.max(
                            0,
                            Math.min(1000000, toNumber(event.target.value)),
                          ),
                        )
                      }
                      className="min-h-14 w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-4 text-lg font-black text-white outline-none focus:border-yellow-200/50"
                    />
                  </div>
                </Field>

                <Field label="Other cards sourcing spend">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-100/70">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      value={sourcingSpend}
                      onChange={(event) =>
                        setSourcingSpend(
                          Math.max(
                            0,
                            Math.min(1000000, toNumber(event.target.value)),
                          ),
                        )
                      }
                      className="min-h-14 w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-4 text-lg font-black text-white outline-none focus:border-emerald-200/50"
                    />
                  </div>
                </Field>
              </div>

              <p className="mt-3 rounded-xl border border-emerald-100/15 bg-emerald-200/[0.06] px-4 py-3 text-xs font-bold leading-5 text-emerald-50/70">
                Sourced the bulk for free? Leave sourcing spend at £0. The Wish
                Lab treats both amounts as total one-off costs for this entire
                simulation, not a cost per wish.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[10, 100, 1000, 10000, 100000]
                  .filter((amount) => amount <= maxPulls)
                  .map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPullCount(amount)}
                      className={`min-h-10 rounded-xl border px-4 text-sm font-black transition ${
                        pullCount === amount
                          ? "border-cyan-100/45 bg-cyan-100 text-cyan-950"
                          : "border-white/15 bg-white/[0.06] text-white/75 hover:bg-white/[0.1]"
                      }`}
                    >
                      {formatNumber(amount)}
                    </button>
                  ))}
              </div>

              <button
                type="button"
                disabled={loading || running || saving || !tiers.length}
                onClick={() => void runSimulation()}
                className="mt-6 min-h-14 w-full rounded-2xl border border-cyan-100/30 bg-cyan-100 px-5 text-base font-black text-cyan-950 shadow-[0_16px_45px_rgba(34,211,238,0.14)] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {running
                  ? `Simulating ${formatNumber(pullCount)} wishes...`
                  : `Simulate ${formatNumber(pullCount)} wishes`}
              </button>

              <p className="mt-3 text-center text-xs font-bold leading-5 text-white/45">
                Safe mode: SELECT-only simulation. No wallets, cards, stock or
                fulfilment records are changed.
              </p>
            </LabPanel>

            <LabPanel
              eyebrow="Live probability controls"
              title="Set player rarity odds"
              description="These are live values. Saving them changes which rarity future player wishes receive; it does not change the chance of individual cards within that rarity."
            >
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/25 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">
                    Enabled total
                  </p>
                  <p
                    className={`mt-1 text-2xl font-black ${
                      Math.abs(enabledWeightTotal - 100) <= 0.01
                        ? "text-emerald-200"
                        : "text-red-200"
                    }`}
                  >
                    {enabledWeightTotal.toFixed(2)}%
                  </p>
                </div>

                <button
                  type="button"
                  onClick={balanceOdds}
                  className="min-h-11 rounded-xl border border-emerald-100/25 bg-emerald-200/10 px-4 text-sm font-black text-emerald-50 hover:bg-emerald-200/15"
                >
                  Balance to 100%
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="rounded-2xl border border-white/10 bg-black/20 p-5 font-bold text-white/55">
                    Loading the live rarity table...
                  </p>
                ) : (
                  tiers.map((tier) => (
                    <article
                      key={tier.rarityTier}
                      className={`rounded-2xl border p-4 ${
                        tier.enabled
                          ? "border-white/15 bg-white/[0.055]"
                          : "border-white/8 bg-black/20 opacity-65"
                      }`}
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-white">
                              {tier.displayName}
                            </p>
                            {tier.cardsInPool === 0 ? (
                              <span className="rounded-full border border-red-200/25 bg-red-400/10 px-2 py-1 text-[0.65rem] font-black text-red-100">
                                Empty pool
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-bold text-white/50">
                            {formatNumber(tier.cardsInPool)} cards in this rarity pool
                          </p>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            min="0.0001"
                            max="100"
                            step="0.01"
                            value={tier.weight}
                            disabled={!tier.enabled}
                            aria-label={`${tier.displayName} chance percent`}
                            onChange={(event) =>
                              changeTier(tier.rarityTier, {
                                weight: Math.max(
                                  0.0001,
                                  Math.min(100, toNumber(event.target.value)),
                                ),
                              })
                            }
                            className="min-h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 pr-8 text-right font-black text-white outline-none focus:border-cyan-200/45 disabled:opacity-40"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-white/45">
                            %
                          </span>
                        </div>

                        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/20 px-3 text-xs font-black text-white/65 sm:justify-center">
                          <span className="sm:hidden">Enabled</span>
                          <input
                            type="checkbox"
                            checked={tier.enabled}
                            onChange={(event) =>
                              changeTier(tier.rarityTier, {
                                enabled: event.target.checked,
                              })
                            }
                            className="h-5 w-5 accent-emerald-300"
                          />
                        </label>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-200"
                          style={{
                            width: `${Math.min(
                              100,
                              tier.enabled ? tier.weight : 0,
                            )}%`,
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>

              <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-white/50">
                Required audit reason
              </label>
              <input
                value={oddsReason}
                onChange={(event) => setOddsReason(event.target.value)}
                placeholder="Why are the live odds changing?"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 font-bold text-white outline-none placeholder:text-white/25 focus:border-yellow-200/45"
              />

              <button
                type="button"
                disabled={
                  loading ||
                  saving ||
                  running ||
                  Math.abs(enabledWeightTotal - 100) > 0.01 ||
                  oddsReason.trim().length < 5
                }
                onClick={() => void saveLiveOdds()}
                className="mt-4 min-h-13 w-full rounded-2xl border border-yellow-100/30 bg-yellow-200 px-5 font-black text-yellow-950 transition hover:-translate-y-0.5 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving live odds..." : "Save odds to the live wish system"}
              </button>
            </LabPanel>
          </div>

          <div className="space-y-7 xl:sticky xl:top-5">
            <LabPanel
              eyebrow={result ? "Observed simulation" : "Expected forecast"}
              title={
                result
                  ? `${formatNumber(result.inputs.count)}-wish result`
                  : `${formatNumber(pullCount)}-wish forecast`
              }
              description={
                result
                  ? "Observed results from the most recent test. Run larger samples to reduce normal random variance."
                  : "A live campaign forecast using the chase-card spend and sourcing spend entered on the left."
              }
            >
              <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                <Metric
                  label="Wish revenue"
                  value={formatMoney(displayedRevenue)}
                  detail={`${formatMoney(
                    result?.inputs.pricePerWish ?? pricePerWish,
                  )} × ${formatNumber(result?.inputs.count ?? pullCount)}`}
                />
                <Metric
                  label="Total campaign cost"
                  value={formatMoney(displayedTotalCost)}
                  detail={`${formatMoney(
                    analytics?.chaseCardSpend ?? chaseCardSpend,
                  )} chase + ${formatMoney(
                    analytics?.sourcingSpend ?? sourcingSpend,
                  )} sourcing`}
                />
                <Metric
                  label="Gross profit"
                  value={formatMoney(displayedProfit)}
                  detail="Revenue minus total campaign cost"
                  valueClass={toneForProfit(displayedProfit)}
                />
                <Metric
                  label="Gross margin"
                  value={formatPercent(displayedMargin)}
                  detail="Profit ÷ revenue"
                  valueClass={toneForProfit(displayedMargin)}
                />
                <Metric
                  label="ROI on total cost"
                  value={formatPercent(displayedRoi)}
                  detail="Profit ÷ chase and sourcing spend"
                  valueClass={toneForProfit(displayedRoi)}
                />
                <Metric
                  label="Break-even wish price"
                  value={formatMoney(
                    analytics?.breakEvenWishPrice ?? forecast.costPerWish,
                  )}
                  detail="Total cost ÷ wishes simulated"
                />
                <Metric
                  label="Break-even wishes"
                  value={formatNumber(
                    analytics?.breakEvenWishCount ?? forecast.breakEvenWishCount,
                  )}
                  detail="Wishes needed to recover total cost"
                />
                {analytics ? (
                  <>
                    <Metric
                      label="Broken outcomes"
                      value={formatNumber(analytics.brokenPulls)}
                      detail="Missing master-card links"
                      valueClass={
                        analytics.brokenPulls > 0 ? "text-red-200" : "text-emerald-200"
                      }
                    />
                  </>
                ) : null}
              </div>

              {result?.warnings.length ? (
                <div className="mt-5 space-y-2 rounded-2xl border border-yellow-100/25 bg-yellow-200/[0.08] p-4">
                  {result.warnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-sm font-bold leading-6 text-yellow-50"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </LabPanel>

            <LabPanel
              eyebrow="Probability check"
              title="Target odds versus observed pulls"
              description="Expected count is mathematical. Observed count is the random test result; small tests naturally move around more."
            >
              <div className="mt-5 overflow-x-auto rounded-2xl border border-white/15">
                <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead className="bg-black/35 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/55">
                    <tr>
                      <th className="px-4 py-3">Rarity</th>
                      <th className="px-4 py-3 text-right">Target</th>
                      <th className="px-4 py-3 text-right">Expected</th>
                      <th className="px-4 py-3 text-right">Observed</th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3 text-right">Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result?.distribution ||
                      tiers.map((tier) => {
                        const activeWeight = tiers
                          .filter(
                            (candidate) =>
                              candidate.enabled && candidate.cardsInPool > 0,
                          )
                          .reduce((sum, candidate) => sum + candidate.weight, 0);
                        const targetPercent =
                          tier.enabled && tier.cardsInPool > 0 && activeWeight > 0
                            ? (tier.weight / activeWeight) * 100
                            : 0;

                        return {
                          rarityTier: tier.rarityTier,
                          displayName: tier.displayName,
                          enabled: tier.enabled,
                          configuredWeight: tier.weight,
                          targetPercent,
                          expectedCount: (targetPercent / 100) * pullCount,
                          actualCount: 0,
                          observedPercent: 0,
                          variancePoints: 0,
                          cardsInPool: tier.cardsInPool,
                        };
                      })).map((row) => (
                      <tr
                        key={row.rarityTier}
                        className="border-t border-white/10 bg-white/[0.035] text-sm font-bold text-white/75"
                      >
                        <td className="px-4 py-3 font-black text-white">
                          {row.displayName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatPercent(row.targetPercent)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatNumber(row.expectedCount, 1)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {result
                            ? `${formatNumber(row.actualCount)} (${formatPercent(
                                row.observedPercent,
                              )})`
                            : "Run test"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            result && Math.abs(row.variancePoints) > 1
                              ? "text-yellow-100"
                              : "text-white/55"
                          }`}
                        >
                          {result
                            ? `${row.variancePoints >= 0 ? "+" : ""}${row.variancePoints.toFixed(2)} pts`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatNumber(row.cardsInPool)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LabPanel>

            {result?.samples.length ? (
              <LabPanel
                eyebrow="Result sample"
                title={`First ${result.samples.length} simulated cards`}
                description="Large tests return aggregated analytics and only this small visual sample, keeping Shaymin fast even at 100,000 wishes."
              >
                <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {result.samples.map((card) => (
                    <article
                      key={card.testId}
                      className={`overflow-hidden rounded-2xl border p-3 ${
                        card.brokenLink
                          ? "border-red-200/30 bg-red-400/10"
                          : "border-white/15 bg-white/[0.045]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-24 w-[4.25rem] flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
                          {card.imageUrl ? (
                            <Image
                              src={card.imageUrl}
                              alt={card.name}
                              width={68}
                              height={96}
                              unoptimized
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-2xl">🎴</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-cyan-100/65">
                            Pull #{card.sequence}
                          </p>
                          <p className="mt-1 line-clamp-2 font-black text-white">
                            {card.name}
                          </p>
                          <p className="mt-1 truncate text-xs font-bold text-white/50">
                            {card.setName}
                            {card.cardNumber ? ` · ${card.cardNumber}` : ""}
                          </p>
                          <p className="mt-2 font-black text-emerald-200">
                            Value excluded from profit calculations
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </LabPanel>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function HeaderStat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-black/25 px-4 py-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-black ${
          danger ? "text-red-200" : "text-emerald-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LabPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-[2.1rem] border border-white/15 bg-[#071c16]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-3xl md:p-7">
      <p className="text-[0.67rem] font-black uppercase tracking-[0.18em] text-cyan-100/70">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
        {description}
      </p>
      {children}
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.13em] text-white/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  detail: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-white/45">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black tracking-tight ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-bold text-white/45">{detail}</p>
    </div>
  );
}
