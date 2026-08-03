"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import { supabase } from "@/lib/supabase";

type TreeMilestone = {
  value: number;
  label: string;
  reached: boolean;
  reachedAt: string | null;
};

type TreeResponse = {
  success: boolean;

  currentValue: number;
  peakValue: number;
  targetValue: number;
  percentage: number;

  totalUnits: number;
  uniqueCards: number;

  stage: {
    value: number;
    label: string;
  };

  nextMilestone: {
    value: number;
    label: string;
  } | null;

  milestones: TreeMilestone[];
  updatedAt: string;

  error?: string;
};

function toNumber(
  value: unknown,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",

      maximumFractionDigits:
        value >= 100_000
          ? 0
          : 2,
    },
  ).format(value);
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Still growing";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

function TreeVisual({
  progress,
}: {
  progress: number;
}) {
  const safeProgress =
    clamp(progress, 0, 1);

  const trunkHeight =
    70 +
    safeProgress * 410;

  const trunkTop =
    530 - trunkHeight;

  const trunkWidth =
    28 +
    safeProgress * 74;

  const branchOpacity =
    clamp(
      (safeProgress - 0.1) /
        0.25,
      0,
      1,
    );

  const canopyOpacity =
    clamp(
      (safeProgress - 0.2) /
        0.35,
      0,
      1,
    );

  const crownOpacity =
    clamp(
      (safeProgress - 0.72) /
        0.28,
      0,
      1,
    );

  return (
    <div
      className="
        relative
        mx-auto
        h-[38rem]
        w-full
        max-w-3xl
        overflow-hidden
        rounded-[2.5rem]
        border
        border-emerald-200/10
        bg-gradient-to-b
        from-[#03150f]
        via-[#052e16]
        to-[#020b08]
      "
    >
      <div
        className="
          absolute
          inset-x-0
          top-0
          h-1/2
          bg-[radial-gradient(circle_at_center,rgba(110,231,183,0.12),transparent_65%)]
        "
      />

      <div
        className="
          absolute
          bottom-0
          left-1/2
          h-20
          w-[80%]
          -translate-x-1/2
          rounded-[50%]
          bg-black/45
          blur-sm
        "
      />

      <div
        className="
          absolute
          bottom-12
          left-1/2
          h-8
          w-[56%]
          -translate-x-1/2
          rounded-[50%]
          bg-emerald-400/10
          blur-xl
        "
      />

      <div
        className="
          absolute
          left-1/2
          rounded-t-[45%]
          rounded-b-[30%]
          bg-gradient-to-r
          from-[#3b2114]
          via-[#8a572d]
          to-[#2b180f]
          shadow-[0_0_35px_rgba(74,222,128,0.08)]
          transition-all
          duration-1000
        "
        style={{
          bottom: "58px",

          width: `${trunkWidth}px`,

          height: `${trunkHeight}px`,

          transform:
            "translateX(-50%)",
        }}
      />

      <div
        className="
          absolute
          left-1/2
          h-9
          w-56
          origin-right
          rounded-full
          bg-gradient-to-r
          from-[#3b2114]
          to-[#79502c]
          transition-opacity
          duration-1000
        "
        style={{
          bottom:
            `${Math.max(
              170,
              530 -
                trunkTop *
                  0.42,
            )}px`,

          transform:
            "translateX(-95%) rotate(24deg)",

          opacity:
            branchOpacity,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          h-9
          w-56
          origin-left
          rounded-full
          bg-gradient-to-l
          from-[#3b2114]
          to-[#79502c]
          transition-opacity
          duration-1000
        "
        style={{
          bottom:
            `${Math.max(
              200,
              530 -
                trunkTop *
                  0.5,
            )}px`,

          transform:
            "translateX(-5%) rotate(-28deg)",

          opacity:
            branchOpacity,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          h-8
          w-48
          origin-right
          rounded-full
          bg-gradient-to-r
          from-[#3b2114]
          to-[#79502c]
          transition-opacity
          duration-1000
        "
        style={{
          bottom:
            `${Math.max(
              275,
              530 -
                trunkTop *
                  0.64,
            )}px`,

          transform:
            "translateX(-95%) rotate(38deg)",

          opacity:
            branchOpacity,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          h-8
          w-48
          origin-left
          rounded-full
          bg-gradient-to-l
          from-[#3b2114]
          to-[#79502c]
          transition-opacity
          duration-1000
        "
        style={{
          bottom:
            `${Math.max(
              300,
              530 -
                trunkTop *
                  0.68,
            )}px`,

          transform:
            "translateX(-5%) rotate(-38deg)",

          opacity:
            branchOpacity,
        }}
      />

      <div
        className="
          absolute
          left-[26%]
          top-[23%]
          h-48
          w-48
          rounded-full
          bg-emerald-500/75
          shadow-[0_0_55px_rgba(52,211,153,0.2)]
          blur-[1px]
          transition-opacity
          duration-1000
        "
        style={{
          opacity:
            canopyOpacity,
        }}
      />

      <div
        className="
          absolute
          right-[24%]
          top-[20%]
          h-52
          w-52
          rounded-full
          bg-emerald-600/80
          shadow-[0_0_55px_rgba(52,211,153,0.2)]
          blur-[1px]
          transition-opacity
          duration-1000
        "
        style={{
          opacity:
            canopyOpacity,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-[10%]
          h-64
          w-64
          -translate-x-1/2
          rounded-full
          bg-gradient-to-b
          from-emerald-300/85
          to-emerald-700/90
          shadow-[0_0_70px_rgba(110,231,183,0.25)]
          transition-opacity
          duration-1000
        "
        style={{
          opacity:
            canopyOpacity,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-[7%]
          h-40
          w-40
          -translate-x-1/2
          rounded-full
          bg-yellow-200/35
          shadow-[0_0_80px_rgba(253,230,138,0.5)]
          transition-opacity
          duration-1000
        "
        style={{
          opacity:
            crownOpacity,
        }}
      />

      <div
        className="
          absolute
          bottom-52
          left-1/2
          -translate-x-1/2
          rounded-full
          border
          border-amber-100/20
          bg-[#24150f]/80
          px-5
          py-2
          text-center
          shadow-xl
        "
        style={{
          opacity:
            clamp(
              safeProgress * 4,
              0,
              1,
            ),
        }}
      >
        <p
          className="
            text-xs
            font-black
            uppercase
            tracking-[0.2em]
            text-amber-100
          "
        >
          L + S
        </p>

        <p
          className="
            mt-1
            text-[0.55rem]
            font-black
            uppercase
            tracking-[0.15em]
            text-amber-100/55
          "
        >
          PocketPulls
        </p>
      </div>

      {safeProgress < 0.1 && (
        <div
          className="
            absolute
            bottom-16
            left-1/2
            -translate-x-1/2
            text-center
          "
        >
          <div
            className="
              mx-auto
              h-7
              w-10
              rounded-[50%]
              bg-amber-800
            "
          />

          <div
            className="
              mx-auto
              -mt-1
              h-14
              w-2
              rounded-full
              bg-emerald-300
            "
          />
        </div>
      )}

      <div
        className="
          absolute
          bottom-5
          left-1/2
          -translate-x-1/2
          whitespace-nowrap
          text-[0.65rem]
          font-black
          uppercase
          tracking-[0.25em]
          text-emerald-100/30
        "
      >
        
      </div>
    </div>
  );
}

export default function TreePage() {
  const [tree, setTree] =
    useState<TreeResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadTree =
    useCallback(
      async (
        background = false,
      ) => {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const {
            data: { session },
            error: sessionError,
          } =
            await supabase.auth.getSession();

          if (
            sessionError ||
            !session?.access_token
          ) {
            throw new Error(
              "Your admin session could not be found.",
            );
          }

          const response =
            await fetch(
              "/api/tree/progress",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                cache: "no-store",
              },
            );

          const responseText =
            await response.text();

          let payload:
            TreeResponse;

          try {
            payload =
              JSON.parse(
                responseText,
              ) as TreeResponse;
          } catch {
            console.error(
              "Invalid tree API response:",
              responseText,
            );

            throw new Error(
              `The tree API returned an invalid response with status ${response.status}. Check the terminal for the server error.`,
            );
          }

          if (
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error ||
                "The tree could not be loaded.",
            );
          }

          setTree(payload);
        } catch (
          loadError: unknown
        ) {
          console.error(
            "Tree loading error:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "The tree could not be loaded.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadTree(false);

    const intervalId =
      window.setInterval(() => {
        void loadTree(true);
      }, 60_000);

    function handleVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadTree(true);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [loadTree]);

  const progress =
    useMemo(() => {
      return clamp(
        toNumber(
          tree?.percentage,
        ) / 100,
        0,
        1,
      );
    }, [tree]);

  const amountToTarget =
    Math.max(
      0,
      toNumber(
        tree?.targetValue,
      ) -
        toNumber(
          tree?.peakValue,
        ),
    );

  const amountToNext =
    tree?.nextMilestone
      ? Math.max(
          0,
          tree.nextMilestone.value -
            tree.peakValue,
        )
      : 0;

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-x-hidden
        bg-gradient-to-b
        from-[#010806]
        via-[#031a12]
        to-[#020617]
        px-4
        pb-24
        pt-4
        text-white
        md:px-8
        md:pt-8
      "
    >
      <ForestBackground />

      <div
        className="
          pointer-events-none
          absolute
          inset-0
        "
      >
        <div
          className="
            absolute
            left-1/2
            top-32
            h-[50rem]
            w-[50rem]
            -translate-x-1/2
            rounded-full
            bg-emerald-400/[0.08]
            blur-[170px]
          "
        />
      </div>

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-[1500px]
        "
      >
        <AdminNav />

        <header
          className="
            mt-10
            text-center
          "
        >
          <p
            className="
              text-xs
              font-black
              uppercase
              tracking-[0.3em]
              text-emerald-200/50
            "
          >
            A hidden place for two founders
          </p>

          <h1
            className="
              mt-5
              text-4xl
              font-black
              tracking-[-0.05em]
              md:text-7xl
            "
          >
            The Tree We
            <span
              className="
                text-emerald-300
              "
            >
              {" "}
              Grow
            </span>
          </h1>

          <p
            className="
              mx-auto
              mt-5
              max-w-3xl
              text-base
              font-medium
              leading-8
              text-emerald-50/55
              md:text-lg
            "
          >
            
          </p>
        </header>

        {error && (
          <div
            className="
              mx-auto
              mt-8
              max-w-3xl
              rounded-[1.75rem]
              border
              border-red-300/20
              bg-red-500/10
              px-6
              py-5
              text-center
              font-bold
              text-red-100
            "
          >
            {error}
          </div>
        )}

        {loading || !tree ? (
          <div
            className="
              mt-10
              flex
              min-h-[38rem]
              items-center
              justify-center
              rounded-[3rem]
              border
              border-white/10
              bg-white/[0.04]
              backdrop-blur-3xl
            "
          >
            <div className="text-center">
              <div
                className="
                  mx-auto
                  h-14
                  w-14
                  animate-spin
                  rounded-full
                  border-4
                  border-white/10
                  border-t-emerald-300
                "
              />

              <p
                className="
                  mt-5
                  font-black
                  text-emerald-100
                "
              >
                Listening beneath the soil
              </p>
            </div>
          </div>
        ) : (
          <>
            <section
              className="
                mt-10
                grid
                gap-6
                xl:grid-cols-[1.15fr_0.85fr]
              "
            >
              <div
                className="
                  rounded-[3rem]
                  border
                  border-emerald-200/15
                  bg-white/[0.05]
                  p-4
                  shadow-[0_50px_160px_rgba(0,0,0,0.5)]
                  backdrop-blur-3xl
                  md:p-7
                "
              >
                <TreeVisual
                  progress={progress}
                />

                <div
                  className="
                    mt-6
                    text-center
                  "
                >
                  <p
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-[0.2em]
                      text-emerald-200/45
                    "
                  >
                    Current form
                  </p>

                  <h2
                    className="
                      mt-2
                      text-2xl
                      font-black
                      text-emerald-100
                      md:text-3xl
                    "
                  >
                    {tree.stage.label}
                  </h2>
                </div>
              </div>

              <div className="space-y-6">
                <section
                  className="
                    rounded-[2.5rem]
                    border
                    border-white/15
                    bg-white/[0.075]
                    p-6
                    shadow-[0_30px_100px_rgba(0,0,0,0.35)]
                    backdrop-blur-3xl
                    md:p-8
                  "
                >
                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-5
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.18em]
                          text-emerald-200/45
                        "
                      >
                        Highest value built
                      </p>

                      <p
                        className="
                          mt-3
                          text-4xl
                          font-black
                          tracking-tight
                          text-emerald-200
                          md:text-5xl
                        "
                      >
                        {formatCurrency(
                          tree.peakValue,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void loadTree(
                          true,
                        )
                      }
                      disabled={
                        refreshing
                      }
                      className="
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.06]
                        text-xl
                        text-white/60
                        transition
                        hover:bg-white/10
                        disabled:opacity-40
                      "
                    >
                      <span
                        className={
                          refreshing
                            ? "animate-spin"
                            : ""
                        }
                      >
                        R
                      </span>
                    </button>
                  </div>

                  <div
                    className="
                      mt-7
                      h-4
                      overflow-hidden
                      rounded-full
                      border
                      border-white/10
                      bg-black/30
                      p-1
                    "
                  >
                    <div
                      className="
                        h-full
                        rounded-full
                        bg-gradient-to-r
                        from-emerald-700
                        via-emerald-300
                        to-yellow-200
                        shadow-[0_0_25px_rgba(110,231,183,0.4)]
                        transition-[width]
                        duration-1000
                      "
                      style={{
                        width:
                          `${clamp(
                            tree.percentage,
                            0,
                            100,
                          )}%`,
                      }}
                    />
                  </div>

                  <div
                    className="
                      mt-3
                      flex
                      items-center
                      justify-between
                      gap-4
                      text-sm
                      font-black
                    "
                  >
                    <span
                      className="
                        text-white/40
                      "
                    >
                      {tree.percentage.toFixed(
                        4,
                      )}
                      %
                    </span>

                    <span
                      className="
                        text-emerald-100/65
                      "
                    >
                      Goal{" "}
                      {formatCurrency(
                        tree.targetValue,
                      )}
                    </span>
                  </div>

                  {tree.nextMilestone ? (
                    <div
                      className="
                        mt-7
                        rounded-[1.5rem]
                        border
                        border-emerald-200/15
                        bg-emerald-300/[0.06]
                        p-5
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.14em]
                          text-emerald-200/45
                        "
                      >
                        Next transformation
                      </p>

                      <p
                        className="
                          mt-2
                          text-lg
                          font-black
                          text-emerald-100
                        "
                      >
                        {
                          tree.nextMilestone
                            .label
                        }
                      </p>

                      <p
                        className="
                          mt-2
                          text-sm
                          font-semibold
                          text-white/40
                        "
                      >
                        Another{" "}
                        {formatCurrency(
                          amountToNext,
                        )}{" "}
                        unlocks the next stage.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="
                        mt-7
                        rounded-[1.5rem]
                        border
                        border-yellow-200/25
                        bg-yellow-300/10
                        p-5
                        text-center
                      "
                    >
                      <p
                        className="
                          text-xl
                          font-black
                          text-yellow-100
                        "
                      >
                        The World Tree is complete.
                      </p>

                      <p
                        className="
                          mt-2
                          text-sm
                          font-semibold
                          text-yellow-50/55
                        "
                      >
                        Lukas and Skye built a
                        million pound Pokemon inventory.
                      </p>
                    </div>
                  )}
                </section>

                <section
                  className="
                    grid
                    gap-4
                    sm:grid-cols-2
                  "
                >
                  <ValueCard
                    label="Value today"
                    value={formatCurrency(
                      tree.currentValue,
                    )}
                    caption="Live inventory value"
                  />

                  <ValueCard
                    label="Still to grow"
                    value={formatCurrency(
                      amountToTarget,
                    )}
                    caption="Until the final crown"
                  />

                  <ValueCard
                    label="Physical cards"
                    value={tree.totalUnits.toLocaleString(
                      "en-GB",
                    )}
                    caption="Units in the vault"
                  />

                  <ValueCard
                    label="Unique cards"
                    value={tree.uniqueCards.toLocaleString(
                      "en-GB",
                    )}
                    caption="Different printings"
                  />
                </section>
              </div>
            </section>

            <section
              className="
                mt-8
                overflow-hidden
                rounded-[3rem]
                border
                border-white/15
                bg-white/[0.065]
                shadow-[0_35px_110px_rgba(0,0,0,0.35)]
                backdrop-blur-3xl
              "
            >
              <div
                className="
                  border-b
                  border-white/10
                  p-6
                  md:p-8
                "
              >
                <p
                  className="
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.22em]
                    text-emerald-200/45
                  "
                >
                  The growth journal
                </p>

                <h2
                  className="
                    mt-2
                    text-3xl
                    font-black
                    tracking-tight
                  "
                >
                  Every stage of the journey
                </h2>
              </div>

              <div
                className="
                  grid
                  gap-3
                  p-4
                  md:grid-cols-2
                  md:p-8
                  xl:grid-cols-3
                "
              >
                {tree.milestones.map(
                  (
                    milestone,
                    index,
                  ) => (
                    <article
                      key={
                        milestone.value
                      }
                      className={`
                        rounded-[1.75rem]
                        border
                        p-5
                        ${
                          milestone.reached
                            ? `
                              border-emerald-200/20
                              bg-emerald-300/[0.08]
                            `
                            : `
                              border-white/10
                              bg-black/15
                              opacity-60
                            `
                        }
                      `}
                    >
                      <span
                        className={`
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          text-sm
                          font-black
                          ${
                            milestone.reached
                              ? `
                                bg-emerald-300
                                text-emerald-950
                              `
                              : `
                                border
                                border-white/10
                                bg-white/[0.05]
                                text-white/35
                              `
                          }
                        `}
                      >
                        {milestone.reached
                          ? "OK"
                          : index + 1}
                      </span>

                      <p
                        className="
                          mt-5
                          text-xl
                          font-black
                        "
                      >
                        {milestone.label}
                      </p>

                      <p
                        className="
                          mt-2
                          font-black
                          text-emerald-200
                        "
                      >
                        {formatCurrency(
                          milestone.value,
                        )}
                      </p>

                      <p
                        className="
                          mt-4
                          text-sm
                          font-semibold
                          text-white/40
                        "
                      >
                        {milestone.reached
                          ? `Reached ${formatDate(
                              milestone.reachedAt,
                            )}`
                          : "Waiting beneath the soil"}
                      </p>
                    </article>
                  ),
                )}
              </div>
            </section>

            <footer
              className="
                py-12
                text-center
              "
            >
              <p
                className="
                  text-xl
                  italic
                  text-emerald-100/45
                  md:text-2xl
                "
              >
                
              </p>

              <p
                className="
                  mt-3
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.28em]
                  text-white/20
                "
              >
                
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

function ValueCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <article
      className="
        rounded-[1.75rem]
        border
        border-white/10
        bg-white/[0.055]
        p-5
        backdrop-blur-2xl
      "
    >
      <p
        className="
          text-xs
          font-black
          uppercase
          tracking-[0.14em]
          text-white/35
        "
      >
        {label}
      </p>

      <p
        className="
          mt-3
          text-2xl
          font-black
          text-white
        "
      >
        {value}
      </p>

      <p
        className="
          mt-2
          text-sm
          font-semibold
          text-white/30
        "
      >
        {caption}
      </p>
    </article>
  );
}