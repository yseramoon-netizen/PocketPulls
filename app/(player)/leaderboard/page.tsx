"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

import styles from "./Leaderboard.module.css";

const MAX_VISIBLE_RANKS = 100;
const MAX_VISIBLE_GALAXIES = MAX_VISIBLE_RANKS - 1;
const GOLDEN_ANGLE = 137.507764 * (Math.PI / 180);

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

type GalaxyPlacement = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
  z: number;
  size: number;
  hue: number;
  tilt: number;
  delay: number;
  duration: number;
  zIndex: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseRows(value: unknown): LeaderboardPlayer[] {
  if (!Array.isArray(value)) return [];

  return (value as LeaderboardRow[])
    .map((row) => ({
      rank: toWholeNumber(row.rank_position),
      userId: row.user_id || "",
      username: row.username?.trim() || "trainer",
      displayName: row.display_name?.trim() || "Star Trainer",
      avatarUrl: row.avatar_url?.trim() || null,
      totalCards: toWholeNumber(row.total_cards),
      uniqueCards: toWholeNumber(row.unique_cards),
      collectionValue: toNumber(row.collection_value),
      lifetimeWishes: toWholeNumber(row.lifetime_wishes),
      score: toWholeNumber(row.score),
      isCurrentUser: row.is_current_user === true,
      cosmicIssueNumber: null,
    }))
    .filter((player) => player.rank > 0 && player.rank <= MAX_VISIBLE_RANKS)
    .sort((first, second) => first.rank - second.rank)
    .slice(0, MAX_VISIBLE_RANKS);
}

function buildGalaxyPlacements(players: readonly LeaderboardPlayer[]): GalaxyPlacement[] {
  const galaxyPlayers = players
    .filter((player) => player.rank >= 2)
    .slice(0, MAX_VISIBLE_GALAXIES);
  const maximumCards = Math.max(1, ...galaxyPlayers.map((player) => player.totalCards));
  let previousSize = 72;

  return galaxyPlayers.map((player, index) => {
    const progress = clamp((player.rank - 2) / (MAX_VISIBLE_RANKS - 2), 0, 1);
    const rankProximity = 1 - progress;
    const cardScale = Math.sqrt(player.totalCards / maximumCards);
    const desiredSize = 19 + rankProximity ** 0.68 * 43 + cardScale * 7;
    const size = clamp(Math.min(previousSize - 0.24, desiredSize), 18, 70);
    previousSize = size;

    const hash = hashString(`${player.userId}:${player.rank}`);
    const angle = index * GOLDEN_ANGLE + ((hash % 29) - 14) * 0.006;
    const radius = 15.5 + 30.5 * progress ** 0.62;

    return {
      player,
      x: 50 + Math.cos(angle) * radius * 1.02,
      y: 50 + Math.sin(angle) * radius * 0.8,
      z: Math.round(145 - progress * 390),
      size,
      hue: (196 + (hash % 152)) % 360,
      tilt: -27 + (hash % 55),
      delay: -(hash % 900) / 100,
      duration: 6.8 + (hash % 52) / 10,
      zIndex: Math.round(220 - progress * 120),
    };
  });
}

export default function LeaderboardPage() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltFrameRef = useRef<number | null>(null);
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_player_leaderboard", {
        p_limit: MAX_VISIBLE_RANKS,
      });
      if (error) throw error;

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

      const nextPlayers = parsed.map((player) => ({
        ...player,
        cosmicIssueNumber: cosmicByUser.get(player.userId) ?? null,
      }));
      setPlayers(nextPlayers);
      setSelectedPlayer((current) =>
        current
          ? nextPlayers.find((player) => player.userId === current.userId) ?? null
          : null,
      );
    } catch (error: unknown) {
      console.error("Living ranks error:", error);
      setErrorMessage(getErrorMessage(error, "The living ranks could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadLeaderboard());
    return () => window.cancelAnimationFrame(frame);
  }, [loadLeaderboard]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setInfoPanelOpen(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => {
    if (tiltFrameRef.current !== null) window.cancelAnimationFrame(tiltFrameRef.current);
  }, []);

  const placements = useMemo(() => buildGalaxyPlacements(players), [players]);
  const pharaoh = players.find((player) => player.rank === 1) ?? null;
  const currentPlayer = players.find((player) => player.isCurrentUser) ?? null;
  const communityCards = useMemo(
    () => players.reduce((total, player) => total + player.totalCards, 0),
    [players],
  );
  const communityWishes = useMemo(
    () => players.reduce((total, player) => total + player.lifetimeWishes, 0),
    [players],
  );

  const updateSceneTilt = useCallback((x: number, y: number) => {
    if (tiltFrameRef.current !== null) window.cancelAnimationFrame(tiltFrameRef.current);
    tiltFrameRef.current = window.requestAnimationFrame(() => {
      tiltFrameRef.current = null;
      const scene = sceneRef.current;
      if (!scene) return;
      scene.style.setProperty("--ranks-rotate-x", `${y * -3.8}deg`);
      scene.style.setProperty("--ranks-rotate-y", `${x * 5.2}deg`);
    });
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    updateSceneTilt(
      clamp((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5, -0.5, 0.5),
      clamp((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5, -0.5, 0.5),
    );
  }, [updateSceneTilt]);

  return (
    <section className={styles.page}>
      <h1 className="sr-only">Living Ranks</h1>
      <div className={styles.deepSpace} aria-hidden="true" />
      <div className={styles.starVeil} aria-hidden="true" />
      <div className={styles.nebulaLeft} aria-hidden="true" />
      <div className={styles.nebulaRight} aria-hidden="true" />

      {infoPanelOpen ? (
        <aside className={styles.infoPanel} aria-label="Living ranks information">
          <div className={styles.panelHeading}>
            <div className={styles.panelCopy}>
              <p>Ancient Pulls</p>
              <h2>Living Ranks</h2>
              <span>The strongest collections bend the sky around them.</span>
            </div>
            <div className={styles.panelActions}>
              <button type="button" onClick={() => void loadLeaderboard(true)} disabled={refreshing}>
                {refreshing ? "Reading…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => setInfoPanelOpen(false)}
                aria-label="Hide living ranks information"
                title="Hide information"
              >
                ×
              </button>
            </div>
          </div>
          <div className={styles.statsGrid}>
            <RankStat label="Ranked" value={loading ? "—" : formatWholeNumber(players.length)} />
            <RankStat label="Cards" value={loading ? "—" : formatWholeNumber(communityCards)} />
            <RankStat label="Wishes" value={loading ? "—" : formatWholeNumber(communityWishes)} />
            <RankStat
              label="Your orbit"
              value={loading ? "—" : currentPlayer ? `#${currentPlayer.rank}` : "Unranked"}
            />
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setInfoPanelOpen(true)}
          className={styles.infoButton}
          aria-label="Show living ranks information"
        >
          <span aria-hidden="true">✦</span>
          Show info
        </button>
      )}

      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void loadLeaderboard(true)}>Try again</button>
        </div>
      ) : null}

      <div
        className={styles.spaceViewport}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => updateSceneTilt(0, 0)}
      >
        {loading ? (
          <div className={styles.loadingState}>
            <span />
            <p>Mapping the living ranks</p>
          </div>
        ) : players.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <h2>The ranked universe is waiting.</h2>
            <p>The first collection will form its centre.</p>
          </div>
        ) : (
          <div ref={sceneRef} className={styles.spaceScene}>
            <div className={styles.depthRingOne} aria-hidden="true" />
            <div className={styles.depthRingTwo} aria-hidden="true" />
            <div className={styles.depthRingThree} aria-hidden="true" />

            {placements.map((placement) => (
              <Galaxy
                key={placement.player.userId || `rank-${placement.player.rank}`}
                placement={placement}
                selected={selectedPlayer?.userId === placement.player.userId}
                onSelect={() => setSelectedPlayer(placement.player)}
              />
            ))}

            {pharaoh ? (
              <BlackHole
                player={pharaoh}
                selected={selectedPlayer?.userId === pharaoh.userId}
                onSelect={() => setSelectedPlayer(pharaoh)}
              />
            ) : null}
          </div>
        )}
      </div>

      {!loading && players.length > 0 ? (
        <p className={styles.sceneHint}>Select a galaxy to inspect its trainer</p>
      ) : null}

      {selectedPlayer ? (
        <RankDetails player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}

      <ol className="sr-only">
        {players.map((player) => (
          <li key={`accessible-${player.userId || player.rank}`}>
            Rank {player.rank}: {player.displayName}, {player.totalCards} cards
          </li>
        ))}
      </ol>
    </section>
  );
}

function Galaxy({
  placement,
  selected,
  onSelect,
}: {
  placement: GalaxyPlacement;
  selected: boolean;
  onSelect: () => void;
}) {
  const { player } = placement;
  const style = {
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    zIndex: placement.zIndex,
    "--galaxy-size": `${placement.size}px`,
    "--galaxy-mobile-size": `${Math.max(16, placement.size * 0.76)}px`,
    "--galaxy-z": `${placement.z}px`,
    "--galaxy-hue": String(placement.hue),
    "--galaxy-tilt": `${placement.tilt}deg`,
    "--galaxy-delay": `${placement.delay}s`,
    "--galaxy-duration": `${placement.duration}s`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`${styles.galaxyAnchor} ${selected ? styles.selectedGalaxy : ""} ${player.isCurrentUser ? styles.currentGalaxy : ""}`}
      style={style}
      onClick={onSelect}
      aria-label={`Rank ${player.rank}, ${player.displayName}, ${player.totalCards} cards`}
      aria-pressed={selected}
    >
      <span className={styles.galaxyFloat}>
        <span className={styles.galaxyDisc} />
        <span className={styles.galaxyDust} />
        <span className={styles.galaxyCore} />
      </span>
      <span className={styles.galaxyRank}>#{player.rank}</span>
      <span className={styles.galaxyName}>{player.displayName}</span>
    </button>
  );
}

function BlackHole({
  player,
  selected,
  onSelect,
}: {
  player: LeaderboardPlayer;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.blackHoleAnchor} ${selected ? styles.selectedBlackHole : ""}`}
      onClick={onSelect}
      aria-label={`${player.displayName}, rank 1 and current Pharaoh`}
      aria-pressed={selected}
    >
      <span className={styles.blackHoleFloat}>
        <span className={styles.accretionOuter} />
        <span className={styles.accretionInner} />
        <span className={styles.photonRing} />
        <span className={styles.eventHorizon} />
        <span className={styles.gravityLens} />
      </span>
      <span className={styles.pharaohLabel}>
        <small>#1 · The Pharaoh</small>
        <strong>{player.displayName}</strong>
      </span>
    </button>
  );
}

function RankStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rankStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RankDetails({
  player,
  onClose,
}: {
  player: LeaderboardPlayer;
  onClose: () => void;
}) {
  return (
    <aside className={styles.rankDetails} aria-label={`${player.displayName} rank details`}>
      <div className={styles.detailHeading}>
        <div className={styles.detailIdentity}>
          <div className={styles.detailAvatar}>
            {player.avatarUrl ? (
              <img src={player.avatarUrl} alt="" />
            ) : (
              player.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p>{player.rank === 1 ? "The Pharaoh" : `Living rank #${player.rank}`}</p>
            <h2>{player.displayName}</h2>
            <span>@{player.username}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close rank details">×</button>
      </div>

      {player.cosmicIssueNumber ? (
        <div className={styles.cosmicBadge}>
          ✦ Cosmic Nebu #{String(player.cosmicIssueNumber).padStart(6, "0")}
        </div>
      ) : null}

      <div className={styles.detailGrid}>
        <RankStat label="Cards" value={formatWholeNumber(player.totalCards)} />
        <RankStat label="Unique" value={formatWholeNumber(player.uniqueCards)} />
        <RankStat label="Wishes" value={formatWholeNumber(player.lifetimeWishes)} />
        <RankStat label="Value" value={formatMoney(player.collectionValue)} />
      </div>
      <div className={styles.scoreLine}>
        <span>Dynasty score</span>
        <strong>{formatWholeNumber(player.score)}</strong>
      </div>
    </aside>
  );
}
