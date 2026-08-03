"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";

type AuthUser = {
  id: string;
};

type PullCard = {
  id: string;
  name: string;
  rarity: string;
  image_url: string | null;
  market_value: number;
};

type PullHistoryDatabaseRow = {
  id: string;
  created_at: string;
  amount_paid: number | string | null;
  market_value: number | string | null;

  pokemon_cards:
    | {
        id?: string;
        name?: string;
        rarity?: string | null;
        image_url?: string | null;
        market_value?: number | string | null;
      }
    | Array<{
        id?: string;
        name?: string;
        rarity?: string | null;
        image_url?: string | null;
        market_value?: number | string | null;
      }>
    | null;
};

type PullHistoryItem = PullCard & {
  historyId: string;
  amount_paid: number;
  created_at: string;
};

type PullResponse = {
  success?: boolean;
  error?: string;
  details?: string;

  balance?: number | string;
  amountPaid?: number | string;
  dailyPulls?: number;

  card?: {
    id?: string;
    name?: string;
    rarity?: string | null;
    image_url?: string | null;
    market_value?: number | string | null;
  };
};

type PullPhase =
  | "idle"
  | "charging"
  | "revealing"
  | "complete";

const DAILY_LIMIT = 100;
const HISTORY_LIMIT = 12;

function toNumber(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const today = new Date();

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return `Today at ${new Intl.DateTimeFormat(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date)}`;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function stageForProgress(progress: number): string {
  if (progress < 22) {
    return "Synchronising with the vault";
  }

  if (progress < 46) {
    return "Listening for movement in the grove";
  }

  if (progress < 72) {
    return "Ancient energy is gathering";
  }

  if (progress < 92) {
    return "A hidden card is responding";
  }

  return "Discovery located";
}

function rarityStyle(rarity: string): string {
  const value = rarity.toLowerCase();

  if (
    value.includes("secret") ||
    value.includes("hyper") ||
    value.includes("special")
  ) {
    return `
      border-amber-200/30
      bg-amber-300/15
      text-amber-100
    `;
  }

  if (
    value.includes("ultra") ||
    value.includes("illustration") ||
    value.includes("rare")
  ) {
    return `
      border-violet-200/30
      bg-violet-300/15
      text-violet-100
    `;
  }

  if (value.includes("uncommon")) {
    return `
      border-cyan-200/30
      bg-cyan-300/15
      text-cyan-100
    `;
  }

  return `
    border-emerald-200/25
    bg-emerald-300/10
    text-emerald-100
  `;
}

function mapHistoryRow(
  row: PullHistoryDatabaseRow,
): PullHistoryItem {
  const card = getRelation(row.pokemon_cards);

  return {
    historyId: row.id,

    id: card?.id || row.id,

    name:
      card?.name ||
      "Unknown Pokémon",

    rarity:
      card?.rarity ||
      "Unknown rarity",

    image_url:
      card?.image_url ||
      null,

    market_value: toNumber(
      row.market_value ??
        card?.market_value,
    ),

    amount_paid: toNumber(
      row.amount_paid,
    ),

    created_at: row.created_at,
  };
}

function normalisePulledCard(
  card: PullResponse["card"],
): PullCard {
  return {
    id:
      card?.id ||
      crypto.randomUUID(),

    name:
      card?.name ||
      "Unknown Pokémon",

    rarity:
      card?.rarity ||
      "Unknown rarity",

    image_url:
      card?.image_url ||
      null,

    market_value: toNumber(
      card?.market_value,
    ),
  };
}

function LoadingPage() {
  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden
        bg-gradient-to-br
        from-[#020617]
        via-[#052e16]
        to-[#064e3b]
        px-4
        text-white
      "
    >
      <ForestBackground />

      <div
        className="
          relative
          z-10
          flex
          flex-col
          items-center
        "
      >
        <div
          className="
            relative
            flex
            h-28
            w-28
            items-center
            justify-center
            rounded-[2.25rem]
            border
            border-emerald-200/20
            bg-emerald-300/10
            shadow-[0_0_70px_rgba(52,211,153,0.22)]
            backdrop-blur-3xl
          "
        >
          <div
            className="
              absolute
              inset-3
              animate-ping
              rounded-[1.7rem]
              border
              border-emerald-200/15
            "
          />

          <img
            src="/shaymin.png"
            alt="PocketPulls"
            className="
              relative
              h-24
              w-24
              object-contain
              drop-shadow-2xl
            "
          />
        </div>

        <p
          className="
            mt-6
            text-lg
            font-black
            text-emerald-100
          "
        >
          Waking the Discovery Engine...
        </p>
      </div>
    </main>
  );
}

export default function PullsPage() {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [syncing, setSyncing] =
    useState(false);

  const [balance, setBalance] =
    useState(0);

  const [dailyPulls, setDailyPulls] =
    useState(0);

  const [todaySpent, setTodaySpent] =
    useState(0);

  const [todayValue, setTodayValue] =
    useState(0);

  const [history, setHistory] =
    useState<PullHistoryItem[]>([]);

  const [todayHistory, setTodayHistory] =
    useState<PullHistoryItem[]>([]);

  const [phase, setPhase] =
    useState<PullPhase>("idle");

  const [opening, setOpening] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [stage, setStage] =
    useState(
      "Discovery Engine ready",
    );

  const [
    revealedCard,
    setRevealedCard,
  ] = useState<PullCard | null>(
    null,
  );

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState<Date | null>(null);

  const animationTimer =
    useRef<number | null>(null);

  const currentPrice =
    dailyPulls + 1;

  const remainingPulls =
    Math.max(
      0,
      DAILY_LIMIT - dailyPulls,
    );

  const dailyProgress =
    Math.min(
      100,
      (dailyPulls / DAILY_LIMIT) *
        100,
    );

  const loadData = useCallback(
    async (
      currentUser: AuthUser,
      background = false,
    ) => {
      if (background) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const startOfToday =
          new Date();

        startOfToday.setHours(
          0,
          0,
          0,
          0,
        );

        const [
          profileResult,
          todayResult,
          historyResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("balance")
            .eq(
              "id",
              currentUser.id,
            )
            .single(),

          supabase
            .from("pull_history")
            .select(`
              id,
              created_at,
              amount_paid,
              market_value,
              pokemon_cards(
                id,
                name,
                rarity,
                image_url,
                market_value
              )
            `)
            .eq(
              "user_id",
              currentUser.id,
            )
            .gte(
              "created_at",
              startOfToday.toISOString(),
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            ),

          supabase
            .from("pull_history")
            .select(`
              id,
              created_at,
              amount_paid,
              market_value,
              pokemon_cards(
                id,
                name,
                rarity,
                image_url,
                market_value
              )
            `)
            .eq(
              "user_id",
              currentUser.id,
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(HISTORY_LIMIT),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (todayResult.error) {
          throw todayResult.error;
        }

        if (historyResult.error) {
          throw historyResult.error;
        }

        const mappedToday = (
          (todayResult.data ||
            []) as unknown as PullHistoryDatabaseRow[]
        ).map(mapHistoryRow);

        const mappedHistory = (
          (historyResult.data ||
            []) as unknown as PullHistoryDatabaseRow[]
        ).map(mapHistoryRow);

        setBalance(
          toNumber(
            profileResult.data
              ?.balance,
          ),
        );

        setDailyPulls(
          mappedToday.length,
        );

        setTodaySpent(
          mappedToday.reduce(
            (total, item) =>
              total +
              item.amount_paid,
            0,
          ),
        );

        setTodayValue(
          mappedToday.reduce(
            (total, item) =>
              total +
              item.market_value,
            0,
          ),
        );

        setTodayHistory(
          mappedToday,
        );

        setHistory(
          mappedHistory,
        );

        setLastUpdated(
          new Date(),
        );
      } catch (
        loadError: unknown
      ) {
        console.error(
          "Pull dashboard error:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "The Discovery Engine could not load its data.",
        );
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [],
  );

  useEffect(() => {
    async function initialise() {
      try {
        const {
          data: {
            user:
              authenticatedUser,
          },
          error: authError,
        } =
          await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!authenticatedUser) {
          setError(
            "You must be logged in to use the pull system.",
          );

          setLoading(false);

          return;
        }

        const currentUser = {
          id: authenticatedUser.id,
        };

        setUser(currentUser);

        await loadData(
          currentUser,
        );
      } catch (
        initialiseError: unknown
      ) {
        console.error(
          "Pull initialisation error:",
          initialiseError,
        );

        setError(
          initialiseError instanceof
            Error
            ? initialiseError.message
            : "PocketPulls could not verify your session.",
        );

        setLoading(false);
      }
    }

    void initialise();

    return () => {
      if (
        animationTimer.current !==
        null
      ) {
        window.clearInterval(
          animationTimer.current,
        );
      }
    };
  }, [loadData]);

  const bestPullToday =
    useMemo(() => {
      if (
        todayHistory.length === 0
      ) {
        return null;
      }

      return [
        ...todayHistory,
      ].sort(
        (first, second) =>
          second.market_value -
          first.market_value,
      )[0];
    }, [todayHistory]);

  const averageCardValue =
    dailyPulls > 0
      ? todayValue / dailyPulls
      : 0;

  const netToday =
    todayValue - todaySpent;

  const priceForecast =
    useMemo(() => {
      return Array.from(
        {
          length: 5,
        },
        (_, index) => {
          const pullNumber =
            dailyPulls +
            index +
            1;

          return {
            pullNumber,
            price: pullNumber,
          };
        },
      ).filter(
        (item) =>
          item.pullNumber <=
          DAILY_LIMIT,
      );
    }, [dailyPulls]);

  async function openPull() {
    if (!user || opening) {
      return;
    }

    if (
      dailyPulls >= DAILY_LIMIT
    ) {
      setError(
        "The Discovery Engine has reached today's 100-pull limit.",
      );

      return;
    }

    if (
      balance < currentPrice
    ) {
      setError(
        `You need ${formatCurrency(
          currentPrice,
        )} to open this discovery.`,
      );

      return;
    }

    setError("");
    setRevealedCard(null);
    setOpening(true);
    setPhase("charging");
    setProgress(4);
    setStage(
      stageForProgress(4),
    );

    const startedAt =
      Date.now();

    let simulatedProgress = 4;

    animationTimer.current =
      window.setInterval(() => {
        simulatedProgress =
          Math.min(
            94,
            simulatedProgress +
              Math.max(
                1,
                (96 -
                  simulatedProgress) *
                  0.08,
              ),
          );

        const roundedProgress =
          Math.floor(
            simulatedProgress,
          );

        setProgress(
          roundedProgress,
        );

        setStage(
          stageForProgress(
            roundedProgress,
          ),
        );
      }, 120);

    try {
      const response =
        await fetch(
          "/api/pull",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              userId: user.id,
              expectedPrice:
                currentPrice,
            }),
          },
        );

      const payload =
        (await response.json()) as PullResponse;

      if (!response.ok) {
        throw new Error(
          payload.details ||
            payload.error ||
            "The pull could not be completed.",
        );
      }

      if (!payload.card) {
        throw new Error(
          "The pull completed, but no card was returned.",
        );
      }

      const minimumAnimationTime =
        2800;

      const elapsed =
        Date.now() - startedAt;

      if (
        elapsed <
        minimumAnimationTime
      ) {
        await wait(
          minimumAnimationTime -
            elapsed,
        );
      }

      if (
        animationTimer.current !==
        null
      ) {
        window.clearInterval(
          animationTimer.current,
        );

        animationTimer.current =
          null;
      }

      setProgress(100);

      setStage(
        "Discovery located",
      );

      setPhase("revealing");

      const pulledCard =
        normalisePulledCard(
          payload.card,
        );

      await wait(500);

      setRevealedCard(
        pulledCard,
      );

      setPhase("complete");

      if (
        payload.balance !==
        undefined
      ) {
        setBalance(
          toNumber(
            payload.balance,
          ),
        );
      }

      if (
        typeof payload.dailyPulls ===
        "number"
      ) {
        setDailyPulls(
          payload.dailyPulls,
        );
      }

      await loadData(
        user,
        true,
      );
    } catch (
      pullError: unknown
    ) {
      console.error(
        "Pull error:",
        pullError,
      );

      setError(
        pullError instanceof Error
          ? pullError.message
          : "The forest could not complete this discovery.",
      );

      setPhase("idle");
      setProgress(0);

      setStage(
        "Discovery Engine ready",
      );
    } finally {
      if (
        animationTimer.current !==
        null
      ) {
        window.clearInterval(
          animationTimer.current,
        );

        animationTimer.current =
          null;
      }

      setOpening(false);
    }
  }

  function resetChamber() {
    if (opening) {
      return;
    }

    setRevealedCard(null);
    setPhase("idle");
    setProgress(0);

    setStage(
      "Discovery Engine ready",
    );

    setError("");
  }

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-gradient-to-br
        from-[#020617]
        via-[#052e16]
        to-[#064e3b]
        px-4
        pb-28
        pt-4
        text-white
        md:px-8
        md:pt-8
      "
    >
      <ForestBackground />

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            -left-56
            top-12
            h-[42rem]
            w-[42rem]
            rounded-full
            bg-emerald-400/10
            blur-[155px]
          "
        />

        <div
          className="
            absolute
            -right-56
            top-28
            h-[44rem]
            w-[44rem]
            rounded-full
            bg-cyan-300/10
            blur-[175px]
          "
        />

        <div
          className="
            absolute
            bottom-[-14rem]
            left-1/3
            h-[40rem]
            w-[40rem]
            rounded-full
            bg-violet-300/[0.055]
            blur-[160px]
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_50%_24%,transparent_0%,rgba(2,6,23,0.12)_48%,rgba(2,6,23,0.68)_100%)]
          "
        />
      </div>

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-[1500px]
        "
      >
        <AdminNav />

        <header
          className="
            relative
            mt-8
            overflow-hidden
            rounded-[2.75rem]
            border
            border-white/15
            bg-white/[0.075]
            p-6
            shadow-[0_40px_120px_rgba(0,0,0,0.36)]
            backdrop-blur-3xl
            md:p-10
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-gradient-to-br
              from-white/10
              via-transparent
              to-emerald-400/[0.06]
            "
          />

          <div
            className="
              relative
              z-10
              flex
              flex-col
              gap-8
              xl:flex-row
              xl:items-end
              xl:justify-between
            "
          >
            <div>
              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-emerald-200/20
                  bg-emerald-400/10
                  px-4
                  py-2
                  text-sm
                  font-black
                  text-emerald-100
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                    bg-emerald-300
                    shadow-[0_0_16px_rgba(110,231,183,1)]
                  "
                />

                Live Discovery System
              </div>

              <h1
                className="
                  mt-5
                  max-w-4xl
                  text-4xl
                  font-black
                  tracking-[-0.05em]
                  md:text-6xl
                "
              >
                The PocketPulls
                <span className="text-emerald-300">
                  {" "}
                  Discovery Engine
                </span>
              </h1>

              <p
                className="
                  mt-4
                  max-w-3xl
                  text-base
                  font-medium
                  leading-7
                  text-emerald-50/70
                  md:text-lg
                "
              >
                A premium real-time pull terminal connected
                to your physical card vault, customer wallet
                and discovery history.
              </p>
            </div>

            <div
              className="
                flex
                flex-col
                gap-3
                sm:flex-row
              "
            >
              <button
                type="button"
                onClick={() =>
                  user &&
                  void loadData(
                    user,
                    true,
                  )
                }
                disabled={
                  syncing ||
                  opening
                }
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-white/15
                  bg-white/[0.07]
                  px-6
                  font-black
                  text-white
                  transition
                  hover:bg-white/10
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <span
                  className={
                    syncing
                      ? "animate-spin"
                      : ""
                  }
                >
                  ↻
                </span>

                {syncing
                  ? "Synchronising"
                  : "Refresh engine"}
              </button>

              <div
                className="
                  flex
                  min-h-14
                  items-center
                  gap-3
                  rounded-2xl
                  border
                  border-emerald-200/15
                  bg-emerald-300/[0.08]
                  px-5
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                    bg-emerald-300
                    shadow-[0_0_14px_rgba(110,231,183,1)]
                  "
                />

                <div>
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-emerald-100/45
                    "
                  >
                    Engine status
                  </p>

                  <p
                    className="
                      text-sm
                      font-black
                      text-emerald-100
                    "
                  >
                    Online and stocked
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section
          className="
            mt-8
            grid
            gap-5
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <article
            className="
              relative
              overflow-hidden
              rounded-[2.25rem]
              border
              border-emerald-200/20
              bg-gradient-to-br
              from-emerald-300/15
              via-white/[0.07]
              to-transparent
              p-6
              shadow-[0_25px_75px_rgba(16,185,129,0.14)]
              backdrop-blur-3xl
            "
          >
            <span
              className="
                absolute
                right-5
                top-4
                text-6xl
                opacity-10
              "
            >
              💎
            </span>

            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-emerald-100/55
              "
            >
              Forest wallet
            </p>

            <p
              className="
                mt-5
                text-4xl
                font-black
                text-emerald-100
              "
            >
              {formatCurrency(balance)}
            </p>

            <p
              className="
                mt-3
                text-sm
                font-medium
                text-white/45
              "
            >
              Available spending balance
            </p>
          </article>

          <article
            className="
              relative
              overflow-hidden
              rounded-[2.25rem]
              border
              border-white/15
              bg-white/[0.075]
              p-6
              shadow-[0_25px_70px_rgba(0,0,0,0.24)]
              backdrop-blur-3xl
            "
          >
            <span
              className="
                absolute
                right-5
                top-4
                text-6xl
                opacity-10
              "
            >
              ✦
            </span>

            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-violet-100/55
              "
            >
              Pulls today
            </p>

            <p
              className="
                mt-5
                text-4xl
                font-black
              "
            >
              {dailyPulls}

              <span
                className="
                  text-xl
                  text-white/30
                "
              >
                /{DAILY_LIMIT}
              </span>
            </p>

            <p
              className="
                mt-3
                text-sm
                font-medium
                text-white/45
              "
            >
              {remainingPulls} discoveries remaining
            </p>
          </article>

          <article
            className="
              relative
              overflow-hidden
              rounded-[2.25rem]
              border
              border-cyan-200/15
              bg-cyan-300/[0.06]
              p-6
              shadow-[0_25px_70px_rgba(0,0,0,0.24)]
              backdrop-blur-3xl
            "
          >
            <span
              className="
                absolute
                right-5
                top-4
                text-6xl
                opacity-10
              "
            >
              🎴
            </span>

            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-cyan-100/55
              "
            >
              Current pull
            </p>

            <p
              className="
                mt-5
                text-4xl
                font-black
                text-cyan-100
              "
            >
              {formatCurrency(
                currentPrice,
              )}
            </p>

            <p
              className="
                mt-3
                text-sm
                font-medium
                text-white/45
              "
            >
              Pull #{dailyPulls + 1} in today's ladder
            </p>
          </article>

          <article
            className="
              relative
              overflow-hidden
              rounded-[2.25rem]
              border
              border-white/15
              bg-white/[0.075]
              p-6
              shadow-[0_25px_70px_rgba(0,0,0,0.24)]
              backdrop-blur-3xl
            "
          >
            <span
              className="
                absolute
                right-5
                top-4
                text-6xl
                opacity-10
              "
            >
              ◈
            </span>

            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-white/45
              "
            >
              Today's card value
            </p>

            <p
              className="
                mt-5
                text-4xl
                font-black
              "
            >
              {formatCurrency(
                todayValue,
              )}
            </p>

            <p
              className={`
                mt-3
                text-sm
                font-black
                ${
                  netToday >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
                }
              `}
            >
              {netToday >= 0
                ? "+"
                : ""}

              {formatCurrency(
                netToday,
              )}{" "}
              against spend
            </p>
          </article>
        </section>

        {error && (
          <div
            className="
              mt-6
              flex
              items-start
              gap-4
              rounded-[1.75rem]
              border
              border-red-300/20
              bg-red-500/10
              px-6
              py-5
              font-bold
              text-red-100
              shadow-[0_0_35px_rgba(239,68,68,0.08)]
              backdrop-blur-2xl
            "
          >
            <span
              className="
                flex
                h-9
                w-9
                flex-none
                items-center
                justify-center
                rounded-xl
                bg-red-400/15
                text-red-200
              "
            >
              !
            </span>

            <div>
              <p
                className="
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.16em]
                  text-red-200/60
                "
              >
                Discovery interrupted
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        <section
          className="
            mt-8
            grid
            gap-8
            xl:grid-cols-[1.45fr_0.75fr]
          "
        >
          <div
            className="
              relative
              overflow-hidden
              rounded-[3rem]
              border
              border-white/15
              bg-white/[0.075]
              shadow-[0_45px_130px_rgba(0,0,0,0.38)]
              backdrop-blur-3xl
            "
          >
            <div
              className="
                flex
                flex-col
                gap-4
                border-b
                border-white/10
                px-6
                py-6
                sm:flex-row
                sm:items-center
                sm:justify-between
                md:px-8
              "
            >
              <div>
                <p
                  className="
                    text-sm
                    font-black
                    uppercase
                    tracking-[0.2em]
                    text-emerald-200/55
                  "
                >
                  Main chamber
                </p>

                <h2
                  className="
                    mt-2
                    text-3xl
                    font-black
                    tracking-tight
                  "
                >
                  {phase === "complete"
                    ? "Discovery secured"
                    : "Open the forest vault"}
                </h2>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/15
                  px-4
                  py-3
                  text-right
                "
              >
                <p
                  className="
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.14em]
                    text-white/35
                  "
                >
                  Chamber state
                </p>

                <p
                  className="
                    mt-1
                    font-black
                    text-emerald-200
                  "
                >
                  {stage}
                </p>
              </div>
            </div>

            <div
              className="
                relative
                min-h-[42rem]
                overflow-hidden
                px-5
                py-8
                md:px-10
                md:py-10
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.13)_0%,rgba(6,78,59,0.04)_38%,transparent_72%)]
                "
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  left-1/2
                  top-1/2
                  h-[36rem]
                  w-[36rem]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  border
                  border-emerald-200/[0.06]
                "
              />

              <div
                className={`
                  pointer-events-none
                  absolute
                  left-1/2
                  top-1/2
                  h-[28rem]
                  w-[28rem]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  border
                  border-emerald-200/10
                  ${
                    opening
                      ? "animate-spin"
                      : ""
                  }
                `}
              />

              <div
                className={`
                  pointer-events-none
                  absolute
                  left-1/2
                  top-1/2
                  h-[21rem]
                  w-[21rem]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  border
                  border-dashed
                  border-cyan-200/15
                  ${
                    opening
                      ? "animate-[spin_8s_linear_infinite_reverse]"
                      : ""
                  }
                `}
              />

              <div
                className="
                  relative
                  z-10
                  flex
                  min-h-[35rem]
                  flex-col
                  items-center
                  justify-center
                "
              >
                {revealedCard ? (
                  <div
                    className="
                      flex
                      w-full
                      max-w-3xl
                      flex-col
                      items-center
                    "
                  >
                    <div className="relative">
                      <div
                        className="
                          absolute
                          inset-0
                          scale-110
                          rounded-[2.5rem]
                          bg-emerald-300/25
                          blur-3xl
                        "
                      />

                      <div
                        className="
                          relative
                          flex
                          h-[25rem]
                          w-[18rem]
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-[2.35rem]
                          border
                          border-emerald-100/30
                          bg-gradient-to-br
                          from-white/15
                          via-emerald-300/10
                          to-black/20
                          p-3
                          shadow-[0_35px_100px_rgba(0,0,0,0.48),0_0_60px_rgba(52,211,153,0.22)]
                          sm:h-[30rem]
                          sm:w-[21.5rem]
                        "
                      >
                        {revealedCard.image_url ? (
                          <img
                            src={
                              revealedCard.image_url
                            }
                            alt={
                              revealedCard.name
                            }
                            className="
                              h-full
                              w-full
                              object-contain
                              drop-shadow-2xl
                            "
                          />
                        ) : (
                          <span className="text-8xl">
                            🎴
                          </span>
                        )}
                      </div>

                      <span
                        className="
                          absolute
                          -right-4
                          -top-4
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          border
                          border-emerald-100/30
                          bg-emerald-300
                          text-2xl
                          text-emerald-950
                          shadow-[0_0_35px_rgba(110,231,183,0.45)]
                        "
                      >
                        ✓
                      </span>
                    </div>

                    <div
                      className="
                        mt-7
                        text-center
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.25em]
                          text-emerald-200/60
                        "
                      >
                        New discovery
                      </p>

                      <h3
                        className="
                          mt-3
                          text-4xl
                          font-black
                          tracking-[-0.04em]
                          md:text-5xl
                        "
                      >
                        {revealedCard.name}
                      </h3>

                      <div
                        className="
                          mt-4
                          flex
                          flex-wrap
                          items-center
                          justify-center
                          gap-3
                        "
                      >
                        <span
                          className={`
                            rounded-full
                            border
                            px-4
                            py-2
                            text-sm
                            font-black
                            ${rarityStyle(
                              revealedCard.rarity,
                            )}
                          `}
                        >
                          {revealedCard.rarity}
                        </span>

                        <span
                          className="
                            rounded-full
                            border
                            border-emerald-200/20
                            bg-emerald-300/10
                            px-4
                            py-2
                            text-sm
                            font-black
                            text-emerald-100
                          "
                        >
                          Card value{" "}
                          {formatCurrency(
                            revealedCard.market_value,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="
                      flex
                      flex-col
                      items-center
                    "
                  >
                    <div
                      className="
                        relative
                        h-[24rem]
                        w-[17rem]
                        sm:h-[29rem]
                        sm:w-[20.5rem]
                      "
                    >
                      <div
                        className="
                          absolute
                          left-1/2
                          top-1/2
                          h-[92%]
                          w-[92%]
                          -translate-x-[62%]
                          -translate-y-[48%]
                          rotate-[-8deg]
                          rounded-[2.35rem]
                          border
                          border-white/10
                          bg-emerald-950/70
                          shadow-2xl
                        "
                      />

                      <div
                        className="
                          absolute
                          left-1/2
                          top-1/2
                          h-[95%]
                          w-[95%]
                          -translate-x-[42%]
                          -translate-y-[50%]
                          rotate-[7deg]
                          rounded-[2.35rem]
                          border
                          border-white/10
                          bg-emerald-900/70
                          shadow-2xl
                        "
                      />

                      <div
                        className={`
                          absolute
                          inset-0
                          overflow-hidden
                          rounded-[2.5rem]
                          border
                          border-emerald-100/25
                          bg-gradient-to-br
                          from-emerald-300/25
                          via-[#053c2b]
                          to-[#020617]
                          shadow-[0_35px_100px_rgba(0,0,0,0.5),0_0_55px_rgba(52,211,153,0.18)]
                          ${
                            opening
                              ? "animate-pulse"
                              : ""
                          }
                        `}
                      >
                        <div
                          className="
                            absolute
                            inset-3
                            rounded-[2rem]
                            border
                            border-emerald-100/15
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-8
                            rounded-full
                            border
                            border-emerald-100/10
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-14
                            rounded-full
                            border
                            border-dashed
                            border-emerald-100/15
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-0
                            flex
                            items-center
                            justify-center
                          "
                        >
                          <div
                            className="
                              flex
                              h-32
                              w-32
                              items-center
                              justify-center
                              rounded-[2.25rem]
                              border
                              border-emerald-200/20
                              bg-black/20
                              shadow-[0_0_50px_rgba(52,211,153,0.2)]
                              backdrop-blur-xl
                            "
                          >
                            <img
                              src="/shaymin.png"
                              alt=""
                              className={`
                                h-28
                                w-28
                                object-contain
                                drop-shadow-2xl
                                ${
                                  opening
                                    ? "animate-bounce"
                                    : ""
                                }
                              `}
                            />
                          </div>
                        </div>

                        <div
                          className="
                            absolute
                            bottom-8
                            left-1/2
                            -translate-x-1/2
                            whitespace-nowrap
                            text-xs
                            font-black
                            uppercase
                            tracking-[0.32em]
                            text-emerald-100/55
                          "
                        >
                          PocketPulls
                        </div>

                        {opening && (
                          <div
                            className="
                              absolute
                              inset-0
                              animate-[pulse_1.2s_ease-in-out_infinite]
                              bg-gradient-to-t
                              from-emerald-300/10
                              via-transparent
                              to-cyan-200/10
                            "
                          />
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        mt-8
                        text-center
                      "
                    >
                      <h3
                        className="
                          text-3xl
                          font-black
                          tracking-tight
                        "
                      >
                        {opening
                          ? "The forest is choosing..."
                          : "One physical card awaits"}
                      </h3>

                      <p
                        className="
                          mt-3
                          max-w-xl
                          text-sm
                          font-medium
                          leading-6
                          text-white/45
                          md:text-base
                        "
                      >
                        {opening
                          ? "Your wallet, inventory and discovery record are being synchronised securely."
                          : `This discovery costs ${formatCurrency(
                              currentPrice,
                            )} and will remove one real card from inventory.`}
                      </p>
                    </div>
                  </div>
                )}

                {(opening ||
                  phase ===
                    "revealing") && (
                  <div
                    className="
                      mt-9
                      w-full
                      max-w-2xl
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-4
                        text-sm
                        font-black
                      "
                    >
                      <span className="text-emerald-100">
                        {stage}
                      </span>

                      <span className="text-white/40">
                        {progress}%
                      </span>
                    </div>

                    <div
                      className="
                        mt-3
                        h-3
                        overflow-hidden
                        rounded-full
                        border
                        border-white/10
                        bg-black/30
                        p-0.5
                      "
                    >
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-gradient-to-r
                          from-emerald-500
                          via-emerald-300
                          to-cyan-200
                          shadow-[0_0_22px_rgba(110,231,183,0.5)]
                          transition-[width]
                          duration-150
                        "
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="
                border-t
                border-white/10
                bg-black/10
                p-5
                md:p-8
              "
            >
              <div
                className="
                  mx-auto
                  max-w-3xl
                "
              >
                {revealedCard ? (
                  <div
                    className="
                      flex
                      flex-col
                      gap-3
                      sm:flex-row
                    "
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void openPull()
                      }
                      disabled={
                        opening ||
                        balance <
                          currentPrice ||
                        dailyPulls >=
                          DAILY_LIMIT
                      }
                      className="
                        flex
                        min-h-16
                        flex-1
                        items-center
                        justify-center
                        gap-3
                        rounded-2xl
                        border
                        border-emerald-100/30
                        bg-emerald-300
                        px-6
                        text-lg
                        font-black
                        text-emerald-950
                        shadow-[0_0_45px_rgba(110,231,183,0.25)]
                        transition
                        hover:-translate-y-0.5
                        hover:bg-emerald-200
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                    >
                      Open another ·{" "}
                      {formatCurrency(
                        currentPrice,
                      )}

                      <span>→</span>
                    </button>

                    <button
                      type="button"
                      onClick={
                        resetChamber
                      }
                      disabled={opening}
                      className="
                        min-h-16
                        rounded-2xl
                        border
                        border-white/15
                        bg-white/[0.06]
                        px-6
                        font-black
                        text-white
                        transition
                        hover:bg-white/10
                        disabled:opacity-50
                      "
                    >
                      Clear chamber
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void openPull()
                    }
                    disabled={
                      opening ||
                      balance <
                        currentPrice ||
                      dailyPulls >=
                        DAILY_LIMIT
                    }
                    className="
                      group
                      flex
                      min-h-20
                      w-full
                      items-center
                      justify-between
                      rounded-[1.75rem]
                      border
                      border-emerald-100/30
                      bg-gradient-to-r
                      from-emerald-300
                      via-emerald-200
                      to-cyan-200
                      px-5
                      text-emerald-950
                      shadow-[0_0_55px_rgba(110,231,183,0.28)]
                      transition
                      hover:-translate-y-0.5
                      hover:shadow-[0_0_70px_rgba(110,231,183,0.4)]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                      disabled:hover:translate-y-0
                      sm:px-7
                    "
                  >
                    <span
                      className="
                        flex
                        items-center
                        gap-4
                        text-left
                      "
                    >
                      <span
                        className="
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-2xl
                          bg-emerald-950/10
                          text-2xl
                        "
                      >
                        {opening
                          ? "◌"
                          : "✦"}
                      </span>

                      <span>
                        <span
                          className="
                            block
                            text-lg
                            font-black
                            sm:text-xl
                          "
                        >
                          {opening
                            ? "Opening discovery..."
                            : "Open Discovery"}
                        </span>

                        <span
                          className="
                            mt-0.5
                            block
                            text-xs
                            font-bold
                            text-emerald-950/55
                            sm:text-sm
                          "
                        >
                          Pull #
                          {dailyPulls + 1} ·
                          One real card
                        </span>
                      </span>
                    </span>

                    <span
                      className="
                        text-2xl
                        font-black
                        sm:text-3xl
                      "
                    >
                      {formatCurrency(
                        currentPrice,
                      )}
                    </span>
                  </button>
                )}

                <div className="mt-5">
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    <span>
                      Daily engine usage
                    </span>

                    <span>
                      {dailyPulls}/
                      {DAILY_LIMIT}
                    </span>
                  </div>

                  <div
                    className="
                      mt-2
                      h-2
                      overflow-hidden
                      rounded-full
                      bg-black/30
                    "
                  >
                    <div
                      className="
                        h-full
                        rounded-full
                        bg-gradient-to-r
                        from-emerald-500
                        to-cyan-300
                        transition-all
                        duration-500
                      "
                      style={{
                        width: `${dailyProgress}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside
            className="
              space-y-8
              xl:sticky
              xl:top-28
              xl:self-start
            "
          >
            <section
              className="
                rounded-[2.75rem]
                border
                border-white/15
                bg-white/[0.075]
                p-6
                shadow-[0_30px_90px_rgba(0,0,0,0.28)]
                backdrop-blur-3xl
                md:p-8
              "
            >
              <p
                className="
                  text-sm
                  font-black
                  uppercase
                  tracking-[0.2em]
                  text-emerald-200/55
                "
              >
                Today's economics
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-black
                  tracking-tight
                "
              >
                Pull performance
              </h2>

              <div
                className="
                  mt-6
                  grid
                  grid-cols-2
                  gap-3
                "
              >
                <div
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-black/15
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Amount spent
                  </p>

                  <p
                    className="
                      mt-3
                      text-2xl
                      font-black
                    "
                  >
                    {formatCurrency(
                      todaySpent,
                    )}
                  </p>
                </div>

                <div
                  className="
                    rounded-2xl
                    border
                    border-emerald-200/15
                    bg-emerald-300/[0.07]
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-emerald-100/45
                    "
                  >
                    Card value
                  </p>

                  <p
                    className="
                      mt-3
                      text-2xl
                      font-black
                      text-emerald-200
                    "
                  >
                    {formatCurrency(
                      todayValue,
                    )}
                  </p>
                </div>

                <div
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-black/15
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Average card
                  </p>

                  <p
                    className="
                      mt-3
                      text-2xl
                      font-black
                    "
                  >
                    {formatCurrency(
                      averageCardValue,
                    )}
                  </p>
                </div>

                <div
                  className={`
                    rounded-2xl
                    border
                    p-4
                    ${
                      netToday >= 0
                        ? `
                          border-emerald-200/15
                          bg-emerald-300/[0.07]
                        `
                        : `
                          border-rose-200/15
                          bg-rose-300/[0.07]
                        `
                    }
                  `}
                >
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Net position
                  </p>

                  <p
                    className={`
                      mt-3
                      text-2xl
                      font-black
                      ${
                        netToday >= 0
                          ? "text-emerald-200"
                          : "text-rose-200"
                      }
                    `}
                  >
                    {netToday >= 0
                      ? "+"
                      : ""}

                    {formatCurrency(
                      netToday,
                    )}
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-6
                  rounded-[1.75rem]
                  border
                  border-white/10
                  bg-black/15
                  p-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                  "
                >
                  <div className="min-w-0">
                    <p
                      className="
                        text-xs
                        font-black
                        uppercase
                        tracking-[0.14em]
                        text-white/35
                      "
                    >
                      Best pull today
                    </p>

                    <p
                      className="
                        mt-2
                        truncate
                        text-lg
                        font-black
                      "
                    >
                      {bestPullToday?.name ||
                        "No discoveries yet"}
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        font-semibold
                        text-white/40
                      "
                    >
                      {bestPullToday?.rarity ||
                        "Open the first card"}
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      h-20
                      w-16
                      flex-none
                      items-center
                      justify-center
                      overflow-hidden
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.05]
                    "
                  >
                    {bestPullToday?.image_url ? (
                      <img
                        src={
                          bestPullToday.image_url
                        }
                        alt={
                          bestPullToday.name
                        }
                        className="
                          h-full
                          w-full
                          object-contain
                          p-1
                        "
                      />
                    ) : (
                      <span className="text-2xl">
                        🎴
                      </span>
                    )}
                  </div>
                </div>

                {bestPullToday && (
                  <p
                    className="
                      mt-4
                      border-t
                      border-white/10
                      pt-4
                      text-right
                      text-xl
                      font-black
                      text-emerald-200
                    "
                  >
                    {formatCurrency(
                      bestPullToday.market_value,
                    )}
                  </p>
                )}
              </div>
            </section>

            <section
              className="
                rounded-[2.75rem]
                border
                border-white/15
                bg-white/[0.075]
                p-6
                shadow-[0_30px_90px_rgba(0,0,0,0.28)]
                backdrop-blur-3xl
                md:p-8
              "
            >
              <p
                className="
                  text-sm
                  font-black
                  uppercase
                  tracking-[0.2em]
                  text-cyan-200/55
                "
              >
                Dynamic ladder
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-black
                  tracking-tight
                "
              >
                Upcoming prices
              </h2>

              <p
                className="
                  mt-3
                  text-sm
                  font-medium
                  leading-6
                  text-white/45
                "
              >
                Each daily discovery increases the next pull
                by £1.
              </p>

              <div
                className="
                  mt-6
                  space-y-3
                "
              >
                {priceForecast.length >
                0 ? (
                  priceForecast.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          item.pullNumber
                        }
                        className={`
                          flex
                          items-center
                          justify-between
                          rounded-2xl
                          border
                          px-4
                          py-4
                          ${
                            index === 0
                              ? `
                                border-emerald-200/25
                                bg-emerald-300/10
                              `
                              : `
                                border-white/10
                                bg-black/15
                              `
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >
                          <span
                            className={`
                              flex
                              h-9
                              w-9
                              items-center
                              justify-center
                              rounded-xl
                              text-sm
                              font-black
                              ${
                                index ===
                                0
                                  ? `
                                    bg-emerald-300
                                    text-emerald-950
                                  `
                                  : `
                                    bg-white/[0.06]
                                    text-white/55
                                  `
                              }
                            `}
                          >
                            {
                              item.pullNumber
                            }
                          </span>

                          <div>
                            <p className="font-black">
                              {index ===
                              0
                                ? "Current pull"
                                : `Pull #${item.pullNumber}`}
                            </p>

                            <p
                              className="
                                text-xs
                                font-semibold
                                text-white/35
                              "
                            >
                              One physical card
                            </p>
                          </div>
                        </div>

                        <p
                          className={`
                            text-xl
                            font-black
                            ${
                              index === 0
                                ? "text-emerald-200"
                                : "text-white/65"
                            }
                          `}
                        >
                          {formatCurrency(
                            item.price,
                          )}
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <div
                    className="
                      rounded-2xl
                      border
                      border-amber-200/15
                      bg-amber-300/[0.07]
                      p-5
                      text-center
                      font-black
                      text-amber-100
                    "
                  >
                    Daily limit reached
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>

        <section
          className="
            mt-8
            overflow-hidden
            rounded-[2.75rem]
            border
            border-white/15
            bg-white/[0.075]
            shadow-[0_35px_100px_rgba(0,0,0,0.3)]
            backdrop-blur-3xl
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-white/10
              p-6
              sm:flex-row
              sm:items-center
              sm:justify-between
              md:p-8
            "
          >
            <div>
              <p
                className="
                  text-sm
                  font-black
                  uppercase
                  tracking-[0.2em]
                  text-emerald-200/55
                "
              >
                Discovery archive
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-black
                  tracking-tight
                "
              >
                Recent pulls
              </h2>
            </div>

            <div
              className="
                rounded-2xl
                border
                border-white/10
                bg-black/15
                px-4
                py-3
                text-sm
                font-black
                text-white/55
              "
            >
              Showing the latest{" "}
              {history.length} discoveries
            </div>
          </div>

          {history.length === 0 ? (
            <div
              className="
                flex
                min-h-[25rem]
                flex-col
                items-center
                justify-center
                px-6
                text-center
              "
            >
              <div
                className="
                  flex
                  h-24
                  w-24
                  items-center
                  justify-center
                  rounded-[2rem]
                  border
                  border-white/10
                  bg-white/[0.05]
                  text-5xl
                "
              >
                🌙
              </div>

              <h3
                className="
                  mt-6
                  text-2xl
                  font-black
                "
              >
                The archive is empty
              </h3>

              <p
                className="
                  mt-3
                  max-w-md
                  text-sm
                  font-medium
                  leading-6
                  text-white/45
                "
              >
                Complete your first pull and its physical
                card, price and value will appear here.
              </p>
            </div>
          ) : (
            <div
              className="
                grid
                gap-4
                p-4
                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
                md:p-8
              "
            >
              {history.map(
                (item, index) => (
                  <article
                    key={
                      item.historyId
                    }
                    className="
                      group
                      relative
                      overflow-hidden
                      rounded-[2rem]
                      border
                      border-white/10
                      bg-white/[0.045]
                      p-4
                      transition
                      duration-200
                      hover:-translate-y-1
                      hover:border-emerald-200/20
                      hover:bg-white/[0.07]
                    "
                  >
                    {index === 0 && (
                      <span
                        className="
                          absolute
                          right-4
                          top-4
                          z-20
                          rounded-full
                          border
                          border-emerald-100/20
                          bg-emerald-300
                          px-3
                          py-1
                          text-[0.65rem]
                          font-black
                          uppercase
                          tracking-[0.12em]
                          text-emerald-950
                          shadow-lg
                        "
                      >
                        Latest
                      </span>
                    )}

                    <div
                      className="
                        flex
                        h-64
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-[1.5rem]
                        border
                        border-white/10
                        bg-gradient-to-br
                        from-black/25
                        to-emerald-950/20
                      "
                    >
                      {item.image_url ? (
                        <img
                          src={
                            item.image_url
                          }
                          alt={item.name}
                          className="
                            h-full
                            w-full
                            object-contain
                            p-3
                            drop-shadow-2xl
                            transition
                            duration-300
                            group-hover:scale-[1.04]
                          "
                        />
                      ) : (
                        <span className="text-6xl">
                          🎴
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div className="min-w-0">
                          <h3
                            className="
                              truncate
                              text-lg
                              font-black
                            "
                          >
                            {item.name}
                          </h3>

                          <p
                            className="
                              mt-1
                              text-xs
                              font-semibold
                              text-white/35
                            "
                          >
                            {formatHistoryTime(
                              item.created_at,
                            )}
                          </p>
                        </div>

                        <span
                          className="
                            flex-none
                            rounded-xl
                            border
                            border-white/10
                            bg-black/15
                            px-2.5
                            py-1.5
                            text-xs
                            font-black
                            text-white/55
                          "
                        >
                          #{index + 1}
                        </span>
                      </div>

                      <span
                        className={`
                          mt-3
                          inline-flex
                          max-w-full
                          truncate
                          rounded-full
                          border
                          px-3
                          py-1.5
                          text-xs
                          font-black
                          ${rarityStyle(
                            item.rarity,
                          )}
                        `}
                      >
                        {item.rarity}
                      </span>

                      <div
                        className="
                          mt-4
                          grid
                          grid-cols-2
                          gap-2
                          border-t
                          border-white/10
                          pt-4
                        "
                      >
                        <div>
                          <p
                            className="
                              text-[0.65rem]
                              font-black
                              uppercase
                              tracking-[0.14em]
                              text-white/30
                            "
                          >
                            Paid
                          </p>

                          <p
                            className="
                              mt-1
                              font-black
                              text-white/70
                            "
                          >
                            {formatCurrency(
                              item.amount_paid,
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className="
                              text-[0.65rem]
                              font-black
                              uppercase
                              tracking-[0.14em]
                              text-white/30
                            "
                          >
                            Card value
                          </p>

                          <p
                            className="
                              mt-1
                              font-black
                              text-emerald-200
                            "
                          >
                            {formatCurrency(
                              item.market_value,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <footer
          className="
            mt-8
            flex
            flex-col
            gap-2
            rounded-[2rem]
            border
            border-white/10
            bg-black/15
            px-6
            py-5
            text-sm
            font-semibold
            text-white/35
            backdrop-blur-2xl
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p>
            Every successful pull removes one physical card
            from inventory and creates a permanent discovery
            record.
          </p>

          <p>
            {lastUpdated
              ? `Last synchronised ${lastUpdated.toLocaleTimeString(
                  "en-GB",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}`
              : "Waiting for synchronisation"}
          </p>
        </footer>
      </div>
    </main>
  );
}