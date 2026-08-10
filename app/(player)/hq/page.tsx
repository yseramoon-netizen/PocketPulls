"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import NebuPortrait from "@/components/player/NebuPortrait";
import UnownText from "@/components/player/UnownText";
import {
  modernisePlayerCopy,
  normaliseDisplayGlyph,
} from "@/lib/player/display";
import { formatMarketValue } from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

type TrainerHqData = {
  trainerName: string;
  wishBalance: number;
  totalCards: number;
  uniqueCards: number;
  availableCards: number;
  collectionValue: number;
  shippingThreshold: number;
  shippingUnlocked: boolean;
  shipmentStatus: string | null;
  shipmentCardCount: number;
  shipmentTrackingUrl: string | null;
  zodiacSign: string | null;
  constellationStars: number;
  pendingFriendRequests: number;
  activeTrades: number;
  tradeNeedsAttention: boolean;
  attentionTradePartner: string | null;
  profileComplete: boolean;
  firstWishComplete: boolean;
  recentWishId: string | null;
  recentCardId: string | null;
  recentCardName: string | null;
  recentCardSet: string | null;
  recentCardNumber: string | null;
  recentCardRarity: string | null;
  recentCardImageUrl: string | null;
  recentCardValue: number;
  recentWishAt: string | null;
  recommendedActionId: string;
  recommendedActionTitle: string;
  recommendedActionBody: string;
  recommendedActionHref: string;
  recommendedActionGlyph: string;
};

const REFRESH_EVENTS = [
  "pocketpulls:wish-balance",
  "pocketpulls:achievement-reward-claimed",
  "pocketpulls:profile-updated",
  "pocketpulls:friendship-updated",
  "pocketpulls:trade-updated",
  "pocketpulls:shipping-updated",
] as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function whole(value: unknown): number {
  return Math.floor(number(value));
}

function parseHqData(value: unknown): TrainerHqData | null {
  const item = Array.isArray(value) ? value[0] : value;

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const row = item as Record<string, unknown>;

  return {
    trainerName: text(row.trainer_name, "Trainer"),
    wishBalance: whole(row.wish_balance),
    totalCards: whole(row.total_cards),
    uniqueCards: whole(row.unique_cards),
    availableCards: whole(row.available_cards),
    collectionValue: number(row.collection_value),
    shippingThreshold: Math.max(1, whole(row.shipping_threshold) || 100),
    shippingUnlocked: row.shipping_unlocked === true,
    shipmentStatus: nullableText(row.shipment_status),
    shipmentCardCount: whole(row.shipment_card_count),
    shipmentTrackingUrl: nullableText(row.shipment_tracking_url),
    zodiacSign: nullableText(row.zodiac_sign),
    constellationStars: whole(row.constellation_stars),
    pendingFriendRequests: whole(row.pending_friend_requests),
    activeTrades: whole(row.active_trades),
    tradeNeedsAttention: row.trade_needs_attention === true,
    attentionTradePartner: nullableText(row.attention_trade_partner),
    profileComplete: row.profile_complete === true,
    firstWishComplete: row.first_wish_complete === true,
    recentWishId: nullableText(row.recent_wish_id),
    recentCardId: nullableText(row.recent_card_id),
    recentCardName: nullableText(row.recent_card_name),
    recentCardSet: nullableText(row.recent_card_set),
    recentCardNumber: nullableText(row.recent_card_number),
    recentCardRarity: nullableText(row.recent_card_rarity),
    recentCardImageUrl: nullableText(row.recent_card_image_url),
    recentCardValue: number(row.recent_card_value),
    recentWishAt: nullableText(row.recent_wish_at),
    recommendedActionId: text(row.recommended_action_id, "wish"),
    recommendedActionTitle: modernisePlayerCopy(text(
      row.recommended_action_title,
      "Make another wish",
    )),
    recommendedActionBody: modernisePlayerCopy(text(
      row.recommended_action_body,
      "Add another card to your constellation.",
    )),
    recommendedActionHref: text(row.recommended_action_href, "/wishes"),
    recommendedActionGlyph: normaliseDisplayGlyph(row.recommended_action_glyph),
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.floor(value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "No pulls yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently revealed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function zodiacLabel(sign: string | null): string {
  if (!sign) return "Not chosen";
  return sign.charAt(0).toUpperCase() + sign.slice(1);
}

function shipmentLabel(status: string | null): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "packing":
      return "Being packed";
    case "shipped":
      return "On the way";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return "No active shipment";
  }
}

export default function TrainerHqPage() {
  const [data, setData] = useState<TrainerHqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHq = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data: result, error } = await supabase.rpc(
      "get_player_trainer_hq",
    );

    if (error) {
      console.error("Trainer HQ could not load:", error);
      setErrorMessage(
        "Trainer HQ could not read your archive. Run the new Supabase file, then try again.",
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const parsed = parseHqData(result);

    if (!parsed) {
      setErrorMessage("Trainer HQ returned no player data.");
    } else {
      setData(parsed);
      setErrorMessage(null);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadHq();
    });

    const refresh = () => void loadHq(true);

    window.addEventListener("focus", refresh);
    REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refresh);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("focus", refresh);
      REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, refresh);
      });
    };
  }, [loadHq]);

  const shippingProgress = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, (data.availableCards / data.shippingThreshold) * 100);
  }, [data]);

  if (loading && !data) {
    return <TrainerHqLoading />;
  }

  if (!data) {
    return (
      <section className="mx-auto flex min-h-[70dvh] w-full max-w-2xl items-center px-4 py-12">
        <div className="w-full rounded-[2rem] border border-red-200/15 bg-red-400/[0.07] p-7 text-center">
          <p className="text-3xl">✧</p>
          <h1 className="mt-4 text-2xl font-black text-white">
            Trainer HQ is waiting for its archive link
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/70">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => void loadHq()}
            className="mt-6 min-h-11 rounded-xl bg-red-100 px-5 text-sm font-black text-red-950"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="sr-only">Trainer HQ</h1>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/45">
            The centre of your archive
          </p>
          <div className="mt-3">
            <UnownText text="Trainer HQ" size="2.65rem" tone="holo" />
          </div>
          <p className="mt-4 text-base font-semibold text-white/48">
            {greeting()}, {data.trainerName}. Everything waiting for you is in
            one place.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadHq(true)}
          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-40"
        >
          {refreshing ? "Reading the stars…" : "Refresh HQ"}
        </button>
      </header>

      {errorMessage ? (
        <div className="mt-6 rounded-xl border border-red-200/15 bg-red-400/[0.07] px-4 py-3 text-sm font-bold text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.28fr_0.72fr]">
        <article className="group relative min-h-[25rem] overflow-hidden rounded-[2.35rem] border border-yellow-100/22 bg-[#090b2a]/92 shadow-[0_32px_100px_rgba(0,0,0,0.48)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_25%,rgba(250,204,21,0.15),transparent_29%),radial-gradient(circle_at_15%_92%,rgba(103,232,249,0.12),transparent_35%),linear-gradient(135deg,rgba(124,58,237,0.11),transparent_56%)]" />
          <div className="absolute -right-12 top-4 h-72 w-72 rounded-full border border-dashed border-yellow-100/15 transition duration-1000 group-hover:rotate-12" data-pocketpulls-ambient="heavy" />
          <div className="absolute right-10 top-24 h-44 w-44 rounded-full bg-yellow-200/10 blur-3xl" data-pocketpulls-ambient="heavy" />

          <div className="relative flex min-h-[25rem] flex-col p-6 sm:p-8 lg:p-10">
            <div className="max-w-2xl">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-100/50">
                Recommended now
              </p>
              <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-100/25 bg-yellow-200/[0.1] text-2xl text-yellow-50 shadow-[0_0_35px_rgba(250,204,21,0.1)]">
                {data.recommendedActionGlyph}
              </div>
              <h2 className="mt-5 max-w-xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                {data.recommendedActionTitle}
              </h2>
              <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/52 sm:text-base">
                {data.recommendedActionBody}
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:items-center">
              <Link
                href={data.recommendedActionHref}
                className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-6 text-sm font-black text-[#111329] shadow-[0_16px_45px_rgba(103,232,249,0.12)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Continue your journey →
              </Link>
              <span className="text-xs font-bold text-white/28">
                Chosen from your live account activity
              </span>
            </div>

            <NebuPortrait
              alt=""
              draggable={false}
              data-pocketpulls-ambient="heavy"
              className="pointer-events-none absolute -bottom-7 right-2 hidden w-52 object-contain opacity-100 lg:block"
            />
          </div>
        </article>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            glyph="✦"
            label="Wishes"
            value={formatNumber(data.wishBalance)}
            detail="Ready to pull"
            tone="yellow"
            href="/wishes"
          />
          <MetricCard
            glyph="▣"
            label="Cards"
            value={formatNumber(data.totalCards)}
            detail={`${formatNumber(data.uniqueCards)} unique`}
            tone="cyan"
            href="/collection"
          />
          <MetricCard
            glyph="£"
            label="Collection"
            value={formatMoney(data.collectionValue)}
            detail="Catalogue value"
            tone="violet"
            href="/collection"
          />
          <MetricCard
            glyph="✧"
            label="Stars"
            value={formatNumber(data.constellationStars)}
            detail={zodiacLabel(data.zodiacSign)}
            tone="pink"
            href="/constellation"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.86fr_0.86fr]">
        <RecentPull data={data} />

        <ActivityPanel data={data} />

        <ProgressPanel data={data} shippingProgress={shippingProgress} />
      </div>

      <nav
        aria-label="Trainer HQ quick actions"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["/wishes", "✦", "Make a wish", "Reveal your next card"],
          ["/collection", "▣", "Open Binder", "Browse every owned card"],
          ["/friends", "♢", "Trainer circle", "Friends and requests"],
          ["/shipping", "S", "Shipping", "Cards and delivery status"],
        ].map(([href, glyph, title, detail]) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-20 items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 transition hover:-translate-y-0.5 hover:border-cyan-100/20 hover:bg-white/[0.06]"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-lg font-black text-cyan-50">
              {glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white">{title}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-white/32">
                {detail}
              </span>
            </span>
            <span className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-cyan-100/60">
              →
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function MetricCard({
  glyph,
  label,
  value,
  detail,
  tone,
  href,
}: {
  glyph: string;
  label: string;
  value: string;
  detail: string;
  tone: "yellow" | "cyan" | "violet" | "pink";
  href: string;
}) {
  const tones = {
    yellow: "border-yellow-100/18 from-yellow-200/[0.09] text-yellow-50",
    cyan: "border-cyan-100/18 from-cyan-200/[0.09] text-cyan-50",
    violet: "border-violet-100/18 from-violet-200/[0.09] text-violet-50",
    pink: "border-pink-100/18 from-pink-200/[0.09] text-pink-50",
  };

  return (
    <Link
      href={href}
      className={`group flex min-h-[11.8rem] flex-col rounded-[1.65rem] border bg-gradient-to-br ${tones[tone]} to-transparent p-4 transition hover:-translate-y-0.5 hover:brightness-110 sm:p-5`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-lg font-black">
        {glyph}
      </span>
      <p className="mt-auto text-[0.61rem] font-black uppercase tracking-[0.16em] text-white/34">
        {label}
      </p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-white/32">
        {detail}
      </p>
    </Link>
  );
}

function RecentPull({ data }: { data: TrainerHqData }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/88">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
        <div>
          <p className="text-[0.61rem] font-black uppercase tracking-[0.17em] text-violet-100/40">
            Latest star
          </p>
          <h2 className="mt-1 text-lg font-black text-white">Most recent pull</h2>
        </div>
        {data.recentWishId ? (
          <Link
            href="/wishes?replay=latest"
            className="rounded-xl border border-yellow-100/15 bg-yellow-200/[0.06] px-3 py-2 text-xs font-black text-yellow-50/70 transition hover:bg-yellow-200/[0.1] hover:text-yellow-50"
          >
            Replay
          </Link>
        ) : null}
      </div>

      {data.recentWishId ? (
        <div className="grid min-h-64 grid-cols-[8rem_1fr] gap-5 p-5 sm:grid-cols-[10rem_1fr]">
          <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-2">
            {data.recentCardImageUrl ? (
              <img
                src={data.recentCardImageUrl}
                alt={data.recentCardName || "Recent card"}
                loading="lazy"
                className="max-h-56 w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)]"
              />
            ) : (
              <span className="text-4xl text-yellow-100/32">✦</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col py-1">
            <p className="text-[0.61rem] font-black uppercase tracking-[0.15em] text-cyan-100/40">
              {data.recentCardRarity}
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {data.recentCardName}
            </h3>
            <p className="mt-2 text-sm font-semibold text-white/38">
              {data.recentCardSet} · {data.recentCardNumber}
            </p>
            <p className="mt-4 text-lg font-black text-yellow-50">
              {formatMarketValue(data.recentCardValue)}
            </p>
            <p className="mt-auto pt-4 text-xs font-bold text-white/25">
              Revealed {formatDate(data.recentWishAt)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center p-7 text-center">
          <span className="text-5xl text-yellow-100/30">✦</span>
          <h3 className="mt-4 text-lg font-black text-white">
            Your first star is waiting
          </h3>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-white/35">
            Make a wish and your newest card will appear here.
          </p>
        </div>
      )}
    </article>
  );
}

function ActivityPanel({ data }: { data: TrainerHqData }) {
  const items = [
    {
      href: "/wishes/shop",
      glyph: "✦",
      title: "Nebu’s Vault of Stars",
      detail: "One daily login star after launch",
      ready: false,
    },
    {
      href: "/friends",
      glyph: "♢",
      title: "Friend requests",
      detail: data.pendingFriendRequests
        ? `${data.pendingFriendRequests} waiting for you`
        : "Nothing pending",
      ready: data.pendingFriendRequests > 0,
    },
    {
      href: "/trade",
      glyph: "⇄",
      title: "Active trades",
      detail: data.tradeNeedsAttention
        ? `${data.attentionTradePartner || "A trainer"} needs your response`
        : `${data.activeTrades} currently active`,
      ready: data.tradeNeedsAttention,
    },
    {
      href: "/shipping",
      glyph: "S",
      title: "Shipping",
      detail: shipmentLabel(data.shipmentStatus),
      ready: data.shipmentStatus === "shipped",
    },
  ];

  return (
    <article className="rounded-[2rem] border border-cyan-200/15 bg-[#090b27]/88 p-5">
      <p className="text-[0.61rem] font-black uppercase tracking-[0.17em] text-cyan-100/40">
        Live activity
      </p>
      <h2 className="mt-1 text-lg font-black text-white">Waiting for you</h2>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:border-cyan-100/18 hover:bg-white/[0.055]"
          >
            <span className="relative flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-base font-black text-cyan-50">
              {item.glyph}
              {item.ready ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#090b27] bg-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.7)]" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white/78">
                {item.title}
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-white/30">
                {item.detail}
              </span>
            </span>
            <span className="text-white/22 transition group-hover:translate-x-0.5 group-hover:text-cyan-100/60">
              →
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function ProgressPanel({
  data,
  shippingProgress,
}: {
  data: TrainerHqData;
  shippingProgress: number;
}) {
  return (
    <article className="rounded-[2rem] border border-yellow-200/15 bg-[#090b27]/88 p-5">
      <p className="text-[0.61rem] font-black uppercase tracking-[0.17em] text-yellow-100/40">
        Archive progress
      </p>
      <h2 className="mt-1 text-lg font-black text-white">Your next milestones</h2>

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-white/72">Free shipping</p>
            <p className="mt-1 text-[0.68rem] font-semibold text-white/28">
              {data.availableCards} of {data.shippingThreshold} available cards
            </p>
          </div>
          <span className="text-sm font-black text-yellow-50">
            {Math.round(shippingProgress)}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-200 to-violet-300 transition-[width] duration-700"
            style={{ width: `${shippingProgress}%` }}
          />
        </div>
      </div>

      <Link
        href={data.zodiacSign ? "/constellation" : "/profile"}
        className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:bg-white/[0.055]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-100/15 bg-violet-200/[0.06] text-lg text-violet-50">
          ✧
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black text-white/72">
            {zodiacLabel(data.zodiacSign)} constellation
          </span>
          <span className="mt-1 block text-[0.68rem] font-semibold text-white/28">
            {data.constellationStars} card star{data.constellationStars === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-white/25">→</span>
      </Link>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SmallMilestone label="Profile" complete={data.profileComplete} />
        <SmallMilestone label="First wish" complete={data.firstWishComplete} />
      </div>
    </article>
  );
}

function SmallMilestone({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3">
      <p className="text-[0.66rem] font-black uppercase tracking-[0.1em] text-white/32">
        {label}
      </p>
      <p className={`mt-1 text-xs font-black ${complete ? "text-emerald-100" : "text-yellow-100"}`}>
        {complete ? "Complete ✓" : "In progress"}
      </p>
    </div>
  );
}

function TrainerHqLoading() {
  return (
    <section className="mx-auto w-full max-w-[1600px] animate-pulse px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-4 w-40 rounded bg-white/[0.06]" />
      <div className="mt-4 h-12 w-72 rounded-xl bg-white/[0.07]" />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="h-[25rem] rounded-[2.35rem] border border-white/[0.06] bg-white/[0.035]" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="min-h-[11.8rem] rounded-[1.65rem] border border-white/[0.06] bg-white/[0.03]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
