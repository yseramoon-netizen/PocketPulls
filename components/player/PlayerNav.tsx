"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import UnownText from "@/components/player/UnownText";
import { supabase } from "@/lib/supabase";

type PlayerNavProps = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  wishBalance: number;
};

type NavItem = {
  href: string;
  label: string;
  glyph: string;
  reward?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const PRIMARY_ITEMS: NavItem[] = [
  {
    href: "/wishes",
    label: "Wishes",
    glyph: "✦",
  },
  {
    href: "/catalogue",
    label: "Catalogue",
    glyph: "▤",
  },
  {
    href: "/collection",
    label: "Collection",
    glyph: "▣",
  },
  {
    href: "/friends",
    label: "Friends",
    glyph: "♢",
  },
  {
    href: "/trade",
    label: "Trade",
    glyph: "⇄",
  },
];

const MORE_ITEMS: NavItem[] = [
  {
    href: "/constellation",
    label: "Stars",
    glyph: "✧",
  },
  {
    href: "/history",
    label: "History",
    glyph: "◷",
  },
  {
    href: "/rewards",
    label: "Daily Gift",
    glyph: "◇",
    reward: true,
  },
  {
    href: "/achievements",
    label: "Badges",
    glyph: "✪",
  },
  {
    href: "/leaderboard",
    label: "Ranks",
    glyph: "▥",
  },
  {
    href: "/shipping",
    label: "Shipping",
    glyph: "▰",
  },
  {
    href: "/wishes/shop",
    label: "Recharge",
    glyph: "✦",
  },
  {
    href: "/help",
    label: "Help",
    glyph: "?",
  },
];

const PROFILE_ITEM: NavItem = {
  href: "/profile",
  label: "Profile",
  glyph: "◉",
};

const ALL_ITEMS = [
  ...PRIMARY_ITEMS,
  ...MORE_ITEMS,
  PROFILE_ITEM,
];

const MOBILE_DOCK_ITEMS = [
  PRIMARY_ITEMS[0],
  PRIMARY_ITEMS[2],
  PRIMARY_ITEMS[3],
  PRIMARY_ITEMS[4],
];

const DRAWER_GROUPS: NavGroup[] = [
  {
    label: "Your cards",
    items: [
      PRIMARY_ITEMS[0],
      PRIMARY_ITEMS[1],
      PRIMARY_ITEMS[2],
    ],
  },
  {
    label: "Social",
    items: [
      PRIMARY_ITEMS[3],
      PRIMARY_ITEMS[4],
      MORE_ITEMS[4],
    ],
  },
  {
    label: "Progress",
    items: [
      MORE_ITEMS[0],
      MORE_ITEMS[1],
      MORE_ITEMS[2],
      MORE_ITEMS[3],
    ],
  },
  {
    label: "Account",
    items: [
      MORE_ITEMS[5],
      MORE_ITEMS[6],
      MORE_ITEMS[7],
      PROFILE_ITEM,
    ],
  },
];

function isActive(
  pathname: string,
  href: string,
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}

function getInitial(
  value: string,
): string {
  const trimmed =
    value.trim();

  return trimmed
    ? trimmed
        .charAt(0)
        .toUpperCase()
    : "T";
}

function Glyph({
  value,
  small = false,
}: {
  value: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex flex-none items-center justify-center font-black leading-none",
        small
          ? "h-5 w-5 text-base"
          : "h-7 w-7 text-xl",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

export default function PlayerNav({
  username,
  displayName,
  avatarUrl,
  wishBalance,
}: PlayerNavProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const moreDetailsRef =
    useRef<HTMLDetailsElement | null>(null);

  const closeMore = () => {
    if (moreDetailsRef.current) {
      moreDetailsRef.current.open = false;
    }
  };

  const [
    drawerOpen,
    setDrawerOpen,
  ] =
    useState(false);

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false);

  const [
    displayedWishBalance,
    setDisplayedWishBalance,
  ] =
    useState(
      wishBalance,
    );

  const [
    rewardReady,
    setRewardReady,
  ] =
    useState(false);

  const currentItem =
    useMemo(
      () =>
        ALL_ITEMS.find(
          (item) =>
            isActive(
              pathname,
              item.href,
            ),
        ) || {
          href: pathname,
          label: "Unown Pulls",
          glyph: "✦",
        },
      [pathname],
    );

  const moreActive =
    MORE_ITEMS.some(
      (item) =>
        isActive(
          pathname,
          item.href,
        ),
    );

  useEffect(() => {
    setDisplayedWishBalance(
      wishBalance,
    );
  }, [wishBalance]);

  useEffect(() => {
    setDrawerOpen(false);
    closeMore();
  }, [pathname]);

  useEffect(() => {
    const handleCloseMore = () => {
      closeMore();
    };

    window.addEventListener(
      "unown-pulls:close-more",
      handleCloseMore,
    );

    return () => {
      window.removeEventListener(
        "unown-pulls:close-more",
        handleCloseMore,
      );
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const original =
      document.body.style
        .overflow;

    document.body.style
      .overflow =
      "hidden";

    const handleEscape =
      (
        event:
          KeyboardEvent,
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setDrawerOpen(
            false,
          );
        }
      };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style
        .overflow =
        original;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [drawerOpen]);

  useEffect(() => {
    const handleWishBalance =
      (
        event: Event,
      ) => {
        const customEvent =
          event as
            CustomEvent<{
              wishBalance?:
                unknown;
            }>;

        const parsed =
          Number(
            customEvent
              .detail
              ?.wishBalance,
          );

        if (
          Number.isFinite(
            parsed,
          )
        ) {
          setDisplayedWishBalance(
            Math.max(
              0,
              Math.floor(
                parsed,
              ),
            ),
          );
        }
      };

    window.addEventListener(
      "pocketpulls:wish-balance",
      handleWishBalance,
    );

    return () => {
      window.removeEventListener(
        "pocketpulls:wish-balance",
        handleWishBalance,
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function checkReward() {
      const [dailyResult, achievementResult] =
        await Promise.all([
          supabase.rpc("get_daily_reward_status"),
          supabase.rpc("get_player_achievements"),
        ]);

      if (!active) {
        return;
      }

      let dailyReady = false;

      if (!dailyResult.error) {
        const row = Array.isArray(dailyResult.data)
          ? dailyResult.data[0]
          : dailyResult.data;

        if (
          typeof row === "object" &&
          row !== null &&
          "claimed_today" in row
        ) {
          dailyReady =
            (row as { claimed_today?: unknown })
              .claimed_today !== true;
        }
      }

      let badgeReady = false;

      if (!achievementResult.error && Array.isArray(achievementResult.data)) {
        badgeReady = achievementResult.data.some((item: unknown) => {
          if (typeof item !== "object" || item === null) {
            return false;
          }

          const row = item as {
            unlocked_at?: unknown;
            reward_claimed_at?: unknown;
            reward_wishes?: unknown;
          };

          return (
            typeof row.unlocked_at === "string" &&
            !row.reward_claimed_at &&
            Number(row.reward_wishes) > 0
          );
        });
      }

      setRewardReady(dailyReady || badgeReady);
    }

    void checkReward();

    const handleRewardClaimed =
      () => {
        void checkReward();
      };

    window.addEventListener(
      "pocketpulls:reward-claimed",
      handleRewardClaimed,
    );
    window.addEventListener(
      "pocketpulls:achievement-reward-claimed",
      handleRewardClaimed,
    );

    return () => {
      active = false;

      window.removeEventListener(
        "pocketpulls:reward-claimed",
        handleRewardClaimed,
      );
      window.removeEventListener(
        "pocketpulls:achievement-reward-claimed",
        handleRewardClaimed,
      );
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    const {
      error,
    } =
      await supabase.auth
        .signOut();

    if (error) {
      console.error(
        "Player sign-out error:",
        error,
      );

      setSigningOut(false);
      return;
    }

    router.replace(
      "/sign-in",
    );

    router.refresh();
  }

  return (
    <>
      <header
        className="
          sticky
          top-0
          z-50
          border-b
          border-violet-200/15
          bg-[#07091f]/95
          shadow-[0_12px_45px_rgba(0,0,0,0.24)]
          backdrop-blur-2xl
        "
        style={{
          backgroundImage:
            "linear-gradient(112deg,rgba(34,211,238,0.08),rgba(7,9,31,0.96) 24%,rgba(124,58,237,0.12) 52%,rgba(103,232,249,0.07) 76%,rgba(250,204,21,0.035))",
        }}
      >
        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-cyan-200/35
            to-transparent
          "
        />

        <div
          className="
            mx-auto
            flex
            min-h-[4.5rem]
            w-full
            max-w-[1760px]
            items-center
            gap-3
            px-3
            sm:px-5
            lg:px-7
          "
        >
          <button
            type="button"
            onClick={() =>
              setDrawerOpen(true)
            }
            aria-label="Open player menu"
            className="
              relative
              flex
              h-11
              w-11
              flex-none
              items-center
              justify-center
              rounded-2xl
              border
              border-white/10
              bg-white/[0.055]
              text-white
              transition
              hover:bg-white/[0.09]
              xl:hidden
            "
          >
            {rewardReady ? (
              <span
                className="
                  absolute
                  right-1.5
                  top-1.5
                  h-2
                  w-2
                  animate-pulse
                  rounded-full
                  bg-yellow-200
                "
              />
            ) : null}

            <span
              aria-hidden="true"
              className="text-xl"
            >
              ☰
            </span>
          </button>

          <Link
            href="/wishes"
            onClick={closeMore}
            title="Unown Pulls"
            className="
              flex
              min-w-0
              items-center
              gap-2.5
              rounded-xl
              outline-none
              focus-visible:ring-2
              focus-visible:ring-cyan-200
            "
          >
            <div
              className="
                relative
                flex
                h-12
                w-12
                flex-none
                items-center
                justify-center
              "
            >
              <div
                className="
                  absolute
                  inset-1
                  rounded-full
                  border
                  border-cyan-100/16
                  bg-violet-300/[0.07]
                "
              />

              <div
                className="
                  absolute
                  inset-2
                  rounded-full
                  bg-cyan-200/10
                  blur-xl
                "
              />

              <img
                src="/jirachi.png"
                alt=""
                draggable={false}
                className="
                  relative
                  z-10
                  h-10
                  w-10
                  object-contain
                  drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]
                "
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <UnownText
                text="Unown Pulls"
                size="1rem"
                tone="holo"
                wrap={false}
              />

              <p
                className="
                  mt-1
                  hidden
                  text-[0.55rem]
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-cyan-100/35
                  lg:block
                "
              >
                Ancient wishes · real cards
              </p>
            </div>
          </Link>

          <div className="min-w-0 flex-1 sm:hidden">
            <p
              className="
                truncate
                text-[0.58rem]
                font-black
                uppercase
                tracking-[0.16em]
                text-violet-100/35
              "
            >
              Unown Pulls
            </p>

            <p
              className="
                mt-0.5
                truncate
                text-sm
                font-black
                text-white
              "
            >
              {currentItem.label}
            </p>
          </div>

          <nav
            className="
              ml-auto
              hidden
              items-center
              gap-1
              xl:flex
            "
          >
            {PRIMARY_ITEMS.map(
              (item) => (
                <DesktopLink
                  key={item.href}
                  item={item}
                  active={isActive(
                    pathname,
                    item.href,
                  )}
                  onNavigate={closeMore}
                />
              ),
            )}

            <details ref={moreDetailsRef} className="group relative">
              <summary
                className={[
                  "relative flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border px-3 text-sm font-black transition [&::-webkit-details-marker]:hidden",
                  moreActive
                    ? "border-violet-200/20 bg-violet-300/[0.09] text-white"
                    : "border-transparent text-white/50 hover:border-white/10 hover:bg-white/[0.045] hover:text-white",
                ].join(" ")}
              >
                More
                <span
                  aria-hidden="true"
                  className="transition group-open:rotate-180"
                >
                  ▾
                </span>

                {rewardReady ? (
                  <span
                    className="
                      absolute
                      right-1
                      top-1
                      h-1.5
                      w-1.5
                      animate-pulse
                      rounded-full
                      bg-yellow-200
                    "
                  />
                ) : null}
              </summary>

              <div
                className="
                  absolute
                  right-0
                  top-[calc(100%+0.75rem)]
                  z-[80]
                  w-64
                  rounded-2xl
                  border
                  border-violet-200/15
                  bg-[#090b27]/98
                  p-2
                  shadow-[0_28px_90px_rgba(0,0,0,0.5)]
                  backdrop-blur-3xl
                "
              >
                {MORE_ITEMS.map(
                  (item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMore}
                      className={[
                        "relative flex min-h-12 items-center gap-3 rounded-xl border px-3 transition",
                        isActive(
                          pathname,
                          item.href,
                        )
                          ? "border-cyan-100/15 bg-cyan-200/[0.08] text-cyan-50"
                          : "border-transparent text-white/50 hover:bg-white/[0.06] hover:text-white",
                      ].join(" ")}
                    >
                      <span
                        className="
                          flex
                          h-9
                          w-9
                          flex-none
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-white/10
                          bg-white/[0.045]
                          text-lg
                          font-black
                        "
                      >
                        {item.glyph}
                      </span>

                      <span className="text-sm font-black">
                        {item.label}
                      </span>

                      {item.reward &&
                      rewardReady ? (
                        <span
                          className="
                            ml-auto
                            h-2
                            w-2
                            animate-pulse
                            rounded-full
                            bg-yellow-200
                          "
                        />
                      ) : null}
                    </Link>
                  ),
                )}
              </div>
            </details>
          </nav>

          <div
            className="
              ml-auto
              flex
              items-center
              gap-2
              xl:ml-2
            "
          >
            <Link
              href="/wishes"
              onClick={closeMore}
              title="Wish balance"
              className="
                rounded-xl
                border
                border-yellow-100/18
                bg-yellow-200/[0.07]
                px-3
                py-2
              "
            >
              <span
                className="
                  block
                  text-[0.52rem]
                  font-black
                  uppercase
                  tracking-[0.12em]
                  text-yellow-100/45
                "
              >
                Wishes
              </span>

              <p
                className="
                  mt-0.5
                  text-sm
                  font-black
                  text-yellow-50
                "
              >
                {Math.max(
                  0,
                  Math.floor(
                    displayedWishBalance,
                  ),
                )}
              </p>
            </Link>

            <Link
              href="/profile"
              onClick={closeMore}
              className="
                hidden
                items-center
                gap-3
                rounded-xl
                border
                border-white/10
                bg-white/[0.04]
                px-2.5
                py-2
                pr-4
                2xl:flex
              "
            >
              <Avatar
                avatarUrl={avatarUrl}
                name={
                  displayName ||
                  username
                }
                small
              />

              <div className="max-w-28 min-w-0">
                <p className="truncate text-xs font-black text-white">
                  {displayName}
                </p>

                <p className="truncate text-[0.58rem] font-bold text-violet-100/40">
                  @{username}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() =>
                void handleSignOut()
              }
              disabled={signingOut}
              className="
                hidden
                min-h-11
                items-center
                rounded-xl
                border
                border-pink-200/15
                bg-pink-300/[0.055]
                px-3
                text-sm
                font-black
                text-pink-50
                transition
                hover:bg-pink-300/[0.1]
                disabled:opacity-45
                2xl:flex
              "
            >
              {signingOut
                ? "Leaving"
                : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile primary navigation"
        className="
          fixed
          inset-x-0
          bottom-0
          z-[90]
          grid
          grid-cols-5
          gap-1
          border-t
          border-violet-200/15
          bg-[#080a24]/96
          px-2
          pb-[max(0.5rem,env(safe-area-inset-bottom))]
          pt-1.5
          shadow-[0_-18px_55px_rgba(0,0,0,0.48)]
          backdrop-blur-3xl
          md:hidden
        "
      >
        {MOBILE_DOCK_ITEMS.map(
          (item) => (
            <DockLink
              key={item.href}
              item={item}
              active={isActive(
                pathname,
                item.href,
              )}
            />
          ),
        )}

        <button
          type="button"
          onClick={() =>
            setDrawerOpen(true)
          }
          className="
            relative
            flex
            min-h-[3.75rem]
            flex-col
            items-center
            justify-center
            gap-1
            rounded-[1.15rem]
            text-white/45
            transition
            hover:bg-white/[0.055]
            hover:text-white
          "
        >
          {rewardReady ? (
            <span
              className="
                absolute
                right-3
                top-2
                h-2
                w-2
                animate-pulse
                rounded-full
                bg-yellow-200
              "
            />
          ) : null}

          <span
            aria-hidden="true"
            className="text-lg font-black"
          >
            ☰
          </span>

          <span className="text-[0.58rem] font-black">
            Menu
          </span>
        </button>
      </nav>

      <div
        className={[
          "fixed inset-0 z-[200] transition xl:hidden",
          drawerOpen
            ? "pointer-events-auto"
            : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close player menu"
          onClick={() =>
            setDrawerOpen(false)
          }
          className={[
            "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity",
            drawerOpen
              ? "opacity-100"
              : "opacity-0",
          ].join(" ")}
        />

        <aside
          className={[
            "absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col border-r border-violet-200/15 bg-[#07091f]/98 shadow-[35px_0_110px_rgba(0,0,0,0.5)] transition-transform duration-300",
            drawerOpen
              ? "translate-x-0"
              : "-translate-x-full",
          ].join(" ")}
          style={{
            backgroundImage:
              "linear-gradient(155deg,rgba(168,91,42,0.16),rgba(8,6,29,0.99) 28%,rgba(117,72,181,0.15) 58%,rgba(53,209,197,0.1) 82%,rgba(207,66,95,0.12))",
          }}
        >
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  avatarUrl={avatarUrl}
                  name={
                    displayName ||
                    username
                  }
                />

                <div className="min-w-0">
                  <p className="truncate font-black text-white">
                    {displayName}
                  </p>

                  <p className="mt-0.5 truncate text-xs font-bold text-violet-100/40">
                    @{username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDrawerOpen(false)
                }
                aria-label="Close player menu"
                className="
                  flex
                  h-10
                  w-10
                  flex-none
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.05]
                  text-lg
                  font-black
                  text-white
                "
              >
                ×
              </button>
            </div>

            <Link
              href="/wishes"
              onClick={() =>
                setDrawerOpen(false)
              }
              className="
                mt-5
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-yellow-100/15
                bg-yellow-200/[0.07]
                px-4
                py-3
              "
            >
              <span
                className="
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.14em]
                  text-yellow-100/45
                "
              >
                Wish balance
              </span>

              <span className="text-lg font-black text-yellow-50">
                {Math.max(
                  0,
                  Math.floor(
                    displayedWishBalance,
                  ),
                )}
              </span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            {DRAWER_GROUPS.map(
              (group) => (
                <section
                  key={group.label}
                  className="mb-6 last:mb-0"
                >
                  <p
                    className="
                      mb-2
                      px-2
                      text-[0.62rem]
                      font-black
                      uppercase
                      tracking-[0.18em]
                      text-cyan-100/30
                    "
                  >
                    {group.label}
                  </p>

                  <div className="space-y-1">
                    {group.items.map(
                      (item) => (
                        <DrawerLink
                          key={item.href}
                          item={item}
                          active={isActive(
                            pathname,
                            item.href,
                          )}
                          rewardReady={
                            rewardReady
                          }
                          onNavigate={() =>
                            setDrawerOpen(
                              false,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() =>
                void handleSignOut()
              }
              disabled={signingOut}
              className="
                min-h-12
                w-full
                rounded-xl
                border
                border-red-200/15
                bg-red-400/[0.08]
                px-4
                text-sm
                font-black
                text-red-100
                transition
                hover:bg-red-400/[0.13]
                disabled:opacity-45
              "
            >
              {signingOut
                ? "Signing out..."
                : "Sign out"}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function DesktopLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-black transition",
        active
          ? "border-violet-200/20 bg-violet-300/[0.09] text-white"
          : "border-transparent text-white/48 hover:border-white/10 hover:bg-white/[0.045] hover:text-white",
      ].join(" ")}
    >
      <Glyph
        value={item.glyph}
        small
      />

      {item.label}
    </Link>
  );
}

function DockLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={[
        "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl transition",
        active
          ? "bg-gradient-to-b from-cyan-200/[0.14] to-violet-300/[0.1] text-cyan-50"
          : "text-white/42 hover:bg-white/[0.055] hover:text-white",
      ].join(" ")}
    >
      <Glyph
        value={item.glyph}
        small
      />

      <span className="text-[0.58rem] font-black">
        {item.label}
      </span>

      {active ? (
        <span
          className="
            absolute
            bottom-1
            h-0.5
            w-5
            rounded-full
            bg-cyan-100
          "
        />
      ) : null}
    </Link>
  );
}

function DrawerLink({
  item,
  active,
  rewardReady,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  rewardReady: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "relative flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 transition",
        active
          ? "border-cyan-100/20 bg-cyan-200/[0.09] text-cyan-50"
          : "border-transparent text-white/52 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 flex-none items-center justify-center rounded-xl border text-lg font-black",
          active
            ? "border-cyan-100/15 bg-cyan-200/[0.08]"
            : "border-white/10 bg-white/[0.04]",
        ].join(" ")}
      >
        {item.glyph}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-black">
        {item.label}
      </span>

      {item.reward &&
      rewardReady ? (
        <span
          className="
            h-2
            w-2
            flex-none
            animate-pulse
            rounded-full
            bg-yellow-200
          "
        />
      ) : null}

      <span
        aria-hidden="true"
        className="text-white/20"
      >
        ›
      </span>
    </Link>
  );
}

function Avatar({
  avatarUrl,
  name,
  small = false,
}: {
  avatarUrl: string | null;
  name: string;
  small?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-none items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 font-black text-white",
        small
          ? "h-9 w-9 text-xs"
          : "h-12 w-12 text-sm",
      ].join(" ")}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        getInitial(name)
      )}
    </div>
  );
}
