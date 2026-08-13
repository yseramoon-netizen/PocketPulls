"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import NebuPerformanceSprite from "@/components/player/NebuPerformanceSprite";
import { getNebuHeatAssets, getNebuSkin } from "@/lib/player/nebu";
import type { SkinId } from "@/lib/player/endless-duat-engine";

const STORAGE_KEY = "ancient-pulls-nebu-sandfall-v1";
const SAVE_KIND = "nebu-sandfall";
const WISH_FRAGMENTS = 10;
const FRAGMENT_SECONDS = 720;

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type UpgradeId = "claws" | "crew" | "charm" | "idol";
type ArtifactFind = { id: string; name: string; icon: string; rarity: Rarity; speedBoost: number; depth: number; foundAt: number };
type SandfallState = {
  kind: typeof SAVE_KIND; version: 1; lastSeen: number; dayKey: string; depth: number; deepest: number;
  sand: number; totalSand: number; lastFindAt: number; nextFindAt: number; totalFinds: number;
  dailyFinds: number; sinceRare: number; totalTaps: number; bestCombo: number;
  upgrades: Record<UpgradeId, number>; collection: Record<Rarity, number>;
  recentFinds: ArtifactFind[]; selectedSkin: SkinId;
};

export type DuatBootstrap = {
  state: unknown; ownedSkins: SkinId[]; selectedSkin: SkinId; fragments: number;
  wishBalance: number; activeSeconds: number;
};

type Props = { bootstrap: DuatBootstrap; accessToken: string; onExit: () => void; onOpenBadges: () => void };
type SkinBonus = { title: string; detail: string; tap: number; auto: number; sand: number; luck: number };
type MaterialLayer = {
  id: string; name: string; icon: string; start: number; end: number;
  light: string; mid: string; dark: string; accent: string;
};

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const ARTIFACT_CHANCE = 0.01;
const ARTIFACT_SPEED_BONUS: Record<Rarity, number> = {
  common: 0.01,
  uncommon: 0.03,
  rare: 0.07,
  epic: 0.15,
  legendary: 0.35,
};
const ARTIFACTS: Record<Rarity, Array<{ name: string; icon: string }>> = {
  common: [
    { name: "Painted Pottery Shard", icon: "◒" }, { name: "Traveller's Coin", icon: "◉" },
    { name: "Cat-shaped Pebble", icon: "⌁" }, { name: "Sun-baked Scarab Bead", icon: "◆" },
  ],
  uncommon: [
    { name: "Bronze Ankh", icon: "☥" }, { name: "Lapis Eye", icon: "◈" },
    { name: "Scribe's Seal", icon: "⌘" }, { name: "Lotus Amulet", icon: "❀" },
  ],
  rare: [
    { name: "Moonstone Ushabti", icon: "☾" }, { name: "Bastet's Bell", icon: "♢" },
    { name: "Golden Lotus", icon: "✦" }, { name: "Scarab of Blue Fire", icon: "◇" },
  ],
  epic: [
    { name: "Pharaoh's Star Map", icon: "✧" }, { name: "Crown of the Sand Sea", icon: "♛" },
    { name: "Jar of Comet Dust", icon: "☄" }, { name: "Tablet of Nine Lives", icon: "▱" },
  ],
  legendary: [
    { name: "Nebu's Lost Crown", icon: "♛" }, { name: "Heart of the First Pyramid", icon: "⟁" },
    { name: "Sun Disk of Ra", icon: "☼" }, { name: "Tear of the Endless Duat", icon: "◉" },
  ],
};

const SKIN_BONUSES: Record<SkinId, SkinBonus> = {
  midnight: { title: "Curious Paws", detail: "+8% artifact luck", tap: 1, auto: 1, sand: 1, luck: 0.08 },
  nile: { title: "River Current", detail: "+15% passive digging", tap: 1, auto: 1.15, sand: 1, luck: 0 },
  lotus: { title: "Bloom Finder", detail: "+14% artifact luck", tap: 1, auto: 1, sand: 1, luck: 0.14 },
  scarab: { title: "Golden Instinct", detail: "+15% sand from finds", tap: 1, auto: 1, sand: 1.15, luck: 0 },
  sunstone: { title: "Solar Claws", detail: "+20% tap strength", tap: 1.2, auto: 1, sand: 1, luck: 0 },
  royal: { title: "Royal Tribute", detail: "+8% to all digging", tap: 1.08, auto: 1.08, sand: 1.08, luck: 0.05 },
  pearl: { title: "Moon Sifter", detail: "+10% artifact rarity", tap: 1, auto: 1, sand: 1, luck: 0.1 },
  sherry: { title: "Shadow Paws", detail: "+12% artifact luck", tap: 1, auto: 1, sand: 1, luck: 0.12 },
  bubbles: { title: "Guardian's Patience", detail: "+12% passive digging", tap: 1, auto: 1.12, sand: 1, luck: 0 },
  cosmic_nebu: { title: "Event Horizon", detail: "+25% to everything", tap: 1.25, auto: 1.25, sand: 1.25, luck: 0.2 },
};

const UPGRADES: Array<{ id: UpgradeId; icon: string; name: string; detail: string }> = [
  { id: "claws", icon: "⌁", name: "Stronger Paws", detail: "More depth every tap" },
  { id: "crew", icon: "◆", name: "Scarab Crew", detail: "Nebu digs while you rest" },
  { id: "charm", icon: "◈", name: "Sifting Charm", detail: "Improves artifact rarity" },
  { id: "idol", icon: "☼", name: "Golden Idol", detail: "Multiplies all progress" },
];

const MATERIALS: MaterialLayer[] = [
  { id: "sand", name: "Sand", icon: "◌", start: 0, end: 10_000, light: "#d99c3c", mid: "#a85f20", dark: "#2a150b", accent: "#ffd078" },
  { id: "stone", name: "Stone", icon: "⬟", start: 10_000, end: 100_000, light: "#8e8b86", mid: "#565451", dark: "#222224", accent: "#d8d4cc" },
  { id: "copper", name: "Copper", icon: "◈", start: 100_000, end: 1_000_000, light: "#d27b43", mid: "#87452e", dark: "#2e1716", accent: "#ffad72" },
  { id: "iron", name: "Iron", icon: "◆", start: 1_000_000, end: 10_000_000, light: "#788590", mid: "#45515b", dark: "#172027", accent: "#b9cbd8" },
  { id: "silver", name: "Silver", icon: "◇", start: 10_000_000, end: 100_000_000, light: "#c9d2dd", mid: "#7a8797", dark: "#26303b", accent: "#f0f6ff" },
  { id: "gold", name: "Gold", icon: "✦", start: 100_000_000, end: 1_000_000_000, light: "#f2ca54", mid: "#a97016", dark: "#38210a", accent: "#fff09a" },
  { id: "obsidian", name: "Obsidian", icon: "⬢", start: 1_000_000_000, end: 10_000_000_000, light: "#5e4a71", mid: "#2e2338", dark: "#0d0912", accent: "#bf8cff" },
  { id: "emerald", name: "Emerald", icon: "◉", start: 10_000_000_000, end: 100_000_000_000, light: "#3ecb91", mid: "#147054", dark: "#08271f", accent: "#8fffd2" },
  { id: "starstone", name: "Starstone", icon: "✧", start: 100_000_000_000, end: 1_000_000_000_000, light: "#668cff", mid: "#373f9c", dark: "#10163c", accent: "#a7c4ff" },
  { id: "duat-crystal", name: "Duat Crystal", icon: "♢", start: 1_000_000_000_000, end: 10_000_000_000_000, light: "#b77cff", mid: "#6738a3", dark: "#1e0d38", accent: "#e2b8ff" },
  { id: "cosmic-ore", name: "Cosmic Ore", icon: "∞", start: 10_000_000_000_000, end: 100_000_000_000_000, light: "#55dff6", mid: "#6747cf", dark: "#090d38", accent: "#fff09b" },
  { id: "voidstone", name: "Voidstone", icon: "●", start: 100_000_000_000_000, end: 1_000_000_000_000_000, light: "#706989", mid: "#29243c", dark: "#050409", accent: "#c9baff" },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }
function compact(value: number) {
  return new Intl.NumberFormat("en-GB", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: value < 100 ? 1 : 0 }).format(Math.max(0, value));
}
function blockLabel(value: number) { return `${compact(Math.floor(value))} blocks`; }
function materialForDepth(depth: number): MaterialLayer {
  const known = MATERIALS.find((material) => depth < material.end);
  if (known) return known;
  const finalEnd = MATERIALS[MATERIALS.length - 1].end;
  const age = Math.max(1, Math.floor(Math.log10(Math.max(1, depth / finalEnd))) + 1);
  const start = finalEnd * 10 ** (age - 1);
  return { id: `eclipse-${age}`, name: `Eclipse Ore ${age}`, icon: "☉", start, end: start * 10,
    light: "#8e73d7", mid: "#3d2878", dark: "#09051a", accent: "#ffd782" };
}
function nextMaterial(material: MaterialLayer) {
  const index = MATERIALS.findIndex((item) => item.id === material.id);
  return index >= 0 && index < MATERIALS.length - 1 ? MATERIALS[index + 1].name : material.id.startsWith("eclipse-") ? `Eclipse Ore ${Number(material.id.split("-")[1]) + 1}` : "Eclipse Ore 1";
}
function upgradeCost(id: UpgradeId, level: number) {
  const base = { claws: 24, crew: 70, charm: 240, idol: 1_100 }[id];
  const growth = { claws: 1.58, crew: 1.7, charm: 1.9, idol: 2.12 }[id];
  return Math.floor(base * growth ** level);
}
function artifactSpeedMultiplier(collection: Record<Rarity, number>) {
  return 1 + RARITIES.reduce((total, rarity) => total + (collection[rarity] || 0) * ARTIFACT_SPEED_BONUS[rarity], 0);
}

function initialState(selectedSkin: SkinId): SandfallState {
  return {
    kind: SAVE_KIND, version: 1, lastSeen: Date.now(), dayKey: todayKey(), depth: 0, deepest: 0,
    sand: 0, totalSand: 0, lastFindAt: 0, nextFindAt: 8, totalFinds: 0, dailyFinds: 0,
    sinceRare: 0, totalTaps: 0, bestCombo: 0, upgrades: { claws: 0, crew: 0, charm: 0, idol: 0 },
    collection: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    recentFinds: [], selectedSkin,
  };
}
function isSandfallState(value: unknown): value is SandfallState {
  return Boolean(value && typeof value === "object" && (value as { kind?: string }).kind === SAVE_KIND);
}
function readState(bootstrap: DuatBootstrap) {
  let candidate: unknown = bootstrap.state;
  try {
    const local = window.localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local) as unknown;
      if (isSandfallState(parsed) && (!isSandfallState(candidate) || parsed.lastSeen > candidate.lastSeen)) candidate = parsed;
    }
  } catch { /* Server progress remains the fallback. */ }
  const base = isSandfallState(candidate) ? candidate : initialState(bootstrap.selectedSkin);
  const elapsed = Math.max(0, Math.min(8 * 60 * 60, (Date.now() - Number(base.lastSeen || Date.now())) / 1_000));
  const bonus = SKIN_BONUSES[bootstrap.selectedSkin];
  const idleRate = (0.22 + base.upgrades.crew * 0.48) * (1 + base.upgrades.idol * 0.28) * bonus.auto * artifactSpeedMultiplier(base.collection);
  const offlineDepth = base.upgrades.crew > 0 ? elapsed * idleRate * 0.55 : 0;
  const offlineSand = offlineDepth * (1 + base.upgrades.idol * 0.25) * bonus.sand;
  return {
    state: { ...base, selectedSkin: bootstrap.selectedSkin, depth: base.depth + offlineDepth,
      deepest: Math.max(base.deepest, base.depth + offlineDepth), sand: base.sand + offlineSand,
      totalSand: base.totalSand + offlineSand, dailyFinds: base.dayKey === todayKey() ? base.dailyFinds : 0,
      dayKey: todayKey(), lastSeen: Date.now() },
    offline: { seconds: elapsed, sand: offlineSand, depth: offlineDepth },
  };
}

function rollRarity(charmLevel: number, skinLuck: number): Rarity {
  const luck = charmLevel * 0.08 + skinLuck;
  const weights: Record<Rarity, number> = {
    common: 65,
    uncommon: 22 * (1 + luck * 0.35),
    rare: 9 * (1 + luck * 0.9),
    epic: 3 * (1 + luck * 1.5),
    legendary: 1 * (1 + luck * 2.2),
  };
  const total = RARITIES.reduce((sum, rarity) => sum + weights[rarity], 0);
  let roll = Math.random() * total;
  for (const rarity of [...RARITIES].reverse()) {
    roll -= weights[rarity];
    if (roll <= 0) return rarity;
  }
  return "common";
}

const COSMIC_DIG_FRAMES = [0, 0, 5, 5, 3, 3, 4, 4, 4, 8, 8, 8, 7, 7, 4, 4, 2, 2, 3, 3, 4, 0, 0, 0];

function SandNebu({ skin, digging }: { skin: SkinId; digging: boolean }) {
  const [frame, setFrame] = useState(0);
  const assets = getNebuHeatAssets(skin);
  const cosmic = skin === "cosmic_nebu";
  useEffect(() => {
    if (!digging) { setFrame(0); return; }
    let animationFrame = 0;
    let lastFrameAt = performance.now();
    const frameLength = 1_000 / 24;
    const animate = (now: number) => {
      if (now - lastFrameAt >= frameLength) {
        const elapsedFrames = Math.max(1, Math.floor((now - lastFrameAt) / frameLength));
        setFrame((value) => (value + elapsedFrames) % 24);
        lastFrameAt += elapsedFrames * frameLength;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [digging]);
  const phase = frame < 6 ? "brace" : frame < 12 ? "scoop" : frame < 18 ? "throw" : frame < 22 ? "scratch" : "settle";
  if (cosmic) {
    return <span className={`sand-nebu-rig dig-${phase}`} data-dig-frame={frame}>
      <NebuPerformanceSprite sheet={assets.reactionSheet} durationMs={900} staticFrame={digging ? COSMIC_DIG_FRAMES[frame] : 0}
        columns={assets.reactionColumns ?? 3} rows={assets.reactionRows ?? 3} className="sand-nebu" label="Cosmic Nebu digging" />
    </span>;
  }
  return <span className={`sand-nebu-rig dig-${phase}`} data-dig-frame={frame}>
    <NebuPerformanceSprite sheet="/ancient-pulls/nebu-digging-24frames-v2.png" durationMs={1_000}
      staticFrame={digging ? frame : 0} columns={6} rows={4} className="sand-nebu" label={`${getNebuSkin(skin).label} digging`} />
  </span>;
}

export default function EndlessDuatGame({ bootstrap, accessToken, onExit, onOpenBadges }: Props) {
  const boot = useRef<ReturnType<typeof readState> | null>(null);
  if (!boot.current) boot.current = readState(bootstrap);
  const [state, setState] = useState<SandfallState>(boot.current.state);
  const [fragments, setFragments] = useState(bootstrap.fragments);
  const [wishBalance, setWishBalance] = useState(bootstrap.wishBalance);
  const [activeSeconds, setActiveSeconds] = useState(bootstrap.activeSeconds);
  const [rush, setRush] = useState(0);
  const [combo, setCombo] = useState(0);
  const [latestFind, setLatestFind] = useState<ArtifactFind | null>(null);
  const [digging, setDigging] = useState(false);
  const [notice, setNotice] = useState(boot.current.offline.sand > 1 ? `While away, Nebu dug ${blockLabel(boot.current.offline.depth)} and gathered ${compact(boot.current.offline.sand)} sand.` : "");
  const [networkBusy, setNetworkBusy] = useState(false);
  const [tapBursts, setTapBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const stateRef = useRef(state);
  const rushRef = useRef(rush);
  const lastTapRef = useRef(0);
  const digTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef(0);
  const findTimerRef = useRef<number | null>(null);
  stateRef.current = state;
  rushRef.current = rush;

  const skin = getNebuSkin(state.selectedSkin);
  const skinBonus = SKIN_BONUSES[state.selectedSkin];
  const idolMultiplier = 1 + state.upgrades.idol * 0.28;
  const artifactMultiplier = artifactSpeedMultiplier(state.collection);
  const artifactBoostPercent = Math.round((artifactMultiplier - 1) * 100);
  const tapPower = (1 + state.upgrades.claws * 1.28) * idolMultiplier * skinBonus.tap * artifactMultiplier;
  const passiveRate = (0.22 + state.upgrades.crew * 0.48) * idolMultiplier * skinBonus.auto * artifactMultiplier;
  const material = materialForDepth(state.depth);
  const materialProgress = Math.max(0, Math.min(100, ((state.depth - material.start) / Math.max(1, material.end - material.start)) * 100));

  const persist = useCallback(async (snapshot: SandfallState) => {
    const saved = { ...snapshot, lastSeen: Date.now() };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* Server save still runs. */ }
    try {
      await fetch("/api/player/duat/progress", { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ state: saved }) });
    } catch { /* The local copy protects progress until the next save. */ }
  }, [accessToken]);

  const discoverArtifact = useCallback(() => {
    if (Math.random() >= ARTIFACT_CHANCE) return;
    const snapshot = stateRef.current;
    const bonus = SKIN_BONUSES[snapshot.selectedSkin];
    const rarity = rollRarity(snapshot.upgrades.charm, bonus.luck);
    const pool = ARTIFACTS[rarity];
    const artifact = pool[Math.floor(Math.random() * pool.length)];
    const find: ArtifactFind = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: artifact.name,
      icon: artifact.icon,
      rarity,
      speedBoost: ARTIFACT_SPEED_BONUS[rarity],
      depth: snapshot.depth,
      foundAt: Date.now(),
    };
    setLatestFind(find);
    if (findTimerRef.current) window.clearTimeout(findTimerRef.current);
    findTimerRef.current = window.setTimeout(() => setLatestFind(null), rarity === "legendary" ? 7_500 : 4_200);
    setState((current) => ({
      ...current,
      totalFinds: current.totalFinds + 1,
      dailyFinds: current.dailyFinds + 1,
      sinceRare: rarity === "rare" || rarity === "epic" || rarity === "legendary" ? 0 : current.sinceRare + 1,
      collection: { ...current.collection, [rarity]: current.collection[rarity] + 1 },
      recentFinds: [find, ...current.recentFinds].slice(0, 6),
    }));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const rushMultiplier = 1 + rushRef.current / 55;
      setState((current) => {
        const bonus = SKIN_BONUSES[current.selectedSkin];
        const idol = 1 + current.upgrades.idol * 0.28;
        const dug = (0.22 + current.upgrades.crew * 0.48) * idol * bonus.auto * artifactSpeedMultiplier(current.collection) * rushMultiplier * 0.1;
        const gathered = dug * (1 + current.upgrades.idol * 0.25) * bonus.sand;
        const nextDay = todayKey();
        return { ...current, dayKey: nextDay, dailyFinds: current.dayKey === nextDay ? current.dailyFinds : 0,
          depth: current.depth + dug, deepest: Math.max(current.deepest, current.depth + dug),
          sand: current.sand + gathered, totalSand: current.totalSand + gathered };
      });
      setRush((value) => Math.max(0, value - 1.35));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(discoverArtifact, 1_000);
    return () => window.clearInterval(timer);
  }, [discoverArtifact]);

  useEffect(() => {
    const timer = window.setInterval(() => { saveTimerRef.current += 1; if (saveTimerRef.current % 10 === 0) void persist(stateRef.current); }, 1_000);
    const beforeUnload = () => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stateRef.current, lastSeen: Date.now() })); } catch { /* Best effort. */ } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.clearInterval(timer); window.removeEventListener("beforeunload", beforeUnload); beforeUnload(); };
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    const heartbeat = async () => {
      try {
        const response = await fetch("/api/player/duat/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ elapsedSeconds: 30 }) });
        const payload = await response.json();
        if (response.ok && !cancelled) { setActiveSeconds(Number(payload.activeSeconds) || 0); setFragments(Number(payload.fragments) || 0); }
      } catch { /* A missed heartbeat grants no verified time. */ }
    };
    const first = window.setTimeout(() => void heartbeat(), 30_000);
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    return () => { cancelled = true; window.clearTimeout(first); window.clearInterval(interval); };
  }, [accessToken]);

  useEffect(() => () => { if (digTimerRef.current) window.clearTimeout(digTimerRef.current); if (findTimerRef.current) window.clearTimeout(findTimerRef.current); }, []);

  const dig = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const now = Date.now();
    const nextCombo = now - lastTapRef.current < 650 ? Math.min(99, combo + 1) : 1;
    lastTapRef.current = now; setCombo(nextCombo); setRush((value) => Math.min(100, value + 7.5)); setDigging(true);
    if (digTimerRef.current) window.clearTimeout(digTimerRef.current);
    digTimerRef.current = window.setTimeout(() => setDigging(false), 180);
    const rect = event.currentTarget.getBoundingClientRect();
    const burst = { id: now + Math.random(), x: event.clientX - rect.left, y: event.clientY - rect.top };
    setTapBursts((items) => [...items.slice(-7), burst]);
    window.setTimeout(() => setTapBursts((items) => items.filter((item) => item.id !== burst.id)), 650);
    setState((current) => {
      const bonus = SKIN_BONUSES[current.selectedSkin];
      const idol = 1 + current.upgrades.idol * 0.28;
      const dug = (1 + current.upgrades.claws * 1.28) * idol * bonus.tap * artifactSpeedMultiplier(current.collection) * (1 + Math.min(40, nextCombo) * 0.012);
      const gathered = dug * (1 + current.upgrades.idol * 0.25) * bonus.sand;
      return { ...current, depth: current.depth + dug, deepest: Math.max(current.deepest, current.depth + dug),
        sand: current.sand + gathered, totalSand: current.totalSand + gathered,
        totalTaps: current.totalTaps + 1, bestCombo: Math.max(current.bestCombo, nextCombo) };
    });
    discoverArtifact();
  };

  const buyUpgrade = (id: UpgradeId) => {
    setState((current) => {
      const cost = upgradeCost(id, current.upgrades[id]);
      if (current.sand < cost) return current;
      setNotice(`${UPGRADES.find((upgrade) => upgrade.id === id)?.name} upgraded.`);
      return { ...current, sand: current.sand - cost, upgrades: { ...current.upgrades, [id]: current.upgrades[id] + 1 } };
    });
  };

  const forgeFragment = async () => {
    setNetworkBusy(true);
    try {
      const response = await fetch("/api/player/duat/forge", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The buried starlight has not formed yet.");
      setFragments(Number(payload.fragments) || 0); setActiveSeconds(Number(payload.activeSeconds) || 0); setNotice("Nebu uncovered a Wish Fragment.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Keep digging a little longer."); }
    finally { setNetworkBusy(false); }
  };
  const claimWish = async () => {
    setNetworkBusy(true);
    try {
      const response = await fetch("/api/player/duat/claim-wish", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The wish cannot form yet.");
      setFragments(Number(payload.fragments) || 0); setWishBalance(Number(payload.wishBalance) || 0); setNotice("One free wish was added to your Ancient Pulls balance.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The wish cannot form yet."); }
    finally { setNetworkBusy(false); }
  };

  const wishReady = fragments >= WISH_FRAGMENTS;
  const fragmentReady = activeSeconds >= FRAGMENT_SECONDS && fragments < WISH_FRAGMENTS;
  const fragmentProgress = wishReady ? 100 : Math.min(100, (activeSeconds / FRAGMENT_SECONDS) * 100);
  const shaftStyle = {
    "--shaft-shift": `${-(state.depth % 260)}px`, "--skin-accent": skin.swatch,
    "--material-light": material.light, "--material-mid": material.mid,
    "--material-dark": material.dark, "--material-accent": material.accent,
  } as CSSProperties;
  const paceLabel = useMemo(() => `${compact(passiveRate * (1 + rush / 55))} blocks/s`, [passiveRate, rush]);

  return (
    <main className={`sandfall-shell ${latestFind ? `finding-${latestFind.rarity}` : ""}`} style={shaftStyle}>
      <header className="sandfall-topbar">
        <button className="sandfall-brand" onClick={onExit} aria-label="Return to Ancient Pulls"><span>←</span><div><b>NEBU SANDFALL</b><small>Ancient Pulls</small></div></button>
        <div className="sandfall-stats"><div><small>DEPTH</small><b>{blockLabel(state.depth)}</b></div><div><small>ANCIENT SAND</small><b>✦ {compact(state.sand)}</b></div><div><small>LAYER</small><b>{material.name}</b></div></div>
        <button className="sandfall-exit" onClick={onExit}>Ancient Pulls</button>
      </header>

      <div className="sandfall-layout">
        <section className="dig-chamber">
          <button className="dig-zone" onPointerDown={dig} aria-label="Tap to make Nebu dig faster">
            <div className="sand-glow" /><div className="dug-tunnel" /><div className="sand-strata strata-back" />
            <div className="shaft-walls"><i /><i /></div><div className="depth-line"><span>{blockLabel(state.depth)}</span></div>
            <div className="material-badge"><span>{material.icon}</span><div><small>CURRENT LAYER</small><b>{material.name}</b></div></div>
            <div className={`nebu-digger ${digging ? "is-digging" : ""}`}><div className="nebu-aura" /><SandNebu skin={state.selectedSkin} digging={true} /><div className="sand-spray"><i /><i /><i /><i /><i /><i /></div><div className="dig-shadow" /></div>
            {tapBursts.map((burst) => <span key={burst.id} className="tap-burst" style={{ left: burst.x, top: burst.y }}>+{compact(tapPower)}</span>)}
            <div className="tap-callout"><b>TAP TO DIG</b><small>Rapid taps build Paw Rush</small></div>
            <div className="rush-meter"><span style={{ width: `${rush}%` }} /><div><b>PAW RUSH</b><small>{rush > 5 ? `×${(1 + rush / 55).toFixed(1)} speed · combo ${combo}` : "Keep tapping"}</small></div></div>
          </button>

          {latestFind && <button className={`artifact-reveal rarity-${latestFind.rarity}`} onClick={() => setLatestFind(null)}><span className="artifact-rays" /><span className="artifact-icon">{latestFind.icon}</span><span className="artifact-rarity">{latestFind.rarity}</span><b>{latestFind.name}</b><small>Unearthed at {blockLabel(latestFind.depth)}</small><strong>Permanent +{Math.round(latestFind.speedBoost * 100)}% dig speed</strong></button>}
        </section>

        <aside className="sandfall-panel">
          <section className="material-progress-card"><div className="material-progress-icon">{material.icon}</div><div className="material-progress-copy"><small>CURRENT LAYER</small><b>{material.name}</b><p>{blockLabel(state.depth)} / {compact(material.end)} blocks</p></div><div className="simple-meter"><i style={{ width: `${materialProgress}%` }} /></div><footer><span>NEXT</span><b>{nextMaterial(material)}</b><small>at {compact(material.end)} blocks</small></footer></section>
          <section className="next-find-card"><div className="panel-heading"><div><small>ARTIFACT CHANCE</small><b>1% per dig</b></div><span>✦</span></div><div className="artifact-boost-total"><small>PERMANENT ARTIFACT BOOST</small><b>+{artifactBoostPercent}% speed</b></div><div className="artifact-boost-grid">{RARITIES.map((rarity) => <span key={rarity} className={rarity}>{rarity.slice(0, 1).toUpperCase()} +{Math.round(ARTIFACT_SPEED_BONUS[rarity] * 100)}%</span>)}</div><p>Every tap and every completed 24-frame loop gets one independent 1% roll. A find boosts Nebu instantly and permanently.</p></section>

          <section className="skin-bonus-card"><button onClick={onOpenBadges} className="skin-portrait" aria-label="Open Nebu skins in Badges"><SandNebu skin={state.selectedSkin} digging={false} /></button><div><small>{skin.label.toUpperCase()}</small><b>{skinBonus.title}</b><p>{skinBonus.detail}</p></div><button onClick={onOpenBadges}>Change</button></section>

          <section className="upgrade-section"><div className="panel-title"><div><small>SPEND SAND</small><b>Help Nebu dig deeper</b></div><span>{paceLabel}</span></div><div className="upgrade-list">
            {UPGRADES.map((upgrade) => { const level = state.upgrades[upgrade.id]; const cost = upgradeCost(upgrade.id, level); return <button key={upgrade.id} className={state.sand >= cost ? "can-buy" : ""} onClick={() => buyUpgrade(upgrade.id)} disabled={state.sand < cost}><span>{upgrade.icon}</span><div><small>LEVEL {level}</small><b>{upgrade.name}</b><p>{upgrade.detail}</p></div><strong>✦ {compact(cost)}</strong></button>; })}
          </div></section>

          <section className="wish-path-card"><div className="panel-heading"><div><small>FREE WISH</small><b>{fragments} / {WISH_FRAGMENTS} fragments</b></div><span>◉</span></div><div className="fragment-pips">{Array.from({ length: WISH_FRAGMENTS }, (_, index) => <i key={index} className={index < fragments ? "filled" : ""} />)}</div>{!wishReady && <div className="simple-meter wish-meter"><i style={{ width: `${fragmentProgress}%` }} /></div>}<button disabled={networkBusy || (!wishReady && !fragmentReady)} onClick={() => void (wishReady ? claimWish() : forgeFragment())}>{wishReady ? "Claim free wish" : fragmentReady ? "Unearth fragment" : `${Math.max(0, 12 - Math.floor(activeSeconds / 60))} min of digging to fragment`}</button></section>

          <section className="collection-card"><div className="panel-title"><div><small>TODAY</small><b>{state.dailyFinds} artifacts found</b></div><span>{state.totalFinds} total</span></div><div className="rarity-row">{RARITIES.map((rarity) => <div key={rarity} className={rarity}><i /><span>{rarity.slice(0, 1).toUpperCase()}</span><b>{state.collection[rarity]}</b></div>)}</div>{state.recentFinds.length > 0 && <div className="recent-find"><span className={state.recentFinds[0].rarity}>{state.recentFinds[0].icon}</span><div><small>LATEST FIND</small><b>{state.recentFinds[0].name}</b></div></div>}</section>
        </aside>
      </div>

      {notice && <button className="sandfall-notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
    </main>
  );
}
