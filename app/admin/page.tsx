"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import { adminFetch } from "@/lib/admin/client-auth";
import {
  getShayminMood,
  SHAYMIN_MOOD_KEYS,
  type ShayminMoodKey,
} from "@/lib/admin/shaymin-moods";

type MoodResponse = {
  ok: true;
  viewer: {
    email: string;
    name: string;
  };
  mood: {
    key: ShayminMoodKey;
    label: string;
    whisper: string;
    reason: string;
    mode: "automatic" | "manual";
    note: string;
    updatedBy: string;
    updatedAt: string | null;
    recommendedKey: ShayminMoodKey;
  };
  tree: {
    stage: string;
    stageIndex: number;
    growthScore: number;
    stageProgress: number;
    stockCards: number;
    trainers: number;
    cardsFound: number;
    availableWishes: number;
    wishesSpent: number;
    valueShared: number;
    cardsPlantedToday: number;
    wishesToday: number;
    bothActiveThisWeek: boolean;
  };
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, value),
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const moment =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
  return `${moment}, ${name}`;
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
    <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/35">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-white/35">
        {detail}
      </p>
    </article>
  );
}

export default function AdminHomePage() {
  const [data, setData] =
    useState<MoodResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showPalette, setShowPalette] =
    useState(false);
  const [petCount, setPetCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await adminFetch<MoodResponse>(
          "/api/admin/shaymin",
        );
      setData(response);
      setNote(response.mood.note);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Shaymin could not read the garden today.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMood(
    mode: "automatic" | "manual",
    mood?: ShayminMoodKey,
  ) {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const response =
        await adminFetch<MoodResponse>(
          "/api/admin/shaymin",
          {
            method: "POST",
            body: JSON.stringify({
              mode,
              mood,
              note,
            }),
          },
        );

      setData(response);
      setNote(response.mood.note);
      setShowPalette(false);

      window.dispatchEvent(
        new CustomEvent(
          "pocketpulls:shaymin-mood",
          {
            detail: {
              mood: response.mood.key,
            },
          },
        ),
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Shaymin's mood could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const mood = getShayminMood(
    data?.mood.key,
  );

  const pulseMessage = useMemo(() => {
    if (!data) return "Listening to the roots...";
    if (data.tree.wishesToday > 0) {
      return `${data.tree.wishesToday} wish${
        data.tree.wishesToday === 1 ? "" : "es"
      } found a home today.`;
    }
    if (data.tree.cardsPlantedToday > 0) {
      return `${data.tree.cardsPlantedToday} cards were planted today.`;
    }
    if (data.tree.bothActiveThisWeek) {
      return "Both keeper branches have touched the garden this week.";
    }
    return "The garden is quiet, steady and waiting for your next small step.";
  }, [data]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[12%] top-28 h-80 w-80 rounded-full bg-lime-300/8 blur-[120px]" />
        <div className="absolute right-[8%] top-52 h-96 w-96 rounded-full bg-cyan-300/7 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="relative mt-6 overflow-hidden rounded-[2.8rem] border border-emerald-100/15 bg-[#071f16]/88 shadow-[0_40px_140px_rgba(0,0,0,0.38)] backdrop-blur-3xl">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${mood.aura}`} />
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lime-200/10 blur-[100px]" />

          <div className="relative grid min-h-[34rem] gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_32rem] lg:items-center lg:p-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-100/45">
                The living heart of Shaymin operations
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
                {data
                  ? greeting(data.viewer.name)
                  : "Shaymin is waking up..."}
              </h1>

              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-emerald-50/58">
                {data?.mood.whisper ||
                  "Reading the cards, wishes and roots that keep PocketPulls alive."}
              </p>

              <div className="mt-6 inline-flex max-w-2xl items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm font-semibold leading-6 text-white/45">
                <span className="mt-0.5 text-lime-100">✦</span>
                <span>
                  <strong className="text-white/72">Why this mood:</strong>{" "}
                  {data?.mood.reason || "Shaymin is still listening."}
                </span>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowPalette((value) => !value)}
                  disabled={loading || saving}
                  className="min-h-12 rounded-2xl border border-lime-100/20 bg-lime-200/[0.1] px-5 text-sm font-black text-lime-50 transition hover:bg-lime-200/[0.16] disabled:opacity-45"
                >
                  Choose Shaymin's mood
                </button>

                <button
                  type="button"
                  onClick={() => void saveMood("automatic")}
                  disabled={loading || saving}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/62 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-45"
                >
                  Let the garden decide
                </button>
              </div>

              <p className="mt-5 text-xs font-bold text-white/25">
                Press and hold the small Shaymin in the navigation to enter The Tree We Grow.
              </p>
            </div>

            <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
              <div className="absolute h-80 w-80 animate-pulse rounded-full bg-emerald-200/10 blur-[70px]" />
              <button
                type="button"
                onClick={() => setPetCount((value) => value + 1)}
                className="group relative h-[24rem] w-full max-w-[24rem] overflow-hidden rounded-[3rem] border border-emerald-100/18 bg-black/12 shadow-[0_30px_100px_rgba(0,0,0,0.34),inset_0_0_70px_rgba(110,231,183,0.05)] outline-none focus-visible:ring-2 focus-visible:ring-lime-200"
                aria-label="Give Shaymin a little pat"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${mood.aura}`} />
                <img
                  src={mood.image}
                  alt={mood.label}
                  draggable={false}
                  className="relative h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.03] group-active:scale-95"
                />

                {Array.from({ length: Math.min(8, petCount) }).map((_, index) => (
                  <span
                    key={`${petCount}-${index}`}
                    className="pointer-events-none absolute animate-bounce text-xl"
                    style={{
                      left: `${15 + ((index * 19) % 70)}%`,
                      top: `${10 + ((index * 17) % 65)}%`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  >
                    {index % 3 === 0 ? "♡" : index % 3 === 1 ? "✦" : "❀"}
                  </span>
                ))}

                <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-[#061810]/82 px-4 py-3 text-left backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-100/45">
                    {mood.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white/55">
                    {petCount > 0
                      ? `${petCount} tiny pat${petCount === 1 ? "" : "s"}. Shaymin approves.`
                      : "Tap for a tiny pat."}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>

        {showPalette ? (
          <section className="mt-5 rounded-[2.4rem] border border-emerald-100/15 bg-[#071c14]/92 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-3xl sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-100/42">
                  Shared mood garden
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
                  How should Shaymin feel?
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/40">
                  A manual mood is shared between you and Skye. Switch back to automatic whenever you want the business itself to choose.
                </p>
              </div>

              <label className="block w-full max-w-xl">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                  A note from either keeper
                </span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 180))}
                  placeholder="Today felt like..."
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/18 px-4 text-sm font-bold text-white outline-none placeholder:text-white/22 focus:border-lime-100/35"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {SHAYMIN_MOOD_KEYS.map((key) => {
                const option = getShayminMood(key);
                const active = data?.mood.key === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void saveMood("manual", key)}
                    disabled={saving}
                    className={`group flex min-h-28 items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-40 ${
                      active
                        ? "border-lime-100/35 bg-lime-200/[0.11]"
                        : "border-white/10 bg-white/[0.035] hover:border-emerald-100/20 hover:bg-white/[0.065]"
                    }`}
                  >
                    <span className="h-16 w-16 flex-none overflow-hidden rounded-2xl border border-white/10 bg-black/15">
                      <img
                        src={option.image}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-white">
                        {option.label}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[0.65rem] font-semibold leading-4 text-white/32">
                        {option.whisper}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="The tree today"
            value={data?.tree.stage || "Reading the rings"}
            detail={`${data?.tree.stageProgress || 0}% toward the next chapter.`}
          />
          <Metric
            label="Cards in the roots"
            value={formatNumber(data?.tree.stockCards || 0)}
            detail={`${formatNumber(data?.tree.cardsPlantedToday || 0)} planted today.`}
          />
          <Metric
            label="Trainers beneath it"
            value={formatNumber(data?.tree.trainers || 0)}
            detail={`${formatNumber(data?.tree.cardsFound || 0)} cards have found a home.`}
          />
          <Metric
            label="Value shared"
            value={formatMoney(data?.tree.valueShared || 0)}
            detail={`${formatNumber(data?.tree.availableWishes || 0)} wishes are currently waiting.`}
          />
        </section>

        <section className="mt-6 rounded-[2.2rem] border border-white/10 bg-[#071b14]/78 p-6 backdrop-blur-2xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100/35">
            Garden pulse
          </p>
          <p className="mt-3 text-xl font-black text-white">
            {pulseMessage}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/35">
            Shaymin now changes with the time of day, new wishes, recent card planting, shared keeper activity and the growth of PocketPulls itself.
          </p>
        </section>
      </div>
    </main>
  );
}
