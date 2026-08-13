"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import {
  attackPower,
  biomeFor,
  BOONS,
  BoonId,
  BUILDINGS,
  discoverRelic,
  emptyBoons,
  GameState,
  getOath,
  getSkin,
  initialState,
  makeBoonChoices,
  makeChoices,
  makeEnemy,
  maxVitality,
  OATHS,
  OathId,
  productionPerMinute,
  RELICS,
  relicDustMultiplier,
  RouteChoice,
  safeLoad,
  SKINS,
  SkinId,
  Tab,
  upgradeCost,
} from "@/lib/player/endless-duat-engine";

const STORAGE_KEY = "ancient-pulls-endless-duat-v1";
const FRAGMENT_RECIPE = { dust: 400, glyphs: 4, flames: 1 };
const WISH_FRAGMENTS = 10;

export type DuatBootstrap = {
  state: GameState | null;
  ownedSkins: SkinId[];
  selectedSkin: SkinId;
  fragments: number;
  wishBalance: number;
  activeSeconds: number;
};

type DuatGameProps = {
  bootstrap: DuatBootstrap;
  accessToken: string;
  onExit: () => void;
};

type Notice = { id: number; title: string; body: string; tone?: "gold" | "violet" | "red" };
type OfflineReport = { minutes: number; dust: number; glyphs: number } | null;

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "adventure", label: "Expedition", icon: "✦" },
  { id: "kingdom", label: "Kingdom", icon: "△" },
  { id: "relics", label: "Relics", icon: "◆" },
  { id: "skins", label: "Nebu Skins", icon: "♛" },
  { id: "forge", label: "Wish Forge", icon: "◉" },
];

const EVENT_COPY: Record<string, { icon: string; eyebrow: string; title: string; body: string; bold: string; wise: string; boldHint: string; wiseHint: string }> = {
  sarcophagus: { icon: "♛", eyebrow: "Something inside is singing", title: "The Sarcophagus of Two Voices", body: "One voice promises a relic. The other calmly describes the creature waiting beneath it.", bold: "Break the golden seals", wise: "Translate the warning", boldHint: "Relic or elite ambush", wiseHint: "+2 Glyphs and healing" },
  "star-door": { icon: "◉", eyebrow: "No constellation contains it", title: "The Door Without Stars", body: "The black stone drinks every light that touches it. A flame might satisfy it—or Nebu could force a way through.", bold: "Force the door", wise: "Offer celestial fire", boldHint: "Lose vitality, gain treasure", wiseHint: "Spend 1 Flame for a relic" },
  "lost-spirit": { icon: "◇", eyebrow: "A memory asks for company", title: "The Last Astronomer", body: "A translucent figure has waited centuries for someone to notice that he is still looking upward.", bold: "Share your Stardust", wise: "Follow his direction", boldHint: "Full heal and a Flame", wiseHint: "+2 Glyphs and combo" },
};

function compact(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: value < 100 ? 1 : 0 }).format(Math.floor(value));
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    resources: { ...state.resources },
    buildings: { ...state.buildings },
    relics: [...state.relics],
    propheciesClaimed: [...state.propheciesClaimed],
    skinMastery: { ...state.skinMastery },
    run: {
      ...state.run,
      enemy: state.run.enemy ? { ...state.run.enemy } : null,
      choices: [...state.run.choices],
      boons: { ...state.run.boons },
      pendingBoons: [...state.run.pendingBoons],
      history: [...state.run.history],
    },
  };
}

function Nebu({ skin = "midnight", fighting = false, defeated = false }: { skin?: SkinId; fighting?: boolean; defeated?: boolean }) {
  return (
    <div className={`nebu skin-${skin} ${fighting ? "is-fighting" : ""} ${defeated ? "is-defeated" : ""}`} aria-label={getSkin(skin).name}>
      <span className="nebu-aura" />
      <span className="nebu-tail" />
      <span className="nebu-body" />
      <span className="nebu-head">
        <i className="ear ear-left" />
        <i className="ear ear-right" />
        <i className="eye eye-left" />
        <i className="eye eye-right" />
        <i className="nebu-mark">✦</i>
      </span>
      <span className="nebu-paw paw-one" />
      <span className="nebu-paw paw-two" />
    </div>
  );
}

function ResourcePill({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: string }) {
  return (
    <div className={`resource-pill ${accent ?? ""}`} title={label}>
      <span>{icon}</span>
      <div>
        <b>{compact(value)}</b>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, danger = false }: { value: number; max: number; danger?: boolean }) {
  const percentage = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`meter ${danger ? "danger" : ""}`}>
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}

function stateFromBootstrap(bootstrap: DuatBootstrap): GameState {
  const base = bootstrap.state ? safeLoad(JSON.stringify(bootstrap.state)) : null;
  const next = cloneState(base || initialState());
  next.ownedSkins = bootstrap.ownedSkins;
  next.selectedSkin = bootstrap.ownedSkins.includes(bootstrap.selectedSkin)
    ? bootstrap.selectedSkin
    : "midnight";
  next.resources.fragments = bootstrap.fragments;
  next.resources.wishes = bootstrap.wishBalance;
  return next;
}

export default function EndlessDuatGame({ bootstrap, accessToken, onExit }: DuatGameProps) {
  const [state, setState] = useState<GameState>(() => stateFromBootstrap(bootstrap));
  const [tab, setTab] = useState<Tab>("adventure");
  const [hydrated] = useState(true);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [attunementSeconds, setAttunementSeconds] = useState(bootstrap.activeSeconds);
  const [now, setNow] = useState(() => Date.now());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [offlineReport, setOfflineReport] = useState<OfflineReport>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [adSeconds, setAdSeconds] = useState(5);
  const noticeId = useRef(0);

  const notify = (title: string, body: string, tone: Notice["tone"] = "gold") => {
    const id = ++noticeId.current;
    setNotices((items) => [...items.slice(-2), { id, title, body, tone }]);
    window.setTimeout(() => setNotices((items) => items.filter((item) => item.id !== id)), 3600);
  };

  useEffect(() => {
    const syncAncientPullsSkin = (event: Event) => {
      const key = (event as CustomEvent<{ key?: SkinId }>).detail?.key;
      if (!key || !SKINS.some((skin) => skin.id === key)) return;
      setState((current) => current.ownedSkins.includes(key) ? { ...current, selectedSkin: key } : current);
    };
    window.addEventListener("pocketpulls:nebu-skin-changed", syncAncientPullsSkin);
    return () => window.removeEventListener("pocketpulls:nebu-skin-changed", syncAncientPullsSkin);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const toSave = { ...state, lastSeen: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const saveTimer = window.setTimeout(() => {
      void fetch("/api/player/duat/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ state: { ...state, lastSeen: Date.now() } }),
      });
    }, 1800);
    return () => window.clearTimeout(saveTimer);
  }, [accessToken, hydrated, state]);

  useEffect(() => {
    const heartbeat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/player/duat/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ elapsedSeconds: 30 }),
        });
        const payload = await response.json();
        if (response.ok) setAttunementSeconds(Number(payload.activeSeconds) || 0);
      } catch {
        // A missed heartbeat simply grants no server-side forge time.
      }
    };
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    return () => window.clearInterval(interval);
  }, [accessToken]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const production = window.setInterval(() => {
      setState((current) => {
        const gain = productionPerMinute(current) / 12;
        if (gain <= 0) return current;
        const next = cloneState(current);
        next.resources.dust += gain;
        next.lastSeen = Date.now();
        return next;
      });
    }, 5000);
    return () => window.clearInterval(production);
  }, [hydrated]);

  useEffect(() => {
    if (state.run.phase !== "combat") return;
    const battle = window.setInterval(() => {
      setState((current) => {
        if (current.run.phase !== "combat" || !current.run.enemy) return current;
        const next = cloneState(current);
        const enemy = next.run.enemy!;
        const criticalBonus = next.selectedSkin === "scarab" ? 0.1 : next.selectedSkin === "sherry" ? 0.08 : 0;
        const critical = Math.random() < 0.12 + criticalBonus;
        const boonAttack = 1 + next.run.boons["solar-claws"] * 0.2;
        const basicSkinPower = next.selectedSkin === "cosmic_nebu" ? 0.8 : next.selectedSkin === "nile" || next.selectedSkin === "pearl" ? 0.9 : 1;
        const traitGuard = enemy.trait === "armoured" ? 0.8 : 1;
        const damage = Math.max(1, Math.round(next.run.attack * boonAttack * basicSkinPower * traitGuard * (0.84 + Math.random() * 0.32) * (critical ? 1.85 : 1)));
        enemy.hp -= damage;
        next.run.combo = Math.min(3, next.run.combo + (critical ? 2 : 1));

        if (enemy.hp <= 0) {
          const depth = next.run.depth;
          const oath = getOath(next.run.oath);
          const boonDust = 1 + next.run.boons["gold-whiskers"] * 0.15 + (next.selectedSkin === "royal" ? 0.25 : 0);
          const chainMultiplier = 1 + Math.min(0.3, next.run.chain * 0.03);
          const dust = Math.round((32 + depth * 7) * (enemy.boss ? 4.5 : enemy.elite ? 2.3 : 1) * boonDust * chainMultiplier * oath.rewardMultiplier * relicDustMultiplier(next.relics));
          next.resources.dust += dust;
          const glyphChance = 0.25 + next.buildings.scarabWorks * 0.08 + Math.min(0.2, (oath.rewardMultiplier - 1) * 0.25);
          const glyphs = Math.random() < glyphChance ? (enemy.elite ? 2 : 1) : 0;
          next.resources.glyphs += glyphs;
          if (next.selectedSkin === "royal" && enemy.elite && glyphs === 0) next.resources.glyphs += 1;
          if (enemy.elite && (next.relics.includes("pharaoh-eye") || enemy.boss || Math.random() < 0.72)) next.resources.flames += enemy.boss ? 2 : 1;
          const relicChance = (enemy.boss ? 1 : enemy.elite ? 0.32 : 0.055) + next.run.boons["pharaoh-curiosity"] * 0.05 + (next.selectedSkin === "midnight" ? 0.08 : 0);
          const found = Math.random() < relicChance ? discoverRelic(next.relics, enemy.elite) : null;
          if (found) {
            next.relics.push(found.id);
            next.run.discovery = found.id;
          }
          next.enemiesDefeated += 1;
          next.roomsCleared += 1;
          next.skinMastery[next.selectedSkin] += enemy.boss ? 5 : enemy.elite ? 3 : 1;
          const fateBase = enemy.boss ? 50 : enemy.elite ? 30 : 14;
          const fateBonus = next.selectedSkin === "scarab" && enemy.elite ? 15 : 0;
          next.run.fate += Math.round((fateBase + fateBonus) * (next.selectedSkin === "lotus" ? 1.2 : 1));
          if (next.run.fate >= 100) {
            next.run.fate -= 100;
            next.run.fateSurge = true;
          }
          next.run.chain = next.run.hp / next.run.maxHp >= 0.7 ? next.run.chain + 1 : 0;
          next.run.bestChain = Math.max(next.run.bestChain, next.run.chain);
          const newDepth = depth + 1;
          next.run.depth = newDepth;
          next.run.maxDepth = Math.max(next.run.maxDepth, newDepth);
          const earnedBoon = enemy.boss || enemy.elite || newDepth % 3 === 0;
          next.run.phase = earnedBoon ? "reward" : "choice";
          next.run.pendingBoons = earnedBoon ? makeBoonChoices(next.run.boons) : [];
          next.run.enemy = null;
          next.run.choices = makeChoices(newDepth);
          const postBattleHeal = next.run.boons["life-thread"] * 8 + (next.selectedSkin === "lotus" ? 10 : 0);
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + Math.round(postBattleHeal * (next.selectedSkin === "nile" ? 1.3 : 1)));
          next.run.guard = 0;
          next.run.history = [`Defeated ${enemy.name} at depth ${depth}.`, ...next.run.history].slice(0, 4);
          if (next.relics.includes("star-bell") && next.roomsCleared % 5 === 0) next.resources.glyphs += 1;
          return next;
        }

        if (enemy.boss && !enemy.enraged && enemy.hp <= enemy.maxHp * 0.5) {
          enemy.enraged = true;
          enemy.attack = Math.round(enemy.attack * 1.35);
        }
        if (enemy.stunned > 0) {
          enemy.stunned -= 1;
          return next;
        }
        const wardArmor = next.run.boons["moon-ward"] * 2 + (next.selectedSkin === "pearl" ? 2 : 0);
        const blocked = next.run.guard > 0;
        const enemyPower = enemy.weakened ? 0.7 : 1;
        const received = blocked ? Math.max(1, Math.floor(enemy.attack * enemyPower * 0.18)) : Math.max(1, Math.round(enemy.attack * enemyPower) - next.run.armor - wardArmor);
        if (blocked) next.run.guard -= 1;
        next.run.hp -= received;
        if (enemy.trait === "leeching") enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.max(1, Math.round(received * 0.45)));
        if (next.run.hp <= 0) {
          next.run.hp = 0;
          next.run.phase = "defeat";
          next.run.combo = 0;
        }
        return next;
      });
    }, 820);
    return () => window.clearInterval(battle);
  }, [state.run.phase]);

  useEffect(() => {
    if (!adOpen) return;
    const timer = window.setInterval(() => setAdSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [adOpen]);

  const biome = biomeFor(state.run.depth);
  const activeSkin = getSkin(state.selectedSkin);
  const activeOath = getOath(state.run.oath);
  const masteryXp = state.skinMastery[state.selectedSkin] ?? 0;
  const masteryLevel = Math.min(10, Math.floor(masteryXp / 12));
  const masteryProgress = masteryLevel >= 10 ? 100 : ((masteryXp % 12) / 12) * 100;
  const quickness = Math.max(0.4, 1 - state.run.boons["quick-paws"] * 0.12);
  const skillCooldown = (state.relics.includes("bastet-thread") ? 4500 : 6000) * quickness;
  const skillRemaining = Math.max(0, state.run.skillReadyAt - now);
  const guardRemaining = Math.max(0, state.run.guardReadyAt - now);
  const skinRemaining = Math.max(0, state.run.skinReadyAt - now);
  const displayedAttack = Math.round(state.run.attack * (1 + state.run.boons["solar-claws"] * 0.2));
  const production = productionPerMinute(state);
  const nextEclipseDepth = 30;

  const enterRoute = (route: RouteChoice) => {
    setState((current) => {
      if (current.run.phase !== "choice") return current;
      const next = cloneState(current);
      const oath = getOath(next.run.oath);
      if (route.kind === "battle" || route.kind === "elite" || route.kind === "boss") {
        next.run.enemy = makeEnemy(next.run.depth, next.eclipse, route.kind === "elite", route.kind === "boss", oath.enemyMultiplier, next.selectedSkin);
        next.run.phase = "combat";
        if (route.kind === "boss" && next.selectedSkin === "cosmic_nebu") next.run.combo = Math.max(1, next.run.combo);
        next.run.history = [`Entered ${route.title}.`, ...next.run.history].slice(0, 4);
        return next;
      }

      const completeRoom = () => {
        const newDepth = next.run.depth + 1;
        next.run.depth = newDepth;
        next.run.maxDepth = Math.max(next.run.maxDepth, newDepth);
        next.roomsCleared += 1;
        next.skinMastery[next.selectedSkin] += 1;
        next.run.fate += next.selectedSkin === "lotus" ? 12 : 10;
        if (next.run.fate >= 100) {
          next.run.fate -= 100;
          next.run.fateSurge = true;
        }
        next.run.choices = makeChoices(newDepth);
        if (next.relics.includes("star-bell") && next.roomsCleared % 5 === 0) next.resources.glyphs += 1;
      };

      if (route.kind === "vault") {
        const found = discoverRelic(next.relics, true);
        next.resources.dust += Math.round((90 + next.run.depth * 11) * (next.selectedSkin === "midnight" ? 1.2 : 1) * oath.rewardMultiplier * relicDustMultiplier(next.relics));
        if (found) {
          next.relics.push(found.id);
          next.run.discovery = found.id;
        } else {
          next.resources.flames += 1;
        }
        completeRoom();
      } else if (route.kind === "spring") {
        if (next.selectedSkin === "sherry") next.run.hp += Math.round((next.run.maxHp - next.run.hp) * 0.7);
        else next.run.hp = next.run.maxHp;
        if (next.selectedSkin === "nile") next.resources.glyphs += 1;
        next.resources.dust += 35;
        completeRoom();
      } else if (route.kind === "altar") {
        if (next.resources.dust >= 50) {
          next.resources.dust -= 50;
          if (Math.random() < 0.36 + next.buildings.sunTemple * 0.04 + (next.selectedSkin === "sunstone" ? 0.25 : 0)) next.resources.flames += 1;
          else next.resources.glyphs += 2;
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + 24);
          completeRoom();
        } else {
          next.run.enemy = makeEnemy(next.run.depth + 1, next.eclipse, true, false, oath.enemyMultiplier, next.selectedSkin);
          next.run.phase = "combat";
        }
      } else {
        const events = ["sarcophagus", "star-door", "lost-spirit"];
        next.run.eventId = events[Math.floor(Math.random() * events.length)];
        next.run.phase = "event";
      }
      return next;
    });
  };

  const solarPounce = () => {
    if (state.run.phase !== "combat" || skillRemaining > 0) return;
    setState((current) => {
      if (!current.run.enemy || current.run.skillReadyAt > Date.now()) return current;
      const next = cloneState(current);
      const skinPower = next.selectedSkin === "sunstone" ? 0.7 : 0;
      const cosmicPower = next.selectedSkin === "cosmic_nebu" ? 1.25 : 1;
      const bubblesPower = next.selectedSkin === "bubbles" ? 0.85 : 1;
      next.run.enemy!.hp -= Math.round(next.run.attack * (3.4 + skinPower + next.run.boons["star-roar"] * 0.45) * cosmicPower * bubblesPower);
      next.run.skillReadyAt = Date.now() + skillCooldown;
      next.run.combo = Math.min(3, next.run.combo + 1);
      return next;
    });
    notify("Solar Pounce", "Nebu tears through the veil for massive damage.", "violet");
  };

  const moonGuard = () => {
    if (state.run.phase !== "combat" || guardRemaining > 0) return;
    setState((current) => {
      if (!current.run.enemy || current.run.guardReadyAt > Date.now()) return current;
      const next = cloneState(current);
      next.run.guard = next.selectedSkin === "bubbles" || next.selectedSkin === "pearl" ? 3 : 2;
      next.run.guardReadyAt = Date.now() + 8500 * quickness * (next.selectedSkin === "sunstone" ? 1.2 : 1);
      const healing = 6 + next.run.boons["moon-ward"] * 3 + (next.selectedSkin === "bubbles" ? 12 : 0);
      next.run.hp = Math.min(next.run.maxHp, next.run.hp + Math.round(healing * (next.selectedSkin === "nile" ? 1.3 : 1)));
      return next;
    });
    notify("Moon Ward", state.selectedSkin === "bubbles" ? "Bubbles blocks three attacks and restores extra vitality." : state.selectedSkin === "pearl" ? "Celestial Pearl raises a three-layer lunar shell." : "The next two attacks are reduced and Nebu restores vitality.", "violet");
  };

  const novaBurst = () => {
    if (state.run.phase !== "combat" || state.run.combo < 3) return;
    setState((current) => {
      if (!current.run.enemy || current.run.combo < 3) return current;
      const next = cloneState(current);
      next.run.enemy!.hp -= Math.round(next.run.attack * (2.4 + next.run.combo * 0.38) * (next.selectedSkin === "cosmic_nebu" ? 1.25 : 1));
      next.run.combo = 0;
      return next;
    });
    notify("Constellation Burst", "Stored starlight detonates around the guardian.", "violet");
  };

  const useSkinTechnique = () => {
    if (state.run.phase !== "combat" || skinRemaining > 0) return;
    setState((current) => {
      if (!current.run.enemy || current.run.skinReadyAt > Date.now()) return current;
      const next = cloneState(current);
      const enemy = next.run.enemy!;
      let damage = 0;
      switch (next.selectedSkin) {
        case "midnight":
          damage = next.run.attack * 2.4;
          next.run.combo = Math.min(3, next.run.combo + 2);
          break;
        case "nile":
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + Math.round(next.run.maxHp * 0.28 * 1.3));
          enemy.stunned += 1;
          break;
        case "lotus":
          damage = next.run.attack * 2.2;
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + Math.round(damage * 0.5));
          break;
        case "scarab":
          damage = next.run.attack * (enemy.elite ? 5.2 : 2.6);
          break;
        case "sunstone":
          damage = next.run.attack * 4.8;
          next.run.hp = Math.max(1, next.run.hp - Math.round(next.run.maxHp * 0.05));
          break;
        case "royal":
          damage = next.run.attack * 2.2;
          enemy.weakened = true;
          break;
        case "pearl":
          damage = enemy.attack * 2;
          next.run.guard = Math.max(4, next.run.guard);
          break;
        case "sherry":
          damage = enemy.hp / enemy.maxHp <= 0.3 && enemy.weakened ? enemy.hp : next.run.attack * 3.3;
          break;
        case "bubbles":
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + Math.round(next.run.maxHp * 0.25));
          next.run.guard = Math.max(3, next.run.guard);
          enemy.stunned += 1;
          break;
        case "cosmic_nebu":
          damage = next.run.attack * 6.5;
          next.run.hp = Math.max(1, next.run.hp - Math.round(next.run.maxHp * 0.07));
          break;
      }
      enemy.hp -= Math.round(damage);
      next.run.skinReadyAt = Date.now() + 14_000 * quickness;
      return next;
    });
    notify(activeSkin.techniqueName, activeSkin.technique, activeSkin.rarity === "legendary" ? "violet" : "gold");
  };

  const chooseBoon = (boonId: BoonId) => {
    const boon = BOONS.find((item) => item.id === boonId);
    if (!boon) return;
    setState((current) => {
      if (current.run.phase !== "reward" || !current.run.pendingBoons.includes(boonId)) return current;
      const next = cloneState(current);
      next.run.boons[boonId] = Math.min(5, next.run.boons[boonId] + (current.run.fateSurge ? 2 : 1));
      if (boonId === "comet-heart") {
        next.run.maxHp += 14;
        next.run.hp = Math.min(next.run.maxHp, next.run.hp + 22);
      }
      next.run.armor = 1 + next.run.boons["moon-ward"] * 2;
      next.run.pendingBoons = [];
      next.run.fateSurge = false;
      next.run.phase = "choice";
      next.run.history = [`Accepted ${boon.name}.`, ...next.run.history].slice(0, 4);
      return next;
    });
    notify(`${boon.name} awakened`, boon.perLevel, boon.family === "cosmic" ? "violet" : "gold");
  };

  const resolveEvent = (option: "bold" | "wise") => {
    setState((current) => {
      if (current.run.phase !== "event" || !current.run.eventId) return current;
      const next = cloneState(current);
      const eventId = next.run.eventId;
      const complete = (message: string) => {
        const newDepth = next.run.depth + 1;
        next.run.depth = newDepth;
        next.run.maxDepth = Math.max(next.run.maxDepth, newDepth);
        next.roomsCleared += 1;
        next.run.phase = "choice";
        next.run.eventId = null;
        next.run.choices = makeChoices(newDepth);
        next.run.history = [message, ...next.run.history].slice(0, 4);
      };

      if (eventId === "sarcophagus") {
        if (option === "bold" && Math.random() < 0.72) {
          const found = discoverRelic(next.relics, true);
          if (found) { next.relics.push(found.id); next.run.discovery = found.id; }
          else next.resources.flames += 2;
          complete("Opened the singing sarcophagus.");
        } else if (option === "bold") {
          next.run.enemy = makeEnemy(next.run.depth + 2, next.eclipse, true, false, getOath(next.run.oath).enemyMultiplier, next.selectedSkin);
          if (next.selectedSkin === "sherry") {
            next.run.enemy.hp = Math.round(next.run.enemy.hp * 0.65);
            next.run.enemy.maxHp = next.run.enemy.hp;
            next.run.enemy.weakened = true;
          }
          next.run.phase = "combat";
          next.run.eventId = null;
        } else {
          next.resources.glyphs += 2;
          next.run.hp = Math.min(next.run.maxHp, next.run.hp + 18);
          complete("Translated the sarcophagus warning.");
        }
      } else if (eventId === "star-door") {
        if (option === "bold") {
          next.run.hp = Math.max(1, next.run.hp - Math.round(next.run.maxHp * 0.22));
          next.resources.dust += Math.round(280 * relicDustMultiplier(next.relics));
          next.resources.flames += Math.random() < .4 ? 1 : 0;
          complete("Forced open the starless door.");
        } else if (next.resources.flames >= 1) {
          next.resources.flames -= 1;
          const found = discoverRelic(next.relics, true);
          if (found) { next.relics.push(found.id); next.run.discovery = found.id; }
          else next.resources.fragments += 1;
          complete("Fed a flame to the starless door.");
        } else {
          next.resources.glyphs += 1;
          complete("Mapped the starless door for another age.");
        }
      } else {
        if (option === "bold") {
          next.resources.dust = Math.max(0, next.resources.dust - 80);
          next.resources.flames += 1;
          next.run.hp = next.run.maxHp;
          complete("Gave comfort to a nameless spirit.");
        } else {
          next.resources.glyphs += 2;
          next.run.combo = Math.min(3, next.run.combo + 2);
          complete("Followed the spirit's silent direction.");
        }
      }
      return next;
    });
  };

  const revive = () => {
    setState((current) => {
      const next = cloneState(current);
      next.run.boons = emptyBoons();
      next.run.pendingBoons = [];
      next.run.guard = 0;
      next.run.fate = 0;
      next.run.fateSurge = false;
      next.run.chain = 0;
      next.run.skinReadyAt = 0;
      next.run.armor = 1;
      next.run.depth = 0;
      next.run.maxHp = maxVitality(next.buildings, next.relics, next.eclipse);
      next.run.hp = next.run.maxHp;
      next.run.phase = "choice";
      next.run.enemy = null;
      next.run.choices = makeChoices(0);
      next.run.history = ["Nebu returned with memories of the fallen expedition."];
      return next;
    });
    notify("The Duat releases Nebu", "Your kingdom and discoveries remain. A new path has appeared.");
  };

  const returnToOasis = () => {
    setState((current) => {
      if (current.run.phase === "combat") return current;
      const next = cloneState(current);
      next.run.boons = emptyBoons();
      next.run.pendingBoons = [];
      next.run.guard = 0;
      next.run.fate = 0;
      next.run.fateSurge = false;
      next.run.chain = 0;
      next.run.skinReadyAt = 0;
      next.run.armor = 1;
      next.run.depth = 0;
      next.run.maxHp = maxVitality(next.buildings, next.relics, next.eclipse);
      next.run.hp = next.run.maxHp;
      next.run.choices = makeChoices(0);
      next.run.history = ["Nebu rested beneath the oasis palms."];
      return next;
    });
    notify("Rested at the oasis", "Nebu is restored. Your deepest path remains recorded.");
  };

  const upgradeBuilding = (buildingId: (typeof BUILDINGS)[number]["id"]) => {
    const level = state.buildings[buildingId];
    const cost = upgradeCost(buildingId, level);
    if (state.resources.dust < cost.dust || state.resources.glyphs < cost.glyphs) {
      notify("More materials required", `You need ${compact(cost.dust)} Stardust${cost.glyphs ? ` and ${cost.glyphs} Glyphs` : ""}.`, "red");
      return;
    }
    setState((current) => {
      const next = cloneState(current);
      next.resources.dust -= cost.dust;
      next.resources.glyphs -= cost.glyphs;
      next.buildings[buildingId] += 1;
      next.run.maxHp = maxVitality(next.buildings, next.relics, next.eclipse);
      next.run.hp = Math.min(next.run.maxHp, next.run.hp + (next.run.maxHp - current.run.maxHp));
      next.run.attack = attackPower(next.buildings, next.relics, next.eclipse);
      return next;
    });
    notify("Kingdom strengthened", `${BUILDINGS.find((item) => item.id === buildingId)?.name} reached level ${level + 1}.`);
  };

  const forgeFragment = async () => {
    if (
      state.resources.dust < FRAGMENT_RECIPE.dust ||
      state.resources.glyphs < FRAGMENT_RECIPE.glyphs ||
      state.resources.flames < FRAGMENT_RECIPE.flames
    ) {
      notify("The forge is incomplete", "Collect every ingredient to shape a Wish Fragment.", "red");
      return;
    }
    if (networkBusy) return;
    setNetworkBusy(true);
    try {
      const response = await fetch("/api/player/duat/forge", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The forge did not answer.");
      setAttunementSeconds(Number(payload.activeSeconds) || 0);
      setState((current) => {
        const next = cloneState(current);
        next.resources.dust -= FRAGMENT_RECIPE.dust;
        next.resources.glyphs -= FRAGMENT_RECIPE.glyphs;
        next.resources.flames -= FRAGMENT_RECIPE.flames;
        next.resources.fragments = Number(payload.fragments) || 0;
        return next;
      });
      notify("Wish Fragment forged", "A server-verified point of light joins the celestial ring.", "violet");
    } catch (error) {
      notify("The forge is still attuning", error instanceof Error ? error.message : "Stay active in the Duat a little longer.", "red");
    } finally {
      setNetworkBusy(false);
    }
  };

  const formWish = async () => {
    if (state.resources.fragments < WISH_FRAGMENTS) return;
    if (networkBusy) return;
    setNetworkBusy(true);
    try {
      const response = await fetch("/api/player/duat/claim-wish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The wish could not be formed.");
      setState((current) => ({
        ...current,
        resources: { ...current.resources, fragments: Number(payload.fragments) || 0, wishes: Number(payload.wishBalance) || 0 },
      }));
      window.dispatchEvent(new CustomEvent("pocketpulls:wish-balance", { detail: { wishBalance: Number(payload.wishBalance) || 0 } }));
      notify("A free wish is yours", "It is now in your real Ancient Pulls balance.", "violet");
    } catch (error) {
      notify("The constellation held", error instanceof Error ? error.message : "Please try again.", "red");
    } finally {
      setNetworkBusy(false);
    }
  };

  const claimAdReward = () => {
    if (adSeconds > 0) return;
    setState((current) => {
      const next = cloneState(current);
      next.resources.dust += 500 * relicDustMultiplier(next.relics);
      next.resources.glyphs += 1;
      next.nextAdAt = Date.now() + 2 * 60 * 60 * 1000;
      return next;
    });
    setAdOpen(false);
    window.dispatchEvent(new CustomEvent("ancientpulls:rewarded-ad-complete", { detail: { placement: "solar-caravan" } }));
    notify("Solar blessing received", "+500 Stardust and +1 Ancient Glyph.");
  };

  const openRewardedAd = () => {
    if (!canAd) return;
    setAdSeconds(5);
    setAdOpen(true);
  };

  const doEclipse = () => {
    if (state.run.maxDepth < nextEclipseDepth) return;
    setState((current) => {
      const next = cloneState(current);
      next.eclipse += 1;
      next.buildings = { observatory: 1, scarabWorks: 0, moonGarden: 0, sunTemple: 0, sanctuary: 0, pyramidGate: 0 };
      next.resources.dust = 250;
      next.resources.glyphs += 3;
      next.resources.flames += 2;
      next.run.depth = 0;
      next.run.maxDepth = 0;
      next.run.maxHp = maxVitality(next.buildings, next.relics, next.eclipse);
      next.run.hp = next.run.maxHp;
      next.run.attack = attackPower(next.buildings, next.relics, next.eclipse);
      next.run.phase = "choice";
      next.run.enemy = null;
      next.run.choices = makeChoices(0);
      next.run.boons = emptyBoons();
      next.run.pendingBoons = [];
      next.run.guard = 0;
      next.run.fate = 0;
      next.run.fateSurge = false;
      next.run.chain = 0;
      next.run.bestChain = 0;
      next.run.skinReadyAt = 0;
      next.run.armor = 1;
      next.run.history = [`Eclipse ${next.eclipse + 1} began beneath a changed sky.`];
      return next;
    });
    setTab("adventure");
    notify("The Eclipse begins", "The kingdom is buried, but Nebu carries its power into a stranger age.", "violet");
  };

  const prophecies = [
    { id: "rooms-10", title: "Walk ten hidden rooms", progress: state.roomsCleared, goal: 10, reward: "+220 Stardust" },
    { id: "enemies-8", title: "Defeat eight guardians", progress: state.enemiesDefeated, goal: 8, reward: "+4 Ancient Glyphs" },
    { id: "depth-12", title: "Reach depth twelve", progress: state.run.maxDepth, goal: 12, reward: "+1 Celestial Flame" },
  ];

  const claimProphecy = (id: string) => {
    const prophecy = prophecies.find((item) => item.id === id);
    if (!prophecy || prophecy.progress < prophecy.goal || state.propheciesClaimed.includes(id)) return;
    setState((current) => {
      const next = cloneState(current);
      next.propheciesClaimed.push(id);
      if (id === "rooms-10") next.resources.dust += 220;
      if (id === "enemies-8") next.resources.glyphs += 4;
      if (id === "depth-12") next.resources.flames += 1;
      return next;
    });
    notify("Prophecy fulfilled", prophecy.reward);
  };

  const selectSkin = async (skinId: SkinId) => {
    if (!state.ownedSkins.includes(skinId)) return;
    if (state.run.depth !== 0 || state.run.phase !== "choice") {
      notify("Return to the oasis first", "Nebu can only change form before an expedition begins.", "red");
      return;
    }
    const skin = getSkin(skinId);
    setState((current) => ({ ...current, selectedSkin: skinId }));
    window.localStorage.setItem("pocketpulls:nebu-skin-v1", skinId);
    window.dispatchEvent(new CustomEvent("pocketpulls:nebu-skin-changed", { detail: { key: skinId } }));
    window.dispatchEvent(new CustomEvent("ancientpulls:nebu-skin-selected", { detail: { skinId } }));
    const { error } = await supabase.auth.updateUser({ data: { nebu_skin: skinId } });
    if (error) notify("Coat saved on this device", "Ancient Pulls account sync will retry from the main wardrobe.", "red");
    notify(`${skin.name} equipped`, skin.passiveName, skin.rarity === "legendary" ? "violet" : "gold");
  };

  const selectOath = (oathId: OathId) => {
    if (state.run.depth !== 0 || state.run.phase !== "choice") return;
    const oath = getOath(oathId);
    setState((current) => ({ ...current, run: { ...current.run, oath: oathId } }));
    notify(`${oath.name} sworn`, oath.description, oathId === "voidbound" ? "violet" : "gold");
  };

  const discoveredRelic = state.run.discovery ? RELICS.find((relic) => relic.id === state.run.discovery) : null;
  const activeEvent = state.run.eventId ? EVENT_COPY[state.run.eventId] : null;
  const activeBoons = BOONS.filter((boon) => state.run.boons[boon.id] > 0);
  const wishProgress = Math.min(100, (state.resources.fragments / WISH_FRAGMENTS) * 100);
  const canAd = now >= state.nextAdAt;

  return (
    <main className="game-shell">
      <div className="ambient-stars" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" onClick={onExit} aria-label="Return to Ancient Pulls HQ">
          <span className="brand-star">✦</span>
          <span><b>ANCIENT PULLS</b><small>Nebu and the Endless Duat</small></span>
        </button>
        <div className="resource-row">
          <ResourcePill icon="✦" label="Stardust" value={state.resources.dust} />
          <ResourcePill icon="⌘" label="Glyphs" value={state.resources.glyphs} />
          <ResourcePill icon="☼" label="Flames" value={state.resources.flames} accent="flame" />
          <ResourcePill icon="◉" label="Wish balance" value={state.resources.wishes} accent="wish" />
          <button className="duat-exit" onClick={onExit}>Exit to HQ</button>
        </div>
      </header>

      <div className="game-layout">
        <aside className="sidebar">
          <button className="player-seal" onClick={() => setTab("skins")} aria-label="Change Nebu skin">
            <div className="seal-avatar">N</div>
            <div><small>ACTIVE NEBU</small><b>{activeSkin.name}</b></div>
            <span className="seal-level">E{state.eclipse + 1}</span>
          </button>
          <nav aria-label="Game sections">
            {NAV.map((item) => (
              <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                <span>{item.icon}</span>{item.label}
                {item.id === "forge" && state.resources.fragments > 0 && <i>{state.resources.fragments}</i>}
              </button>
            ))}
          </nav>

          <section className="prophecy-panel">
            <div className="section-kicker"><span>Prophecies</span><small>{state.propheciesClaimed.length}/3</small></div>
            {prophecies.map((prophecy) => {
              const claimed = state.propheciesClaimed.includes(prophecy.id);
              const complete = prophecy.progress >= prophecy.goal;
              return (
                <button key={prophecy.id} className={`prophecy ${complete ? "complete" : ""}`} disabled={!complete || claimed} onClick={() => claimProphecy(prophecy.id)}>
                  <span>{claimed ? "✓" : complete ? "!" : "○"}</span>
                  <div><b>{prophecy.title}</b><small>{claimed ? "Claimed" : complete ? `Claim ${prophecy.reward}` : `${Math.min(prophecy.progress, prophecy.goal)}/${prophecy.goal}`}</small></div>
                </button>
              );
            })}
          </section>

          <div className="sidebar-bottom">
            <div><small>Kingdom output</small><b>{compact(production)} ✦ / min</b></div>
            <div><small>Deepest path</small><b>{state.run.maxDepth} rooms</b></div>
          </div>
        </aside>

        <section className="content">
          {tab === "adventure" && (
            <div className="adventure-view">
              <div className="view-heading">
                <div><span className="eyebrow">Expedition · Depth {state.run.depth}</span><h1>{biome.name}</h1><p>{biome.subtitle}</p></div>
                <button className="quiet-button" onClick={returnToOasis} disabled={state.run.phase !== "choice"}>↩ Return to oasis</button>
              </div>

              <section className={`duat-stage phase-${state.run.phase}`}>
                <div className="stage-moon" />
                <div className="stage-pyramid pyramid-one" />
                <div className="stage-pyramid pyramid-two" />
                <div className="stage-dunes" />
                <div className="constellation-lines"><i /><i /><i /><i /><i /></div>

                <div className="fighter nebu-fighter">
                  <div className="fighter-label"><b>{activeSkin.name}</b><span>ATK {displayedAttack} · ARM {state.run.armor}</span></div>
                  <ProgressBar value={state.run.hp} max={state.run.maxHp} />
                  <small>{Math.max(0, Math.round(state.run.hp))} / {state.run.maxHp} vitality</small>
                  <Nebu skin={state.selectedSkin} fighting={state.run.phase === "combat"} defeated={state.run.phase === "defeat"} />
                </div>

                {state.run.enemy && (
                  <div className="fighter enemy-fighter">
                    <div className="fighter-label"><b>{state.run.enemy.name}</b><span>ATK {state.run.enemy.attack}</span></div>
                    <ProgressBar value={state.run.enemy.hp} max={state.run.enemy.maxHp} danger />
                    <small>{Math.max(0, Math.round(state.run.enemy.hp))} / {state.run.enemy.maxHp} essence</small>
                    {state.run.enemy.traitName && <span className={`enemy-trait ${state.run.enemy.enraged ? "enraged" : ""}`} title={state.run.enemy.traitDescription ?? ""}>{state.run.enemy.enraged ? "ENRAGED · " : ""}{state.run.enemy.weakened ? "WEAKENED · " : ""}{state.run.enemy.traitName}</span>}
                    <div className={`enemy-avatar ${state.run.enemy.elite ? "elite" : ""} ${state.run.enemy.boss ? "boss" : ""}`}><span>{state.run.enemy.icon}</span></div>
                  </div>
                )}

                {state.run.phase === "choice" && (
                  <div className="stage-message"><span>{state.run.choices.length === 1 ? "THE FIFTH GATE AWAKENS" : "THE PATH DIVIDES"}</span><b>{state.run.choices.length === 1 ? "Something ancient bars the path" : "Choose what Nebu discovers next"}</b></div>
                )}
                {state.run.phase === "combat" && (
                  <div className="battle-controls">
                    <button className="power-button solar" onClick={solarPounce} disabled={skillRemaining > 0}>
                      <span className="power-icon">✦</span>
                      <span><b>{skillRemaining > 0 ? `${(skillRemaining / 1000).toFixed(1)}s` : "Solar Pounce"}</b><small>{skillRemaining > 0 ? "Gathering sunlight" : "Explosive single strike"}</small></span>
                    </button>
                    <button className="power-button lunar" onClick={moonGuard} disabled={guardRemaining > 0}>
                      <span className="power-icon">☾</span>
                      <span><b>{guardRemaining > 0 ? `${(guardRemaining / 1000).toFixed(1)}s` : state.run.guard > 0 ? `Ward ×${state.run.guard}` : "Moon Ward"}</b><small>{state.selectedSkin === "bubbles" ? "Block three hits and recover more" : state.selectedSkin === "pearl" ? "Block three hits with extra armour" : "Block two hits and recover"}</small></span>
                    </button>
                    <button className="power-button nova" onClick={novaBurst} disabled={state.run.combo < 3}>
                      <span className="power-icon">✺</span>
                      <span><b>Starburst · {state.run.combo}/3</b><small>Spend combo for scaling damage</small></span>
                    </button>
                    <button className="power-button skin-technique" style={{ "--skin-accent": activeSkin.accent } as CSSProperties} onClick={useSkinTechnique} disabled={skinRemaining > 0}>
                      <span className="power-icon">{activeSkin.icon}</span>
                      <span><b>{skinRemaining > 0 ? `${(skinRemaining / 1000).toFixed(1)}s` : activeSkin.techniqueName}</b><small>{activeSkin.technique}</small></span>
                    </button>
                    <div className="auto-label"><i /> Basic attacks charge Starburst</div>
                  </div>
                )}
                {state.run.phase === "reward" && (
                  <div className="reward-overlay">
                    <span className="eyebrow">{state.run.fateSurge ? "Fate surge · double awakening" : "The constellation answers"}</span><h2>{state.run.fateSurge ? "Choose a power and gain two levels" : "Choose one power for this expedition"}</h2><p>Run boons stack up to five times and vanish only when Nebu returns to the oasis.</p>
                    <div className="boon-choice-grid">
                      {state.run.pendingBoons.map((boonId) => {
                        const boon = BOONS.find((item) => item.id === boonId)!;
                        return <button key={boon.id} className={`boon-choice ${boon.family}`} onClick={() => chooseBoon(boon.id)}><span>{boon.icon}</span><small>{boon.family} · level {Math.min(5, state.run.boons[boon.id] + (state.run.fateSurge ? 2 : 1))}</small><b>{boon.name}</b><p>{boon.description}</p><strong>{boon.perLevel}</strong></button>;
                      })}
                    </div>
                  </div>
                )}
                {state.run.phase === "event" && activeEvent && (
                  <div className="event-overlay">
                    <span className="event-icon">{activeEvent.icon}</span><span className="eyebrow">{activeEvent.eyebrow}</span><h2>{activeEvent.title}</h2><p>{activeEvent.body}</p>
                    <div><button onClick={() => resolveEvent("bold")}><b>{activeEvent.bold}</b><small>{activeEvent.boldHint}</small></button><button onClick={() => resolveEvent("wise")}><b>{activeEvent.wise}</b><small>{activeEvent.wiseHint}</small></button></div>
                  </div>
                )}
                {state.run.phase === "defeat" && (
                  <div className="defeat-card"><span>THE DUAT CLOSES</span><h2>Every ending reveals another entrance.</h2><p>Your relics, kingdom and resources remain. Nebu will remember this path.</p><button className="primary-button" onClick={revive}>Begin a new expedition</button></div>
                )}
              </section>

              {state.run.phase === "choice" && (
                <section className="routes-section">
                  {state.run.depth === 0 && (
                    <div className="oath-selector">
                      <div><span className="eyebrow">Risk shapes the reward</span><h3>Swear an expedition oath</h3><p>Higher oaths create stronger guardians, enemy traits and richer spoils. Change only at the oasis.</p></div>
                      <div className="oath-options">{OATHS.map((oath) => <button key={oath.id} className={state.run.oath === oath.id ? "active" : ""} onClick={() => selectOath(oath.id)}><span>{oath.icon}</span><b>{oath.name}</b><small>{oath.description}</small></button>)}</div>
                    </div>
                  )}
                  <div className="section-title"><div><span className="eyebrow">{state.run.choices.length === 1 ? "Fifth gate · no way around" : "Three doors · one decision"}</span><h2>{state.run.choices.length === 1 ? "A guardian blocks the path" : "Choose the next chamber"}</h2></div><span className="depth-marker">∞ THE DUAT HAS NO END</span></div>
                  <div className={`route-grid ${state.run.choices.length === 1 ? "boss-gate" : ""}`}>
                    {state.run.choices.map((route, index) => (
                      <button key={route.id} className={`route-card route-${route.kind}`} onClick={() => enterRoute(route)}>
                        <span className="route-number">0{index + 1}</span>
                        <span className="route-symbol">{route.kind === "boss" ? "☍" : route.kind === "elite" ? "◉" : route.kind === "battle" ? "♜" : route.kind === "spring" ? "☾" : route.kind === "vault" ? "◆" : route.kind === "altar" ? "☼" : "?"}</span>
                        <span className="eyebrow">{route.eyebrow}</span>
                        <b>{route.title}</b>
                        <p>{route.description}</p>
                        <span className="route-meta"><small>Danger {"✦".repeat(Math.min(5, Math.round(route.danger * activeOath.enemyMultiplier)))}{"·".repeat(Math.max(0, 5 - Math.round(route.danger * activeOath.enemyMultiplier)))}</small><small>{route.reward}</small></span>
                        <span className="enter-route">Enter chamber <i>→</i></span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="run-dashboard">
                <div className="run-boons"><span className="eyebrow">Current expedition build</span><div><span className="skin-run-passive" style={{ "--skin-accent": activeSkin.accent } as CSSProperties} title={activeSkin.passive}><i>{activeSkin.icon}</i><b>{activeSkin.passiveName}</b></span>{activeBoons.length ? activeBoons.map((boon) => <span className={`mini-boon ${boon.family}`} key={boon.id} title={`${boon.name}: ${boon.perLevel}`}><i>{boon.icon}</i><b>{state.run.boons[boon.id]}</b></span>) : <small>No boons yet.</small>}</div></div>
                <div className={`fate-card ${state.run.fateSurge ? "surging" : ""}`}><span className="eyebrow">Duat Fate · {activeOath.name}</span><div><ProgressBar value={state.run.fateSurge ? 100 : state.run.fate} max={100} /><small>{state.run.fateSurge ? "DOUBLE BOON READY" : `${state.run.fate} / 100 · flawless chain ×${state.run.chain}`}</small></div></div>
                <div className="run-history"><span className="eyebrow">Nebu remembers</span><p>{state.run.history[0]}</p></div>
                <div className="next-gate"><span className="eyebrow">Next named guardian</span><b>{5 - (state.run.depth % 5)} {5 - (state.run.depth % 5) === 1 ? "room" : "rooms"}</b></div>
              </section>
            </div>
          )}

          {tab === "kingdom" && (
            <div className="kingdom-view">
              <div className="view-heading"><div><span className="eyebrow">The city remembers</span><h1>Kingdom Beneath the Stars</h1><p>Every monument changes Nebu&apos;s expedition and continues working while you are gone.</p></div><div className="output-badge"><small>Total output</small><b>{compact(production)} ✦ / min</b></div></div>
              <section className="kingdom-scene">
                <div className="kingdom-sky"><i /><i /><i /><i /><i /></div>
                <div className="kingdom-moon" />
                <div className="city-building city-pyramid"><span>⟁</span></div>
                <div className="city-building city-temple"><span>☼</span></div>
                <div className="city-building city-observatory"><span>◒</span></div>
                <div className="city-ground" />
                <div className="kingdom-caption"><span>ECLIPSE AGE {state.eclipse + 1}</span><b>{state.eclipse === 0 ? "A kingdom newly awakened" : "A kingdom rebuilt from celestial memory"}</b></div>
              </section>
              <div className="building-grid">
                {BUILDINGS.map((building) => {
                  const level = state.buildings[building.id];
                  const cost = upgradeCost(building.id, level);
                  const affordable = state.resources.dust >= cost.dust && state.resources.glyphs >= cost.glyphs;
                  return (
                    <article className="building-card" key={building.id}>
                      <span className="building-icon">{building.icon}</span>
                      <div className="building-copy"><span className="eyebrow">Level {level}</span><h3>{building.name}</h3><p>{building.description}</p><b>{building.effect(level)}</b></div>
                      <button className={affordable ? "can-buy" : ""} onClick={() => upgradeBuilding(building.id)}>
                        <span>{level === 0 ? "Restore" : "Upgrade"}</span><small>{compact(cost.dust)} ✦ {cost.glyphs > 0 ? `· ${cost.glyphs} ⌘` : ""}</small>
                      </button>
                    </article>
                  );
                })}
              </div>
              <section className={`eclipse-panel ${state.run.maxDepth >= nextEclipseDepth ? "ready" : ""}`}>
                <div className="eclipse-orb"><span /></div>
                <div><span className="eyebrow">Permanent ascension</span><h2>Begin the next Eclipse</h2><p>Bury the current kingdom and enter a transformed age. Relics, wishes and permanent Eclipse power survive.</p><div className="eclipse-progress"><ProgressBar value={state.run.maxDepth} max={nextEclipseDepth} /><small>{state.run.maxDepth} / {nextEclipseDepth} depth reached</small></div></div>
                <button className="primary-button" disabled={state.run.maxDepth < nextEclipseDepth} onClick={doEclipse}>Enter Eclipse {state.eclipse + 2}</button>
              </section>
            </div>
          )}

          {tab === "relics" && (
            <div className="relics-view">
              <div className="view-heading"><div><span className="eyebrow">The impossible museum</span><h1>Relics of the Endless Duat</h1><p>Every discovery permanently alters the expedition. Find all nine, then search for their echoes in later ages.</p></div><div className="collection-count"><b>{state.relics.length}</b><small>of {RELICS.length} discovered</small></div></div>
              <div className="relic-grid">
                {RELICS.map((relic) => {
                  const owned = state.relics.includes(relic.id);
                  return (
                    <article key={relic.id} className={`relic-card rarity-${relic.rarity} ${owned ? "owned" : "locked"}`}>
                      <span className="relic-glow" />
                      <span className="relic-icon">{owned ? relic.icon : "?"}</span>
                      <span className="eyebrow">{owned ? relic.rarity : "Undiscovered"}</span>
                      <h3>{owned ? relic.name : "Unknown relic"}</h3>
                      <p>{owned ? relic.description : "Its shape has not yet returned to memory."}</p>
                      <small>{owned ? "POWER ACTIVE" : "FOUND IN VAULTS & ELITES"}</small>
                    </article>
                  );
                })}
              </div>
              <section className="museum-note"><span>◇</span><div><b>The museum is only the beginning.</b><p>After every Eclipse, discovered relics remain active while rarer echoes begin appearing deeper in the Duat.</p></div></section>
            </div>
          )}

          {tab === "skins" && (
            <div className="skins-view">
              <div className="view-heading">
                <div><span className="eyebrow">Synced to the current Ancient Pulls wardrobe</span><h1>Nebu&apos;s Celestial Wardrobe</h1><p>The seven achievement coats, two administrator companions and Cosmic Nebu now carry their own passive, burden, active technique and mastery path.</p></div>
                <div className="skin-rule"><span>◇</span><div><b>Sidegrades, not shortcuts</b><small>Every strength carries a burden; forge recipes never change</small></div></div>
              </div>
              <section className={`active-skin-hero theme-${activeSkin.id}`} style={{ "--skin-accent": activeSkin.accent } as CSSProperties}>
                <div className="skin-stage"><div className="skin-orbit"><i /><i /></div><Nebu skin={state.selectedSkin} /></div>
                <div className="active-skin-copy"><span className="eyebrow">Currently equipped · {activeSkin.rarity}</span><h2>{activeSkin.name}</h2><strong>{activeSkin.title}</strong><p>{activeSkin.description}</p><div className="passive-callout"><span>{activeSkin.icon}</span><div><small>UNIQUE PASSIVE</small><b>{activeSkin.passiveName}</b><p>{activeSkin.passive}</p><em>{activeSkin.burden}</em></div></div><div className="technique-callout"><small>SKIN TECHNIQUE</small><b>{activeSkin.techniqueName}</b><p>{activeSkin.technique}</p></div></div>
                <div className="skin-family"><small>PLAYSTYLE</small><b>{activeSkin.family}</b><div className="mastery-block"><small>MASTERY {masteryLevel} / 10</small><div><span style={{ width: `${masteryProgress}%` }} /></div><em>{masteryXp} resonance points</em></div><span>{state.run.depth === 0 && state.run.phase === "choice" ? "Ready to change at the oasis" : "Finish or leave the current expedition to change"}</span></div>
              </section>
              <div className="skin-grid">
                {SKINS.map((skin) => {
                  const owned = state.ownedSkins.includes(skin.id);
                  const selected = state.selectedSkin === skin.id;
                  const skinMasteryLevel = Math.min(10, Math.floor((state.skinMastery[skin.id] ?? 0) / 12));
                  return (
                    <article className={`skin-card theme-${skin.id} ${selected ? "selected" : ""} ${owned ? "owned" : "locked"}`} style={{ "--skin-accent": skin.accent } as CSSProperties} key={skin.id}>
                      <div className="skin-card-visual"><span className="skin-halo" /><Nebu skin={skin.id} /><i className="skin-swatch" style={{ background: skin.swatch }} /></div>
                      <div className="skin-card-copy"><span className="eyebrow">{skin.rarity} · {skin.family}</span><h3>{skin.name}</h3><small>{skin.title}</small><span className="skin-unlock">{skin.unlock}</span><div className="mini-passive"><span>{skin.icon}</span><div><b>{skin.passiveName}</b><p>{skin.passive}</p><em>{skin.burden}</em></div></div><div className="mini-technique"><small>ACTIVE · MASTERY {skinMasteryLevel}</small><b>{skin.techniqueName}</b></div></div>
                      <button disabled={!owned || selected} onClick={() => void selectSkin(skin.id)}>{selected ? "Equipped" : owned ? state.run.depth === 0 && state.run.phase === "choice" ? "Equip this form" : "Return to oasis to equip" : "Not owned"}</button>
                    </article>
                  );
                })}
              </div>
              <section className="skin-integration-note"><span>⌘</span><div><b>Uses the real Ancient Pulls skin keys</b><p>Midnight Gold, Nile Dawn, Lotus Bloom, Scarab Glow, Sunstone, Royal Night, Celestial Pearl, Sherry, Bubbles and Cosmic Nebu use the same selection key and ownership hand-off as the main wardrobe.</p></div></section>
            </div>
          )}

          {tab === "forge" && (
            <div className="forge-view">
              <div className="view-heading"><div><span className="eyebrow">A reward with real purpose</span><h1>The Wish Forge</h1><p>Adventure, kingdom growth and prophecy converge here. Ten fragments become one free Ancient Pulls wish.</p></div><div className="wish-total"><span>◉</span><div><b>{state.resources.wishes}</b><small>Ancient Pulls balance</small></div></div></div>
              <div className="forge-layout">
                <section className="forge-core">
                  <div className="forge-rings"><i /><i /><i /><i /><span>{state.resources.fragments}</span></div>
                  <span className="eyebrow">Celestial convergence</span>
                  <h2>{state.resources.fragments < WISH_FRAGMENTS ? "Forge the next fragment" : "Your wish is complete"}</h2>
                  <p>{state.resources.fragments < WISH_FRAGMENTS ? `${WISH_FRAGMENTS - state.resources.fragments} fragments remain before the star answers.` : "The fragments are aligned. Claim the wish whenever you are ready."}</p>
                  <div className="wish-meter"><span style={{ width: `${wishProgress}%` }} /><b>{state.resources.fragments} / {WISH_FRAGMENTS}</b></div>
                  {state.resources.fragments < WISH_FRAGMENTS ? (
                    <button className="forge-button" disabled={networkBusy} onClick={() => void forgeFragment()}><span>✦</span><div><b>Forge one fragment</b><small>{FRAGMENT_RECIPE.dust} Stardust · {FRAGMENT_RECIPE.glyphs} Glyphs · {FRAGMENT_RECIPE.flames} Flame · {Math.floor(attunementSeconds / 60)}/12 active min</small></div></button>
                  ) : (
                    <button className="forge-button claim" disabled={networkBusy} onClick={() => void formWish()}><span>◉</span><div><b>Form one free wish</b><small>Send it to your Ancient Pulls balance</small></div></button>
                  )}
                </section>
                <div className="forge-side">
                  <section className="ingredient-panel">
                    <span className="eyebrow">Fragment ingredients</span>
                    <h3>Three kinds of progress</h3>
                    <div className="ingredient"><span>✦</span><div><b>Stardust</b><small>Kingdom and every expedition</small></div><strong>{compact(state.resources.dust)} / {FRAGMENT_RECIPE.dust}</strong></div>
                    <div className="ingredient"><span>⌘</span><div><b>Ancient Glyphs</b><small>Guardians and active choices</small></div><strong>{state.resources.glyphs} / {FRAGMENT_RECIPE.glyphs}</strong></div>
                    <div className="ingredient"><span>☼</span><div><b>Celestial Flames</b><small>Elites, prophecies and altars</small></div><strong>{state.resources.flames} / {FRAGMENT_RECIPE.flames}</strong></div>
                  </section>
                  <section className="sponsor-panel">
                    <div className="caravan-icon">☼</div><span className="eyebrow">Optional reward</span><h3>The Solar Caravan</h3><p>Receive a sponsor blessing. Never interrupts an expedition and never removes progress.</p>
                    <button onClick={openRewardedAd} disabled={!canAd}>{canAd ? "Receive blessing" : `Returns in ${Math.ceil((state.nextAdAt - now) / 3_600_000)}h`}<small>+500 Stardust · +1 Glyph</small></button>
                  </section>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <nav className="mobile-nav" aria-label="Game sections">
        {NAV.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}
      </nav>

      <div className="toast-stack" aria-live="polite">
        {notices.map((notice) => <div className={`toast ${notice.tone}`} key={notice.id}><span>{notice.tone === "red" ? "!" : "✦"}</span><div><b>{notice.title}</b><small>{notice.body}</small></div></div>)}
      </div>

      {offlineReport && (
        <div className="modal-backdrop">
          <section className="offline-modal">
            <button className="modal-close" onClick={() => setOfflineReport(null)} aria-label="Close">×</button>
            <div className="offline-sun">☼</div><span className="eyebrow">Nebu kept exploring</span><h2>The kingdom moved while you were away.</h2><p>During {offlineReport.minutes} minutes, the observatory charted new stars and the scarabs searched the ruins.</p>
            <div className="offline-loot"><div><span>✦</span><b>+{compact(offlineReport.dust)}</b><small>Stardust</small></div><div><span>⌘</span><b>+{offlineReport.glyphs}</b><small>Glyphs</small></div></div>
            <button className="primary-button" onClick={() => setOfflineReport(null)}>Continue the journey</button>
          </section>
        </div>
      )}

      {discoveredRelic && (
        <div className="modal-backdrop">
          <section className={`relic-modal rarity-${discoveredRelic.rarity}`}>
            <span className="reveal-rays" /><button className="modal-close" onClick={() => setState((current) => ({ ...current, run: { ...current.run, discovery: null } }))} aria-label="Close">×</button>
            <span className="eyebrow">Relic remembered · {discoveredRelic.rarity}</span><div className="reveal-relic">{discoveredRelic.icon}</div><h2>{discoveredRelic.name}</h2><p>{discoveredRelic.description}</p><small>ITS POWER IS NOW PERMANENTLY ACTIVE</small>
            <button className="primary-button" onClick={() => setState((current) => ({ ...current, run: { ...current.run, discovery: null } }))}>Carry it into the Duat</button>
          </section>
        </div>
      )}

      {adOpen && (
        <div className="modal-backdrop">
          <section className="ad-modal">
            <button className="modal-close" onClick={() => setAdOpen(false)} aria-label="Close">×</button>
            <span className="eyebrow">Rewarded placement</span><div className="ad-slot"><span>YOUR AD PARTNER</span><b>Celestial sponsor placement</b><small>This slot is ready for your rewarded-video provider.</small></div>
            <button className="primary-button" disabled={adSeconds > 0} onClick={claimAdReward}>{adSeconds > 0 ? `Reward unlocks in ${adSeconds}s` : "Claim solar blessing"}</button>
            <p className="ad-disclosure">Optional sponsor rewards are capped and never interrupt play.</p>
          </section>
        </div>
      )}
    </main>
  );
}
