"use client";

/* eslint-disable @next/next/no-img-element -- Catalogue and avatar artwork use validated remote URLs and load only after the dialog opens. */

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatMarketValue,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
} from "@/lib/player/format";
import { getNebulaRank, PRIME_NEBULA_NAME } from "@/lib/player/nebula-ranks";
import { getPlayerRarityTheme } from "@/lib/player/rarity";
import {
  ZODIAC_SHAPES,
  type ZodiacSign,
} from "@/lib/player/zodiac-constellations";
import { supabase } from "@/lib/supabase";

import type { NebulaUniversePlayer } from "./NebulaUniverse";
import styles from "./GalaxyConstellationDialog.module.css";

type PublicConstellationRow = {
  owner_user_id: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  zodiac_sign: string | null;
  wish_id: string | null;
  card_id: string | null;
  card_name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  image_url: string | null;
  value_at_wish: number | string | null;
  current_market_value: number | string | null;
  wished_at: string | null;
};

type ConstellationWish = {
  wishId: string;
  cardId: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string;
  imageUrl: string | null;
  valueAtWish: number;
  currentMarketValue: number;
  wishedAt: string | null;
};

type OwnerMeta = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  zodiacSign: ZodiacSign | null;
};

type StarPoint = {
  wish: ConstellationWish;
  x: number;
  y: number;
  size: number;
  colour: string;
  glow: string;
  anchorIndex: number | null;
};

type ConstellationGeometry = {
  stars: StarPoint[];
  lines: Array<[number, number]>;
};

type GalaxyConstellationDialogProps = {
  player: NebulaUniversePlayer | null;
  reducedMotion?: boolean;
  onClose: () => void;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function formatWishDate(value: string | null): string {
  if (!value) return "on an unknown night";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "on an unknown night";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseZodiacSign(value: unknown): ZodiacSign | null {
  if (typeof value !== "string") return null;
  const sign = value.trim().toLowerCase() as ZodiacSign;
  return sign in ZODIAC_SHAPES ? sign : null;
}

function parseConstellation(value: unknown): {
  owner: OwnerMeta | null;
  wishes: ConstellationWish[];
} {
  if (!Array.isArray(value) || value.length === 0) {
    return { owner: null, wishes: [] };
  }

  const rows = value as PublicConstellationRow[];
  const first = rows[0];
  const owner = first.owner_user_id
    ? {
        userId: first.owner_user_id,
        username: first.owner_username?.trim() || "trainer",
        displayName: first.owner_display_name?.trim() || "Star Trainer",
        avatarUrl: first.owner_avatar_url?.trim() || null,
        zodiacSign: parseZodiacSign(first.zodiac_sign),
      }
    : null;

  const wishes = rows
    .filter((row) => Boolean(row.wish_id && row.card_id))
    .map((row) => ({
      wishId: row.wish_id as string,
      cardId: row.card_id as string,
      name: row.card_name?.trim() || "Unknown card",
      setName: row.set_name?.trim() || "Unknown set",
      cardNumber: row.card_no?.trim() || null,
      rarity: row.rarity?.trim() || "Common",
      imageUrl: row.image_url?.trim() || null,
      valueAtWish: toNumber(row.value_at_wish),
      currentMarketValue: toNumber(row.current_market_value),
      wishedAt: row.wished_at,
    }));

  return { owner, wishes };
}

function buildGeometry(
  wishes: readonly ConstellationWish[],
  zodiacSign: ZodiacSign | null,
): ConstellationGeometry {
  if (wishes.length === 0) return { stars: [], lines: [] };

  const ordered = [...wishes].sort((first, second) => {
    const rarityDifference =
      getPlayerRarityTheme(second.rarity).rank -
      getPlayerRarityTheme(first.rarity).rank;
    if (rarityDifference !== 0) return rarityDifference;
    return second.currentMarketValue - first.currentMarketValue;
  });

  const pointByWish = new Map<string, { x: number; y: number; anchorIndex: number | null }>();
  const anchorWishIndexes = new Map<number, number>();
  const shape = zodiacSign ? ZODIAC_SHAPES[zodiacSign] : null;
  const anchorCount = shape ? Math.min(shape.points.length, ordered.length) : 0;

  if (shape) {
    for (let index = 0; index < anchorCount; index += 1) {
      const point = shape.points[index];
      pointByWish.set(ordered[index].wishId, {
        x: point.x,
        y: point.y,
        anchorIndex: index,
      });
    }
  }

  const remaining = ordered.slice(anchorCount);
  remaining.forEach((wish, index) => {
    const seed = hashString(`${wish.wishId}:${wish.cardId}`);
    const progress = Math.sqrt((index + 1) / Math.max(1, remaining.length));
    const angle = index * 2.399963 + seededUnit(seed) * 0.76;
    const radiusX = 12 + progress * 34;
    const radiusY = 10 + progress * 31;
    pointByWish.set(wish.wishId, {
      x: Math.max(5, Math.min(95, 50 + Math.cos(angle) * radiusX)),
      y: Math.max(7, Math.min(93, 51 + Math.sin(angle) * radiusY)),
      anchorIndex: null,
    });
  });

  const stars = wishes.map((wish, wishIndex) => {
    const placement = pointByWish.get(wish.wishId) ?? { x: 50, y: 50, anchorIndex: null };
    const theme = getPlayerRarityTheme(wish.rarity);
    const valueBoost = Math.min(2.5, Math.log10(Math.max(1, wish.currentMarketValue + 1)));
    if (placement.anchorIndex !== null) anchorWishIndexes.set(placement.anchorIndex, wishIndex);
    return {
      wish,
      x: placement.x,
      y: placement.y,
      size: 1.8 + theme.rank * 0.52 + valueBoost * 0.38 + (placement.anchorIndex !== null ? 1.8 : 0),
      colour: theme.primary,
      glow: theme.glow,
      anchorIndex: placement.anchorIndex,
    };
  });

  const lines: Array<[number, number]> = [];
  if (shape) {
    for (const [fromAnchor, toAnchor] of shape.segments) {
      const from = anchorWishIndexes.get(fromAnchor);
      const to = anchorWishIndexes.get(toAnchor);
      if (from !== undefined && to !== undefined) lines.push([from, to]);
    }
  } else {
    const brightStars = stars
      .map((star, index) => ({ star, index }))
      .sort((first, second) => second.star.size - first.star.size)
      .slice(0, Math.min(14, stars.length));
    for (let index = 1; index < brightStars.length; index += 1) {
      lines.push([brightStars[index - 1].index, brightStars[index].index]);
    }
  }

  return { stars, lines };
}

function ConstellationCanvas({
  geometry,
  selectedWishId,
  reducedMotion,
  onSelect,
}: {
  geometry: ConstellationGeometry;
  selectedWishId: string | null;
  reducedMotion: boolean;
  onSelect: (wish: ConstellationWish) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitPointsRef = useRef<Array<{ x: number; y: number; radius: number; wish: ConstellationWish }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let active = true;
    let lastPaint = 0;
    let positioned: Array<{ star: StarPoint; x: number; y: number }> = [];
    const dpr = Math.min(1.6, Math.max(1, window.devicePixelRatio || 1));
    const starOrder = geometry.stars
      .map((_, index) => index)
      .sort(
        (firstIndex, secondIndex) =>
          geometry.stars[firstIndex].size - geometry.stars[secondIndex].size,
      );

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      positioned = geometry.stars.map((star) => ({
        star,
        x: star.x / 100 * width,
        y: star.y / 100 * height,
      }));
      hitPointsRef.current = starOrder.map((starIndex) => {
        const point = positioned[starIndex];
        return {
          x: point.x,
          y: point.y,
          radius: Math.max(10, point.star.size * 2.7),
          wish: point.star.wish,
        };
      });
    };

    const render = (time: number) => {
      if (!reducedMotion && time - lastPaint < 32) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      lastPaint = time;

      const sky = context.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );
      sky.addColorStop(0, "#14123c");
      sky.addColorStop(0.5, "#080821");
      sky.addColorStop(1, "#02030d");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "rgba(255,255,255,0.34)";
      for (let index = 0; index < 90; index += 1) {
        const x = seededUnit(index * 31 + 11) * width;
        const y = seededUnit(index * 47 + 29) * height;
        const alpha = reducedMotion ? 0.46 : 0.3 + Math.sin(time * 0.001 + index) * 0.16;
        context.globalAlpha = Math.max(0.1, alpha);
        context.fillRect(x, y, index % 7 === 0 ? 1.5 : 0.8, index % 7 === 0 ? 1.5 : 0.8);
      }
      context.globalAlpha = 1;

      context.strokeStyle = "rgba(165,243,252,0.3)";
      context.lineWidth = 1.2;
      context.shadowColor = "rgba(103,232,249,0.32)";
      context.shadowBlur = 5;
      for (const [fromIndex, toIndex] of geometry.lines) {
        const from = positioned[fromIndex];
        const to = positioned[toIndex];
        if (!from || !to) continue;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
      context.shadowBlur = 0;

      starOrder.forEach((starIndex, index) => {
          const { star, x, y } = positioned[starIndex];
          const selected = star.wish.wishId === selectedWishId;
          const pulse = reducedMotion ? 1 : 0.88 + Math.sin(time * 0.0017 + index * 0.73) * 0.12;
          const radius = star.size * pulse;
          context.fillStyle = star.colour;
          context.shadowColor = star.glow;
          context.shadowBlur = selected ? 22 : Math.min(15, 4 + star.size);
          context.beginPath();
          context.arc(x, y, selected ? radius * 1.35 : radius, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;

          if (selected) {
            context.strokeStyle = "rgba(255,255,255,0.9)";
            context.lineWidth = 1.4;
            context.beginPath();
            context.arc(x, y, radius * 2.25, 0, Math.PI * 2);
            context.stroke();
          }
        });

      if (active && !reducedMotion) frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) render(0);
    });
    observer.observe(canvas);
    resize();
    frame = window.requestAnimationFrame(render);

    return () => {
      active = false;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [geometry, reducedMotion, selectedWishId]);

  const findWish = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let closest: { wish: ConstellationWish; distance: number } | null = null;
    for (const point of hitPointsRef.current) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance <= point.radius && (!closest || distance < closest.distance)) {
        closest = { wish: point.wish, distance };
      }
    }
    return closest?.wish ?? null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.constellationCanvas}
      tabIndex={0}
      role="application"
      aria-label="Interactive card constellation. Use arrow keys to choose a wish star."
      onPointerMove={(event) => {
        event.currentTarget.style.cursor = findWish(event) ? "pointer" : "grab";
      }}
      onClick={(event) => {
        const wish = findWish(event);
        if (wish) onSelect(wish);
      }}
      onKeyDown={(event) => {
        if (
          event.key !== "ArrowRight" &&
          event.key !== "ArrowDown" &&
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowUp"
        ) {
          return;
        }
        event.preventDefault();
        const currentIndex = Math.max(
          0,
          geometry.stars.findIndex(
            (star) => star.wish.wishId === selectedWishId,
          ),
        );
        const direction =
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          (currentIndex + direction + geometry.stars.length) %
          geometry.stars.length;
        const nextWish = geometry.stars[nextIndex]?.wish;
        if (nextWish) onSelect(nextWish);
      }}
    />
  );
}

export default function GalaxyConstellationDialog({
  player,
  reducedMotion = false,
  onClose,
}: GalaxyConstellationDialogProps) {
  const [owner, setOwner] = useState<OwnerMeta | null>(null);
  const [wishes, setWishes] = useState<ConstellationWish[]>([]);
  const [selectedWish, setSelectedWish] = useState<ConstellationWish | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!player) return;
    let active = true;

    const frame = window.requestAnimationFrame(() => {
      setLoading(true);
      setErrorMessage(null);
      setOwner(null);
      setWishes([]);
      setSelectedWish(null);

      void (async () => {
        try {
          const { data, error } = await supabase.rpc(
            "get_public_player_constellation",
            { p_target_user_id: player.userId },
          );
          if (!active) return;
          if (error) throw error;
          const parsed = parseConstellation(data);
          if (!parsed.owner) throw new Error("This constellation is not public.");
          setOwner(parsed.owner);
          setWishes(parsed.wishes);
          const brightest = [...parsed.wishes].sort((first, second) => {
            const rankDifference =
              getPlayerRarityTheme(second.rarity).rank -
              getPlayerRarityTheme(first.rarity).rank;
            return rankDifference || second.currentMarketValue - first.currentMarketValue;
          })[0] ?? null;
          setSelectedWish(brightest);
        } catch (error: unknown) {
          if (!active) return;
          setErrorMessage(getErrorMessage(error, "That constellation could not be opened."));
        } finally {
          if (active) setLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, player]);

  const geometry = useMemo(
    () => buildGeometry(wishes, owner?.zodiacSign ?? null),
    [owner?.zodiacSign, wishes],
  );

  if (!player) return null;

  const formation = getNebulaRank(player.score);
  const constellationName = owner?.zodiacSign
    ? `${ZODIAC_SHAPES[owner.zodiacSign].label} Memory Sky`
    : "Memory Sky";

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`${player.displayName}'s constellation`}
        style={{
          "--dialog-primary": formation.primary,
          "--dialog-secondary": formation.secondary,
        } as CSSProperties}
      >
        <header className={styles.dialogHeader}>
          <div className={styles.ownerIdentity}>
            <div className={styles.ownerAvatar}>
              {owner?.avatarUrl ? (
                <img src={owner.avatarUrl} alt="" />
              ) : (
                (owner?.displayName || player.displayName).charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p>
                Orbit #{formatWholeNumber(player.rank)} · {player.rank === 1 ? PRIME_NEBULA_NAME : formation.name}
              </p>
              <h2>{owner?.displayName || player.displayName}</h2>
              <span>@{owner?.username || player.username} · {constellationName}</span>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close constellation">×</button>
        </header>

        <div className={styles.dialogBody}>
          <div className={styles.skyPanel}>
            {loading ? (
              <div className={styles.loadingSky}>Charting this galaxy...</div>
            ) : errorMessage ? (
              <div className={styles.loadingSky}>{errorMessage}</div>
            ) : wishes.length === 0 ? (
              <div className={styles.loadingSky}>This constellation is waiting for its first star.</div>
            ) : (
              <ConstellationCanvas
                geometry={geometry}
                selectedWishId={selectedWish?.wishId ?? null}
                reducedMotion={reducedMotion}
                onSelect={setSelectedWish}
              />
            )}
            <div className={styles.skyReadout}>
              <span>{formatWholeNumber(wishes.length)} wish stars</span>
              <span>{owner?.zodiacSign ? ZODIAC_SHAPES[owner.zodiacSign].iauCode : "AP-SKY"}</span>
            </div>
          </div>

          <aside className={styles.starInspector}>
            <p className={styles.inspectorEyebrow}>Selected star</p>
            {selectedWish ? (
              <>
                <div className={styles.cardArtwork}>
                  {selectedWish.imageUrl ? (
                    <img src={selectedWish.imageUrl} alt={selectedWish.name} />
                  ) : (
                    <span>✦</span>
                  )}
                </div>
                <p className={styles.rarity}>{selectedWish.rarity}</p>
                <h3>{selectedWish.name}</h3>
                <p className={styles.cardMeta}>
                  {selectedWish.setName}
                  {selectedWish.cardNumber ? ` · #${selectedWish.cardNumber}` : ""}
                </p>
                <strong className={styles.cardValue}>{formatMarketValue(selectedWish.currentMarketValue)}</strong>
                <p className={styles.starDate}>
                  Joined this sky {formatWishDate(selectedWish.wishedAt)}
                </p>
              </>
            ) : (
              <p className={styles.emptyInspector}>Choose a star in the constellation.</p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
