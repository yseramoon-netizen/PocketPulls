"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import { adminFetch } from "@/lib/admin/client-auth";
import {
  closeTreeGate,
  isTreeGateOpen,
} from "@/lib/admin/tree-gate";

import styles from "./tree.module.css";

type Branch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
  activeThisWeek: boolean;
};

type Milestone = {
  score: number;
  label: string;
  reached: boolean;
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
  milestones: Milestone[];
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
  notes: string[];
};

type Toast = {
  id: number;
  title: string;
  body: string;
};

type VisualStage = {
  key:
    | "seed"
    | "sapling"
    | "young"
    | "moon"
    | "grove"
    | "ancient"
    | "million";
  label: string;
  asset: string;
  assetClassName: string;
  description: string;
  features: string[];
  leafHotspots: Array<{
    left: string;
    top: string;
  }>;
  fireflies: Array<{
    left: string;
    top: string;
    delay: string;
    size: number;
  }>;
  decorations: Array<{
    src: string;
    left: string;
    top: string;
    width: string;
    className?: string;
  }>;
};

const WONDER_KEY = "unown-pulls:tree-wonder:v14";
const MILLION_GOAL = 1_000_000;

const DEFAULT_WONDER_STATE: WonderState = {
  firefliesCaught: 0,
  leafFood: 0,
  rareCareTreats: 0,
  goldenSeeds: 0,
  leafClicks: 0,
  catchesToday: 0,
  notes: [],
};

function safeParseWonderState(raw: string | null): WonderState {
  if (!raw) {
    return DEFAULT_WONDER_STATE;
  }

  try {
    const value = JSON.parse(raw) as Partial<WonderState>;
    return {
      firefliesCaught: Math.max(0, Number(value.firefliesCaught) || 0),
      leafFood: Math.max(0, Number(value.leafFood) || 0),
      rareCareTreats: Math.max(0, Number(value.rareCareTreats) || 0),
      goldenSeeds: Math.max(0, Number(value.goldenSeeds) || 0),
      leafClicks: Math.max(0, Number(value.leafClicks) || 0),
      catchesToday: Math.max(0, Number(value.catchesToday) || 0),
      notes: Array.isArray(value.notes)
        ? value.notes
            .filter((item): item is string => typeof item === "string")
            .slice(0, 10)
        : [],
    };
  } catch {
    return DEFAULT_WONDER_STATE;
  }
}

function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.max(0, Math.round(value)));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "No recent activity";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildVisualStage(growthScore: number): VisualStage {
  if (growthScore >= MILLION_GOAL) {
    return {
      key: "million",
      label: "The hidden door awakens",
      asset: "/tree-wonder/tree-door.png",
      assetClassName: styles.assetAncient,
      description:
        "Unown Pulls has crossed the million-growth promise. The bark opens, the grove becomes a place of memory, and the little door appears in the trunk.",
      features: [
        "Secret tree door",
        "Root frame fully awakened",
        "Glowing vines",
        "Woodland visitors",
        "Maximum fireflies",
      ],
      leafHotspots: [
        { left: "24%", top: "25%" },
        { left: "38%", top: "19%" },
        { left: "51%", top: "24%" },
        { left: "66%", top: "22%" },
        { left: "78%", top: "33%" },
        { left: "31%", top: "40%" },
        { left: "48%", top: "42%" },
        { left: "64%", top: "43%" },
      ],
      fireflies: [
        { left: "21%", top: "24%", delay: "0s", size: 18 },
        { left: "30%", top: "51%", delay: "0.8s", size: 14 },
        { left: "43%", top: "27%", delay: "1.2s", size: 16 },
        { left: "53%", top: "54%", delay: "0.4s", size: 14 },
        { left: "64%", top: "30%", delay: "1.5s", size: 18 },
        { left: "74%", top: "44%", delay: "0.3s", size: 16 },
        { left: "80%", top: "61%", delay: "1.1s", size: 14 },
        { left: "19%", top: "67%", delay: "1.7s", size: 12 },
      ],
      decorations: [
        {
          src: "/tree-wonder/icons/10-vine-a.png",
          left: "18%",
          top: "29%",
          width: "9rem",
          className: styles.hangingVine,
        },
        {
          src: "/tree-wonder/icons/11-vine-b.png",
          left: "70%",
          top: "31%",
          width: "8rem",
          className: styles.hangingVine,
        },
      ],
    };
  }

  if (growthScore >= 700_000) {
    return {
      key: "ancient",
      label: "Ancient luminous grove",
      asset: "/tree-wonder/tree-vines.png",
      assetClassName: styles.assetAncient,
      description:
        "The grove is now deep and unforgettable. Mushrooms glow, vines begin to hang from the canopy, and little animals feel safe near the roots.",
      features: [
        "Glowing vines",
        "More fireflies",
        "Woodland animals",
        "Mushrooms around the roots",
      ],
      leafHotspots: [
        { left: "24%", top: "24%" },
        { left: "38%", top: "18%" },
        { left: "52%", top: "22%" },
        { left: "67%", top: "22%" },
        { left: "78%", top: "34%" },
        { left: "29%", top: "41%" },
        { left: "47%", top: "44%" },
        { left: "64%", top: "43%" },
      ],
      fireflies: [
        { left: "21%", top: "27%", delay: "0.2s", size: 18 },
        { left: "31%", top: "50%", delay: "0.7s", size: 14 },
        { left: "41%", top: "28%", delay: "1.4s", size: 16 },
        { left: "55%", top: "55%", delay: "0.4s", size: 14 },
        { left: "65%", top: "29%", delay: "1.5s", size: 18 },
        { left: "75%", top: "41%", delay: "0.3s", size: 16 },
        { left: "80%", top: "60%", delay: "1.2s", size: 14 },
      ],
      decorations: [
        {
          src: "/tree-wonder/icons/10-vine-a.png",
          left: "18%",
          top: "31%",
          width: "8rem",
          className: styles.hangingVine,
        },
        {
          src: "/tree-wonder/icons/11-vine-b.png",
          left: "68%",
          top: "32%",
          width: "7rem",
          className: styles.hangingVine,
        },
      ],
    };
  }

  if (growthScore >= 350_000) {
    return {
      key: "grove",
      label: "Rooted moon grove",
      asset: "/tree-wonder/tree-friends.png",
      assetClassName: styles.assetLarge,
      description:
        "The trunk thickens, the canopy becomes bolder, and the grove starts feeling inhabited. Mushrooms and little creatures begin to appear.",
      features: [
        "Woodland creatures",
        "Mushrooms",
        "Brighter roots",
        "More canopy leaves",
      ],
      leafHotspots: [
        { left: "23%", top: "25%" },
        { left: "37%", top: "20%" },
        { left: "51%", top: "24%" },
        { left: "67%", top: "22%" },
        { left: "77%", top: "36%" },
        { left: "31%", top: "43%" },
        { left: "49%", top: "45%" },
      ],
      fireflies: [
        { left: "21%", top: "28%", delay: "0s", size: 18 },
        { left: "31%", top: "53%", delay: "0.7s", size: 14 },
        { left: "45%", top: "30%", delay: "1.4s", size: 16 },
        { left: "56%", top: "57%", delay: "0.4s", size: 14 },
        { left: "66%", top: "30%", delay: "1.1s", size: 16 },
        { left: "77%", top: "43%", delay: "0.8s", size: 14 },
      ],
      decorations: [
        {
          src: "/tree-wonder/icons/08-mushrooms.png",
          left: "14%",
          top: "79%",
          width: "5rem",
        },
        {
          src: "/tree-wonder/icons/12-shaymin.png",
          left: "73%",
          top: "79%",
          width: "5rem",
        },
      ],
    };
  }

  if (growthScore >= 150_000) {
    return {
      key: "moon",
      label: "Moonlit young tree",
      asset: "/tree-wonder/tree-friends.png",
      assetClassName: styles.assetYoung,
      description:
        "It is unmistakably a tree now. The moonlight catches in the bark, the roots spread, and fireflies start gathering on their own.",
      features: [
        "Young glowing tree",
        "Brighter roots",
        "Steadier fireflies",
      ],
      leafHotspots: [
        { left: "26%", top: "29%" },
        { left: "40%", top: "23%" },
        { left: "54%", top: "27%" },
        { left: "66%", top: "28%" },
        { left: "34%", top: "44%" },
        { left: "53%", top: "46%" },
      ],
      fireflies: [
        { left: "26%", top: "31%", delay: "0s", size: 17 },
        { left: "37%", top: "55%", delay: "0.8s", size: 14 },
        { left: "50%", top: "33%", delay: "1.4s", size: 15 },
        { left: "62%", top: "57%", delay: "0.4s", size: 14 },
        { left: "72%", top: "42%", delay: "1.1s", size: 15 },
      ],
      decorations: [],
    };
  }

  if (growthScore >= 35_000) {
    return {
      key: "young",
      label: "Bright little sapling",
      asset: "/tree-wonder/sapling.png",
      assetClassName: styles.assetSapling,
      description:
        "The first true trunk appears. The little grove begins to remember your work and the first clusters of fireflies arrive.",
      features: [
        "Sapling form",
        "First real fireflies",
        "Tiny mushroom glow",
      ],
      leafHotspots: [
        { left: "40%", top: "26%" },
        { left: "51%", top: "25%" },
        { left: "60%", top: "29%" },
        { left: "46%", top: "38%" },
      ],
      fireflies: [
        { left: "31%", top: "30%", delay: "0s", size: 14 },
        { left: "45%", top: "57%", delay: "0.7s", size: 12 },
        { left: "60%", top: "36%", delay: "1.3s", size: 14 },
        { left: "71%", top: "51%", delay: "0.4s", size: 12 },
      ],
      decorations: [
        {
          src: "/tree-wonder/icons/08-mushrooms.png",
          left: "64%",
          top: "77%",
          width: "4rem",
        },
      ],
    };
  }

  if (growthScore >= 10_000) {
    return {
      key: "sapling",
      label: "First green awakening",
      asset: "/tree-wonder/sapling.png",
      assetClassName: styles.assetSeed,
      description:
        "The seed has broken the soil. A tiny glow appears, and the garden finally starts looking alive.",
      features: [
        "Small green sprout",
        "Soft floating lights",
      ],
      leafHotspots: [
        { left: "45%", top: "32%" },
        { left: "54%", top: "30%" },
        { left: "49%", top: "40%" },
      ],
      fireflies: [
        { left: "41%", top: "22%", delay: "0s", size: 12 },
        { left: "60%", top: "35%", delay: "0.9s", size: 12 },
      ],
      decorations: [],
    };
  }

  return {
    key: "seed",
    label: "A promise in the soil",
    asset: "/tree-wonder/seedling.png",
    assetClassName: styles.assetSeed,
    description:
      "Right now the tree stays humble on purpose: just a seedling, a little light, and the promise that the whole place will grow with Unown Pulls.",
    features: [
      "Seed stage",
      "Leaf clicks already work",
      "First catchable fireflies",
    ],
    leafHotspots: [
      { left: "46%", top: "34%" },
      { left: "53%", top: "31%" },
      { left: "50%", top: "40%" },
    ],
    fireflies: [
      { left: "44%", top: "22%", delay: "0s", size: 12 },
      { left: "57%", top: "35%", delay: "0.8s", size: 12 },
    ],
    decorations: [],
  };
}

function getProgressToMillion(growthScore: number): number {
  return Math.max(0, Math.min(100, (growthScore / MILLION_GOAL) * 100));
}

export default function TreeWonderPage() {
  const router = useRouter();

  const [data, setData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gateReady, setGateReady] = useState(false);
  const [wonderState, setWonderState] = useState<WonderState>(DEFAULT_WONDER_STATE);
  const [toastQueue, setToastQueue] = useState<Toast[]>([]);
  const [hiddenFireflies, setHiddenFireflies] = useState<number[]>([]);

  const tree = data?.tree ?? null;
  const visualStage = useMemo(() => buildVisualStage(tree?.growthScore ?? 0), [tree?.growthScore]);
  const millionProgress = getProgressToMillion(tree?.growthScore ?? 0);

  const pushToast = useCallback((title: string, body: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToastQueue((current) => [...current, { id, title, body }].slice(-3));
    window.setTimeout(() => {
      setToastQueue((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const appendNote = useCallback((message: string) => {
    setWonderState((current) => ({
      ...current,
      notes: [message, ...current.notes].slice(0, 6),
    }));
  }, []);

  const loadTree = useCallback(async (countVisit: boolean) => {
    setLoading(true);
    setError("");

    try {
      const suffix = countVisit ? "?visit=1" : "";
      const response = await adminFetch<TreeResponse>(`/api/admin/tree${suffix}`);
      setData(response);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The hidden grove could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setWonderState(
      safeParseWonderState(window.localStorage.getItem(WONDER_KEY)),
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(WONDER_KEY, JSON.stringify(wonderState));
  }, [wonderState]);

  useEffect(() => {
    if (!isTreeGateOpen()) {
      router.replace("/admin");
      return;
    }

    setGateReady(true);
    void loadTree(true);
  }, [loadTree, router]);

  const handleCatchFirefly = useCallback(
    (index: number) => {
      if (hiddenFireflies.includes(index)) {
        return;
      }

      setHiddenFireflies((current) => [...current, index]);
      setWonderState((current) => ({
        ...current,
        firefliesCaught: current.firefliesCaught + 1,
        catchesToday: current.catchesToday + 1,
      }));
      pushToast("Firefly caught", "One little light has been safely added to your jar.");
      appendNote("A firefly settled into the jar.");

      window.setTimeout(() => {
        setHiddenFireflies((current) => current.filter((value) => value !== index));
      }, 15_000);
    },
    [appendNote, hiddenFireflies, pushToast],
  );

  const handleLeafClick = useCallback(
    () => {
      const roll = Math.random();

      if (roll < 0.16) {
        setWonderState((current) => ({
          ...current,
          leafClicks: current.leafClicks + 1,
          rareCareTreats: current.rareCareTreats + 1,
        }));
        pushToast("Rare Shaymin treat", "A special care snack fell from the leaves for the mood room.");
        appendNote("A rare Shaymin care treat fell from the canopy.");
        return;
      }

      if (roll < 0.26) {
        setWonderState((current) => ({
          ...current,
          leafClicks: current.leafClicks + 1,
          goldenSeeds: current.goldenSeeds + 1,
        }));
        pushToast("Golden seed", "A glowing seed dropped from the grove. Keep it safe.");
        appendNote("A golden seed appeared between the roots.");
        return;
      }

      setWonderState((current) => ({
        ...current,
        leafClicks: current.leafClicks + 1,
        leafFood: current.leafFood + 1,
      }));
      pushToast("Shaymin food found", "A little snack dropped from the leaves.");
      appendNote("You shook a snack free from the leaves.");
    },
    [appendNote, pushToast],
  );

  const topNote = wonderState.notes[0] ?? visualStage.description;

  if (!gateReady || (loading && !tree)) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.backgroundGlow} />
        <div className={styles.pageInner}>
          <AdminNav />
          <div className={styles.loadingPanel}>
            <div className={styles.loadingOrb} />
            <p>Opening the hidden grove...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.pageShell}>
      <div className={styles.backgroundGlow} />
      <div className={styles.stars} />
      <div className={styles.pageInner}>
        <AdminNav />

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Shared hidden space</p>
            <h1 className={styles.title}>The Tree We Grow</h1>
            <p className={styles.description}>
              Rebuilt around your reference: a moonlit, layered, interactive grove for Unown Pulls. It starts as a seed, grows with the business, lets you catch fireflies, and drops little Shaymin snacks from the leaves.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => void loadTree(false)}
              className={styles.actionButton}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh grove"}
            </button>
            <Link href="/admin" className={styles.secondaryActionButton}>
              Back to admin
            </Link>
            <button
              type="button"
              onClick={() => {
                closeTreeGate();
                router.push("/admin");
              }}
              className={styles.ghostActionButton}
            >
              Close secret path
            </button>
          </div>
        </header>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <section className={styles.mainGrid}>
          <article className={styles.scenePanel}>
            <div className={styles.sceneBackdrop} />
            <div className={styles.sceneAura} />
            <img
              src="/tree-wonder/root-frame.png"
              alt=""
              className={styles.rootFrame}
              draggable={false}
            />

            <div className={styles.sceneCopyCard}>
              <div className={styles.sceneBadgeRow}>
                <span className={styles.sceneBadge}>{visualStage.label}</span>
                <span className={styles.sceneBadgeSoft}>{formatWholeNumber(tree?.growthScore ?? 0)} growth</span>
                {tree?.bothActiveThisWeek ? (
                  <span className={styles.sceneBadgeSoft}>Both branches active</span>
                ) : null}
              </div>
              <h2 className={styles.sceneHeading}>A more memorable hidden grove</h2>
              <p className={styles.sceneBody}>{visualStage.description}</p>
            </div>

            <div className={styles.treeViewport}>
              <img
                src={visualStage.asset}
                alt="The current tree growth stage"
                draggable={false}
                className={`${styles.treeAsset} ${visualStage.assetClassName}`}
              />

              {visualStage.decorations.map((decoration) => (
                <img
                  key={`${decoration.src}-${decoration.left}-${decoration.top}`}
                  src={decoration.src}
                  alt=""
                  draggable={false}
                  className={`${styles.decoration} ${decoration.className ?? ""}`}
                  style={{
                    left: decoration.left,
                    top: decoration.top,
                    width: decoration.width,
                  }}
                />
              ))}

              {visualStage.leafHotspots.map((spot, index) => (
                <button
                  key={`leaf-${index}`}
                  type="button"
                  onClick={handleLeafClick}
                  className={styles.leafHotspot}
                  style={{ left: spot.left, top: spot.top }}
                  aria-label="Shake the leaves for Shaymin food"
                  title="Shake the leaves"
                >
                  <span className={styles.leafPulse} />
                </button>
              ))}

              {visualStage.fireflies.map((firefly, index) => (
                <button
                  key={`firefly-${index}`}
                  type="button"
                  onClick={() => handleCatchFirefly(index)}
                  className={styles.fireflyButton}
                  style={{
                    left: firefly.left,
                    top: firefly.top,
                    width: `${firefly.size}px`,
                    height: `${firefly.size}px`,
                    animationDelay: firefly.delay,
                    opacity: hiddenFireflies.includes(index) ? 0 : 1,
                  }}
                  aria-label="Catch firefly"
                  title="Catch firefly"
                />
              ))}
            </div>

            <div className={styles.progressCard}>
              <div className={styles.progressHeader}>
                <div>
                  <p className={styles.miniLabel}>Progress to the hidden door</p>
                  <p className={styles.progressValue}>{millionProgress.toFixed(1)}%</p>
                </div>
                <div className={styles.progressAside}>
                  <span>Current {formatWholeNumber(tree?.growthScore ?? 0)}</span>
                  <span>Door at 1,000,000</span>
                </div>
              </div>
              <div className={styles.progressTrack}>
                <span className={styles.progressFill} style={{ width: `${millionProgress}%` }} />
              </div>
            </div>
          </article>

          <div className={styles.sidebar}>
            <article className={styles.infoCard}>
              <p className={styles.eyebrowMuted}>Grove inventory</p>
              <h3 className={styles.cardTitle}>Cute little systems</h3>
              <div className={styles.inventoryGrid}>
                <div className={styles.inventoryItem}>
                  <img src="/tree-wonder/icons/02-jar.png" alt="" className={styles.inventoryIcon} draggable={false} />
                  <div>
                    <p className={styles.inventoryLabel}>Caught fireflies</p>
                    <p className={styles.inventoryValue}>{formatWholeNumber(wonderState.firefliesCaught)}</p>
                  </div>
                </div>

                <div className={styles.inventoryItem}>
                  <img src="/tree-wonder/icons/05-flower-food.png" alt="" className={styles.inventoryIcon} draggable={false} />
                  <div>
                    <p className={styles.inventoryLabel}>Leaf food</p>
                    <p className={styles.inventoryValue}>{formatWholeNumber(wonderState.leafFood)}</p>
                  </div>
                </div>

                <div className={styles.inventoryItem}>
                  <img src="/tree-wonder/icons/06-cupcake.png" alt="" className={styles.inventoryIcon} draggable={false} />
                  <div>
                    <p className={styles.inventoryLabel}>Mood-room treats</p>
                    <p className={styles.inventoryValue}>{formatWholeNumber(wonderState.rareCareTreats)}</p>
                  </div>
                </div>

                <div className={styles.inventoryItem}>
                  <img src="/tree-wonder/icons/07-golden-seed.png" alt="" className={styles.inventoryIcon} draggable={false} />
                  <div>
                    <p className={styles.inventoryLabel}>Golden seeds</p>
                    <p className={styles.inventoryValue}>{formatWholeNumber(wonderState.goldenSeeds)}</p>
                  </div>
                </div>
              </div>

              <p className={styles.tipLine}>
                Tip: click the glowing leaf points to shake snacks loose, and catch the floating lights before they drift away.
              </p>
            </article>

            <article className={styles.infoCard}>
              <p className={styles.eyebrowMuted}>Current atmosphere</p>
              <h3 className={styles.cardTitle}>{visualStage.label}</h3>
              <p className={styles.bodyText}>{topNote}</p>

              <div className={styles.featureList}>
                {visualStage.features.map((feature) => (
                  <div key={feature} className={styles.featureChip}>
                    {feature}
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.infoCard}>
              <p className={styles.eyebrowMuted}>Business pulse</p>
              <h3 className={styles.cardTitle}>What is feeding the roots</h3>

              <div className={styles.statRows}>
                <div className={styles.statRow}>
                  <span>Stock cards</span>
                  <strong>{formatWholeNumber(tree?.stockCards ?? 0)}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Trainers</span>
                  <strong>{formatWholeNumber(tree?.trainers ?? 0)}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Cards found</span>
                  <strong>{formatWholeNumber(tree?.cardsFound ?? 0)}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Value shared</span>
                  <strong>{formatMoney(tree?.valueShared ?? 0)}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Wishes available</span>
                  <strong>{formatWholeNumber(tree?.availableWishes ?? 0)}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Last activity</span>
                  <strong>{formatDate(tree?.latestActivityAt ?? null)}</strong>
                </div>
              </div>
            </article>

            <article className={styles.infoCard}>
              <p className={styles.eyebrowMuted}>Keeper branches</p>
              <h3 className={styles.cardTitle}>Who fed the grove</h3>
              <div className={styles.branchList}>
                {(tree?.branches ?? []).map((branch) => (
                  <div key={branch.email} className={styles.branchItem}>
                    <div>
                      <p className={styles.branchName}>{branch.name}</p>
                      <p className={styles.branchMeta}>{formatWholeNumber(branch.cardsPlanted)} cards · {formatWholeNumber(branch.plantingSessions)} sessions</p>
                    </div>
                    <span className={branch.activeThisWeek ? styles.branchDotActive : styles.branchDot} />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <div className={styles.toastStack}>
          {toastQueue.map((toast) => (
            <div key={toast.id} className={styles.toastCard}>
              <p className={styles.toastTitle}>{toast.title}</p>
              <p className={styles.toastBody}>{toast.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
