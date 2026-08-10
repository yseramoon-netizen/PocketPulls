"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { InfoCallout, TrustShell } from "@/components/player/TrustShell";
import { supabase } from "@/lib/supabase";

type OddsRow = {
  rarity: string | null;
  cards_in_pool: number | string | null;
  chance_percent: number | string | null;
};

type ParsedOdds = {
  rarity: string;
  cards: number;
  chance: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatChance(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

function oneIn(value: number): string {
  if (value <= 0) return "—";
  return `1 in ${(100 / value).toFixed(value < 1 ? 0 : 1)}`;
}

export default function OddsPage() {
  const [rows, setRows] = useState<ParsedOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: oddsError } = await supabase.rpc("get_player_wish_odds");

    if (oddsError) {
      setError("Live odds could not be loaded right now.");
      setLoading(false);
      return;
    }

    const parsed = (Array.isArray(data) ? data : [])
      .map((row) => row as OddsRow)
      .map((row) => ({
        rarity: row.rarity?.trim() || "Other",
        cards: Math.max(0, Math.floor(toNumber(row.cards_in_pool))),
        chance: Math.max(0, toNumber(row.chance_percent)),
      }))
      .filter((row) => row.cards > 0 && row.chance > 0);

    setRows(parsed);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalCards = useMemo(
    () => rows.reduce((sum, row) => sum + row.cards, 0),
    [rows],
  );

  return (
    <TrustShell
      eyebrow="Live odds"
      title="Rarity odds stay controlled as the catalogue grows."
      intro="A rarity tier is selected first. A card is then selected from the enabled cards inside that tier. Warehouse quantity does not change the rarity odds."
    >
      <InfoCallout title="Why this matters">
        Adding thousands of Common cards does not make Common dominate the draw. The configured rarity chance stays the same; only the chance of each individual card inside that rarity changes.
      </InfoCallout>

      <InfoCallout title="Catalogue vs physical stock" tone="yellow">
        A summonable card may already be physically held by ancientpulls or may be sourced after it is pulled and a shipment is requested. This does not change its summon chance.
      </InfoCallout>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-white/70">
          {loading ? "Reading the summon pool..." : `${totalCards.toLocaleString("en-GB")} summonable card designs`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          Refresh odds
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200/15 bg-red-300/[0.06] p-4 text-sm font-bold text-red-50/75">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] bg-white/[0.045] px-4 py-3 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/32">
            <span>Rarity</span>
            <span className="text-right">Cards</span>
            <span className="text-right">Chance</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.rarity}
              className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center border-t border-white/[0.07] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{row.rarity}</p>
                <p className="mt-1 text-[0.68rem] font-semibold text-white/28">Approx. {oneIn(row.chance)} per wish</p>
              </div>
              <span className="text-right text-sm font-bold text-white/48">{row.cards.toLocaleString("en-GB")}</span>
              <span className="text-right text-sm font-black text-cyan-50/80">{formatChance(row.chance)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-xs font-semibold leading-6 text-white/30">
        The reveal animation does not reroll or alter the result. It only reveals the card already allocated by the server.
      </p>
    </TrustShell>
  );
}
