"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import PlayerCardModal, {
  type PlayerCardModalCard,
} from "@/components/player/PlayerCardModal";
import {
  CardArtwork,
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerLoadingCards,
  PlayerPageHeader,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
  RarityPill,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  normaliseStringArray,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { getPlayerRarityTheme } from "@/lib/player/rarity";

type CollectionRow = {
  card_id: string | number | null;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
  quantity: number | string | null;
  reserved_quantity: number | string | null;
  available_quantity: number | string | null;
  owned_value: number | string | null;
  is_signature: boolean | null;
  total_count: number | string | null;
};

type OverviewRow = {
  total_cards: number | string | null;
  unique_cards: number | string | null;
  available_cards: number | string | null;
  reserved_cards: number | string | null;
  collection_value: number | string | null;
  sets: unknown;
  rarities: unknown;
};

type CollectionCard = PlayerCardModalCard & {
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  ownedValue: number;
  isSignature: boolean;
};

type Overview = {
  totalCards: number;
  uniqueCards: number;
  availableCards: number;
  reservedCards: number;
  collectionValue: number;
  sets: string[];
  rarities: string[];
};

type Availability =
  | "all"
  | "available"
  | "reserved"
  | "duplicates";

type SortOption =
  | "name"
  | "value_desc"
  | "value_asc"
  | "quantity_desc";

const PAGE_SIZE = 24;

const EMPTY_OVERVIEW: Overview = {
  totalCards: 0,
  uniqueCards: 0,
  availableCards: 0,
  reservedCards: 0,
  collectionValue: 0,
  sets: [],
  rarities: [],
};

function parseOverview(value: unknown): Overview {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return EMPTY_OVERVIEW;
  }

  const data = row as OverviewRow;

  return {
    totalCards: toWholeNumber(data.total_cards),
    uniqueCards: toWholeNumber(data.unique_cards),
    availableCards: toWholeNumber(data.available_cards),
    reservedCards: toWholeNumber(data.reserved_cards),
    collectionValue: toNumber(data.collection_value),
    sets: normaliseStringArray(data.sets),
    rarities: normaliseStringArray(data.rarities),
  };
}

function parseRows(value: unknown): {
  cards: CollectionCard[];
  totalCount: number;
} {
  if (!Array.isArray(value)) {
    return {
      cards: [],
      totalCount: 0,
    };
  }

  const rows = value as CollectionRow[];

  return {
    cards: rows.map((row) => ({
      id: String(row.card_id ?? ""),
      name: row.name?.trim() || "Unknown card",
      setName: row.set_name?.trim() || "Unknown set",
      cardNumber: row.card_no?.trim() || null,
      rarity: row.rarity?.trim() || "Common",
      marketValue: toNumber(row.market_value),
      imageUrl: row.image_url?.trim() || null,
      quantity: toWholeNumber(row.quantity),
      reservedQuantity: toWholeNumber(
        row.reserved_quantity,
      ),
      availableQuantity: toWholeNumber(
        row.available_quantity,
      ),
      ownedValue: toNumber(row.owned_value),
      isSignature: row.is_signature === true,
    })),
    totalCount:
      rows.length > 0
        ? toWholeNumber(rows[0]?.total_count)
        : 0,
  };
}

export default function CollectionPage() {
  const requestRef = useRef(0);
  const searchTimerRef = useRef<number | null>(null);

  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [overview, setOverview] =
    useState<Overview>(EMPTY_OVERVIEW);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [setName, setSetName] = useState("");
  const [rarity, setRarity] = useState("");
  const [availability, setAvailability] =
    useState<Availability>("all");
  const [sort, setSort] = useState<SortOption>("name");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [selectedCard, setSelectedCard] =
    useState<CollectionCard | null>(null);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const hasFilters =
    search.length > 0 ||
    setName.length > 0 ||
    rarity.length > 0 ||
    availability !== "all" ||
    sort !== "name";

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_player_collection_overview",
    );

    if (error) {
      throw error;
    }

    setOverview(parseOverview(data));
  }, []);

  const loadCards = useCallback(
    async (background = false) => {
      const request = requestRef.current + 1;
      requestRef.current = request;

      if (background) {
        setFiltering(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const { data, error } = await supabase.rpc(
          "get_player_collection",
          {
            p_search: search,
            p_set_name: setName,
            p_rarity: rarity,
            p_availability: availability,
            p_sort: sort,
            p_page: page,
            p_page_size: PAGE_SIZE,
          },
        );

        if (error) {
          throw error;
        }

        if (request !== requestRef.current) {
          return;
        }

        const parsed = parseRows(data);
        setCards(parsed.cards);
        setTotalCount(parsed.totalCount);
      } catch (error: unknown) {
        if (request !== requestRef.current) {
          return;
        }

        console.error("Collection error:", error);
        setErrorMessage(
          getErrorMessage(
            error,
            "Your collection could not be loaded.",
          ),
        );
        setCards([]);
        setTotalCount(0);
      } finally {
        if (request === requestRef.current) {
          setLoading(false);
          setFiltering(false);
        }
      }
    },
    [
      search,
      setName,
      rarity,
      availability,
      sort,
      page,
    ],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        loadOverview(),
        loadCards(true),
      ]);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Your collection could not be refreshed.",
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadCards, loadOverview]);

  useEffect(() => {
    void Promise.all([
      loadOverview(),
      loadCards(false),
    ]).catch((error: unknown) => {
      setErrorMessage(
        getErrorMessage(
          error,
          "Your collection could not be prepared.",
        ),
      );
      setLoading(false);
    });
  }, [loadCards, loadOverview]);

  useEffect(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setSetName("");
    setRarity("");
    setAvailability("all");
    setSort("name");
    setPage(1);
  }, []);

  const setSignature = useCallback(
    async (card: CollectionCard) => {
      if (signatureBusy || card.isSignature) {
        return;
      }

      setSignatureBusy(true);
      setErrorMessage(null);

      try {
        const { error } = await supabase.rpc(
          "set_player_signature_card",
          {
            p_card_id: card.id,
          },
        );

        if (error) {
          throw error;
        }

        setCards((current) =>
          current.map((item) => ({
            ...item,
            isSignature: item.id === card.id,
          })),
        );

        setSelectedCard((current) =>
          current
            ? {
                ...current,
                isSignature: current.id === card.id,
              }
            : null,
        );

        window.dispatchEvent(
          new CustomEvent("pocketpulls:profile-updated"),
        );
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "Your signature card could not be saved.",
          ),
        );
      } finally {
        setSignatureBusy(false);
      }
    },
    [signatureBusy],
  );

  const filterOptions = useMemo(
    () => [
      {
        value: "all" as Availability,
        label: "All cards",
      },
      {
        value: "available" as Availability,
        label: "Available",
      },
      {
        value: "reserved" as Availability,
        label: "Reserved",
      },
      {
        value: "duplicates" as Availability,
        label: "Duplicates",
      },
    ],
    [],
  );

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Your physical archive"
        title="Collection"
        description="Every card here belongs to you. Track duplicates, reserved cards, current value and the signature card that represents your trainer profile."
        actions={
          <PlayerSecondaryButton
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing
              ? "Reading your archive..."
              : "Refresh collection"}
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void refresh()}
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PlayerStatCard
          label="Physical cards"
          value={formatWholeNumber(overview.totalCards)}
          detail="Every card currently owned"
          accent="violet"
        />

        <PlayerStatCard
          label="Unique cards"
          value={formatWholeNumber(overview.uniqueCards)}
          detail="Different catalogue entries"
          accent="cyan"
        />

        <PlayerStatCard
          label="Available"
          value={formatWholeNumber(
            overview.availableCards,
          )}
          detail="Ready for future shipping"
          accent="green"
        />

        <PlayerStatCard
          label="Reserved"
          value={formatWholeNumber(
            overview.reservedCards,
          )}
          detail="Already assigned to a shipment"
          accent="pink"
        />

        <PlayerStatCard
          label="Collection value"
          value={formatMoney(overview.collectionValue)}
          detail="Current raw-card reference value"
          accent="yellow"
        />
      </div>

      <PlayerPanel className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1.4fr)_repeat(3,minmax(10rem,1fr))]">
          <input
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
            placeholder="Search your cards..."
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-cyan-200/25"
          />

          <select
            value={setName}
            onChange={(event) => {
              setSetName(event.target.value);
              setPage(1);
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-[#101331] px-4 text-sm font-bold text-white/75"
          >
            <option value="">Every set</option>
            {overview.sets.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={rarity}
            onChange={(event) => {
              setRarity(event.target.value);
              setPage(1);
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-[#101331] px-4 text-sm font-bold text-white/75"
          >
            <option value="">Every rarity</option>
            {overview.rarities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortOption);
              setPage(1);
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-[#101331] px-4 text-sm font-bold text-white/75"
          >
            <option value="name">Name A-Z</option>
            <option value="value_desc">
              Highest owned value
            </option>
            <option value="value_asc">
              Lowest owned value
            </option>
            <option value="quantity_desc">
              Most duplicates
            </option>
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setAvailability(option.value);
                  setPage(1);
                }}
                className={`min-h-9 rounded-full border px-3 text-[0.65rem] font-black uppercase tracking-[0.1em] transition ${
                  availability === option.value
                    ? "border-cyan-100/20 bg-cyan-100/10 text-cyan-50"
                    : "border-white/10 bg-white/[0.035] text-white/35"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-white/30">
              {formatWholeNumber(totalCount)} entries
            </span>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-black uppercase tracking-[0.1em] text-cyan-100/50"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </PlayerPanel>

      {loading ? (
        <PlayerLoadingCards count={18} />
      ) : cards.length === 0 ? (
        <PlayerEmptyState
          title={
            hasFilters
              ? "No cards match those filters."
              : "Your collection is waiting."
          }
          description={
            hasFilters
              ? "Try another name, set, rarity or availability filter."
              : "Complete a wish and your first physical card will appear here."
          }
          action={
            hasFilters ? (
              <PlayerSecondaryButton
                onClick={clearFilters}
              >
                Clear filters
              </PlayerSecondaryButton>
            ) : null
          }
        />
      ) : (
        <>
          <div
            className={`mt-6 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${
              filtering ? "opacity-45" : "opacity-100"
            }`}
          >
            {cards.map((card) => (
              <CollectionTile
                key={card.id}
                card={card}
                onOpen={() => setSelectedCard(card)}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span className="text-xs font-bold text-white/30">
              Page {page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <PlayerSecondaryButton
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                disabled={page <= 1}
              >
                Previous
              </PlayerSecondaryButton>

              <PlayerSecondaryButton
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
                disabled={page >= totalPages}
              >
                Next
              </PlayerSecondaryButton>
            </div>
          </div>
        </>
      )}

      {selectedCard ? (
        <PlayerCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          signatureBusy={signatureBusy}
          onSetSignature={() =>
            void setSignature(selectedCard)
          }
        />
      ) : null}
    </section>
  );
}

function CollectionTile({
  card,
  onOpen,
}: {
  card: CollectionCard;
  onOpen: () => void;
}) {
  const theme = getPlayerRarityTheme(card.rarity);

  const style = {
    "--rarity-colour": theme.primary,
    "--rarity-glow": theme.glow,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#090b27]/88 p-2.5 text-left shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-white/20 sm:p-3"
    >
      {card.isSignature ? (
        <span className="absolute left-4 top-4 z-20 rounded-full border border-yellow-100/20 bg-yellow-100/15 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.1em] text-yellow-50 backdrop-blur-xl">
          ★ Signature
        </span>
      ) : null}

      <span className="absolute right-4 top-4 z-20 grid min-h-8 min-w-8 place-items-center rounded-full border border-white/10 bg-black/45 px-2 text-xs font-black text-white backdrop-blur-xl">
        ×{card.quantity}
      </span>

      <CardArtwork
        name={card.name}
        imageUrl={card.imageUrl}
        rarity={card.rarity}
        className="aspect-[0.716] rounded-xl border border-white/[0.07] transition duration-500 group-hover:scale-[1.015]"
      />

      <div className="px-1 pb-1 pt-3">
        <RarityPill rarity={card.rarity} />

        <h2 className="mt-2 truncate text-sm font-black text-white sm:text-base">
          {card.name}
        </h2>

        <p className="mt-1 truncate text-[0.7rem] font-semibold text-white/32">
          {card.setName}
          {card.cardNumber
            ? ` · #${card.cardNumber}`
            : ""}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
          <SmallMetric
            label="Available"
            value={card.availableQuantity}
          />
          <SmallMetric
            label="Value"
            value={formatMoney(card.ownedValue)}
            text
          />
        </div>
      </div>
    </button>
  );
}

function SmallMetric({
  label,
  value,
  text = false,
}: {
  label: string;
  value: number | string;
  text?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.5rem] font-black uppercase tracking-[0.1em] text-white/20">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-white/72">
        {text ? value : formatWholeNumber(Number(value))}
      </p>
    </div>
  );
}
