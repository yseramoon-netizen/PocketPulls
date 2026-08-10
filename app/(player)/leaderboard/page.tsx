"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import styles from "./Leaderboard.module.css";

type LeaderboardRow = {
  rank_position: number | string | null;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_cards: number | string | null;
  unique_cards: number | string | null;
  collection_value: number | string | null;
  lifetime_wishes: number | string | null;
  score: number | string | null;
  is_current_user: boolean | null;
};

type LeaderboardPlayer = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalCards: number;
  uniqueCards: number;
  collectionValue: number;
  lifetimeWishes: number;
  score: number;
  isCurrentUser: boolean;
  cosmicIssueNumber: number | null;
};

function parseRows(value: unknown): LeaderboardPlayer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as LeaderboardRow[]).map((row) => ({
    rank: toWholeNumber(row.rank_position),
    userId: row.user_id || "",
    username: row.username?.trim() || "trainer",
    displayName:
      row.display_name?.trim() || "Star Trainer",
    avatarUrl: row.avatar_url?.trim() || null,
    totalCards: toWholeNumber(row.total_cards),
    uniqueCards: toWholeNumber(row.unique_cards),
    collectionValue: toNumber(row.collection_value),
    lifetimeWishes: toWholeNumber(
      row.lifetime_wishes,
    ),
    score: toWholeNumber(row.score),
    isCurrentUser: row.is_current_user === true,
    cosmicIssueNumber: null,
  }));
}

export default function LeaderboardPage() {
  const [players, setPlayers] =
    useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "get_player_leaderboard",
        {
          p_limit: 100,
        },
      );

      if (error) {
        throw error;
      }

      const parsed = parseRows(data);
      const { data: cosmicHolders, error: cosmicError } = await supabase.rpc(
        "get_public_cosmic_nebu_holders",
        { p_user_ids: parsed.map((player) => player.userId).filter(Boolean) },
      );
      const cosmicByUser = new Map<string, number>();
      if (!cosmicError && Array.isArray(cosmicHolders)) {
        for (const holder of cosmicHolders as Array<{ user_id?: unknown; issue_number?: unknown }>) {
          const userId = typeof holder.user_id === "string" ? holder.user_id : "";
          const issue = toWholeNumber(holder.issue_number);
          if (userId && issue > 0) cosmicByUser.set(userId, issue);
        }
      }
      setPlayers(parsed.map((player) => ({
        ...player,
        cosmicIssueNumber: cosmicByUser.get(player.userId) ?? null,
      })));
    } catch (error: unknown) {
      console.error("Leaderboard error:", error);
      setErrorMessage(
        getErrorMessage(
          error,
          "The trainer rankings could not be loaded.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadLeaderboard();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadLeaderboard]);

  const pharaoh = players[0] ?? null;
  const royalCourt = players.slice(1, 3);
  const nearestChallenger = players[1] ?? null;
  const currentPlayer = players.find(
    (player) => player.isCurrentUser,
  );

  const communityCards = useMemo(
    () =>
      players.reduce(
        (total, player) => total + player.totalCards,
        0,
      ),
    [players],
  );

  const communityWishes = useMemo(
    () =>
      players.reduce(
        (total, player) =>
          total + player.lifetimeWishes,
        0,
      ),
    [players],
  );

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="The trainers beneath the stars"
        title="Leaderboard"
        description="Rankings reward the whole journey: card value, physical cards, unique discoveries and completed wishes all contribute to the score."
        actions={
          <PlayerSecondaryButton
            onClick={() => void loadLeaderboard()}
          >
            Refresh rankings
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadLeaderboard()}
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlayerStatCard
          label="Ranked trainers"
          value={formatWholeNumber(players.length)}
          detail="Visible public profiles"
          accent="violet"
        />

        <PlayerStatCard
          label="Community cards"
          value={formatWholeNumber(communityCards)}
          detail="Across displayed trainers"
          accent="cyan"
        />

        <PlayerStatCard
          label="Community wishes"
          value={formatWholeNumber(communityWishes)}
          detail="Completed by displayed trainers"
          accent="yellow"
        />

        <PlayerStatCard
          label="Your rank"
          value={
            currentPlayer
              ? `#${formatWholeNumber(
                  currentPlayer.rank,
                )}`
              : "Unranked"
          }
          detail={
            currentPlayer
              ? `${formatWholeNumber(
                  currentPlayer.score,
                )} score`
              : "Complete a wish to begin"
          }
          accent="pink"
        />
      </div>

      {loading ? (
        <div className="mt-6 h-[36rem] animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]" />
      ) : players.length === 0 ? (
        <PlayerEmptyState
          title="No trainers have entered the rankings."
          description="The leaderboard will awaken after the first collection begins."
        />
      ) : (
        <>
          {pharaoh ? (
            <PharaohThrone
              player={pharaoh}
              scoreLead={Math.max(
                0,
                pharaoh.score -
                  (nearestChallenger?.score ?? 0),
              )}
              hasChallenger={nearestChallenger !== null}
            />
          ) : null}

          {royalCourt.length > 0 ? (
            <div className="mx-auto mt-4 grid w-full max-w-5xl items-stretch gap-4 sm:grid-cols-2">
              {royalCourt.map((player) => (
              <PodiumCard
                key={player.userId}
                player={player}
                placement={player.rank}
              />
              ))}
            </div>
          ) : null}

          <PlayerPanel className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
                  Full ranking
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Trainer standings
                </h2>
              </div>

              <p className="max-w-lg text-xs font-semibold leading-5 text-white/28">
                Score = collection value × 100 + physical
                cards × 25 + unique cards × 15 + wishes ×
                10.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-[0.58rem] font-black uppercase tracking-[0.14em] text-white/25">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Trainer</th>
                    <th className="px-6 py-4 text-right">
                      Cards
                    </th>
                    <th className="px-6 py-4 text-right">
                      Unique
                    </th>
                    <th className="px-6 py-4 text-right">
                      Value
                    </th>
                    <th className="px-6 py-4 text-right">
                      Wishes
                    </th>
                    <th className="px-6 py-4 text-right">
                      Score
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {players.map((player) => (
                    <LeaderboardTableRow
                      key={player.userId}
                      player={player}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </PlayerPanel>
        </>
      )}
    </section>
  );
}

function PharaohThrone({
  player,
  scoreLead,
  hasChallenger,
}: {
  player: LeaderboardPlayer;
  scoreLead: number;
  hasChallenger: boolean;
}) {
  return (
    <article
      className={`${styles.throne} mt-8`}
      aria-label={`${player.displayName}, current Pharaoh and number one ranked trainer`}
    >
      <div className={styles.rays} aria-hidden="true" />
      <div className={styles.horizon} aria-hidden="true" />
      <div className={styles.dust} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className={styles.royalRail} aria-hidden="true">
        <span>◆</span>
        <span>☥</span>
        <span>✦</span>
        <span>☥</span>
        <span>◆</span>
      </div>

      <div className={styles.throneContent}>
        <div className={styles.crownColumn}>
          <div className={styles.sunCrown} aria-hidden="true">
            <svg viewBox="0 0 160 92" role="presentation">
              <defs>
                <linearGradient id="pharaoh-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff4b0" />
                  <stop offset="0.42" stopColor="#f2c85b" />
                  <stop offset="1" stopColor="#9d6417" />
                </linearGradient>
              </defs>
              <circle cx="80" cy="26" r="20" fill="url(#pharaoh-gold)" />
              <path d="M80 48c-22 0-38 11-44 33h88c-6-22-22-33-44-33Z" fill="none" stroke="url(#pharaoh-gold)" strokeWidth="5" />
              <path d="M36 79 18 54l25 8M124 79l18-25-25 8" fill="none" stroke="url(#pharaoh-gold)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M62 51 49 24l25 18M98 51l13-27-25 18" fill="none" stroke="url(#pharaoh-gold)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.cartouche}>
            <div className={styles.avatarHalo} aria-hidden="true" />
            <div className={styles.avatarFrame}>
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt={`${player.displayName}'s avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {player.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className={styles.cartoucheStar} aria-hidden="true">
              ✦
            </span>
          </div>

          <div className={styles.seal}>
            <span aria-hidden="true">☥</span>
            The Pharaoh
            <span aria-hidden="true">☥</span>
          </div>
        </div>

        <div className={styles.reignColumn}>
          <p className={styles.eyebrow}>The throne beneath the stars</p>
          <h2 className={styles.pharaohName}>{player.displayName}</h2>
          <p className={styles.username}>@{player.username}</p>
          {player.cosmicIssueNumber ? (
            <p className={styles.cosmicRecord}>✦ COSMIC NEBU #{String(player.cosmicIssueNumber).padStart(6, "0")}</p>
          ) : null}

          <p className={styles.proclamation}>
            Crowned above every trainer. Each wish, discovery and card
            has built a dynasty no challenger has yet surpassed.
          </p>

          <div className={styles.royalStats}>
            <RoyalStat
              label="Dynasty score"
              value={formatWholeNumber(player.score)}
              featured
            />
            <RoyalStat
              label="Wishes commanded"
              value={formatWholeNumber(player.lifetimeWishes)}
            />
            <RoyalStat
              label="Royal treasury"
              value={formatMoney(player.collectionValue)}
            />
            <RoyalStat
              label="Relics held"
              value={formatWholeNumber(player.totalCards)}
            />
          </div>

          <div className={styles.reignRecord}>
            <span className={styles.recordIcon} aria-hidden="true">✦</span>
            <span>
              {hasChallenger
                ? scoreLead > 0
                  ? `${formatWholeNumber(scoreLead)} points beyond the nearest challenger`
                  : "The crown is being fiercely contested"
                : "The first dynasty has begun"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.inscription} aria-hidden="true">
        <span>✦</span>
        <span>THE STARS REMEMBER THE ONE WHO ROSE ABOVE ALL</span>
        <span>✦</span>
      </div>
    </article>
  );
}

function RoyalStat({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`${styles.royalStat} ${
        featured ? styles.royalStatFeatured : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PodiumCard({
  player,
  placement,
}: {
  player: LeaderboardPlayer;
  placement: number;
}) {
  const accents = {
    2: "border-cyan-100/20 bg-cyan-200/[0.055]",
    3: "border-pink-100/18 bg-pink-200/[0.045]",
  };

  return (
    <PlayerPanel
      className={`${
        accents[placement as 2 | 3] ?? accents[3]
      } p-6 text-center`}
    >
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-3xl font-black text-white">
        {placement === 2 ? "✦" : "◆"}
      </div>

      <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-violet-300/10 text-2xl font-black text-white">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          player.displayName.charAt(0).toUpperCase()
        )}
      </div>

      <p className="mt-4 text-[0.6rem] font-black uppercase tracking-[0.15em] text-white/28">
        Rank #{placement}
      </p>

      <h2 className="mt-2 truncate text-xl font-black text-white">
        {player.displayName}
      </h2>

      <p className="mt-1 truncate text-xs font-bold text-violet-100/38">
        @{player.username}
      </p>

      <p className="mt-5 text-2xl font-black text-yellow-50">
        {formatWholeNumber(player.score)}
      </p>

      <p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.13em] text-white/25">
        ranking score
      </p>
    </PlayerPanel>
  );
}

function LeaderboardTableRow({
  player,
}: {
  player: LeaderboardPlayer;
}) {
  return (
    <tr
      className={`border-b border-white/[0.055] text-sm ${
        player.rank === 1
          ? "border-y border-yellow-100/30 bg-yellow-200/[0.07] shadow-[inset_0_1px_0_rgba(253,230,138,0.12),inset_0_-1px_0_rgba(253,230,138,0.12)]"
          : player.isCurrentUser
          ? "bg-violet-300/[0.08]"
          : "hover:bg-white/[0.025]"
      }`}
    >
      <td className="px-6 py-4">
        <span className="font-black text-white">
          #{player.rank}
        </span>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.05] text-xs font-black text-white">
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              player.displayName
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate font-black text-white">
              {player.displayName}
              {player.rank === 1 ? (
                <span className="ml-2 rounded-full border border-yellow-100/30 bg-yellow-200/10 px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.12em] text-yellow-50">
                  Pharaoh
                </span>
              ) : null}
              {player.cosmicIssueNumber ? (
                <span className="ml-2 rounded-full border border-cyan-100/30 bg-cyan-200/10 px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.12em] text-cyan-50">
                  ✦ Cosmic #{String(player.cosmicIssueNumber).padStart(6, "0")}
                </span>
              ) : null}
              {player.isCurrentUser ? (
                <span className="ml-2 text-[0.55rem] uppercase tracking-[0.1em] text-yellow-100/50">
                  You
                </span>
              ) : null}
            </p>

            <p className="truncate text-xs font-bold text-white/28">
              @{player.username}
            </p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 text-right font-bold text-white/55">
        {formatWholeNumber(player.totalCards)}
      </td>

      <td className="px-6 py-4 text-right font-bold text-white/55">
        {formatWholeNumber(player.uniqueCards)}
      </td>

      <td className="px-6 py-4 text-right font-bold text-white/55">
        {formatMoney(player.collectionValue)}
      </td>

      <td className="px-6 py-4 text-right font-bold text-white/55">
        {formatWholeNumber(player.lifetimeWishes)}
      </td>

      <td className="px-6 py-4 text-right font-black text-yellow-50">
        {formatWholeNumber(player.score)}
      </td>
    </tr>
  );
}
