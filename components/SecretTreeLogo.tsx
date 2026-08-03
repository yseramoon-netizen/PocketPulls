"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Founder = "lukas" | "skye";

type MoodId =
  | "sleeping"
  | "morning"
  | "worried"
  | "celebration"
  | "together"
  | "lukas"
  | "skye"
  | "busy"
  | "gardener"
  | "seed"
  | "content";

type MoodResponse = {
  success?: boolean;

  viewerFounder?: Founder | null;
  viewerName?: string;

  mood?: {
    id: MoodId;
    title: string;
    message: string;
    detail: string;
  };

  stats?: {
    currentValue: number;
    totalUnits: number;
    uniqueCards: number;

    addedToday: number;
    valueAddedToday: number;

    issueCount: number;

    founderActivity: {
      lukas: number;
      skye: number;
    };
  };

  tree?: {
    peakValue: number;
    targetValue: number;

    nextMilestone: {
      value: number;
      label: string;
    } | null;

    amountToNext: number;
  };

  updatedAt?: string;
  error?: string;
};

const HOLD_DURATION_MS = 1400;
const MOOD_REFRESH_MS = 60_000;

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",

      maximumFractionDigits:
        value >= 100_000
          ? 0
          : 2,
    },
  ).format(value);
}

function wait(
  milliseconds: number,
) {
  return new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function fallbackMood(): MoodResponse {
  const hour =
    new Date().getHours();

  if (hour < 5) {
    return {
      success: true,

      mood: {
        id: "sleeping",

        title:
          "Shaymin is sleeping",

        message:
          "The forest is quiet, but Shaymin is still here.",

        detail:
          "Live business information will return when the connection recovers.",
      },

      stats: {
        currentValue: 0,
        totalUnits: 0,
        uniqueCards: 0,
        addedToday: 0,
        valueAddedToday: 0,
        issueCount: 0,

        founderActivity: {
          lukas: 0,
          skye: 0,
        },
      },
    };
  }

  if (hour < 8) {
    return {
      success: true,

      mood: {
        id: "morning",

        title: "Morning dew",

        message:
          "The forest is waking up.",

        detail:
          "Shaymin is waiting for the live PocketPulls connection.",
      },

      stats: {
        currentValue: 0,
        totalUnits: 0,
        uniqueCards: 0,
        addedToday: 0,
        valueAddedToday: 0,
        issueCount: 0,

        founderActivity: {
          lukas: 0,
          skye: 0,
        },
      },
    };
  }

  return {
    success: true,

    mood: {
      id: "content",

      title:
        "The forest is peaceful",

      message:
        "Shaymin is watching over PocketPulls.",

      detail:
        "Live business information will return when the connection recovers.",
    },

    stats: {
      currentValue: 0,
      totalUnits: 0,
      uniqueCards: 0,
      addedToday: 0,
      valueAddedToday: 0,
      issueCount: 0,

      founderActivity: {
        lukas: 0,
        skye: 0,
      },
    },
  };
}

function moodBorder(
  mood: MoodId | null,
): string {
  if (
    mood === "celebration"
  ) {
    return `
      border-amber-200/40
      bg-amber-300/10
      shadow-[0_0_32px_rgba(253,230,138,0.25)]
    `;
  }

  if (mood === "worried") {
    return `
      border-red-200/35
      bg-red-300/10
      shadow-[0_0_25px_rgba(252,165,165,0.18)]
    `;
  }

  if (mood === "together") {
    return `
      border-violet-200/35
      bg-violet-300/10
      shadow-[0_0_30px_rgba(196,181,253,0.22)]
    `;
  }

  if (mood === "lukas") {
    return `
      border-indigo-200/35
      bg-indigo-300/10
    `;
  }

  if (mood === "skye") {
    return `
      border-cyan-200/35
      bg-cyan-300/10
    `;
  }

  if (mood === "sleeping") {
    return `
      border-blue-200/20
      bg-blue-300/[0.06]
    `;
  }

  return `
    border-emerald-200/25
    bg-emerald-300/[0.07]
    shadow-[0_0_25px_rgba(110,231,183,0.12)]
  `;
}

export default function SecretTreeLogo() {
  const router = useRouter();

  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const startedAtRef =
    useRef(0);

  const frameRef =
    useRef<number | null>(
      null,
    );

  const completedRef =
    useRef(false);

  const [holding, setHolding] =
    useState(false);

  const [
    holdProgress,
    setHoldProgress,
  ] = useState(0);

  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    liveConnection,
    setLiveConnection,
  ] = useState(true);

  const [
    response,
    setResponse,
  ] = useState<MoodResponse>(
    fallbackMood(),
  );

  const mood =
    response.mood || null;

  const moodId =
    mood?.id || null;

  const requestMood =
    useCallback(
      async (
        accessToken: string,
      ): Promise<MoodResponse> => {
        const url =
          new URL(
            "/api/shaymin/mood",
            window.location.origin,
          ).toString();

        let finalError:
          unknown = null;

        for (
          let attempt = 0;
          attempt < 2;
          attempt += 1
        ) {
          try {
            const request =
              await fetch(url, {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,

                  Accept:
                    "application/json",
                },

                credentials:
                  "same-origin",

                cache: "no-store",
              });

            const text =
              await request.text();

            let payload:
              MoodResponse;

            try {
              payload =
                JSON.parse(
                  text,
                ) as MoodResponse;
            } catch {
              throw new Error(
                `Shaymin received invalid data from the server. Status ${request.status}.`,
              );
            }

            if (
              !request.ok ||
              !payload.success
            ) {
              throw new Error(
                payload.error ||
                  `Shaymin request failed with status ${request.status}.`,
              );
            }

            return payload;
          } catch (
            requestError: unknown
          ) {
            finalError =
              requestError;

            if (attempt === 0) {
              await wait(600);
            }
          }
        }

        throw finalError instanceof Error
          ? finalError
          : new Error(
              "Shaymin could not reach the server.",
            );
      },
      [],
    );

  const loadMood =
    useCallback(
      async (
        background = false,
      ) => {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        try {
          const {
            data: { session },
            error: sessionError,
          } =
            await supabase.auth.getSession();

          if (
            sessionError ||
            !session?.access_token
          ) {
            throw new Error(
              "Your admin session could not be found.",
            );
          }

          const payload =
            await requestMood(
              session.access_token,
            );

          setResponse(payload);
          setLiveConnection(true);
        } catch (
          moodError: unknown
        ) {
          console.error(
            "Shaymin mood error:",
            moodError,
          );

          setLiveConnection(false);

          setResponse(
            (current) =>
              current.mood
                ? current
                : fallbackMood(),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [requestMood],
    );

  useEffect(() => {
    router.prefetch(
      "/admin/tree",
    );

    void loadMood(false);

    const intervalId =
      window.setInterval(() => {
        void loadMood(true);
      }, MOOD_REFRESH_MS);

    function refreshOnFocus() {
      void loadMood(true);
    }

    function refreshWhenVisible() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadMood(true);
      }
    }

    window.addEventListener(
      "focus",
      refreshOnFocus,
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      window.removeEventListener(
        "focus",
        refreshOnFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(
          frameRef.current,
        );
      }
    };
  }, [
    loadMood,
    router,
  ]);

  useEffect(() => {
    function closeOutside(
      event: globalThis.PointerEvent,
    ) {
      const target =
        event.target as Node;

      if (
        rootRef.current &&
        !rootRef.current.contains(
          target,
        )
      ) {
        setOpen(false);
      }
    }

    function closeWithEscape(
      event: globalThis.KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      closeOutside,
    );

    document.addEventListener(
      "keydown",
      closeWithEscape,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOutside,
      );

      document.removeEventListener(
        "keydown",
        closeWithEscape,
      );
    };
  }, []);

  function stopHold() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(
        frameRef.current,
      );

      frameRef.current = null;
    }
  }

  function completeHold() {
    stopHold();

    completedRef.current = true;

    setHolding(false);
    setHoldProgress(1);
    setOpen(false);

    if ("vibrate" in navigator) {
      navigator.vibrate(40);
    }

    window.setTimeout(() => {
      router.push(
        "/admin/tree",
      );
    }, 120);
  }

  function animateHold(
    timestamp: number,
  ) {
    const elapsed =
      timestamp -
      startedAtRef.current;

    const progress =
      Math.min(
        1,
        elapsed /
          HOLD_DURATION_MS,
      );

    setHoldProgress(progress);

    if (progress >= 1) {
      completeHold();
      return;
    }

    frameRef.current =
      window.requestAnimationFrame(
        animateHold,
      );
  }

  function beginHold() {
    if (holding) {
      return;
    }

    stopHold();

    completedRef.current = false;

    startedAtRef.current =
      performance.now();

    setHolding(true);
    setHoldProgress(0);

    frameRef.current =
      window.requestAnimationFrame(
        animateHold,
      );
  }

  function cancelHold() {
    if (completedRef.current) {
      return;
    }

    stopHold();

    setHolding(false);
    setHoldProgress(0);
  }

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    beginHold();
  }

  function handlePointerUp(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    const completed =
      completedRef.current;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (completed) {
      return;
    }

    cancelHold();

    setOpen(
      (current) => !current,
    );
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (
      event.repeat ||
      (
        event.key !== "Enter" &&
        event.key !== " "
      )
    ) {
      return;
    }

    event.preventDefault();
    beginHold();
  }

  function handleKeyUp(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();

    if (completedRef.current) {
      return;
    }

    cancelHold();

    setOpen(
      (current) => !current,
    );
  }

  const degrees =
    Math.round(
      holdProgress * 360,
    );

  const ringBackground =
    holdProgress > 0
      ? `conic-gradient(rgb(110 231 183) ${degrees}deg, rgb(255 255 255 / 0.08) ${degrees}deg)`
      : "rgb(255 255 255 / 0.08)";

  return (
    <div
      ref={rootRef}
      className="
        relative
        flex-none
      "
    >
      <div
        className="
          rounded-[1.45rem]
          p-[3px]
        "
        style={{
          background:
            ringBackground,
        }}
      >
        <button
          type="button"
          aria-label="Click Shaymin to talk. Hold Shaymin to visit the tree."
          aria-expanded={open}
          title="Click to talk. Hold to visit the tree."
          onPointerDown={
            handlePointerDown
          }
          onPointerUp={
            handlePointerUp
          }
          onPointerCancel={
            cancelHold
          }
          onLostPointerCapture={() => {
            if (
              !completedRef.current
            ) {
              cancelHold();
            }
          }}
          onKeyDown={
            handleKeyDown
          }
          onKeyUp={
            handleKeyUp
          }
          onContextMenu={(event) =>
            event.preventDefault()
          }
          style={{
            touchAction: "none",
          }}
          className={`
            group
            relative
            flex
            h-14
            w-14
            select-none
            items-center
            justify-center
            overflow-visible
            rounded-[1.25rem]
            border
            bg-[#071d16]
            transition
            duration-300
            ${moodBorder(moodId)}
            ${
              holding
                ? "scale-95"
                : "hover:-translate-y-0.5"
            }
          `}
        >
          {moodId === "sleeping" && (
            <span
              className="
                pointer-events-none
                absolute
                -right-2
                -top-3
                z-20
                text-[0.65rem]
                font-black
                text-blue-100
              "
            >
              Zz
            </span>
          )}

          {moodId === "morning" && (
            <span
              className="
                pointer-events-none
                absolute
                -right-1
                -top-1
                h-5
                w-5
                animate-pulse
                rounded-full
                bg-amber-200
                shadow-[0_0_18px_rgba(253,230,138,0.8)]
              "
            />
          )}

          {moodId === "worried" && (
            <span
              className="
                pointer-events-none
                absolute
                -right-2
                -top-2
                z-20
                flex
                h-5
                w-5
                animate-bounce
                items-center
                justify-center
                rounded-full
                bg-red-300
                text-xs
                font-black
                text-red-950
              "
            >
              !
            </span>
          )}

          {moodId ===
            "celebration" && (
            <span
              className="
                pointer-events-none
                absolute
                -top-3
                left-1/2
                z-20
                -translate-x-1/2
                text-xl
              "
            >
              👑
            </span>
          )}

          {(moodId === "lukas" ||
            moodId ===
              "together") && (
            <span
              className="
                pointer-events-none
                absolute
                -bottom-2
                -left-2
                z-20
                text-lg
              "
            >
              🌙
            </span>
          )}

          {(moodId === "skye" ||
            moodId ===
              "together") && (
            <span
              className="
                pointer-events-none
                absolute
                -right-2
                -top-2
                z-20
                animate-pulse
                text-lg
              "
            >
              ⭐
            </span>
          )}

          {moodId === "busy" && (
            <span
              className="
                pointer-events-none
                absolute
                -bottom-2
                -right-2
                z-20
                text-lg
              "
            >
              📦
            </span>
          )}

          {moodId ===
            "gardener" && (
            <span
              className="
                pointer-events-none
                absolute
                -bottom-2
                -right-2
                z-20
                text-lg
              "
            >
              🌱
            </span>
          )}

          {moodId === "content" && (
            <span
              className="
                pointer-events-none
                absolute
                -bottom-2
                -right-2
                z-20
                text-lg
              "
            >
              🌸
            </span>
          )}

          <img
            src="/shaymin.png"
            alt=""
            draggable={false}
            className={`
              relative
              z-10
              h-11
              w-11
              object-contain
              transition
              duration-500
              ${
                holding
                  ? `
                    scale-110
                    drop-shadow-[0_0_15px_rgba(110,231,183,0.9)]
                  `
                  : moodId ===
                      "sleeping"
                    ? `
                      -rotate-6
                      scale-95
                    `
                    : `
                      group-hover:scale-105
                    `
              }
            `}
          />

          <span
            className={`
              absolute
              bottom-1
              right-1
              z-30
              h-2
              w-2
              rounded-full
              ${
                loading ||
                refreshing
                  ? `
                    animate-pulse
                    bg-cyan-200
                  `
                  : liveConnection
                    ? `
                      bg-emerald-300
                      shadow-[0_0_8px_rgba(110,231,183,0.9)]
                    `
                    : `
                      bg-amber-300
                    `
              }
            `}
          />
        </button>
      </div>

      {holding && (
        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[calc(100%+0.65rem)]
            z-[110]
            -translate-x-1/2
            whitespace-nowrap
            rounded-full
            border
            border-emerald-200/15
            bg-[#03150f]
            px-3
            py-1.5
            text-[0.62rem]
            font-black
            uppercase
            tracking-[0.13em]
            text-emerald-100
            shadow-xl
          "
        >
          Something is growing
        </div>
      )}

      {open && (
        <section
          className="
            fixed
            left-4
            right-4
            top-24
            z-[105]
            overflow-hidden
            rounded-[2rem]
            border
            border-emerald-200/20
            bg-[#041a12]/95
            text-white
            shadow-[0_35px_120px_rgba(0,0,0,0.65)]
            backdrop-blur-3xl
            sm:absolute
            sm:left-0
            sm:right-auto
            sm:top-[calc(100%+0.9rem)]
            sm:w-[25rem]
          "
        >
          <div
            className="
              h-1
              bg-gradient-to-r
              from-emerald-300
              via-cyan-200
              to-amber-200
            "
          />

          <div className="p-5">
            <div
              className="
                flex
                items-start
                gap-4
              "
            >
              <div
                className="
                  flex
                  h-16
                  w-16
                  flex-none
                  items-center
                  justify-center
                  rounded-[1.35rem]
                  border
                  border-emerald-200/15
                  bg-emerald-300/[0.07]
                "
              >
                <img
                  src="/shaymin.png"
                  alt="Shaymin"
                  className="
                    h-14
                    w-14
                    object-contain
                  "
                />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="
                    text-[0.6rem]
                    font-black
                    uppercase
                    tracking-[0.2em]
                    text-emerald-200/45
                  "
                >
                  Shaymin&apos;s mood
                </p>

                <h2
                  className="
                    mt-1
                    text-xl
                    font-black
                    text-white
                  "
                >
                  {mood?.title ||
                    "Listening to the forest"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="
                  flex
                  h-9
                  w-9
                  flex-none
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.05]
                  text-lg
                  text-white/50
                  hover:bg-white/10
                  hover:text-white
                "
                aria-label="Close Shaymin"
              >
                ×
              </button>
            </div>

            {!liveConnection && (
              <div
                className="
                  mt-4
                  rounded-xl
                  border
                  border-amber-200/15
                  bg-amber-300/[0.07]
                  px-4
                  py-3
                  text-xs
                  font-semibold
                  text-amber-100/70
                "
              >
                Live information is temporarily unavailable. Shaymin will reconnect automatically.
              </div>
            )}

            <div
              className="
                mt-5
                rounded-[1.4rem]
                border
                border-emerald-200/15
                bg-emerald-300/[0.06]
                p-4
              "
            >
              <p
                className="
                  text-sm
                  font-black
                  leading-6
                  text-emerald-50
                "
              >
                {mood?.message}
              </p>

              <p
                className="
                  mt-2
                  text-xs
                  font-semibold
                  leading-5
                  text-white/40
                "
              >
                {mood?.detail}
              </p>
            </div>

            <div
              className="
                mt-4
                grid
                grid-cols-2
                gap-3
              "
            >
              <MoodStat
                label="Vault value"
                value={formatCurrency(
                  response.stats
                    ?.currentValue || 0,
                )}
              />

              <MoodStat
                label="Added today"
                value={`${response.stats
                  ?.addedToday || 0} cards`}
              />

              <MoodStat
                label="Lukas"
                value={`${response.stats
                  ?.founderActivity
                  .lukas || 0} added`}
                symbol="🌙"
              />

              <MoodStat
                label="Skye"
                value={`${response.stats
                  ?.founderActivity
                  .skye || 0} added`}
                symbol="⭐"
              />
            </div>

            <div
              className="
                mt-4
                flex
                gap-3
              "
            >
              <button
                type="button"
                onClick={() =>
                  void loadMood(true)
                }
                disabled={refreshing}
                className="
                  min-h-11
                  flex-1
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.05]
                  px-4
                  text-xs
                  font-black
                  text-white/65
                  hover:bg-white/10
                  disabled:opacity-40
                "
              >
                {refreshing
                  ? "Listening..."
                  : "Listen again"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);

                  router.push(
                    "/admin/tree",
                  );
                }}
                className="
                  min-h-11
                  flex-1
                  rounded-xl
                  bg-emerald-300
                  px-4
                  text-xs
                  font-black
                  text-emerald-950
                  hover:bg-emerald-200
                "
              >
                Visit the tree
              </button>
            </div>

            <p
              className="
                mt-4
                text-center
                text-[0.6rem]
                font-black
                uppercase
                tracking-[0.14em]
                text-white/20
              "
            >
              Click to talk - Hold to enter the forest
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function MoodStat({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol?: string;
}) {
  return (
    <div
      className="
        rounded-[1.15rem]
        border
        border-white/10
        bg-black/15
        p-3
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        {symbol && (
          <span className="text-xs">
            {symbol}
          </span>
        )}

        <p
          className="
            text-[0.58rem]
            font-black
            uppercase
            tracking-[0.12em]
            text-white/30
          "
        >
          {label}
        </p>
      </div>

      <p
        className="
          mt-2
          truncate
          text-sm
          font-black
          text-white/80
        "
      >
        {value}
      </p>
    </div>
  );
}