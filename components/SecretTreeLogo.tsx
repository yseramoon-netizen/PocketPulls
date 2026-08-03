"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

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
  | "proud"
  | "busy"
  | "gardener"
  | "seed"
  | "content";

type MoodResponse = {
  success?: boolean;

  viewerFounder?: Founder | null;
  viewerName?: string;
  londonHour?: number;

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
    missingPriceCount?: number;
    missingApiIdCount?: number;
    missingImageCount?: number;
    missingLocationCount?: number;

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

type MoodLogEntry = {
  id: string;
  moodId: string;
  title: string;
  message: string;
  reason: string;
  recordedAt: string;
  signature: string;
};

const HOLD_DURATION_MS = 1400;
const REFRESH_INTERVAL_MS = 60000;
const MAX_POINTER_MOVEMENT = 30;

const MOOD_LOG_STORAGE_KEY =
  "pocketpulls-shaymin-mood-log-v2";

const MAX_MOOD_LOG_ENTRIES = 12;

const MOOD_IMAGES: Record<MoodId, string> = {
  sleeping:
    "/shaymin-moods/sleeping.png",

  morning:
    "/shaymin-moods/morning.png",

  worried:
    "/shaymin-moods/worried.png",

  celebration:
    "/shaymin-moods/celebration.png",

  together:
    "/shaymin-moods/together.png",

  lukas:
    "/shaymin-moods/lukas.png",

  skye:
    "/shaymin-moods/skye.png",

  proud:
    "/shaymin-moods/proud.png",

  busy:
    "/shaymin-moods/busy.png",

  gardener:
    "/shaymin-moods/gardener.png",

  seed:
    "/shaymin-moods/seed.png",

  content:
    "/shaymin-moods/content.png",
};

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",

      maximumFractionDigits:
        value >= 100000
          ? 0
          : 2,
    },
  ).format(value);
}

function formatLogTime(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function wait(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function createFallbackMood(): MoodResponse {
  const hour =
    new Date().getHours();

  let mood: NonNullable<
    MoodResponse["mood"]
  >;

  if (hour < 5) {
    mood = {
      id: "sleeping",

      title:
        "Shaymin is sleeping",

      message:
        "The forest is quiet, but Shaymin is still here.",

      detail:
        "Live PocketPulls information will return when the connection recovers.",
    };
  } else if (hour < 8) {
    mood = {
      id: "morning",

      title:
        "Morning dew",

      message:
        "The forest is waking up.",

      detail:
        "Shaymin is waiting for the live PocketPulls connection.",
    };
  } else {
    mood = {
      id: "content",

      title:
        "The forest is peaceful",

      message:
        "Shaymin is watching over PocketPulls.",

      detail:
        "Live PocketPulls information will return when the connection recovers.",
    };
  }

  return {
    success: true,

    viewerFounder: null,
    viewerName: "Founder",

    mood,

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

    tree: {
      peakValue: 0,
      targetValue: 1000000,

      nextMilestone: {
        value: 100,
        label:
          "The First Seed",
      },

      amountToNext: 100,
    },
  };
}

function hasReachedMillion(
  response: MoodResponse,
): boolean {
  const peakValue =
    Number(
      response.tree?.peakValue,
    ) || 0;

  const targetValue =
    Number(
      response.tree?.targetValue,
    ) || 1000000;

  return (
    targetValue > 0 &&
    peakValue >= targetValue
  );
}

function getMoodImage(
  response: MoodResponse,
): string {
  if (
    hasReachedMillion(response)
  ) {
    return "/shaymin-moods/golden.png";
  }

  const moodId =
    response.mood?.id ||
    "content";

  return (
    MOOD_IMAGES[moodId] ||
    MOOD_IMAGES.content
  );
}

function getMoodReason(
  response: MoodResponse,
  golden: boolean,
): string {
  if (golden) {
    return (
      "The highest recorded inventory value reached " +
      formatCurrency(
        response.tree?.targetValue ||
          1000000,
      ) +
      "."
    );
  }

  const moodId =
    response.mood?.id ||
    "content";

  const stats =
    response.stats;

  switch (moodId) {
    case "sleeping":
      return (
        "It is currently within Shaymin's late-night sleeping hours."
      );

    case "morning":
      return (
        "It is morning in London, so Shaymin has entered Morning Dew mode."
      );

    case "worried":
      return (
        `${stats?.issueCount || 0} inventory details currently need attention.`
      );

    case "celebration":
      return (
        "PocketPulls recently reached a new legacy tree milestone."
      );

    case "together":
      return (
        `Lukas added ${
          stats?.founderActivity
            .lukas || 0
        } cards and Skye added ${
          stats?.founderActivity
            .skye || 0
        } cards today.`
      );

    case "lukas":
      return (
        `Lukas has added ${
          stats?.founderActivity
            .lukas || 0
        } cards today.`
      );

    case "skye":
      return (
        `Skye has added ${
          stats?.founderActivity
            .skye || 0
        } cards today.`
      );

    case "busy":
      return (
        `${stats?.addedToday || 0} cards have entered the vault today.`
      );

    case "gardener": {
      const milestone =
        response.tree
          ?.nextMilestone;

      if (!milestone) {
        return (
          "The legacy tree is close to another stage of growth."
        );
      }

      return (
        `${formatCurrency(
          response.tree
            ?.amountToNext || 0,
        )} remains until ${milestone.label}.`
      );
    }

    case "seed":
      return (
        "The inventory does not yet contain enough valued cards for the tree to begin growing."
      );

    case "proud":
      return (
        "PocketPulls has reached a new inventory value record."
      );

    default:
      return (
        "The inventory is stable and no higher-priority mood condition is active."
      );
  }
}

function createMoodSignature(
  response: MoodResponse,
  golden: boolean,
): string {
  if (golden) {
    return "golden";
  }

  return (
    response.mood?.id ||
    "content"
  );
}

function readMoodLog(): MoodLogEntry[] {
  try {
    const value =
      window.localStorage.getItem(
        MOOD_LOG_STORAGE_KEY,
      );

    if (!value) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(value);

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    return parsed.filter(
      (
        entry,
      ): entry is MoodLogEntry => {
        if (
          typeof entry !==
            "object" ||
          entry === null
        ) {
          return false;
        }

        const candidate =
          entry as Partial<MoodLogEntry>;

        return (
          typeof candidate.id ===
            "string" &&
          typeof candidate.moodId ===
            "string" &&
          typeof candidate.title ===
            "string" &&
          typeof candidate.message ===
            "string" &&
          typeof candidate.reason ===
            "string" &&
          typeof candidate.recordedAt ===
            "string" &&
          typeof candidate.signature ===
            "string"
        );
      },
    );
  } catch {
    return [];
  }
}

function writeMoodLog(
  entries: MoodLogEntry[],
) {
  try {
    window.localStorage.setItem(
      MOOD_LOG_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch {
    // Shaymin still works when storage is unavailable.
  }
}

export default function SecretTreeLogo() {
  const router =
    useRouter();

  const mountedRef =
    useRef(true);

  const activePointerIdRef =
    useRef<number | null>(
      null,
    );

  const startPositionRef =
    useRef({
      x: 0,
      y: 0,
    });

  const holdStartedAtRef =
    useRef(0);

  const holdTimerRef =
    useRef<number | null>(
      null,
    );

  const progressTimerRef =
    useRef<number | null>(
      null,
    );

  const holdCompletedRef =
    useRef(false);

  const suppressClickRef =
    useRef(false);

  const [portalReady, setPortalReady] =
    useState(false);

  const [open, setOpen] =
    useState(false);

  const [holding, setHolding] =
    useState(false);

  const [
    holdProgress,
    setHoldProgress,
  ] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    liveConnection,
    setLiveConnection,
  ] = useState(true);

  const [
    showFullLog,
    setShowFullLog,
  ] = useState(false);

  const [
    moodLogReady,
    setMoodLogReady,
  ] = useState(false);

  const [
    moodLog,
    setMoodLog,
  ] = useState<MoodLogEntry[]>(
    [],
  );

  const [
    response,
    setResponse,
  ] = useState<MoodResponse>(
    createFallbackMood(),
  );

  const fallbackMood =
    createFallbackMood().mood!;

  const mood =
    response.mood ||
    fallbackMood;

  const moodId =
    mood.id;

  const golden =
    hasReachedMillion(
      response,
    );

  const moodImage =
    useMemo(
      () =>
        getMoodImage(
          response,
        ),
      [response],
    );

  const currentMoodReason =
    useMemo(
      () =>
        getMoodReason(
          response,
          golden,
        ),
      [
        response,
        golden,
      ],
    );

  const currentMoodSignature =
    useMemo(
      () =>
        createMoodSignature(
          response,
          golden,
        ),
      [
        response,
        golden,
      ],
    );

  const clearHoldTimers =
    useCallback(() => {
      if (
        holdTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          holdTimerRef.current,
        );

        holdTimerRef.current =
          null;
      }

      if (
        progressTimerRef.current !==
        null
      ) {
        window.clearInterval(
          progressTimerRef.current,
        );

        progressTimerRef.current =
          null;
      }
    }, []);

  const resetHold =
    useCallback(
      (
        suppressClick = false,
      ) => {
        clearHoldTimers();

        activePointerIdRef.current =
          null;

        holdCompletedRef.current =
          false;

        suppressClickRef.current =
          suppressClick;

        setHolding(false);
        setHoldProgress(0);
      },
      [clearHoldTimers],
    );

  const openTree =
    useCallback(() => {
      clearHoldTimers();

      activePointerIdRef.current =
        null;

      holdCompletedRef.current =
        true;

      suppressClickRef.current =
        true;

      setHolding(false);
      setHoldProgress(1);
      setOpen(false);

      if (
        typeof navigator !==
          "undefined" &&
        "vibrate" in navigator
      ) {
        navigator.vibrate(40);
      }

      router.push(
        "/admin/tree",
      );

      window.setTimeout(() => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        holdCompletedRef.current =
          false;

        setHoldProgress(0);
      }, 400);
    }, [
      clearHoldTimers,
      router,
    ]);

  const startHold =
    useCallback(
      (
        pointerId: number,
      ) => {
        clearHoldTimers();

        activePointerIdRef.current =
          pointerId;

        holdCompletedRef.current =
          false;

        suppressClickRef.current =
          false;

        holdStartedAtRef.current =
          performance.now();

        setHolding(true);
        setHoldProgress(0);

        progressTimerRef.current =
          window.setInterval(() => {
            const elapsed =
              performance.now() -
              holdStartedAtRef.current;

            setHoldProgress(
              Math.min(
                1,
                elapsed /
                  HOLD_DURATION_MS,
              ),
            );
          }, 25);

        holdTimerRef.current =
          window.setTimeout(
            openTree,
            HOLD_DURATION_MS,
          );
      },
      [
        clearHoldTimers,
        openTree,
      ],
    );

  const requestMood =
    useCallback(
      async (
        accessToken: string,
      ): Promise<MoodResponse> => {
        let lastError:
          unknown = null;

        for (
          let attempt = 0;
          attempt < 2;
          attempt += 1
        ) {
          try {
            const request =
              await fetch(
                "/api/shaymin/mood",
                {
                  method: "GET",

                  headers: {
                    Authorization:
                      `Bearer ${accessToken}`,

                    Accept:
                      "application/json",
                  },

                  credentials:
                    "same-origin",

                  cache:
                    "no-store",
                },
              );

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
                `Shaymin received an invalid response with status ${request.status}.`,
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
            error: unknown
          ) {
            lastError =
              error;

            if (
              attempt === 0
            ) {
              await wait(350);
            }
          }
        }

        throw (
          lastError instanceof Error
            ? lastError
            : new Error(
                "Shaymin could not reach the server.",
              )
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
            data: {
              session,
            },

            error:
              sessionError,
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

          if (
            !mountedRef.current
          ) {
            return;
          }

          setResponse(payload);
          setLiveConnection(true);
        } catch (
          error: unknown
        ) {
          console.error(
            "Shaymin mood error:",
            error,
          );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setLiveConnection(false);
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      [requestMood],
    );

  useEffect(() => {
    mountedRef.current =
      true;

    setPortalReady(true);

    router.prefetch(
      "/admin/tree",
    );

    void loadMood(false);

    const interval =
      window.setInterval(() => {
        void loadMood(true);
      }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current =
        false;

      window.clearInterval(
        interval,
      );

      clearHoldTimers();
    };
  }, [
    clearHoldTimers,
    loadMood,
    router,
  ]);

  useEffect(() => {
    setMoodLog(
      readMoodLog(),
    );

    setMoodLogReady(true);
  }, []);

  useEffect(() => {
    if (
      !moodLogReady ||
      loading ||
      !response.mood
    ) {
      return;
    }

    setMoodLog(
      (current) => {
        if (
          current[0]
            ?.signature ===
          currentMoodSignature
        ) {
          return current;
        }

        const recordedAt =
          response.updatedAt ||
          new Date().toISOString();

        const entry:
          MoodLogEntry = {
          id:
            `${recordedAt}-${currentMoodSignature}`,

          moodId:
            golden
              ? "golden"
              : mood.id,

          title:
            golden
              ? "Golden Sky Forme"
              : mood.title,

          message:
            golden
              ? "The World Tree has reached its final crown."
              : mood.message,

          reason:
            currentMoodReason,

          recordedAt,

          signature:
            currentMoodSignature,
        };

        const next = [
          entry,
          ...current,
        ].slice(
          0,
          MAX_MOOD_LOG_ENTRIES,
        );

        writeMoodLog(next);

        return next;
      },
    );
  }, [
    currentMoodReason,
    currentMoodSignature,
    golden,
    loading,
    mood.id,
    mood.message,
    mood.title,
    moodLogReady,
    response.mood,
    response.updatedAt,
  ]);

  useEffect(() => {
    if (
      !open ||
      !portalReady
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    open,
    portalReady,
  ]);

  useEffect(() => {
    function handlePointerUp(
      event:
        globalThis.PointerEvent,
    ) {
      if (
        activePointerIdRef.current !==
        event.pointerId
      ) {
        return;
      }

      const completed =
        holdCompletedRef.current;

      clearHoldTimers();

      activePointerIdRef.current =
        null;

      setHolding(false);

      if (!completed) {
        setHoldProgress(0);
      }
    }

    function handlePointerCancel(
      event:
        globalThis.PointerEvent,
    ) {
      if (
        activePointerIdRef.current !==
        event.pointerId
      ) {
        return;
      }

      resetHold(true);
    }

    function handlePointerMove(
      event:
        globalThis.PointerEvent,
    ) {
      if (
        activePointerIdRef.current !==
        event.pointerId
      ) {
        return;
      }

      const movedX =
        event.clientX -
        startPositionRef.current.x;

      const movedY =
        event.clientY -
        startPositionRef.current.y;

      const distance =
        Math.sqrt(
          movedX * movedX +
            movedY * movedY,
        );

      if (
        distance >
        MAX_POINTER_MOVEMENT
      ) {
        resetHold(true);
      }
    }

    function handleWindowBlur() {
      resetHold(true);
    }

    function handlePageHide() {
      resetHold(true);
    }

    function handleScroll() {
      if (
        activePointerIdRef.current !==
        null
      ) {
        resetHold(true);
      }
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        resetHold(true);
      } else {
        void loadMood(true);
      }
    }

    window.addEventListener(
      "pointerup",
      handlePointerUp,
      true,
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel,
      true,
    );

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      true,
    );

    window.addEventListener(
      "blur",
      handleWindowBlur,
    );

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      true,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener(
        "pointerup",
        handlePointerUp,
        true,
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel,
        true,
      );

      window.removeEventListener(
        "pointermove",
        handlePointerMove,
        true,
      );

      window.removeEventListener(
        "blur",
        handleWindowBlur,
      );

      window.removeEventListener(
        "pagehide",
        handlePageHide,
      );

      window.removeEventListener(
        "scroll",
        handleScroll,
        true,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    clearHoldTimers,
    loadMood,
    resetHold,
  ]);

  useEffect(() => {
    function handleKeyDown(
      event:
        globalThis.KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(false);
        resetHold(true);
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [resetHold]);

  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    startPositionRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    startHold(
      event.pointerId,
    );
  }

  function handleClick() {
    if (
      suppressClickRef.current ||
      holdCompletedRef.current
    ) {
      suppressClickRef.current =
        false;

      holdCompletedRef.current =
        false;

      return;
    }

    setOpen(
      (current) =>
        !current,
    );
  }

  function handleImageError(
    event:
      SyntheticEvent<
        HTMLImageElement
      >,
  ) {
    const image =
      event.currentTarget;

    if (
      image.src.endsWith(
        "/shaymin.png",
      )
    ) {
      return;
    }

    image.src =
      "/shaymin.png";
  }

  function clearMoodLog() {
    setMoodLog([]);

    try {
      window.localStorage.removeItem(
        MOOD_LOG_STORAGE_KEY,
      );
    } catch {
      // The visible journal is still cleared.
    }
  }

  const progressOffset =
    100 -
    holdProgress * 100;

  const visibleMoodLog =
    showFullLog
      ? moodLog
      : moodLog.slice(0, 3);

  const panel =
    open &&
    portalReady
      ? createPortal(
          <div
            className="
              fixed
              inset-0
              z-[9998]
              flex
              items-start
              justify-center
              overflow-y-auto
              bg-black/45
              px-3
              pb-8
              pt-16
              backdrop-blur-sm
              sm:justify-end
              sm:px-5
              sm:pt-20
            "
            onPointerDown={() => {
              setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Shaymin mood panel"
              onPointerDown={(
                event,
              ) => {
                event.stopPropagation();
              }}
              className="
                relative
                z-[9999]
                w-full
                max-w-[31rem]
                overflow-hidden
                rounded-[2rem]
                border
                border-emerald-200/20
                bg-[#041a12]/[0.98]
                text-white
                shadow-[0_35px_120px_rgba(0,0,0,0.88)]
                backdrop-blur-3xl
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

              <div className="p-4 sm:p-5">
                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-4
                  "
                >
                  <div>
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
                        leading-tight
                        text-white
                      "
                    >
                      {golden
                        ? "Golden Sky Forme"
                        : mood.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                    }}
                    aria-label="Close Shaymin"
                    className="
                      flex
                      h-10
                      w-10
                      flex-none
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/10
                      bg-white/[0.05]
                      text-lg
                      font-black
                      text-white/55
                      transition
                      hover:bg-white/10
                      hover:text-white
                    "
                  >
                    x
                  </button>
                </div>

                <div
                  className="
                    mt-5
                    flex
                    flex-col
                    gap-5
                    sm:flex-row
                    sm:items-start
                  "
                >
                  <div
                    className="
                      relative
                      flex
                      min-h-52
                      w-full
                      flex-none
                      items-center
                      justify-center
                      overflow-hidden
                      rounded-[1.75rem]
                      border
                      border-emerald-200/15
                      bg-[radial-gradient(circle_at_center,rgba(110,231,183,0.16),rgba(4,26,18,0.25)_55%,rgba(4,26,18,0.8))]
                      p-3
                      sm:h-48
                      sm:w-48
                    "
                  >
                    <img
                      key={
                        `panel-${moodImage}`
                      }
                      src={moodImage}
                      alt={
                        golden
                          ? "Golden Sky Forme Shaymin"
                          : `Shaymin mood: ${mood.title}`
                      }
                      draggable={false}
                      onError={
                        handleImageError
                      }
                      className="
                        h-full
                        max-h-48
                        w-full
                        object-contain
                        drop-shadow-[0_14px_24px_rgba(0,0,0,0.35)]
                      "
                    />

                    {moodId ===
                      "lukas" && (
                      <ImageBadge>
                        Lukas - Invincible
                      </ImageBadge>
                    )}

                    {moodId ===
                      "skye" && (
                      <ImageBadge>
                        Skye - Eve
                      </ImageBadge>
                    )}

                    {moodId ===
                      "together" && (
                      <ImageBadge>
                        Invincible and Eve
                      </ImageBadge>
                    )}

                    {golden && (
                      <ImageBadge>
                        Million Pound Forme
                      </ImageBadge>
                    )}

                    {refreshing && (
                      <div
                        className="
                          absolute
                          inset-0
                          flex
                          items-center
                          justify-center
                          bg-black/30
                          backdrop-blur-sm
                        "
                      >
                        <span
                          className="
                            h-8
                            w-8
                            animate-spin
                            rounded-full
                            border-2
                            border-white/20
                            border-t-emerald-200
                          "
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <div
                      className="
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
                        {golden
                          ? "The World Tree has reached its final crown."
                          : mood.message}
                      </p>

                      <p
                        className="
                          mt-2
                          text-xs
                          font-semibold
                          leading-5
                          text-white/45
                        "
                      >
                        {golden
                          ? "Lukas and Skye built a million-pound Pokemon inventory together."
                          : mood.detail}
                      </p>
                    </div>

                    <div
                      className="
                        mt-3
                        rounded-[1.25rem]
                        border
                        border-cyan-200/15
                        bg-cyan-300/[0.06]
                        p-4
                      "
                    >
                      <p
                        className="
                          text-[0.58rem]
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-cyan-100/45
                        "
                      >
                        Why Shaymin feels this way
                      </p>

                      <p
                        className="
                          mt-2
                          text-xs
                          font-semibold
                          leading-5
                          text-cyan-50/70
                        "
                      >
                        {currentMoodReason}
                      </p>
                    </div>
                  </div>
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
                        ?.currentValue ||
                        0,
                    )}
                  />

                  <MoodStat
                    label="Added today"
                    value={`${
                      response.stats
                        ?.addedToday ||
                      0
                    } cards`}
                  />

                  <MoodStat
                    label="Lukas"
                    value={`${
                      response.stats
                        ?.founderActivity
                        .lukas || 0
                    } added`}
                  />

                  <MoodStat
                    label="Skye"
                    value={`${
                      response.stats
                        ?.founderActivity
                        .skye || 0
                    } added`}
                  />
                </div>

                <section
                  className="
                    mt-4
                    overflow-hidden
                    rounded-[1.5rem]
                    border
                    border-white/10
                    bg-black/15
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      border-b
                      border-white/10
                      px-4
                      py-4
                    "
                  >
                    <div>
                      <p
                        className="
                          text-[0.58rem]
                          font-black
                          uppercase
                          tracking-[0.18em]
                          text-emerald-200/45
                        "
                      >
                        Mood journal
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-black
                          text-white
                        "
                      >
                        What Shaymin has been feeling
                      </p>
                    </div>

                    {moodLog.length >
                      0 && (
                      <button
                        type="button"
                        onClick={
                          clearMoodLog
                        }
                        className="
                          rounded-lg
                          border
                          border-white/10
                          bg-white/[0.05]
                          px-3
                          py-2
                          text-[0.6rem]
                          font-black
                          uppercase
                          tracking-[0.1em]
                          text-white/45
                          transition
                          hover:bg-red-400/10
                          hover:text-red-100
                        "
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {visibleMoodLog.length ===
                  0 ? (
                    <div
                      className="
                        px-4
                        py-6
                        text-center
                        text-sm
                        font-semibold
                        text-white/35
                      "
                    >
                      Shaymin has not recorded a mood change yet.
                    </div>
                  ) : (
                    <div
                      className="
                        max-h-72
                        divide-y
                        divide-white/[0.07]
                        overflow-y-auto
                      "
                    >
                      {visibleMoodLog.map(
                        (entry) => (
                          <MoodLogCard
                            key={
                              entry.id
                            }
                            entry={
                              entry
                            }
                          />
                        ),
                      )}
                    </div>
                  )}

                  {moodLog.length >
                    3 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFullLog(
                          (current) =>
                            !current,
                        );
                      }}
                      className="
                        w-full
                        border-t
                        border-white/10
                        bg-white/[0.025]
                        px-4
                        py-3
                        text-xs
                        font-black
                        text-emerald-100/60
                        transition
                        hover:bg-white/[0.05]
                        hover:text-emerald-100
                      "
                    >
                      {showFullLog
                        ? "Show recent entries"
                        : `Show all ${moodLog.length} entries`}
                    </button>
                  )}
                </section>

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
                      leading-5
                      text-amber-100/70
                    "
                  >
                    Live data is temporarily unavailable. Shaymin will reconnect automatically.
                  </div>
                )}

                <div
                  className="
                    mt-4
                    flex
                    flex-col
                    gap-3
                    sm:flex-row
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      void loadMood(
                        true,
                      );
                    }}
                    disabled={
                      refreshing
                    }
                    className="
                      min-h-12
                      flex-1
                      rounded-xl
                      border
                      border-white/10
                      bg-white/[0.05]
                      px-4
                      text-xs
                      font-black
                      text-white/70
                      transition
                      hover:bg-white/10
                      hover:text-white
                      disabled:opacity-40
                    "
                  >
                    {refreshing
                      ? "Checking..."
                      : "Check mood again"}
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
                      min-h-12
                      flex-1
                      rounded-xl
                      bg-emerald-300
                      px-4
                      text-xs
                      font-black
                      text-emerald-950
                      transition
                      hover:bg-emerald-200
                    "
                  >
                    Visit the tree
                  </button>
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="
          relative
          flex
          h-16
          w-16
          flex-none
          items-center
          justify-center
        "
      >
        {holding && (
          <svg
            viewBox="0 0 40 40"
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              inset-0
              h-full
              w-full
              -rotate-90
              overflow-visible
            "
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgba(110,231,183,0.18)"
              strokeWidth="1.5"
            />

            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgb(110,231,183)"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={
                progressOffset
              }
              className="
                transition-[stroke-dashoffset]
                duration-75
                drop-shadow-[0_0_5px_rgba(110,231,183,0.9)]
              "
            />
          </svg>
        )}

        <button
          type="button"
          aria-label="Tap Shaymin to open the mood panel. Hold Shaymin to visit the tree."
          aria-expanded={open}
          onPointerDown={
            handlePointerDown
          }
          onClick={
            handleClick
          }
          onContextMenu={(
            event,
          ) => {
            event.preventDefault();
          }}
          onDragStart={(
            event,
          ) => {
            event.preventDefault();
          }}
          style={{
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect:
              "none",
            WebkitTouchCallout:
              "none",
          }}
          className={`
            group
            relative
            z-10
            flex
            h-16
            w-16
            select-none
            items-center
            justify-center
            overflow-visible
            border-0
            bg-transparent
            p-0
            outline-none
            transition
            duration-300
            focus-visible:rounded-full
            focus-visible:ring-2
            focus-visible:ring-emerald-200/70
            ${
              holding
                ? "scale-95"
                : "hover:scale-110"
            }
          `}
        >
          <img
            key={
              `nav-${moodImage}`
            }
            src={moodImage}
            alt=""
            draggable={false}
            onError={
              handleImageError
            }
            className={`
              pointer-events-none
              h-[3.8rem]
              w-[3.8rem]
              object-contain
              transition
              duration-300
              drop-shadow-[0_6px_7px_rgba(0,0,0,0.28)]
              ${
                holding
                  ? "scale-110"
                  : "scale-100 group-hover:scale-105"
              }
            `}
          />

          <span
            className={`
              pointer-events-none
              absolute
              bottom-0
              right-0
              z-20
              h-2.5
              w-2.5
              rounded-full
              border-2
              border-[#0b291d]
              ${
                loading ||
                  refreshing
                  ? "animate-pulse bg-cyan-200"
                  : liveConnection
                    ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.95)]"
                    : "bg-amber-300"
              }
            `}
          />
        </button>

        {holding && (
          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[calc(100%+0.4rem)]
              z-[9997]
              -translate-x-1/2
              whitespace-nowrap
              rounded-full
              border
              border-emerald-200/20
              bg-[#03150f]/95
              px-3
              py-1.5
              text-[0.6rem]
              font-black
              uppercase
              tracking-[0.12em]
              text-emerald-100
              shadow-xl
              backdrop-blur-xl
            "
          >
            Hold to enter the forest
          </div>
        )}
      </div>

      {panel}
    </>
  );
}

function ImageBadge({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="
        absolute
        bottom-3
        left-3
        rounded-full
        border
        border-white/20
        bg-black/70
        px-3
        py-1.5
        text-[0.58rem]
        font-black
        uppercase
        tracking-[0.12em]
        text-white
        shadow-lg
        backdrop-blur-xl
      "
    >
      {children}
    </div>
  );
}

function MoodStat({
  label,
  value,
}: {
  label: string;
  value: string;
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

function MoodLogCard({
  entry,
}: {
  entry: MoodLogEntry;
}) {
  return (
    <article
      className="
        px-4
        py-4
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div className="min-w-0">
          <p
            className="
              text-sm
              font-black
              text-white
            "
          >
            {entry.title}
          </p>

          <p
            className="
              mt-1
              text-xs
              font-semibold
              leading-5
              text-white/40
            "
          >
            {entry.message}
          </p>
        </div>

        <time
          className="
            flex-none
            text-[0.58rem]
            font-black
            uppercase
            tracking-[0.1em]
            text-white/25
          "
        >
          {formatLogTime(
            entry.recordedAt,
          )}
        </time>
      </div>

      <div
        className="
          mt-3
          rounded-xl
          border
          border-white/[0.07]
          bg-white/[0.03]
          px-3
          py-2.5
        "
      >
        <p
          className="
            text-[0.58rem]
            font-black
            uppercase
            tracking-[0.12em]
            text-emerald-200/35
          "
        >
          Mood trigger
        </p>

        <p
          className="
            mt-1
            text-[0.7rem]
            font-semibold
            leading-5
            text-emerald-50/55
          "
        >
          {entry.reason}
        </p>
      </div>
    </article>
  );
}