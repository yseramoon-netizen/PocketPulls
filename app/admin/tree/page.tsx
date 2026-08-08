"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import { adminFetch } from "@/lib/admin/client-auth";
import { closeTreeGate, isTreeGateOpen } from "@/lib/admin/tree-gate";

import styles from "./tree.module.css";

type Branch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
  activeThisWeek: boolean;
};

type TreeSnapshot = {
  stage: string;
  stageIndex: number;
  growthScore: number;
  rawGrowthScore: number;
  gardenVisits: number;
  persistentGrowth: boolean;
  stageFloor: number;
  nextStageScore: number;
  stageProgress: number;
  stockCards: number;
  trainers: number;
  cardsFound: number;
  availableWishes: number;
  wishesSpent: number;
  valueShared: number;
  sharedCards: number;
  cardsPlantedToday: number;
  wishesToday: number;
  latestActivityAt: string | null;
  bothActiveThisWeek: boolean;
  branches: Branch[];
};

type TreeResponse = {
  ok: true;
  viewerEmail: string;
  generatedAt: string;
  tree: TreeSnapshot;
};

type WonderState = {
  firefliesCaught: number;
  leafFood: number;
  rareCareTreats: number;
  goldenSeeds: number;
  leafClicks: number;
  catchesToday: number;
  fairyVisits: number;
  fairyBlessings: number;
  moonWhispers: number;
  notes: string[];
};

type Toast = {
  id: number;
  title: string;
  body: string;
};

type Drop = {
  id: number;
  src: string;
  left: string;
  top: string;
  label: string;
};

type FairyVisit = {
  id: number;
  src: string;
  top: string;
  fromLeft: boolean;
  scale: number;
};

type VisualStage = {
  key: "seed" | "sapling" | "young" | "grove" | "ancient" | "million";
  label: string;
  asset: string;
  description: string;
  assetClassName: string;
  leafHotspots: Array<{ left: string; top: string }>;
  baseFireflies: number;
  ambientLevel: number;
};

const WONDER_KEY = "unown-pulls:tree-wonder:v16";
const LEGACY_WONDER_KEY = "unown-pulls:tree-wonder:v14";
const MILLION_GOAL = 1_000_000;

const FAIRIES = [
  "/tree-wonder/visitors/01-lantern-fairy.png",
  "/tree-wonder/visitors/02-waving-fairy.png",
  "/tree-wonder/visitors/03-gliding-fairy.png",
  "/tree-wonder/visitors/04-seed-fairy.png",
  "/tree-wonder/visitors/05-fairy-pair.png",
  "/tree-wonder/visitors/07-leaf-rest-fairy.png",
  "/tree-wonder/visitors/08-sleepy-leaf-fairy.png",
  "/tree-wonder/visitors/09-dancing-fairy.png",
  "/tree-wonder/visitors/10-peek-fairy.png",
  "/tree-wonder/visitors/12-tiny-fairy.png",
] as const;

const MOON_WHISPERS = [
  "The garden remembers every quiet bit of progress.",
  "Small roots still count. Keep building.",
  "Some nights are for growth. Some are simply for staying close to the light.",
  "The tree does not rush its seasons.",
  "A million begins with a seed that somebody kept watering.",
] as const;

const DEFAULT_WONDER: WonderState = {
  firefliesCaught: 0,
  leafFood: 0,
  rareCareTreats: 0,
  goldenSeeds: 0,
  leafClicks: 0,
  catchesToday: 0,
  fairyVisits: 0,
  fairyBlessings: 0,
  moonWhispers: 0,
  notes: [],
};

function parseWonder(raw: string | null): WonderState {
  if (!raw) return DEFAULT_WONDER;
  try {
    const value = JSON.parse(raw) as Partial<WonderState>;
    return {
      firefliesCaught: Math.max(0, Number(value.firefliesCaught) || 0),
      leafFood: Math.max(0, Number(value.leafFood) || 0),
      rareCareTreats: Math.max(0, Number(value.rareCareTreats) || 0),
      goldenSeeds: Math.max(0, Number(value.goldenSeeds) || 0),
      leafClicks: Math.max(0, Number(value.leafClicks) || 0),
      catchesToday: Math.max(0, Number(value.catchesToday) || 0),
      fairyVisits: Math.max(0, Number(value.fairyVisits) || 0),
      fairyBlessings: Math.max(0, Number(value.fairyBlessings) || 0),
      moonWhispers: Math.max(0, Number(value.moonWhispers) || 0),
      notes: Array.isArray(value.notes)
        ? value.notes.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
    };
  } catch {
    return DEFAULT_WONDER;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.max(0, Math.round(value)));
}

function buildStage(growth: number): VisualStage {
  if (growth >= MILLION_GOAL) {
    return {
      key: "million",
      label: "The hidden door awakens",
      asset: "/tree-wonder/tree-door.png",
      assetClassName: styles.treeMillion,
      description: "The million-growth promise has been reached. The old bark has opened a little door into whatever comes next.",
      leafHotspots: [
        { left: "31%", top: "32%" }, { left: "41%", top: "23%" }, { left: "52%", top: "28%" },
        { left: "63%", top: "23%" }, { left: "73%", top: "34%" }, { left: "38%", top: "43%" },
        { left: "58%", top: "45%" }, { left: "68%", top: "42%" },
      ],
      baseFireflies: 14,
      ambientLevel: 5,
    };
  }
  if (growth >= 700_000) {
    return {
      key: "ancient",
      label: "Ancient luminous grove",
      asset: "/tree-wonder/tree-vines.png",
      assetClassName: styles.treeAncient,
      description: "The canopy is old enough to collect its own little ecosystem: vines, visitors, mushrooms and wandering lights.",
      leafHotspots: [
        { left: "31%", top: "32%" }, { left: "41%", top: "23%" }, { left: "52%", top: "28%" },
        { left: "63%", top: "23%" }, { left: "73%", top: "34%" }, { left: "38%", top: "43%" }, { left: "58%", top: "45%" },
      ],
      baseFireflies: 11,
      ambientLevel: 4,
    };
  }
  if (growth >= 350_000) {
    return {
      key: "grove",
      label: "Living moon grove",
      asset: "/tree-wonder/tree-friends.png",
      assetClassName: styles.treeLarge,
      description: "The tree has become a real landmark. Tiny woodland visitors now treat the roots like home.",
      leafHotspots: [
        { left: "32%", top: "34%" }, { left: "43%", top: "26%" }, { left: "54%", top: "29%" },
        { left: "66%", top: "28%" }, { left: "72%", top: "39%" }, { left: "43%", top: "45%" },
      ],
      baseFireflies: 8,
      ambientLevel: 3,
    };
  }
  if (growth >= 100_000) {
    return {
      key: "young",
      label: "Young moonlit tree",
      asset: "/tree-wonder/tree-friends.png",
      assetClassName: styles.treeYoung,
      description: "The trunk is finding its shape and the garden is beginning to attract more than just fireflies.",
      leafHotspots: [
        { left: "38%", top: "34%" }, { left: "48%", top: "28%" }, { left: "58%", top: "31%" }, { left: "52%", top: "42%" },
      ],
      baseFireflies: 6,
      ambientLevel: 2,
    };
  }
  if (growth >= 15_000) {
    return {
      key: "sapling",
      label: "First green awakening",
      asset: "/tree-wonder/sapling.png",
      assetClassName: styles.treeSapling,
      description: "The seed has broken the soil. A few wandering lights have noticed.",
      leafHotspots: [
        { left: "44%", top: "38%" }, { left: "52%", top: "34%" }, { left: "57%", top: "40%" },
      ],
      baseFireflies: 3,
      ambientLevel: 1,
    };
  }
  return {
    key: "seed",
    label: "A promise in the soil",
    asset: "/tree-wonder/seedling.png",
    assetClassName: styles.treeSeed,
    description: "For now, it is meant to be small: a seedling, a few lights, and everything still ahead of Unown Pulls.",
    leafHotspots: [
      { left: "47%", top: "43%" }, { left: "53%", top: "39%" },
    ],
    baseFireflies: 2,
    ambientLevel: 0,
  };
}

export default function TreePage() {
  const router = useRouter();
  const fairyTimer = useRef<number | null>(null);
  const fairyExitTimer = useRef<number | null>(null);

  const [gateReady, setGateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<TreeResponse | null>(null);
  const [wonder, setWonder] = useState<WonderState>(DEFAULT_WONDER);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [hiddenFireflies, setHiddenFireflies] = useState<number[]>([]);
  const [fairy, setFairy] = useState<FairyVisit | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  const tree = data?.tree ?? null;
  const stage = useMemo(() => buildStage(tree?.growthScore ?? 0), [tree?.growthScore]);
  const millionProgress = Math.max(0, Math.min(100, ((tree?.growthScore ?? 0) / MILLION_GOAL) * 100));

  const toast = useCallback((title: string, body: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((items) => [...items, { id, title, body }].slice(-3));
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200);
  }, []);

  const note = useCallback((message: string) => {
    setWonder((current) => ({ ...current, notes: [message, ...current.notes].slice(0, 8) }));
  }, []);

  const load = useCallback(async (visit = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch<TreeResponse>(`/api/admin/tree${visit ? "?visit=1" : ""}`);
      setData(response);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "The hidden grove could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTreeGateOpen()) {
      router.replace("/admin");
      return;
    }
    setGateReady(true);
    void load(true);
  }, [load, router]);

  useEffect(() => {
    const raw = window.localStorage.getItem(WONDER_KEY) ?? window.localStorage.getItem(LEGACY_WONDER_KEY);
    setWonder(parseWonder(raw));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WONDER_KEY, JSON.stringify(wonder));
  }, [wonder]);

  const scheduleFairy = useCallback(() => {
    if (fairyTimer.current !== null) window.clearTimeout(fairyTimer.current);
    const level = stage.ambientLevel;
    const min = Math.max(9_000, 22_000 - level * 2_200);
    const max = Math.max(18_000, 42_000 - level * 3_300);
    const delay = Math.round(min + Math.random() * (max - min));

    fairyTimer.current = window.setTimeout(() => {
      const next: FairyVisit = {
        id: Date.now(),
        src: FAIRIES[Math.floor(Math.random() * FAIRIES.length)],
        top: `${18 + Math.round(Math.random() * 48)}%`,
        fromLeft: Math.random() > 0.5,
        scale: 0.78 + Math.random() * 0.38,
      };
      setFairy(next);
      setWonder((current) => ({ ...current, fairyVisits: current.fairyVisits + 1 }));
      note("A little fairy visited the grove.");

      fairyExitTimer.current = window.setTimeout(() => {
        setFairy(null);
        scheduleFairy();
      }, 13_500);
    }, delay);
  }, [note, stage.ambientLevel]);

  useEffect(() => {
    const first = window.setTimeout(() => {
      const next: FairyVisit = {
        id: Date.now(),
        src: FAIRIES[Math.floor(Math.random() * FAIRIES.length)],
        top: `${20 + Math.round(Math.random() * 38)}%`,
        fromLeft: Math.random() > 0.5,
        scale: 0.85,
      };
      setFairy(next);
      setWonder((current) => ({ ...current, fairyVisits: current.fairyVisits + 1 }));
      fairyExitTimer.current = window.setTimeout(() => {
        setFairy(null);
        scheduleFairy();
      }, 13_500);
    }, 4_500);

    return () => {
      window.clearTimeout(first);
      if (fairyTimer.current !== null) window.clearTimeout(fairyTimer.current);
      if (fairyExitTimer.current !== null) window.clearTimeout(fairyExitTimer.current);
    };
  }, [scheduleFairy]);

  const fireflies = useMemo(() => {
    return Array.from({ length: stage.baseFireflies }, (_, index) => ({
      left: `${15 + ((index * 23 + 9) % 72)}%`,
      top: `${26 + ((index * 17 + 5) % 48)}%`,
      delay: `${(index % 7) * 0.55}s`,
      size: 10 + (index % 3) * 3,
    }));
  }, [stage.baseFireflies]);

  const catchFirefly = useCallback((index: number) => {
    if (hiddenFireflies.includes(index)) return;
    setHiddenFireflies((items) => [...items, index]);
    setWonder((current) => ({
      ...current,
      firefliesCaught: current.firefliesCaught + 1,
      catchesToday: current.catchesToday + 1,
    }));
    toast("Firefly caught", "A warm little light settled into your jar.");
    note("You caught a firefly and tucked its glow into the garden jar.");
    window.setTimeout(() => setHiddenFireflies((items) => items.filter((item) => item !== index)), 14_000);
  }, [hiddenFireflies, note, toast]);

  const spawnDrop = useCallback((src: string, label: string, left: string, top: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setDrops((items) => [...items, { id, src, label, left, top }].slice(-4));
    window.setTimeout(() => setDrops((items) => items.filter((item) => item.id !== id)), 2600);
  }, []);

  const shakeLeaf = useCallback((left: string, top: string) => {
    const roll = Math.random();
    if (roll < 0.14) {
      setWonder((current) => ({ ...current, leafClicks: current.leafClicks + 1, rareCareTreats: current.rareCareTreats + 1 }));
      spawnDrop("/tree-wonder/icons/06-cupcake.png", "Rare Shaymin treat", left, top);
      toast("Rare Shaymin treat!", "A special mood-room snack fell from the leaves.");
      note("A rare Shaymin care treat tumbled out of the tree.");
      return;
    }
    if (roll < 0.24) {
      setWonder((current) => ({ ...current, leafClicks: current.leafClicks + 1, goldenSeeds: current.goldenSeeds + 1 }));
      spawnDrop("/tree-wonder/icons/07-golden-seed.png", "Golden seed", left, top);
      toast("Golden seed", "Something unusually bright was hiding in the leaves.");
      note("A golden seed dropped into the grass.");
      return;
    }
    setWonder((current) => ({ ...current, leafClicks: current.leafClicks + 1, leafFood: current.leafFood + 1 }));
    spawnDrop("/tree-wonder/icons/05-flower-food.png", "Shaymin food", left, top);
    toast("Shaymin food", "A little snack fell free from the leaves.");
    note("You shook a Shaymin snack from the tree.");
  }, [note, spawnDrop, toast]);

  const blessFairy = useCallback(() => {
    if (!fairy) return;
    setWonder((current) => ({ ...current, fairyBlessings: current.fairyBlessings + 1 }));
    toast("Fairy blessing", "The visitor left a tiny trail of stardust behind.");
    note("A visiting fairy left the grove with a happy sparkle.");
    setFairy(null);
    if (fairyExitTimer.current !== null) window.clearTimeout(fairyExitTimer.current);
    scheduleFairy();
  }, [fairy, note, scheduleFairy, toast]);

  const hearMoon = useCallback(() => {
    const message = MOON_WHISPERS[Math.floor(Math.random() * MOON_WHISPERS.length)];
    setWonder((current) => ({ ...current, moonWhispers: current.moonWhispers + 1 }));
    toast("Moon whisper", message);
    note(`Moon whisper: ${message}`);
  }, [note, toast]);

  if (!gateReady || (loading && !tree)) {
    return (
      <main className={styles.loadingPage}>
        <div className={styles.loadingOrb} />
        <p>Walking into the grove...</p>
      </main>
    );
  }

  return (
    <main className={styles.gardenPage}>
      <div className={styles.backgroundImage} />
      <div className={styles.backgroundVignette} />
      <div className={styles.starLayer} />
      <div className={styles.mistLayer} />

      <div className={styles.navWrap}><AdminNav /></div>

      <section className={styles.gardenStage} aria-label="The Tree We Grow garden">
        <button type="button" className={styles.moonButton} onClick={hearMoon} aria-label="Listen to the moon" title="Listen to the moon" />

        <div className={styles.topHud}>
          <div className={styles.stagePill}>
            <span className={styles.stageDot} />
            <div>
              <small>{stage.label}</small>
              <strong>{formatNumber(tree?.growthScore ?? 0)} growth</strong>
            </div>
          </div>

          <div className={styles.topActions}>
            <button type="button" onClick={() => setJournalOpen((value) => !value)} className={styles.hudButton}>Journal</button>
            <button type="button" onClick={() => setDetailsOpen((value) => !value)} className={styles.hudButton}>Grove details</button>
            <button type="button" onClick={() => void load(false)} className={styles.hudButton}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <div className={styles.treeWorld}>
          <div className={styles.treeHalo} />
          <img src={stage.asset} alt="The current growth stage of the Unown Pulls tree" draggable={false} className={`${styles.treeAsset} ${stage.assetClassName}`} />

          {stage.leafHotspots.map((spot, index) => (
            <button
              key={`${spot.left}-${spot.top}`}
              type="button"
              className={styles.leafHotspot}
              style={{ left: spot.left, top: spot.top }}
              onClick={() => shakeLeaf(spot.left, spot.top)}
              aria-label={`Shake leaf cluster ${index + 1} for Shaymin food`}
              title="Shake the leaves"
            ><span /></button>
          ))}

          {fireflies.map((firefly, index) => (
            <button
              key={`firefly-${index}`}
              type="button"
              className={styles.firefly}
              style={{
                left: firefly.left,
                top: firefly.top,
                width: `${firefly.size}px`,
                height: `${firefly.size}px`,
                animationDelay: firefly.delay,
                opacity: hiddenFireflies.includes(index) ? 0 : 1,
              }}
              onClick={() => catchFirefly(index)}
              aria-label="Catch firefly"
              title="Catch firefly"
            />
          ))}

          {fairy ? (
            <button
              key={fairy.id}
              type="button"
              onClick={blessFairy}
              className={`${styles.fairyVisitor} ${fairy.fromLeft ? styles.fairyFromLeft : styles.fairyFromRight}`}
              style={{ top: fairy.top, ["--fairy-scale" as string]: String(fairy.scale) }}
              aria-label="Greet visiting fairy"
              title="A fairy is visiting — say hello"
            >
              <img src={fairy.src} alt="A tiny visiting garden fairy" draggable={false} />
            </button>
          ) : null}

          {drops.map((drop) => (
            <div key={drop.id} className={styles.fallingDrop} style={{ left: drop.left, top: drop.top }}>
              <img src={drop.src} alt="" draggable={false} />
              <span>{drop.label}</span>
            </div>
          ))}

          {stage.ambientLevel >= 1 ? (
            <>
              <img src="/tree-wonder/visitors/blue-butterfly.png" alt="" draggable={false} className={`${styles.ambientSprite} ${styles.butterflyOne}`} />
              <img src="/tree-wonder/visitors/small-butterfly.png" alt="" draggable={false} className={`${styles.ambientSprite} ${styles.butterflyTwo}`} />
            </>
          ) : null}

          {stage.ambientLevel >= 2 ? (
            <>
              <img src="/tree-wonder/visitors/moth.png" alt="" draggable={false} className={`${styles.ambientSprite} ${styles.moth}`} />
              <img src="/tree-wonder/visitors/wisp-a.png" alt="" draggable={false} className={`${styles.ambientSprite} ${styles.wispOne}`} />
            </>
          ) : null}

          {stage.ambientLevel >= 3 ? (
            <>
              <img src="/tree-wonder/visitors/snail.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.snail}`} />
              <img src="/tree-wonder/visitors/frog.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.frog}`} />
              <img src="/tree-wonder/visitors/warm-mushrooms.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.warmMushrooms}`} />
            </>
          ) : null}

          {stage.ambientLevel >= 4 ? (
            <>
              <img src="/tree-wonder/visitors/rabbit.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.rabbit}`} />
              <img src="/tree-wonder/visitors/dragonfly.png" alt="" draggable={false} className={`${styles.ambientSprite} ${styles.dragonfly}`} />
              <img src="/tree-wonder/visitors/blue-mushrooms.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.blueMushrooms}`} />
              <img src="/tree-wonder/visitors/vine.png" alt="" draggable={false} className={`${styles.groundSprite} ${styles.magicVine}`} />
            </>
          ) : null}
        </div>

        <div className={styles.bottomHud}>
          <div className={styles.inventoryStrip}>
            <div><img src="/tree-wonder/icons/02-jar.png" alt="" /><span>Fireflies</span><strong>{formatNumber(wonder.firefliesCaught)}</strong></div>
            <div><img src="/tree-wonder/icons/05-flower-food.png" alt="" /><span>Shaymin food</span><strong>{formatNumber(wonder.leafFood)}</strong></div>
            <div><img src="/tree-wonder/icons/06-cupcake.png" alt="" /><span>Rare treats</span><strong>{formatNumber(wonder.rareCareTreats)}</strong></div>
            <div><img src="/tree-wonder/icons/07-golden-seed.png" alt="" /><span>Golden seeds</span><strong>{formatNumber(wonder.goldenSeeds)}</strong></div>
            <div className={styles.fairyCounter}><span>✧</span><span>Fairy blessings</span><strong>{formatNumber(wonder.fairyBlessings)}</strong></div>
          </div>

          <div className={styles.millionProgress}>
            <div className={styles.progressCopy}>
              <span>Hidden door</span>
              <strong>{millionProgress.toFixed(1)}%</strong>
              <small>{formatNumber(tree?.growthScore ?? 0)} / 1,000,000</small>
            </div>
            <div className={styles.progressTrack}><span style={{ width: `${millionProgress}%` }} /></div>
          </div>
        </div>

        {journalOpen ? (
          <aside className={styles.journalPanel}>
            <div className={styles.panelHeader}><div><small>Garden journal</small><h2>Things that happened here</h2></div><button onClick={() => setJournalOpen(false)}>×</button></div>
            <div className={styles.journalStats}>
              <span>{wonder.fairyVisits} fairy visits</span><span>{wonder.moonWhispers} moon whispers</span><span>{wonder.leafClicks} leaf shakes</span>
            </div>
            <div className={styles.noteList}>
              {wonder.notes.length ? wonder.notes.map((item, index) => <p key={`${item}-${index}`}>{item}</p>) : <p>The garden is quiet. Go catch a firefly or listen to the moon.</p>}
            </div>
          </aside>
        ) : null}

        {detailsOpen ? (
          <aside className={styles.detailsPanel}>
            <div className={styles.panelHeader}><div><small>Unown Pulls garden</small><h2>{stage.label}</h2></div><button onClick={() => setDetailsOpen(false)}>×</button></div>
            <p className={styles.panelBody}>{stage.description}</p>
            <div className={styles.detailGrid}>
              <div><span>Stock cards</span><strong>{formatNumber(tree?.stockCards ?? 0)}</strong></div>
              <div><span>Trainers</span><strong>{formatNumber(tree?.trainers ?? 0)}</strong></div>
              <div><span>Cards found</span><strong>{formatNumber(tree?.cardsFound ?? 0)}</strong></div>
              <div><span>Wishes spent</span><strong>{formatNumber(tree?.wishesSpent ?? 0)}</strong></div>
            </div>
            <div className={styles.branchList}>
              {(tree?.branches ?? []).map((branch) => (
                <div key={branch.email}><span className={branch.activeThisWeek ? styles.activeBranch : styles.inactiveBranch} /><p><strong>{branch.name}</strong><small>{formatNumber(branch.cardsPlanted)} cards planted</small></p></div>
              ))}
            </div>
            <div className={styles.panelActions}>
              <Link href="/admin">Back to operations</Link>
              <button onClick={() => { closeTreeGate(); router.push("/admin"); }}>Close secret path</button>
            </div>
          </aside>
        ) : null}
      </section>

      <div className={styles.toastStack}>
        {toasts.map((item) => <div key={item.id}><strong>{item.title}</strong><p>{item.body}</p></div>)}
      </div>
    </main>
  );
}
