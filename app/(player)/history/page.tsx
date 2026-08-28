"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CardArtwork,
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerLoadingCards,
  PlayerPageHeader,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
  RarityPill,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatDateTime,
  formatMarketValue,
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";

type HistoryRow = {
  wish_id: string | number | null;
  card_id: string | number | null;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  image_url: string | null;
  value_at_wish: number | string | null;
  current_market_value: number | string | null;
  created_at: string | null;
  total_count: number | string | null;
};

type WishMemory = {
  id: string;
  cardId: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  imageUrl: string | null;
  valueAtWish: number;
  currentMarketValue: number;
  createdAt: string | null;
};

type SortOption =
  | "newest"
  | "oldest"
  | "value_desc"
  | "value_asc";

const PAGE_SIZE = 30;

function parseRows(value: unknown): {
  memories: WishMemory[];
  totalCount: number;
} {
  if (!Array.isArray(value)) {
    return {
      memories: [],
      totalCount: 0,
    };
  }

  const rows = value as HistoryRow[];

  return {
    memories: rows.map((row) => ({
      id: String(row.wish_id ?? ""),
      cardId: String(row.card_id ?? ""),
      name: row.name?.trim() || "Mystery card",
      setName: row.set_name?.trim() || "Unknown set",
      cardNumber: row.card_no?.trim() || null,
      rarity: row.rarity?.trim() || "Common",
      imageUrl: row.image_url?.trim() || null,
      valueAtWish: toNumber(row.value_at_wish),
      currentMarketValue: toNumber(
        row.current_market_value,
      ),
      createdAt: row.created_at,
    })),
    totalCount:
      rows.length > 0
        ? toWholeNumber(rows[0]?.total_count)
        : 0,
  };
}

export default function HistoryPage() {
  const searchTimerRef = useRef<number | null>(null);

  const [memories, setMemories] = useState<WishMemory[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const hasFilters =
    search.length > 0 ||
    rarity.length > 0 ||
    sort !== "newest";

  const loadHistory = useCallback(
    async (background = false) => {
      if (background) {
        setFiltering(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const { data, error } = await supabase.rpc(
          "get_player_wish_history",
          {
            p_search: search,
            p_rarity: rarity,
            p_sort: sort,
            p_page: page,
            p_page_size: PAGE_SIZE,
          },
        );

        if (error) {
          throw error;
        }

        const parsed = parseRows(data);
        setMemories(parsed.memories);
        setTotalCount(parsed.totalCount);
      } catch (error: unknown) {
        console.error("Wish history error:", error);
        setErrorMessage(
          getErrorMessage(
            error,
            "Your wish history could not be loaded.",
          ),
        );
        setMemories([]);
      } finally {
        setLoading(false);
        setFiltering(false);
      }
    },
    [search, rarity, sort, page],
  );

  useEffect(() => {
    void loadHistory(false);
  }, [loadHistory]);

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

  const totalOriginalValue = memories.reduce(
    (total, memory) => total + memory.valueAtWish,
    0,
  );

  const totalCurrentValue = memories.reduce(
    (total, memory) =>
      total + memory.currentMarketValue,
    0,
  );

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Nebu remembers"
        title="Wish History"
        description="Search every completed wish."
        actions={
          <>
            <Link
              href="/constellation"
              className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Open constellation
            </Link>

            <PlayerSecondaryButton
              onClick={() => void loadHistory(true)}
            >
              Refresh history
            </PlayerSecondaryButton>
          </>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadHistory(false)}
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <PlayerStatCard
          label="Wishes found"
          value={formatWholeNumber(totalCount)}
          detail="Matching the current view"
          accent="violet"
        />

        <PlayerStatCard
          label="Value when pulled"
          value={formatMoney(totalOriginalValue)}
          detail="For cards on this page"
          accent="yellow"
        />

        <PlayerStatCard
          label="Current value"
          value={formatMoney(totalCurrentValue)}
          detail="Latest catalogue reference"
          accent="cyan"
        />
      </div>

      <PlayerPanel className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(15rem,1.5fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
          <input
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
            placeholder="Search card, set or number..."
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white outline-none placeholder:text-white/25"
          />

          <input
            type="text"
            value={rarity}
            onChange={(event) => {
              setRarity(event.target.value);
              setPage(1);
            }}
            placeholder="Exact rarity or leave blank"
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white outline-none placeholder:text-white/25"
          />

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortOption);
              setPage(1);
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-[#101331] px-4 text-sm font-bold text-white/75"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="value_desc">
              Highest value
            </option>
            <option value="value_asc">
              Lowest value
            </option>
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4">
          <span className="text-xs font-bold text-white/30">
            Page {page} of {totalPages}
          </span>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setRarity("");
                setSort("newest");
                setPage(1);
              }}
              className="text-xs font-black uppercase tracking-[0.1em] text-cyan-100/50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </PlayerPanel>

      {loading ? (
        <PlayerLoadingCards count={18} />
      ) : memories.length === 0 ? (
        <PlayerEmptyState
          title={
            hasFilters
              ? "No memories match that search."
              : "Your first wish is still ahead."
          }
          description={
            hasFilters
              ? "Try another card name, set, rarity or ordering."
              : "The moment Nebu grants your first card, it will be recorded here forever."
          }
          action={
            <Link
              href="/wishes"
              className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#e7ad46] via-[#48d5ca] to-[#d84f78] px-5 text-sm font-black text-[#111329]"
            >
              Visit the Wish Chamber
            </Link>
          }
        />
      ) : (
        <>
          <div
            className={`mt-6 grid gap-4 transition-opacity md:grid-cols-2 xl:grid-cols-3 ${
              filtering ? "opacity-45" : "opacity-100"
            }`}
          >
            {memories.map((memory, index) => (
              <WishMemoryCard
                key={memory.id}
                memory={memory}
                number={
                  (page - 1) * PAGE_SIZE + index + 1
                }
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span className="text-xs font-bold text-white/30">
              {formatWholeNumber(totalCount)} memories
            </span>

            <div className="flex gap-2">
              <PlayerSecondaryButton
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                disabled={page <= 1}
              >
                Previous
              </PlayerSecondaryButton>

              <PlayerSecondaryButton
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
                disabled={page >= totalPages}
              >
                Next
              </PlayerSecondaryButton>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function WishMemoryCard({
  memory,
  number,
}: {
  memory: WishMemory;
  number: number;
}) {
  const change =
    memory.currentMarketValue - memory.valueAtWish;

  return (
    <article className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 rounded-2xl border border-white/10 bg-[#090b27]/82 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.18)] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <CardArtwork
        name={memory.name}
        imageUrl={memory.imageUrl}
        rarity={memory.rarity}
        className="aspect-[0.716] rounded-xl border border-white/[0.08]"
      />

      <div className="min-w-0 py-1">
        <div className="flex items-start justify-between gap-3">
          <RarityPill rarity={memory.rarity} />

          <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/20">
            Wish #{number}
          </span>
        </div>

        <h2 className="mt-3 truncate text-lg font-black text-white">
          {memory.name}
        </h2>

        <p className="mt-1 truncate text-xs font-semibold text-white/32">
          {memory.setName}
          {memory.cardNumber
            ? ` · #${memory.cardNumber}`
            : ""}
        </p>

        <p className="mt-3 text-xs font-bold text-white/28">
          {formatDateTime(memory.createdAt)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
          <MemoryValue
            label="Then"
            value={formatMarketValue(memory.valueAtWish)}
          />

          <MemoryValue
            label="Now"
            value={formatMarketValue(memory.currentMarketValue)}
            detail={
              change === 0
                ? "No change"
                : `${change > 0 ? "+" : ""}${formatMoney(
                    change,
                  )}`
            }
          />
        </div>
      </div>
    </article>
  );
}

function MemoryValue({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/20">
        {label}
      </p>

      <p className="mt-1 text-xs font-black text-white/72">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 text-[0.58rem] font-bold text-cyan-100/35">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
