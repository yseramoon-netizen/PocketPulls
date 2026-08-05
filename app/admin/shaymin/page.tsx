"use client";

import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import { adminFetch } from "@/lib/admin/client-auth";
import {
  SHAYMIN_SNACKS,
  type ShayminActionKey,
  type ShayminMoodDefinition,
  type ShayminSnackKey,
} from "@/lib/admin/shaymin-care";
import styles from "./care.module.css";

type CareState = {
  affection: number;
  fullness: number;
  energy: number;
  comfort: number;
  lastAction: string;
  lastItem: string;
  lastActorName: string;
  lastActorEmail: string;
  lastActionAt: string | null;
  updatedAt: string | null;
};

type CareEvent = {
  id: string;
  action: ShayminActionKey;
  item: string;
  note: string;
  actorName: string;
  actorEmail: string;
  affectionDelta: number;
  fullnessDelta: number;
  energyDelta: number;
  comfortDelta: number;
  createdAt: string;
};

type CareResponse = {
  ok: true;
  viewer: {
    email: string;
    name: string;
  };
  mood: ShayminMoodDefinition & {
    reason: string;
  };
  state: CareState;
  summary: {
    totalCare: number;
    todayCareCount: number;
    careStreak: number;
    bothCaredToday: boolean;
    favouriteSnack: ShayminSnackKey | null;
    bondLevel: number;
    bondTitle: string;
    bondProgress: number;
    dailySecret: string;
  };
  recentEvents: CareEvent[];
  tree: {
    growthScore: number;
    wishesToday: number;
    cardsPlantedToday: number;
    bothActiveThisWeek: boolean;
  };
};

type Particle = {
  id: number;
  symbol: string;
  left: number;
  top: number;
  size: number;
  delay: number;
};

type Reaction =
  | "pat"
  | "feed"
  | "play"
  | "nap"
  | "groom"
  | "talk"
  | "boop"
  | null;

const ACTION_COPY: Record<
  ShayminActionKey,
  {
    label: string;
    icon: string;
    message: string;
  }
> = {
  pat: {
    label: "Pat",
    icon: "♡",
    message: "A tiny happy wiggle followed the pat.",
  },
  feed: {
    label: "Feed",
    icon: "❧",
    message: "The snack inspection was extremely thorough.",
  },
  play: {
    label: "Play",
    icon: "✦",
    message: "A very serious game has begun.",
  },
  groom: {
    label: "Brush leaves",
    icon: "❀",
    message: "Every leaf is sitting perfectly again.",
  },
  nap: {
    label: "Tuck in",
    icon: "☾",
    message: "The care room has become wonderfully quiet.",
  },
  talk: {
    label: "Talk",
    icon: "…",
    message: "Your words were tucked safely beneath the flowers.",
  },
  boop: {
    label: "Boop",
    icon: "•",
    message: "One tiny nose boop. Completely worth it.",
  },
  cheer: {
    label: "Keeper cape",
    icon: "✧",
    message: "The official keeper-on-duty outfit is ready.",
  },
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.round(value)),
  );
}

function formatRelative(timestamp: string): string {
  const time = new Date(timestamp).getTime();

  if (!Number.isFinite(time)) {
    return "recently";
  }

  const seconds = Math.max(
    0,
    Math.round((Date.now() - time) / 1000),
  );

  if (seconds < 45) {
    return "just now";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function eventSentence(event: CareEvent): string {
  if (event.action === "feed") {
    const snack =
      event.item in SHAYMIN_SNACKS
        ? SHAYMIN_SNACKS[event.item as ShayminSnackKey].label
        : "a snack";

    return `${event.actorName} shared ${snack}.`;
  }

  if (event.action === "talk") {
    return event.note
      ? `${event.actorName}: “${event.note}”`
      : `${event.actorName} stayed for a quiet conversation.`;
  }

  if (event.action === "cheer") {
    const keeper =
      event.item === "skye" ? "Skye" : "Lukas";
    return `${event.actorName} called for ${keeper}'s keeper cape.`;
  }

  const sentences: Record<
    Exclude<ShayminActionKey, "feed" | "talk" | "cheer">,
    string
  > = {
    pat: `${event.actorName} gave a gentle pat.`,
    play: `${event.actorName} started a little game.`,
    groom: `${event.actorName} brushed every leaf into place.`,
    nap: `${event.actorName} tucked the garden guardian in.`,
    boop: `${event.actorName} performed one tiny nose boop.`,
  };

  return sentences[event.action];
}

function reactionClass(reaction: Reaction): string {
  if (reaction === "pat") return styles.reactPat;
  if (reaction === "feed") return styles.reactFeed;
  if (reaction === "play") return styles.reactPlay;
  if (reaction === "nap") return styles.reactNap;
  if (reaction === "groom") return styles.reactGroom;
  if (reaction === "talk") return styles.reactTalk;
  if (reaction === "boop") return styles.reactBoop;
  return "";
}

function Meter({
  label,
  value,
  icon,
  detail,
  fill,
}: {
  label: string;
  value: number;
  icon: string;
  detail: string;
  fill: string;
}) {
  const safeValue = clampPercent(value);

  return (
    <article className="rounded-[1.45rem] border border-white/10 bg-black/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            {icon}
          </span>
          <p className="text-[0.64rem] font-black uppercase tracking-[0.17em] text-white/45">
            {label}
          </p>
        </div>
        <p className="text-sm font-black text-white">
          {safeValue}
        </p>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/30">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fill} transition-[width] duration-700`}
          style={{ width: `${safeValue}%` }}
        />
      </div>

      <p className="mt-2 text-[0.66rem] font-semibold leading-5 text-white/28">
        {detail}
      </p>
    </article>
  );
}

function ActionButton({
  action,
  detail,
  onClick,
  disabled,
  emphasis = false,
}: {
  action: ShayminActionKey;
  detail: string;
  onClick: () => void;
  disabled: boolean;
  emphasis?: boolean;
}) {
  const copy = ACTION_COPY[action];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group min-h-20 rounded-[1.4rem] border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        emphasis
          ? "border-pink-100/20 bg-gradient-to-br from-pink-300/[0.12] to-white/[0.035] hover:border-pink-100/35 hover:from-pink-300/[0.18]"
          : "border-white/10 bg-white/[0.035] hover:border-emerald-100/20 hover:bg-white/[0.065]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/18 text-lg text-white transition group-hover:scale-105">
          {copy.icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-white">
            {copy.label}
          </span>
          <span className="mt-1 block text-[0.66rem] font-semibold leading-5 text-white/30">
            {detail}
          </span>
        </span>
      </div>
    </button>
  );
}

function LoadingPanel() {
  return (
    <section className="mt-6 rounded-[2.8rem] border border-emerald-100/15 bg-[#071d15]/88 p-10 text-center shadow-[0_40px_140px_rgba(0,0,0,0.38)] backdrop-blur-3xl">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-emerald-100/15 border-t-lime-200" />
      <p className="mt-5 text-sm font-black text-emerald-50/70">
        Opening the little care room...
      </p>
    </section>
  );
}

export default function ShayminCarePage() {
  const [data, setData] =
    useState<CareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] =
    useState<ShayminActionKey | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [reaction, setReaction] =
    useState<Reaction>(null);
  const [particles, setParticles] =
    useState<Particle[]>([]);
  const [flyingSnack, setFlyingSnack] =
    useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const particleIdRef = useRef(0);
  const reactionTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await adminFetch<CareResponse>(
          "/api/admin/shaymin",
        );
      setData(response);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The care room could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(
      () => void load(),
      90_000,
    );

    return () => {
      window.clearInterval(timer);

      if (reactionTimerRef.current !== null) {
        window.clearTimeout(reactionTimerRef.current);
      }

      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [load]);

  function showToast(message: string) {
    setToast(message);

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(
      () => setToast(""),
      3200,
    );
  }

  function startReaction(nextReaction: Reaction) {
    setReaction(null);

    window.requestAnimationFrame(() => {
      setReaction(nextReaction);
    });

    if (reactionTimerRef.current !== null) {
      window.clearTimeout(reactionTimerRef.current);
    }

    reactionTimerRef.current = window.setTimeout(
      () => setReaction(null),
      900,
    );
  }

  function burst(
    symbols: string[],
    count = 8,
  ) {
    const created = Array.from(
      { length: count },
      (_, index): Particle => ({
        id: ++particleIdRef.current,
        symbol: symbols[index % symbols.length],
        left: 24 + ((index * 17 + Math.random() * 9) % 56),
        top: 28 + ((index * 11 + Math.random() * 8) % 32),
        size: 16 + ((index * 3) % 10),
        delay: index * 38,
      }),
    );

    setParticles((current) => [
      ...current.slice(-18),
      ...created,
    ]);

    window.setTimeout(() => {
      const ids = new Set(created.map((item) => item.id));
      setParticles((current) =>
        current.filter((item) => !ids.has(item.id)),
      );
    }, 1700);
  }

  async function runAction(
    action: ShayminActionKey,
    item?: ShayminSnackKey | "lukas" | "skye",
    careNote?: string,
  ) {
    if (busyAction) {
      return;
    }

    setBusyAction(action);
    setError("");

    const nextReaction: Reaction =
      action === "cheer" ? "play" : action;
    startReaction(nextReaction);

    if (action === "feed") {
      const snack = item && item in SHAYMIN_SNACKS
        ? SHAYMIN_SNACKS[item as ShayminSnackKey]
        : null;
      setFlyingSnack(snack?.icon || "❧");
      burst(["✦", "❀", "♡"], 7);
      window.setTimeout(() => setFlyingSnack(null), 850);
    } else if (action === "pat") {
      burst(["♡", "♥", "✦", "❀"], 10);
    } else if (action === "play") {
      burst(["✦", "✧", "❀"], 11);
    } else if (action === "groom") {
      burst(["❀", "❧", "✦"], 8);
    } else if (action === "nap") {
      burst(["z", "Z", "☾"], 7);
    } else if (action === "talk") {
      burst(["♡", "…", "✦"], 8);
    } else if (action === "boop") {
      burst(["♡", "•"], 5);
    } else if (action === "cheer") {
      burst(["✦", "★", "❀"], 10);
    }

    try {
      const response =
        await adminFetch<CareResponse>(
          "/api/admin/shaymin",
          {
            method: "POST",
            body: JSON.stringify({
              action,
              item: item || null,
              note: careNote || null,
            }),
          },
        );

      setData(response);
      showToast(ACTION_COPY[action].message);

      if (action === "feed") {
        setTrayOpen(false);
      }

      if (action === "talk") {
        setTalkOpen(false);
        setNote("");
      }

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
    } catch (actionError: unknown) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "That care action could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  const favouriteSnack = useMemo(() => {
    if (!data?.summary.favouriteSnack) {
      return "Still deciding";
    }

    return SHAYMIN_SNACKS[
      data.summary.favouriteSnack
    ].label;
  }, [data]);

  const keeperItem =
    data?.viewer.name.toLowerCase().includes("skye")
      ? "skye"
      : "lukas";

  const mood = data?.mood;
  const state = data?.state;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1680px]">
        <AdminNav />

        <header className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-100/42">
              Private companion care
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Shaymin's little room
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50/44 sm:text-base">
              A shared, persistent space for Lukas and Skye. Every pat, snack,
              game and note is remembered by the same tiny garden guardian.
            </p>
          </div>

          {data ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white/55">
                Keeper: {data.viewer.name}
              </span>
              <span className="rounded-full border border-pink-100/15 bg-pink-300/[0.07] px-4 py-2 text-xs font-black text-pink-50/72">
                Bond Lv. {data.summary.bondLevel}
              </span>
              <span className="rounded-full border border-lime-100/15 bg-lime-300/[0.07] px-4 py-2 text-xs font-black text-lime-50/72">
                {data.summary.careStreak} day care streak
              </span>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingPanel />
        ) : data && mood && state ? (
          <>
            <section
              className={`${styles.scene} mt-6 rounded-[2.8rem] border border-emerald-100/15 bg-[#061a13]/90 shadow-[0_45px_160px_rgba(0,0,0,0.44)] backdrop-blur-3xl`}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${mood.aura}`}
              />

              {Array.from({ length: 10 }).map((_, index) => (
                <span
                  key={`leaf-${index}`}
                  className={styles.leaf}
                  style={{
                    left: `${5 + ((index * 13) % 90)}%`,
                    top: `${-5 - (index % 3) * 12}%`,
                    animationDelay: `${index * 620}ms`,
                    animationDuration: `${6200 + (index % 4) * 850}ms`,
                    color:
                      index % 3 === 0
                        ? "#bef264"
                        : index % 3 === 1
                          ? "#f9a8d4"
                          : "#a7f3d0",
                  }}
                >
                  {index % 3 === 1 ? "❀" : "❧"}
                </span>
              ))}

              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={`spark-${index}`}
                  className={styles.sparkle}
                  style={{
                    left: `${8 + ((index * 19) % 84)}%`,
                    top: `${8 + ((index * 23) % 76)}%`,
                    width: `${2 + (index % 3)}px`,
                    height: `${2 + (index % 3)}px`,
                    animationDelay: `${index * 270}ms`,
                  }}
                />
              ))}

              <div className="relative grid gap-0 xl:grid-cols-[21rem_minmax(0,1fr)_22rem]">
                <aside className="border-b border-white/10 p-5 sm:p-7 xl:border-b-0 xl:border-r">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-lime-100/38">
                        Care meters
                      </p>
                      <h2 className="mt-2 text-xl font-black text-white">
                        How the little one feels
                      </h2>
                    </div>
                    <span className="text-2xl" aria-hidden="true">
                      ❀
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Meter
                      label="Affection"
                      value={state.affection}
                      icon="♡"
                      detail="Grows through pats, play, treats and kind words."
                      fill="from-pink-300 to-rose-200"
                    />
                    <Meter
                      label="Fullness"
                      value={state.fullness}
                      icon="❧"
                      detail="A gentle meter that slowly changes with time."
                      fill="from-lime-300 to-emerald-200"
                    />
                    <Meter
                      label="Energy"
                      value={state.energy}
                      icon="✦"
                      detail="Play spends it; naps and quiet time restore it."
                      fill="from-sky-300 to-cyan-200"
                    />
                    <Meter
                      label="Comfort"
                      value={state.comfort}
                      icon="☾"
                      detail="Brushes, tea and conversation keep this warm."
                      fill="from-violet-300 to-fuchsia-200"
                    />
                  </div>

                  <div className="mt-4 rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[0.6rem] font-black uppercase tracking-[0.17em] text-white/30">
                      Favourite snack
                    </p>
                    <p className="mt-2 text-sm font-black text-white/75">
                      {favouriteSnack}
                    </p>
                  </div>
                </aside>

                <div className="relative min-w-0 p-5 sm:p-8 lg:p-10">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-lime-100/42">
                      Current mood
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                      {mood.label}
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-emerald-50/44">
                      {mood.whisper}
                    </p>
                    <p className="mx-auto mt-3 max-w-xl text-xs font-bold leading-5 text-white/26">
                      {mood.reason}
                    </p>
                  </div>

                  <div
                    className={`${styles.glassOrb} relative mx-auto mt-6 aspect-[1.08/1] w-full max-w-[35rem]`}
                  >
                    <div
                      className={`${styles.pulseRing} pointer-events-none absolute inset-[8%] rounded-[42%] border border-lime-100/18`}
                    />
                    <div className="pointer-events-none absolute inset-[11%] rounded-[42%] bg-emerald-200/8 blur-[45px]" />
                    <div
                      className={`${styles.creatureStage} absolute inset-0 overflow-hidden rounded-[3rem] border border-white/12 bg-gradient-to-b from-white/[0.045] to-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_35px_100px_rgba(0,0,0,0.34)]`}
                    >
                      <div className="pointer-events-none absolute inset-x-[10%] bottom-[7%] h-[16%] rounded-[50%] bg-black/30 blur-2xl" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_35%)]" />

                      <button
                        type="button"
                        aria-label="Pat Shaymin"
                        onPointerDown={() => setPressed(true)}
                        onPointerUp={() => {
                          if (!pressed || busyAction) return;
                          setPressed(false);
                          void runAction("pat");
                        }}
                        onPointerCancel={() => setPressed(false)}
                        onPointerLeave={() => setPressed(false)}
                        className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200"
                        style={{ touchAction: "manipulation" }}
                      >
                        <img
                          key={mood.key}
                          src={mood.image}
                          alt={mood.label}
                          draggable={false}
                          className={`${styles.creature} ${styles.moodFade} ${reactionClass(
                            reaction,
                          )} h-full w-full object-cover`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          void runAction("boop");
                        }}
                        disabled={Boolean(busyAction)}
                        aria-label="Boop the tiny nose"
                        className="absolute left-1/2 top-[47%] z-30 h-16 w-16 -translate-x-1/2 rounded-full opacity-0 outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-pink-200"
                      />

                      {flyingSnack ? (
                        <span
                          className={`${styles.snackFly} pointer-events-none absolute left-1/2 top-1/2 z-40 text-5xl`}
                        >
                          {flyingSnack}
                        </span>
                      ) : null}

                      {particles.map((particle) => (
                        <span
                          key={particle.id}
                          className={styles.particle}
                          style={{
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            fontSize: `${particle.size}px`,
                            animationDelay: `${particle.delay}ms`,
                            color:
                              particle.symbol === "♡" ||
                              particle.symbol === "♥"
                                ? "#f9a8d4"
                                : particle.symbol.toLowerCase() === "z"
                                  ? "#c4b5fd"
                                  : "#d9f99d",
                          }}
                        >
                          {particle.symbol}
                        </span>
                      ))}

                      <div className="pointer-events-none absolute inset-x-5 bottom-5 z-30 flex items-end justify-between gap-4 rounded-2xl border border-white/10 bg-[#04150f]/78 px-4 py-3 text-left backdrop-blur-2xl">
                        <div>
                          <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-lime-100/42">
                            Touch interaction
                          </p>
                          <p className="mt-1 text-xs font-bold text-white/48">
                            Tap anywhere for a pat. The nose has a hidden boop.
                          </p>
                        </div>
                        <span className="flex-none text-xl text-pink-100/75">
                          ♡
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ActionButton
                      action="pat"
                      detail="A gentle shared affection boost."
                      onClick={() => void runAction("pat")}
                      disabled={Boolean(busyAction)}
                      emphasis
                    />
                    <ActionButton
                      action="feed"
                      detail="Open the shared snack tray."
                      onClick={() => {
                        setTrayOpen((current) => !current);
                        setTalkOpen(false);
                      }}
                      disabled={Boolean(busyAction)}
                    />
                    <ActionButton
                      action="play"
                      detail="Spend energy on a tiny game."
                      onClick={() => void runAction("play")}
                      disabled={Boolean(busyAction)}
                    />
                    <ActionButton
                      action="groom"
                      detail="Brush and settle every leafy tuft."
                      onClick={() => void runAction("groom")}
                      disabled={Boolean(busyAction)}
                    />
                    <ActionButton
                      action="nap"
                      detail="Restore energy in the warm moss."
                      onClick={() => void runAction("nap")}
                      disabled={Boolean(busyAction)}
                    />
                    <ActionButton
                      action="talk"
                      detail="Leave a shared note for the care log."
                      onClick={() => {
                        setTalkOpen((current) => !current);
                        setTrayOpen(false);
                      }}
                      disabled={Boolean(busyAction)}
                    />
                  </div>

                  {trayOpen ? (
                    <section className="mt-4 rounded-[1.8rem] border border-lime-100/15 bg-[#061a12]/88 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-lime-100/40">
                            Shared snack tray
                          </p>
                          <p className="mt-1 text-sm font-bold text-white/52">
                            Pick whatever feels right today.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTrayOpen(false)}
                          className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
                          aria-label="Close snack tray"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {(Object.keys(
                          SHAYMIN_SNACKS,
                        ) as ShayminSnackKey[]).map((key) => {
                          const snack = SHAYMIN_SNACKS[key];

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => void runAction("feed", key)}
                              disabled={Boolean(busyAction)}
                              className="group rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-lime-100/25 hover:bg-lime-200/[0.07] disabled:opacity-40"
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-3xl transition group-hover:scale-110">
                                  {snack.icon}
                                </span>
                                <span>
                                  <span className="block text-sm font-black text-white">
                                    {snack.label}
                                  </span>
                                  <span className="mt-1 block text-[0.65rem] font-semibold leading-5 text-white/30">
                                    {snack.detail}
                                  </span>
                                  <span className="mt-2 block text-[0.58rem] font-black uppercase tracking-[0.12em] text-lime-100/38">
                                    {snack.effect}
                                  </span>
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {talkOpen ? (
                    <section className="mt-4 rounded-[1.8rem] border border-pink-100/15 bg-[#151020]/88 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-pink-100/42">
                            Tiny shared note
                          </p>
                          <p className="mt-1 text-sm font-bold text-white/52">
                            Lukas and Skye will both see it in the care history.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTalkOpen(false)}
                          className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
                          aria-label="Close note editor"
                        >
                          ×
                        </button>
                      </div>

                      <textarea
                        value={note}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          setNote(event.target.value.slice(0, 180))
                        }
                        placeholder="Today I wanted to tell you..."
                        className="mt-4 min-h-28 w-full resize-none rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-white/20 focus:border-pink-100/30"
                      />

                      <div className="mt-3 flex items-center justify-between gap-4">
                        <p className="text-xs font-bold text-white/25">
                          {note.length}/180
                        </p>
                        <button
                          type="button"
                          onClick={() => void runAction("talk", undefined, note)}
                          disabled={Boolean(busyAction) || !note.trim()}
                          className="min-h-11 rounded-xl border border-pink-100/20 bg-pink-300/[0.11] px-5 text-sm font-black text-pink-50 transition hover:bg-pink-300/[0.17] disabled:opacity-35"
                        >
                          Leave the note
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="border-t border-white/10 p-5 sm:p-7 xl:border-l xl:border-t-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-lime-100/38">
                        Shared care history
                      </p>
                      <h2 className="mt-2 text-xl font-black text-white">
                        The two keeper trail
                      </h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.6rem] font-black text-white/42">
                      {data.summary.todayCareCount} today
                    </span>
                  </div>

                  <div className="mt-5 rounded-[1.45rem] border border-pink-100/14 bg-gradient-to-br from-pink-300/[0.08] to-emerald-300/[0.05] p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {data.summary.bothCaredToday ? "💕" : "🌱"}
                      </span>
                      <div>
                        <p className="text-sm font-black text-white">
                          {data.summary.bothCaredToday
                            ? "Both branches visited today"
                            : "Waiting for both branches"}
                        </p>
                        <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/32">
                          {data.summary.bothCaredToday
                            ? "The together mood has been unlocked for today."
                            : "One care action from Lukas and one from Skye unlocks the pair mood."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                    {data.recentEvents.length ? (
                      data.recentEvents.map((event, index) => (
                        <article
                          key={event.id}
                          className={`${styles.logEnter} rounded-[1.25rem] border border-white/10 bg-white/[0.032] p-3.5`}
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/18 text-sm text-lime-100/75">
                              {ACTION_COPY[event.action].icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold leading-5 text-white/62">
                                {eventSentence(event)}
                              </p>
                              <p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/22">
                                {formatRelative(event.createdAt)}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-white/10 p-5 text-center text-xs font-semibold leading-6 text-white/28">
                        The first care action will begin your shared history.
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <article className="rounded-[2rem] border border-white/10 bg-[#071b14]/82 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-lime-100/38">
                      Shared bond
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                      {data.summary.bondTitle}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/34">
                      {formatNumber(data.summary.totalCare)} remembered care moments.
                      The bond level belongs to both of you.
                    </p>
                  </div>

                  <div className="flex h-20 w-20 flex-none items-center justify-center rounded-full border border-pink-100/20 bg-pink-300/[0.08] text-2xl font-black text-pink-50 shadow-[inset_0_0_25px_rgba(249,168,212,0.08)]">
                    {data.summary.bondLevel}
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full border border-white/10 bg-black/25">
                  <div
                    className={`${styles.shimmer} h-full rounded-full bg-[linear-gradient(90deg,#f9a8d4,#d9f99d,#7dd3fc,#f9a8d4)] transition-[width] duration-700`}
                    style={{ width: `${data.summary.bondProgress}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void runAction("cheer", keeperItem)}
                    disabled={Boolean(busyAction)}
                    className="rounded-[1.25rem] border border-sky-100/15 bg-sky-300/[0.06] p-4 text-left transition hover:bg-sky-300/[0.11] disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      My keeper cape
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/30">
                      Dress for {data.viewer.name}'s shift.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void runAction("cheer", "lukas")}
                    disabled={Boolean(busyAction)}
                    className="rounded-[1.25rem] border border-yellow-100/15 bg-yellow-300/[0.05] p-4 text-left transition hover:bg-yellow-300/[0.1] disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      Lukas cape
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/30">
                      Wake the left keeper branch.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void runAction("cheer", "skye")}
                    disabled={Boolean(busyAction)}
                    className="rounded-[1.25rem] border border-violet-100/15 bg-violet-300/[0.06] p-4 text-left transition hover:bg-violet-300/[0.11] disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      Skye cape
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/30">
                      Wake the right keeper branch.
                    </p>
                  </button>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[2rem] border border-yellow-100/14 bg-[#17180e]/82 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-yellow-200/10 blur-[65px]" />
                <p className="relative text-[0.62rem] font-black uppercase tracking-[0.18em] text-yellow-100/42">
                  Today's tiny secret
                </p>
                <p className="relative mt-4 text-xl font-black leading-8 text-white">
                  {data.summary.dailySecret}
                </p>
                <p className="relative mt-4 text-xs font-semibold leading-6 text-white/30">
                  This changes each day using your shared care and the growth of
                  PocketPulls. It is deliberately small, private and only yours.
                </p>
                <div className="relative mt-5 flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-black/15 px-4 py-3">
                  <div>
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-white/25">
                      Business pulse
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/55">
                      {formatNumber(data.tree.cardsPlantedToday)} cards planted · {formatNumber(data.tree.wishesToday)} wishes today
                    </p>
                  </div>
                  <span className="text-xl text-yellow-100/65">✦</span>
                </div>
              </article>
            </section>

            <p className="mt-5 text-center text-xs font-bold text-white/20">
              Click the navigation portrait to return here. Hold it to open The Tree We Grow.
            </p>
          </>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-lime-100/20 bg-[#071d14]/96 px-5 py-4 text-center text-sm font-black text-emerald-50 shadow-[0_25px_90px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
