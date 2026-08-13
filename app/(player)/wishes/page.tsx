"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import NebuPortrait from "@/components/player/NebuPortrait";
import WishDetailsDialog from "@/components/player/WishDetailsDialog";
import { type WishRevealCard } from "@/components/player/WishCinematic";
import { primeWishAudio } from "@/components/player/wishAudio";
import { applyNebuSkin } from "@/lib/player/nebu";
import { supabase } from "@/lib/supabase";

const WishCinematic = dynamic(
  () => import("@/components/player/WishCinematic"),
  { ssr: false },
);

type WalletRow = {
  wish_balance: number | null;
  lifetime_wishes_spent: number | null;
};

type InventoryRow = {
  card_id: string | number;
  quantity: number | null;
  reserved_quantity: number | null;
};

type OrderRow = {
  amount_pence: number | null;
  status: string | null;
};

type WishPurchaseOrderRow = {
  amount_pence: number | null;
  status: string | null;
};

type WishRow = {
  id: string;
  card_id: string | number;
  market_value_at_wish: number | string | null;
  created_at: string;
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

type RecentWish = {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  imageUrl: string | null;
  valueAtWish: number;
  createdAt: string;
};


type WishReveal = {
  wishId: string;
  cardId: string;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  imageUrl: string | null;
  marketValue: number;
  wishBalance: number;
  cosmicIssueNumber: number | null;
  cosmicPreview?: boolean;
};

type NebuEntitlementsResponse = {
  ok?: boolean;
  cosmicPreviewAllowed?: boolean;
};

type DashboardData = {
  wishBalance: number;
  lifetimeWishesSpent: number;
  totalCards: number;
  availableCards: number;
  reservedCards: number;
  collectionValue: number;
  amountSpentPence: number;
  leaderboardScore: number;
  shippingThreshold: number;
  recentWishes: RecentWish[];
};

const EMPTY_DASHBOARD: DashboardData = {
  wishBalance: 0,
  lifetimeWishesSpent: 0,
  totalCards: 0,
  availableCards: 0,
  reservedCards: 0,
  collectionValue: 0,
  amountSpentPence: 0,
  leaderboardScore: 0,
  shippingThreshold: 100,
  recentWishes: [],
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatMarketValue(value: number): string {
  return value > 0 ? formatMoney(value) : "Price pending";
}

function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.max(0, Math.floor(value)));
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function WishesPage() {
  const replayHandledRef = useRef(false);
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [makingWish, setMakingWish] = useState(false);
  const [wishReveal, setWishReveal] = useState<WishReveal | null>(null);
  const [forceFullSequence, setForceFullSequence] = useState(false);
  const [wishDetailsOpen, setWishDetailsOpen] = useState(false);
  const [cosmicPreviewAllowed, setCosmicPreviewAllowed] = useState(false);

  const loadDashboard = useCallback(async (background = false) => {
    if (background) {
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
        throw new Error("Your trainer session has expired. Sign in again.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const previewAccessPromise = session?.access_token
        ? (async () => {
          try {
          const entitlementResponse = await fetch(
            "/api/player/nebu-entitlements",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            },
          );
          const entitlementPayload =
            (await entitlementResponse.json()) as NebuEntitlementsResponse;

          return entitlementResponse.ok &&
              entitlementPayload.ok === true &&
              entitlementPayload.cosmicPreviewAllowed === true;
          } catch {
            return false;
          }
        })()
        : Promise.resolve(false);

      const [
        walletResult,
        inventoryResult,
        ordersResult,
        wishPurchaseOrdersResult,
        wishesResult,
        shippingSettingsResult,
        previewAccess,
      ] = await Promise.all([
        supabase
          .from("player_wallets")
          .select("wish_balance,lifetime_wishes_spent")
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("player_inventory")
          .select("card_id,quantity,reserved_quantity")
          .eq("user_id", user.id),

        supabase
          .from("player_orders")
          .select("amount_pence,status")
          .eq("user_id", user.id)
          .eq("status", "paid"),

        supabase
          .from("wish_purchase_orders")
          .select("amount_pence,status")
          .eq("user_id", user.id)
          .eq("status", "paid"),

        supabase
          .from("player_wishes")
          .select("id,card_id,market_value_at_wish,created_at", {
            count: "exact",
          })
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("shipping_settings")
          .select("free_shipping_card_threshold")
          .eq("id", 1)
          .maybeSingle(),

        previewAccessPromise,
      ]);

      setCosmicPreviewAllowed(previewAccess);

      if (walletResult.error) {
        throw walletResult.error;
      }

      if (inventoryResult.error) {
        throw inventoryResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      // V15 originally revoked this table from authenticated players while
      // the dashboard still queried it. V16 fixes the RLS policy in SQL, but
      // the dashboard also degrades gracefully until that migration is run.
      const purchaseLedgerReadable = !wishPurchaseOrdersResult.error;

      if (wishesResult.error) {
        throw wishesResult.error;
      }

      if (shippingSettingsResult.error) {
        throw shippingSettingsResult.error;
      }

      const wallet = walletResult.data as unknown as WalletRow | null;

      const inventory =
        (inventoryResult.data as unknown as InventoryRow[] | null) || [];

      const orders =
        (ordersResult.data as unknown as OrderRow[] | null) || [];

      const wishPurchaseOrders = purchaseLedgerReadable
        ? (wishPurchaseOrdersResult.data as unknown as WishPurchaseOrderRow[] | null) || []
        : [];

      const recentWishRows =
        (wishesResult.data as unknown as WishRow[] | null) || [];

      const inventoryCardIds = inventory.map((item) => String(item.card_id));
      const recentWishCardIds = recentWishRows.map((item) =>
        String(item.card_id),
      );

      const allCardIds = Array.from(
        new Set([...inventoryCardIds, ...recentWishCardIds]),
      );

      let cards: CardRow[] = [];

      if (allCardIds.length > 0) {
        const cardsResult = await supabase
          .from("pokemon_cards")
          .select(
            "id,name,set_name,card_no,rarity,market_value,image_url",
          )
          .in("id", allCardIds);

        if (cardsResult.error) {
          throw cardsResult.error;
        }

        cards = (cardsResult.data as unknown as CardRow[] | null) || [];
      }

      const cardsById = new Map<string, CardRow>();

      for (const card of cards) {
        cardsById.set(String(card.id), card);
      }

      let totalCards = 0;
      let availableCards = 0;
      let reservedCards = 0;
      let collectionValue = 0;

      for (const item of inventory) {
        const quantity = toWholeNumber(item.quantity);
        const reserved = Math.min(
          quantity,
          toWholeNumber(item.reserved_quantity),
        );
        const card = cardsById.get(String(item.card_id));
        const cardValue = toNumber(card?.market_value);

        totalCards += quantity;
        reservedCards += reserved;
        availableCards += Math.max(0, quantity - reserved);
        collectionValue += quantity * cardValue;
      }

      const amountSpentPence =
        orders.reduce(
          (total, order) => total + toWholeNumber(order.amount_pence),
          0,
        ) +
        wishPurchaseOrders.reduce(
          (total, order) => total + toWholeNumber(order.amount_pence),
          0,
        );

      const totalWishCount = toWholeNumber(wishesResult.count);

      const leaderboardScore =
        Math.round(collectionValue * 100) +
        totalCards * 25 +
        totalWishCount * 10;

      const shippingThreshold = Math.max(
        1,
        toWholeNumber(
          (
            shippingSettingsResult.data as
              | { free_shipping_card_threshold?: unknown }
              | null
          )?.free_shipping_card_threshold,
        ) || 100,
      );

      const recentWishes: RecentWish[] = recentWishRows.map((wish) => {
        const card = cardsById.get(String(wish.card_id));

        return {
          id: wish.id,
          cardId: String(wish.card_id),
          cardName: card?.name?.trim() || "Mystery card",
          setName: card?.set_name?.trim() || "Unknown set",
          cardNumber: card?.card_no?.trim() || "-",
          rarity: card?.rarity?.trim() || "Unlisted rarity",
          imageUrl: card?.image_url?.trim() || null,
          valueAtWish: toNumber(wish.market_value_at_wish),
          createdAt: wish.created_at,
        };
      });

      const nextDashboard: DashboardData = {
        wishBalance: toWholeNumber(wallet?.wish_balance),
        lifetimeWishesSpent: Math.max(
          toWholeNumber(wallet?.lifetime_wishes_spent),
          totalWishCount,
        ),
        totalCards,
        availableCards,
        reservedCards,
        collectionValue,
        amountSpentPence,
        leaderboardScore,
        shippingThreshold,
        recentWishes,
      };

      setDashboard(nextDashboard);

      if (
        !background &&
        !replayHandledRef.current &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("replay") === "latest"
      ) {
        replayHandledRef.current = true;
        window.history.replaceState({}, "", "/wishes");

        const latest = recentWishes[0];

        if (latest) {
          setForceFullSequence(true);
          setWishReveal({
            wishId: latest.id,
            cardId: latest.cardId,
            cardName: latest.cardName,
            setName: latest.setName,
            cardNumber: latest.cardNumber,
            rarity: latest.rarity,
            imageUrl: latest.imageUrl,
            marketValue: latest.valueAtWish,
            wishBalance: nextDashboard.wishBalance,
            cosmicIssueNumber: null,
          });
        } else {
          setErrorMessage(
            "Make your first wish before replaying a pull cinematic.",
          );
        }
      }
    } catch (error: unknown) {
      console.error("Wishes dashboard error:", error);

      setErrorMessage(
        getErrorMessage(
          error,
          "Nebu could not load your trainer dashboard.",
        ),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadDashboard(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadDashboard]);

  const replayLatestWish = useCallback(() => {
    const latest = dashboard.recentWishes[0];

    if (!latest) {
      setErrorMessage(
        "Make your first wish before replaying a pull cinematic.",
      );
      return;
    }

    setErrorMessage(null);
    setForceFullSequence(true);
    setWishReveal({
      wishId: latest.id,
      cardId: latest.cardId,
      cardName: latest.cardName,
      setName: latest.setName,
      cardNumber: latest.cardNumber,
      rarity: latest.rarity,
      imageUrl: latest.imageUrl,
      marketValue: latest.valueAtWish,
      wishBalance: dashboard.wishBalance,
      cosmicIssueNumber: null,
    });
  }, [dashboard.recentWishes, dashboard.wishBalance]);

  const previewCosmicNebuPull = useCallback(() => {
    if (!cosmicPreviewAllowed) {
      return;
    }

    const latest = dashboard.recentWishes[0];

    void primeWishAudio();
    window.dispatchEvent(new Event("unown-pulls:close-more"));
    setWishDetailsOpen(false);
    setErrorMessage(null);
    setForceFullSequence(true);
    setWishReveal({
      wishId: "cosmic-nebu-founder-preview",
      cardId: latest?.cardId || "cosmic-nebu-preview",
      cardName: latest?.cardName || "Cosmic Nebu Awakening",
      setName: latest?.setName || "Ancient Pulls Founder Preview",
      cardNumber: latest?.cardNumber || "✦",
      rarity: latest?.rarity || "Crown Rare",
      imageUrl: latest?.imageUrl || null,
      marketValue: latest?.valueAtWish || 0,
      wishBalance: dashboard.wishBalance,
      cosmicIssueNumber: null,
      cosmicPreview: true,
    });
  }, [cosmicPreviewAllowed, dashboard.recentWishes, dashboard.wishBalance]);

  useEffect(() => {
    const handleReplayLatestWish = () => replayLatestWish();

    window.addEventListener(
      "pocketpulls:replay-latest-wish",
      handleReplayLatestWish,
    );

    return () => {
      window.removeEventListener(
        "pocketpulls:replay-latest-wish",
        handleReplayLatestWish,
      );
    };
  }, [replayLatestWish]);

  const makeWish = useCallback(async () => {
    if (makingWish || dashboard.wishBalance < 1) {
      return;
    }

    // Resume Web Audio while this direct player gesture is still active.
    // The reveal itself begins only after the server-authoritative wish returns.
    void primeWishAudio();
    window.dispatchEvent(new Event("unown-pulls:close-more"));
    setWishDetailsOpen(false);
    setForceFullSequence(false);
    setMakingWish(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("make_player_wish");

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || typeof row !== "object") {
        throw new Error("Nebu completed the wish, but the card reveal was missing.");
      }

      const result = row as Record<string, unknown>;
      const nextBalance = toWholeNumber(result.wish_balance);
      const wishId = String(result.wish_id ?? "");
      const cosmicDiscovery = wishId
        ? await supabase
            .from("cosmic_nebu_ownerships")
            .select("issue_number")
            .eq("discovery_pull_id", wishId)
            .maybeSingle()
        : { data: null, error: null };
      const cosmicIssueNumber = cosmicDiscovery.error
        ? 0
        : toWholeNumber(cosmicDiscovery.data?.issue_number);

      if (cosmicIssueNumber > 0) {
        applyNebuSkin("cosmic_nebu");
        void supabase.auth.updateUser({ data: { nebu_skin: "cosmic_nebu" } });
      }

      setWishReveal({
        wishId,
        cardId: String(result.card_id ?? ""),
        cardName: typeof result.name === "string" && result.name.trim() ? result.name.trim() : "Mystery card",
        setName: typeof result.set_name === "string" && result.set_name.trim() ? result.set_name.trim() : "Unknown set",
        cardNumber: typeof result.card_no === "string" && result.card_no.trim() ? result.card_no.trim() : "-",
        rarity: typeof result.rarity === "string" && result.rarity.trim() ? result.rarity.trim() : "Unlisted rarity",
        imageUrl: typeof result.image_url === "string" && result.image_url.trim() ? result.image_url.trim() : null,
        marketValue: toNumber(result.market_value),
        wishBalance: nextBalance,
        cosmicIssueNumber: cosmicIssueNumber > 0 ? cosmicIssueNumber : null,
      });

      window.dispatchEvent(
        new CustomEvent("pocketpulls:wish-balance", {
          detail: { wishBalance: nextBalance },
        }),
      );
    } catch (error: unknown) {
      console.error("Make wish error:", error);
      setErrorMessage(
        getErrorMessage(error, "Nebu could not complete that wish."),
      );
    } finally {
      setMakingWish(false);
    }
  }, [dashboard.wishBalance, makingWish]);

  const shippingProgress = useMemo(() => {
    return Math.min(
      100,
      Math.max(
        0,
        (dashboard.availableCards / dashboard.shippingThreshold) * 100,
      ),
    );
  }, [dashboard.availableCards, dashboard.shippingThreshold]);

  const cardsUntilShipping = Math.max(
    0,
    dashboard.shippingThreshold - dashboard.availableCards,
  );

  const cinematicCard = useMemo<WishRevealCard | null>(() => {
    if (!wishReveal) {
      return null;
    }

    return {
      id: wishReveal.wishId || wishReveal.cardId,
      name: wishReveal.cardName,
      rarity: wishReveal.rarity,
      imageUrl: wishReveal.imageUrl,
      setName: wishReveal.setName,
      cardNumber: wishReveal.cardNumber,
      marketValue: wishReveal.marketValue,
    };
  }, [wishReveal]);

  if (loading) {
    return <DashboardLoading />;
  }

  return (
    <section className="relative mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
            Nebu&apos;s Wish Sanctuary
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Make a Wish
          </h1>

          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
            Reveal genuine trading cards, grow your ancientpulls collection and recharge wishes whenever you want to keep the constellation moving.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard(true)}
          disabled={refreshing}
          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {refreshing ? "Refreshing..." : "Refresh dashboard"}
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-red-200/15 bg-red-400/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold leading-6 text-red-100">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => void loadDashboard(false)}
            className="min-h-10 flex-none rounded-xl bg-red-100 px-4 text-xs font-black text-red-950"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Wish balance"
          value={formatWholeNumber(dashboard.wishBalance)}
          detail="Ready to spend"
          accent="yellow"
        />

        <MetricCard
          label="Cards owned"
          value={formatWholeNumber(dashboard.totalCards)}
          detail={`${formatWholeNumber(dashboard.availableCards)} available`}
          accent="cyan"
        />

        <MetricCard
          label="Collection value"
          value={formatMoney(dashboard.collectionValue)}
          detail="Current catalogue value"
          accent="violet"
        />

        <MetricCard
          label="Amount spent"
          value={formatMoney(dashboard.amountSpentPence / 100)}
          detail="Completed purchases"
          accent="pink"
        />

        <MetricCard
          label="Trainer score"
          value={formatWholeNumber(dashboard.leaderboardScore)}
          detail="Collection and wish score"
          accent="emerald"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <WishChamber
          wishBalance={dashboard.wishBalance}
          totalWishes={dashboard.lifetimeWishesSpent}
          makingWish={makingWish}
          onMakeWish={() => void makeWish()}
          onShowDetails={() => setWishDetailsOpen(true)}
          cosmicPreviewAllowed={cosmicPreviewAllowed}
          onPreviewCosmicNebu={previewCosmicNebuPull}
        />

        <ShippingProgress
          availableCards={dashboard.availableCards}
          reservedCards={dashboard.reservedCards}
          threshold={dashboard.shippingThreshold}
          cardsUntilShipping={cardsUntilShipping}
          progress={shippingProgress}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <RecentWishes wishes={dashboard.recentWishes} />

        <QuickLinks />
      </div>

      <WishDetailsDialog
        open={wishDetailsOpen}
        onClose={() => setWishDetailsOpen(false)}
      />

      <WishCinematic
        open={Boolean(wishReveal)}
        card={cinematicCard}
        onFinished={() => {
          void loadDashboard(true);
        }}
        onWishAgain={() => {
          setWishReveal(null);
          setForceFullSequence(false);
          window.setTimeout(() => void makeWish(), 120);
        }}
        canWishAgain={Boolean(wishReveal && wishReveal.wishBalance > 0)}
        busy={makingWish}
        forceFullSequence={forceFullSequence}
        cosmicIssueNumber={wishReveal?.cosmicIssueNumber}
        cosmicPreview={wishReveal?.cosmicPreview === true}
        cosmicSourceSkin={
          wishReveal?.cosmicPreview
            ? "cosmic_nebu"
            : undefined
        }
        onClose={() => {
          setWishReveal(null);
          setForceFullSequence(false);
        }}
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "yellow" | "cyan" | "violet" | "pink" | "emerald";
}) {
  const accentClasses = {
    yellow: "border-yellow-200/15 from-yellow-200/[0.08]",
    cyan: "border-cyan-200/15 from-cyan-200/[0.08]",
    violet: "border-violet-200/15 from-violet-200/[0.08]",
    pink: "border-pink-200/15 from-pink-200/[0.08]",
    emerald: "border-emerald-200/15 from-emerald-200/[0.08]",
  }[accent];

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-gradient-to-br ${accentClasses} to-white/[0.02] p-5 backdrop-blur-xl`}
    >
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>

      <p className="mt-3 break-words text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold leading-5 text-white/35">
        {detail}
      </p>
    </article>
  );
}

function WishChamber({
  wishBalance,
  totalWishes,
  makingWish,
  onMakeWish,
  onShowDetails,
  cosmicPreviewAllowed,
  onPreviewCosmicNebu,
}: {
  wishBalance: number;
  totalWishes: number;
  makingWish: boolean;
  onMakeWish: () => void;
  onShowDetails: () => void;
  cosmicPreviewAllowed: boolean;
  onPreviewCosmicNebu: () => void;
}) {
  const hasWishes = wishBalance > 0;

  return (
    <article data-onboarding-target="wish" className="relative overflow-hidden rounded-[2rem] border border-yellow-200/15 bg-[#090b27]/85 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-200/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-violet-400/10 blur-[90px]" />

      <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
        <div className="relative flex h-44 w-full flex-none items-center justify-center md:w-52">
          <div className="absolute h-36 w-36 animate-pulse rounded-full bg-yellow-200/15 blur-3xl" />

          <div className="absolute h-40 w-40 animate-spin rounded-full border border-transparent border-r-cyan-100/30 border-t-yellow-100/70 [animation-duration:8s]" />

          <NebuPortrait
            alt=""
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="relative z-10 h-36 w-36 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]"
          />

          <span className="absolute text-8xl text-yellow-100/15">*</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-100/45">
              Wish chamber
            </p>
            <button
              type="button"
              onClick={onShowDetails}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.065] px-3.5 text-[0.62rem] font-black uppercase tracking-[0.11em] text-cyan-50/75 transition hover:border-cyan-100/30 hover:bg-cyan-100/[0.11] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              <span aria-hidden="true">✦</span>
              View prizes &amp; odds
            </button>
          </div>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
            {hasWishes ? "Nebu is ready." : "Your next wish is waiting."}
          </h2>

          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/45">
            {hasWishes
              ? `You have ${formatWholeNumber(wishBalance)} wish${
                  wishBalance === 1 ? "" : "es"
                } available. Spend one to reveal a real card from the ancientpulls stock pool.`
              : "Purchase or receive wish credits to open real cards from the ancientpulls stock pool."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {hasWishes ? (
              <button
                type="button"
                data-onboarding-action="make-wish"
                onClick={onMakeWish}
                disabled={makingWish}
                className="min-h-13 flex-1 rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {makingWish ? "Nebu is choosing..." : "Make 1 Wish ✦"}
              </button>
            ) : (
              <Link
                href="/wishes/shop"
                className="flex min-h-13 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:brightness-105"
              >
                Get Wishes
              </Link>
            )}

            <Link
              href={hasWishes ? "/wishes/shop" : "/catalogue"}
              className="flex min-h-13 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {hasWishes ? "Wish Shop" : "Browse the catalogue"}
            </Link>
          </div>

          {cosmicPreviewAllowed ? (
            <button
              type="button"
              onClick={onPreviewCosmicNebu}
              className="group relative mt-3 flex min-h-12 w-full items-center justify-center overflow-hidden rounded-xl border border-violet-200/25 bg-gradient-to-r from-violet-400/[0.16] via-cyan-300/[0.12] to-yellow-200/[0.12] px-5 text-sm font-black text-violet-50 transition hover:border-violet-100/45 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">✦ Preview Cosmic Nebu Pull</span>
            </button>
          ) : null}

          <p className="mt-4 text-xs font-semibold text-white/25">
            Lifetime wishes completed: {formatWholeNumber(totalWishes)}
          </p>
        </div>
      </div>
    </article>
  );
}

function ShippingProgress({
  availableCards,
  reservedCards,
  threshold,
  cardsUntilShipping,
  progress,
}: {
  availableCards: number;
  reservedCards: number;
  threshold: number;
  cardsUntilShipping: number;
  progress: number;
}) {
  const unlocked = availableCards >= threshold;

  return (
    <article className="rounded-[2rem] border border-cyan-200/15 bg-[#090b27]/85 p-6 backdrop-blur-xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/45">
            Free shipping
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            {unlocked ? "Shipping unlocked" : `${cardsUntilShipping} cards to go`}
          </h2>
        </div>

        <span className="rounded-full border border-cyan-100/15 bg-cyan-200/[0.07] px-3 py-1.5 text-xs font-black text-cyan-50">
          {formatWholeNumber(availableCards)} / {formatWholeNumber(threshold)}
        </span>
      </div>

      <div className="mt-7 h-4 overflow-hidden rounded-full border border-white/10 bg-black/25">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-200 transition-[width] duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SmallStat label="Available" value={availableCards} />
        <SmallStat label="Reserved" value={reservedCards} />
      </div>

      <Link
        href="/shipping"
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-200/[0.07] px-5 text-sm font-black text-cyan-50 transition hover:bg-cyan-200/10"
      >
        View shipping
      </Link>
    </article>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-white">
        {formatWholeNumber(value)}
      </p>
    </div>
  );
}

function RecentWishes({
  wishes,
}: {
  wishes: RecentWish[];
}) {
  return (
    <article className="rounded-[2rem] border border-violet-200/15 bg-[#090b27]/85 p-6 backdrop-blur-xl sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-100/45">
            Wish history
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Recent cards
          </h2>
        </div>

        <Link
          href="/collection"
          className="text-xs font-black text-violet-100/55 transition hover:text-white"
        >
          Full collection
        </Link>
      </div>

      {wishes.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-12 text-center">
          <p className="text-lg font-black text-white/65">
            No wishes completed yet
          </p>

          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-white/30">
            Your first opened card will appear here with its value, set and
            rarity.
          </p>
        </div>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishes.map((wish) => (
            <RecentWishCard key={wish.id} wish={wish} />
          ))}
        </div>
      )}
    </article>
  );
}

function RecentWishCard({
  wish,
}: {
  wish: RecentWish;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="relative aspect-[4/5] overflow-hidden bg-black/20">
        {wish.imageUrl ? (
          <img
            src={wish.imageUrl}
            alt={wish.cardName}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-yellow-100/20">
            *
          </div>
        )}

        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-[#07091f]/85 px-2.5 py-1 text-[0.58rem] font-black text-white/70 backdrop-blur-lg">
          {formatMarketValue(wish.valueAtWish)}
        </span>
      </div>

      <div className="p-4">
        <p className="truncate text-sm font-black text-white">
          {wish.cardName}
        </p>

        <p className="mt-1 truncate text-xs font-semibold text-white/35">
          {wish.setName} - {wish.cardNumber}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 text-[0.58rem] font-black uppercase tracking-[0.1em]">
          <span className="truncate text-violet-100/45">{wish.rarity}</span>
          <span className="flex-none text-white/25">
            {formatDate(wish.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

function QuickLinks() {
  const links = [
    {
      href: "/wishes/shop",
      title: "Wish Shop",
      detail: "Top up when you want more wishes — your current balance stays ready to use",
    },
    {
      href: "/catalogue",
      title: "Catalogue",
      detail: "Browse cards and values",
    },
    {
      href: "/collection",
      title: "Collection",
      detail: "See every card you own",
    },
    {
      href: "/leaderboard",
      title: "Leaderboard",
      detail: "Compare trainer scores",
    },
    {
      href: "/profile",
      title: "Profile",
      detail: "Choose your favourite card",
    },
    {
      href: "/achievements#nebu-wardrobe",
      title: "Customise Nebu",
      detail: "Change his colours with coats unlocked by badges",
    },
  ];

  return (
    <aside className="rounded-[2rem] border border-white/10 bg-[#090b27]/85 p-6 backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
        Explore
      </p>

      <div className="mt-5 space-y-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-violet-200/20 hover:bg-violet-300/[0.07]"
          >
            <p className="text-sm font-black text-white">{link.title}</p>
            <p className="mt-1 text-xs font-semibold text-white/30">
              {link.detail}
            </p>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function DashboardLoading() {
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="animate-pulse">
        <div className="h-3 w-40 rounded-full bg-yellow-100/10" />
        <div className="mt-5 h-12 w-72 max-w-full rounded-xl bg-white/[0.06]" />
        <div className="mt-4 h-5 w-[36rem] max-w-full rounded-full bg-white/[0.04]" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-32 rounded-2xl border border-white/5 bg-white/[0.035]"
            />
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="h-96 rounded-[2rem] border border-white/5 bg-white/[0.035]" />
          <div className="h-96 rounded-[2rem] border border-white/5 bg-white/[0.035]" />
        </div>
      </div>
    </section>
  );
}
