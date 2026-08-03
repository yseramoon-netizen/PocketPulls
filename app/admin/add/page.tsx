"use client";

import {
  FormEvent,
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
  api_id: string | null;
};

type InventoryRow = {
  id: string;
  card_id: string;
  quantity: number | string | null;
  location: string | null;
  status: string | null;
};

type AddResult = {
  cardName: string;
  quantityAdded: number;
  finalQuantity: number;
  location: string;
};

const SEARCH_LIMIT = 24;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | string | null): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(toNumber(value));
}

function getRarityStyle(rarity: string | null): string {
  const value = rarity?.toLowerCase() || "";

  if (
    value.includes("secret") ||
    value.includes("hyper") ||
    value.includes("special")
  ) {
    return "border-amber-200/30 bg-amber-300/15 text-amber-100";
  }

  if (
    value.includes("ultra") ||
    value.includes("illustration") ||
    value.includes("rare")
  ) {
    return "border-violet-200/30 bg-violet-300/15 text-violet-100";
  }

  if (value.includes("uncommon")) {
    return "border-cyan-200/30 bg-cyan-300/15 text-cyan-100";
  }

  if (value.includes("common")) {
    return "border-emerald-200/30 bg-emerald-300/15 text-emerald-100";
  }

  return "border-white/15 bg-white/10 text-white/75";
}

export default function AddCardPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [selectedCard, setSelectedCard] =
    useState<PokemonCard | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("Main Inventory");

  const [existingInventory, setExistingInventory] =
    useState<InventoryRow | null>(null);

  const [searching, setSearching] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchError, setSearchError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState<AddResult | null>(null);

  const searchCards = useCallback(async (searchValue: string) => {
    const cleanedSearch = searchValue
      .replace(/[,%()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedSearch.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const { data, error } = await supabase
        .from("pokemon_cards")
        .select(`
          id,
          name,
          rarity,
          set_name,
          card_no,
          image_url,
          market_value,
          api_id
        `)
        .or(
          `name.ilike.%${cleanedSearch}%,set_name.ilike.%${cleanedSearch}%,card_no.ilike.%${cleanedSearch}%`,
        )
        .order("name", {
          ascending: true,
        })
        .limit(SEARCH_LIMIT);

      if (error) {
        throw error;
      }

      setResults((data || []) as PokemonCard[]);
    } catch (error: unknown) {
      console.error("Card search error:", error);

      setResults([]);
      setSearchError(
        error instanceof Error
          ? error.message
          : "The card database could not be searched.",
      );
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchCards(query);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, searchCards]);

  const loadExistingInventory = useCallback(
    async (card: PokemonCard) => {
      setCheckingInventory(true);
      setExistingInventory(null);
      setSaveError("");
      setSuccess(null);

      try {
        const { data, error } = await supabase
          .from("inventory")
          .select(`
            id,
            card_id,
            quantity,
            location,
            status
          `)
          .eq("card_id", card.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const inventoryRow = data as InventoryRow | null;

        setExistingInventory(inventoryRow);

        if (inventoryRow?.location) {
          setLocation(inventoryRow.location);
        } else {
          setLocation("Main Inventory");
        }
      } catch (error: unknown) {
        console.error("Inventory lookup error:", error);

        setSaveError(
          error instanceof Error
            ? error.message
            : "Existing inventory could not be checked.",
        );
      } finally {
        setCheckingInventory(false);
      }
    },
    [],
  );

  function selectCard(card: PokemonCard) {
    setSelectedCard(card);
    setQuantity(1);
    setSuccess(null);
    setSaveError("");

    void loadExistingInventory(card);
  }

  function clearSelection() {
    setSelectedCard(null);
    setExistingInventory(null);
    setQuantity(1);
    setLocation("Main Inventory");
    setSaveError("");
    setSuccess(null);
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(9999, current + 1));
  }

  async function addToInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCard || saving) {
      return;
    }

    const safeQuantity = Math.floor(Number(quantity));
    const safeLocation = location.trim() || "Main Inventory";

    if (!Number.isFinite(safeQuantity) || safeQuantity < 1) {
      setSaveError("Quantity must be at least 1.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error("You must be logged in to update inventory.");
      }

      let finalQuantity = safeQuantity;

      if (existingInventory) {
        finalQuantity =
          toNumber(existingInventory.quantity) + safeQuantity;

        const { data, error } = await supabase
          .from("inventory")
          .update({
            quantity: finalQuantity,
            location: safeLocation,
            status: "in_stock",
            added_by: user.email || "Admin",
            added_by_user_id: user.id,
          })
          .eq("id", existingInventory.id)
          .select(`
            id,
            card_id,
            quantity,
            location,
            status
          `)
          .single();

        if (error) {
          throw error;
        }

        setExistingInventory(data as InventoryRow);
      } else {
        const { data, error } = await supabase
          .from("inventory")
          .insert({
            card_id: selectedCard.id,
            quantity: safeQuantity,
            location: safeLocation,
            status: "in_stock",
            added_by: user.email || "Admin",
            added_by_user_id: user.id,
          })
          .select(`
            id,
            card_id,
            quantity,
            location,
            status
          `)
          .single();

        if (error) {
          throw error;
        }

        setExistingInventory(data as InventoryRow);
      }

      setSuccess({
        cardName: selectedCard.name,
        quantityAdded: safeQuantity,
        finalQuantity,
        location: safeLocation,
      });

      setQuantity(1);
    } catch (error: unknown) {
      console.error("Add inventory error:", error);

      setSaveError(
        error instanceof Error
          ? error.message
          : "The card could not be added to inventory.",
      );
    } finally {
      setSaving(false);
    }
  }

  const projectedQuantity = useMemo(() => {
    return toNumber(existingInventory?.quantity) + quantity;
  }, [existingInventory?.quantity, quantity]);

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
            top-28
            h-[34rem]
            w-[34rem]
            rounded-full
            bg-emerald-400/10
            blur-[130px]
          "
        />

        <div
          className="
            absolute
            -right-48
            top-16
            h-[38rem]
            w-[38rem]
            rounded-full
            bg-cyan-300/10
            blur-[150px]
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

          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
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

                Inventory Intake
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
                Add cards to the
                <span className="text-emerald-300">
                  {" "}
                  Forest Vault
                </span>
              </h1>

              
            </div>

            <div
              className="
                grid
                grid-cols-2
                gap-3
                rounded-[2rem]
                border
                border-white/10
                bg-black/15
                p-3
                backdrop-blur-2xl
              "
            >
              <div className="rounded-2xl bg-white/[0.06] px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  Results
                </p>

                <p className="mt-1 text-2xl font-black">
                  {results.length}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.06] px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  Selected
                </p>

                <p className="mt-1 truncate text-lg font-black text-emerald-200">
                  {selectedCard?.name || "None"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1.4fr_0.8fr]">
          <div
            className="
              overflow-hidden
              rounded-[2.75rem]
              border
              border-white/15
              bg-white/[0.075]
              shadow-[0_35px_100px_rgba(0,0,0,0.3)]
              backdrop-blur-3xl
            "
          >
            <div className="border-b border-white/10 p-6 md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200/60">
                Master database
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight">
                Find a Pokémon card
              </h2>

              <div className="relative mt-6">
                <span
                  className="
                    pointer-events-none
                    absolute
                    left-5
                    top-1/2
                    -translate-y-1/2
                    text-xl
                  "
                  aria-hidden="true"
                >
                  ⌕
                </span>

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by Pokémon, set or card number..."
                  autoComplete="off"
                  className="
                    min-h-16
                    w-full
                    rounded-2xl
                    border
                    border-white/15
                    bg-black/20
                    py-4
                    pl-14
                    pr-14
                    text-base
                    font-bold
                    text-white
                    outline-none
                    transition
                    placeholder:text-white/35
                    focus:border-emerald-300/50
                    focus:bg-black/30
                    focus:shadow-[0_0_30px_rgba(52,211,153,0.12)]
                  "
                />

                {searching && (
                  <span
                    className="
                      absolute
                      right-5
                      top-1/2
                      -translate-y-1/2
                      animate-spin
                      text-emerald-300
                    "
                    aria-label="Searching"
                  >
                    ◌
                  </span>
                )}

                {!searching && query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                    }}
                    className="
                      absolute
                      right-4
                      top-1/2
                      flex
                      h-9
                      w-9
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-xl
                      bg-white/10
                      font-black
                      text-white/60
                      transition
                      hover:bg-white/15
                      hover:text-white
                    "
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <p className="mt-3 text-sm font-medium text-white/40">
                Search begins after two characters.
              </p>

              {searchError && (
                <div
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-red-300/20
                    bg-red-500/10
                    px-5
                    py-4
                    font-bold
                    text-red-100
                  "
                >
                  {searchError}
                </div>
              )}
            </div>

            <div className="min-h-[32rem] p-5 md:p-8">
              {!query.trim() && (
                <div
                  className="
                    flex
                    min-h-[28rem]
                    flex-col
                    items-center
                    justify-center
                    rounded-[2rem]
                    border
                    border-dashed
                    border-white/10
                    bg-black/10
                    px-6
                    text-center
                  "
                >
                  <div
                    className="
                      flex
                      h-20
                      w-20
                      items-center
                      justify-center
                      rounded-[1.75rem]
                      border
                      border-emerald-200/20
                      bg-emerald-400/10
                      text-4xl
                      shadow-[0_0_40px_rgba(52,211,153,0.15)]
                    "
                  >
                    🎴
                  </div>

                  <h3 className="mt-6 text-2xl font-black">
                    Search the card archive
                  </h3>

                  <p className="mt-3 max-w-md text-sm font-medium leading-6 text-white/45">
                    Enter a Pokémon name, set name, or collector
                    number to locate the exact card.
                  </p>
                </div>
              )}

              {query.trim().length === 1 && (
                <div
                  className="
                    flex
                    min-h-[28rem]
                    items-center
                    justify-center
                    text-center
                  "
                >
                  <p className="font-bold text-white/45">
                    Enter one more character to begin searching.
                  </p>
                </div>
              )}

              {query.trim().length >= 2 &&
                !searching &&
                results.length === 0 &&
                !searchError && (
                  <div
                    className="
                      flex
                      min-h-[28rem]
                      flex-col
                      items-center
                      justify-center
                      text-center
                    "
                  >
                    <div className="text-5xl">🌙</div>

                    <h3 className="mt-5 text-xl font-black">
                      No cards found
                    </h3>

                    <p className="mt-2 text-white/45">
                      Try another Pokémon, set, or card number.
                    </p>
                  </div>
                )}

              {results.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {results.map((card) => {
                    const active = selectedCard?.id === card.id;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => selectCard(card)}
                        className={`
                          group
                          relative
                          overflow-hidden
                          rounded-[2rem]
                          border
                          p-4
                          text-left
                          transition
                          duration-200
                          ${
                            active
                              ? "border-emerald-200/50 bg-emerald-300/15 shadow-[0_0_35px_rgba(52,211,153,0.18)]"
                              : "border-white/10 bg-white/[0.045] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]"
                          }
                        `}
                      >
                        {active && (
                          <div
                            className="
                              absolute
                              right-4
                              top-4
                              z-20
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              rounded-full
                              bg-emerald-300
                              font-black
                              text-emerald-950
                              shadow-lg
                            "
                          >
                            ✓
                          </div>
                        )}

                        <div
                          className="
                            relative
                            flex
                            h-56
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[1.5rem]
                            border
                            border-white/10
                            bg-gradient-to-br
                            from-black/30
                            to-emerald-950/20
                          "
                        >
                          {card.image_url ? (
                            <img
                              src={card.image_url}
                              alt={card.name}
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
                            <span className="text-5xl opacity-40">
                              🎴
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <h3 className="truncate text-lg font-black text-white">
                            {card.name}
                          </h3>

                          <p className="mt-1 truncate text-sm font-semibold text-white/45">
                            {card.set_name || "Unknown set"}
                            {card.card_no
                              ? ` · #${card.card_no}`
                              : ""}
                          </p>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <span
                              className={`
                                truncate
                                rounded-full
                                border
                                px-3
                                py-1.5
                                text-xs
                                font-black
                                ${getRarityStyle(card.rarity)}
                              `}
                            >
                              {card.rarity || "Unknown"}
                            </span>

                            <span className="font-black text-emerald-200">
                              {formatCurrency(card.market_value)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="xl:sticky xl:top-8 xl:self-start">
            <div
              className="
                overflow-hidden
                rounded-[2.75rem]
                border
                border-white/15
                bg-white/[0.08]
                shadow-[0_35px_100px_rgba(0,0,0,0.3)]
                backdrop-blur-3xl
              "
            >
              {!selectedCard ? (
                <div
                  className="
                    flex
                    min-h-[42rem]
                    flex-col
                    items-center
                    justify-center
                    px-8
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

                  <h2 className="mt-7 text-2xl font-black">
                    No card selected
                  </h2>

                  <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/45">
                    Select a search result to prepare an inventory
                    update.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="
                      relative
                      overflow-hidden
                      border-b
                      border-white/10
                      bg-gradient-to-br
                      from-emerald-300/15
                      via-white/[0.04]
                      to-cyan-300/5
                      p-6
                      md:p-8
                    "
                  >
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="
                        absolute
                        right-5
                        top-5
                        z-20
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-white/10
                        bg-black/25
                        text-xl
                        font-black
                        text-white/60
                        backdrop-blur-xl
                        transition
                        hover:bg-black/40
                        hover:text-white
                      "
                      aria-label="Clear selected card"
                    >
                      ×
                    </button>

                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                      <div
                        className="
                          flex
                          h-48
                          w-36
                          flex-none
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-[1.75rem]
                          border
                          border-white/15
                          bg-black/25
                          shadow-[0_25px_60px_rgba(0,0,0,0.35)]
                        "
                      >
                        {selectedCard.image_url ? (
                          <img
                            src={selectedCard.image_url}
                            alt={selectedCard.name}
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <span className="text-5xl">🎴</span>
                        )}
                      </div>

                      <div className="min-w-0 pr-10">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/60">
                          Selected card
                        </p>

                        <h2 className="mt-2 text-3xl font-black tracking-tight">
                          {selectedCard.name}
                        </h2>

                        <p className="mt-2 font-semibold text-white/50">
                          {selectedCard.set_name || "Unknown set"}
                          {selectedCard.card_no
                            ? ` · #${selectedCard.card_no}`
                            : ""}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={`
                              rounded-full
                              border
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              ${getRarityStyle(selectedCard.rarity)}
                            `}
                          >
                            {selectedCard.rarity || "Unknown"}
                          </span>

                          <span
                            className="
                              rounded-full
                              border
                              border-emerald-200/20
                              bg-emerald-400/10
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              text-emerald-100
                            "
                          >
                            {formatCurrency(
                              selectedCard.market_value,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={addToInventory}
                    className="p-6 md:p-8"
                  >
                    {checkingInventory ? (
                      <div
                        className="
                          flex
                          min-h-[22rem]
                          flex-col
                          items-center
                          justify-center
                        "
                      >
                        <div className="animate-spin text-4xl text-emerald-300">
                          ◌
                        </div>

                        <p className="mt-4 font-black text-white/60">
                          Checking inventory...
                        </p>
                      </div>
                    ) : (
                      <>
                        <div
                          className="
                            grid
                            grid-cols-2
                            gap-3
                            rounded-[1.75rem]
                            border
                            border-white/10
                            bg-black/15
                            p-3
                          "
                        >
                          <div className="rounded-2xl bg-white/[0.055] p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
                              Current stock
                            </p>

                            <p className="mt-2 text-3xl font-black">
                              {toNumber(
                                existingInventory?.quantity,
                              )}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-emerald-300/10 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100/60">
                              New total
                            </p>

                            <p className="mt-2 text-3xl font-black text-emerald-200">
                              {projectedQuantity}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <label
                            htmlFor="quantity"
                            className="text-sm font-black text-white"
                          >
                            Quantity to add
                          </label>

                          <div
                            className="
                              mt-3
                              grid
                              grid-cols-[3.5rem_1fr_3.5rem]
                              overflow-hidden
                              rounded-2xl
                              border
                              border-white/15
                              bg-black/20
                            "
                          >
                            <button
                              type="button"
                              onClick={decreaseQuantity}
                              disabled={quantity <= 1}
                              className="
                                min-h-16
                                border-r
                                border-white/10
                                text-2xl
                                font-black
                                text-white
                                transition
                                hover:bg-white/10
                                disabled:cursor-not-allowed
                                disabled:opacity-25
                              "
                            >
                              −
                            </button>

                            <input
                              id="quantity"
                              type="number"
                              min={1}
                              max={9999}
                              value={quantity}
                              onChange={(event) => {
                                const nextValue = Number(
                                  event.target.value,
                                );

                                setQuantity(
                                  Number.isFinite(nextValue)
                                    ? Math.max(
                                        1,
                                        Math.min(
                                          9999,
                                          Math.floor(nextValue),
                                        ),
                                      )
                                    : 1,
                                );
                              }}
                              className="
                                min-w-0
                                bg-transparent
                                px-3
                                text-center
                                text-2xl
                                font-black
                                text-white
                                outline-none
                              "
                            />

                            <button
                              type="button"
                              onClick={increaseQuantity}
                              disabled={quantity >= 9999}
                              className="
                                min-h-16
                                border-l
                                border-white/10
                                text-2xl
                                font-black
                                text-white
                                transition
                                hover:bg-white/10
                                disabled:cursor-not-allowed
                                disabled:opacity-25
                              "
                            >
                              +
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {[5, 10, 25, 50].map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => setQuantity(amount)}
                                className="
                                  rounded-xl
                                  border
                                  border-white/10
                                  bg-white/[0.05]
                                  px-4
                                  py-2
                                  text-sm
                                  font-black
                                  text-white/65
                                  transition
                                  hover:border-emerald-200/25
                                  hover:bg-emerald-300/10
                                  hover:text-emerald-100
                                "
                              >
                                {amount}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6">
                          <label
                            htmlFor="location"
                            className="text-sm font-black text-white"
                          >
                            Storage location
                          </label>

                          <input
                            id="location"
                            value={location}
                            onChange={(event) =>
                              setLocation(event.target.value)
                            }
                            placeholder="Main Inventory"
                            className="
                              mt-3
                              min-h-14
                              w-full
                              rounded-2xl
                              border
                              border-white/15
                              bg-black/20
                              px-5
                              font-bold
                              text-white
                              outline-none
                              transition
                              placeholder:text-white/30
                              focus:border-emerald-300/50
                              focus:bg-black/30
                            "
                          />
                        </div>

                        {existingInventory && (
                          <div
                            className="
                              mt-6
                              rounded-2xl
                              border
                              border-cyan-200/15
                              bg-cyan-300/[0.07]
                              px-5
                              py-4
                              text-sm
                              font-semibold
                              leading-6
                              text-cyan-50/75
                            "
                          >
                            This card already exists in inventory.
                            Saving will increase its quantity rather
                            than create a duplicate row.
                          </div>
                        )}

                        {saveError && (
                          <div
                            className="
                              mt-6
                              rounded-2xl
                              border
                              border-red-300/20
                              bg-red-500/10
                              px-5
                              py-4
                              font-bold
                              text-red-100
                            "
                          >
                            {saveError}
                          </div>
                        )}

                        {success && (
                          <div
                            className="
                              mt-6
                              rounded-[1.75rem]
                              border
                              border-emerald-200/25
                              bg-emerald-300/10
                              p-5
                              shadow-[0_0_35px_rgba(52,211,153,0.1)]
                            "
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className="
                                  flex
                                  h-11
                                  w-11
                                  flex-none
                                  items-center
                                  justify-center
                                  rounded-xl
                                  bg-emerald-300
                                  font-black
                                  text-emerald-950
                                "
                              >
                                ✓
                              </div>

                              <div>
                                <p className="font-black text-emerald-100">
                                  Inventory updated
                                </p>

                                <p className="mt-1 text-sm font-medium leading-6 text-emerald-50/65">
                                  Added {success.quantityAdded}{" "}
                                  {success.cardName}. New stock:
                                  {" "}
                                  {success.finalQuantity} in{" "}
                                  {success.location}.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={saving}
                          className="
                            mt-7
                            flex
                            min-h-16
                            w-full
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
                            shadow-[0_0_40px_rgba(110,231,183,0.25)]
                            transition
                            hover:-translate-y-0.5
                            hover:bg-emerald-200
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          "
                        >
                          {saving ? (
                            <>
                              <span className="animate-spin">
                                ◌
                              </span>
                              Updating vault...
                            </>
                          ) : (
                            <>
                              <span>＋</span>
                              Add {quantity} to inventory
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </form>
                </>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}