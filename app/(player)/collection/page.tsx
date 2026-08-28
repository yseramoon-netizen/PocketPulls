"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import BinderSpread, {
  type BinderDisplayCard,
} from "@/components/player/BinderSpread";
import type { PlayerCardModalCard } from "@/components/player/PlayerCardModal";
import {
  PlayerErrorBanner,
  PlayerSecondaryButton,
} from "@/components/player/PlayerUI";
import { BINDER_THEMES } from "@/lib/player/binder";
import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  normaliseStringArray,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

import styles from "./collection.module.css";

const PlayerCardModal = dynamic(
  () => import("@/components/player/PlayerCardModal"),
  { ssr: false },
);

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

type BinderSettingsRow = {
  theme_key: string | null;
  binder_name: string | null;
  cosmic_binder_issue_number: number | string | null;
};

type BinderThemeUnlockRow = {
  theme_key: string | null;
  unlocked: boolean | null;
  achievement_title: string | null;
  requirement: string | null;
};


type AnniversaryRow = {
  card_id: string | number | null;
  years_ago: number | string | null;
  wished_at: string | null;
};

type BinderPositionRow = {
  binder_position: number | string | null;
};

type CollectionCard = PlayerCardModalCard & BinderDisplayCard & {
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

type Availability = "all" | "available" | "reserved" | "duplicates";
const PAGE_SIZE = 18;

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

function parseRows(value: unknown): { cards: CollectionCard[]; totalCount: number } {
  if (!Array.isArray(value)) {
    return { cards: [], totalCount: 0 };
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
      reservedQuantity: toWholeNumber(row.reserved_quantity),
      availableQuantity: toWholeNumber(row.available_quantity),
      ownedValue: toNumber(row.owned_value),
      isSignature: row.is_signature === true,
    })),
    totalCount: rows.length > 0 ? toWholeNumber(rows[0]?.total_count) : 0,
  };
}


function getLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CollectionPage() {
  const requestRef = useRef(0);
  const searchTimerRef = useRef<number | null>(null);

  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [themeKey, setThemeKey] = useState("classic");
  const [binderName, setBinderName] = useState("My Binder");
  const [binderNameInput, setBinderNameInput] = useState("My Binder");
  const [cosmicBinderIssueNumber, setCosmicBinderIssueNumber] = useState(0);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themeUnlocks, setThemeUnlocks] = useState<Record<string, BinderThemeUnlockRow>>({});
  const [anniversaryYearsByCard, setAnniversaryYearsByCard] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [setName, setSetName] = useState("");
  const [rarity, setRarity] = useState("");
  const [availability, setAvailability] = useState<Availability>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [prepared, setPrepared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapSource, setSwapSource] = useState<CollectionCard | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const hasFilters =
    search.length > 0 ||
    setName.length > 0 ||
    rarity.length > 0 ||
    availability !== "all";

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_player_collection_overview");
    if (error) throw error;
    setOverview(parseOverview(data));
  }, []);

  const loadBinderSettings = useCallback(async () => {
    const [settingsResult, themesResult] = await Promise.all([
      supabase.rpc("get_player_binder_settings"),
      supabase.rpc("get_player_binder_themes"),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (themesResult.error) throw themesResult.error;

    const row = Array.isArray(settingsResult.data)
      ? settingsResult.data[0]
      : settingsResult.data;

    if (row && typeof row === "object") {
      const settings = row as BinderSettingsRow;
      const theme = settings.theme_key;
      const name = settings.binder_name?.trim() || "My Binder";
      setThemeKey(typeof theme === "string" && theme.trim() ? theme : "classic");
      setBinderName(name);
      setBinderNameInput(name);
      setCosmicBinderIssueNumber(toWholeNumber(settings.cosmic_binder_issue_number));
    }

    const unlockMap: Record<string, BinderThemeUnlockRow> = {};
    if (Array.isArray(themesResult.data)) {
      for (const raw of themesResult.data as BinderThemeUnlockRow[]) {
        const key = raw.theme_key?.trim();
        if (key) unlockMap[key] = raw;
      }
    }
    setThemeUnlocks(unlockMap);
  }, []);

  const loadWishAnniversaries = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_player_wish_anniversaries", {
      p_today: getLocalDateKey(),
    });

    if (error) {
      console.warn("Wish anniversary lookup unavailable:", error);
      setAnniversaryYearsByCard({});
      return;
    }

    const next: Record<string, number> = {};
    if (Array.isArray(data)) {
      for (const raw of data as AnniversaryRow[]) {
        const cardId = raw.card_id === null || raw.card_id === undefined
          ? ""
          : String(raw.card_id);
        const years = toWholeNumber(raw.years_ago);
        if (cardId && years > 0) next[cardId] = Math.max(next[cardId] || 0, years);
      }
    }

    setAnniversaryYearsByCard(next);
  }, []);

  const syncBinderPositions = useCallback(async () => {
    const { error } = await supabase.rpc("sync_player_binder_positions");
    if (error) throw error;
  }, []);

  const loadCards = useCallback(
    async (background = false) => {
      const request = requestRef.current + 1;
      requestRef.current = request;

      if (background) setFiltering(true);
      else setLoading(true);

      setErrorMessage(null);

      try {
        const { data, error } = await supabase.rpc("get_player_collection", {
          p_search: search,
          p_set_name: setName,
          p_rarity: rarity,
          p_availability: availability,
          p_sort: "binder",
          p_page: page,
          p_page_size: PAGE_SIZE,
        });

        if (error) throw error;
        if (request !== requestRef.current) return;

        const parsed = parseRows(data);
        setCards(parsed.cards);
        setTotalCount(parsed.totalCount);
      } catch (error: unknown) {
        if (request !== requestRef.current) return;
        console.error("Collection error:", error);
        setErrorMessage(getErrorMessage(error, "Your collection could not be loaded."));
        setCards([]);
        setTotalCount(0);
      } finally {
        if (request === requestRef.current) {
          setLoading(false);
          setFiltering(false);
        }
      }
    },
    [search, setName, rarity, availability, page],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setErrorMessage(null);

    try {
      await syncBinderPositions();
      await Promise.all([loadOverview(), loadBinderSettings(), loadWishAnniversaries(), loadCards(true)]);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Your collection could not be refreshed."));
    } finally {
      setRefreshing(false);
    }
  }, [loadBinderSettings, loadCards, loadOverview, loadWishAnniversaries, syncBinderPositions]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await syncBinderPositions();
        if (active) setPrepared(true);
        await Promise.all([loadOverview(), loadBinderSettings(), loadWishAnniversaries()]);
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error, "Your binder could not be prepared."));
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadBinderSettings, loadOverview, loadWishAnniversaries, syncBinderPositions]);

  useEffect(() => {
    if (!prepared) return;
    void loadCards(false);
  }, [prepared, loadCards]);

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
    setPage(1);
  }, []);

  const setSignature = useCallback(
    async (card: CollectionCard) => {
      if (signatureBusy || card.isSignature) return;

      setSignatureBusy(true);
      setErrorMessage(null);

      try {
        const { error } = await supabase.rpc("set_player_signature_card", {
          p_card_id: card.id,
        });
        if (error) throw error;

        setCards((current) =>
          current.map((item) => ({ ...item, isSignature: item.id === card.id })),
        );
        setSelectedCard((current) =>
          current ? { ...current, isSignature: current.id === card.id } : null,
        );
        window.dispatchEvent(new CustomEvent("pocketpulls:profile-updated"));
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, "Your signature card could not be saved."));
      } finally {
        setSignatureBusy(false);
      }
    },
    [signatureBusy],
  );

  const selectTheme = useCallback(
    async (nextTheme: string) => {
      if (themeBusy || nextTheme === themeKey) return;

      setThemeBusy(true);
      setErrorMessage(null);

      try {
        const { error } = await supabase.rpc("set_player_binder_theme", {
          p_theme_key: nextTheme,
        });
        if (error) throw error;
        setThemeKey(nextTheme);
        window.dispatchEvent(new CustomEvent("pocketpulls:binder-updated"));
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, "Your binder style could not be saved."));
      } finally {
        setThemeBusy(false);
      }
    },
    [themeBusy, themeKey],
  );

  const saveBinderName = useCallback(async () => {
    const nextName = binderNameInput.trim().slice(0, 40);
    if (!nextName || nameBusy) return;

    setNameBusy(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc("set_player_binder_name", {
        p_binder_name: nextName,
      });
      if (error) throw error;
      setBinderName(nextName);
      setBinderNameInput(nextName);
      window.dispatchEvent(new CustomEvent("pocketpulls:binder-updated"));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Your binder name could not be saved."));
    } finally {
      setNameBusy(false);
    }
  }, [binderNameInput, nameBusy]);

  const startSwap = useCallback(async (card: CollectionCard) => {
    setSelectedCard(null);
    setSwapMessage(null);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_player_binder_position", {
        p_card_id: card.id,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const position =
        row && typeof row === "object"
          ? toWholeNumber((row as BinderPositionRow).binder_position)
          : 0;

      setSearchInput("");
      setSearch("");
      setSetName("");
      setRarity("");
      setAvailability("all");
      if (position > 0) setPage(Math.max(1, Math.ceil(position / PAGE_SIZE)));
      setSwapSource(card);
      setSwapMessage(`Choose the card that should swap places with ${card.name}.`);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Swap mode could not be started."));
    }
  }, []);

  const swapWith = useCallback(
    async (target: BinderDisplayCard) => {
      if (!swapSource || swapBusy) return;

      if (target.id === swapSource.id) {
        setSwapSource(null);
        setSwapMessage(null);
        return;
      }

      setSwapBusy(true);
      setErrorMessage(null);

      try {
        const { error } = await supabase.rpc("swap_player_binder_positions", {
          p_first_card_id: swapSource.id,
          p_second_card_id: target.id,
        });
        if (error) throw error;

        const sourceName = swapSource.name;
        setSwapSource(null);
        setSwapMessage(`${sourceName} and ${target.name} swapped places.`);
        await loadCards(true);
        window.dispatchEvent(new CustomEvent("pocketpulls:binder-updated"));
        window.setTimeout(() => setSwapMessage(null), 2600);
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, "Those binder positions could not be swapped."));
      } finally {
        setSwapBusy(false);
      }
    },
    [loadCards, swapBusy, swapSource],
  );

  const displayCards = useMemo(
    () =>
      cards.map((card) => ({
        ...card,
        anniversaryYears: anniversaryYearsByCard[card.id] || 0,
      })),
    [anniversaryYearsByCard, cards],
  );

  const filterOptions = useMemo(
    () => [
      { value: "all" as Availability, label: "All cards" },
      { value: "available" as Availability, label: "Available" },
      { value: "reserved" as Availability, label: "Reserved" },
      { value: "duplicates" as Availability, label: "Duplicates" },
    ],
    [],
  );

  return (
    <section className={styles.pageShell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your binder</p>
          <h1 className={styles.title}>{binderName}</h1>
          {cosmicBinderIssueNumber > 0 ? (
            <span className={styles.cosmicOwnership}>
              Cosmic Binder #{String(cosmicBinderIssueNumber).padStart(6, "0")}
            </span>
          ) : null}
        </div>

        <div className={styles.headerStats}>
          <div><span>Cards</span><strong>{loading ? "—" : formatWholeNumber(overview.totalCards)}</strong></div>
          <div><span>Unique</span><strong>{loading ? "—" : formatWholeNumber(overview.uniqueCards)}</strong></div>
          <div><span>Value</span><strong>{loading ? "—" : formatMoney(overview.collectionValue)}</strong></div>
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

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className={styles.refreshButton}
        >
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
        <span className={styles.entryCount}>
          {loading || filtering
            ? "Reading…"
            : `${formatWholeNumber(totalCount)} ${totalCount === 1 ? "entry" : "entries"}`}
        </span>
        {hasFilters ? (
          <button type="button" onClick={clearFilters} className={styles.clearButton}>
            Clear
          </button>
        ) : null}
      </div>

      <section className={styles.binderControls}>
        <div className={styles.nameControl}>
          <div>
            <p>Binder name</p>
            <span>This is what friends see above your binder.</span>
          </div>
          <div className={styles.nameEditor}>
            <input
              value={binderNameInput}
              maxLength={40}
              onChange={(event) => setBinderNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveBinderName();
              }}
              aria-label="Binder name"
            />
            <button
              type="button"
              onClick={() => void saveBinderName()}
              disabled={nameBusy || !binderNameInput.trim() || binderNameInput.trim() === binderName}
            >
              {nameBusy ? "Saving..." : "Save name"}
            </button>
          </div>
        </div>

        <div className={styles.themeToggleRow}>
          <div>
            <p>Binder style</p>
            <span>{BINDER_THEMES.find((theme) => theme.key === themeKey)?.label || "Classic Leather"}</span>
          </div>
          <button
            type="button"
            onClick={() => setThemePickerOpen((current) => !current)}
            className={styles.themeToggle}
            aria-expanded={themePickerOpen}
          >
            {themePickerOpen ? "Hide styles" : "Change style"}
          </button>
        </div>

        {themePickerOpen ? (
          <div className={styles.themePanel}>
            <div className={styles.themeGrid}>
              {BINDER_THEMES.map((theme) => {
                const unlock = themeUnlocks[theme.key];
                const unlocked = theme.key === "classic" || unlock?.unlocked === true;

                return (
                  <button
                    key={theme.key}
                    type="button"
                    disabled={themeBusy || !unlocked}
                    onClick={() => void selectTheme(theme.key)}
                    className={`${styles.themeCard} ${theme.key === "cosmic_binder" ? styles.cosmicThemeCard : ""} ${themeKey === theme.key ? styles.themeCardActive : ""} ${!unlocked ? styles.themeCardLocked : ""}`}
                  >
                    <span
                      className={`${styles.themePreview} ${theme.key === "cosmic_binder" ? styles.cosmicThemePreview : ""}`}
                      style={{
                        background: theme.imageUrl
                          ? `linear-gradient(rgba(7,8,24,0.08), rgba(7,8,24,0.18)), url(${theme.imageUrl}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${theme.coverBase}, ${theme.coverAccent}, ${theme.coverBase})`,
                      }}
                    />
                    <strong>{theme.label}</strong>
                    {themeKey === theme.key ? (
                      <span className={styles.themeSelected}>Selected</span>
                    ) : theme.key === "cosmic_binder" && cosmicBinderIssueNumber > 0 ? (
                      <span className={styles.themeUnlocked}>
                        #{String(cosmicBinderIssueNumber).padStart(6, "0")}
                      </span>
                    ) : unlocked ? (
                      <span className={styles.themeUnlocked}>Unlocked</span>
                    ) : (
                      <span className={styles.themeLocked}>
                        {unlock?.achievement_title || "Binder achievement"}
                      </span>
                    )}
                    {!unlocked && unlock?.requirement ? (
                      <small>{unlock.requirement}</small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {swapSource || swapMessage ? (
        <div className={styles.swapBar}>
          <div>
            <strong>{swapSource ? `Swapping ${swapSource.name}` : "Binder updated"}</strong>
            <span>{swapMessage}</span>
          </div>
          {swapSource ? (
            <button
              type="button"
              onClick={() => { setSwapSource(null); setSwapMessage(null); }}
              disabled={swapBusy}
            >
              Cancel swap
            </button>
          ) : null}
        </div>
      ) : null}

      <div data-onboarding-target="binder">
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
          <BinderSpread
            cards={displayCards}
            themeKey={themeKey}
            onOpen={(card) => setSelectedCard(card as CollectionCard)}
            swapSourceId={swapSource?.id || null}
            onSwapTarget={(card) => void swapWith(card)}
            dimmed={filtering || swapBusy}
          />
        )}
      </div>

      <div className={styles.pagination}>
        <span>Spread {page} of {totalPages}</span>
        <div>
          <PlayerSecondaryButton
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || swapBusy}
          >
            Previous
          </PlayerSecondaryButton>
          <PlayerSecondaryButton
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || swapBusy}
          >
            Next
          </PlayerSecondaryButton>
        </div>
      </div>

      {selectedCard ? (
        <PlayerCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          signatureBusy={signatureBusy}
          onSetSignature={() => void setSignature(selectedCard)}
          onSwapPosition={() => void startSwap(selectedCard)}
        />
      ) : null}
    </section>
  );
}
