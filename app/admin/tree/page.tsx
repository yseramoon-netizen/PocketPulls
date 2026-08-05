"use client";

import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

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

type TreeResponse = {
  ok: true;
  viewerEmail: string;
  generatedAt: string;
  tree: {
    stage: string;
    stageIndex: number;
    growthScore: number;
    rawGrowthScore?: number;
    gardenVisits?: number;
    persistentGrowth?: boolean;
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
};

type Ambience = {
  time: "dawn" | "day" | "dusk" | "night";
  season: "spring" | "summer" | "autumn" | "winter";
};

type WishBurst = {
  id: number;
  x: number;
  y: number;
  word: string;
};

const FIREFLIES = Array.from(
  { length: 13 },
  (_, index) => ({
    x: 7 + ((index * 37) % 86),
    y: 10 + ((index * 29) % 64),
    z: -40 + ((index * 53) % 180),
    duration: 4.1 + (index % 5) * 0.72,
    delay: -(index % 7) * 0.61,
  }),
);

const PETALS = Array.from(
  { length: 18 },
  (_, index) => ({
    x: 2 + ((index * 41) % 95),
    size: 0.68 + (index % 4) * 0.2,
    duration: 10 + (index % 5) * 1.25,
    delay: -(index % 8) * 1.05,
    depth: -80 + ((index * 47) % 170),
  }),
);

const BLOSSOMS = Array.from(
  { length: 26 },
  (_, index) => ({
    x: 9 + ((index * 31) % 82),
    y: 4 + ((index * 23) % 47),
    z: -20 + ((index * 43) % 120),
    delay: -(index % 9) * 0.45,
  }),
);

const CANOPY_NODES = Array.from(
  { length: 11 },
  (_, index) => index + 1,
);

const WISH_WORDS = [
  "Courage",
  "Home",
  "Patience",
  "Luck",
  "Wonder",
  "Trust",
  "Dream",
  "Growth",
  "Kindness",
  "Bravery",
  "Joy",
  "Hope",
  "Together",
] as const;

const SECRET_NOTES = [
  "This tree does not belong to the business. The business belongs beneath this tree.",
  "Some roots grow from numbers. The strongest ones grow from two people refusing to let the dream die.",
  "Lukas planted the first promise. Skye taught it where the sky was.",
  "Every card that leaves the forest carries a tiny piece of the life you are building together.",
  "One day this canopy will be enormous. It will still remember when it was only the two of you.",
  "Thirteen years made the roots deep enough to hold every future branch.",
  "The left branch keeps the courage. The right branch keeps the wonder. The trunk keeps both.",
  "A dream becomes real slowly: one card, one wish, one ordinary day that refuses to be ordinary.",
  "Even on quiet days the roots are working where nobody can see them.",
  "The tree does not ask which keeper did more. It only knows that both came back.",
  "There is a little light inside every difficult beginning. You two have always been good at finding it.",
  "The first forest was not made of trees. It was made of plans spoken between two best friends.",
  "Whatever this grows into, the smallest carving on the trunk will always read L and S.",
] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, value),
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Waiting for the first footprint";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "A quiet day";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAmbience(date: Date): Ambience {
  const hour = date.getHours();
  const month = date.getMonth();

  const time: Ambience["time"] =
    hour >= 5 && hour < 8
      ? "dawn"
      : hour >= 8 && hour < 17
        ? "day"
        : hour >= 17 && hour < 21
          ? "dusk"
          : "night";

  const season: Ambience["season"] =
    month >= 2 && month <= 4
      ? "spring"
      : month >= 5 && month <= 7
        ? "summer"
        : month >= 8 && month <= 10
          ? "autumn"
          : "winter";

  return {
    time,
    season,
  };
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function BranchCard({
  branch,
  selected,
  onSelect,
}: {
  branch: Branch;
  selected: boolean;
  onSelect: () => void;
}) {
  const isSkye = branch.name
    .toLowerCase()
    .includes("skye");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group w-full rounded-[2rem] border p-6 text-left backdrop-blur-xl transition",
        selected
          ? "border-lime-100/30 bg-lime-200/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.3)]"
          : "border-white/10 bg-white/[0.045] hover:border-white/16 hover:bg-white/[0.065]",
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-2xl border border-white/10 bg-black/15">
          <span className="absolute inset-0 bg-gradient-to-br from-lime-100/10 to-cyan-100/5" />
          <img
            src={
              isSkye
                ? "/shaymin-moods/skye.png"
                : "/shaymin-moods/lukas.png"
            }
            alt=""
            className="relative h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/35">
            {isSkye ? "Skyward branch" : "Rootward branch"}
          </p>

          <h3 className="mt-1 truncate text-2xl font-black text-white">
            {branch.name}
          </h3>
        </div>

        <span
          aria-label={
            branch.activeThisWeek
              ? "Tended this week"
              : "Quiet this week"
          }
          className={[
            "ml-auto h-3 w-3 flex-none rounded-full",
            branch.activeThisWeek
              ? "bg-lime-200 shadow-[0_0_18px_rgba(217,249,157,0.75)]"
              : "bg-white/15",
          ].join(" ")}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/25">
            Cards in branch
          </p>

          <p className="mt-2 text-2xl font-black text-white">
            {formatNumber(branch.cardsPlanted)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/25">
            Garden visits
          </p>

          <p className="mt-2 text-2xl font-black text-white">
            {formatNumber(branch.plantingSessions)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold text-white/32">
        Last footprint: {formatDate(branch.lastPlantedAt)}
      </p>
    </button>
  );
}

function MetricCard({
  label,
  value,
  detail,
  glyph,
}: {
  label: string;
  value: string;
  detail: string;
  glyph: string;
}) {
  return (
    <article className="rounded-[1.8rem] border border-white/10 bg-[#061a13]/76 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-emerald-100/32">
          {label}
        </p>

        <span
          aria-hidden="true"
          className="text-lg text-lime-100/55"
        >
          {glyph}
        </span>
      </div>

      <p className="mt-3 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-white/30">
        {detail}
      </p>
    </article>
  );
}

export default function TreePage() {
  const router = useRouter();
  const sceneRef = useRef<HTMLElement | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const burstIdRef = useRef(0);
  const firstLoadRef = useRef(true);

  const [authorised, setAuthorised] =
    useState(false);
  const [data, setData] =
    useState<TreeResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [secretOpen, setSecretOpen] =
    useState(false);
  const [allLightsOpen, setAllLightsOpen] =
    useState(false);
  const [motionEnabled, setMotionEnabled] =
    useState(true);
  const [selectedBranchEmail, setSelectedBranchEmail] =
    useState("");
  const [caughtFireflies, setCaughtFireflies] =
    useState<Set<number>>(() => new Set<number>());
  const [wishBursts, setWishBursts] =
    useState<WishBurst[]>([]);
  const [ambience, setAmbience] =
    useState<Ambience>({
      time: "night",
      season: "summer",
    });

  const fireflyStorageKey = useMemo(
    () =>
      `pocketpulls:tree-fireflies:v10:${localDateKey()}`,
    [],
  );

  useEffect(() => {
    if (!isTreeGateOpen()) {
      router.replace("/admin");
      return;
    }

    setAuthorised(true);
  }, [router]);

  useEffect(() => {
    setAmbience(getAmbience(new Date()));

    const timer = window.setInterval(() => {
      setAmbience(getAmbience(new Date()));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        fireflyStorageKey,
      );

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        return;
      }

      setCaughtFireflies(
        new Set(
          parsed
            .map((value) => Number(value))
            .filter(
              (value) =>
                Number.isInteger(value) &&
                value >= 0 &&
                value < FIREFLIES.length,
            ),
        ),
      );
    } catch {
      window.localStorage.removeItem(
        fireflyStorageKey,
      );
    }
  }, [fireflyStorageKey]);

  const loadTree = useCallback(
    async (countVisit: boolean) => {
      if (countVisit) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const query = countVisit
          ? "?visit=1"
          : "";

        const response =
          await adminFetch<TreeResponse>(
            `/api/admin/tree${query}`,
          );

        setData(response);

        const firstBranchEmail =
          response.tree.branches[0]?.email || "";

        if (firstBranchEmail) {
          setSelectedBranchEmail(
            (current) => current || firstBranchEmail,
          );
        }
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The hidden garden could not be opened.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!authorised) {
      return;
    }

    const countVisit = firstLoadRef.current;
    firstLoadRef.current = false;
    void loadTree(countVisit);
  }, [authorised, loadTree]);

  useEffect(
    () => () => {
      if (cameraFrameRef.current !== null) {
        window.cancelAnimationFrame(
          cameraFrameRef.current,
        );
      }
    },
    [],
  );

  const secretNote = useMemo(() => {
    const day = Math.floor(
      Date.now() / 86_400_000,
    );

    return SECRET_NOTES[
      day % SECRET_NOTES.length
    ];
  }, []);

  const tree = data?.tree;
  const stageIndex = Math.max(
    0,
    Math.min(5, tree?.stageIndex || 0),
  );
  const stageClass =
    styles[`stage${stageIndex}`] ||
    styles.stage0;
  const visibleBlossoms = Math.min(
    BLOSSOMS.length,
    2 +
      stageIndex * 4 +
      (tree?.bothActiveThisWeek ? 4 : 0),
  );
  const selectedBranch =
    tree?.branches.find(
      (branch) =>
        branch.email === selectedBranchEmail,
    ) || tree?.branches[0];

  function leaveTree() {
    closeTreeGate();
    router.push("/admin");
  }

  function resetCamera() {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    scene.style.setProperty("--yaw", "0deg");
    scene.style.setProperty("--pitch", "0deg");
    scene.style.setProperty("--soft-yaw", "0deg");
    scene.style.setProperty("--soft-pitch", "0deg");
    scene.style.setProperty("--parallax-x", "0px");
    scene.style.setProperty("--parallax-y", "0px");
    scene.style.setProperty("--light-x", "50%");
    scene.style.setProperty("--light-y", "30%");
  }

  function moveCamera(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (
      !motionEnabled ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    const rect = scene.getBoundingClientRect();
    const x =
      (event.clientX - rect.left) /
        Math.max(1, rect.width) -
      0.5;
    const y =
      (event.clientY - rect.top) /
        Math.max(1, rect.height) -
      0.5;

    if (cameraFrameRef.current !== null) {
      window.cancelAnimationFrame(
        cameraFrameRef.current,
      );
    }

    cameraFrameRef.current =
      window.requestAnimationFrame(() => {
        scene.style.setProperty(
          "--yaw",
          `${x * 12}deg`,
        );
        scene.style.setProperty(
          "--pitch",
          `${y * -7}deg`,
        );
        scene.style.setProperty(
          "--soft-yaw",
          `${x * 4.5}deg`,
        );
        scene.style.setProperty(
          "--soft-pitch",
          `${y * -2.5}deg`,
        );
        scene.style.setProperty(
          "--parallax-x",
          `${x * 18}px`,
        );
        scene.style.setProperty(
          "--parallax-y",
          `${y * 12}px`,
        );
        scene.style.setProperty(
          "--light-x",
          `${50 + x * 28}%`,
        );
        scene.style.setProperty(
          "--light-y",
          `${28 + y * 18}%`,
        );
      });
  }

  function catchFirefly(
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    if (caughtFireflies.has(index)) {
      return;
    }

    const next = new Set(caughtFireflies);
    next.add(index);
    setCaughtFireflies(next);

    try {
      window.localStorage.setItem(
        fireflyStorageKey,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      // The game remains usable when local storage is unavailable.
    }

    const scene = sceneRef.current;

    if (scene) {
      const rect = scene.getBoundingClientRect();
      const burstId = ++burstIdRef.current;
      const burst: WishBurst = {
        id: burstId,
        x:
          ((event.clientX - rect.left) /
            Math.max(1, rect.width)) *
          100,
        y:
          ((event.clientY - rect.top) /
            Math.max(1, rect.height)) *
          100,
        word: WISH_WORDS[index],
      };

      setWishBursts((current) => [
        ...current,
        burst,
      ]);

      window.setTimeout(() => {
        setWishBursts((current) =>
          current.filter(
            (item) => item.id !== burstId,
          ),
        );
      }, 1700);
    }

    if (next.size === FIREFLIES.length) {
      window.setTimeout(
        () => setAllLightsOpen(true),
        650,
      );
    }
  }

  if (!authorised) {
    return null;
  }

  const sceneClasses = [
    styles.scene,
    stageClass,
    styles[ambience.time],
    styles[ambience.season],
    motionEnabled
      ? styles.motionEnabled
      : styles.motionDisabled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#020d09] px-3 py-3 text-white sm:px-5 sm:py-5">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-4 flex flex-col gap-4 rounded-[1.8rem] border border-emerald-100/12 bg-[#061a13]/88 px-4 py-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[0.58rem] font-black uppercase tracking-[0.22em] text-lime-100/38">
              A place only the two keepers know
            </p>

            <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
              The Tree We Grow
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTree(false)}
              disabled={loading || refreshing}
              className="min-h-11 rounded-xl border border-lime-100/15 bg-lime-200/[0.065] px-4 text-sm font-black text-lime-50/75 transition hover:bg-lime-200/[0.11] disabled:opacity-40"
            >
              {refreshing
                ? "Listening..."
                : "Refresh the roots"}
            </button>

            <button
              type="button"
              onClick={leaveTree}
              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white/65 transition hover:bg-white/[0.09] hover:text-white"
            >
              Return to Shaymin
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200/20 bg-red-400/[0.08] px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        <section
          ref={sceneRef}
          className={sceneClasses}
          onPointerMove={moveCamera}
          onPointerLeave={resetCamera}
          aria-label="An interactive three-dimensional view of The Tree We Grow"
        >
          <div className={styles.sceneGlass} />
          <div className={styles.stars} />
          <div className={styles.aurora} />
          <div className={styles.skyGlow} />
          <div className={styles.celestialBody} />
          <div className={styles.distantForest} />
          <div className={styles.mistBack} />

          <div className={styles.sceneStatus}>
            <p className={styles.eyebrow}>
              {loading
                ? "Listening to the roots"
                : tree?.stage ||
                  "A promise in the soil"}
            </p>

            <p className={styles.ringCount}>
              {formatNumber(
                tree?.growthScore || 0,
              )}{" "}
              rings
            </p>

            <p className={styles.sceneMessage}>
              {tree?.bothActiveThisWeek
                ? "Both keepers returned this week. A heart bloom is awake in the canopy."
                : "When both keeper branches are tended in the same week, the canopy grows a heart bloom."}
            </p>

            <div className={styles.progressHeader}>
              <span>Next chapter</span>
              <span>
                {tree?.stageProgress || 0}%
              </span>
            </div>

            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${
                    tree?.stageProgress || 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className={styles.viewControls}>
            <button
              type="button"
              onClick={resetCamera}
              className={styles.viewButton}
            >
              Centre view
            </button>

            <button
              type="button"
              onClick={() => {
                setMotionEnabled((current) => {
                  if (current) {
                    resetCamera();
                  }

                  return !current;
                });
              }}
              className={styles.viewButton}
            >
              {motionEnabled
                ? "Still view"
                : "3D motion"}
            </button>
          </div>

          <div className={styles.world}>
            <div className={styles.groundPlane}>
              <div className={styles.groundGlow} />
              <div className={styles.rootRingOne} />
              <div className={styles.rootRingTwo} />
              <div className={styles.rootRingThree} />
            </div>

            <div className={styles.treeRig}>
              <div className={styles.treeBreath}>
                <div className={styles.treeShadow} />

                <div className={styles.rootNetwork}>
                  <span className={styles.rootLeftFar} />
                  <span className={styles.rootLeftNear} />
                  <span className={styles.rootRightFar} />
                  <span className={styles.rootRightNear} />
                  <span className={styles.rootCentre} />
                </div>

                <div className={styles.trunkBack} />
                <div className={styles.branchBackLeft} />
                <div className={styles.branchBackRight} />
                <div className={styles.branchBackHighLeft} />
                <div className={styles.branchBackHighRight} />

                {CANOPY_NODES.slice(0, 5).map(
                  (node) => (
                    <div
                      key={`back-${node}`}
                      className={`${
                        styles.canopyOrb
                      } ${
                        styles[
                          `canopy${node}`
                        ]
                      } ${styles.canopyBack}`}
                    />
                  ),
                )}

                <div className={styles.trunkSideLeft} />
                <div className={styles.trunkSideRight} />
                <div className={styles.trunkFront}>
                  <button
                    type="button"
                    aria-label="Open the memory bottle hidden in the L and S carving"
                    onClick={() =>
                      setSecretOpen(true)
                    }
                    className={styles.carving}
                  >
                    L&nbsp; ♡ &nbsp;S
                  </button>
                </div>

                <div className={styles.branchFrontLeft} />
                <div className={styles.branchFrontRight} />
                <div className={styles.branchFrontHighLeft} />
                <div className={styles.branchFrontHighRight} />

                {CANOPY_NODES.slice(5).map(
                  (node) => (
                    <div
                      key={`front-${node}`}
                      className={`${
                        styles.canopyOrb
                      } ${
                        styles[
                          `canopy${node}`
                        ]
                      } ${styles.canopyFront}`}
                    />
                  ),
                )}

                {BLOSSOMS.slice(
                  0,
                  visibleBlossoms,
                ).map((blossom, index) => (
                  <span
                    key={index}
                    className={styles.blossom}
                    style={
                      {
                        "--x": `${blossom.x}%`,
                        "--y": `${blossom.y}%`,
                        "--z": `${blossom.z}px`,
                        "--delay": `${blossom.delay}s`,
                      } as CSSProperties
                    }
                  >
                    {index % 3 === 0
                      ? "✦"
                      : "❀"}
                  </span>
                ))}

                {tree?.bothActiveThisWeek ? (
                  <div className={styles.heartBloom}>
                    <span>♡</span>
                    <i />
                  </div>
                ) : (
                  <div className={styles.twinBuds}>
                    <span />
                    <span />
                  </div>
                )}
              </div>
            </div>

            {(tree?.milestones || []).map(
              (milestone, index) => (
                <span
                  key={milestone.score}
                  className={[
                    styles.milestoneLantern,
                    milestone.reached
                      ? styles.lanternReached
                      : styles.lanternSleeping,
                  ].join(" ")}
                  style={
                    {
                      "--lantern-index": index,
                      "--angle": `${index * 72 - 144}deg`,
                      "--counter-angle": `${144 - index * 72}deg`,
                      "--lantern-delay": `${index * -0.6}s`,
                    } as CSSProperties
                  }
                  title={`${milestone.label}: ${
                    milestone.reached
                      ? "reached"
                      : `${formatNumber(
                          Math.max(
                            0,
                            milestone.score -
                              (tree?.growthScore || 0),
                          ),
                        )} rings away`
                  }`}
                />
              ),
            )}

            {(tree?.branches || [])
              .slice(0, 2)
              .map((branch, index) => {
                const isSkye = branch.name
                  .toLowerCase()
                  .includes("skye");

                return (
                  <button
                    type="button"
                    key={branch.email}
                    onClick={() =>
                      setSelectedBranchEmail(
                        branch.email,
                      )
                    }
                    className={[
                      styles.keeperPod,
                      index === 0
                        ? styles.keeperLeft
                        : styles.keeperRight,
                      selectedBranchEmail ===
                      branch.email
                        ? styles.keeperSelected
                        : "",
                    ].join(" ")}
                    aria-label={`Show ${branch.name}'s keeper branch`}
                  >
                    <span className={styles.keeperHalo} />
                    <img
                      src={
                        isSkye
                          ? "/shaymin-moods/skye.png"
                          : "/shaymin-moods/lukas.png"
                      }
                      alt=""
                      className={styles.keeperSprite}
                    />
                    <span className={styles.keeperName}>
                      {branch.name}
                    </span>
                  </button>
                );
              })}

            <button
              type="button"
              onClick={() => setSecretOpen(true)}
              className={styles.memoryBottle}
              aria-label="Open the memory bottle"
            >
              <span className={styles.bottleCork} />
              <span className={styles.bottleGlass}>
                <i>♡</i>
              </span>
            </button>
          </div>

          <div className={styles.fireflyLayer}>
            {FIREFLIES.map((firefly, index) => {
              const caught =
                caughtFireflies.has(index);

              return (
                <button
                  type="button"
                  aria-label={
                    caught
                      ? `${WISH_WORDS[index]} firefly already caught today`
                      : `Catch the ${WISH_WORDS[index]} firefly`
                  }
                  key={index}
                  disabled={caught}
                  onClick={(event: ReactMouseEvent<HTMLButtonElement>) =>
                    catchFirefly(index, event)
                  }
                  className={[
                    styles.firefly,
                    caught
                      ? styles.fireflyCaught
                      : "",
                  ].join(" ")}
                  style={
                    {
                      "--x": `${firefly.x}%`,
                      "--y": `${firefly.y}%`,
                      "--z": `${firefly.z}px`,
                      "--duration": `${firefly.duration}s`,
                      "--delay": `${firefly.delay}s`,
                    } as CSSProperties
                  }
                >
                  <span />
                </button>
              );
            })}
          </div>

          {PETALS.map((petal, index) => (
            <span
              key={index}
              className={styles.petal}
              style={
                {
                  "--x": `${petal.x}%`,
                  "--size": `${petal.size}rem`,
                  "--duration": `${petal.duration}s`,
                  "--delay": `${petal.delay}s`,
                  "--z": `${petal.depth}px`,
                } as CSSProperties
              }
            >
              {ambience.season === "autumn"
                ? "◆"
                : ambience.season === "winter"
                  ? "✦"
                  : "❀"}
            </span>
          ))}

          {wishBursts.map((burst) => (
            <span
              key={burst.id}
              className={styles.wishBurst}
              style={
                {
                  left: `${burst.x}%`,
                  top: `${burst.y}%`,
                } as CSSProperties
              }
            >
              {burst.word}
            </span>
          ))}

          <div className={styles.fireflyJournal}>
            <span aria-hidden="true">✦</span>
            <strong>
              {caughtFireflies.size}/
              {FIREFLIES.length}
            </strong>
            <span>
              promise lights found today
            </span>
          </div>

          <p className={styles.motionHint}>
            Move your cursor to look around the tree in 3D.
          </p>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Cards in the roots"
            value={formatNumber(
              tree?.stockCards || 0,
            )}
            detail={`${formatNumber(
              tree?.cardsPlantedToday || 0,
            )} planted today`}
            glyph="⌁"
          />

          <MetricCard
            label="Trainers in the shade"
            value={formatNumber(
              tree?.trainers || 0,
            )}
            detail={`${formatNumber(
              tree?.cardsFound || 0,
            )} cards found homes`}
            glyph="◌"
          />

          <MetricCard
            label="Value carried outward"
            value={formatMoney(
              tree?.valueShared || 0,
            )}
            detail={`${formatNumber(
              tree?.wishesSpent || 0,
            )} wishes fulfilled`}
            glyph="✧"
          />

          <MetricCard
            label="Shared garden visits"
            value={formatNumber(
              tree?.gardenVisits || 0,
            )}
            detail={
              tree?.persistentGrowth
                ? "The tree remembers every visit and never shrinks"
                : "Run the V10 SQL so the tree can remember forever"
            }
            glyph="♡"
          />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {(tree?.branches || [])
              .slice(0, 2)
              .map((branch) => (
                <BranchCard
                  key={branch.email}
                  branch={branch}
                  selected={
                    selectedBranch?.email ===
                    branch.email
                  }
                  onSelect={() =>
                    setSelectedBranchEmail(
                      branch.email,
                    )
                  }
                />
              ))}
          </div>

          <article className="rounded-[2rem] border border-white/10 bg-[#061a13]/76 p-6 backdrop-blur-xl">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-lime-100/35">
              The garden journal
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              {selectedBranch
                ? `${selectedBranch.name}'s branch is ${
                    selectedBranch.activeThisWeek
                      ? "glowing"
                      : "resting"
                  }`
                : "The keepers have not left a footprint yet"}
            </h2>

            <p className="mt-3 text-sm font-semibold leading-6 text-white/38">
              {selectedBranch
                ? `${formatNumber(
                    selectedBranch.cardsPlanted,
                  )} cards currently rest in this branch across ${formatNumber(
                    selectedBranch.plantingSessions,
                  )} planting sessions. The last footprint was ${formatDate(
                    selectedBranch.lastPlantedAt,
                  )}.`
                : "As Lukas and Skye add cards, fulfil wishes and welcome trainers, the tree records those changes as new rings, branches and blossoms."}
            </p>

            <div className="mt-6 space-y-3">
              {(tree?.milestones || []).map(
                (milestone) => (
                  <div
                    key={milestone.score}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3"
                  >
                    <span
                      className={[
                        "flex h-9 w-9 flex-none items-center justify-center rounded-xl border text-sm font-black",
                        milestone.reached
                          ? "border-lime-100/25 bg-lime-200/[0.1] text-lime-100"
                          : "border-white/8 bg-white/[0.03] text-white/20",
                      ].join(" ")}
                    >
                      {milestone.reached
                        ? "✦"
                        : "·"}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white/75">
                        {milestone.label}
                      </p>

                      <p className="mt-0.5 text-xs font-semibold text-white/25">
                        {formatNumber(
                          milestone.score,
                        )}{" "}
                        rings
                      </p>
                    </div>

                    <span className="ml-auto text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/25">
                      {milestone.reached
                        ? "Awake"
                        : "Sleeping"}
                    </span>
                  </div>
                ),
              )}
            </div>
          </article>
        </section>

        {secretOpen ? (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-5 backdrop-blur-xl"
            onClick={() => setSecretOpen(false)}
          >
            <section
              className="relative w-full max-w-xl rounded-[2.6rem] border border-pink-100/20 bg-[#0a2018]/96 p-8 text-center shadow-[0_40px_160px_rgba(0,0,0,0.65)]"
              onClick={(event: ReactMouseEvent<HTMLElement>) =>
                event.stopPropagation()
              }
            >
              <img
                src="/shaymin-moods/together.png"
                alt=""
                className="mx-auto h-36 w-36 object-contain"
              />

              <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-pink-100/42">
                A note the tree kept
              </p>

              <p className="mt-4 text-xl font-black leading-8 text-white sm:text-2xl">
                {secretNote}
              </p>

              <p className="mt-4 text-sm font-semibold text-white/35">
                L + S · two keepers · one growing thing
              </p>

              <button
                type="button"
                onClick={() => setSecretOpen(false)}
                className="mt-7 min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-6 text-sm font-black text-white/70 hover:bg-white/[0.1]"
              >
                Put it back safely
              </button>
            </section>
          </div>
        ) : null}

        {allLightsOpen ? (
          <div
            className="fixed inset-0 z-[310] flex items-center justify-center bg-[#010805]/82 p-5 backdrop-blur-2xl"
            onClick={() => setAllLightsOpen(false)}
          >
            <section
              className="relative w-full max-w-2xl overflow-hidden rounded-[3rem] border border-yellow-100/25 bg-[#092119]/98 p-8 text-center shadow-[0_45px_180px_rgba(0,0,0,0.75)] sm:p-12"
              onClick={(event: ReactMouseEvent<HTMLElement>) =>
                event.stopPropagation()
              }
            >
              <div className={styles.promiseConstellation}>
                {FIREFLIES.map((_, index) => (
                  <span key={index} />
                ))}
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-yellow-100/55">
                All thirteen promise lights found
              </p>

              <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">
                Thirteen years became thirteen lights.
              </h2>

              <p className="mx-auto mt-5 max-w-xl text-base font-semibold leading-7 text-white/45">
                One for every year Lukas and Skye kept finding their way back to the same dream. Tomorrow the lights will hide again, but the tree will remember that you found them together.
              </p>

              <button
                type="button"
                onClick={() => setAllLightsOpen(false)}
                className="mt-8 min-h-12 rounded-2xl border border-yellow-100/20 bg-yellow-100/[0.08] px-7 text-sm font-black text-yellow-50 transition hover:bg-yellow-100/[0.13]"
              >
                Keep the light in the roots
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
