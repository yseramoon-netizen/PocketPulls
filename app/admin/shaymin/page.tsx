"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ProtectedShayminImage from "@/components/admin/ProtectedShayminImage";
import ForestBackground from "@/components/ForestBackground";
import { adminFetch } from "@/lib/admin/client-auth";
import {
  SHAYMIN_MOOD_LIST,
  SHAYMIN_SNACKS,
  type ShayminActionKey,
  type ShayminMoodDefinition,
  type ShayminMoodKey,
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

type CareNeed = {
  key: "affection" | "fullness" | "energy" | "comfort" | "balanced";
  label: string;
  message: string;
  action: ShayminActionKey;
  actionLabel: string;
  icon: string;
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
    bondPointsRemaining: number;
    careBalance: number;
    need: CareNeed;
    dailySecret: string;
    lastSyncedAt: string;
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
  | "cheer"
  | null;

type ActionCopy = {
  label: string;
  icon: string;
  detail: string;
  message: string;
};

const ACTION_COPY: Record<ShayminActionKey, ActionCopy> = {
  pat: {
    label: "Pat",
    icon: "♡",
    detail: "Affection, comfort and one tiny happy wiggle.",
    message: "A tiny happy wiggle followed the pat.",
  },
  feed: {
    label: "Feed",
    icon: "❧",
    detail: "Open the shared tray and choose a proper treat.",
    message: "The snack inspection was extremely thorough.",
  },
  play: {
    label: "Play",
    icon: "✦",
    detail: "Big affection gain, some energy spent, possible zoomies.",
    message: "A very serious game has begun.",
  },
  groom: {
    label: "Brush leaves",
    icon: "❀",
    detail: "Restore comfort and put every leaf back in place.",
    message: "Every leaf is sitting perfectly again.",
  },
  nap: {
    label: "Tuck in",
    icon: "☾",
    detail: "Restore energy and make the care room quiet.",
    message: "The care room has become wonderfully quiet.",
  },
  talk: {
    label: "Talk",
    icon: "…",
    detail: "Leave a shared note that both keepers can read.",
    message: "Your words were tucked safely beneath the flowers.",
  },
  boop: {
    label: "Boop",
    icon: "•",
    detail: "The hidden nose target. Tiny gain, enormous importance.",
    message: "One tiny nose boop. Completely worth it.",
  },
  cheer: {
    label: "Keeper call",
    icon: "✧",
    detail: "Call one of the two keeper branches into the room.",
    message: "The keeper branches are ready for the next mission.",
  },
};

const STAT_META = {
  affection: {
    label: "Affection",
    icon: "♡",
    detail: "Pats, play, treats and kind words grow the shared bond.",
    fill: "from-pink-300 to-rose-200",
  },
  fullness: {
    label: "Fullness",
    icon: "❧",
    detail: "A gentle meter that changes slowly and never punishes absence.",
    fill: "from-lime-300 to-emerald-200",
  },
  energy: {
    label: "Energy",
    icon: "✦",
    detail: "Play spends it; rest and warm tea help bring it back.",
    fill: "from-sky-300 to-cyan-200",
  },
  comfort: {
    label: "Comfort",
    icon: "☾",
    detail: "Brushes, tea and conversation keep the little room cosy.",
    fill: "from-violet-300 to-fuchsia-200",
  },
} as const;

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
    const keeper = event.item === "skye" ? "Skye" : "Lukas";
    return `${event.actorName} called the ${keeper} keeper branch.`;
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
  if (reaction === "pat") return styles.reactPat ?? "";
  if (reaction === "feed") return styles.reactFeed ?? "";
  if (reaction === "play") return styles.reactPlay ?? "";
  if (reaction === "nap") return styles.reactNap ?? "";
  if (reaction === "groom") return styles.reactGroom ?? "";
  if (reaction === "talk") return styles.reactTalk ?? "";
  if (reaction === "boop") return styles.reactBoop ?? "";
  if (reaction === "cheer") return styles.reactCheer ?? "";
  return "";
}

function motionClass(motion: ShayminMoodDefinition["motion"]): string {
  if (motion === "bounce") return styles.motionBounce ?? "";
  if (motion === "dash") return styles.motionDash ?? "";
  if (motion === "sleep") return styles.motionSleep ?? "";
  if (motion === "settle") return styles.motionSettle ?? "";
  if (motion === "wiggle") return styles.motionWiggle ?? "";
  return styles.motionBreathe ?? "";
}

function Meter({
  stat,
  value,
}: {
  stat: keyof typeof STAT_META;
  value: number;
}) {
  const meta = STAT_META[stat];
  const safeValue = clampPercent(value);

  return (
    <article className="rounded-[1.35rem] border border-white/10 bg-black/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            {meta.icon}
          </span>
          <p className="text-[0.64rem] font-black uppercase tracking-[0.17em] text-white/48">
            {meta.label}
          </p>
        </div>
        <p className="text-sm font-black text-white">
          {safeValue}
        </p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/30"
        role="progressbar"
        aria-label={meta.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${meta.fill} transition-[width] duration-700`}
          style={{ width: `${safeValue}%` }}
        />
      </div>

      <p className="mt-2 text-[0.64rem] font-semibold leading-5 text-white/30">
        {meta.detail}
      </p>
    </article>
  );
}

function ActionButton({
  action,
  onClick,
  disabled,
  recommended = false,
}: {
  action: ShayminActionKey;
  onClick: () => void;
  disabled: boolean;
  recommended?: boolean;
}) {
  const copy = ACTION_COPY[action];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group min-h-24 rounded-[1.35rem] border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        recommended
          ? "border-lime-100/25 bg-gradient-to-br from-lime-300/[0.13] to-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-lime-100/40"
          : "border-white/10 bg-white/[0.035] hover:border-emerald-100/20 hover:bg-white/[0.065]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/18 text-lg text-white transition group-hover:scale-105">
          {copy.icon}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-black text-white">
            {copy.label}
            {recommended ? (
              <span className="rounded-full border border-lime-100/20 bg-lime-300/10 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.12em] text-lime-50/75">
                Best now
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-[0.65rem] font-semibold leading-5 text-white/32">
            {copy.detail}
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

function MoodGarden({
  currentMood,
}: {
  currentMood: ShayminMoodKey;
}) {
  return (
    <section className="mt-5 rounded-[2.2rem] border border-white/10 bg-[#071b14]/84 p-5 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-pink-100/42">
            Permanent Land Forme collection
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            The complete Shaymin mood garden
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/35">
            Every mood uses the approved Normal Form artwork, kept as a full transparent cutout with no forced crop or background.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-white/48">
          18 moods · current highlighted
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
        {SHAYMIN_MOOD_LIST.map((mood) => {
          const active = mood.key === currentMood;

          return (
            <article
              key={mood.key}
              title={mood.label}
              className={[
                "relative min-w-0 overflow-hidden rounded-[1.15rem] border p-2.5 text-center transition",
                active
                  ? "border-lime-100/35 bg-lime-300/[0.12] shadow-[0_0_35px_rgba(190,242,100,0.08)]"
                  : "border-white/8 bg-white/[0.025]",
              ].join(" ")}
            >
              <div className="relative mx-auto aspect-square w-full">
                <ProtectedShayminImage
                  mood={mood.key}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full select-none object-contain p-1"
                />
              </div>
              <p className="truncate text-[0.58rem] font-black text-white/55">
                {mood.shortLabel}
              </p>
              {active ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-lime-200 shadow-[0_0_10px_rgba(190,242,100,0.9)]" />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function ShayminCarePage() {
  const [data, setData] = useState<CareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] =
    useState<ShayminActionKey | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [reaction, setReaction] = useState<Reaction>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [flyingSnack, setFlyingSnack] = useState<string | null>(null);
  const particleIdRef = useRef(0);
  const reactionTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const response = await adminFetch<CareResponse>(
        "/api/admin/shaymin",
      );

      if (mountedRef.current) {
        setData(response);
      }
    } catch (loadError: unknown) {
      if (mountedRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The care room could not be opened.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 90_000);

    const refreshOnFocus = () => void load(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);

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
      920,
    );
  }

  function burst(symbols: string[], count = 8) {
    const created = Array.from(
      { length: count },
      (_, index): Particle => ({
        id: ++particleIdRef.current,
        symbol: symbols[index % symbols.length] ?? "✦",
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
    startReaction(action);

    if (action === "feed") {
      const snack =
        item && item in SHAYMIN_SNACKS
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
      const response = await adminFetch<CareResponse>(
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
        new CustomEvent("pocketpulls:shaymin-mood", {
          detail: {
            mood: response.mood.key,
          },
        }),
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

  function openAction(action: ShayminActionKey) {
    if (action === "feed") {
      setTalkOpen(false);
      setTrayOpen(true);
      return;
    }

    if (action === "talk") {
      setTrayOpen(false);
      setTalkOpen(true);
      return;
    }

    void runAction(action);
  }

  const favouriteSnack = useMemo(() => {
    if (!data?.summary.favouriteSnack) {
      return "Still deciding";
    }

    return SHAYMIN_SNACKS[data.summary.favouriteSnack].label;
  }, [data]);

  const keeperItem: "lukas" | "skye" =
    data?.viewer.name.toLowerCase().includes("skye")
      ? "skye"
      : "lukas";

  const mood = data?.mood;
  const state = data?.state;
  const noteRemaining = 180 - note.length;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1720px]">
        <AdminNav />

        <header className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-100/42">
              Private companion care · Land Forme collection
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Shaymin&apos;s little room
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50/45 sm:text-base">
              One persistent garden guardian shared by Lukas and Skye. Every care action is remembered, every mood is derived from real state, and every approved picture stays fully inside its frame.
            </p>
          </div>

          {data ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white/58">
                Keeper: {data.viewer.name}
              </span>
              <span className="rounded-full border border-pink-100/15 bg-pink-300/[0.07] px-4 py-2 text-xs font-black text-pink-50/75">
                Bond Lv. {data.summary.bondLevel}
              </span>
              <span className="rounded-full border border-lime-100/15 bg-lime-300/[0.07] px-4 py-2 text-xs font-black text-lime-50/75">
                {data.summary.careStreak} day care streak
              </span>
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="rounded-full border border-cyan-100/15 bg-cyan-300/[0.06] px-4 py-2 text-xs font-black text-cyan-50/70 transition hover:bg-cyan-300/[0.11] disabled:opacity-45"
              >
                {refreshing ? "Syncing..." : "Sync now"}
              </button>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="w-fit rounded-xl border border-red-100/20 bg-red-100/10 px-4 py-2 text-xs font-black text-red-50"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingPanel />
        ) : data && mood && state ? (
          <>
            <section
              className={`${styles.scene} mt-6 overflow-hidden rounded-[2.8rem] border border-emerald-100/15 bg-[#061a13]/92 shadow-[0_45px_160px_rgba(0,0,0,0.44)] backdrop-blur-3xl`}
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

              <div className="relative grid xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
                <aside className="border-b border-white/10 p-5 sm:p-7 xl:border-b-0 xl:border-r">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-lime-100/40">
                        Live care state
                      </p>
                      <h2 className="mt-2 text-xl font-black text-white">
                        How the little one feels
                      </h2>
                    </div>
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-lime-100/15 bg-lime-300/[0.07] text-lg font-black text-lime-50">
                      {data.summary.careBalance}
                      <span className="absolute -bottom-1 rounded-full border border-white/10 bg-[#071b14] px-2 py-0.5 text-[0.45rem] uppercase tracking-wider text-white/40">
                        balance
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Meter stat="affection" value={state.affection} />
                    <Meter stat="fullness" value={state.fullness} />
                    <Meter stat="energy" value={state.energy} />
                    <Meter stat="comfort" value={state.comfort} />
                  </div>

                  <article className="mt-4 rounded-[1.4rem] border border-lime-100/15 bg-lime-300/[0.055] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-lime-100/15 bg-black/15 text-lg text-lime-100">
                        {data.summary.need.icon}
                      </span>
                      <div>
                        <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-lime-100/45">
                          Best care right now
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {data.summary.need.label}
                        </p>
                        <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/34">
                          {data.summary.need.message}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAction(data.summary.need.action)}
                      disabled={Boolean(busyAction)}
                      className="mt-3 w-full rounded-xl border border-lime-100/18 bg-lime-300/[0.1] px-4 py-3 text-xs font-black text-lime-50 transition hover:bg-lime-300/[0.16] disabled:opacity-40"
                    >
                      {data.summary.need.actionLabel}
                    </button>
                  </article>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-white/28">
                        Favourite snack
                      </p>
                      <p className="mt-1 text-xs font-black text-white/68">
                        {favouriteSnack}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-white/28">
                        Care today
                      </p>
                      <p className="mt-1 text-xs font-black text-white/68">
                        {data.summary.todayCareCount} moments
                      </p>
                    </div>
                  </div>
                </aside>

                <div className="relative min-w-0 p-5 sm:p-8 lg:p-10">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-lime-100/45">
                      Current mood
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                      {mood.label}
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-emerald-50/48">
                      {mood.whisper}
                    </p>
                    <p className="mx-auto mt-3 max-w-xl text-xs font-bold leading-5 text-white/30">
                      {mood.reason}
                    </p>
                  </div>

                  <div
                    className={`${styles.glassOrb} relative mx-auto mt-6 aspect-square w-full max-w-[35rem]`}
                    style={{
                      "--mood-accent": mood.accent,
                    } as CSSProperties}
                  >
                    <div
                      className={`${styles.pulseRing} pointer-events-none absolute inset-[9%] rounded-[42%] border border-lime-100/18`}
                    />
                    <div className="pointer-events-none absolute inset-[12%] rounded-[42%] bg-emerald-200/8 blur-[45px]" />
                    <div
                      className={`${styles.creatureStage} absolute inset-0 overflow-hidden rounded-[3rem] border border-white/12 bg-gradient-to-b from-white/[0.05] to-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_35px_100px_rgba(0,0,0,0.34)]`}
                    >
                      <div className="pointer-events-none absolute inset-x-[15%] bottom-[9%] h-[12%] rounded-[50%] bg-black/28 blur-2xl" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.13),transparent_36%)]" />

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

                      <button
                        type="button"
                        aria-label="Pat Shaymin"
                        onClick={() => void runAction("pat")}
                        disabled={Boolean(busyAction)}
                        className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200 disabled:cursor-wait"
                        style={{ touchAction: "manipulation" }}
                      >
                        <ProtectedShayminImage
                          key={mood.key}
                          mood={mood.key}
                          alt={mood.label}
                          className={`${styles.creature} ${styles.moodFade} ${motionClass(mood.motion)} ${reactionClass(reaction)} absolute inset-0 h-full w-full select-none object-contain p-[7%] sm:p-[5%]`}
                        />
                      </button>

                      <button
                        type="button"
                        aria-label="Boop Shaymin's nose"
                        title="Tiny nose boop"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          void runAction("boop");
                        }}
                        disabled={Boolean(busyAction)}
                        className={`${styles.noseTarget} absolute left-[48%] top-[52%] z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-pink-200 disabled:pointer-events-none sm:h-14 sm:w-14`}
                      />

                      {particles.map((particle) => (
                        <span
                          key={particle.id}
                          className={styles.particle}
                          style={{
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            fontSize: `${particle.size}px`,
                            animationDelay: `${particle.delay}ms`,
                          }}
                        >
                          {particle.symbol}
                        </span>
                      ))}

                      {flyingSnack ? (
                        <span className={`${styles.snackFly} pointer-events-none absolute left-1/2 top-1/2 z-40 text-4xl`}>
                          {flyingSnack}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(["pat", "feed", "play", "groom", "nap", "talk"] as const).map(
                      (action) => (
                        <ActionButton
                          key={action}
                          action={action}
                          disabled={Boolean(busyAction)}
                          recommended={data.summary.need.action === action}
                          onClick={() => openAction(action)}
                        />
                      ),
                    )}
                  </div>

                  {trayOpen ? (
                    <section className={`${styles.drawerEnter} mt-4 rounded-[1.7rem] border border-lime-100/16 bg-black/20 p-4 sm:p-5`} aria-label="Shaymin snack tray">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-lime-100/42">
                            Shared snack tray
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            Choose one little treat
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTrayOpen(false)}
                          className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white/55"
                          aria-label="Close snack tray"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {Object.values(SHAYMIN_SNACKS).map((snack) => (
                          <button
                            key={snack.key}
                            type="button"
                            onClick={() => void runAction("feed", snack.key)}
                            disabled={Boolean(busyAction)}
                            className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-lime-100/20 hover:bg-white/[0.07] disabled:opacity-40"
                          >
                            <span className="text-2xl">{snack.icon}</span>
                            <p className="mt-3 text-sm font-black text-white">
                              {snack.label}
                            </p>
                            <p className="mt-1 text-[0.62rem] font-semibold leading-5 text-white/32">
                              {snack.detail}
                            </p>
                            <p className="mt-2 text-[0.57rem] font-black uppercase tracking-[0.1em] text-lime-100/48">
                              {snack.effect}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {talkOpen ? (
                    <section className={`${styles.drawerEnter} mt-4 rounded-[1.7rem] border border-pink-100/16 bg-black/20 p-4 sm:p-5`} aria-label="Write a note to Shaymin">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-pink-100/42">
                            Shared care note
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            Leave a few words beneath the flowers
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTalkOpen(false)}
                          className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white/55"
                          aria-label="Close note composer"
                        >
                          ×
                        </button>
                      </div>

                      <textarea
                        value={note}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          setNote(event.target.value.slice(0, 180))
                        }
                        rows={4}
                        placeholder="Write something small, kind or important..."
                        className="mt-4 w-full resize-none rounded-[1.25rem] border border-white/10 bg-black/22 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-white/20 focus:border-pink-100/30"
                      />
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className={`text-xs font-bold ${noteRemaining < 20 ? "text-amber-100/75" : "text-white/28"}`}>
                          {noteRemaining} characters remaining
                        </p>
                        <button
                          type="button"
                          onClick={() => void runAction("talk", undefined, note)}
                          disabled={Boolean(busyAction) || !note.trim()}
                          className="rounded-xl border border-pink-100/20 bg-pink-300/[0.1] px-5 py-3 text-xs font-black text-pink-50 transition hover:bg-pink-300/[0.16] disabled:opacity-35"
                        >
                          Share the note
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="border-t border-white/10 p-5 sm:p-7 xl:border-l xl:border-t-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-pink-100/40">
                        Shared memory
                      </p>
                      <h2 className="mt-2 text-xl font-black text-white">
                        What happened lately
                      </h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/42">
                      {formatNumber(data.summary.totalCare)} total
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-white/28">
                        Both keepers
                      </p>
                      <p className="mt-1 text-xs font-black text-white/68">
                        {data.summary.bothCaredToday ? "Together today" : "Waiting today"}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-white/28">
                        Tree pulse
                      </p>
                      <p className="mt-1 text-xs font-black text-white/68">
                        {formatNumber(data.tree.wishesToday)} wishes
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 max-h-[39rem] space-y-2 overflow-y-auto pr-1">
                    {data.recentEvents.length ? (
                      data.recentEvents.map((event, index) => (
                        <article
                          key={event.id}
                          className={`${styles.logEnter} rounded-[1.2rem] border border-white/10 bg-white/[0.032] p-3.5`}
                          style={{ animationDelay: `${index * 35}ms` }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-black/18 text-sm text-lime-100/75">
                              {ACTION_COPY[event.action].icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-xs font-bold leading-5 text-white/64">
                                {eventSentence(event)}
                              </p>
                              <p className="mt-1 text-[0.56rem] font-black uppercase tracking-[0.12em] text-white/24">
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

            <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
              <article className="rounded-[2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-lime-100/40">
                      Shared bond
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                      {data.summary.bondTitle}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/36">
                      {formatNumber(data.summary.totalCare)} remembered care moments belong to both keepers.
                      {data.summary.bondPointsRemaining > 0
                        ? ` ${data.summary.bondPointsRemaining} bond points remain before the next level.`
                        : " The bond has reached its highest garden level."}
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
                    className="rounded-[1.25rem] border border-lime-100/15 bg-lime-300/[0.06] p-4 text-left transition hover:bg-lime-300/[0.11] disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      My keeper call
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/31">
                      Call the {data.viewer.name} branch into the room.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => void runAction("cheer", "lukas")}
                    disabled={Boolean(busyAction)}
                    className="rounded-[1.25rem] border border-sky-100/15 bg-sky-300/[0.06] p-4 text-left transition hover:bg-sky-300/[0.11] disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      Lukas branch
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/31">
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
                      Skye branch
                    </p>
                    <p className="mt-1 text-[0.65rem] font-semibold leading-5 text-white/31">
                      Wake the right keeper branch.
                    </p>
                  </button>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[2rem] border border-yellow-100/14 bg-[#17180e]/84 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-yellow-200/10 blur-[65px]" />
                <p className="relative text-[0.62rem] font-black uppercase tracking-[0.18em] text-yellow-100/42">
                  Today&apos;s tiny secret
                </p>
                <p className="relative mt-4 text-xl font-black leading-8 text-white">
                  {data.summary.dailySecret}
                </p>
                <p className="relative mt-4 text-xs font-semibold leading-6 text-white/31">
                  It changes each day using your shared care and ancientpulls growth. It stays deliberately small, private and only yours.
                </p>
                <div className="relative mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/15 p-3">
                    <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-white/26">
                      Cards planted
                    </p>
                    <p className="mt-1 text-xs font-black text-white/62">
                      {formatNumber(data.tree.cardsPlantedToday)} today
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/15 p-3">
                    <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-white/26">
                      Growth score
                    </p>
                    <p className="mt-1 text-xs font-black text-white/62">
                      {formatNumber(data.tree.growthScore)}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <MoodGarden currentMood={mood.key} />

            <p className="mt-5 text-center text-xs font-bold text-white/22">
              Click the navigation portrait to return here. Hold it to open The Tree We Grow.
            </p>
          </>
        ) : null}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className="fixed bottom-5 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-lime-100/20 bg-[#071d14]/96 px-5 py-4 text-center text-sm font-black text-emerald-50 shadow-[0_25px_90px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
            {toast}
          </div>
        ) : null}
      </div>
    </main>
  );
}
