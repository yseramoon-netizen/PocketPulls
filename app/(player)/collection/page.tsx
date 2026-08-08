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
  PlayerErrorBanner,
  PlayerSecondaryButton,
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

import styles from "./collection.module.css";

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

  const binderSlots = Array.from({ length: PAGE_SIZE }, (_, index) => cards[index] ?? null);
  const leftPage = binderSlots.slice(0, 12);
  const rightPage = binderSlots.slice(12, 24);

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your card binder</p>
          <h1 className={styles.title}>Collection</h1>
        </div>

        <div className={styles.headerStats}>
          <div><span>Cards</span><strong>{formatWholeNumber(overview.totalCards)}</strong></div>
          <div><span>Unique</span><strong>{formatWholeNumber(overview.uniqueCards)}</strong></div>
          <div><span>Value</span><strong>{formatMoney(overview.collectionValue)}</strong></div>
        </div>
      </header>

      <PlayerErrorBanner message={errorMessage} onRetry={() => void refresh()} />

      <div className={styles.toolbar}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search cards..."
          className={styles.searchInput}
        />

        <select
          value={setName}
          onChange={(event) => { setSetName(event.target.value); setPage(1); }}
          className={styles.select}
        >
          <option value="">All sets</option>
          {overview.sets.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <select
          value={rarity}
          onChange={(event) => { setRarity(event.target.value); setPage(1); }}
          className={styles.select}
        >
          <option value="">All rarities</option>
          {overview.rarities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <select
          value={sort}
          onChange={(event) => { setSort(event.target.value as SortOption); setPage(1); }}
          className={styles.select}
        >
          <option value="name">A–Z</option>
          <option value="value_desc">Highest value</option>
          <option value="value_asc">Lowest value</option>
          <option value="quantity_desc">Most copies</option>
        </select>

        <button type="button" onClick={() => void refresh()} disabled={refreshing} className={styles.refreshButton}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.filterRow}>
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => { setAvailability(option.value); setPage(1); }}
            className={availability === option.value ? styles.filterActive : styles.filterButton}
          >
            {option.label}
          </button>
        ))}
        <span className={styles.entryCount}>{formatWholeNumber(totalCount)} entries</span>
        {hasFilters ? <button type="button" onClick={clearFilters} className={styles.clearButton}>Clear</button> : null}
      </div>

      {loading ? (
        <div className={styles.binderLoading}>Opening your binder...</div>
      ) : cards.length === 0 ? (
        <div className={styles.emptyBinder}>
          <div className={styles.emptyPage}>
            <span>✦</span>
            <h2>{hasFilters ? "No cards match those filters." : "Your binder is waiting."}</h2>
            <p>{hasFilters ? "Try another search or filter." : "Complete a wish and your first card will appear here."}</p>
            {hasFilters ? <PlayerSecondaryButton onClick={clearFilters}>Clear filters</PlayerSecondaryButton> : null}
          </div>
        </div>
      ) : (
        <div className={`${styles.binder} ${filtering ? styles.binderFiltering : ""}`}>
          <div className={styles.coverEdgeLeft} />
          <BinderPage cards={leftPage} side="left" onOpen={setSelectedCard} />
          <div className={styles.spine} aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <span key={index} className={styles.ring} />)}
          </div>
          <BinderPage cards={rightPage} side="right" onOpen={setSelectedCard} />
          <div className={styles.coverEdgeRight} />
        </div>
      )}

      <div className={styles.pagination}>
        <span>Spread {page} of {totalPages}</span>
        <div>
          <PlayerSecondaryButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</PlayerSecondaryButton>
          <PlayerSecondaryButton onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</PlayerSecondaryButton>
        </div>
      </div>

      {selectedCard ? (
        <PlayerCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          signatureBusy={signatureBusy}
          onSetSignature={() => void setSignature(selectedCard)}
        />
      ) : null}
    </section>
  );
}

function BinderPage({
  cards,
  side,
  onOpen,
}: {
  cards: Array<CollectionCard | null>;
  side: "left" | "right";
  onOpen: (card: CollectionCard) => void;
}) {
  return (
    <div className={`${styles.binderPage} ${side === "left" ? styles.leftPage : styles.rightPage}`}>
      <div className={styles.pageSheen} />
      <div className={styles.pocketGrid}>
        {cards.map((card, index) => (
          card ? (
            <BinderPocket key={card.id} card={card} onOpen={() => onOpen(card)} />
          ) : (
            <div key={`empty-${side}-${index}`} className={styles.emptyPocket} aria-hidden="true">
              <span>✦</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function BinderPocket({ card, onOpen }: { card: CollectionCard; onOpen: () => void }) {
  const theme = getPlayerRarityTheme(card.rarity);
  const style = {
    "--rarity-colour": theme.primary,
    "--rarity-glow": theme.glow,
  } as CSSProperties;

  return (
    <button type="button" onClick={onOpen} style={style} className={styles.pocket}>
      <span className={styles.pocketPlastic} />
      {card.isSignature ? <span className={styles.signatureBadge}>★</span> : null}
      {card.quantity > 1 ? <span className={styles.quantityBadge}>×{card.quantity}</span> : null}

      <CardArtwork
        name={card.name}
        imageUrl={card.imageUrl}
        rarity={card.rarity}
        className={styles.cardArtwork}
      />

    </button>
  );
}
