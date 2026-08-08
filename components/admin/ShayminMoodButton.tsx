"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import ProtectedShayminImage from "@/components/admin/ProtectedShayminImage";
import { adminFetch } from "@/lib/admin/client-auth";
import {
  getShayminMood,
  type ShayminMoodKey,
} from "@/lib/admin/shaymin-care";
import { openTreeGate } from "@/lib/admin/tree-gate";

type ShayminResponse = {
  ok: true;
  mood: {
    key: ShayminMoodKey;
  };
};

const HOLD_MS = 900;
const MOVE_CANCEL_PX = 18;

export default function ShayminMoodButton() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  const [moodKey, setMoodKey] = useState<ShayminMoodKey>("content");
  const [holdProgress, setHoldProgress] = useState(0);
  const [hint, setHint] = useState(false);

  const loadMood = useCallback(async () => {
    try {
      const response = await adminFetch<ShayminResponse>("/api/admin/shaymin");
      setMoodKey(response.mood.key);
    } catch {
      // Keep the button usable even if the care endpoint is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadMood();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMood();
      }
    }, 60_000);

    const handleMoodChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mood?: ShayminMoodKey }>).detail;

      if (detail?.mood) {
        setMoodKey(detail.mood);
      } else {
        void loadMood();
      }
    };

    const handleFocus = () => void loadMood();

    window.addEventListener("pocketpulls:shaymin-mood", handleMoodChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pocketpulls:shaymin-mood", handleMoodChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadMood]);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const resetHold = useCallback(() => {
    clearTimers();
    holdActiveRef.current = false;
    pointerIdRef.current = null;
    startPointRef.current = null;
    setHoldProgress(0);
  }, [clearTimers]);

  useEffect(() => () => resetHold(), [resetHold]);

  const animateHold = useCallback(() => {
    if (!holdActiveRef.current) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(100, (elapsed / HOLD_MS) * 100);
    setHoldProgress(progress);

    if (progress < 100) {
      frameRef.current = window.requestAnimationFrame(animateHold);
    }
  }, []);

  const triggerTreeNavigation = useCallback(() => {
    longPressTriggeredRef.current = true;
    suppressNextClickRef.current = true;
    holdActiveRef.current = false;
    clearTimers();
    setHoldProgress(100);
    openTreeGate();
    router.push("/admin/tree");
  }, [clearTimers, router]);

  const beginHold = useCallback((point?: { x: number; y: number }) => {
    resetHold();
    holdActiveRef.current = true;
    longPressTriggeredRef.current = false;
    startTimeRef.current = Date.now();
    startPointRef.current = point ?? null;
    setHint(false);

    frameRef.current = window.requestAnimationFrame(animateHold);
    timerRef.current = window.setTimeout(triggerTreeNavigation, HOLD_MS);
  }, [animateHold, resetHold, triggerTreeNavigation]);

  const cancelHold = useCallback(() => {
    resetHold();
  }, [resetHold]);

  const mood = getShayminMood(moodKey);

  return (
    <div className="relative flex flex-none items-center">
      <button
        type="button"
        aria-label={`${mood.label}. Tap for companion care. Press and hold for The Tree We Grow.`}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          event.preventDefault();
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginHold({ x: event.clientX, y: event.clientY });
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
          if (!holdActiveRef.current || !startPointRef.current) {
            return;
          }

          const dx = event.clientX - startPointRef.current.x;
          const dy = event.clientY - startPointRef.current.y;
          const moved = Math.hypot(dx, dy);

          if (moved > MOVE_CANCEL_PX && !longPressTriggeredRef.current) {
            cancelHold();
          }
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (
            pointerIdRef.current !== null &&
            event.currentTarget.hasPointerCapture(pointerIdRef.current)
          ) {
            event.currentTarget.releasePointerCapture(pointerIdRef.current);
          }

          if (!longPressTriggeredRef.current) {
            resetHold();
          }
        }}
        onPointerLeave={() => {
          if (holdActiveRef.current && !longPressTriggeredRef.current) {
            cancelHold();
          }
        }}
        onPointerCancel={(event) => { event.preventDefault(); cancelHold(); }}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          if (suppressNextClickRef.current || longPressTriggeredRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressNextClickRef.current = false;
            longPressTriggeredRef.current = false;
            return;
          }

          router.push("/admin/shaymin");
        }}
        onContextMenu={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (!event.repeat && (event.key === " " || event.key === "Enter")) {
            event.preventDefault();
            beginHold();
          }
        }}
        onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key !== " " && event.key !== "Enter") {
            return;
          }

          event.preventDefault();

          if (longPressTriggeredRef.current) {
            suppressNextClickRef.current = true;
            longPressTriggeredRef.current = false;
            resetHold();
            return;
          }

          resetHold();
          router.push("/admin/shaymin");
        }}
        onMouseEnter={() => setHint(true)}
        onMouseLeave={() => setHint(false)}
        className="group relative flex h-12 w-12 select-none items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-lime-200"
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <span
          className="absolute -inset-1 rounded-[1.2rem] opacity-75 blur-md transition group-hover:opacity-100"
          style={{
            background: `conic-gradient(${mood.accent} ${holdProgress}%, rgba(255,255,255,0.055) ${holdProgress}% 100%)`,
          }}
        />

        <span className="relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-100/25 bg-emerald-200/10 shadow-[inset_0_0_20px_rgba(110,231,183,0.08),0_8px_30px_rgba(0,0,0,0.22)]">
          <span className={`absolute inset-0 bg-gradient-to-br ${mood.aura}`} />
          <ProtectedShayminImage
            key={mood.key}
            mood={mood.key}
            alt=""
            className="pointer-events-none relative h-full w-full select-none object-contain p-0.5 transition duration-300 group-hover:scale-105"
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
          />
        </span>
      </button>

      {hint ? (
        <div className="pointer-events-none absolute left-0 top-[3.55rem] z-[120] w-60 rounded-2xl border border-emerald-100/20 bg-[#061a13]/97 px-4 py-3 text-xs font-bold leading-5 text-emerald-50 shadow-[0_20px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <p className="font-black text-white">{mood.label}</p>
          <p className="mt-1 text-white/45">Tap for care. Hold for the shared tree.</p>
        </div>
      ) : null}
    </div>
  );
}
