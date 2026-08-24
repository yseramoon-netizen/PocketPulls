"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import NebuPortrait from "@/components/player/NebuPortrait";
import { supabase } from "@/lib/supabase";

type FirstWishJourneyProps = {
  displayName: string;
};

type JourneyStepId =
  | "profile"
  | "zodiac"
  | "reward"
  | "wish"
  | "binder"
  | "constellation"
  | "complete";

type JourneyRow = {
  intro_seen: boolean;
  profile_complete: boolean;
  zodiac_complete: boolean;
  wish_ready: boolean;
  first_wish_complete: boolean;
  binder_seen: boolean;
  constellation_seen: boolean;
  completed: boolean;
  current_step: JourneyStepId;
  completed_steps: number;
  total_steps: number;
};

type JourneyStep = {
  id: Exclude<JourneyStepId, "complete">;
  number: number;
  title: string;
  description: string;
  instruction: string;
  href: string;
  target: string;
  action: string;
  complete: boolean;
};

type SpotlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const REFRESH_EVENTS = [
  "pocketpulls:profile-updated",
  "pocketpulls:wish-balance",
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

const PAUSED_KEY = "pocketpulls:first-wish-tour-paused-v2";
const CELEBRATED_KEY = "pocketpulls:first-wish-tour-celebrated-v2";
const COMPLETE_KEY = "pocketpulls:first-wish-tour-complete-v1";

function asJourneyRow(value: unknown): JourneyRow | null {
  const item = Array.isArray(value) ? value[0] : value;

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const row = item as Record<string, unknown>;
  const rawStep = typeof row.current_step === "string"
    ? row.current_step
    : "profile";
  const validSteps: JourneyStepId[] = [
    "profile",
    "zodiac",
    "reward",
    "wish",
    "binder",
    "constellation",
    "complete",
  ];

  return {
    intro_seen: row.intro_seen === true,
    profile_complete: row.profile_complete === true,
    zodiac_complete: row.zodiac_complete === true,
    wish_ready: row.wish_ready === true,
    first_wish_complete: row.first_wish_complete === true,
    binder_seen: row.binder_seen === true,
    constellation_seen: row.constellation_seen === true,
    completed: row.completed === true,
    current_step: validSteps.includes(rawStep as JourneyStepId)
      ? (rawStep as JourneyStepId)
      : "profile",
    completed_steps: Math.max(0, Math.floor(Number(row.completed_steps) || 0)),
    total_steps: Math.max(1, Math.floor(Number(row.total_steps) || 6)),
  };
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "Trainer";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function readTargetRect(element: Element): SpotlightRect {
  const targetRect = element.getBoundingClientRect();
  const popoverRects = Array.from(
    element.querySelectorAll<HTMLElement>(
      "[data-onboarding-popover]",
    ),
  )
    .map((popover) => popover.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  const raw = popoverRects.reduce(
    (combined, popover) => ({
      top: Math.min(combined.top, popover.top),
      left: Math.min(combined.left, popover.left),
      right: Math.max(combined.right, popover.right),
      bottom: Math.max(combined.bottom, popover.bottom),
    }),
    {
      top: targetRect.top,
      left: targetRect.left,
      right: targetRect.right,
      bottom: targetRect.bottom,
    },
  );
  const padding = 10;
  const top = clamp(raw.top - padding, 8, Math.max(8, window.innerHeight - 16));
  const left = clamp(raw.left - padding, 8, Math.max(8, window.innerWidth - 16));
  const right = clamp(raw.right + padding, left, Math.max(left, window.innerWidth - 8));
  const bottom = clamp(raw.bottom + padding, top, Math.max(top, window.innerHeight - 8));

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export default function FirstWishJourney({
  displayName,
}: FirstWishJourneyProps) {
  const pathname = usePathname();
  const router = useRouter();
  const requestRef = useRef(0);
  const journeyStepRef = useRef<JourneyStepId | null>(null);
  const holdWishCompletionRef = useRef(false);

  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [available, setAvailable] = useState(true);
  const [paused, setPaused] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.sessionStorage.getItem(PAUSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [beginning, setBeginning] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const [waitingForWishContinue, setWaitingForWishContinue] = useState(false);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [locatingTarget, setLocatingTarget] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const loadJourney = useCallback(async (force = false) => {
    if (!force && holdWishCompletionRef.current) {
      return;
    }

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

    const nextJourney = asJourneyRow(data);
    journeyStepRef.current = nextJourney?.current_step ?? null;

    if (
      nextJourney?.current_step === "wish" &&
      !nextJourney.first_wish_complete
    ) {
      holdWishCompletionRef.current = true;
    }

    setAvailable(true);
    setJourney(nextJourney);

    if (nextJourney?.completed && nextJourney.intro_seen) {
      try {
        window.localStorage.setItem(COMPLETE_KEY, "1");
        if (window.localStorage.getItem(CELEBRATED_KEY) !== "1") {
          setCelebrating(true);
        }
      } catch {
        setCelebrating(true);
      }
    }
  }, []);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => {
      void loadJourney();
    });

    const refresh = () => void loadJourney();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const handleCinematic = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      const open = detail?.open === true;

      setCinematicOpen(open);

      if (
        open &&
        journeyStepRef.current === "wish"
      ) {
        holdWishCompletionRef.current = true;
        setWaitingForWishContinue(true);
      }
    };
    const handleCinematicContinued = () => {
      if (!holdWishCompletionRef.current) {
        return;
      }

      holdWishCompletionRef.current = false;
      setWaitingForWishContinue(false);
      setCinematicOpen(false);
      void loadJourney(true);
    };
    const handleOnboardingInteraction = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          target?: string;
          open?: boolean;
        }>
      ).detail;

      if (!detail?.target) {
        return;
      }

      setActiveInteraction((current) =>
        detail.open
          ? detail.target || null
          : current === detail.target
            ? null
            : current,
      );
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(
      "pocketpulls:wish-cinematic-visibility",
      handleCinematic,
    );
    window.addEventListener(
      "pocketpulls:wish-cinematic-continued",
      handleCinematicContinued,
    );
    window.addEventListener(
      "pocketpulls:onboarding-interaction",
      handleOnboardingInteraction,
    );
    REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refresh);
    });

    return () => {
      requestRef.current += 1;
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(
        "pocketpulls:wish-cinematic-visibility",
        handleCinematic,
      );
      window.removeEventListener(
        "pocketpulls:wish-cinematic-continued",
        handleCinematicContinued,
      );
      window.removeEventListener(
        "pocketpulls:onboarding-interaction",
        handleOnboardingInteraction,
      );
      REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, refresh);
      });
    };
  }, [loadJourney]);

  const steps = useMemo<JourneyStep[]>(() => {
    if (!journey) {
      return [];
    }

    return [
      {
        id: "profile",
        number: 1,
        title: "Create your trainer identity",
        description:
          "This favourite appears on your profile and completes your basic trainer identity.",
        instruction:
          "Type the card or character you want other trainers to associate with you, then save.",
        href: "/profile",
        target: "profile",
        action: "Save profile & continue",
        complete: journey.profile_complete,
      },
      {
        id: "zodiac",
        number: 2,
        title: "Shape your constellation",
        description:
          "Your zodiac sign controls the real star pattern used by your personal constellation.",
        instruction: "Open this box, choose your sign, then save it to your account.",
        href: "/profile",
        target: "zodiac",
        action: "Save star sign & continue",
        complete: journey.zodiac_complete,
      },
      {
        id: "reward",
        number: 3,
        title: "Understand wish recharging",
        description:
          "Wishes power every pull. Recharge bundles and Nebu’s Vault will live here; before launch, a Founder can add wishes for you.",
        instruction:
          "Once your balance contains a wish, Nebu will take you straight to the Wish Chamber.",
        href: "/wishes/shop",
        target: "reward",
        action: "Check my wish balance",
        complete: journey.wish_ready,
      },
      {
        id: "wish",
        number: 4,
        title: "Make your first wish",
        description:
          "One wish reveals one real card from the active stock pool and permanently records the result.",
        instruction:
          "Press the highlighted Make 1 Wish button and watch Nebu perform the reveal.",
        href: "/wishes",
        target: "wish",
        action: "Make my first wish",
        complete: journey.first_wish_complete,
      },
      {
        id: "binder",
        number: 5,
        title: "Meet your Binder",
        description:
          "Every revealed card is stored here. You can inspect cards, organise pages, change the Binder style and choose a signature card.",
        instruction: "Your first card is now safely recorded inside this highlighted Binder.",
        href: "/collection",
        target: "binder",
        action: "I’ve seen my Binder",
        complete: journey.binder_seen,
      },
      {
        id: "constellation",
        number: 6,
        title: "Explore your living sky",
        description:
          "Every wish also becomes a star. Select stars to revisit cards, drag to travel through space and use Earth view to recenter your zodiac.",
        instruction: "This 3D sky grows permanently with every wish you make.",
        href: "/constellation",
        target: "constellation",
        action: "Finish my tutorial",
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

  const setTourPaused = useCallback((nextPaused: boolean) => {
    setPaused(nextPaused);
    setTargetRect(null);

    try {
      window.sessionStorage.setItem(PAUSED_KEY, nextPaused ? "1" : "0");
    } catch {
      // The tutorial remains usable when session storage is unavailable.
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
    setTourPaused(false);
    setBeginning(false);
    router.push("/profile");
    void loadJourney();
  }, [beginning, loadJourney, router, setTourPaused]);

  useEffect(() => {
    if (
      !journey?.intro_seen ||
      journey.completed ||
      paused ||
      !currentStep ||
      cinematicOpen
    ) {
      const clearFrame = window.requestAnimationFrame(() => {
        setTargetRect(null);
      });
      return () => window.cancelAnimationFrame(clearFrame);
    }

    if (pathname !== currentStep.href) {
      const navigationFrame = window.requestAnimationFrame(() => {
        setTargetRect(null);
        router.push(currentStep.href);
      });
      return () => window.cancelAnimationFrame(navigationFrame);
    }

    let active = true;
    let target: Element | null = null;
    let observer: MutationObserver | null = null;
    let settleTimer: number | null = null;
    const locatingFrame = window.requestAnimationFrame(() => {
      setLocatingTarget(true);
    });

    const updateRect = () => {
      if (!active || !target || !document.contains(target)) {
        return;
      }
      setTargetRect(readTargetRect(target));
      setLocatingTarget(false);
    };
    const handleLayoutChange = () => {
      window.requestAnimationFrame(updateRect);
    };

    const findTarget = () => {
      const nextTarget = document.querySelector(
        `[data-onboarding-target="${currentStep.target}"]`,
      );

      if (!nextTarget) {
        return;
      }

      observer?.disconnect();

      const changed = nextTarget !== target;
      target = nextTarget;
      if (changed) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }

      updateRect();
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      settleTimer = window.setTimeout(updateRect, 520);
    };

    findTarget();
    observer = new MutationObserver(findTarget);
    if (!target) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener(
      "pocketpulls:onboarding-layout",
      handleLayoutChange,
    );

    return () => {
      active = false;
      window.cancelAnimationFrame(locatingFrame);
      observer?.disconnect();
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener(
        "pocketpulls:onboarding-layout",
        handleLayoutChange,
      );
    };
  }, [cinematicOpen, currentStep, journey, pathname, paused, router]);

  const performStepAction = useCallback(async () => {
    if (!currentStep || advancing) {
      return;
    }

    if (currentStep.id === "profile" || currentStep.id === "zodiac") {
      const form = document.querySelector<HTMLFormElement>(
        '[data-onboarding-form="profile"]',
      );
      form?.requestSubmit();
      return;
    }

    if (currentStep.id === "wish") {
      const button = document.querySelector<HTMLButtonElement>(
        '[data-onboarding-action="make-wish"]',
      );
      button?.click();
      return;
    }

    if (currentStep.id === "reward") {
      await loadJourney();
      return;
    }

    setAdvancing(true);
    const { error } = await supabase.rpc("mark_player_onboarding_stage", {
      p_stage: currentStep.id,
    });

    if (error) {
      console.warn("Journey stage could not be recorded:", error.message);
      setAvailable(false);
      setAdvancing(false);
      return;
    }

    await loadJourney();
    setAdvancing(false);
  }, [advancing, currentStep, loadJourney]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    try {
      window.localStorage.setItem(CELEBRATED_KEY, "1");
    } catch {
      // Closing the celebration should always work.
    }
  }, []);

  const hiddenPath = Array.from(HIDDEN_PATHS).some(
    (hidden) => pathname === hidden || pathname.startsWith(`${hidden}/`),
  );

  if (!available || !journey || hiddenPath) {
    return null;
  }

  if (journey.completed) {
    return celebrating ? (
      <CompletionCelebration
        displayName={displayName}
        onClose={finishCelebration}
      />
    ) : null;
  }

  if (!journey.intro_seen) {
    return (
      <div className="fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto bg-[#02030d]/92 px-4 py-10 backdrop-blur-xl">
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
              <NebuPortrait
                alt="Nebu"
                draggable={false}
                className="relative h-20 w-20 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.5)]"
              />
            </div>
            <div className="relative mt-6">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-yellow-100/52">
                Guided first-wish tutorial
              </p>
              <h2
                id="first-wish-intro-title"
                className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                Welcome, {firstName(displayName)}.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-7 text-white/58 sm:text-base">
                Nebu will guide you through the real controls one at a time.
                Each page will move to the exact box you need, darken everything
                else and explain what your next action does.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {[
                  ["01", "Build identity"],
                  ["02", "Make a wish"],
                  ["03", "Explore your sky"],
                ].map(([number, label]) => (
                  <div
                    key={number}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3"
                  >
                    <p className="text-xs font-black text-cyan-100/65">{number}</p>
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
                className="mt-7 min-h-13 w-full rounded-2xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-6 py-3.5 text-sm font-black text-[#101225] shadow-[0_16px_40px_rgba(103,232,249,0.14)] transition hover:brightness-110 disabled:opacity-60"
              >
                {beginning ? "Nebu is opening the path…" : "Start guided tutorial"}
              </button>
              <p className="mt-3 text-[0.66rem] font-bold text-white/28">
                Your completed steps follow your account across devices.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!currentStep) {
    return null;
  }

  if (
    cinematicOpen ||
    waitingForWishContinue
  ) {
    return null;
  }

  const progress = Math.min(
    100,
    Math.max(0, (journey.completed_steps / journey.total_steps) * 100),
  );

  if (paused) {
    return (
      <button
        type="button"
        onClick={() => setTourPaused(false)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-[185] flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-yellow-100/25 bg-[#080a24]/97 p-3 text-left shadow-[0_22px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl md:bottom-5 md:left-5"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-yellow-200/10 text-yellow-50">✦</span>
        <span className="min-w-0">
          <span className="block text-[0.58rem] font-black uppercase tracking-[0.16em] text-cyan-100/50">
            Tutorial paused · {journey.completed_steps}/{journey.total_steps}
          </span>
          <span className="mt-0.5 block truncate text-sm font-black text-white">
            Resume: {currentStep.title}
          </span>
        </span>
      </button>
    );
  }

  return (
    <SpotlightTour
      step={currentStep}
      journey={journey}
      progress={progress}
      rect={targetRect}
      locating={locatingTarget || pathname !== currentStep.href}
      advancing={advancing}
      interactionOpen={activeInteraction === currentStep.target}
      onAction={() => void performStepAction()}
      onPause={() => setTourPaused(true)}
    />
  );
}

function SpotlightTour({
  step,
  journey,
  progress,
  rect,
  locating,
  advancing,
  interactionOpen,
  onAction,
  onPause,
}: {
  step: JourneyStep;
  journey: JourneyRow;
  progress: number;
  rect: SpotlightRect | null;
  locating: boolean;
  advancing: boolean;
  interactionOpen: boolean;
  onAction: () => void;
  onPause: () => void;
}) {
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const tooltipWidth = Math.min(390, Math.max(280, viewportWidth - 24));
  const tooltipLeft = rect
    ? clamp(rect.left, 12, Math.max(12, viewportWidth - tooltipWidth - 12))
    : Math.max(12, (viewportWidth - tooltipWidth) / 2);
  const fitsBelow = rect ? viewportHeight - rect.bottom >= 285 : false;
  const tooltipTop = rect
    ? fitsBelow
      ? rect.bottom + 12
      : Math.max(12, rect.top - 270)
    : Math.max(12, viewportHeight / 2 - 150);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Tutorial step ${step.number}`}>
      {rect ? (
        <>
          <div className="fixed inset-x-0 top-0 z-[180] bg-[#01020b]/86" style={{ height: rect.top }} />
          <div className="fixed left-0 z-[180] bg-[#01020b]/86" style={{ top: rect.top, width: rect.left, height: rect.height }} />
          <div className="fixed right-0 z-[180] bg-[#01020b]/86" style={{ top: rect.top, width: Math.max(0, viewportWidth - rect.right), height: rect.height }} />
          <div className="fixed inset-x-0 bottom-0 z-[180] bg-[#01020b]/86" style={{ top: rect.bottom }} />
          <div
            className="pointer-events-none fixed z-[181] rounded-2xl border-2 border-yellow-100 shadow-[0_0_0_4px_rgba(250,204,21,0.12),0_0_45px_rgba(103,232,249,0.34)]"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[180] bg-[#01020b]/88" />
      )}

      {!interactionOpen ? (
        <section
          className="fixed z-[182] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[1.6rem] border border-yellow-100/25 bg-[#090b29]/98 shadow-[0_28px_90px_rgba(0,0,0,0.78)] backdrop-blur-2xl"
          style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
        >
        <div className="h-1 bg-gradient-to-r from-cyan-200 via-yellow-100 to-violet-300" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-yellow-100/20 bg-yellow-200/10 text-sm font-black text-yellow-50">
              {step.number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100/50">
                Nebu’s guided tutorial
              </p>
              <h2 className="mt-1 text-lg font-black text-white">{step.title}</h2>
            </div>
            <button
              type="button"
              onClick={onPause}
              className="flex h-9 flex-none items-center rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.65rem] font-black text-white/55 hover:bg-white/10 hover:text-white"
            >
              Pause
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/38">
            <span>Step {step.number} of {journey.total_steps}</span>
            <span>{journey.completed_steps} complete</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-200 to-violet-300 transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-white/58">
            {step.description}
          </p>
          <p className="mt-3 rounded-xl border border-cyan-100/12 bg-cyan-200/[0.055] px-3 py-2.5 text-xs font-bold leading-5 text-cyan-50/75">
            {locating ? "Taking you to the correct section…" : step.instruction}
          </p>

          <button
            type="button"
            onClick={onAction}
            disabled={locating || advancing}
            className="mt-4 min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-4 text-sm font-black text-[#111329] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          >
            {advancing ? "Nebu is opening the next step…" : step.action}
          </button>
        </div>
        </section>
      ) : null}
    </div>
  );
}

function CompletionCelebration({
  displayName,
  onClose,
}: {
  displayName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[195] flex items-center justify-center overflow-hidden bg-[#02030d]/92 px-4 py-8 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_28%_62%,rgba(103,232,249,0.1),transparent_28%),radial-gradient(circle_at_75%_68%,rgba(196,181,253,0.12),transparent_30%)]" />
      {Array.from({ length: 24 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute animate-pulse rounded-full bg-yellow-100 shadow-[0_0_14px_rgba(254,240,138,0.8)]"
          style={{
            left: `${(index * 37 + 7) % 96}%`,
            top: `${(index * 53 + 9) % 90}%`,
            width: `${2 + (index % 3)}px`,
            height: `${2 + (index % 3)}px`,
            animationDelay: `${(index % 8) * 180}ms`,
          }}
        />
      ))}

      <section className="relative w-full max-w-lg overflow-hidden rounded-[2.4rem] border border-yellow-100/25 bg-[#090b29]/98 text-center shadow-[0_42px_150px_rgba(0,0,0,0.8)]">
        <div className="h-1.5 bg-gradient-to-r from-cyan-200 via-yellow-100 to-violet-300" />
        <div className="px-6 py-9 sm:px-10 sm:py-11">
          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-5 animate-pulse rounded-full bg-yellow-200/20 blur-3xl" />
            <div className="absolute inset-2 rounded-full border border-dashed border-cyan-100/25" />
            <NebuPortrait
              alt="Nebu"
              draggable={false}
              className="relative h-32 w-32 object-contain drop-shadow-[0_22px_30px_rgba(0,0,0,0.55)]"
            />
          </div>
          <p className="mt-5 text-[0.65rem] font-black uppercase tracking-[0.24em] text-yellow-100/55">
            Your path is open
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Happy wishes, {firstName(displayName)}!
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-7 text-white/58">
            You now know the entire journey: shape your identity, make wishes,
            collect real cards in your Binder and revisit every memory among the stars.
          </p>
          <p className="mt-4 text-base font-black text-yellow-50">
            Nebu will be waiting in the Wish Chamber. ✦
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 min-h-13 w-full rounded-2xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-6 text-sm font-black text-[#101225] transition hover:brightness-110"
          >
            Begin my adventure
          </button>
        </div>
      </section>
    </div>
  );
}
