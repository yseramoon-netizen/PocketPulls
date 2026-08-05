"use client";

import {
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
} from "@/lib/admin/shaymin-moods";
import { openTreeGate } from "@/lib/admin/tree-gate";

type ShayminResponse = {
  ok: true;
  mood: {
    key: ShayminMoodKey;
    label: string;
    whisper: string;
    reason: string;
    mode: "automatic" | "manual";
  };
};

const HOLD_MS = 900;

export default function ShayminMoodButton() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const heldRef = useRef(false);

  const [moodKey, setMoodKey] =
    useState<ShayminMoodKey>("content");
  const [holdProgress, setHoldProgress] =
    useState(0);
  const [hint, setHint] = useState(false);
  const [sparkle, setSparkle] = useState(false);

  const loadMood = useCallback(async () => {
    try {
      const response =
        await adminFetch<ShayminResponse>(
          "/api/admin/shaymin",
        );
      setMoodKey(response.mood.key);
    } catch {
      // The nav should remain usable even if the mood endpoint is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadMood();

    const timer = window.setInterval(
      () => void loadMood(),
      60_000,
    );

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

    window.addEventListener(
      "pocketpulls:shaymin-mood",
      handleMoodChange,
    );

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "pocketpulls:shaymin-mood",
        handleMoodChange,
      );
    };
  }, [loadMood]);

  const cancelHold = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    setHoldProgress(0);
  }, []);

  useEffect(
    () => () => cancelHold(),
    [cancelHold],
  );

  function animateHold() {
    const elapsed = Date.now() - startRef.current;
    const progress = Math.min(100, (elapsed / HOLD_MS) * 100);
    setHoldProgress(progress);

    if (progress < 100) {
      frameRef.current = window.requestAnimationFrame(
        animateHold,
      );
    }
  }

  function beginHold() {
    cancelHold();
    heldRef.current = false;
    startRef.current = Date.now();
    setHint(false);
    setSparkle(true);
    window.setTimeout(() => setSparkle(false), 500);
    frameRef.current = window.requestAnimationFrame(
      animateHold,
    );

    timerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      setHoldProgress(100);
      openTreeGate();
      router.push("/admin/tree");
    }, HOLD_MS);
  }

  function finishHold() {
    const completed = heldRef.current;
    cancelHold();

    if (!completed) {
      setHint(true);
      window.setTimeout(() => setHint(false), 2600);
    }
  }

  const mood = getShayminMood(moodKey);

  return (
    <div className="relative flex flex-none items-center">
      <button
        type="button"
        aria-label={`${mood.label}. Press and hold Shaymin to open The Tree We Grow.`}
        onPointerDown={beginHold}
        onPointerUp={finishHold}
        onPointerCancel={cancelHold}
        onPointerLeave={finishHold}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (
            !event.repeat &&
            (event.key === " " || event.key === "Enter")
          ) {
            event.preventDefault();
            beginHold();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            finishHold();
          }
        }}
        className="group relative flex h-12 w-12 select-none items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-lime-200"
        style={{ touchAction: "manipulation" }}
      >
        <span
          className="absolute -inset-1 rounded-[1.2rem] opacity-80 blur-md transition group-hover:opacity-100"
          style={{
            background: `conic-gradient(rgba(190,242,100,0.9) ${holdProgress}%, rgba(255,255,255,0.06) ${holdProgress}% 100%)`,
          }}
        />

        <span className="relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-100/25 bg-emerald-200/10 shadow-[inset_0_0_20px_rgba(110,231,183,0.08),0_8px_30px_rgba(0,0,0,0.22)]">
          <span
            className={`absolute inset-0 bg-gradient-to-br ${mood.aura}`}
          />
          <img
            src={mood.image}
            alt=""
            draggable={false}
            className="relative h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
          />
        </span>

        {sparkle ? (
          <>
            <span className="pointer-events-none absolute -right-1 -top-1 animate-ping text-sm text-yellow-100">✦</span>
            <span className="pointer-events-none absolute -bottom-1 -left-1 animate-ping text-xs text-lime-100">✧</span>
          </>
        ) : null}
      </button>

      {hint ? (
        <div className="pointer-events-none absolute left-0 top-[3.55rem] z-[90] w-52 rounded-2xl border border-lime-100/20 bg-[#071c14]/96 px-4 py-3 text-xs font-bold leading-5 text-emerald-50 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <span className="font-black text-lime-100">A tiny secret:</span>
          <br />
          Hold Shaymin to visit the tree you and Skye grow together.
        </div>
      ) : null}
    </div>
  );
}
