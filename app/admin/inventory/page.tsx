"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import {
  FounderFavouriteButton,
  FounderFavouritesDisplay,
} from "@/components/FounderFavourites";
import { supabase } from "@/lib/supabase";

type InventoryDatabaseRow = {
  id: string | number;
  card_id: string | number | null;
  quantity: number | string | null;
  location: string | null;
  status: string | null;
  added_by: string | null;
};

type PokemonCardDatabaseRow = {
  id: string | number;
  api_id: string | null;
  name: string;
  rarity: string | null;
  set_name: string | null;
  card_no: string | null;
  image_url: string | null;
  market_value: number | string | null;
  price_source: string | null;
  price_updated_at: string | null;
};

type InventoryItem = {
  id: string;
  cardId: string;
  quantity: number;
  location: string;
  status: string;
  addedBy: string;

  card: {
    id: string;
    apiId: string;
    name: string;
    rarity: string;
    setName: string;
    cardNumber: string;
    imageUrl: string | null;
    marketValue: number;
    priceSource: string;
    priceUpdatedAt: string | null;
  };
};

type PriceRefreshResponse = {
  success?: boolean;
  updated?: number;
  unchanged?: number;
  missingApiId?: number;
  missingPrice?: number;
  syncedAt?: string;
  error?: string;
};

type ManualPriceEditor = {
  inventoryId: string;
  cardId: string;
  cardName: string;
  currentValue: number;
  value: string;
};

type StockFilter =
  | "all"
  | "low"
  | "out"
  | "healthy";

type SortOption =
  | "name"
  | "quantity-low"
  | "quantity-high"
  | "price-high"
  | "price-low"
  | "value-high";

type RarityTheme = {
  badge: string;
  accent: string;
  glow: string;
  dot: string;
};

const LOW_STOCK_THRESHOLD = 3;
const DATABASE_REFRESH_INTERVAL = 60_000;
const EXTERNAL_PRICE_INTERVAL = 15 * 60_000;
const CARD_QUERY_BATCH_SIZE = 300;

const LAST_EXTERNAL_SYNC_KEY =
  "pocketpulls:last-external-price-sync";

function toNumber(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normaliseIdentifier(
  value: unknown,
): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    return normaliseIdentifier(
      record.id ??
        record.card_id ??
        record.value,
    );
  }

  return "";
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatTime(
  value: Date | null,
): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatPriceTimestamp(
  value: string | null,
): string {
  if (!value) {
    return "No update timestamp";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown update time";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function chunkArray<T>(
  values: T[],
  size: number,
): T[][] {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size),
    );
  }

  return chunks;
}

function getPriceSourceLabel(
  source: string,
): string {
  const value =
    source.toLowerCase();

  if (value === "manual") {
    return "Manual override";
  }

  if (value === "cardmarket") {
    return "Cardmarket";
  }

  if (value === "tcgplayer") {
    return "TCGplayer";
  }

  return "Stored value";
}

function getRarityTheme(
  rarity: string,
): RarityTheme {
  const value =
    rarity.trim().toLowerCase();

  if (
    value.includes(
      "special illustration",
    )
  ) {
    return {
      badge:
        "border-fuchsia-200/35 bg-fuchsia-300/15 text-fuchsia-100",

      accent:
        "from-fuchsia-300 via-purple-300 to-violet-300",

      glow:
        "shadow-[0_0_35px_rgba(232,121,249,0.12)]",

      dot: "bg-fuchsia-300",
    };
  }

  if (value.includes("hyper")) {
    return {
      badge:
        "border-yellow-200/40 bg-yellow-300/15 text-yellow-100",

      accent:
        "from-yellow-200 via-amber-300 to-orange-300",

      glow:
        "shadow-[0_0_35px_rgba(253,224,71,0.14)]",

      dot: "bg-yellow-300",
    };
  }

  if (
    value.includes("shiny ultra")
  ) {
    return {
      badge:
        "border-pink-200/35 bg-pink-300/15 text-pink-100",

      accent:
        "from-pink-300 via-rose-300 to-fuchsia-300",

      glow:
        "shadow-[0_0_35px_rgba(244,114,182,0.12)]",

      dot: "bg-pink-300",
    };
  }

  if (value.includes("ultra")) {
    return {
      badge:
        "border-rose-200/35 bg-rose-300/15 text-rose-100",

      accent:
        "from-rose-300 via-red-300 to-orange-300",

      glow:
        "shadow-[0_0_35px_rgba(251,113,133,0.12)]",

      dot: "bg-rose-300",
    };
  }

  if (
    value.includes("illustration")
  ) {
    return {
      badge:
        "border-violet-200/35 bg-violet-300/15 text-violet-100",

      accent:
        "from-violet-300 via-purple-300 to-indigo-300",

      glow:
        "shadow-[0_0_35px_rgba(167,139,250,0.12)]",

      dot: "bg-violet-300",
    };
  }

  if (
    value.includes("double rare")
  ) {
    return {
      badge:
        "border-indigo-200/35 bg-indigo-300/15 text-indigo-100",

      accent:
        "from-indigo-300 via-blue-300 to-cyan-300",

      glow:
        "shadow-[0_0_35px_rgba(129,140,248,0.12)]",

      dot: "bg-indigo-300",
    };
  }

  if (value.includes("secret")) {
    return {
      badge:
        "border-amber-200/40 bg-amber-300/15 text-amber-100",

      accent:
        "from-amber-200 via-yellow-300 to-lime-300",

      glow:
        "shadow-[0_0_35px_rgba(252,211,77,0.13)]",

      dot: "bg-amber-300",
    };
  }

  if (value.includes("ace spec")) {
    return {
      badge:
        "border-red-200/35 bg-red-400/15 text-red-100",

      accent:
        "from-red-300 via-rose-300 to-pink-300",

      glow:
        "shadow-[0_0_35px_rgba(248,113,113,0.12)]",

      dot: "bg-red-300",
    };
  }

  if (
    value.includes("radiant") ||
    value.includes("amazing")
  ) {
    return {
      badge:
        "border-orange-200/35 bg-orange-300/15 text-orange-100",

      accent:
        "from-orange-300 via-amber-300 to-yellow-300",

      glow:
        "shadow-[0_0_35px_rgba(251,146,60,0.12)]",

      dot: "bg-orange-300",
    };
  }

  if (
    value.includes("shiny") ||
    value.includes("holo")
  ) {
    return {
      badge:
        "border-cyan-200/35 bg-cyan-300/15 text-cyan-100",

      accent:
        "from-cyan-200 via-sky-300 to-blue-300",

      glow:
        "shadow-[0_0_35px_rgba(103,232,249,0.12)]",

      dot: "bg-cyan-300",
    };
  }

  if (value.includes("promo")) {
    return {
      badge:
        "border-teal-200/35 bg-teal-300/15 text-teal-100",

      accent:
        "from-teal-300 via-emerald-300 to-lime-300",

      glow:
        "shadow-[0_0_35px_rgba(94,234,212,0.12)]",

      dot: "bg-teal-300",
    };
  }

  if (value.includes("rare")) {
    return {
      badge:
        "border-blue-200/35 bg-blue-300/15 text-blue-100",

      accent:
        "from-blue-300 via-sky-300 to-cyan-300",

      glow:
        "shadow-[0_0_35px_rgba(96,165,250,0.12)]",

      dot: "bg-blue-300",
    };
  }

  if (value.includes("uncommon")) {
    return {
      badge:
        "border-emerald-200/35 bg-emerald-300/15 text-emerald-100",

      accent:
        "from-emerald-300 via-teal-300 to-cyan-300",

      glow:
        "shadow-[0_0_35px_rgba(52,211,153,0.1)]",

      dot: "bg-emerald-300",
    };
  }

  if (value.includes("common")) {
    return {
      badge:
        "border-slate-200/25 bg-slate-300/10 text-slate-100",

      accent:
        "from-slate-300 via-zinc-300 to-stone-300",

      glow:
        "shadow-[0_0_30px_rgba(203,213,225,0.06)]",

      dot: "bg-slate-300",
    };
  }

  return {
    badge:
      "border-white/15 bg-white/[0.07] text-white/70",

    accent:
      "from-zinc-400 via-slate-400 to-neutral-400",

    glow:
      "shadow-[0_0_25px_rgba(255,255,255,0.04)]",

    dot: "bg-zinc-300",
  };
}

function InventorySkeleton() {
  return (
    <div
      className="
        grid
        animate-pulse
        gap-4
        p-4
        md:p-8
        xl:grid-cols-2
      "
    >
      {[1, 2, 3, 4].map(
        (item) => (
          <div
            key={item}
            className="
              h-80
              rounded-[2rem]
              border
              border-white/10
              bg-white/[0.04]
            "
          />
        ),
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [
    inventory,
    setInventory,
  ] = useState<InventoryItem[]>([]);

  const [
    locationDrafts,
    setLocationDrafts,
  ] = useState<
    Record<string, string>
  >({});

  const [query, setQuery] =
    useState("");

  const [
    stockFilter,
    setStockFilter,
  ] = useState<StockFilter>("all");

  const [
    sortOption,
    setSortOption,
  ] = useState<SortOption>("name");

  const [loading, setLoading] =
    useState(true);

  const [
    refreshingDatabase,
    setRefreshingDatabase,
  ] = useState(false);

  const [
    refreshingPrices,
    setRefreshingPrices,
  ] = useState(false);

  const [
    busyAction,
    setBusyAction,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    lastDatabaseRefresh,
    setLastDatabaseRefresh,
  ] = useState<Date | null>(null);

  const [
    lastExternalSync,
    setLastExternalSync,
  ] = useState<Date | null>(null);

  const [
    priceEditor,
    setPriceEditor,
  ] = useState<ManualPriceEditor | null>(
    null,
  );

  const [
    savingManualPrice,
    setSavingManualPrice,
  ] = useState(false);

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  const realtimeTimerRef =
    useRef<number | null>(null);

  const successTimerRef =
    useRef<number | null>(null);

  const priceSyncingRef =
    useRef(false);

  const showSuccess = useCallback(
    (message: string) => {
      setSuccess(message);

      if (
        successTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          successTimerRef.current,
        );
      }

      successTimerRef.current =
        window.setTimeout(() => {
          setSuccess("");

          successTimerRef.current =
            null;
        }, 4500);
    },
    [],
  );

  const loadInventory = useCallback(
    async (
      background = false,
    ) => {
      const requestId =
        requestIdRef.current + 1;

      requestIdRef.current =
        requestId;

      if (background) {
        setRefreshingDatabase(true);
      } else {
        setLoading(true);
      }

      try {
        const {
          data: inventoryData,
          error: inventoryError,
        } = await supabase
          .from("inventory")
          .select(`
            id,
            card_id,
            quantity,
            location,
            status,
            added_by
          `);

        if (inventoryError) {
          throw inventoryError;
        }

        const inventoryRows =
          (inventoryData ||
            []) as InventoryDatabaseRow[];

        const cardIds = [
          ...new Set(
            inventoryRows
              .map(
                (row) =>
                  row.card_id,
              )
              .filter(Boolean),
          ),
        ];

        const cardRows:
          PokemonCardDatabaseRow[] =
          [];

        for (
          const cardIdBatch of chunkArray(
            cardIds,
            CARD_QUERY_BATCH_SIZE,
          )
        ) {
          if (
            cardIdBatch.length === 0
          ) {
            continue;
          }

          const {
            data,
            error: cardError,
          } = await supabase
            .from("pokemon_cards")
            .select(`
              id,
              api_id,
              name,
              rarity,
              set_name,
              card_no,
              image_url,
              market_value,
              price_source,
              price_updated_at
            `)
            .in(
              "id",
              cardIdBatch,
            );

          if (cardError) {
            throw cardError;
          }

          cardRows.push(
            ...((data ||
              []) as PokemonCardDatabaseRow[]),
          );
        }

        const cardsById =
          new Map<
            string,
            PokemonCardDatabaseRow
          >();

        for (const card of cardRows) {
          const cardId =
            normaliseIdentifier(card.id);

          if (cardId) {
            cardsById.set(cardId, card);
          }
        }

        const items = inventoryRows
          .map(
            (
              row,
            ): InventoryItem | null => {
              const inventoryId =
                normaliseIdentifier(
                  row.id,
                );

              const cardId =
                normaliseIdentifier(
                  row.card_id,
                );

              if (
                !inventoryId ||
                !cardId
              ) {
                return null;
              }

              const card =
                cardsById.get(cardId);

              if (!card) {
                return null;
              }

              const resolvedCardId =
                normaliseIdentifier(
                  card.id,
                );

              if (!resolvedCardId) {
                return null;
              }

              return {
                id: inventoryId,
                cardId,

                quantity:
                  toNumber(row.quantity),

                location:
                  row.location ||
                  "Main Inventory",

                status:
                  row.status ||
                  "in_stock",

                addedBy:
                  row.added_by ||
                  "Admin",

                card: {
                  id: resolvedCardId,

                  apiId:
                    card.api_id || "",

                  name:
                    card.name ||
                    "Unknown Pokémon",

                  rarity:
                    card.rarity ||
                    "Unknown rarity",

                  setName:
                    card.set_name ||
                    "Unknown set",

                  cardNumber:
                    card.card_no || "",

                  imageUrl:
                    card.image_url || null,

                  marketValue:
                    toNumber(card.market_value),

                  priceSource:
                    card.price_source || "",

                  priceUpdatedAt:
                    card.price_updated_at,
                },
              };
            },
          )
          .filter(
            (
              item,
            ): item is InventoryItem =>
              item !== null,
          );

        if (
          !mountedRef.current ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        setInventory(items);

        setLocationDrafts(
          (current) => {
            const next: Record<
              string,
              string
            > = {};

            for (const item of items) {
              next[item.id] =
                current[item.id] ??
                item.location;
            }

            return next;
          },
        );

        setLastDatabaseRefresh(
          new Date(),
        );
      } catch (
        loadError: unknown
      ) {
        if (!mountedRef.current) {
          return;
        }

        console.error(
          "Inventory loading error:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "The inventory could not be loaded.",
        );
      } finally {
        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setLoading(false);

          setRefreshingDatabase(
            false,
          );
        }
      }
    },
    [],
  );

  const syncExternalPrices =
    useCallback(
      async (
        force = false,
        silent = false,
      ) => {
        if (
          priceSyncingRef.current
        ) {
          return;
        }

        const storedLastSync =
          Number(
            window.localStorage.getItem(
              LAST_EXTERNAL_SYNC_KEY,
            ),
          ) || 0;

        if (
          !force &&
          Date.now() -
            storedLastSync <
            EXTERNAL_PRICE_INTERVAL
        ) {
          if (storedLastSync > 0) {
            setLastExternalSync(
              new Date(
                storedLastSync,
              ),
            );
          }

          return;
        }

        priceSyncingRef.current =
          true;

        setRefreshingPrices(true);

        if (!silent) {
          setError("");
        }

        try {
          const {
            data: { session },
            error: sessionError,
          } =
            await supabase.auth.getSession();

          if (
            sessionError ||
            !session?.access_token
          ) {
            throw new Error(
              "Your admin session could not be found. Log in again.",
            );
          }

          const response =
            await fetch(
              "/api/prices/refresh",
              {
                method: "POST",

                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,

                  "Content-Type":
                    "application/json",
                },

                cache: "no-store",
              },
            );

          const result =
            (await response.json()) as PriceRefreshResponse;

          if (!response.ok) {
            throw new Error(
              result.error ||
                "External price synchronisation failed.",
            );
          }

          const parsedSyncDate =
            result.syncedAt
              ? new Date(
                  result.syncedAt,
                )
              : new Date();

          const syncDate =
            Number.isNaN(
              parsedSyncDate.getTime(),
            )
              ? new Date()
              : parsedSyncDate;

          window.localStorage.setItem(
            LAST_EXTERNAL_SYNC_KEY,
            String(
              syncDate.getTime(),
            ),
          );

          if (!mountedRef.current) {
            return;
          }

          setLastExternalSync(
            syncDate,
          );

          await loadInventory(true);

          if (!silent) {
            const summary = [
              `${result.updated || 0} updated`,

              `${result.unchanged || 0} unchanged`,
            ];

            if (
              result.missingApiId
            ) {
              summary.push(
                `${result.missingApiId} missing API IDs`,
              );
            }

            if (
              result.missingPrice
            ) {
              summary.push(
                `${result.missingPrice} without prices`,
              );
            }

            showSuccess(
              `Live-price sync complete: ${summary.join(
                " · ",
              )}.`,
            );
          }
        } catch (
          syncError: unknown
        ) {
          console.error(
            "External price sync error:",
            syncError,
          );

          if (
            mountedRef.current &&
            !silent
          ) {
            setError(
              syncError instanceof Error
                ? syncError.message
                : "The external prices could not be refreshed.",
            );
          }
        } finally {
          priceSyncingRef.current =
            false;

          if (mountedRef.current) {
            setRefreshingPrices(
              false,
            );
          }
        }
      },
      [
        loadInventory,
        showSuccess,
      ],
    );

  useEffect(() => {
    mountedRef.current = true;

    const storedLastSync =
      Number(
        window.localStorage.getItem(
          LAST_EXTERNAL_SYNC_KEY,
        ),
      ) || 0;

    if (storedLastSync > 0) {
      setLastExternalSync(
        new Date(storedLastSync),
      );
    }

    async function initialise() {
      await loadInventory(false);

      await syncExternalPrices(
        false,
        true,
      );
    }

    void initialise();

    function scheduleDatabaseRefresh() {
      if (
        realtimeTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          realtimeTimerRef.current,
        );
      }

      realtimeTimerRef.current =
        window.setTimeout(() => {
          void loadInventory(true);

          realtimeTimerRef.current =
            null;
        }, 350);
    }

    const realtimeChannel =
      supabase
        .channel(
          "inventory-direct-live-sync",
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "inventory",
          },
          scheduleDatabaseRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "pokemon_cards",
          },
          scheduleDatabaseRefresh,
        )
        .subscribe();

    const databaseInterval =
      window.setInterval(() => {
        void loadInventory(true);
      }, DATABASE_REFRESH_INTERVAL);

    const priceInterval =
      window.setInterval(() => {
        void syncExternalPrices(
          false,
          true,
        );
      }, DATABASE_REFRESH_INTERVAL);

    function refreshOnFocus() {
      void loadInventory(true);

      void syncExternalPrices(
        false,
        true,
      );
    }

    function refreshOnVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshOnFocus();
      }
    }

    window.addEventListener(
      "focus",
      refreshOnFocus,
    );

    document.addEventListener(
      "visibilitychange",
      refreshOnVisibility,
    );

    return () => {
      mountedRef.current = false;

      window.clearInterval(
        databaseInterval,
      );

      window.clearInterval(
        priceInterval,
      );

      window.removeEventListener(
        "focus",
        refreshOnFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        refreshOnVisibility,
      );

      if (
        realtimeTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          realtimeTimerRef.current,
        );
      }

      if (
        successTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          successTimerRef.current,
        );
      }

      void supabase.removeChannel(
        realtimeChannel,
      );
    };
  }, [
    loadInventory,
    syncExternalPrices,
  ]);

  const totalUnits =
    useMemo(
      () =>
        inventory.reduce(
          (total, item) =>
            total +
            item.quantity,
          0,
        ),
      [inventory],
    );

  const totalInventoryValue =
    useMemo(
      () =>
        inventory.reduce(
          (total, item) =>
            total +
            item.card.marketValue *
              item.quantity,
          0,
        ),
      [inventory],
    );

  const lowStockCount =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            item.quantity > 0 &&
            item.quantity <=
              LOW_STOCK_THRESHOLD,
        ).length,
      [inventory],
    );

  const outOfStockCount =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            item.quantity === 0,
        ).length,
      [inventory],
    );

  const missingApiIdCount =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            !item.card.apiId,
        ).length,
      [inventory],
    );

  const manualPriceCount =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            item.card.priceSource
              .toLowerCase() ===
            "manual",
        ).length,
      [inventory],
    );

  const visibleInventory =
    useMemo(() => {
      const cleanedQuery =
        query
          .trim()
          .toLowerCase();

      const filtered =
        inventory.filter(
          (item) => {
            const matchesSearch =
              !cleanedQuery ||
              item.card.name
                .toLowerCase()
                .includes(
                  cleanedQuery,
                ) ||
              item.card.setName
                .toLowerCase()
                .includes(
                  cleanedQuery,
                ) ||
              item.card.cardNumber
                .toLowerCase()
                .includes(
                  cleanedQuery,
                ) ||
              item.card.rarity
                .toLowerCase()
                .includes(
                  cleanedQuery,
                ) ||
              item.location
                .toLowerCase()
                .includes(
                  cleanedQuery,
                );

            const matchesStock =
              stockFilter ===
                "all" ||
              (stockFilter ===
                "low" &&
                item.quantity > 0 &&
                item.quantity <=
                  LOW_STOCK_THRESHOLD) ||
              (stockFilter ===
                "out" &&
                item.quantity === 0) ||
              (stockFilter ===
                "healthy" &&
                item.quantity >
                  LOW_STOCK_THRESHOLD);

            return (
              matchesSearch &&
              matchesStock
            );
          },
        );

      return [...filtered].sort(
        (first, second) => {
          if (
            sortOption ===
            "quantity-low"
          ) {
            return (
              first.quantity -
              second.quantity
            );
          }

          if (
            sortOption ===
            "quantity-high"
          ) {
            return (
              second.quantity -
              first.quantity
            );
          }

          if (
            sortOption ===
            "price-high"
          ) {
            return (
              second.card
                .marketValue -
              first.card
                .marketValue
            );
          }

          if (
            sortOption ===
            "price-low"
          ) {
            return (
              first.card
                .marketValue -
              second.card
                .marketValue
            );
          }

          if (
            sortOption ===
            "value-high"
          ) {
            return (
              second.card
                .marketValue *
                second.quantity -
              first.card
                .marketValue *
                first.quantity
            );
          }

          return first.card.name.localeCompare(
            second.card.name,
          );
        },
      );
    }, [
      inventory,
      query,
      sortOption,
      stockFilter,
    ]);

  function isBusy(
    itemId: string,
  ): boolean {
    return busyAction.endsWith(
      itemId,
    );
  }

  function openManualPriceEditor(
    item: InventoryItem,
  ) {
    const cardId =
      normaliseIdentifier(
        item.cardId,
      ) ||
      normaliseIdentifier(
        item.card.id,
      );

    const inventoryId =
      normaliseIdentifier(item.id);

    if (!cardId) {
      setError(
        `${item.card.name} does not have a valid card database ID.`,
      );

      return;
    }

    if (!inventoryId) {
      setError(
        `${item.card.name} does not have a valid inventory ID.`,
      );

      return;
    }

    setError("");

    setPriceEditor({
      inventoryId,
      cardId,
      cardName:
        item.card.name,

      currentValue:
        item.card.marketValue,

      value:
        item.card.marketValue > 0
          ? item.card.marketValue.toFixed(
              2,
            )
          : "",
    });
  }

  async function saveManualPrice(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !priceEditor ||
      savingManualPrice
    ) {
      return;
    }

    const requestedValue =
      Number(priceEditor.value);

    if (
      !Number.isFinite(
        requestedValue,
      ) ||
      requestedValue <= 0
    ) {
      setError(
        "Enter a valid card value greater than £0.00.",
      );

      return;
    }

    const cardId =
      normaliseIdentifier(
        priceEditor.cardId,
      );

    const inventoryId =
      normaliseIdentifier(
        priceEditor.inventoryId,
      );

    if (
      !cardId &&
      !inventoryId
    ) {
      setError(
        "This inventory record has no usable card identifier. Refresh the page and try again.",
      );

      return;
    }

    const roundedValue =
      Math.round(
        (requestedValue +
          Number.EPSILON) *
          100,
      ) / 100;

    setSavingManualPrice(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your admin session could not be found. Log in again.",
        );
      }

      const response =
        await fetch(
          "/api/cards/manual-price",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              cardId:
                cardId ||
                undefined,

              inventoryId:
                inventoryId ||
                undefined,

              marketValue:
                roundedValue,
            }),

            cache: "no-store",
          },
        );

      const payload =
        (await response.json()) as {
          success?: boolean;
          error?: string;

          card?: {
            id: string;
            name: string;
            marketValue: number;
            priceSource: string;
            priceUpdatedAt: string;
          };
        };

      if (
        !response.ok ||
        !payload.success ||
        !payload.card
      ) {
        throw new Error(
          payload.error ||
            "The manual card value could not be saved.",
        );
      }

      const savedCard =
        payload.card;

      setInventory(
        (current) =>
          current.map((item) =>
            item.card.id ===
              savedCard.id ||
            item.cardId ===
              savedCard.id
              ? {
                  ...item,

                  card: {
                    ...item.card,

                    marketValue:
                      savedCard.marketValue,

                    priceSource:
                      savedCard.priceSource,

                    priceUpdatedAt:
                      savedCard.priceUpdatedAt,
                  },
                }
              : item,
          ),
      );

      showSuccess(
        `${savedCard.name} was manually valued at ${formatCurrency(
          savedCard.marketValue,
        )}.`,
      );

      setPriceEditor(null);
    } catch (
      manualPriceError: unknown
    ) {
      console.error(
        "Manual price update error:",
        manualPriceError,
      );

      setError(
        manualPriceError instanceof Error
          ? manualPriceError.message
          : "The manual card value could not be saved.",
      );
    } finally {
      setSavingManualPrice(false);
    }
  }

  async function changeQuantity(
    item: InventoryItem,
    adjustment: number,
  ) {
    if (isBusy(item.id)) {
      return;
    }

    const nextQuantity =
      Math.max(
        0,
        Math.min(
          9999,
          item.quantity +
            adjustment,
        ),
      );

    if (
      nextQuantity ===
      item.quantity
    ) {
      return;
    }

    setBusyAction(
      `quantity:${item.id}`,
    );

    setError("");

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("inventory")
        .update({
          quantity:
            nextQuantity,

          status:
            nextQuantity > 0
              ? "in_stock"
              : "out_of_stock",
        })
        .eq("id", item.id)
        .select(
          "quantity, status",
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      const savedQuantity =
        toNumber(data.quantity);

      setInventory(
        (current) =>
          current.map(
            (currentItem) =>
              currentItem.id ===
              item.id
                ? {
                    ...currentItem,

                    quantity:
                      savedQuantity,

                    status:
                      savedQuantity > 0
                        ? "in_stock"
                        : "out_of_stock",
                  }
                : currentItem,
          ),
      );

      showSuccess(
        `${item.card.name} stock updated to ${savedQuantity}.`,
      );
    } catch (
      quantityError: unknown
    ) {
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

  async function saveLocation(
    item: InventoryItem,
  ) {
    if (isBusy(item.id)) {
      return;
    }

    const nextLocation =
      locationDrafts[
        item.id
      ]?.trim() ||
      "Main Inventory";

    if (
      nextLocation ===
      item.location
    ) {
      return;
    }

    setBusyAction(
      `location:${item.id}`,
    );

    setError("");

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("inventory")
        .update({
          location:
            nextLocation,
        })
        .eq("id", item.id)
        .select("location")
        .single();

      if (updateError) {
        throw updateError;
      }

      const savedLocation =
        data.location ||
        "Main Inventory";

      setInventory(
        (current) =>
          current.map(
            (currentItem) =>
              currentItem.id ===
              item.id
                ? {
                    ...currentItem,

                    location:
                      savedLocation,
                  }
                : currentItem,
          ),
      );

      setLocationDrafts(
        (current) => ({
          ...current,

          [item.id]:
            savedLocation,
        }),
      );

      showSuccess(
        `${item.card.name} moved to ${savedLocation}.`,
      );
    } catch (
      locationError: unknown
    ) {
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

  async function removeItem(
    item: InventoryItem,
  ) {
    if (isBusy(item.id)) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${item.card.name} from inventory?\n\nThe master Pokémon card record will remain available.`,
      );

    if (!confirmed) {
      return;
    }

    setBusyAction(
      `remove:${item.id}`,
    );

    setError("");

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id);

      if (deleteError) {
        throw deleteError;
      }

      setInventory(
        (current) =>
          current.filter(
            (currentItem) =>
              currentItem.id !==
              item.id,
          ),
      );

      setLocationDrafts(
        (current) => {
          const next = {
            ...current,
          };

          delete next[item.id];

          return next;
        },
      );

      showSuccess(
        `${item.card.name} was removed from inventory.`,
      );
    } catch (
      removeError: unknown
    ) {
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
    <>
      <main
        className="
          relative
          min-h-screen
          overflow-x-hidden
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
                    className={`
                      h-2.5
                      w-2.5
                      rounded-full
                      shadow-[0_0_16px_rgba(110,231,183,1)]
                      ${
                        refreshingPrices
                          ? "animate-pulse bg-cyan-200"
                          : "bg-emerald-300"
                      }
                    `}
                  />

                  {refreshingPrices
                    ? "External prices synchronising"
                    : "Live pricing operational"}
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
                    max-w-3xl
                    text-base
                    font-medium
                    leading-7
                    text-emerald-50/70
                    md:text-lg
                  "
                >
                  Manage physical stock, provider pricing,
                  manual valuations and storage locations
                  from one operational workspace.
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
                    void loadInventory(
                      true,
                    )
                  }
                  disabled={
                    refreshingDatabase
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
                    bg-white/10
                    px-5
                    font-black
                    text-white
                    transition
                    hover:bg-white/15
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <span
                    className={
                      refreshingDatabase
                        ? "animate-spin"
                        : ""
                    }
                  >
                    ↻
                  </span>

                  Refresh stock
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void syncExternalPrices(
                      true,
                      false,
                    )
                  }
                  disabled={
                    refreshingPrices
                  }
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
                    px-5
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
                    className={
                      refreshingPrices
                        ? "animate-spin"
                        : ""
                    }
                  >
                    ◌
                  </span>

                  {refreshingPrices
                    ? "Updating prices"
                    : "Sync live prices"}
                </button>
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
            <SummaryCard
              label="Unique cards"
              value={inventory.length.toLocaleString(
                "en-GB",
              )}
              caption="Inventory records"
              icon="🎴"
            />

            <SummaryCard
              label="Total units"
              value={totalUnits.toLocaleString(
                "en-GB",
              )}
              caption="Physical cards available"
              icon="📦"
            />

            <SummaryCard
              label="Stock warnings"
              value={(
                lowStockCount +
                outOfStockCount
              ).toString()}
              caption={`${lowStockCount} low · ${outOfStockCount} empty`}
              icon="⚠"
            />

            <SummaryCard
              label="Inventory value"
              value={formatCurrency(
                totalInventoryValue,
              )}
              caption={`${manualPriceCount} manual · ${missingApiIdCount} missing IDs`}
              icon="💎"
              highlighted
            />
          </section>

          <FounderFavouritesDisplay />

          <section
            className="
              mt-5
              grid
              gap-4
              md:grid-cols-2
            "
          >
            <StatusPanel
              label="Database refreshed"
              value={formatTime(
                lastDatabaseRefresh,
              )}
            />

            <StatusPanel
              label="External prices synced"
              value={formatTime(
                lastExternalSync,
              )}
              accent
            />
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
              {error}
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
                    Live stock catalogue
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

                  <p
                    className="
                      mt-2
                      text-sm
                      text-white/45
                    "
                  >
                    Showing{" "}
                    {
                      visibleInventory.length
                    }{" "}
                    of {inventory.length} records
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
                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value,
                      )
                    }
                    placeholder="Search cards, sets or locations..."
                    className="
                      min-h-14
                      min-w-0
                      rounded-2xl
                      border
                      border-white/15
                      bg-black/20
                      px-5
                      font-bold
                      text-white
                      outline-none
                      placeholder:text-white/30
                      focus:border-emerald-300/45
                      sm:min-w-80
                    "
                  />

                  <select
                    value={sortOption}
                    onChange={(event) =>
                      setSortOption(
                        event.target
                          .value as SortOption,
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

                    <option value="price-high">
                      Sort: Highest price
                    </option>

                    <option value="price-low">
                      Sort: Lowest price
                    </option>

                    <option value="value-high">
                      Sort: Highest stock value
                    </option>
                  </select>
                </div>
              </div>

              <div
                className="
                  mt-6
                  flex
                  flex-wrap
                  gap-2
                "
              >
                <FilterButton
                  active={
                    stockFilter === "all"
                  }
                  onClick={() =>
                    setStockFilter("all")
                  }
                >
                  All stock
                </FilterButton>

                <FilterButton
                  active={
                    stockFilter === "low"
                  }
                  onClick={() =>
                    setStockFilter("low")
                  }
                >
                  Low stock · {lowStockCount}
                </FilterButton>

                <FilterButton
                  active={
                    stockFilter === "out"
                  }
                  onClick={() =>
                    setStockFilter("out")
                  }
                >
                  Empty · {outOfStockCount}
                </FilterButton>

                <FilterButton
                  active={
                    stockFilter ===
                    "healthy"
                  }
                  onClick={() =>
                    setStockFilter(
                      "healthy",
                    )
                  }
                >
                  Healthy stock
                </FilterButton>
              </div>
            </div>

            {loading ? (
              <InventorySkeleton />
            ) : visibleInventory.length ===
              0 ? (
              <div
                className="
                  flex
                  min-h-[28rem]
                  flex-col
                  items-center
                  justify-center
                  px-6
                  text-center
                "
              >
                <div className="text-6xl">
                  📦
                </div>

                <h3
                  className="
                    mt-6
                    text-2xl
                    font-black
                  "
                >
                  No inventory found
                </h3>

                <p
                  className="
                    mt-3
                    text-white/45
                  "
                >
                  Change the search or filter,
                  or add cards through the
                  navigation bar.
                </p>
              </div>
            ) : (
              <div
                className="
                  grid
                  gap-4
                  p-4
                  md:p-8
                  xl:grid-cols-2
                "
              >
                {visibleInventory.map(
                  (item) => {
                    const stockValue =
                      item.card
                        .marketValue *
                      item.quantity;

                    const lowStock =
                      item.quantity > 0 &&
                      item.quantity <=
                        LOW_STOCK_THRESHOLD;

                    const outOfStock =
                      item.quantity === 0;

                    const locationChanged =
                      (locationDrafts[
                        item.id
                      ] ||
                        "Main Inventory") !==
                      item.location;

                    const rarityTheme =
                      getRarityTheme(
                        item.card.rarity,
                      );

                    const manualPrice =
                      item.card.priceSource
                        .toLowerCase() ===
                      "manual";

                    return (
                      <article
                        key={item.id}
                        className={`
                          group
                          relative
                          overflow-hidden
                          rounded-[2rem]
                          border
                          border-white/10
                          bg-white/[0.045]
                          transition
                          hover:border-white/20
                          hover:bg-white/[0.065]
                          ${rarityTheme.glow}
                        `}
                      >
                        <div
                          className={`
                            h-1
                            w-full
                            bg-gradient-to-r
                            ${rarityTheme.accent}
                          `}
                        />

                        <div
                          className="
                            flex
                            gap-5
                            p-5
                          "
                        >
                          <div
                            className="
                              flex
                              h-40
                              w-28
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
                            {item.card
                              .imageUrl ? (
                              <img
                                src={
                                  item.card
                                    .imageUrl
                                }
                                alt={
                                  item.card.name
                                }
                                className="
                                  h-full
                                  w-full
                                  object-contain
                                  p-2
                                  transition
                                  group-hover:scale-105
                                "
                              />
                            ) : (
                              <span
                                className="
                                  text-4xl
                                "
                              >
                                🎴
                              </span>
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
                                flex
                                items-start
                                justify-between
                                gap-4
                              "
                            >
                              <div className="min-w-0">
                                <h3
                                  className="
                                    truncate
                                    text-xl
                                    font-black
                                  "
                                >
                                  {
                                    item.card
                                      .name
                                  }
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
                                  {
                                    item.card
                                      .setName
                                  }

                                  {item.card
                                    .cardNumber
                                    ? ` · #${item.card.cardNumber}`
                                    : ""}
                                </p>
                              </div>

                              <div
                                className="
                                  flex-none
                                  text-right
                                "
                              >
                                <p
                                  className="
                                    text-xs
                                    font-black
                                    uppercase
                                    tracking-[0.12em]
                                    text-white/35
                                  "
                                >
                                  {manualPrice
                                    ? "Manual value"
                                    : "Card value"}
                                </p>

                                <p
                                  className={`
                                    mt-1
                                    text-xl
                                    font-black
                                    ${
                                      manualPrice
                                        ? "text-amber-200"
                                        : "text-emerald-200"
                                    }
                                  `}
                                >
                                  {formatCurrency(
                                    item.card
                                      .marketValue,
                                  )}
                                </p>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openManualPriceEditor(
                                      item,
                                    )
                                  }
                                  className="
                                    mt-2
                                    rounded-lg
                                    border
                                    border-white/10
                                    bg-white/[0.06]
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-black
                                    text-white/60
                                    transition
                                    hover:border-amber-200/25
                                    hover:bg-amber-300/10
                                    hover:text-amber-100
                                  "
                                >
                                  Alter value
                                </button>

                                <FounderFavouriteButton
                                  cardId={
                                    item.card
                                      .id
                                  }
                                  cardName={
                                    item.card.name
                                  }
                                />
                              </div>
                            </div>

                            <div
                              className="
                                mt-3
                                flex
                                flex-wrap
                                gap-2
                              "
                            >
                              <span
                                className={`
                                  inline-flex
                                  items-center
                                  gap-2
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-black
                                  ${rarityTheme.badge}
                                `}
                              >
                                <span
                                  className={`
                                    h-2
                                    w-2
                                    rounded-full
                                    ${rarityTheme.dot}
                                  `}
                                />

                                {
                                  item.card
                                    .rarity
                                }
                              </span>

                              <span
                                className={`
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-black
                                  ${
                                    outOfStock
                                      ? "border-red-200/20 bg-red-400/10 text-red-200"
                                      : lowStock
                                        ? "border-amber-200/20 bg-amber-300/10 text-amber-100"
                                        : "border-emerald-200/20 bg-emerald-300/10 text-emerald-100"
                                  }
                                `}
                              >
                                {outOfStock
                                  ? "Out of stock"
                                  : lowStock
                                    ? "Low stock"
                                    : "In stock"}
                              </span>

                              {manualPrice && (
                                <span
                                  className="
                                    rounded-full
                                    border
                                    border-amber-200/25
                                    bg-amber-300/10
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-black
                                    text-amber-100
                                  "
                                >
                                  Manual override
                                </span>
                              )}

                              {!item.card
                                .apiId && (
                                <span
                                  className="
                                    rounded-full
                                    border
                                    border-red-200/20
                                    bg-red-400/10
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-black
                                    text-red-200
                                  "
                                >
                                  Missing API ID
                                </span>
                              )}
                            </div>

                            <div
                              className="
                                mt-3
                                flex
                                flex-wrap
                                items-center
                                gap-x-3
                                gap-y-1
                                text-xs
                                font-semibold
                                text-white/30
                              "
                            >
                              <span>
                                Source:{" "}
                                {getPriceSourceLabel(
                                  item.card
                                    .priceSource,
                                )}
                              </span>

                              <span
                                aria-hidden="true"
                              >
                                ·
                              </span>

                              <span>
                                {formatPriceTimestamp(
                                  item.card
                                    .priceUpdatedAt,
                                )}
                              </span>
                            </div>

                            <div
                              className="
                                mt-5
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
                                    tracking-[0.12em]
                                    text-white/35
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
                                      item.quantity ===
                                        0 ||
                                      isBusy(
                                        item.id,
                                      )
                                    }
                                    className="
                                      min-h-11
                                      border-r
                                      border-white/10
                                      text-xl
                                      font-black
                                      hover:bg-white/10
                                      disabled:opacity-25
                                    "
                                  >
                                    −
                                  </button>

                                  <span
                                    className="
                                      flex
                                      items-center
                                      justify-center
                                      text-lg
                                      font-black
                                    "
                                  >
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void changeQuantity(
                                        item,
                                        1,
                                      )
                                    }
                                    disabled={isBusy(
                                      item.id,
                                    )}
                                    className="
                                      min-h-11
                                      border-l
                                      border-white/10
                                      text-xl
                                      font-black
                                      hover:bg-white/10
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
                                    tracking-[0.12em]
                                    text-emerald-100/45
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
                                    stockValue,
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className="
                            border-t
                            border-white/[0.07]
                            bg-black/10
                            p-4
                          "
                        >
                          <div
                            className="
                              flex
                              flex-col
                              gap-3
                              sm:flex-row
                            "
                          >
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
                                      event
                                        .target
                                        .value,
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
                                void saveLocation(
                                  item,
                                )
                              }
                              disabled={
                                !locationChanged ||
                                isBusy(item.id)
                              }
                              className="
                                min-h-12
                                rounded-xl
                                bg-emerald-300
                                px-5
                                font-black
                                text-emerald-950
                                disabled:opacity-30
                              "
                            >
                              Save location
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void removeItem(
                                  item,
                                )
                              }
                              disabled={isBusy(
                                item.id,
                              )}
                              className="
                                min-h-12
                                rounded-xl
                                border
                                border-red-300/15
                                bg-red-500/[0.07]
                                px-5
                                font-black
                                text-red-200
                                hover:bg-red-500/15
                                disabled:opacity-40
                              "
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
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
                Stock reloads every minute ·
                External prices sync every 15
                minutes
              </p>

              <p>
                Manual values are labelled
                clearly in the catalogue
              </p>
            </footer>
          </section>
        </div>
      </main>

      {priceEditor && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-[#020617]/80
            px-4
            py-8
            backdrop-blur-xl
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-price-title"
        >
          <button
            type="button"
            onClick={() =>
              !savingManualPrice &&
              setPriceEditor(null)
            }
            className="
              absolute
              inset-0
              cursor-default
            "
            aria-label="Close manual value editor"
          />

          <form
            onSubmit={saveManualPrice}
            className="
              relative
              z-10
              w-full
              max-w-lg
              overflow-hidden
              rounded-[2.5rem]
              border
              border-amber-200/20
              bg-[#06251b]/95
              shadow-[0_40px_140px_rgba(0,0,0,0.65)]
              backdrop-blur-3xl
            "
          >
            <div
              className="
                h-1
                bg-gradient-to-r
                from-amber-300
                via-yellow-200
                to-orange-300
              "
            />

            <div className="p-6 md:p-8">
              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-5
                "
              >
                <div>
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.2em]
                      text-amber-200/55
                    "
                  >
                    Price override
                  </p>

                  <h2
                    id="manual-price-title"
                    className="
                      mt-2
                      text-3xl
                      font-black
                      tracking-tight
                      text-white
                    "
                  >
                    Alter card value
                  </h2>

                  <p
                    className="
                      mt-3
                      font-semibold
                      text-white/45
                    "
                  >
                    {priceEditor.cardName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPriceEditor(null)
                  }
                  disabled={
                    savingManualPrice
                  }
                  className="
                    flex
                    h-11
                    w-11
                    flex-none
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.06]
                    text-xl
                    text-white/55
                    transition
                    hover:bg-white/10
                    hover:text-white
                    disabled:opacity-40
                  "
                >
                  ×
                </button>
              </div>

              <div
                className="
                  mt-7
                  rounded-[1.5rem]
                  border
                  border-white/10
                  bg-black/20
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
                  <span
                    className="
                      text-sm
                      font-bold
                      text-white/40
                    "
                  >
                    Current value
                  </span>

                  <span
                    className="
                      text-lg
                      font-black
                      text-white
                    "
                  >
                    {formatCurrency(
                      priceEditor.currentValue,
                    )}
                  </span>
                </div>
              </div>

              <label
                htmlFor="manual-card-value"
                className="
                  mt-6
                  block
                  text-sm
                  font-black
                  text-white
                "
              >
                New market value
              </label>

              <div className="relative mt-3">
                <span
                  className="
                    pointer-events-none
                    absolute
                    left-5
                    top-1/2
                    -translate-y-1/2
                    text-xl
                    font-black
                    text-amber-200
                  "
                >
                  £
                </span>

                <input
                  id="manual-card-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  value={
                    priceEditor.value
                  }
                  onChange={(event) =>
                    setPriceEditor(
                      (current) =>
                        current
                          ? {
                              ...current,

                              value:
                                event
                                  .target
                                  .value,
                            }
                          : current,
                    )
                  }
                  placeholder="0.00"
                  disabled={
                    savingManualPrice
                  }
                  className="
                    min-h-16
                    w-full
                    rounded-2xl
                    border
                    border-white/15
                    bg-black/25
                    py-4
                    pl-12
                    pr-5
                    text-xl
                    font-black
                    text-white
                    outline-none
                    transition
                    placeholder:text-white/20
                    focus:border-amber-300/45
                    focus:shadow-[0_0_35px_rgba(252,211,77,0.1)]
                    disabled:opacity-50
                  "
                />
              </div>

              <div
                className="
                  mt-5
                  rounded-[1.5rem]
                  border
                  border-amber-200/15
                  bg-amber-300/[0.07]
                  px-5
                  py-4
                "
              >
                <p
                  className="
                    text-sm
                    font-semibold
                    leading-6
                    text-amber-50/65
                  "
                >
                  This value is stored as a
                  manual override. A later
                  live-price sync may replace it
                  when the provider starts
                  returning a price.
                </p>
              </div>

              <div
                className="
                  mt-7
                  flex
                  flex-col-reverse
                  gap-3
                  sm:flex-row
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setPriceEditor(null)
                  }
                  disabled={
                    savingManualPrice
                  }
                  className="
                    min-h-14
                    flex-1
                    rounded-2xl
                    border
                    border-white/15
                    bg-white/[0.06]
                    px-5
                    font-black
                    text-white
                    transition
                    hover:bg-white/10
                    disabled:opacity-40
                  "
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingManualPrice
                  }
                  className="
                    flex
                    min-h-14
                    flex-1
                    items-center
                    justify-center
                    gap-3
                    rounded-2xl
                    border
                    border-amber-100/30
                    bg-amber-300
                    px-5
                    font-black
                    text-amber-950
                    shadow-[0_0_35px_rgba(252,211,77,0.18)]
                    transition
                    hover:bg-amber-200
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {savingManualPrice ? (
                    <>
                      <span
                        className="
                          animate-spin
                        "
                      >
                        ◌
                      </span>

                      Saving value
                    </>
                  ) : (
                    <>
                      Save manual value
                      <span>✓</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  caption: string;
  icon: string;
  highlighted?: boolean;
};

function SummaryCard({
  label,
  value,
  caption,
  icon,
  highlighted = false,
}: SummaryCardProps) {
  return (
    <article
      className={`
        relative
        overflow-hidden
        rounded-[2.25rem]
        border
        p-6
        shadow-[0_25px_70px_rgba(0,0,0,0.25)]
        backdrop-blur-3xl
        ${
          highlighted
            ? `
              border-emerald-200/20
              bg-gradient-to-br
              from-emerald-300/15
              via-white/[0.07]
              to-cyan-300/5
            `
            : `
              border-white/15
              bg-white/[0.075]
            `
        }
      `}
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
        {icon}
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
        {label}
      </p>

      <p
        className={`
          mt-5
          text-4xl
          font-black
          ${
            highlighted
              ? "text-emerald-100"
              : "text-white"
          }
        `}
      >
        {value}
      </p>

      <p
        className="
          mt-3
          truncate
          text-sm
          text-white/45
        "
      >
        {caption}
      </p>
    </article>
  );
}

type StatusPanelProps = {
  label: string;
  value: string;
  accent?: boolean;
};

function StatusPanel({
  label,
  value,
  accent = false,
}: StatusPanelProps) {
  return (
    <div
      className={`
        rounded-[1.75rem]
        border
        px-5
        py-4
        backdrop-blur-2xl
        ${
          accent
            ? `
              border-cyan-200/15
              bg-cyan-300/[0.06]
            `
            : `
              border-white/10
              bg-black/15
            `
        }
      `}
    >
      <p
        className={`
          text-xs
          font-black
          uppercase
          tracking-[0.16em]
          ${
            accent
              ? "text-cyan-100/45"
              : "text-white/35"
          }
        `}
      >
        {label}
      </p>

      <p
        className={`
          mt-2
          font-black
          ${
            accent
              ? "text-cyan-100"
              : "text-white/80"
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

type FilterButtonProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

function FilterButton({
  active,
  onClick,
  children,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-xl
        border
        px-4
        py-2.5
        text-sm
        font-black
        transition
        ${
          active
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
      {children}
    </button>
  );
}