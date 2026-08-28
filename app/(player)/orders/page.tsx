"use client";

/* eslint-disable @next/next/no-img-element -- canonical card images use catalogue hosts */

import { useCallback, useEffect, useMemo, useState } from "react";

import ShippingCentre from "@/components/player/ShippingCentre";
import {
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";

type OrderCard = {
  wish_id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  card_no: string | null;
  rarity: string;
  image_url: string | null;
  pulled_at: string;
  fulfilment_status: string;
  card_finish: string;
  card_condition: string;
  card_language: string;
  shipment_id: string | null;
  shipment_status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  requested_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusInfo(card: OrderCard) {
  if (card.shipment_status === "delivered" || card.delivered_at) return ["Delivered", "text-emerald-200", 4];
  if (card.shipment_status === "shipped" || card.shipped_at) return ["On the way", "text-cyan-200", 3];
  if (card.shipment_status === "packing" || card.packed_at) return ["Being packed", "text-amber-200", 2];
  if (card.shipment_status === "requested" || card.requested_at) return ["Shipping requested", "text-violet-200", 1];
  if (card.fulfilment_status === "source_needed" || card.fulfilment_status === "source_requested") return ["Needs attention", "text-rose-200", 0];
  return ["Held safely", "text-emerald-200", 0];
}

export default function OrdersPage() {
  const [cards, setCards] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await supabase.rpc("get_player_order_timeline", { p_limit: 250 });
      if (result.error) throw result.error;
      setCards((result.data || []) as OrderCard[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your card-order history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const stats = useMemo(() => ({
    total: cards.length,
    held: cards.filter((card) => !card.shipment_id).length,
    active: new Set(cards.filter((card) => card.shipment_id && !card.delivered_at).map((card) => card.shipment_id)).size,
    delivered: cards.filter((card) => card.delivered_at || card.shipment_status === "delivered").length,
  }), [cards]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PlayerPageHeader eyebrow="Fulfilment" title="Cards & Orders" description="Choose cards for shipping, manage delivery details and track every physical order in one place." />

      {error ? <div className="mt-4"><PlayerErrorBanner message={error} /></div> : null}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlayerStatCard label="Cards won" value={String(stats.total)} detail="Exact physical results" />
        <PlayerStatCard label="Held safely" value={String(stats.held)} detail="Awaiting your request" accent="green" />
        <PlayerStatCard label="Active shipments" value={String(stats.active)} detail="Packing or in transit" accent="cyan" />
        <PlayerStatCard label="Delivered cards" value={String(stats.delivered)} detail="Completed fulfilment" accent="yellow" />
      </div>

      <div className="mt-8 border-t border-white/[0.08] pt-8">
        <ShippingCentre embedded />
      </div>

      <PlayerPanel className="mt-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100/40">Order archive</p>
          <h2 className="mt-2 text-xl font-black">Fulfilment timeline</h2>
          <p className="mt-1 text-xs font-semibold text-white/38">Server records, not the reveal animation, determine each result.</p>
        </div>

        {loading ? <div className="py-16 text-center font-black text-white/35">Loading your cards…</div> : null}
        {!loading && !cards.length ? <div className="py-16 text-center"><div className="text-3xl">✦</div><h3 className="mt-3 text-lg font-black">No completed wishes yet</h3><p className="mt-2 text-sm font-semibold text-white/35">Your exact card and fulfilment record will appear here.</p></div> : null}

        <div className="mt-5 space-y-3">
          {cards.map((card) => {
            const [label, tone, step] = statusInfo(card);
            return (
              <article key={card.wish_id} className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4">
                <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 sm:grid-cols-[78px_minmax(0,1fr)_auto]">
                  <div className="aspect-[63/88] overflow-hidden rounded-xl bg-white/5">{card.image_url ? <img src={card.image_url} alt={card.card_name} loading="lazy" className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-black sm:text-lg">{card.card_name}</h3><span className={`text-[10px] font-black uppercase ${tone}`}>{label}</span></div>
                    <p className="mt-1 truncate text-xs font-semibold text-white/42">{card.set_name} · {card.card_no || "No number"} · {card.rarity}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">{[readable(card.card_finish), readable(card.card_condition), card.card_language].map((value) => <span key={value} className="rounded-lg border border-white/10 bg-white/[.035] px-2 py-1 text-[10px] font-black text-white/55">{value}</span>)}</div>
                    <p className="mt-2 text-[10px] font-semibold text-white/30">Won {dateLabel(card.pulled_at)} · Wish {card.wish_id.slice(0, 8)}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 sm:w-48">
                    <div className="flex gap-1" aria-label={`Fulfilment progress: ${label}`}>{[1, 2, 3, 4].map((marker) => <span key={marker} className={`h-1.5 flex-1 rounded-full ${marker <= Number(step) ? "bg-cyan-200" : "bg-white/10"}`} />)}</div>
                    <div className="mt-2 text-[10px] font-semibold leading-4 text-white/38">{card.delivered_at ? `Delivered ${dateLabel(card.delivered_at)}` : card.shipped_at ? `Shipped ${dateLabel(card.shipped_at)}` : card.requested_at ? `Requested ${dateLabel(card.requested_at)}` : "Stored in your Ancient Pulls collection until you request shipping."}</div>
                    {card.tracking_url ? <a href={card.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-cyan-100 px-3 text-[10px] font-black text-cyan-950">Track parcel</a> : card.tracking_number ? <div className="mt-2 break-all text-[10px] font-black text-cyan-100/65">Tracking: {card.tracking_number}</div> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </PlayerPanel>
    </div>
  );
}
