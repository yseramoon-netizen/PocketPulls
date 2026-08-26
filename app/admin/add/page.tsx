"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin/client-auth";

import AdminNav from "@/components/AdminNav";
import type {
  ScannerAutoAddResult,
  ScannerPokemonCard,
} from "@/lib/scanner/types";
import ForestBackground from "@/components/ForestBackground";

const CardScanner = dynamic(
  () => import("@/components/CardScanner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[28rem] items-center justify-center rounded-[2rem] border border-cyan-200/15 bg-[#061813]/90 p-8 text-center text-sm font-black text-cyan-100/60">
        Loading the image-first scanner…
      </div>
    ),
  },
);

type AddPageCard = ScannerPokemonCard & {
  market_value_normal_gbp?:
    | number
    | string
    | null;
  market_value_holo_gbp?:
    | number
    | string
    | null;
  market_value_reverse_holo_gbp?:
    | number
    | string
    | null;
  price_source?: string | null;
  price_updated_at?: string | null;
};

type CardFinish =
  | "normal"
  | "holo"
  | "reverse_holo";

type AddResult = {
  cardName: string;
  quantityAdded: number;
  finalQuantity: number;
  location: string;
  finish: CardFinish;
};

type AddInventoryApiResponse = {
  ok: true;
  result: {
    inventoryId: string;
    cardId: string;
    cardName: string;
    quantityAdded: number;
    finalQuantity: number;
    location: string;
    finish: CardFinish;
    adminEmail: string;
  };
};

type SetOption = {
  setName: string;
  cardCount: number | null;
};

type CardSetRpcRow = {
  set_name?: unknown;
  card_count?: unknown;
};

type FinishOption = {
  value: CardFinish;
  label: string;
  shortLabel: string;
  description: string;
  selectedClassName: string;
};

const FINISH_OPTIONS: FinishOption[] = [
  {
    value: "normal",
    label: "Normal",
    shortLabel: "N",
    description: "Standard non-foil card",
    selectedClassName:
      "border-emerald-200/45 bg-emerald-300/18 text-emerald-50 shadow-[0_0_28px_rgba(110,231,183,0.12)]",
  },
  {
    value: "holo",
    label: "Holo",
    shortLabel: "H",
    description: "Holographic artwork finish",
    selectedClassName:
      "border-cyan-100/45 bg-cyan-200/18 text-cyan-50 shadow-[0_0_28px_rgba(165,243,252,0.12)]",
  },
  {
    value: "reverse_holo",
    label: "Reverse Holo",
    shortLabel: "R",
    description: "Holographic card body finish",
    selectedClassName:
      "border-violet-100/45 bg-violet-200/18 text-violet-50 shadow-[0_0_28px_rgba(221,214,254,0.12)]",
  },
];

const CARD_SELECT = `
  id,
  name,
  rarity,
  set_name,
  card_no,
  image_url,
  market_value,
  market_value_normal_gbp,
  market_value_holo_gbp,
  market_value_reverse_holo_gbp,
  price_source,
  price_updated_at,
  api_id
`;

const LAST_LOCATION_KEY =
  "pocketpulls:last-inventory-location";

function getFinishLabel(
  finish: CardFinish,
): string {
  return (
    FINISH_OPTIONS.find(
      (option) => option.value === finish,
    )?.label || "Normal"
  );
}

function getFinishMarketValue(
  card: AddPageCard,
  finish: CardFinish,
): number {
  const finishValue =
    finish === "holo"
      ? card.market_value_holo_gbp
      : finish === "reverse_holo"
        ? card.market_value_reverse_holo_gbp
        : card.market_value_normal_gbp;

  const parsedFinishValue =
    toNumber(finishValue);

  return parsedFinishValue > 0
    ? parsedFinishValue
    : toNumber(card.market_value);
}

function toNumber(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatCurrency(
  value: number | string | null | undefined,
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(toNumber(value));
}

function cleanSearchValue(
  value: string,
): string {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRarityStyle(
  rarity: string | null,
): string {
  const value =
    rarity?.trim().toLowerCase() || "";

  if (
    value.includes(
      "special illustration",
    )
  ) {
    return `
      border-fuchsia-200/30
      bg-fuchsia-300/15
      text-fuchsia-100
    `;
  }

  if (
    value.includes("hyper") ||
    value.includes("secret")
  ) {
    return `
      border-amber-200/30
      bg-amber-300/15
      text-amber-100
    `;
  }

  if (
    value.includes("shiny ultra")
  ) {
    return `
      border-pink-200/30
      bg-pink-300/15
      text-pink-100
    `;
  }

  if (value.includes("ultra")) {
    return `
      border-rose-200/30
      bg-rose-300/15
      text-rose-100
    `;
  }

  if (
    value.includes("illustration")
  ) {
    return `
      border-violet-200/30
      bg-violet-300/15
      text-violet-100
    `;
  }

  if (
    value.includes("double rare")
  ) {
    return `
      border-indigo-200/30
      bg-indigo-300/15
      text-indigo-100
    `;
  }

  if (
    value.includes("radiant") ||
    value.includes("amazing")
  ) {
    return `
      border-orange-200/30
      bg-orange-300/15
      text-orange-100
    `;
  }

  if (
    value.includes("holo") ||
    value.includes("shiny")
  ) {
    return `
      border-cyan-200/30
      bg-cyan-300/15
      text-cyan-100
    `;
  }

  if (value.includes("promo")) {
    return `
      border-teal-200/30
      bg-teal-300/15
      text-teal-100
    `;
  }

  if (value.includes("rare")) {
    return `
      border-blue-200/30
      bg-blue-300/15
      text-blue-100
    `;
  }

  if (
    value.includes("uncommon")
  ) {
    return `
      border-emerald-200/30
      bg-emerald-300/15
      text-emerald-100
    `;
  }

  if (value.includes("common")) {
    return `
      border-slate-200/20
      bg-slate-300/10
      text-slate-100
    `;
  }

  return `
    border-white/15
    bg-white/[0.07]
    text-white/65
  `;
}

export default function AddCardsPage() {
  const [search, setSearch] =
    useState("");

  const [
    searchResults,
    setSearchResults,
  ] = useState<
    AddPageCard[]
  >([]);

  const [searching, setSearching] =
    useState(false);

  const [
    setOptions,
    setSetOptions,
  ] = useState<SetOption[]>([]);

  const [
    selectedSet,
    setSelectedSet,
  ] = useState("");

  const [
    loadingSets,
    setLoadingSets,
  ] = useState(true);

  const [
    selectedCard,
    setSelectedCard,
  ] = useState<AddPageCard | null>(
    null,
  );

  const [quantity, setQuantity] =
    useState(1);

  const [finish, setFinish] =
    useState<CardFinish>("normal");

  const [location, setLocation] =
    useState("Main Inventory");

  const [adding, setAdding] =
    useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<AddResult | null>(null);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [
    scannerResetKey,
    setScannerResetKey,
  ] = useState(0);

  const searchRequestRef =
    useRef(0);

  const selectedCardRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedLocation =
      window.localStorage.getItem(
        LAST_LOCATION_KEY,
      );

    if (storedLocation) {
      setLocation(storedLocation);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSetOptions() {
      setLoadingSets(true);

      try {
        const rpcClient =
          supabase as any;

        const {
          data: rpcData,
          error: rpcError,
        } = await rpcClient.rpc(
          "get_pokemon_card_sets",
        );

        if (
          !rpcError &&
          Array.isArray(rpcData)
        ) {
          const options =
            (
              rpcData as CardSetRpcRow[]
            )
              .map((row) => {
                const setName =
                  typeof row.set_name ===
                    "string"
                    ? row.set_name.trim()
                    : "";

                const parsedCount =
                  Number(row.card_count);

                return {
                  setName,
                  cardCount:
                    Number.isFinite(
                      parsedCount,
                    )
                      ? parsedCount
                      : null,
                };
              })
              .filter(
                (option) =>
                  option.setName,
              )
              .sort((left, right) =>
                left.setName.localeCompare(
                  right.setName,
                  "en-GB",
                  {
                    sensitivity: "base",
                    numeric: true,
                  },
                ),
              );

          if (active) {
            setSetOptions(options);
          }

          return;
        }

        if (rpcError) {
          console.warn(
            "Set catalogue RPC unavailable; using paged fallback:",
            rpcError,
          );
        }

        /*
         * Fallback for projects where the repair
         * migration has not been run yet. It pages
         * through only the set_name column and
         * deduplicates locally.
         */
        const setCounts =
          new Map<string, number>();

        const batchSize = 1000;
        let offset = 0;

        while (active) {
          const {
            data,
            error: pageError,
          } = await supabase
            .from("pokemon_cards")
            .select("set_name")
            .not("set_name", "is", null)
            .range(
              offset,
              offset + batchSize - 1,
            );

          if (pageError) {
            throw pageError;
          }

          const rows =
            (data || []) as Array<{
              set_name:
                | string
                | null;
            }>;

          for (const row of rows) {
            const setName =
              row.set_name?.trim();

            if (!setName) {
              continue;
            }

            setCounts.set(
              setName,
              (
                setCounts.get(
                  setName,
                ) || 0
              ) + 1,
            );
          }

          if (
            rows.length < batchSize
          ) {
            break;
          }

          offset += batchSize;
        }

        if (active) {
          setSetOptions(
            Array.from(
              setCounts.entries(),
            )
              .map(
                ([
                  setName,
                  cardCount,
                ]) => ({
                  setName,
                  cardCount,
                }),
              )
              .sort((left, right) =>
                left.setName.localeCompare(
                  right.setName,
                  "en-GB",
                  {
                    sensitivity: "base",
                    numeric: true,
                  },
                ),
              ),
          );
        }
      } catch (
        setLoadError: unknown
      ) {
        console.error(
          "Card set catalogue error:",
          setLoadError,
        );

        if (active) {
          setError(
            setLoadError instanceof Error
              ? setLoadError.message
              : "The card set list could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setLoadingSets(false);
        }
      }
    }

    void loadSetOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scannerOpen) {
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
  }, [scannerOpen]);

  const selectCard =
    useCallback(
      (
        card: AddPageCard,
        scrollToForm = true,
      ) => {
        setSelectedCard(card);
        setQuantity(1);
        setFinish("normal");
        setResult(null);
        setError("");
        setSearchResults([]);


        if (scrollToForm) {
          window.setTimeout(() => {
            selectedCardRef.current?.scrollIntoView(
              {
                behavior: "smooth",
                block: "center",
              },
            );
          }, 100);
        }
      },
      [],
    );

  useEffect(() => {
    const cleanedSearch =
      cleanSearchValue(search);

    const cleanSelectedSet =
      selectedSet.trim();

    const requestId =
      searchRequestRef.current + 1;

    searchRequestRef.current =
      requestId;

    const hasTextSearch =
      cleanedSearch.length >= 2;

    const hasSetFilter =
      cleanSelectedSet.length > 0;

    if (
      !hasTextSearch &&
      !hasSetFilter
    ) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          setSearching(true);
          setError("");

          try {
            let query = supabase
              .from("pokemon_cards")
              .select(CARD_SELECT);

            if (hasSetFilter) {
              query = query.eq(
                "set_name",
                cleanSelectedSet,
              );
            }

            if (hasTextSearch) {
              const searchParts =
                hasSetFilter
                  ? [
                      `name.ilike.%${cleanedSearch}%`,
                      `card_no.ilike.%${cleanedSearch}%`,
                    ]
                  : [
                      `name.ilike.%${cleanedSearch}%`,
                      `set_name.ilike.%${cleanedSearch}%`,
                      `card_no.ilike.%${cleanedSearch}%`,
                    ];

              query = query.or(
                searchParts.join(","),
              );
            }

            const {
              data,
              error: searchError,
            } = await query
              .order(
                hasSetFilter
                  ? "card_no"
                  : "name",
                {
                  ascending: true,
                },
              )
              .limit(
                hasSetFilter
                  ? 120
                  : 60,
              );

            if (searchError) {
              throw searchError;
            }

            if (
              requestId !==
              searchRequestRef.current
            ) {
              return;
            }

            setSearchResults(
              (data ||
                []) as AddPageCard[],
            );
          } catch (
            searchError: unknown
          ) {
            if (
              requestId !==
              searchRequestRef.current
            ) {
              return;
            }

            console.error(
              "Card search error:",
              searchError,
            );

            setError(
              searchError instanceof Error
                ? searchError.message
                : "The card database could not be searched.",
            );
          } finally {
            if (
              requestId ===
              searchRequestRef.current
            ) {
              setSearching(false);
            }
          }
        },
        260,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [search, selectedSet]);

  function chooseFinish(
    nextFinish: CardFinish,
  ) {
    if (
      adding ||
      finish === nextFinish
    ) {
      return;
    }

    setFinish(nextFinish);
    setResult(null);
    setError("");
  }

  function openScanner() {
    setError("");

    setScannerResetKey(
      (current) => current + 1,
    );

    setScannerOpen(true);
  }

  function handleScannerSelection(
    card: ScannerPokemonCard,
  ) {
    setScannerOpen(false);
    setSearch("");

    selectCard(
      card as AddPageCard,
      true,
    );
  }

  const handleScannerAutoAdd = useCallback(
    async (card: ScannerPokemonCard): Promise<ScannerAutoAddResult> => {
      const safeLocation = location.trim() || "Main Inventory";

      const response = await adminFetch<AddInventoryApiResponse>(
        "/api/admin/inventory/add",
        {
          method: "POST",
          body: JSON.stringify({
            cardId: String(card.id),
            quantity: 1,
            location: safeLocation,
            finish,
          }),
        },
      );

      const added = response.result;

      window.localStorage.setItem(
        LAST_LOCATION_KEY,
        added.location,
      );

      setResult({
        cardName: added.cardName,
        quantityAdded: added.quantityAdded,
        finalQuantity: added.finalQuantity,
        location: added.location,
        finish: added.finish,
      });

      return {
        message: `${added.cardName} · ${added.finalQuantity} now in ${added.location}`,
      };
    },
    [finish, location],
  );

  async function addToInventory(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedCard ||
      adding
    ) {
      return;
    }

    const safeQuantity =
      Math.max(
        1,
        Math.min(
          9999,
          Math.floor(quantity),
        ),
      );

    const safeLocation =
      location.trim() ||
      "Main Inventory";

    setAdding(true);
    setError("");
    setResult(null);

    try {
      const response =
        await adminFetch<AddInventoryApiResponse>(
          "/api/admin/inventory/add",
          {
            method: "POST",
            body: JSON.stringify({
              cardId:
                String(
                  selectedCard.id,
                ),
              quantity:
                safeQuantity,
              location:
                safeLocation,
              finish,
            }),
          },
        );

      const added =
        response.result;

      window.localStorage.setItem(
        LAST_LOCATION_KEY,
        added.location,
      );

      setResult({
        cardName:
          added.cardName,
        quantityAdded:
          added.quantityAdded,
        finalQuantity:
          added.finalQuantity,
        location:
          added.location,
        finish:
          added.finish,
      });

      setQuantity(1);
    } catch (
      addError: unknown
    ) {
      console.error(
        "Inventory addition error:",
        addError,
      );

      setError(
        addError instanceof Error
          ? addError.message
          : "The cards could not be added to inventory.",
      );
    } finally {
      setAdding(false);
    }
  }

  function clearSelection() {
    setSelectedCard(null);
    setQuantity(1);
    setFinish("normal");
    setResult(null);
    setError("");
  }

  return (
    <>
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
                to-emerald-400/[0.05]
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
                  Search the master card database, select
                  the correct printing and add physical
                  quantities to your inventory.
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
                <Link
                  href="/admin/database"
                  className="
                    inline-flex
                    min-h-14
                    items-center
                    justify-center
                    gap-3
                    rounded-2xl
                    border
                    border-emerald-100/25
                    bg-emerald-300/15
                    px-6
                    font-black
                    text-emerald-50
                    transition
                    hover:-translate-y-0.5
                    hover:bg-emerald-300/20
                  "
                >
                  <span
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-xl
                      bg-emerald-950/15
                      text-lg
                    "
                  >
                    ↻
                  </span>

                  Sync database
                </Link>



              <button
                  type="button"
                onClick={openScanner}
                disabled={adding}
                className="
                  inline-flex
                  min-h-14
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-cyan-100/25
                  bg-cyan-200
                  px-6
                  font-black
                  text-cyan-950
                  shadow-[0_0_35px_rgba(165,243,252,0.2)]
                  transition
                  hover:-translate-y-0.5
                  hover:bg-cyan-100
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <span
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-xl
                    bg-cyan-950/10
                    text-lg
                  "
                >
                  ◉
                </span>

                Start automatic scanner
              </button>
              </div>
            </div>
          </header>

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
              {error}
            </div>
          )}

          {result && (
            <div
              className="
                mt-6
                flex
                flex-col
                gap-4
                rounded-[1.75rem]
                border
                border-emerald-200/20
                bg-emerald-300/10
                px-6
                py-5
                backdrop-blur-2xl
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-4
                "
              >
                <span
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
                </span>

                <div>
                  <p
                    className="
                      font-black
                      text-emerald-100
                    "
                  >
                    Inventory updated
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-semibold
                      text-emerald-50/55
                    "
                  >
                    Added {result.quantityAdded} x{" "}
                    {getFinishLabel(result.finish)}{" "}
                    {result.cardName}. New stock:{" "}
                    {result.finalQuantity} in{" "}
                    {result.location}.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={clearSelection}
                className="
                  min-h-11
                  rounded-xl
                  border
                  border-emerald-100/20
                  bg-emerald-300/10
                  px-5
                  font-black
                  text-emerald-100
                  transition
                  hover:bg-emerald-300/15
                "
              >
                Add another card
              </button>
            </div>
          )}

          <section
            className="
              mt-8
              grid
              gap-8
              xl:grid-cols-[1.1fr_0.9fr]
            "
          >
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
              <div
                className="
                  border-b
                  border-white/10
                  p-6
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
                  Card database
                </p>

                <h2
                  className="
                    mt-2
                    text-3xl
                    font-black
                    tracking-tight
                  "
                >
                  Find a card
                </h2>

                <p
                  className="
                    mt-2
                    text-sm
                    font-medium
                    text-white/45
                  "
                >
                  Search by Pokémon name, set or collector
                  number.
                </p>

                <div
                  className="
                    mt-6
                    grid
                    gap-3
                    xl:grid-cols-[minmax(0,1fr)_21rem]
                  "
                >
                  <div className="relative">
                    <span
                      className="
                        pointer-events-none
                        absolute
                        left-5
                        top-1/2
                        -translate-y-1/2
                        text-xl
                        text-emerald-100/45
                      "
                    >
                      ⌕
                    </span>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value,
                        )
                      }
                      placeholder={
                        selectedSet
                          ? `Search within ${selectedSet}...`
                          : "Start typing a card name..."
                      }
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
                        font-bold
                        text-white
                        outline-none
                        placeholder:text-white/25
                        focus:border-emerald-300/45
                        focus:shadow-[0_0_30px_rgba(52,211,153,0.08)]
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
                          text-emerald-200
                        "
                      >
                        ◌
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span
                      className="
                        pointer-events-none
                        absolute
                        left-5
                        top-1/2
                        -translate-y-1/2
                        text-lg
                        text-cyan-100/55
                      "
                    >
                      ◫
                    </span>

                    <select
                      value={selectedSet}
                      onChange={(event) => {
                        setSelectedSet(
                          event.target.value,
                        );

                        setSearchResults([]);
                        setError("");
                      }}
                      disabled={loadingSets}
                      aria-label="Filter cards by set"
                      className="
                        min-h-16
                        w-full
                        appearance-none
                        rounded-2xl
                        border
                        border-cyan-100/20
                        bg-[#061b1b]
                        py-4
                        pl-14
                        pr-12
                        font-black
                        text-cyan-50
                        outline-none
                        focus:border-cyan-200/45
                        disabled:cursor-wait
                        disabled:opacity-50
                      "
                    >
                      <option value="">
                        {loadingSets
                          ? "Loading all sets..."
                          : `All sets (${setOptions.length})`}
                      </option>

                      {setOptions.map(
                        (option) => (
                          <option
                            key={
                              option.setName
                            }
                            value={
                              option.setName
                            }
                          >
                            {option.setName}
                            {option.cardCount !==
                            null
                              ? ` (${option.cardCount})`
                              : ""}
                          </option>
                        ),
                      )}
                    </select>

                    <span
                      className="
                        pointer-events-none
                        absolute
                        right-5
                        top-1/2
                        -translate-y-1/2
                        text-cyan-100/45
                      "
                    >
                      ▾
                    </span>
                  </div>
                </div>

                {selectedSet && (
                  <div
                    className="
                      mt-3
                      flex
                      flex-wrap
                      items-center
                      gap-3
                    "
                  >
                    <span
                      className="
                        rounded-full
                        border
                        border-cyan-100/20
                        bg-cyan-200/10
                        px-3
                        py-1.5
                        text-xs
                        font-black
                        text-cyan-50
                      "
                    >
                      Set: {selectedSet}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSet("")
                      }
                      className="
                        rounded-full
                        border
                        border-white/10
                        bg-white/[0.04]
                        px-3
                        py-1.5
                        text-xs
                        font-black
                        text-white/55
                        transition
                        hover:bg-white/[0.08]
                        hover:text-white
                      "
                    >
                      Clear set filter
                    </button>
                  </div>
                )}
              </div>

              <div
                className="
                  min-h-[34rem]
                  p-4
                  md:p-6
                "
              >
                {cleanSearchValue(search).length < 2 &&
                !selectedSet ? (
                  <div
                    className="
                      flex
                      min-h-[29rem]
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
                        border-emerald-200/15
                        bg-emerald-300/[0.07]
                        text-5xl
                      "
                    >
                      🎴
                    </div>

                    <h3
                      className="
                        mt-6
                        text-2xl
                        font-black
                      "
                    >
                      Search the master catalogue
                    </h3>

                    <p
                      className="
                        mt-3
                        max-w-md
                        text-sm
                        font-medium
                        leading-6
                        text-white/40
                      "
                    >
                      Enter at least two characters, choose
                      a set from the dropdown, or use the Scan
                      card button for camera-based identification.
                    </p>
                  </div>
                ) : !searching &&
                  searchResults.length === 0 ? (
                  <div
                    className="
                      flex
                      min-h-[29rem]
                      flex-col
                      items-center
                      justify-center
                      px-6
                      text-center
                    "
                  >
                    <div className="text-5xl">
                      ⌕
                    </div>

                    <h3
                      className="
                        mt-5
                        text-2xl
                        font-black
                      "
                    >
                      No cards found
                    </h3>

                    <p
                      className="
                        mt-3
                        text-sm
                        font-medium
                        text-white/40
                      "
                    >
                      Try another Pokémon name or collector
                      number, or select a different set.
                    </p>
                  </div>
                ) : (
                  <div
                    className="
                      grid
                      gap-3
                      sm:grid-cols-2
                    "
                  >
                    {searchResults.map(
                      (card) => {
                        const active =
                          selectedCard?.id ===
                          card.id;

                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() =>
                              selectCard(
                                card,
                                true,
                              )
                            }
                            className={`
                              group
                              flex
                              min-w-0
                              items-center
                              gap-4
                              rounded-[1.5rem]
                              border
                              p-3
                              text-left
                              transition
                              ${
                                active
                                  ? `
                                    border-emerald-200/35
                                    bg-emerald-300/12
                                    shadow-[0_0_30px_rgba(52,211,153,0.1)]
                                  `
                                  : `
                                    border-white/10
                                    bg-white/[0.04]
                                    hover:border-emerald-200/20
                                    hover:bg-white/[0.07]
                                  `
                              }
                            `}
                          >
                            <div
                              className="
                                flex
                                h-28
                                w-20
                                flex-none
                                items-center
                                justify-center
                                overflow-hidden
                                rounded-xl
                                border
                                border-white/10
                                bg-black/20
                              "
                            >
                              {card.image_url ? (
                                <img
                                  src={
                                    card.image_url
                                  }
                                  alt={card.name}
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
                                <span className="text-3xl">
                                  🎴
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className="
                                  truncate
                                  text-lg
                                  font-black
                                "
                              >
                                {card.name}
                              </p>

                              <p
                                className="
                                  mt-1
                                  truncate
                                  text-xs
                                  font-semibold
                                  text-white/40
                                "
                              >
                                {card.set_name ||
                                  "Unknown set"}

                                {card.card_no
                                  ? ` · #${card.card_no}`
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
                                  px-2.5
                                  py-1
                                  text-[0.65rem]
                                  font-black
                                  ${getRarityStyle(
                                    card.rarity,
                                  )}
                                `}
                              >
                                {card.rarity ||
                                  "Unknown rarity"}
                              </span>

                              <p
                                className="
                                  mt-3
                                  font-black
                                  text-emerald-200
                                "
                              >
                                {formatCurrency(
                                  card.market_value,
                                )}
                              </p>
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              ref={selectedCardRef}
              className="
                xl:sticky
                xl:top-28
                xl:self-start
              "
            >
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
                <div
                  className="
                    border-b
                    border-white/10
                    p-6
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
                    Inventory entry
                  </p>

                  <h2
                    className="
                      mt-2
                      text-3xl
                      font-black
                      tracking-tight
                    "
                  >
                    Configure stock
                  </h2>
                </div>

                {!selectedCard ? (
                  <div
                    className="
                      flex
                      min-h-[38rem]
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
                      ＋
                    </div>

                    <h3
                      className="
                        mt-6
                        text-2xl
                        font-black
                      "
                    >
                      Select a card
                    </h3>

                    <p
                      className="
                        mt-3
                        max-w-sm
                        text-sm
                        font-medium
                        leading-6
                        text-white/40
                      "
                    >
                      Choose a result from the database or
                      identify one with the scanner.
                    </p>
                  </div>
                ) : (
                  <div className="p-5 md:p-8">
                    <div
                      className="
                        flex
                        flex-col
                        gap-6
                        sm:flex-row
                      "
                    >
                      <div
                        className="
                          flex
                          h-72
                          w-full
                          flex-none
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-[1.75rem]
                          border
                          border-white/10
                          bg-black/20
                          sm:w-48
                        "
                      >
                        {selectedCard.image_url ? (
                          <img
                            src={
                              selectedCard.image_url
                            }
                            alt={
                              selectedCard.name
                            }
                            className="
                              h-full
                              w-full
                              object-contain
                              p-3
                              drop-shadow-2xl
                            "
                          />
                        ) : (
                          <span className="text-6xl">
                            🎴
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3
                          className="
                            text-3xl
                            font-black
                            tracking-tight
                          "
                        >
                          {selectedCard.name}
                        </h3>

                        <p
                          className="
                            mt-2
                            font-semibold
                            text-white/40
                          "
                        >
                          {selectedCard.set_name ||
                            "Unknown set"}

                          {selectedCard.card_no
                            ? ` · #${selectedCard.card_no}`
                            : ""}
                        </p>

                        <div
                          className="
                            mt-4
                            flex
                            flex-wrap
                            gap-2
                          "
                        >
                          <span
                            className={`
                              rounded-full
                              border
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              ${getRarityStyle(
                                selectedCard.rarity,
                              )}
                            `}
                          >
                            {selectedCard.rarity ||
                              "Unknown rarity"}
                          </span>

                          <span
                            className="
                              rounded-full
                              border
                              border-emerald-200/20
                              bg-emerald-300/10
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              text-emerald-100
                            "
                          >
                            {formatCurrency(
                              getFinishMarketValue(
                                selectedCard,
                                finish,
                              ),
                            )}
                          </span>

                          <span
                            className="
                              rounded-full
                              border
                              border-cyan-100/20
                              bg-cyan-200/10
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              text-cyan-50
                            "
                          >
                            {getFinishLabel(finish)}
                          </span>
                        </div>

                        <p
                          className="
                            mt-3
                            text-xs
                            font-semibold
                            text-white/30
                          "
                        >
                          {selectedCard.price_source
                            ? `Price source: ${selectedCard.price_source}`
                            : "No live price source stored yet"}
                          {selectedCard.price_updated_at
                            ? ` · Updated ${new Date(
                                selectedCard.price_updated_at,
                              ).toLocaleDateString(
                                "en-GB",
                              )}`
                            : ""}
                        </p>


                      </div>
                    </div>

                    <form
                      onSubmit={addToInventory}
                      className="mt-8"
                    >
                      <fieldset>
                        <legend
                          className="
                            text-sm
                            font-black
                            text-white
                          "
                        >
                          Card finish
                        </legend>

                        <p
                          className="
                            mt-1
                            text-xs
                            font-semibold
                            leading-5
                            text-white/35
                          "
                        >
                          Keep Normal, Holo and Reverse Holo
                          copies as separate physical stock.
                        </p>

                        <div
                          className="
                            mt-3
                            grid
                            gap-3
                            sm:grid-cols-3
                          "
                        >
                          {FINISH_OPTIONS.map(
                            (option) => {
                              const active =
                                finish ===
                                option.value;

                              return (
                                <button
                                  key={
                                    option.value
                                  }
                                  type="button"
                                  onClick={() =>
                                    chooseFinish(
                                      option.value,
                                    )
                                  }
                                  disabled={adding}
                                  aria-pressed={
                                    active
                                  }
                                  className={`
                                    min-h-24
                                    rounded-2xl
                                    border
                                    p-4
                                    text-left
                                    transition
                                    disabled:cursor-not-allowed
                                    disabled:opacity-45
                                    ${
                                      active
                                        ? option.selectedClassName
                                        : `
                                            border-white/10
                                            bg-white/[0.04]
                                            text-white/55
                                            hover:border-white/20
                                            hover:bg-white/[0.075]
                                            hover:text-white
                                          `
                                    }
                                  `}
                                >
                                  <span
                                    className="
                                      flex
                                      h-8
                                      w-8
                                      items-center
                                      justify-center
                                      rounded-xl
                                      border
                                      border-white/10
                                      bg-black/15
                                      text-xs
                                      font-black
                                    "
                                  >
                                    {
                                      option.shortLabel
                                    }
                                  </span>

                                  <span
                                    className="
                                      mt-3
                                      block
                                      text-sm
                                      font-black
                                    "
                                  >
                                    {option.label}
                                  </span>

                                  <span
                                    className="
                                      mt-1
                                      block
                                      text-[0.68rem]
                                      font-semibold
                                      leading-4
                                      opacity-55
                                    "
                                  >
                                    {
                                      option.description
                                    }
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>
                      </fieldset>

                      <label
                        htmlFor="quantity"
                        className="
                          text-sm
                          font-black
                          mt-7
                          block
                          text-white
                        "
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
                          onClick={() =>
                            setQuantity(
                              (current) =>
                                Math.max(
                                  1,
                                  current - 1,
                                ),
                            )
                          }
                          disabled={adding}
                          className="
                            min-h-16
                            border-r
                            border-white/10
                            text-2xl
                            font-black
                            transition
                            hover:bg-white/10
                            disabled:opacity-40
                          "
                        >
                          −
                        </button>

                        <input
                          id="quantity"
                          type="number"
                          min="1"
                          max="9999"
                          value={quantity}
                          onChange={(event) =>
                            setQuantity(
                              Math.max(
                                1,
                                Math.min(
                                  9999,
                                  Number(
                                    event.target
                                      .value,
                                  ) || 1,
                                ),
                              ),
                            )
                          }
                          disabled={adding}
                          className="
                            min-w-0
                            bg-transparent
                            text-center
                            text-xl
                            font-black
                            text-white
                            outline-none
                          "
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(
                              (current) =>
                                Math.min(
                                  9999,
                                  current + 1,
                                ),
                            )
                          }
                          disabled={adding}
                          className="
                            min-h-16
                            border-l
                            border-white/10
                            text-2xl
                            font-black
                            transition
                            hover:bg-white/10
                            disabled:opacity-40
                          "
                        >
                          +
                        </button>
                      </div>

                      <div
                        className="
                          mt-3
                          grid
                          grid-cols-4
                          gap-2
                        "
                      >
                        {[5, 10, 25, 50].map(
                          (quickQuantity) => (
                            <button
                              key={
                                quickQuantity
                              }
                              type="button"
                              onClick={() =>
                                setQuantity(
                                  quickQuantity,
                                )
                              }
                              disabled={adding}
                              className="
                                min-h-11
                                rounded-xl
                                border
                                border-white/10
                                bg-white/[0.05]
                                text-sm
                                font-black
                                text-white/60
                                transition
                                hover:bg-white/10
                                hover:text-white
                                disabled:opacity-40
                              "
                            >
                              {quickQuantity}
                            </button>
                          ),
                        )}
                      </div>

                      <label
                        htmlFor="location"
                        className="
                          mt-6
                          block
                          text-sm
                          font-black
                          text-white
                        "
                      >
                        Storage location
                      </label>

                      <input
                        id="location"
                        value={location}
                        onChange={(event) =>
                          setLocation(
                            event.target.value,
                          )
                        }
                        disabled={adding}
                        placeholder="Main Inventory"
                        className="
                          mt-3
                          min-h-16
                          w-full
                          rounded-2xl
                          border
                          border-white/15
                          bg-black/20
                          px-5
                          font-bold
                          text-white
                          outline-none
                          placeholder:text-white/25
                          focus:border-emerald-300/45
                          disabled:opacity-50
                        "
                      />

                      <button
                        type="submit"
                        disabled={adding}
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
                          shadow-[0_0_45px_rgba(110,231,183,0.22)]
                          transition
                          hover:-translate-y-0.5
                          hover:bg-emerald-200
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {adding ? (
                          <>
                            <span className="animate-spin">
                              ◌
                            </span>

                            Adding to inventory
                          </>
                        ) : (
                          <>
                            Add{" "}
                            {getFinishLabel(finish)}{" "}
                            to inventory
                            <span>-&gt;</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={adding}
                        className="
                          mt-3
                          min-h-12
                          w-full
                          rounded-xl
                          border
                          border-white/10
                          bg-white/[0.04]
                          font-black
                          text-white/50
                          transition
                          hover:bg-white/[0.08]
                          hover:text-white
                          disabled:opacity-40
                        "
                      >
                        Clear selection
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {scannerOpen && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            overflow-y-auto
            bg-[#020617]/90
            px-3
            py-5
            backdrop-blur-2xl
            md:px-8
            md:py-8
          "
          role="dialog"
          aria-modal="true"
          aria-label="Pokémon card scanner"
        >
          <div
            className="
              mx-auto
              max-w-[1500px]
            "
          >
            <div
              className="
                mb-4
                flex
                items-center
                justify-between
                gap-4
                rounded-[1.75rem]
                border
                border-white/15
                bg-[#03150f]/90
                px-5
                py-4
                shadow-2xl
                backdrop-blur-3xl
              "
            >
              <div>
                <p
                  className="
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-cyan-200/55
                  "
                >
                  Optional intake tool
                </p>

                <h2
                  className="
                    mt-1
                    text-xl
                    font-black
                    text-white
                  "
                >
                  Scan a card
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setScannerOpen(false)
                }
                className="
                  flex
                  h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  border
                  border-white/15
                  bg-white/[0.07]
                  px-5
                  font-black
                  text-white
                  transition
                  hover:bg-white/10
                "
              >
                <span className="text-xl">
                  ×
                </span>

                Close
              </button>
            </div>

            <CardScanner
              disabled={adding}
              autoStart
              resetKey={
                scannerResetKey
              }
              onSelect={
                handleScannerSelection
              }
              onAutoAdd={
                handleScannerAutoAdd
              }
              autoIntakeLabel={`${getFinishLabel(finish)} · ${location.trim() || "Main Inventory"}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
