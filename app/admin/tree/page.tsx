"use client";

import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
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

type Firefly = {
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
};

const FIREFLIES: Firefly[] = [
  { left: "10%", top: "22%", size: 5, delay: 0.2, duration: 8.2, driftX: 24, driftY: -18 },
  { left: "16%", top: "61%", size: 4, delay: 1.6, duration: 9.1, driftX: -18, driftY: -22 },
  { left: "22%", top: "41%", size: 6, delay: 0.8, duration: 10.2, driftX: 28, driftY: -26 },
  { left: "28%", top: "73%", size: 5, delay: 2.1, duration: 8.8, driftX: 16, driftY: -16 },
  { left: "35%", top: "28%", size: 4, delay: 1.2, duration: 9.7, driftX: -22, driftY: -18 },
  { left: "44%", top: "57%", size: 6, delay: 0.3, duration: 11.2, driftX: 20, driftY: -26 },
  { left: "52%", top: "38%", size: 5, delay: 1.8, duration: 9.8, driftX: 26, driftY: -20 },
  { left: "58%", top: "20%", size: 4, delay: 2.8, duration: 8.9, driftX: 14, driftY: -18 },
  { left: "66%", top: "67%", size: 6, delay: 0.7, duration: 10.8, driftX: -20, driftY: -24 },
  { left: "72%", top: "50%", size: 4, delay: 1.4, duration: 9.2, driftX: 22, driftY: -20 },
  { left: "78%", top: "33%", size: 5, delay: 2.4, duration: 9.9, driftX: -14, driftY: -16 },
  { left: "84%", top: "62%", size: 6, delay: 0.5, duration: 10.1, driftX: 18, driftY: -22 },
  { left: "90%", top: "26%", size: 4, delay: 1.9, duration: 8.7, driftX: -16, driftY: -16 },
];

const CANOPY_CLUSTERS = [
  { cx: 420, cy: 306, rx: 116, ry: 88, fill: "url(#leafA)" },
  { cx: 528, cy: 240, rx: 132, ry: 102, fill: "url(#leafB)" },
  { cx: 650, cy: 302, rx: 150, ry: 110, fill: "url(#leafA)" },
  { cx: 772, cy: 244, rx: 140, ry: 106, fill: "url(#leafB)" },
  { cx: 848, cy: 342, rx: 126, ry: 92, fill: "url(#leafC)" },
  { cx: 644, cy: 164, rx: 132, ry: 94, fill: "url(#leafGlow)" },
  { cx: 522, cy: 358, rx: 140, ry: 94, fill: "url(#leafC)" },
  { cx: 732, cy: 382, rx: 138, ry: 96, fill: "url(#leafA)" },
  { cx: 612, cy: 458, rx: 154, ry: 104, fill: "url(#leafB)" },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.round(value)),
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return "No recent activity";

  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function stageDescription(tree: TreeSnapshot): string {
  if (tree.growthScore >= 1_000_000) {
    return "The grove has become a legend. The moonlight, roots and memory of every shared pull now live in the same canopy.";
  }

  if (tree.stageIndex >= 5) {
    return "The garden is mature now: wide roots, deep branches and a glow that feels earned rather than decorative.";
  }

  if (tree.stageIndex >= 4) {
    return "The canopy has learned how to hold the moon. It feels calmer, taller and far more certain of itself.";
  }

  if (tree.stageIndex >= 3) {
    return "The trunk has found its character. More cards, more wishes and more evenings together all leave visible marks here.";
  }

  if (tree.stageIndex >= 2) {
    return "The sapling is becoming confident. Every stocked card and fulfilled wish adds weight, balance and shape.";
  }

  return "Still early, still gentle: the roots are taking hold and the scene is beginning to remember both keepers.";
}

function pulseNote(tree: TreeSnapshot): string {
  if (tree.bothActiveThisWeek) {
    return "Both keeper branches have been active this week, so the grove shows a faint paired shimmer rather than loud romance.";
  }

  if (tree.cardsPlantedToday > 0 || tree.wishesToday > 0) {
    return "Fresh movement today. The fireflies are brighter and the roots are quietly keeping score.";
  }

  return "Quiet night. The tree is resting, but the moon keeps the place alive until the next bit of progress arrives.";
}

function getViewerName(email: string): string {
  const normalised = email.toLowerCase();

  if (normalised === "pullspocket@gmail.com" || normalised.includes("lukas")) {
    return "Lukas";
  }

  if (normalised.includes("skye")) {
    return "Skye";
  }

  return email.split("@")[0] || "Keeper";
}

function LoadingState() {
  return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingOrb} />
      <p className={styles.loadingText}>Opening the hidden grove...</p>
    </div>
  );
}

function ScenicTree({
  tree,
  reducedMotion,
}: {
  tree: TreeSnapshot;
  reducedMotion: boolean;
}) {
  const millionReached = tree.growthScore >= 1_000_000;
  const canopyScale = 0.92 + Math.min(0.28, tree.stageIndex * 0.04 + tree.stageProgress / 520);
  const trunkScale = 0.9 + Math.min(0.22, tree.stageIndex * 0.03 + tree.stageProgress / 620);
  const sparkleCount = Math.min(14, Math.max(5, Math.round(tree.wishesToday + tree.stageIndex + 3)));

  return (
    <div
      className={styles.treeArt}
      style={{
        ["--canopy-scale" as string]: String(canopyScale),
        ["--trunk-scale" as string]: String(trunkScale),
      }}
    >
      <svg
        className={styles.treeSvg}
        viewBox="0 0 1200 900"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#584332" />
            <stop offset="48%" stopColor="#8c6548" />
            <stop offset="100%" stopColor="#281b15" />
          </linearGradient>
          <linearGradient id="branch" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a573f" />
            <stop offset="100%" stopColor="#2d2018" />
          </linearGradient>
          <radialGradient id="leafGlow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#baf6b6" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#5daa67" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#1d452c" stopOpacity="0.98" />
          </radialGradient>
          <radialGradient id="leafA" cx="45%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#9ae58d" />
            <stop offset="50%" stopColor="#4e9957" />
            <stop offset="100%" stopColor="#183825" />
          </radialGradient>
          <radialGradient id="leafB" cx="50%" cy="42%" r="82%">
            <stop offset="0%" stopColor="#c7f0b7" />
            <stop offset="52%" stopColor="#6bb66d" />
            <stop offset="100%" stopColor="#1d4b2b" />
          </radialGradient>
          <radialGradient id="leafC" cx="50%" cy="40%" r="85%">
            <stop offset="0%" stopColor="#7ed784" />
            <stop offset="55%" stopColor="#3f8450" />
            <stop offset="100%" stopColor="#163420" />
          </radialGradient>
          <radialGradient id="moonLight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#d7f0ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#d7f0ff" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="moonBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>

        <g opacity="0.84">
          <ellipse cx="640" cy="188" rx="198" ry="198" fill="url(#moonLight)" filter="url(#moonBlur)" />
          <circle cx="640" cy="192" r="112" fill="#eef8ff" fillOpacity="0.96" />
          <circle cx="675" cy="164" r="13" fill="#d6e7f2" fillOpacity="0.55" />
          <circle cx="612" cy="223" r="18" fill="#dbeaf5" fillOpacity="0.38" />
          <circle cx="588" cy="158" r="10" fill="#dbeaf5" fillOpacity="0.45" />
        </g>

        <g transform={`translate(0 0) scale(${trunkScale}) translate(${(1 - trunkScale) * 610} ${(1 - trunkScale) * 760})`}>
          <ellipse cx="622" cy="818" rx="228" ry="48" fill="#050b0b" fillOpacity="0.48" />
          <path
            d="M564 770 C540 684 556 622 572 540 C586 468 610 392 602 332 C597 288 572 264 552 236 C531 206 522 178 533 154 C549 120 594 118 616 152 C642 193 627 238 641 280 C654 320 686 343 715 330 C746 316 763 282 757 236 C751 194 774 171 800 175 C831 180 845 216 834 248 C822 284 795 306 784 342 C772 382 788 425 818 446 C846 466 888 457 904 424 C920 392 955 382 980 401 C1001 417 1007 450 991 475 C966 514 914 530 880 548 C842 568 819 602 810 646 C801 692 808 738 826 776 L564 770 Z"
            fill="url(#trunk)"
          />
          <path
            d="M564 770 C540 684 556 622 572 540 C586 468 610 392 602 332 C597 288 572 264 552 236"
            stroke="#241712"
            strokeWidth="20"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M613 203 C655 244 673 289 689 345"
            stroke="url(#branch)"
            strokeWidth="22"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M696 335 C718 300 741 275 770 254"
            stroke="url(#branch)"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M633 380 C595 338 565 316 532 308"
            stroke="url(#branch)"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M610 456 C560 450 505 470 468 505"
            stroke="url(#branch)"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M727 470 C784 470 836 490 872 526"
            stroke="url(#branch)"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M575 770 C548 798 512 816 470 824"
            stroke="#4d3a2f"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M612 770 C595 810 566 835 538 844"
            stroke="#4d3a2f"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
            opacity="0.78"
          />
          <path
            d="M695 770 C717 805 749 826 793 834"
            stroke="#4d3a2f"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M665 770 C676 807 694 832 722 846"
            stroke="#4d3a2f"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
        </g>

        <g
          transform={`translate(0 0) scale(${canopyScale}) translate(${(1 - canopyScale) * 620} ${(1 - canopyScale) * 330})`}
          filter="url(#softGlow)"
        >
          {CANOPY_CLUSTERS.map((cluster) => (
            <ellipse
              key={`${cluster.cx}-${cluster.cy}`}
              cx={cluster.cx}
              cy={cluster.cy}
              rx={cluster.rx}
              ry={cluster.ry}
              fill={cluster.fill}
              opacity="0.98"
            />
          ))}
        </g>

        <g opacity={tree.bothActiveThisWeek ? 0.65 : 0.24}>
          <circle cx="542" cy="620" r="7" fill="#f2eb9a" filter="url(#softGlow)" />
          <circle cx="574" cy="606" r="5" fill="#c9f7d9" filter="url(#softGlow)" />
          <circle cx="701" cy="598" r="7" fill="#f2eb9a" filter="url(#softGlow)" />
          <circle cx="733" cy="612" r="5" fill="#c9f7d9" filter="url(#softGlow)" />
        </g>

        {Array.from({ length: sparkleCount }).map((_, index) => {
          const baseX = 420 + ((index * 77) % 410);
          const baseY = 210 + ((index * 59) % 290);
          const opacity = 0.18 + ((index % 4) * 0.08);
          const radius = 2 + (index % 3);

          return (
            <g key={`sparkle-${index}`} opacity={opacity}>
              <circle cx={baseX} cy={baseY} r={radius} fill="#f6f1bb" />
              <path
                d={`M ${baseX - 5} ${baseY} L ${baseX + 5} ${baseY} M ${baseX} ${baseY - 5} L ${baseX} ${baseY + 5}`}
                stroke="#f5efb1"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {millionReached ? (
          <g opacity={reducedMotion ? 0.72 : 0.9} filter="url(#softGlow)">
            <path
              d="M470 178 C532 116 709 104 830 170"
              stroke="#f5d86c"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M420 454 C476 566 790 590 872 478"
              stroke="#ecd57a"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export default function TreeWeGrowPage() {
  const router = useRouter();
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gateReady, setGateReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const load = useCallback(async (countVisit = false) => {
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
          : "The hidden grove could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
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
    const element = sceneRef.current;

    if (!element) {
      return;
    }

    element.style.setProperty("--mx", "0px");
    element.style.setProperty("--my", "0px");
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !sceneRef.current) {
      return;
    }

    const bounds = sceneRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;

    sceneRef.current.style.setProperty("--mx", `${Math.max(-40, Math.min(40, x / 10))}px`);
    sceneRef.current.style.setProperty("--my", `${Math.max(-28, Math.min(28, y / 13))}px`);
  }, [reducedMotion]);

  const handlePointerLeave = useCallback(() => {
    if (!sceneRef.current) {
      return;
    }

    sceneRef.current.style.setProperty("--mx", "0px");
    sceneRef.current.style.setProperty("--my", "0px");
  }, []);

  const tree = data?.tree ?? null;
  const viewerName = data ? getViewerName(data.viewerEmail) : "Keeper";
  const millionReached = (tree?.growthScore ?? 0) >= 1_000_000;

  const progressToNext = useMemo(() => {
    if (!tree) {
      return 0;
    }

    return Math.max(0, Math.min(100, tree.stageProgress));
  }, [tree]);

  const sceneStyle = useMemo<CSSProperties>(() => {
    const accentA = millionReached ? "rgba(248,214,107,0.28)" : "rgba(173,255,197,0.22)";
    const accentB = tree?.bothActiveThisWeek ? "rgba(142,226,255,0.17)" : "rgba(151,122,255,0.12)";

    return {
      ["--accent-a" as string]: accentA,
      ["--accent-b" as string]: accentB,
    };
  }, [millionReached, tree?.bothActiveThisWeek]);

  if (!gateReady || (loading && !tree)) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
        <ForestBackground />
        <div className="relative z-10 mx-auto w-full max-w-[1680px]">
          <AdminNav />
          <LoadingState />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03130d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <ForestBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1680px]">
        <AdminNav />

        <header className="mt-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-100/38">
              Hidden shared space
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              The Tree We Grow
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-emerald-50/44 sm:text-base">
              A moonlit memory space for {viewerName} and Skye, rebuilt to feel bigger, calmer and more cinematic. It grows with Unown Pulls, keeps the fireflies, loses the goofy edges and stays gentle about where the two of you are right now.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load(false)}
              disabled={loading}
              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/72 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-45"
            >
              {loading ? "Refreshing..." : "Refresh grove"}
            </button>

            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-100/15 bg-emerald-200/[0.08] px-5 text-sm font-black text-emerald-50/90 transition hover:bg-emerald-200/[0.14]"
            >
              Return to operations
            </Link>

            <button
              type="button"
              onClick={() => {
                closeTreeGate();
                router.push("/admin");
              }}
              className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-5 text-sm font-black text-white/50 transition hover:bg-black/30 hover:text-white"
            >
              Close secret path
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {tree ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
            <article
              ref={sceneRef}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              className={styles.sceneShell}
              style={sceneStyle}
            >
              <div className={styles.sceneTopGlow} />
              <div className={styles.sceneBottomMist} />
              <div className={styles.stars} />
              <div className={styles.aurora} />
              <div className={styles.farRidge} />
              <div className={styles.midRidge} />
              <div className={styles.nearRidge} />
              <div className={styles.waterGlow} />

              <div className={styles.firefliesWrap}>
                {FIREFLIES.map((firefly, index) => (
                  <span
                    key={`firefly-${index}`}
                    className={styles.firefly}
                    style={{
                      left: firefly.left,
                      top: firefly.top,
                      width: `${firefly.size}px`,
                      height: `${firefly.size}px`,
                      animationDelay: `${firefly.delay}s`,
                      animationDuration: `${firefly.duration}s`,
                      ["--drift-x" as string]: `${firefly.driftX}px`,
                      ["--drift-y" as string]: `${firefly.driftY}px`,
                    }}
                  />
                ))}
              </div>

              <div className={styles.sceneContent}>
                <div className={styles.sceneCopy}>
                  <div className={styles.badgeRow}>
                    <span className={styles.sceneBadge}>{tree.stage}</span>
                    <span className={styles.sceneBadgeSoft}>{formatNumber(tree.growthScore)} growth</span>
                    {tree.bothActiveThisWeek ? (
                      <span className={styles.sceneBadgeSoft}>Both branches active</span>
                    ) : null}
                  </div>

                  <h2 className={styles.sceneTitle}>A more unforgettable grove</h2>
                  <p className={styles.sceneBody}>{stageDescription(tree)}</p>
                </div>

                <div className={styles.stageMeterCard}>
                  <div className={styles.stageMeterHeader}>
                    <div>
                      <p className={styles.miniLabel}>Progress to next canopy</p>
                      <p className={styles.meterValue}>{progressToNext}%</p>
                    </div>
                    <div className={styles.meterAside}>
                      <span>Floor {formatNumber(tree.stageFloor)}</span>
                      <span>Next {formatNumber(tree.nextStageScore)}</span>
                    </div>
                  </div>
                  <div className={styles.meterTrack}>
                    <span className={styles.meterFill} style={{ width: `${progressToNext}%` }} />
                  </div>
                </div>

                <ScenicTree tree={tree} reducedMotion={reducedMotion} />

                <div className={styles.sceneFooterGrid}>
                  <div className={styles.sceneStatCard}>
                    <p className={styles.miniLabel}>Today in the garden</p>
                    <p className={styles.statValue}>
                      {formatNumber(tree.cardsPlantedToday)} cards · {formatNumber(tree.wishesToday)} wishes
                    </p>
                    <p className={styles.statBody}>{pulseNote(tree)}</p>
                  </div>

                  <div className={styles.sceneStatCard}>
                    <p className={styles.miniLabel}>Shared branch energy</p>
                    <p className={styles.statValue}>
                      {tree.bothActiveThisWeek ? "In sync this week" : "Still waiting on both keepers"}
                    </p>
                    <p className={styles.statBody}>
                      Hearts are intentionally minimal here. The connection shows mostly as paired light, steadier roots and a calmer glow.
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-6">
              <article className="rounded-[2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/34">
                  Grove pulse
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  What the scene is doing now
                </h2>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/28">
                      Last activity
                    </p>
                    <p className="mt-2 text-sm font-black text-white/78">
                      {formatDate(tree.latestActivityAt)}
                    </p>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/28">
                      Distributed value
                    </p>
                    <p className="mt-2 text-lg font-black text-white/90">
                      {formatMoney(tree.valueShared)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-white/34">
                      {formatNumber(tree.cardsFound)} cards have found homes so far.
                    </p>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/28">
                      Persistent memory
                    </p>
                    <p className="mt-2 text-lg font-black text-white/90">
                      {tree.persistentGrowth ? `${formatNumber(tree.gardenVisits)} visits remembered` : "Live score only"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-white/34">
                      The grove keeps your best growth total, so quiet weeks never erase the bigger story.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/34">
                  Branches
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Who has been feeding the roots
                </h2>

                <div className="mt-5 space-y-3">
                  {tree.branches.map((branch) => (
                    <div key={branch.email} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-white">{branch.name}</p>
                          <p className="mt-1 text-[0.68rem] font-semibold text-white/32">{branch.email}</p>
                        </div>
                        <span
                          className={`inline-flex h-3 w-3 rounded-full ${branch.activeThisWeek ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]" : "bg-white/18"}`}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-white/58">
                        <div>
                          <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-white/26">Cards planted</span>
                          <span className="mt-1 block text-base font-black text-white/86">{formatNumber(branch.cardsPlanted)}</span>
                        </div>
                        <div>
                          <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-white/26">Sessions</span>
                          <span className="mt-1 block text-base font-black text-white/86">{formatNumber(branch.plantingSessions)}</span>
                        </div>
                      </div>

                      <p className="mt-4 text-[0.68rem] font-semibold leading-5 text-white/32">
                        Last planted: {formatDate(branch.lastPlantedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[2rem] border border-white/10 bg-[#071b14]/84 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100/34">
                  Milestones
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Shape of the long climb
                </h2>

                <div className="mt-5 space-y-3">
                  {tree.milestones.map((milestone) => (
                    <div key={milestone.score} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-white">{milestone.label}</p>
                          <p className="mt-1 text-[0.68rem] font-semibold text-white/30">
                            {formatNumber(milestone.score)} growth
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] ${milestone.reached ? "bg-emerald-200/[0.16] text-emerald-50" : "bg-white/[0.06] text-white/42"}`}>
                          {milestone.reached ? "Reached" : "Waiting"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-lime-200/10 bg-lime-200/[0.05] p-4">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-lime-100/48">
                    Million note
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50/70">
                    When Unown Pulls reaches a million growth, the scene is designed to feel monumental rather than cheesy — more silver-and-gold wonder than obvious romance.
                  </p>
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
