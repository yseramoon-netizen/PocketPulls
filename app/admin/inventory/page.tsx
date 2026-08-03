"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";

type PokemonCard = {
  id: string;
  name: string;
  rarity: string | null;
  set_name: string | null;
  card_no: string | null;
  image_url: string | null;
  market_value: number | string | null;
};

type InventoryDatabaseRow = {
  id: string;
  card_id: string;
  quantity: number | string | null;
  location: string | null;
  status: string | null;
  added_by: string | null;
  added_by_user_id: string | null;
  pokemon_cards: PokemonCard | PokemonCard[] | null;
};

type InventoryItem = {
  id: string;
  cardId: string;
  quantity: number;
  location: string;
  status: string;
  addedBy: string;
  card: PokemonCard;
};

type StockFilter = "all" | "low" | "healthy";

type SortOption =
  | "name"
  | "quantity-low"
  | "quantity-high"
  | "value-high";

const LOW_STOCK_THRESHOLD = 3;

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

function getRarityStyle(rarity: string | null): string {
  const value = rarity?.toLowerCase() || "";

  if (
    value.includes("secret") ||
    value.includes("hyper") ||
    value.includes("special")
  ) {
    return `
      border-amber-200/25
      bg-amber-300/10
      text-amber-100
    `;
  }

  if (
    value.includes("ultra") ||
    value.includes("illustration") ||
    value.includes("rare")
  ) {
    return `
      border-violet-200/25
      bg-violet-300/10
      text-violet-100
    `;
  }

  if (value.includes("uncommon")) {
    return `
      border-cyan-200/25
      bg-cyan-300/10
      text-cyan-100
    `;
  }

  if (value.includes("common")) {
    return `
      border-emerald-200/25
      bg-emerald-300/10
      text-emerald-100
    `;
  }

  return `
    border-white/15
    bg-white/[0.07]
    text-white/70
  `;
}

function InventorySkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5 md:p-8">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="
            h-28
            rounded-[1.75rem]
            border
            border-white/10
            bg-white/[0.04]
          "
        />
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>(
    [],
  );

  const [locationDrafts, setLocationDrafts] = useState<
    Record<string, string>
  >({});

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] =
    useState<StockFilter>("all");

  const [sortOption, setSortOption] =
    useState<SortOption>("name");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const loadInventory = useCallback(
    async (backgroundRefresh = false) => {
      if (backgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSuccess("");

      try {
        const { data, error: inventoryError } =
          await supabase
            .from("inventory")
            .select(`
              id,
              card_id,
              quantity,
              location,
              status,
              added_by,
              added_by_user_id,
              pokemon_cards(
                id,
                name,
                rarity,
                set_name,
                card_no,
                image_url,
                market_value
              )
            `);

        if (inventoryError) {
          throw inventoryError;
        }

        const databaseRows =
          (data || []) as unknown as InventoryDatabaseRow[];

        const items: InventoryItem[] = databaseRows
          .map((row) => {
            const card = getRelation(row.pokemon_cards);

            if (!card) {
              return null;
            }

            return {
              id: row.id,
              cardId: row.card_id,
              quantity: toNumber(row.quantity),
              location: row.location || "Main Inventory",
              status: row.status || "in_stock",
              addedBy: row.added_by || "Admin",
              card,
            };
          })
          .filter(
            (item): item is InventoryItem => item !== null,
          );

        setInventory(items);

        setLocationDrafts(
          Object.fromEntries(
            items.map((item) => [
              item.id,
              item.location,
            ]),
          ),
        );

        setLastUpdated(new Date());
      } catch (inventoryLoadError: unknown) {
        console.error(
          "Inventory loading error:",
          inventoryLoadError,
        );

        setError(
          inventoryLoadError instanceof Error
            ? inventoryLoadError.message
            : "The inventory could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const totalUnits = useMemo(() => {
    return inventory.reduce((total, item) => {
      return total + item.quantity;
    }, 0);
  }, [inventory]);

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((total, item) => {
      const cardValue = toNumber(item.card.market_value);

      return total + cardValue * item.quantity;
    }, 0);
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(
      (item) =>
        item.quantity > 0 &&
        item.quantity <= LOW_STOCK_THRESHOLD,
    ).length;
  }, [inventory]);

  const highestValueCard = useMemo(() => {
    if (inventory.length === 0) {
      return null;
    }

    return [...inventory].sort((first, second) => {
      return (
        toNumber(second.card.market_value) -
        toNumber(first.card.market_value)
      );
    })[0];
  }, [inventory]);

  const visibleInventory = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase();

    const filtered = inventory.filter((item) => {
      const matchesSearch =
        !cleanedQuery ||
        item.card.name
          .toLowerCase()
          .includes(cleanedQuery) ||
        (item.card.set_name || "")
          .toLowerCase()
          .includes(cleanedQuery) ||
        (item.card.card_no || "")
          .toLowerCase()
          .includes(cleanedQuery) ||
        (item.card.rarity || "")
          .toLowerCase()
          .includes(cleanedQuery) ||
        item.location
          .toLowerCase()
          .includes(cleanedQuery);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" &&
          item.quantity <= LOW_STOCK_THRESHOLD) ||
        (stockFilter === "healthy" &&
          item.quantity > LOW_STOCK_THRESHOLD);

      return matchesSearch && matchesStock;
    });

    return [...filtered].sort((first, second) => {
      if (sortOption === "quantity-low") {
        return first.quantity - second.quantity;
      }

      if (sortOption === "quantity-high") {
        return second.quantity - first.quantity;
      }

      if (sortOption === "value-high") {
        const firstValue =
          toNumber(first.card.market_value) *
          first.quantity;

        const secondValue =
          toNumber(second.card.market_value) *
          second.quantity;

        return secondValue - firstValue;
      }

      return first.card.name.localeCompare(
        second.card.name,
      );
    });
  }, [inventory, query, sortOption, stockFilter]);

  function isItemBusy(itemId: string): boolean {
    return busyAction.endsWith(itemId);
  }

  function updateLocalQuantity(
    itemId: string,
    quantity: number,
  ) {
    setInventory((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    );
  }

  async function changeQuantity(
    item: InventoryItem,
    adjustment: number,
  ) {
    if (isItemBusy(item.id)) {
      return;
    }

    const newQuantity = Math.max(
      1,
      Math.min(9999, item.quantity + adjustment),
    );

    if (newQuantity === item.quantity) {
      return;
    }

    setBusyAction(`quantity:${item.id}`);
    setError("");
    setSuccess("");

    try {
      const { data, error: updateError } =
        await supabase
          .from("inventory")
          .update({
            quantity: newQuantity,
            status: "in_stock",
          })
          .eq("id", item.id)
          .select("quantity")
          .single();

      if (updateError) {
        throw updateError;
      }

      const savedQuantity = toNumber(data.quantity);

      updateLocalQuantity(item.id, savedQuantity);

      setSuccess(
        `${item.card.name} stock updated to ${savedQuantity}.`,
      );
    } catch (quantityError: unknown) {
      console.error(
        "Quantity update error:",
        quantityError,
      );

      setError(
        quantityError instanceof Error
          ? quantityError.message
          : "The quantity could not be updated.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function saveLocation(item: InventoryItem) {
    if (isItemBusy(item.id)) {
      return;
    }

    const newLocation =
      locationDrafts[item.id]?.trim() ||
      "Main Inventory";

    if (newLocation === item.location) {
      return;
    }

    setBusyAction(`location:${item.id}`);
    setError("");
    setSuccess("");

    try {
      const { data, error: updateError } =
        await supabase
          .from("inventory")
          .update({
            location: newLocation,
          })
          .eq("id", item.id)
          .select("location")
          .single();

      if (updateError) {
        throw updateError;
      }

      const savedLocation =
        data.location || "Main Inventory";

      setInventory((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                location: savedLocation,
              }
            : currentItem,
        ),
      );

      setLocationDrafts((current) => ({
        ...current,
        [item.id]: savedLocation,
      }));

      setSuccess(
        `${item.card.name} moved to ${savedLocation}.`,
      );
    } catch (locationError: unknown) {
      console.error(
        "Location update error:",
        locationError,
      );

      setError(
        locationError instanceof Error
          ? locationError.message
          : "The location could not be updated.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function removeInventoryItem(
    item: InventoryItem,
  ) {
    if (isItemBusy(item.id)) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${item.card.name} from inventory?\n\nThis removes the inventory record, not the card from the master Pokémon database.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`remove:${item.id}`);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id);

      if (deleteError) {
        throw deleteError;
      }

      setInventory((current) =>
        current.filter(
          (currentItem) =>
            currentItem.id !== item.id,
        ),
      );

      setLocationDrafts((current) => {
        const next = { ...current };

        delete next[item.id];

        return next;
      });

      setSuccess(
        `${item.card.name} was removed from inventory.`,
      );
    } catch (removeError: unknown) {
      console.error(
        "Inventory removal error:",
        removeError,
      );

      setError(
        removeError instanceof Error
          ? removeError.message
          : "The inventory record could not be removed.",
      );
    } finally {
      setBusyAction("");
    }
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
            -left-52
            top-20
            h-[38rem]
            w-[38rem]
            rounded-full
            bg-emerald-400/10
            blur-[140px]
          "
        />

        <div
          className="
            absolute
            -right-52
            top-12
            h-[40rem]
            w-[40rem]
            rounded-full
            bg-cyan-300/10
            blur-[160px]
          "
        />

        <div
          className="
            absolute
            bottom-0
            left-1/3
            h-[30rem]
            w-[30rem]
            rounded-full
            bg-lime-300/5
            blur-[130px]
          "
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px]">
        <AdminNav />

        <header
          className="
            relative
            mt-8
            overflow-hidden
            rounded-[2.75rem]
            border
            border-white/15
            bg-white/[0.08]
            p-6
            shadow-[0_40px_120px_rgba(0,0,0,0.35)]
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
              to-emerald-400/5
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

                Physical Stock Control
              </div>

              <h1
                className="
                  mt-5
                  text-4xl
                  font-black
                  tracking-[-0.045em]
                  md:text-6xl
                "
              >
                The Forest
                <span className="text-emerald-300">
                  {" "}
                  Inventory Vault
                </span>
              </h1>

              <p
                className="
                  mt-4
                  max-w-2xl
                  text-base
                  font-medium
                  leading-7
                  text-emerald-50/70
                  md:text-lg
                "
              >
                Track every physical card available for
                customer pulls, identify low stock, and
                manage quantities from one workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  void loadInventory(true)
                }
                disabled={refreshing}
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-white/15
                  bg-white/10
                  px-6
                  font-black
                  text-white
                  transition
                  hover:bg-white/15
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <span
                  className={
                    refreshing ? "animate-spin" : ""
                  }
                >
                  ↻
                </span>

                {refreshing
                  ? "Synchronising"
                  : "Refresh stock"}
              </button>

              <Link
                href="/admin/add"
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-emerald-100/30
                  bg-emerald-300
                  px-6
                  font-black
                  text-emerald-950
                  shadow-[0_0_35px_rgba(110,231,183,0.25)]
                  transition
                  hover:-translate-y-0.5
                  hover:bg-emerald-200
                "
              >
                <span className="text-xl">＋</span>
                Add cards
              </Link>
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
              border-white/15
              bg-white/[0.075]
              p-6
              shadow-[0_25px_70px_rgba(0,0,0,0.25)]
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
                text-emerald-100/55
              "
            >
              Unique cards
            </p>

            <p className="mt-5 text-4xl font-black">
              {inventory.length.toLocaleString("en-GB")}
            </p>

            <p className="mt-3 text-sm text-white/45">
              Different cards currently stocked
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
              shadow-[0_25px_70px_rgba(0,0,0,0.25)]
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
              📦
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
              Total units
            </p>

            <p className="mt-5 text-4xl font-black">
              {totalUnits.toLocaleString("en-GB")}
            </p>

            <p className="mt-3 text-sm text-white/45">
              Physical cards ready for pulls
            </p>
          </article>

          <article
            className="
              relative
              overflow-hidden
              rounded-[2.25rem]
              border
              border-amber-200/15
              bg-amber-300/[0.07]
              p-6
              shadow-[0_25px_70px_rgba(0,0,0,0.25)]
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
              ⚠️
            </span>

            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-amber-100/60
              "
            >
              Low stock
            </p>

            <p className="mt-5 text-4xl font-black text-amber-100">
              {lowStockCount}
            </p>

            <p className="mt-3 text-sm text-white/45">
              Three or fewer copies remaining
            </p>
          </article>

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
              to-cyan-300/5
              p-6
              shadow-[0_25px_80px_rgba(16,185,129,0.16)]
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
                text-emerald-100/60
              "
            >
              Estimated value
            </p>

            <p
              className="
                mt-5
                text-4xl
                font-black
                text-emerald-100
              "
            >
              {formatCurrency(totalInventoryValue)}
            </p>

            <p className="mt-3 truncate text-sm text-white/45">
              Highest single card:{" "}
              {highestValueCard?.card.name || "None"}
            </p>
          </article>
        </section>

        {error && (
          <div
            className="
              mt-6
              rounded-[1.75rem]
              border
              border-red-300/20
              bg-red-500/10
              px-6
              py-5
              font-bold
              text-red-100
              backdrop-blur-2xl
            "
          >
            <p
              className="
                text-xs
                uppercase
                tracking-[0.18em]
                text-red-200/65
              "
            >
              Inventory error
            </p>

            <p className="mt-2">{error}</p>
          </div>
        )}

        {success && (
          <div
            className="
              mt-6
              flex
              items-center
              gap-4
              rounded-[1.75rem]
              border
              border-emerald-200/20
              bg-emerald-300/10
              px-6
              py-5
              font-bold
              text-emerald-100
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
                bg-emerald-300
                text-emerald-950
              "
            >
              ✓
            </span>

            {success}
          </div>
        )}

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
              border-b
              border-white/10
              p-5
              md:p-8
            "
          >
            <div
              className="
                flex
                flex-col
                gap-5
                xl:flex-row
                xl:items-end
                xl:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-sm
                    font-black
                    uppercase
                    tracking-[0.2em]
                    text-emerald-200/60
                  "
                >
                  Stock catalogue
                </p>

                <h2
                  className="
                    mt-2
                    text-3xl
                    font-black
                    tracking-tight
                  "
                >
                  Manage physical inventory
                </h2>

                <p className="mt-2 text-sm text-white/45">
                  Showing {visibleInventory.length} of{" "}
                  {inventory.length} inventory records
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
                <div className="relative min-w-0 sm:min-w-72">
                  <span
                    className="
                      pointer-events-none
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      text-lg
                    "
                  >
                    ⌕
                  </span>

                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                    placeholder="Search cards, sets, locations..."
                    className="
                      min-h-14
                      w-full
                      rounded-2xl
                      border
                      border-white/15
                      bg-black/20
                      py-3
                      pl-12
                      pr-11
                      font-bold
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/30
                      focus:border-emerald-300/45
                      focus:bg-black/30
                    "
                  />

                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="
                        absolute
                        right-3
                        top-1/2
                        flex
                        h-8
                        w-8
                        -translate-y-1/2
                        items-center
                        justify-center
                        rounded-lg
                        bg-white/10
                        text-white/60
                        transition
                        hover:bg-white/15
                        hover:text-white
                      "
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(
                      event.target.value as SortOption,
                    )
                  }
                  className="
                    min-h-14
                    rounded-2xl
                    border
                    border-white/15
                    bg-[#062e20]
                    px-5
                    font-bold
                    text-white
                    outline-none
                    transition
                    focus:border-emerald-300/45
                  "
                >
                  <option value="name">
                    Sort: Card name
                  </option>

                  <option value="quantity-low">
                    Sort: Lowest stock
                  </option>

                  <option value="quantity-high">
                    Sort: Highest stock
                  </option>

                  <option value="value-high">
                    Sort: Highest value
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={`
                  rounded-xl
                  border
                  px-4
                  py-2.5
                  text-sm
                  font-black
                  transition
                  ${
                    stockFilter === "all"
                      ? `
                        border-emerald-200/35
                        bg-emerald-300
                        text-emerald-950
                      `
                      : `
                        border-white/10
                        bg-white/[0.05]
                        text-white/60
                        hover:bg-white/10
                        hover:text-white
                      `
                  }
                `}
              >
                All stock
              </button>

              <button
                type="button"
                onClick={() => setStockFilter("low")}
                className={`
                  rounded-xl
                  border
                  px-4
                  py-2.5
                  text-sm
                  font-black
                  transition
                  ${
                    stockFilter === "low"
                      ? `
                        border-amber-200/35
                        bg-amber-300
                        text-amber-950
                      `
                      : `
                        border-white/10
                        bg-white/[0.05]
                        text-white/60
                        hover:bg-white/10
                        hover:text-white
                      `
                  }
                `}
              >
                Low stock · {lowStockCount}
              </button>

              <button
                type="button"
                onClick={() =>
                  setStockFilter("healthy")
                }
                className={`
                  rounded-xl
                  border
                  px-4
                  py-2.5
                  text-sm
                  font-black
                  transition
                  ${
                    stockFilter === "healthy"
                      ? `
                        border-cyan-200/35
                        bg-cyan-200
                        text-cyan-950
                      `
                      : `
                        border-white/10
                        bg-white/[0.05]
                        text-white/60
                        hover:bg-white/10
                        hover:text-white
                      `
                  }
                `}
              >
                Healthy stock
              </button>
            </div>
          </div>

          {loading ? (
            <InventorySkeleton />
          ) : visibleInventory.length === 0 ? (
            <div
              className="
                flex
                min-h-[30rem]
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
                📦
              </div>

              <h3 className="mt-7 text-2xl font-black">
                No inventory found
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
                Adjust your search or stock filter, or add
                cards to begin building the vault.
              </p>

              <Link
                href="/admin/add"
                className="
                  mt-7
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-emerald-300
                  px-6
                  font-black
                  text-emerald-950
                  transition
                  hover:bg-emerald-200
                "
              >
                Add inventory
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      className="
                        border-b
                        border-white/10
                        bg-black/10
                        text-left
                      "
                    >
                      <th
                        className="
                          px-8
                          py-5
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-white/40
                        "
                      >
                        Card
                      </th>

                      <th
                        className="
                          px-5
                          py-5
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-white/40
                        "
                      >
                        Market value
                      </th>

                      <th
                        className="
                          px-5
                          py-5
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-white/40
                        "
                      >
                        Quantity
                      </th>

                      <th
                        className="
                          px-5
                          py-5
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-white/40
                        "
                      >
                        Location
                      </th>

                      <th
                        className="
                          px-8
                          py-5
                          text-right
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-white/40
                        "
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/[0.07]">
                    {visibleInventory.map((item) => {
                      const lowStock =
                        item.quantity <=
                        LOW_STOCK_THRESHOLD;

                      const itemValue =
                        toNumber(
                          item.card.market_value,
                        ) * item.quantity;

                      const locationChanged =
                        (locationDrafts[item.id] ||
                          "Main Inventory") !==
                        item.location;

                      return (
                        <tr
                          key={item.id}
                          className="
                            group
                            transition
                            hover:bg-white/[0.035]
                          "
                        >
                          <td className="px-8 py-5">
                            <div
                              className="
                                flex
                                min-w-72
                                items-center
                                gap-4
                              "
                            >
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
                                  bg-black/20
                                "
                              >
                                {item.card.image_url ? (
                                  <img
                                    src={
                                      item.card.image_url
                                    }
                                    alt={item.card.name}
                                    className="
                                      h-full
                                      w-full
                                      object-contain
                                      p-1
                                      transition
                                      group-hover:scale-105
                                    "
                                  />
                                ) : (
                                  <span className="text-2xl">
                                    🎴
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <p
                                  className="
                                    truncate
                                    text-lg
                                    font-black
                                    text-white
                                  "
                                >
                                  {item.card.name}
                                </p>

                                <p
                                  className="
                                    mt-1
                                    truncate
                                    text-sm
                                    font-semibold
                                    text-white/40
                                  "
                                >
                                  {item.card.set_name ||
                                    "Unknown set"}

                                  {item.card.card_no
                                    ? ` · #${item.card.card_no}`
                                    : ""}
                                </p>

                                <span
                                  className={`
                                    mt-2
                                    inline-flex
                                    max-w-48
                                    truncate
                                    rounded-full
                                    border
                                    px-2.5
                                    py-1
                                    text-xs
                                    font-black
                                    ${getRarityStyle(
                                      item.card.rarity,
                                    )}
                                  `}
                                >
                                  {item.card.rarity ||
                                    "Unknown rarity"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <p className="font-black text-emerald-200">
                              {formatCurrency(
                                toNumber(
                                  item.card.market_value,
                                ),
                              )}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-white/35">
                              {formatCurrency(itemValue)} stock
                            </p>
                          </td>

                          <td className="px-5 py-5">
                            <div
                              className="
                                inline-grid
                                grid-cols-[2.75rem_4rem_2.75rem]
                                overflow-hidden
                                rounded-xl
                                border
                                border-white/10
                                bg-black/20
                              "
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  void changeQuantity(
                                    item,
                                    -1,
                                  )
                                }
                                disabled={
                                  item.quantity <= 1 ||
                                  isItemBusy(item.id)
                                }
                                className="
                                  min-h-11
                                  border-r
                                  border-white/10
                                  text-xl
                                  font-black
                                  transition
                                  hover:bg-white/10
                                  disabled:cursor-not-allowed
                                  disabled:opacity-25
                                "
                              >
                                −
                              </button>

                              <div
                                className="
                                  flex
                                  min-h-11
                                  flex-col
                                  items-center
                                  justify-center
                                  px-2
                                "
                              >
                                <span
                                  className={`
                                    text-lg
                                    font-black
                                    ${
                                      lowStock
                                        ? "text-amber-200"
                                        : "text-white"
                                    }
                                  `}
                                >
                                  {item.quantity}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  void changeQuantity(
                                    item,
                                    1,
                                  )
                                }
                                disabled={
                                  isItemBusy(item.id)
                                }
                                className="
                                  min-h-11
                                  border-l
                                  border-white/10
                                  text-xl
                                  font-black
                                  transition
                                  hover:bg-white/10
                                  disabled:cursor-not-allowed
                                  disabled:opacity-40
                                "
                              >
                                +
                              </button>
                            </div>

                            {lowStock && (
                              <p
                                className="
                                  mt-2
                                  text-xs
                                  font-black
                                  text-amber-200
                                "
                              >
                                Low stock
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-5">
                            <div className="flex min-w-64 gap-2">
                              <input
                                value={
                                  locationDrafts[
                                    item.id
                                  ] || ""
                                }
                                onChange={(event) =>
                                  setLocationDrafts(
                                    (current) => ({
                                      ...current,
                                      [item.id]:
                                        event.target
                                          .value,
                                    }),
                                  )
                                }
                                className="
                                  min-h-11
                                  min-w-0
                                  flex-1
                                  rounded-xl
                                  border
                                  border-white/10
                                  bg-black/20
                                  px-4
                                  text-sm
                                  font-bold
                                  text-white
                                  outline-none
                                  transition
                                  focus:border-emerald-300/40
                                "
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  void saveLocation(item)
                                }
                                disabled={
                                  !locationChanged ||
                                  isItemBusy(item.id)
                                }
                                className="
                                  min-h-11
                                  rounded-xl
                                  border
                                  border-emerald-200/15
                                  bg-emerald-300/10
                                  px-4
                                  text-sm
                                  font-black
                                  text-emerald-100
                                  transition
                                  hover:bg-emerald-300/20
                                  disabled:cursor-not-allowed
                                  disabled:opacity-30
                                "
                              >
                                Save
                              </button>
                            </div>
                          </td>

                          <td className="px-8 py-5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void removeInventoryItem(
                                  item,
                                )
                              }
                              disabled={isItemBusy(item.id)}
                              className="
                                rounded-xl
                                border
                                border-red-300/15
                                bg-red-500/[0.07]
                                px-4
                                py-2.5
                                text-sm
                                font-black
                                text-red-200
                                transition
                                hover:border-red-300/30
                                hover:bg-red-500/15
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                              "
                            >
                              {busyAction ===
                              `remove:${item.id}`
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 p-4 lg:hidden">
                {visibleInventory.map((item) => {
                  const lowStock =
                    item.quantity <=
                    LOW_STOCK_THRESHOLD;

                  const locationChanged =
                    (locationDrafts[item.id] ||
                      "Main Inventory") !==
                    item.location;

                  return (
                    <article
                      key={item.id}
                      className="
                        overflow-hidden
                        rounded-[2rem]
                        border
                        border-white/10
                        bg-white/[0.045]
                      "
                    >
                      <div className="flex gap-4 p-5">
                        <div
                          className="
                            flex
                            h-32
                            w-24
                            flex-none
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[1.5rem]
                            border
                            border-white/10
                            bg-black/20
                          "
                        >
                          {item.card.image_url ? (
                            <img
                              src={item.card.image_url}
                              alt={item.card.name}
                              className="
                                h-full
                                w-full
                                object-contain
                                p-1.5
                              "
                            />
                          ) : (
                            <span className="text-4xl">
                              🎴
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3
                            className="
                              truncate
                              text-xl
                              font-black
                            "
                          >
                            {item.card.name}
                          </h3>

                          <p
                            className="
                              mt-1
                              truncate
                              text-sm
                              font-semibold
                              text-white/40
                            "
                          >
                            {item.card.set_name ||
                              "Unknown set"}

                            {item.card.card_no
                              ? ` · #${item.card.card_no}`
                              : ""}
                          </p>

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
                              ${getRarityStyle(
                                item.card.rarity,
                              )}
                            `}
                          >
                            {item.card.rarity ||
                              "Unknown rarity"}
                          </span>

                          <p
                            className="
                              mt-4
                              text-lg
                              font-black
                              text-emerald-200
                            "
                          >
                            {formatCurrency(
                              toNumber(
                                item.card.market_value,
                              ),
                            )}
                          </p>
                        </div>
                      </div>

                      <div
                        className="
                          grid
                          grid-cols-2
                          gap-3
                          border-y
                          border-white/[0.07]
                          bg-black/10
                          p-4
                        "
                      >
                        <div
                          className="
                            rounded-2xl
                            bg-white/[0.05]
                            p-4
                          "
                        >
                          <p
                            className="
                              text-xs
                              font-black
                              uppercase
                              tracking-[0.14em]
                              text-white/40
                            "
                          >
                            Quantity
                          </p>

                          <div
                            className="
                              mt-3
                              grid
                              grid-cols-[2.75rem_1fr_2.75rem]
                              overflow-hidden
                              rounded-xl
                              border
                              border-white/10
                              bg-black/20
                            "
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void changeQuantity(
                                  item,
                                  -1,
                                )
                              }
                              disabled={
                                item.quantity <= 1 ||
                                isItemBusy(item.id)
                              }
                              className="
                                min-h-11
                                border-r
                                border-white/10
                                text-xl
                                font-black
                                disabled:opacity-25
                              "
                            >
                              −
                            </button>

                            <span
                              className={`
                                flex
                                items-center
                                justify-center
                                font-black
                                ${
                                  lowStock
                                    ? "text-amber-200"
                                    : "text-white"
                                }
                              `}
                            >
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                void changeQuantity(
                                  item,
                                  1,
                                )
                              }
                              disabled={isItemBusy(
                                item.id,
                              )}
                              className="
                                min-h-11
                                border-l
                                border-white/10
                                text-xl
                                font-black
                                disabled:opacity-40
                              "
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div
                          className="
                            rounded-2xl
                            bg-white/[0.05]
                            p-4
                          "
                        >
                          <p
                            className="
                              text-xs
                              font-black
                              uppercase
                              tracking-[0.14em]
                              text-white/40
                            "
                          >
                            Stock value
                          </p>

                          <p
                            className="
                              mt-4
                              text-xl
                              font-black
                              text-emerald-200
                            "
                          >
                            {formatCurrency(
                              toNumber(
                                item.card.market_value,
                              ) * item.quantity,
                            )}
                          </p>

                          {lowStock && (
                            <p
                              className="
                                mt-1
                                text-xs
                                font-black
                                text-amber-200
                              "
                            >
                              Low stock
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-4">
                        <label
                          className="
                            text-xs
                            font-black
                            uppercase
                            tracking-[0.14em]
                            text-white/40
                          "
                        >
                          Storage location
                        </label>

                        <div className="mt-3 flex gap-2">
                          <input
                            value={
                              locationDrafts[item.id] ||
                              ""
                            }
                            onChange={(event) =>
                              setLocationDrafts(
                                (current) => ({
                                  ...current,
                                  [item.id]:
                                    event.target.value,
                                }),
                              )
                            }
                            className="
                              min-h-12
                              min-w-0
                              flex-1
                              rounded-xl
                              border
                              border-white/10
                              bg-black/20
                              px-4
                              font-bold
                              text-white
                              outline-none
                              focus:border-emerald-300/40
                            "
                          />

                          <button
                            type="button"
                            onClick={() =>
                              void saveLocation(item)
                            }
                            disabled={
                              !locationChanged ||
                              isItemBusy(item.id)
                            }
                            className="
                              rounded-xl
                              bg-emerald-300
                              px-4
                              font-black
                              text-emerald-950
                              disabled:cursor-not-allowed
                              disabled:opacity-30
                            "
                          >
                            Save
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void removeInventoryItem(
                              item,
                            )
                          }
                          disabled={isItemBusy(item.id)}
                          className="
                            mt-4
                            min-h-12
                            w-full
                            rounded-xl
                            border
                            border-red-300/15
                            bg-red-500/[0.07]
                            font-black
                            text-red-200
                            transition
                            hover:bg-red-500/15
                            disabled:opacity-40
                          "
                        >
                          {busyAction ===
                          `remove:${item.id}`
                            ? "Removing..."
                            : "Remove from inventory"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <footer
            className="
              flex
              flex-col
              gap-2
              border-t
              border-white/10
              bg-black/10
              px-6
              py-5
              text-sm
              font-semibold
              text-white/35
              sm:flex-row
              sm:items-center
              sm:justify-between
              md:px-8
            "
          >
            <p>
              Low stock warning: {LOW_STOCK_THRESHOLD} or
              fewer cards
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
        </section>
      </div>
    </main>
  );
}