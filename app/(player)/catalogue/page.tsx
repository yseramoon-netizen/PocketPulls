"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { formatMarketValue } from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

type CatalogueRpcRow = {
  card_id: string | number | null;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
  stock_quantity: number | string | null;
  is_favourite: boolean | null;
  total_count: number | string | null;
};

type OverviewRpcRow = {
  sets: unknown;
  rarities: unknown;
  total_cards: number | string | null;
  in_stock_cards: number | string | null;
  physical_units: number | string | null;
  favourite_count: number | string | null;
};

type CatalogueCard = {
  id: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  marketValue: number;
  imageUrl: string | null;
  stockQuantity: number;
  isFavourite: boolean;
};

type CatalogueOverview = {
  sets: string[];
  rarities: string[];
  totalCards: number;
  inStockCards: number;
  physicalUnits: number;
  favouriteCount: number;
};

type StockFilter = "all" | "in_stock" | "out_of_stock";
type SortOption =
  | "name_asc"
  | "value_desc"
  | "value_asc"
  | "stock_desc";

type RarityTheme = {
  label: string;
  primary: string;
  secondary: string;
  glow: string;
  background: string;
};

const PAGE_SIZE = 24;

const EMPTY_OVERVIEW: CatalogueOverview = {
  sets: [],
  rarities: [],
  totalCards: 0,
  inStockCards: 0,
  physicalUnits: 0,
  favouriteCount: 0,
};

const RARITY_THEMES: Record<string, RarityTheme> = {
  common: {
    label: "Common",
    primary: "#e2e8f0",
    secondary: "#94a3b8",
    glow: "rgba(226,232,240,0.62)",
    background: "rgba(226,232,240,0.07)",
  },
  uncommon: {
    label: "Uncommon",
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.72)",
    background: "rgba(34,197,94,0.08)",
  },
  rare: {
    label: "Rare",
    primary: "#7dd3fc",
    secondary: "#2563eb",
    glow: "rgba(125,211,252,0.78)",
    background: "rgba(37,99,235,0.09)",
  },
  doubleRare: {
    label: "Double Rare",
    primary: "#c4b5fd",
    secondary: "#7c3aed",
    glow: "rgba(196,181,253,0.82)",
    background: "rgba(124,58,237,0.1)",
  },
  ultraRare: {
    label: "Ultra Rare",
    primary: "#fde68a",
    secondary: "#f59e0b",
    glow: "rgba(253,230,138,0.86)",
    background: "rgba(245,158,11,0.11)",
  },
  illustrationRare: {
    label: "Illustration Rare",
    primary: "#f9a8d4",
    secondary: "#a855f7",
    glow: "rgba(249,168,212,0.86)",
    background: "rgba(168,85,247,0.11)",
  },
  specialIllustrationRare: {
    label: "Special Illustration Rare",
    primary: "#67e8f9",
    secondary: "#f9a8d4",
    glow: "rgba(103,232,249,0.9)",
    background: "rgba(34,211,238,0.12)",
  },
  hyperRare: {
    label: "Hyper Rare",
    primary: "#fef08a",
    secondary: "#f59e0b",
    glow: "rgba(250,204,21,0.92)",
    background: "rgba(250,204,21,0.12)",
  },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function toWholeNumber(value: unknown): number {
  return Math.max(0, Math.floor(toNumber(value)));
}

function normaliseStringArray(value: unknown): string[] {
  let source = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return Array.from(
    new Set(
      source
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .map((item) => item.trim()),
    ),
  ).sort((first, second) =>
    first.localeCompare(second, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function parseOverview(value: unknown): CatalogueOverview {
  const row = Array.isArray(value) ? value[0] : value;

  if (typeof row !== "object" || row === null) {
    return EMPTY_OVERVIEW;
  }

  const parsed = row as OverviewRpcRow;

  return {
    sets: normaliseStringArray(parsed.sets),
    rarities: normaliseStringArray(parsed.rarities),
    totalCards: toWholeNumber(parsed.total_cards),
    inStockCards: toWholeNumber(parsed.in_stock_cards),
    physicalUnits: toWholeNumber(parsed.physical_units),
    favouriteCount: toWholeNumber(parsed.favourite_count),
  };
}

function parseCatalogueRows(value: unknown): {
  cards: CatalogueCard[];
  totalCount: number;
} {
  if (!Array.isArray(value)) {
    return {
      cards: [],
      totalCount: 0,
    };
  }

  const rows = value as CatalogueRpcRow[];

  return {
    cards: rows.map((row) => ({
      id: String(row.card_id ?? ""),
      name:
        typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : "Unknown card",
      setName:
        typeof row.set_name === "string" && row.set_name.trim()
          ? row.set_name.trim()
          : "Unknown set",
      cardNumber:
        typeof row.card_no === "string" && row.card_no.trim()
          ? row.card_no.trim()
          : null,
      rarity:
        typeof row.rarity === "string" && row.rarity.trim()
          ? row.rarity.trim()
          : "Common",
      marketValue: Math.max(0, toNumber(row.market_value)),
      imageUrl:
        typeof row.image_url === "string" && row.image_url.trim()
          ? row.image_url.trim()
          : null,
      stockQuantity: toWholeNumber(row.stock_quantity),
      isFavourite: row.is_favourite === true,
    })),
    totalCount:
      rows.length > 0
        ? toWholeNumber(rows[0]?.total_count)
        : 0,
  };
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
    value.includes("crown rare") ||
    value.includes("masterpiece")
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
    value.includes("ace spec") ||
    value.includes("amazing rare")
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

function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.floor(value)),
  );
}

function buildPageNumbers(
  currentPage: number,
  totalPages: number,
): number[] {
  if (totalPages <= 1) {
    return [1];
  }

  const candidates = new Set<number>([
    1,
    totalPages,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ]);

  return Array.from(candidates)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
}

export default function CataloguePage() {
  const requestNumberRef = useRef(0);
  const searchTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<CatalogueCard[]>([]);
  const [overview, setOverview] =
    useState<CatalogueOverview>(EMPTY_OVERVIEW);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [stockFilter, setStockFilter] =
    useState<StockFilter>("all");
  const [favouritesOnly, setFavouritesOnly] =
    useState(false);
  const [sort, setSort] = useState<SortOption>("name_asc");
  const [page, setPage] = useState(1);

  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [selectedCard, setSelectedCard] =
    useState<CatalogueCard | null>(null);
  const [favouriteBusyCardId, setFavouriteBusyCardId] =
    useState<string | null>(null);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const hasActiveFilters =
    search.length > 0 ||
    setFilter.length > 0 ||
    rarityFilter.length > 0 ||
    stockFilter !== "all" ||
    favouritesOnly ||
    sort !== "name_asc";

  const pageNumbers = useMemo(
    () => buildPageNumbers(page, totalPages),
    [page, totalPages],
  );

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_catalogue_overview",
    );

    if (error) {
      throw error;
    }

    setOverview(parseOverview(data));
  }, []);

  const loadCards = useCallback(
    async (background = false) => {
      const requestNumber = requestNumberRef.current + 1;
      requestNumberRef.current = requestNumber;

      if (background) {
        setFiltering(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const { data, error } = await supabase.rpc(
          "get_catalogue_cards",
          {
            p_search: search,
            p_set_name: setFilter,
            p_rarity: rarityFilter,
            p_stock_filter: stockFilter,
            p_favourites_only: favouritesOnly,
            p_sort: sort,
            p_page: page,
            p_page_size: PAGE_SIZE,
          },
        );

        if (error) {
          throw error;
        }

        if (requestNumber !== requestNumberRef.current) {
          return;
        }

        const parsed = parseCatalogueRows(data);

        setCards(parsed.cards);
        setTotalCount(parsed.totalCount);

        if (
          parsed.totalCount > 0 &&
          page > Math.ceil(parsed.totalCount / PAGE_SIZE)
        ) {
          setPage(
            Math.max(
              1,
              Math.ceil(parsed.totalCount / PAGE_SIZE),
            ),
          );
        }
      } catch (error: unknown) {
        if (requestNumber !== requestNumberRef.current) {
          return;
        }

        console.error("Catalogue load error:", error);

        setCards([]);
        setTotalCount(0);
        setErrorMessage(
          getErrorMessage(
            error,
            "The card catalogue could not be loaded.",
          ),
        );
      } finally {
        if (requestNumber === requestNumberRef.current) {
          setLoading(false);
          setFiltering(false);
        }
      }
    },
    [
      search,
      setFilter,
      rarityFilter,
      stockFilter,
      favouritesOnly,
      sort,
      page,
    ],
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setErrorMessage(null);

    try {
      await Promise.all([
        loadOverview(),
        loadCards(true),
      ]);
    } catch (error: unknown) {
      console.error("Catalogue refresh error:", error);

      setErrorMessage(
        getErrorMessage(
          error,
          "The catalogue could not be refreshed.",
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadCards, loadOverview]);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      setLoading(true);
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
          throw new Error(
            "Your trainer session has expired. Sign in again.",
          );
        }

        if (!active) {
          return;
        }

        setUserId(user.id);
        await loadOverview();
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        console.error("Catalogue setup error:", error);

        setErrorMessage(
          getErrorMessage(
            error,
            "The catalogue could not be prepared.",
          ),
        );
        setLoading(false);
      }
    };

    void initialise();

    return () => {
      active = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadCards(false);
  }, [userId, loadCards]);

  useEffect(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 320);

    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => {
    if (!selectedCard) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCard(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCard]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setSetFilter("");
    setRarityFilter("");
    setStockFilter("all");
    setFavouritesOnly(false);
    setSort("name_asc");
    setPage(1);
    searchInputRef.current?.focus();
  }, []);

  const toggleFavourite = useCallback(
    async (card: CatalogueCard) => {
      if (!userId || favouriteBusyCardId) {
        return;
      }

      const nextFavourite = !card.isFavourite;

      setFavouriteBusyCardId(card.id);
      setErrorMessage(null);

      setCards((current) =>
        current.map((item) =>
          item.id === card.id
            ? {
                ...item,
                isFavourite: nextFavourite,
              }
            : item,
        ),
      );

      setSelectedCard((current) =>
        current?.id === card.id
          ? {
              ...current,
              isFavourite: nextFavourite,
            }
          : current,
      );

      setOverview((current) => ({
        ...current,
        favouriteCount: Math.max(
          0,
          current.favouriteCount +
            (nextFavourite ? 1 : -1),
        ),
      }));

      try {
        if (nextFavourite) {
          const { error } = await supabase
            .from("player_favourite_cards")
            .upsert(
              {
                user_id: userId,
                card_id: card.id,
              },
              {
                onConflict: "user_id,card_id",
              },
            );

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase
            .from("player_favourite_cards")
            .delete()
            .eq("user_id", userId)
            .eq("card_id", card.id);

          if (error) {
            throw error;
          }
        }

        if (favouritesOnly && !nextFavourite) {
          setCards((current) =>
            current.filter((item) => item.id !== card.id),
          );
          setTotalCount((current) => Math.max(0, current - 1));
        }
      } catch (error: unknown) {
        console.error("Favourite update error:", error);

        setCards((current) =>
          current.map((item) =>
            item.id === card.id
              ? {
                  ...item,
                  isFavourite: card.isFavourite,
                }
              : item,
          ),
        );

        setSelectedCard((current) =>
          current?.id === card.id
            ? {
                ...current,
                isFavourite: card.isFavourite,
              }
            : current,
        );

        setOverview((current) => ({
          ...current,
          favouriteCount: Math.max(
            0,
            current.favouriteCount +
              (nextFavourite ? -1 : 1),
          ),
        }));

        setErrorMessage(
          getErrorMessage(
            error,
            "The favourite could not be saved.",
          ),
        );
      } finally {
        setFavouriteBusyCardId(null);
      }
    },
    [
      userId,
      favouriteBusyCardId,
      favouritesOnly,
    ],
  );

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <CatalogueHero
        overview={overview}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          void refreshAll();
        }}
      />

      {errorMessage ? (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-red-200/15 bg-red-400/[0.08] p-4 text-sm font-semibold text-red-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage}</span>

          <button
            type="button"
            onClick={() => {
              void refreshAll();
            }}
            className="min-h-10 flex-none rounded-xl border border-red-100/15 bg-red-100/[0.08] px-4 text-xs font-black uppercase tracking-[0.12em] text-red-50 transition hover:bg-red-100/[0.14]"
          >
            Try again
          </button>
        </div>
      ) : null}

      <CatalogueFilters
        searchInput={searchInput}
        searchInputRef={searchInputRef}
        sets={overview.sets}
        rarities={overview.rarities}
        setFilter={setFilter}
        rarityFilter={rarityFilter}
        stockFilter={stockFilter}
        favouritesOnly={favouritesOnly}
        sort={sort}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        filtering={filtering}
        onSearchInput={setSearchInput}
        onSetFilter={(value) => {
          setSetFilter(value);
          setPage(1);
        }}
        onRarityFilter={(value) => {
          setRarityFilter(value);
          setPage(1);
        }}
        onStockFilter={(value) => {
          setStockFilter(value);
          setPage(1);
        }}
        onFavouritesOnly={(value) => {
          setFavouritesOnly(value);
          setPage(1);
        }}
        onSort={(value) => {
          setSort(value);
          setPage(1);
        }}
        onClear={clearFilters}
      />

      {loading ? (
        <CatalogueLoadingGrid />
      ) : cards.length === 0 ? (
        <CatalogueEmptyState
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />
      ) : (
        <>
          <div
            className={`mt-6 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${
              filtering ? "opacity-45" : "opacity-100"
            }`}
          >
            {cards.map((card) => (
              <CatalogueCardTile
                key={card.id}
                card={card}
                favouriteBusy={
                  favouriteBusyCardId === card.id
                }
                onOpen={() => setSelectedCard(card)}
                onToggleFavourite={() => {
                  void toggleFavourite(card);
                }}
              />
            ))}
          </div>

          <CataloguePagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageNumbers={pageNumbers}
            onPage={(nextPage) => {
              setPage(nextPage);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          />
        </>
      )}

      {selectedCard ? (
        <CardDetailModal
          card={selectedCard}
          favouriteBusy={
            favouriteBusyCardId === selectedCard.id
          }
          onClose={() => setSelectedCard(null)}
          onToggleFavourite={() => {
            void toggleFavourite(selectedCard);
          }}
        />
      ) : null}
    </section>
  );
}

function CatalogueHero({
  overview,
  loading,
  refreshing,
  onRefresh,
}: {
  overview: CatalogueOverview;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[#090b27]/88 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-lg sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/40">
            Card archive
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
            Card Catalogue
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/45">
            Browse recorded cards, values and live availability.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="min-h-12 flex-none rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          label="Known cards"
          value={loading ? "—" : formatWholeNumber(overview.totalCards)}
          detail="Unique catalogue entries"
          accent="violet"
        />

        <OverviewCard
          label="Available species"
          value={loading ? "—" : formatWholeNumber(overview.inStockCards)}
          detail="Different cards in stock"
          accent="cyan"
        />

        <OverviewCard
          label="Physical cards"
          value={loading ? "—" : formatWholeNumber(overview.physicalUnits)}
          detail="Total wish-pool inventory"
          accent="yellow"
        />

        <OverviewCard
          label="Your favourites"
          value={loading ? "—" : formatWholeNumber(overview.favouriteCount)}
          detail="Saved to your trainer account"
          accent="pink"
        />
      </div>
    </header>
  );
}

function OverviewCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "violet" | "cyan" | "yellow" | "pink";
}) {
  const accentClasses = {
    violet:
      "border-violet-200/10 bg-violet-300/[0.045] text-violet-100",
    cyan:
      "border-cyan-200/10 bg-cyan-300/[0.045] text-cyan-100",
    yellow:
      "border-yellow-200/10 bg-yellow-300/[0.045] text-yellow-100",
    pink:
      "border-pink-200/10 bg-pink-300/[0.045] text-pink-100",
  };

  return (
    <article
      className={`rounded-2xl border p-4 ${accentClasses[accent]}`}
    >
      <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-45">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold text-white/30">
        {detail}
      </p>
    </article>
  );
}

function CatalogueFilters({
  searchInput,
  searchInputRef,
  sets,
  rarities,
  setFilter,
  rarityFilter,
  stockFilter,
  favouritesOnly,
  sort,
  hasActiveFilters,
  resultCount,
  filtering,
  onSearchInput,
  onSetFilter,
  onRarityFilter,
  onStockFilter,
  onFavouritesOnly,
  onSort,
  onClear,
}: {
  searchInput: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  sets: string[];
  rarities: string[];
  setFilter: string;
  rarityFilter: string;
  stockFilter: StockFilter;
  favouritesOnly: boolean;
  sort: SortOption;
  hasActiveFilters: boolean;
  resultCount: number;
  filtering: boolean;
  onSearchInput: (value: string) => void;
  onSetFilter: (value: string) => void;
  onRarityFilter: (value: string) => void;
  onStockFilter: (value: StockFilter) => void;
  onFavouritesOnly: (value: boolean) => void;
  onSort: (value: SortOption) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-6 rounded-[2rem] border border-white/10 bg-[#090b27]/80 p-4 backdrop-blur-xl sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1.5fr)_repeat(3,minmax(10rem,1fr))]">
        <label className="relative block">
          <span className="sr-only">Search cards</span>

          <SearchIcon />

          <input
            ref={searchInputRef}
            type="search"
            value={searchInput}
            onChange={(event) =>
              onSearchInput(event.target.value)
            }
            placeholder="Search card, set or number..."
            className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-200/25 focus:bg-white/[0.07] focus:ring-2 focus:ring-cyan-200/10"
          />
        </label>

        <FilterSelect
          label="Set"
          value={setFilter}
          onChange={onSetFilter}
        >
          <option value="">Every set</option>

          {sets.map((setName) => (
            <option key={setName} value={setName}>
              {setName}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Rarity"
          value={rarityFilter}
          onChange={onRarityFilter}
        >
          <option value="">Every rarity</option>

          {rarities.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(value) =>
            onSort(value as SortOption)
          }
        >
          <option value="name_asc">Name A–Z</option>
          <option value="value_desc">
            Highest value
          </option>
          <option value="value_asc">
            Lowest value
          </option>
          <option value="stock_desc">
            Most physical stock
          </option>
        </FilterSelect>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.07] pt-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={stockFilter === "all"}
            onClick={() => onStockFilter("all")}
          >
            All stock
          </FilterChip>

          <FilterChip
            active={stockFilter === "in_stock"}
            onClick={() => onStockFilter("in_stock")}
          >
            In stock
          </FilterChip>

          <FilterChip
            active={stockFilter === "out_of_stock"}
            onClick={() => onStockFilter("out_of_stock")}
          >
            Out of stock
          </FilterChip>

          <FilterChip
            active={favouritesOnly}
            onClick={() =>
              onFavouritesOnly(!favouritesOnly)
            }
            accent
          >
            ★ Favourites
          </FilterChip>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 xl:justify-end">
          <p className="text-xs font-bold text-white/30">
            {filtering
              ? "Searching the archive..."
              : `${formatWholeNumber(resultCount)} card${
                  resultCount === 1 ? "" : "s"
                } found`}
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-black uppercase tracking-[0.1em] text-cyan-100/50 transition hover:text-cyan-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101331] px-4 text-sm font-bold text-white/75 outline-none transition focus:border-violet-200/25 focus:ring-2 focus:ring-violet-200/10"
      >
        {children}
      </select>
    </label>
  );
}

function FilterChip({
  active,
  accent = false,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass = accent
    ? "border-yellow-100/25 bg-yellow-100/12 text-yellow-50"
    : "border-cyan-100/20 bg-cyan-100/10 text-cyan-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-[0.65rem] font-black uppercase tracking-[0.1em] transition ${
        active
          ? activeClass
          : "border-white/10 bg-white/[0.035] text-white/35 hover:bg-white/[0.07] hover:text-white/65"
      }`}
    >
      {children}
    </button>
  );
}

function CatalogueCardTile({
  card,
  favouriteBusy,
  onOpen,
  onToggleFavourite,
}: {
  card: CatalogueCard;
  favouriteBusy: boolean;
  onOpen: () => void;
  onToggleFavourite: () => void;
}) {
  const theme = getRarityTheme(card.rarity);

  const style = {
    "--card-primary": theme.primary,
    "--card-secondary": theme.secondary,
    "--card-glow": theme.glow,
    "--card-background": theme.background,
  } as CSSProperties;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#090b27]/88 p-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_25px_70px_rgba(0,0,0,0.3)] sm:p-3"
      style={style}
    >
      <button
        type="button"
        onClick={onToggleFavourite}
        disabled={favouriteBusy}
        aria-label={
          card.isFavourite
            ? `Remove ${card.name} from favourites`
            : `Add ${card.name} to favourites`
        }
        className={`absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border text-lg backdrop-blur-xl transition ${
          card.isFavourite
            ? "border-yellow-100/25 bg-yellow-100/15 text-yellow-100"
            : "border-white/10 bg-black/35 text-white/35 hover:bg-white/10 hover:text-white"
        } disabled:cursor-wait disabled:opacity-50`}
      >
        {card.isFavourite ? "★" : "☆"}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="relative aspect-[0.716] overflow-hidden rounded-xl border border-white/[0.07] bg-[#050713]">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(circle at 50% 38%, ${theme.glow}, transparent 60%)`,
            }}
          />

          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              loading="lazy"
              draggable={false}
              className="relative z-10 h-full w-full object-contain transition duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center">
              <span
                className="text-7xl"
                style={{
                  color: theme.primary,
                  filter: `drop-shadow(0 0 22px ${theme.glow})`,
                }}
              >
                *
              </span>

              <strong className="text-sm text-white/80">
                {card.name}
              </strong>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20"
            style={{
              background: `linear-gradient(to top, ${theme.background}, transparent)`,
            }}
          />

          <StockBadge
            quantity={card.stockQuantity}
          />
        </div>

        <div className="px-1 pb-1 pt-3">
          <p
            className="truncate text-[0.58rem] font-black uppercase tracking-[0.15em]"
            style={{ color: theme.primary }}
          >
            {card.rarity}
          </p>

          <h2 className="mt-1.5 truncate text-sm font-black text-white sm:text-base">
            {card.name}
          </h2>

          <p className="mt-1 truncate text-[0.7rem] font-semibold text-white/32">
            {card.setName}
            {card.cardNumber
              ? ` · #${card.cardNumber}`
              : ""}
          </p>

          <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/[0.06] pt-3">
            <div>
              <p className="text-[0.52rem] font-black uppercase tracking-[0.12em] text-white/22">
                Market value
              </p>

              <p className="mt-1 text-sm font-black text-white/85">
                {formatMarketValue(card.marketValue)}
              </p>
            </div>

            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{
                background: theme.primary,
                boxShadow: `0 0 13px ${theme.glow}`,
              }}
            />
          </div>
        </div>
      </button>
    </article>
  );
}

function StockBadge({
  quantity,
}: {
  quantity: number;
}) {
  const available = quantity > 0;

  return (
    <span
      className={`absolute bottom-3 left-3 z-20 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[0.55rem] font-black uppercase tracking-[0.1em] backdrop-blur-xl ${
        available
          ? "border-emerald-100/20 bg-emerald-300/15 text-emerald-50"
          : "border-white/10 bg-black/45 text-white/35"
      }`}
    >
      {available
        ? `${formatWholeNumber(quantity)} in stock`
        : "Unavailable"}
    </span>
  );
}

function CataloguePagination({
  page,
  totalPages,
  totalCount,
  pageNumbers,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageNumbers: number[];
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Catalogue pages"
      className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row"
    >
      <p className="text-xs font-bold text-white/30">
        Page {page} of {totalPages} ·{" "}
        {formatWholeNumber(totalCount)} cards
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageButton
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </PageButton>

        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const showGap =
            previous !== undefined &&
            pageNumber - previous > 1;

          return (
            <span
              key={pageNumber}
              className="contents"
            >
              {showGap ? (
                <span className="px-1 text-white/20">
                  …
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onPage(pageNumber)}
                aria-current={
                  pageNumber === page ? "page" : undefined
                }
                className={`grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-xs font-black transition ${
                  pageNumber === page
                    ? "border-cyan-100/20 bg-cyan-100/12 text-cyan-50"
                    : "border-white/10 bg-white/[0.035] text-white/38 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}

        <PageButton
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-xs font-black text-white/45 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-white/[0.035]"
    >
      {children}
    </button>
  );
}

function CatalogueLoadingGrid() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
        >
          <div className="aspect-[0.716] animate-pulse rounded-xl bg-white/[0.055]" />
          <div className="mt-4 h-2.5 w-1/2 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-white/[0.07]" />
          <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-white/[0.045]" />
          <div className="mt-5 h-8 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

function CatalogueEmptyState({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mt-6 flex min-h-[28rem] flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[#090b27]/75 px-6 text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <div className="absolute inset-3 animate-pulse rounded-full bg-cyan-200/10 blur-2xl" />

        <img
          src="/ancient-pulls/celestial-cat.webp"
          alt=""
          draggable={false}
          className="relative h-24 w-24 object-contain opacity-75 drop-shadow-[0_14px_22px_rgba(0,0,0,0.4)]"
        />
      </div>

      <h2 className="mt-5 text-2xl font-black text-white">
        {hasActiveFilters
          ? "No cards answered that search."
          : "The catalogue is waiting for cards."}
      </h2>

      <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/38">
        {hasActiveFilters
          ? "Try another name, set, rarity or stock filter."
          : "Cards will appear here as soon as they are added to the ancientpulls database."}
      </p>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 min-h-11 rounded-xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Clear every filter
        </button>
      ) : null}
    </div>
  );
}

function CardDetailModal({
  card,
  favouriteBusy,
  onClose,
  onToggleFavourite,
}: {
  card: CatalogueCard;
  favouriteBusy: boolean;
  onClose: () => void;
  onToggleFavourite: () => void;
}) {
  const theme = getRarityTheme(card.rarity);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-[#01020d]/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} card details`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <article className="relative my-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#080a24] shadow-[0_40px_140px_rgba(0,0,0,0.65)] lg:grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close card details"
          className="absolute right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/35 text-xl text-white/55 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
        >
          ×
        </button>

        <div className="relative flex min-h-[30rem] items-center justify-center overflow-hidden border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              background: `radial-gradient(circle at 50% 42%, ${theme.glow}, transparent 58%)`,
            }}
          />

          <div className="relative aspect-[0.716] w-full max-w-[21rem] overflow-hidden rounded-2xl border border-white/15 bg-[#050713] shadow-[0_30px_85px_rgba(0,0,0,0.6)]">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                draggable={false}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-6 text-center">
                <span
                  className="text-9xl"
                  style={{
                    color: theme.primary,
                    filter: `drop-shadow(0 0 30px ${theme.glow})`,
                  }}
                >
                  *
                </span>

                <strong className="text-xl text-white">
                  {card.name}
                </strong>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.035] to-white/[0.09]" />
          </div>
        </div>

        <div className="relative flex flex-col justify-center p-6 sm:p-9">
          <div
            className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full blur-[90px]"
            style={{ background: theme.background }}
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex min-h-8 items-center rounded-full border px-3 text-[0.6rem] font-black uppercase tracking-[0.15em]"
                style={{
                  color: theme.primary,
                  borderColor: theme.background,
                  background: theme.background,
                  boxShadow: `0 0 18px ${theme.background}`,
                }}
              >
                {card.rarity}
              </span>

              <StockBadgeInline
                quantity={card.stockQuantity}
              />
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {card.name}
            </h2>

            <p className="mt-3 text-sm font-semibold text-white/40">
              {card.setName}
              {card.cardNumber
                ? ` · Card #${card.cardNumber}`
                : ""}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Market value"
                value={formatMarketValue(card.marketValue)}
                detail="Reference raw-card value"
              />

              <DetailValue
                label="Physical stock"
                value={formatWholeNumber(
                  card.stockQuantity,
                )}
                detail={
                  card.stockQuantity > 0
                    ? "Cards currently in the wish pool"
                    : "No physical copies currently available"
                }
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-white/28">
                Wish-pool status
              </p>

              <p className="mt-3 text-sm font-semibold leading-7 text-white/48">
                {card.stockQuantity > 0
                  ? `${card.name} is currently capable of appearing in a real ancientpulls wish. Every awarded card removes one physical copy from live stock.`
                  : `${card.name} remains visible in the archive, but it cannot currently appear in a wish until new physical stock is added.`}
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onToggleFavourite}
                disabled={favouriteBusy}
                className={`min-h-12 flex-1 rounded-xl border px-5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50 disabled:hover:translate-y-0 ${
                  card.isFavourite
                    ? "border-yellow-100/20 bg-yellow-100/12 text-yellow-50"
                    : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {favouriteBusy
                  ? "Saving..."
                  : card.isFavourite
                    ? "★ Saved to favourites"
                    : "☆ Add to favourites"}
              </button>

              <Link
                href="/wishes"
                onClick={onClose}
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#e7ad46] via-[#48d5ca] to-[#d84f78] px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Visit the Wish Chamber
              </Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function StockBadgeInline({
  quantity,
}: {
  quantity: number;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[0.6rem] font-black uppercase tracking-[0.12em] ${
        quantity > 0
          ? "border-emerald-100/20 bg-emerald-300/12 text-emerald-50"
          : "border-white/10 bg-white/[0.04] text-white/35"
      }`}
    >
      {quantity > 0
        ? `${formatWholeNumber(quantity)} available`
        : "Out of stock"}
    </span>
  );
}

function DetailValue({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/27">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold leading-5 text-white/28">
        {detail}
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}
