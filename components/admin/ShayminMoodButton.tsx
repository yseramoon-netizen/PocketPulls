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

export default function ShayminMoodButton() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const heldRef = useRef(false);
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [moodKey, setMoodKey] =
    useState<ShayminMoodKey>("content");
  const [holdProgress, setHoldProgress] = useState(0);
  const [hint, setHint] = useState(false);

  const loadMood = useCallback(async () => {
    try {
      const response = await adminFetch<ShayminResponse>(
        "/api/admin/shaymin",
      );
      setMoodKey(response.mood.key);
    } catch {
      // Navigation remains usable while the care endpoint is unavailable.
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
      const detail = (
        event as CustomEvent<{
          mood?: ShayminMoodKey;
        }>
      ).detail;

      if (detail?.mood) {
        setMoodKey(detail.mood);
      } else {
        void loadMood();
      }
    };

    const handleFocus = () => void loadMood();

    window.addEventListener(
      "pocketpulls:shaymin-mood",
      handleMoodChange,
    );
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "pocketpulls:shaymin-mood",
        handleMoodChange,
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadMood]);

  const cancelTimers = useCallback(() => {
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
    cancelTimers();
    activeRef.current = false;
    pointerIdRef.current = null;
    setHoldProgress(0);
  }, [cancelTimers]);

  useEffect(
    () => () => resetHold(),
    [resetHold],
  );

  const animateHold = useCallback(() => {
    const elapsed = Date.now() - startRef.current;
    const progress = Math.min(
      100,
      (elapsed / HOLD_MS) * 100,
    );

    setHoldProgress(progress);

    if (progress < 100 && activeRef.current) {
      frameRef.current = window.requestAnimationFrame(
        animateHold,
      );
    }
  }, []);

  function beginHold() {
    resetHold();
    activeRef.current = true;
    heldRef.current = false;
    startRef.current = Date.now();
    setHint(false);

    frameRef.current = window.requestAnimationFrame(
      animateHold,
    );

    timerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      activeRef.current = false;
      setHoldProgress(100);
      openTreeGate();
      router.push("/admin/tree");
    }, HOLD_MS);
  }

  function finishHold() {
    const completed = heldRef.current;
    resetHold();

    if (!completed) {
      router.push("/admin/shaymin");
    }
  }

  const mood = getShayminMood(moodKey);

  return (
    <div className="relative flex flex-none items-center">
      <button
        type="button"
        aria-label={`${mood.label}. Click for companion care. Press and hold for The Tree We Grow.`}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginHold();
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          if (
            pointerIdRef.current !== null &&
            event.currentTarget.hasPointerCapture(pointerIdRef.current)
          ) {
            event.currentTarget.releasePointerCapture(
              pointerIdRef.current,
            );
          }
          finishHold();
        }}
        onPointerCancel={resetHold}
        onContextMenu={(event: MouseEvent<HTMLButtonElement>) =>
          event.preventDefault()
        }
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (
            !event.repeat &&
            (event.key === " " || event.key === "Enter")
          ) {
            event.preventDefault();
            beginHold();
          }
        }}
        onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            finishHold();
          }
        }}
        onMouseEnter={() => setHint(true)}
        onMouseLeave={() => setHint(false)}
        className="group relative flex h-12 w-12 select-none items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-lime-200"
        style={{ touchAction: "none" }}
      >
        <span
          className="absolute -inset-1 rounded-[1.2rem] opacity-75 blur-md transition group-hover:opacity-100"
          style={{
            background: `conic-gradient(${mood.accent} ${holdProgress}%, rgba(255,255,255,0.055) ${holdProgress}% 100%)`,
          }}
        />

        <span className="relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-100/25 bg-emerald-200/10 shadow-[inset_0_0_20px_rgba(110,231,183,0.08),0_8px_30px_rgba(0,0,0,0.22)]">
          <span
            className={`absolute inset-0 bg-gradient-to-br ${mood.aura}`}
          />
          <img
            key={mood.key}
            src={mood.image}
            alt=""
            draggable={false}
            className="relative h-full w-full select-none object-contain p-0.5 transition duration-300 group-hover:scale-105"
          />
        </span>
      </button>

      {hint ? (
        <div className="pointer-events-none absolute left-0 top-[3.55rem] z-[120] w-60 rounded-2xl border border-emerald-100/20 bg-[#061a13]/97 px-4 py-3 text-xs font-bold leading-5 text-emerald-50 shadow-[0_20px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <p className="font-black text-white">
            {mood.label}
          </p>
          <p className="mt-1 text-white/45">
            Click for care. Hold for the shared tree.
          </p>
        </div>
      ) : null}
    </div>
  );
}
