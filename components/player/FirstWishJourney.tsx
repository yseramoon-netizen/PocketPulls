"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type FirstWishJourneyProps = {
  displayName: string;
};

type JourneyRow = {
  intro_seen: boolean;
  profile_complete: boolean;
  zodiac_complete: boolean;
  daily_reward_available: boolean;
  wish_ready: boolean;
  first_wish_complete: boolean;
  binder_seen: boolean;
  constellation_seen: boolean;
  completed: boolean;
  current_step: JourneyStepId;
  completed_steps: number;
  total_steps: number;
};

type JourneyStepId =
  | "profile"
  | "zodiac"
  | "reward"
  | "wish"
  | "binder"
  | "constellation"
  | "complete";

type JourneyStep = {
  id: Exclude<JourneyStepId, "complete">;
  number: number;
  title: string;
  description: string;
  href: string;
  action: string;
  complete: boolean;
};

const REFRESH_EVENTS = [
  "pocketpulls:profile-updated",
  "pocketpulls:wish-balance",
  "pocketpulls:reward-claimed",
  "pocketpulls:achievement-reward-claimed",
] as const;

const HIDDEN_PATHS = new Set([
  "/terms",
  "/rules",
  "/player-protection",
  "/how-wishes-work",
  "/odds",
  "/faq",
  "/help",
]);

function asJourneyRow(value: unknown): JourneyRow | null {
  const item = Array.isArray(value) ? value[0] : value;

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const row = item as Record<string, unknown>;
  const rawStep = typeof row.current_step === "string"
    ? row.current_step
    : "profile";

  const currentStep: JourneyStepId = [
    "profile",
    "zodiac",
    "reward",
    "wish",
    "binder",
    "constellation",
    "complete",
  ].includes(rawStep)
    ? (rawStep as JourneyStepId)
    : "profile";

  return {
    intro_seen: row.intro_seen === true,
    profile_complete: row.profile_complete === true,
    zodiac_complete: row.zodiac_complete === true,
    daily_reward_available: row.daily_reward_available === true,
    wish_ready: row.wish_ready === true,
    first_wish_complete: row.first_wish_complete === true,
    binder_seen: row.binder_seen === true,
    constellation_seen: row.constellation_seen === true,
    completed: row.completed === true,
    current_step: currentStep,
    completed_steps: Math.max(0, Math.floor(Number(row.completed_steps) || 0)),
    total_steps: Math.max(1, Math.floor(Number(row.total_steps) || 6)),
  };
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "Trainer";
}

export default function FirstWishJourney({
  displayName,
}: FirstWishJourneyProps) {
  const pathname = usePathname();
  const router = useRouter();
  const requestRef = useRef(0);
  const markedRoutesRef = useRef(new Set<string>());

  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [available, setAvailable] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [beginning, setBeginning] = useState(false);

  const loadJourney = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const { data, error } = await supabase.rpc(
      "get_player_onboarding_journey",
    );

    if (requestRef.current !== requestId) {
      return;
    }

    if (error) {
      console.warn("First-wish journey is unavailable:", error.message);
      setAvailable(false);
      return;
    }

    setAvailable(true);
    setJourney(asJourneyRow(data));
  }, []);

  useEffect(() => {
    try {
      setCollapsed(
        window.sessionStorage.getItem("pocketpulls:first-wish-collapsed") ===
          "1",
      );
    } catch {
      setCollapsed(false);
    }

    void loadJourney();

    const refresh = () => {
      void loadJourney();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refresh);
    });

    return () => {
      requestRef.current += 1;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, refresh);
      });
    };
  }, [loadJourney]);

  useEffect(() => {
    const stage = pathname === "/collection"
      ? "binder"
      : pathname === "/constellation"
        ? "constellation"
        : null;

    if (!stage || markedRoutesRef.current.has(stage)) {
      void loadJourney();
      return;
    }

    markedRoutesRef.current.add(stage);

    void supabase
      .rpc("mark_player_onboarding_stage", {
        p_stage: stage,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Journey stage could not be recorded:", error.message);
          setAvailable(false);
          return;
        }

        void loadJourney();
      });
  }, [loadJourney, pathname]);

  const steps = useMemo<JourneyStep[]>(() => {
    if (!journey) {
      return [];
    }

    return [
      {
        id: "profile",
        number: 1,
        title: "Personalise your profile",
        description: "Choose the Pokémon that represents you.",
        href: "/profile",
        action: "Open profile",
        complete: journey.profile_complete,
      },
      {
        id: "zodiac",
        number: 2,
        title: "Choose your zodiac",
        description: "Give your constellation its celestial sign.",
        href: "/profile",
        action: "Choose zodiac",
        complete: journey.zodiac_complete,
      },
      {
        id: "reward",
        number: 3,
        title: "Find your first wish",
        description: journey.daily_reward_available
          ? "Your Daily Gift can place a wish in your balance."
          : "Today’s gift is claimed. A Founder can help if you need a wish.",
        href: journey.daily_reward_available ? "/rewards" : "/help",
        action: journey.daily_reward_available ? "Claim Daily Gift" : "Ask for help",
        complete: journey.wish_ready,
      },
      {
        id: "wish",
        number: 4,
        title: "Make your first wish",
        description: "Choose a card pool and reveal the card meant for you.",
        href: "/wishes",
        action: "Make a wish",
        complete: journey.first_wish_complete,
      },
      {
        id: "binder",
        number: 5,
        title: "Open your Binder",
        description: "Meet your revealed card inside your collection.",
        href: "/collection",
        action: "Open Binder",
        complete: journey.binder_seen,
      },
      {
        id: "constellation",
        number: 6,
        title: "Explore your constellation",
        description: "See your pull become a star in your growing 3D sky.",
        href: "/constellation",
        action: "Enter constellation",
        complete: journey.constellation_seen,
      },
    ];
  }, [journey]);

  const currentStep = useMemo(() => {
    if (!journey) {
      return null;
    }

    return (
      steps.find((step) => step.id === journey.current_step) ||
      steps.find((step) => !step.complete) ||
      null
    );
  }, [journey, steps]);

  const setJourneyCollapsed = useCallback((nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);

    try {
      window.sessionStorage.setItem(
        "pocketpulls:first-wish-collapsed",
        nextCollapsed ? "1" : "0",
      );
    } catch {
      // A blocked session store should never block the journey itself.
    }
  }, []);

  const beginJourney = useCallback(async () => {
    if (beginning) {
      return;
    }

    setBeginning(true);

    const { error } = await supabase.rpc("mark_player_onboarding_stage", {
      p_stage: "intro",
    });

    if (error) {
      console.warn("Journey introduction could not be recorded:", error.message);
      setAvailable(false);
      setBeginning(false);
      return;
    }

    setJourney((current) =>
      current ? { ...current, intro_seen: true } : current,
    );
    setBeginning(false);
    void loadJourney();
  }, [beginning, loadJourney]);

  const hiddenPath = Array.from(HIDDEN_PATHS).some(
    (hidden) => pathname === hidden || pathname.startsWith(`${hidden}/`),
  );

  if (!available || !journey || journey.completed || hiddenPath) {
    return null;
  }

  const progress = Math.min(
    100,
    Math.max(0, (journey.completed_steps / journey.total_steps) * 100),
  );

  return (
    <>
      {!journey.intro_seen ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center overflow-y-auto bg-[#02030d]/88 px-4 py-10 backdrop-blur-xl">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-wish-intro-title"
            className="relative w-full max-w-lg overflow-hidden rounded-[2.25rem] border border-yellow-100/22 bg-[#080a24]/98 shadow-[0_40px_140px_rgba(0,0,0,0.78)]"
          >
            <div className="h-1.5 bg-gradient-to-r from-cyan-200 via-yellow-100 to-violet-300" />

            <div className="relative overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(250,204,21,0.13),transparent_34%),radial-gradient(circle_at_12%_80%,rgba(103,232,249,0.08),transparent_32%),radial-gradient(circle_at_90%_72%,rgba(196,181,253,0.1),transparent_34%)]" />

              <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-2 animate-pulse rounded-full bg-yellow-200/14 blur-2xl" />
                <div className="absolute inset-0 rounded-full border border-dashed border-cyan-100/25" />
                <img
                  src="/jirachi.png"
                  alt=""
                  draggable={false}
                  className="relative h-20 w-20 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className="relative mt-6">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-yellow-100/52">
                  Your first-wish journey
                </p>

                <h2
                  id="first-wish-intro-title"
                  className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
                >
                  Welcome to the archive, {firstName(displayName)}.
                </h2>

                <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-7 text-white/55 sm:text-base">
                  In six small steps, you’ll shape your trainer identity, make
                  your first pull, meet the card in your Binder and watch it
                  become a star in your constellation.
                </p>

                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["01", "Claim a wish"],
                    ["02", "Reveal a card"],
                    ["03", "Grow your sky"],
                  ].map(([number, label]) => (
                    <div
                      key={number}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3"
                    >
                      <p className="text-xs font-black text-cyan-100/65">
                        {number}
                      </p>
                      <p className="mt-1 text-[0.66rem] font-black text-white/72 sm:text-xs">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={beginning}
                  onClick={() => void beginJourney()}
                  className="mt-7 min-h-13 w-full rounded-2xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-6 py-3.5 text-sm font-black text-[#101225] shadow-[0_16px_40px_rgba(103,232,249,0.14)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a24] disabled:opacity-60"
                >
                  {beginning ? "Opening the path…" : "Begin my journey"}
                </button>

                <p className="mt-3 text-[0.66rem] font-bold text-white/28">
                  Your progress follows your account on every device.
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {journey.intro_seen && currentStep ? (
        <aside
          aria-label="First-wish journey"
          className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-[72] w-[calc(100vw-1.5rem)] max-w-sm md:bottom-5 md:left-5"
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setJourneyCollapsed(false)}
              className="flex w-full items-center gap-3 rounded-2xl border border-yellow-100/22 bg-[#080a24]/96 p-3 text-left shadow-[0_22px_65px_rgba(0,0,0,0.62)] backdrop-blur-2xl transition hover:border-cyan-100/30 hover:bg-[#0b0e30]/98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:w-auto"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-yellow-100/20 bg-yellow-200/[0.09] text-yellow-50">
                ✦
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.58rem] font-black uppercase tracking-[0.16em] text-yellow-100/45">
                  First-wish journey · {journey.completed_steps}/{journey.total_steps}
                </span>
                <span className="mt-0.5 block truncate text-sm font-black text-white">
                  {currentStep.title}
                </span>
              </span>
              <span aria-hidden="true" className="text-cyan-100/65">
                ↑
              </span>
            </button>
          ) : (
            <div className="overflow-hidden rounded-[1.65rem] border border-yellow-100/20 bg-[#080a24]/97 shadow-[0_28px_85px_rgba(0,0,0,0.7)] backdrop-blur-3xl">
              <div className="h-1 bg-gradient-to-r from-cyan-200 via-yellow-100 to-violet-300" />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-yellow-100/20 bg-yellow-200/[0.08] text-lg text-yellow-50">
                    ✦
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[0.59rem] font-black uppercase tracking-[0.18em] text-cyan-100/44">
                      First-wish journey
                    </p>
                    <p className="mt-1 text-base font-black text-white">
                      Step {currentStep.number}: {currentStep.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJourneyCollapsed(true)}
                    aria-label="Minimise first-wish journey"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    ↓
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[0.61rem] font-black uppercase tracking-[0.12em]">
                    <span className="text-white/35">Archive path</span>
                    <span className="text-yellow-100/65">
                      {journey.completed_steps} of {journey.total_steps}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-200 to-violet-300 transition-[width] duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <ol className="mt-4 space-y-1.5">
                  {steps.map((step) => {
                    const active = step.id === currentStep.id;

                    return (
                      <li
                        key={step.id}
                        className={[
                          "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition",
                          active
                            ? "border-cyan-100/20 bg-cyan-200/[0.07]"
                            : "border-transparent",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[0.61rem] font-black",
                            step.complete
                              ? "border-emerald-200/25 bg-emerald-200/[0.12] text-emerald-100"
                              : active
                                ? "border-yellow-100/30 bg-yellow-200/[0.12] text-yellow-50"
                                : "border-white/10 bg-white/[0.035] text-white/28",
                          ].join(" ")}
                        >
                          {step.complete ? "✓" : step.number}
                        </span>
                        <span
                          className={[
                            "min-w-0 flex-1 truncate text-xs font-black",
                            step.complete
                              ? "text-white/35 line-through decoration-white/20"
                              : active
                                ? "text-white"
                                : "text-white/38",
                          ].join(" ")}
                        >
                          {step.title}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <p className="mt-4 text-xs font-semibold leading-5 text-white/45">
                  {currentStep.description}
                </p>

                <button
                  type="button"
                  onClick={() => router.push(currentStep.href)}
                  className="mt-3 min-h-11 w-full rounded-xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-4 text-sm font-black text-[#111329] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a24]"
                >
                  {currentStep.action} →
                </button>
              </div>
            </div>
          )}
        </aside>
      ) : null}
    </>
  );
}
