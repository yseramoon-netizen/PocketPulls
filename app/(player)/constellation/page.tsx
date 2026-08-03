"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type WishRow = {
  id: string | number;
  card_id: string | number | null;
  market_value_at_wish: number | string | null;
  created_at: string | null;
};

type CardRow = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
};

type ConstellationStar = {
  id: string;
  cardId: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  marketValue: number;
  imageUrl: string | null;
  grantedAt: string | null;
  x: number;
  y: number;
  size: number;
  colour: string;
  glow: string;
  delay: number;
};

type RarityTheme = {
  colour: string;
  glow: string;
  rank: number;
};

const RARITY_THEMES: Record<string, RarityTheme> = {
  common: {
    colour: "#f8fafc",
    glow: "rgba(248,250,252,0.78)",
    rank: 1,
  },
  uncommon: {
    colour: "#86efac",
    glow: "rgba(74,222,128,0.86)",
    rank: 2,
  },
  rare: {
    colour: "#7dd3fc",
    glow: "rgba(56,189,248,0.9)",
    rank: 3,
  },
  doubleRare: {
    colour: "#c4b5fd",
    glow: "rgba(167,139,250,0.94)",
    rank: 4,
  },
  ultraRare: {
    colour: "#fde68a",
    glow: "rgba(251,191,36,0.96)",
    rank: 5,
  },
  illustrationRare: {
    colour: "#f9a8d4",
    glow: "rgba(232,121,249,0.96)",
    rank: 5,
  },
  specialIllustrationRare: {
    colour: "#67e8f9",
    glow: "rgba(244,114,182,1)",
    rank: 6,
  },
  hyperRare: {
    colour: "#fef08a",
    glow: "rgba(250,204,21,1)",
    rank: 7,
  },
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normaliseRarity(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/pokemon/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRarityTheme(
  rarity: string | null | undefined,
): RarityTheme {
  const value = normaliseRarity(rarity);

  if (
    value.includes("hyper rare") ||
    value.includes("secret rare") ||
    value.includes("gold rare") ||
    value.includes("crown rare")
  ) {
    return RARITY_THEMES.hyperRare;
  }

  if (
    value.includes("special illustration") ||
    value.includes("special art") ||
    value.includes("alternate art")
  ) {
    return RARITY_THEMES.specialIllustrationRare;
  }

  if (
    value.includes("illustration rare") ||
    value.includes("trainer gallery") ||
    value.includes("character rare")
  ) {
    return RARITY_THEMES.illustrationRare;
  }

  if (
    value.includes("ultra rare") ||
    value.includes("full art") ||
    value.includes("rainbow rare") ||
    value.includes("ace spec")
  ) {
    return RARITY_THEMES.ultraRare;
  }

  if (
    value.includes("double rare") ||
    value.includes("rare holo ex") ||
    value.includes("rare holo gx") ||
    value.includes("rare holo v") ||
    value.includes("rare holo vmax") ||
    value.includes("rare holo vstar")
  ) {
    return RARITY_THEMES.doubleRare;
  }

  if (
    value.includes("rare") ||
    value.includes("holo") ||
    value.includes("radiant")
  ) {
    return RARITY_THEMES.rare;
  }

  if (value.includes("uncommon")) {
    return RARITY_THEMES.uncommon;
  }

  return RARITY_THEMES.common;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStar(
  wish: WishRow,
  card: CardRow | undefined,
  index: number,
): ConstellationStar {
  const id = String(wish.id);
  const cardId = String(wish.card_id ?? card?.id ?? "");
  const rarity = card?.rarity?.trim() || "Common";
  const theme = getRarityTheme(rarity);
  const random = seededRandom(hashString(`${id}:${cardId}`));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle + random() * 0.55;
  const radius = Math.min(43, 9 + Math.sqrt(index + 1) * 7.3);

  const x = Math.max(
    7,
    Math.min(93, 50 + Math.cos(angle) * radius + (random() - 0.5) * 5),
  );

  const y = Math.max(
    8,
    Math.min(91, 49 + Math.sin(angle) * radius * 0.76 + (random() - 0.5) * 5),
  );

  const marketValue = Math.max(
    toNumber(wish.market_value_at_wish),
    toNumber(card?.market_value),
  );

  const valueBoost = Math.min(5, Math.log10(marketValue + 1) * 2.3);

  return {
    id,
    cardId,
    name: card?.name?.trim() || "Mystery card",
    setName: card?.set_name?.trim() || "Unknown set",
    cardNumber: card?.card_no?.trim() || null,
    rarity,
    marketValue,
    imageUrl: card?.image_url?.trim() || null,
    grantedAt: wish.created_at,
    x,
    y,
    size: 7 + theme.rank * 1.15 + valueBoost,
    colour: theme.colour,
    glow: theme.glow,
    delay: Math.min(1200, index * 35),
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "A forgotten night";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "A forgotten night";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMilestoneMessage(count: number): string {
  if (count >= 1000) {
    return "Your sky has become a galaxy.";
  }

  if (count >= 500) {
    return "Even Jirachi can no longer count every light.";
  }

  if (count >= 250) {
    return "A great constellation watches over your collection.";
  }

  if (count >= 100) {
    return "One hundred wishes now burn in the night.";
  }

  if (count >= 50) {
    return "Your constellation can be seen from far away.";
  }

  if (count >= 25) {
    return "The shape of your journey is beginning to appear.";
  }

  if (count >= 10) {
    return "A true constellation has formed.";
  }

  if (count >= 2) {
    return "Your stars are beginning to find one another.";
  }

  if (count === 1) {
    return "Every constellation begins with a single wish.";
  }

  return "Make your first wish and place a star in the sky.";
}

export default function ConstellationPage() {
  const [stars, setStars] = useState<ConstellationStar[]>([]);
  const [selectedStar, setSelectedStar] =
    useState<ConstellationStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConstellation = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in to see your constellation.");
      }

      const { data: wishData, error: wishError } = await supabase
        .from("player_wishes")
        .select("id, card_id, market_value_at_wish, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(2000);

      if (wishError) {
        throw wishError;
      }

      const wishes = (wishData || []) as WishRow[];
      const cardIds = Array.from(
        new Set(
          wishes
            .map((wish) => wish.card_id)
            .filter(
              (value): value is string | number =>
                value !== null && value !== undefined,
            ),
        ),
      );

      let cards: CardRow[] = [];

      if (cardIds.length > 0) {
        const { data: cardData, error: cardError } = await supabase
          .from("pokemon_cards")
          .select(
            "id, name, set_name, card_no, rarity, market_value, image_url",
          )
          .in("id", cardIds);

        if (cardError) {
          throw cardError;
        }

        cards = (cardData || []) as CardRow[];
      }

      const cardMap = new Map(
        cards.map((card) => [String(card.id), card]),
      );

      const nextStars = wishes.map((wish, index) =>
        buildStar(
          wish,
          cardMap.get(String(wish.card_id ?? "")),
          index,
        ),
      );

      setStars(nextStars);

      setSelectedStar((current) => {
        if (!current) {
          return nextStars.at(-1) || null;
        }

        return (
          nextStars.find((star) => star.id === current.id) ||
          nextStars.at(-1) ||
          null
        );
      });
    } catch (error: unknown) {
      console.error("Constellation load error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your constellation could not be loaded.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadConstellation(false);
  }, [loadConstellation]);

  const totalValue = useMemo(
    () => stars.reduce((sum, star) => sum + star.marketValue, 0),
    [stars],
  );

  const rarestStar = useMemo(() => {
    return [...stars].sort((first, second) => {
      const firstRank = getRarityTheme(first.rarity).rank;
      const secondRank = getRarityTheme(second.rarity).rank;

      if (secondRank !== firstRank) {
        return secondRank - firstRank;
      }

      return second.marketValue - first.marketValue;
    })[0] || null;
  }, [stars]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/40">
            Jirachi&apos;s memory
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Your Wish Constellation
          </h1>

          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
            Every card Jirachi has granted you lives here as a permanent
            star. Better rarities burn brighter, and valuable cards become
            larger lights in your personal sky.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadConstellation(true);
          }}
          disabled={refreshing}
          className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          {refreshing ? "Reading the stars..." : "Refresh constellation"}
        </button>
      </header>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-200/15 bg-red-400/[0.08] p-4 text-sm font-semibold text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Stars"
          value={String(stars.length)}
          detail={getMilestoneMessage(stars.length)}
        />

        <StatCard
          label="Starlight value"
          value={formatMoney(totalValue)}
          detail="Value when each wish was granted"
        />

        <StatCard
          label="Brightest star"
          value={rarestStar?.name || "Waiting"}
          detail={
            rarestStar
              ? rarestStar.rarity
              : "Your first wish will appear here"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <article className="relative min-h-[680px] overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#050619] shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(103,232,249,0.08),transparent_32%),radial-gradient(circle_at_25%_15%,rgba(196,181,253,0.08),transparent_27%),radial-gradient(circle_at_80%_20%,rgba(249,168,212,0.06),transparent_25%)]" />

          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_10%_18%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_21%_43%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_38%_17%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_55%_29%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_69%_12%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_82%_37%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_91%_18%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_14%_72%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_36%_82%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_62%_69%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_84%_79%,white_0_1px,transparent_1.5px)]" />

          {loading ? (
            <div className="relative z-10 flex min-h-[680px] flex-col items-center justify-center text-center">
              <div className="h-16 w-16 animate-pulse rounded-full bg-white shadow-[0_0_55px_18px_rgba(255,255,255,0.3)]" />

              <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Rebuilding your night sky
              </p>
            </div>
          ) : stars.length === 0 ? (
            <div className="relative z-10 flex min-h-[680px] flex-col items-center justify-center px-6 text-center">
              <div className="text-8xl text-yellow-100/30">*</div>

              <h2 className="mt-4 text-2xl font-black text-white">
                The sky is waiting for you.
              </h2>

              <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/40">
                Return to the Wish Chamber and let Jirachi place your first
                permanent star here.
              </p>
            </div>
          ) : (
            <div className="relative z-10 min-h-[680px]">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
              >
                {stars.slice(1).map((star, index) => {
                  const previous = stars[index];

                  return (
                    <line
                      key={`${previous.id}-${star.id}`}
                      x1={previous.x}
                      y1={previous.y}
                      x2={star.x}
                      y2={star.y}
                      stroke="rgba(196,181,253,0.65)"
                      strokeWidth="0.12"
                      strokeDasharray="0.6 1.1"
                    />
                  );
                })}
              </svg>

              {stars.map((star) => {
                const active = selectedStar?.id === star.id;

                return (
                  <button
                    key={star.id}
                    type="button"
                    onClick={() => setSelectedStar(star)}
                    aria-label={`${star.name}, ${star.rarity}`}
                    className={[
                      "absolute rounded-full transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                      active
                        ? "z-20 scale-150"
                        : "z-10 hover:scale-150",
                    ].join(" ")}
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      background: star.colour,
                      boxShadow: active
                        ? `0 0 ${star.size * 2.8}px ${star.size * 0.72}px ${star.glow}`
                        : `0 0 ${star.size * 1.8}px ${star.size * 0.4}px ${star.glow}`,
                      transform: "translate(-50%, -50%)",
                      animation: `constellationStarIn 650ms ${star.delay}ms ease-out both`,
                    }}
                  >
                    <span className="sr-only">{star.name}</span>
                  </button>
                );
              })}

              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.58rem] font-black uppercase tracking-[0.18em] text-white/20">
                Select any star to remember its wish
              </p>
            </div>
          )}
        </article>

        <aside className="overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/85 p-5 backdrop-blur-xl">
          {selectedStar ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    background: `radial-gradient(circle at 50% 35%, ${selectedStar.glow}, transparent 55%)`,
                  }}
                />

                <div className="relative mx-auto aspect-[0.716] w-full max-w-[15rem] overflow-hidden rounded-xl bg-[#050713] shadow-[0_20px_55px_rgba(0,0,0,0.55)]">
                  {selectedStar.imageUrl ? (
                    <img
                      src={selectedStar.imageUrl}
                      alt={selectedStar.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-5 text-center">
                      <span
                        className="text-7xl"
                        style={{
                          color: selectedStar.colour,
                          filter: `drop-shadow(0 0 22px ${selectedStar.glow})`,
                        }}
                      >
                        *
                      </span>

                      <strong className="text-white">
                        {selectedStar.name}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <p
                  className="text-[0.62rem] font-black uppercase tracking-[0.18em]"
                  style={{ color: selectedStar.colour }}
                >
                  {selectedStar.rarity}
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {selectedStar.name}
                </h2>

                <p className="mt-2 text-sm font-semibold text-white/40">
                  {[
                    selectedStar.setName,
                    selectedStar.cardNumber
                      ? `#${selectedStar.cardNumber}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>

                <div className="mt-5 space-y-3">
                  <MemoryRow
                    label="Wish granted"
                    value={formatDate(selectedStar.grantedAt)}
                  />

                  <MemoryRow
                    label="Value that night"
                    value={formatMoney(selectedStar.marketValue)}
                  />

                  <MemoryRow
                    label="Star number"
                    value={`#${stars.findIndex(
                      (star) => star.id === selectedStar.id,
                    ) + 1}`}
                  />
                </div>

                <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold italic leading-6 text-white/40">
                  “A wish remembered becomes a light that never disappears.”
                </p>
              </div>
            </>
          ) : (
            <div className="flex min-h-[34rem] flex-col items-center justify-center text-center">
              <span className="text-7xl text-yellow-100/25">*</span>
              <p className="mt-4 text-sm font-bold text-white/35">
                Select a star from your sky.
              </p>
            </div>
          )}
        </aside>
      </div>

      <style jsx global>{`
        @keyframes constellationStarIn {
          0% {
            opacity: 0;
            filter: brightness(3);
          }

          60% {
            opacity: 1;
            filter: brightness(1.8);
          }

          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
      `}</style>
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>

      <p className="mt-3 truncate text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-white/30">
        {detail}
      </p>
    </article>
  );
}

function MemoryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-xs font-bold text-white/30">{label}</span>
      <strong className="text-right text-xs text-white/75">{value}</strong>
    </div>
  );
}
