"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
};

const NAV_ITEMS: NavItem[] = [
  { href: "/wishes", label: "Wishes" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/collection", label: "Collection" },
  { href: "/constellation", label: "Stars" },
  { href: "/history", label: "History" },
  { href: "/rewards", label: "Daily Gift" },
  { href: "/achievements", label: "Badges" },
  { href: "/leaderboard", label: "Ranks" },
  { href: "/shipping", label: "Shipping" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitial(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "T";
}

export default function PlayerNav({
  username,
  displayName,
  avatarUrl,
  wishBalance,
}: PlayerNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [displayedWishBalance, setDisplayedWishBalance] =
    useState(wishBalance);
  const [rewardReady, setRewardReady] = useState(false);

  useEffect(() => {
    setDisplayedWishBalance(wishBalance);
  }, [wishBalance]);

  useEffect(() => {
    const handleWishBalance = (event: Event) => {
      const customEvent = event as CustomEvent<{
        wishBalance?: unknown;
      }>;

      const parsed = Number(
        customEvent.detail?.wishBalance,
      );

      if (Number.isFinite(parsed)) {
        setDisplayedWishBalance(
          Math.max(0, Math.floor(parsed)),
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

    const checkReward = async () => {
      const { data, error } = await supabase.rpc(
        "get_daily_reward_status",
      );

      if (!active || error) {
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (
        typeof row === "object" &&
        row !== null &&
        "claimed_today" in row
      ) {
        setRewardReady(
          (row as { claimed_today?: unknown })
            .claimed_today !== true,
        );
      }
    };

    void checkReward();

    const handleRewardClaimed = () => {
      setRewardReady(false);
    };

    window.addEventListener(
      "pocketpulls:reward-claimed",
      handleRewardClaimed,
    );

    return () => {
      active = false;
      window.removeEventListener(
        "pocketpulls:reward-claimed",
        handleRewardClaimed,
      );
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Player sign-out error:", error);
      setSigningOut(false);
      return;
    }

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-violet-200/15 bg-[#07091f]/96 shadow-[0_12px_45px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
        style={{
          backgroundImage:
            "linear-gradient(112deg, rgba(34,211,238,0.08), rgba(7,9,31,0.96) 24%, rgba(124,58,237,0.12) 52%, rgba(103,232,249,0.07) 76%, rgba(250,204,21,0.035))",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-r from-transparent via-violet-100/[0.035] to-transparent opacity-70 [mask-image:url('/unknown-pulls/unown-band.png')] [mask-position:center] [mask-repeat:repeat-x] [mask-size:auto_14px]"
        />

        <div className="mx-auto flex min-h-20 w-full max-w-[1760px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/wishes"
            title="Unknown Pulls"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            <div className="relative flex h-14 w-14 flex-none items-center justify-center">
              <div className="absolute inset-1 rounded-full border border-cyan-100/16 bg-violet-300/[0.07] shadow-[inset_0_0_16px_rgba(103,232,249,0.08)]" />
              <div className="absolute inset-2 rounded-full bg-cyan-200/10 blur-xl" />

              <img
                src="/jirachi.png"
                alt=""
                draggable={false}
                className="relative z-10 h-11 w-11 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]"
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <UnownText
                text="Unknown Pulls"
                size="1.12rem"
                tone="holo"
                wrap={false}
              />

              <p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100/35">
                Ancient wishes · real cards
              </p>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-0.5 2xl:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const rewardItem = item.href === "/rewards";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={[
                    "relative rounded-xl border px-2 py-3 transition",
                    active
                      ? "border-violet-200/20 bg-violet-300/[0.09] shadow-[inset_0_0_0_1px_rgba(103,232,249,0.04)]"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.045]",
                  ].join(" ")}
                >
                  <UnownText
                    text={item.label}
                    size="0.72rem"
                    tone={active ? "holo" : "muted"}
                    wrap={false}
                  />

                  {rewardItem && rewardReady ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 2xl:ml-2">
            <Link
              href="/wishes"
              title="Wish balance"
              className="rounded-xl border border-yellow-100/18 bg-yellow-200/[0.07] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.025)]"
            >
              <UnownText
                text="Wishes"
                size="0.58rem"
                tone="muted"
                wrap={false}
              />

              <p className="mt-1 text-sm font-black text-yellow-50">
                {Math.max(
                  0,
                  Math.floor(displayedWishBalance),
                )}
              </p>
            </Link>

            <Link
              href="/profile"
              className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 pr-4 md:flex"
            >
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 text-xs font-black text-white">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>
                    {getInitial(displayName || username)}
                  </span>
                )}
              </div>

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
              onClick={() => setMenuOpen(true)}
              aria-label="Open player menu"
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white 2xl:hidden"
            >
              {rewardReady ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-yellow-200" />
              ) : null}

              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 7h14" />
                <path d="M5 12h14" />
                <path d="M5 17h14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-[200] bg-black/78 backdrop-blur-lg 2xl:hidden"
          onPointerDown={() => setMenuOpen(false)}
        >
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(94vw,30rem)] flex-col border-l border-violet-200/15 bg-[#07091f]/98 shadow-[-30px_0_100px_rgba(0,0,0,0.45)]"
            style={{
              backgroundImage:
                "linear-gradient(155deg, rgba(168,91,42,0.18), rgba(8,6,29,0.98) 28%, rgba(117,72,181,0.15) 58%, rgba(53,209,197,0.1) 82%, rgba(207,66,95,0.12))",
            }}
            onPointerDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="relative flex items-center justify-between border-b border-white/10 p-5">
              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-200/25 to-transparent" />

              <div className="min-w-0">
                <UnownText
                  text="Unknown Pulls"
                  size="1.05rem"
                  tone="holo"
                  wrap={false}
                />
                <p className="mt-2 truncate text-xs font-bold text-white/35">
                  {displayName} · @{username}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close player menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-black text-white"
              >
                X
              </button>
            </div>

            <nav className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-4">
              {NAV_ITEMS.map((item) => {
                const active = isActive(
                  pathname,
                  item.href,
                );
                const rewardItem =
                  item.href === "/rewards";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "relative flex min-h-20 items-center justify-center rounded-xl border px-3 py-4",
                      active
                        ? "border-violet-200/20 bg-violet-300/[0.09]"
                        : "border-white/10 bg-white/[0.035]",
                    ].join(" ")}
                  >
                    <UnownText
                      text={item.label}
                      size="0.82rem"
                      tone={active ? "holo" : "muted"}
                      centred
                    />

                    {rewardItem && rewardReady ? (
                      <span className="absolute right-3 top-3 h-2 w-2 animate-pulse rounded-full bg-yellow-200" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="min-h-12 w-full rounded-xl border border-red-200/15 bg-red-400/[0.08] px-4 text-sm font-black text-red-100"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
