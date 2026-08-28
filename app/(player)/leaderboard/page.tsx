"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import GalaxyConstellationDialog from "@/components/player/GalaxyConstellationDialog";
import NebulaMark from "@/components/player/NebulaMark";
import NebulaUniverse, {
  type NebulaUniversePlayer,
} from "@/components/player/NebulaUniverse";
import {
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import usePlayerPreferences from "@/components/player/usePlayerPreferences";
import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import {
  getNebulaProgress,
  getNebulaRank,
  getRelativeNebulaScale,
  NEBULA_RANKS,
  PRIME_NEBULA_NAME,
  type NebulaRank,
} from "@/lib/player/nebula-ranks";
import { supabase } from "@/lib/supabase";

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
  cosmic_issue_number: number | string | null;
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
  if (!Array.isArray(value)) return [];

  return (value as LeaderboardRow[]).map((row) => ({
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
    cosmicIssueNumber:
      toWholeNumber(row.cosmic_issue_number) > 0
        ? toWholeNumber(row.cosmic_issue_number)
        : null,
  }));
}

function playerInitial(player: LeaderboardPlayer): string {
  return player.displayName.charAt(0) || player.username.charAt(0) || "T";
}

function rankName(player: LeaderboardPlayer): string {
  return player.rank === 1 ? PRIME_NEBULA_NAME : getNebulaRank(player.score).name;
}

function rankStyle(rank: NebulaRank, extra?: CSSProperties): CSSProperties {
  return {
    "--rank-primary": rank.primary,
    "--rank-secondary": rank.secondary,
    ...extra,
  } as CSSProperties;
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [selectedGalaxy, setSelectedGalaxy] =
    useState<NebulaUniversePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const preferences = usePlayerPreferences();

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_nebula_universe", {
        p_limit: 100,
      });

      if (error) throw error;
      setPlayers(parseRows(data));
    } catch (error: unknown) {
      console.error("Nebula Atlas error:", error);
      setErrorMessage(
        getErrorMessage(error, "The Nebula Atlas could not be loaded."),
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

  const primeNebula = players[0] ?? null;
  const neighbouringGiants = players.slice(1, 3);
  const currentPlayer = players.find((player) => player.isCurrentUser) ?? null;
  const largestMass = primeNebula?.score ?? 0;

  const atlasMass = useMemo(
    () => players.reduce((total, player) => total + player.score, 0),
    [players],
  );
  const universePlayers = useMemo<NebulaUniversePlayer[]>(
    () =>
      players.map((player) => ({
        rank: player.rank,
        userId: player.userId,
        username: player.username,
        displayName: player.displayName,
        score: player.score,
        isCurrentUser: player.isCurrentUser,
        cosmicIssueNumber: player.cosmicIssueNumber,
      })),
    [players],
  );
  const reducedUniverseMotion =
    preferences.reducedMotion ||
    preferences.lowVisualEffects ||
    preferences.dataSaver;
  const openConstellation = useCallback((player: NebulaUniversePlayer) => {
    setSelectedGalaxy(player);
  }, []);

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Ancient Pulls Universe"
        title="The Living Universe"
        description="Every trainer is a galaxy. The greatest mass bends the rest into orbit."
        actions={
          <PlayerSecondaryButton onClick={() => void loadLeaderboard()}>
            Refresh universe
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadLeaderboard()}
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlayerStatCard
          label="Known galaxies"
          value={formatWholeNumber(players.length)}
          detail="Public worlds in this universe"
          accent="violet"
        />
        <PlayerStatCard
          label="Universe mass"
          value={formatWholeNumber(atlasMass)}
          detail="Combined stellar mass"
          accent="cyan"
        />
        <PlayerStatCard
          label="Strongest gravity"
          value={primeNebula ? PRIME_NEBULA_NAME : "Unformed"}
          detail={primeNebula ? primeNebula.displayName : "Awaiting first light"}
          accent="yellow"
        />
        <PlayerStatCard
          label="Your galaxy"
          value={currentPlayer ? rankName(currentPlayer) : "Uncharted"}
          detail={
            currentPlayer
              ? `Orbit #${formatWholeNumber(currentPlayer.rank)}`
              : "Complete a wish to form it"
          }
          accent="pink"
        />
      </div>

      {loading ? (
        <div className="mt-6 h-[38rem] animate-pulse rounded-[2rem] border border-white/[0.07] bg-white/[0.025]" />
      ) : players.length === 0 ? (
        <PlayerEmptyState
          title="The Universe is still dark."
          description="Its first galaxy will form when a trainer begins collecting."
        />
      ) : (
        <>
          <NebulaUniverse
            players={universePlayers}
            reducedMotion={reducedUniverseMotion}
            onOpenConstellation={openConstellation}
          />

          {currentPlayer ? <CurrentNebulaProgress player={currentPlayer} /> : null}

          <NebulaClassAtlas currentPlayer={currentPlayer} />

          {neighbouringGiants.length > 0 ? (
            <section className={styles.giantsSection} aria-labelledby="nearby-giants-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p>Nearest formations</p>
                  <h2 id="nearby-giants-title">The neighbouring giants</h2>
                </div>
                <span>Still within reach of the Prime Nebula</span>
              </div>

              <div className={styles.giantsGrid}>
                {neighbouringGiants.map((player) => (
                  <NebulaPodiumCard
                    key={player.userId}
                    player={player}
                    largestMass={largestMass}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <PlayerPanel className={`${styles.atlasPanel} mt-6 overflow-hidden`}>
            <div className={styles.atlasHeader}>
              <div>
                <p>Universe records</p>
                <h2>All known galaxies</h2>
              </div>
              <p>
                Stellar mass combines collection value, owned cards, unique
                discoveries and completed wishes.
              </p>
            </div>

            <div className={styles.desktopAtlas}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Orbit</th>
                    <th scope="col">Formation</th>
                    <th scope="col">Trainer</th>
                    <th scope="col">Cards</th>
                    <th scope="col">Value</th>
                    <th scope="col">Wishes</th>
                    <th scope="col">Stellar mass</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <NebulaTableRow key={player.userId} player={player} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileAtlas}>
              {players.map((player) => (
                <NebulaMobileRow key={player.userId} player={player} />
              ))}
            </div>
          </PlayerPanel>

          <GalaxyConstellationDialog
            player={selectedGalaxy}
            reducedMotion={reducedUniverseMotion}
            onClose={() => setSelectedGalaxy(null)}
          />
        </>
      )}
    </section>
  );
}

function CurrentNebulaProgress({ player }: { player: LeaderboardPlayer }) {
  const progress = getNebulaProgress(player.score);
  const title = player.rank === 1 ? PRIME_NEBULA_NAME : progress.rank.name;
  const style = rankStyle(progress.rank, {
    "--rank-progress": `${Math.round(progress.progress * 100)}%`,
  } as CSSProperties);

  return (
    <article className={styles.currentNebula} style={style}>
      <NebulaMark
        rank={progress.rank}
        avatarUrl={player.avatarUrl}
        initials={playerInitial(player)}
        label={`Your ${title}`}
        current
      />

      <div className={styles.currentIdentity}>
        <p>Your formation</p>
        <h2>{title}</h2>
        <span>{progress.rank.epithet}</span>
      </div>

      <div className={styles.progressColumn}>
        <div className={styles.progressLabels}>
          <span>{formatWholeNumber(player.score)} mass</span>
          <span>
            {progress.nextRank
              ? `${formatWholeNumber(progress.massRemaining)} to ${progress.nextRank.name}`
              : "Maximum class reached"}
          </span>
        </div>
        <div className={styles.progressTrack} aria-label={`${Math.round(progress.progress * 100)}% towards the next nebula class`}>
          <span />
        </div>
      </div>

      <div className={styles.currentOrbit}>
        <span>Universe orbit</span>
        <strong>#{formatWholeNumber(player.rank)}</strong>
      </div>
    </article>
  );
}

function NebulaClassAtlas({
  currentPlayer,
}: {
  currentPlayer: LeaderboardPlayer | null;
}) {
  const currentRank = currentPlayer ? getNebulaRank(currentPlayer.score) : null;

  return (
    <section className={styles.classAtlas} aria-labelledby="nebula-classes-title">
      <div className={styles.sectionHeading}>
        <div>
          <p>Permanent progression</p>
          <h2 id="nebula-classes-title">Nebula classes</h2>
        </div>
        <span>Grow through nine formations; only Atlas position can be lost.</span>
      </div>

      <div className={styles.classRail}>
        {NEBULA_RANKS.map((rank, index) => {
          const active = currentRank?.key === rank.key;
          const reached = currentPlayer ? currentPlayer.score >= rank.minimumMass : false;
          return (
            <div
              key={rank.key}
              className={styles.classItem}
              data-active={active ? "true" : "false"}
              data-reached={reached ? "true" : "false"}
              style={rankStyle(rank)}
            >
              <span className={styles.classOrb} aria-hidden="true" />
              <span className={styles.classNumber}>{String(index + 1).padStart(2, "0")}</span>
              <strong>{rank.name}</strong>
              <small>{formatWholeNumber(rank.minimumMass)} mass</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NebulaPodiumCard({
  player,
  largestMass,
}: {
  player: LeaderboardPlayer;
  largestMass: number;
}) {
  const formation = getNebulaRank(player.score);

  return (
    <article
      className={styles.giantCard}
      style={rankStyle(formation)}
      data-current={player.isCurrentUser ? "true" : "false"}
    >
      <div className={styles.giantOrbit}>#{formatWholeNumber(player.rank)}</div>
      <NebulaMark
        rank={formation}
        avatarUrl={player.avatarUrl}
        initials={playerInitial(player)}
        label={`${player.displayName}'s ${formation.name}`}
        relativeScale={getRelativeNebulaScale(player.score, largestMass)}
        current={player.isCurrentUser}
      />
      <div className={styles.giantIdentity}>
        <p>{formation.name}</p>
        <h3>{player.displayName}</h3>
        <span>@{player.username}</span>
      </div>
      <div className={styles.giantMass}>
        <strong>{formatWholeNumber(player.score)}</strong>
        <span>stellar mass</span>
      </div>
      {player.cosmicIssueNumber ? (
        <p className={styles.giantCosmic}>
          ✦ Cosmic #{String(player.cosmicIssueNumber).padStart(6, "0")}
        </p>
      ) : null}
    </article>
  );
}

function NebulaTableRow({ player }: { player: LeaderboardPlayer }) {
  const formation = getNebulaRank(player.score);

  return (
    <tr
      data-prime={player.rank === 1 ? "true" : "false"}
      data-current={player.isCurrentUser ? "true" : "false"}
      style={rankStyle(formation)}
    >
      <td><strong>#{formatWholeNumber(player.rank)}</strong></td>
      <td>
        <div className={styles.formationCell}>
          <NebulaMark
            rank={formation}
            initials={playerInitial(player)}
            label={rankName(player)}
            size="small"
            prime={player.rank === 1}
          />
          <div>
            <strong>{rankName(player)}</strong>
            <span>{formation.epithet}</span>
          </div>
        </div>
      </td>
      <td>
        <div className={styles.trainerCell}>
          <div>
            <strong>{player.displayName}</strong>
            <span>@{player.username}</span>
          </div>
          {player.cosmicIssueNumber ? (
            <span className={styles.tableCosmic}>Cosmic #{String(player.cosmicIssueNumber).padStart(6, "0")}</span>
          ) : null}
          {player.isCurrentUser ? <span className={styles.youBadge}>You</span> : null}
        </div>
      </td>
      <td className={styles.numericCell}>
        <strong>{formatWholeNumber(player.totalCards)}</strong>
        <span>{formatWholeNumber(player.uniqueCards)} unique</span>
      </td>
      <td className={styles.numericCell}><strong>{formatMoney(player.collectionValue)}</strong></td>
      <td className={styles.numericCell}><strong>{formatWholeNumber(player.lifetimeWishes)}</strong></td>
      <td className={styles.massCell}><strong>{formatWholeNumber(player.score)}</strong></td>
    </tr>
  );
}

function NebulaMobileRow({ player }: { player: LeaderboardPlayer }) {
  const formation = getNebulaRank(player.score);

  return (
    <article
      className={styles.mobileRow}
      data-prime={player.rank === 1 ? "true" : "false"}
      data-current={player.isCurrentUser ? "true" : "false"}
      style={rankStyle(formation)}
    >
      <div className={styles.mobileRowTop}>
        <NebulaMark
          rank={formation}
          initials={playerInitial(player)}
          label={rankName(player)}
          size="small"
          prime={player.rank === 1}
        />
        <div>
          <p>Orbit #{formatWholeNumber(player.rank)} · {rankName(player)}</p>
          <h3>{player.displayName}</h3>
          <span>@{player.username}</span>
        </div>
        <strong>{formatWholeNumber(player.score)}</strong>
      </div>

      <div className={styles.mobileStats}>
        <span>{formatWholeNumber(player.totalCards)} cards</span>
        <span>{formatMoney(player.collectionValue)}</span>
        <span>{formatWholeNumber(player.lifetimeWishes)} wishes</span>
      </div>

      {player.cosmicIssueNumber ? (
        <p className={styles.mobileCosmic}>✦ Cosmic Nebu #{String(player.cosmicIssueNumber).padStart(6, "0")}</p>
      ) : null}
    </article>
  );
}
