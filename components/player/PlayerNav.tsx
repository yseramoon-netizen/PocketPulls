"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

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
  { href: "/leaderboard", label: "Leaderboard" },
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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07091f]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/wishes"
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-yellow-200"
          >
            <div className="relative flex h-14 w-14 flex-none items-center justify-center">
              <div className="absolute inset-2 rounded-full bg-yellow-200/15 blur-xl" />

              <img
                src="/jirachi.png"
                alt=""
                draggable={false}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="relative z-10 h-12 w-12 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]"
              />

              <span className="absolute text-4xl text-yellow-100/25">
                *
              </span>
            </div>

            <div className="hidden sm:block">
              <p className="text-lg font-black text-white">
                PocketPulls
              </p>

              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100/40">
                Wish upon a star
              </p>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 xl:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-xl border px-3 py-3 text-xs font-black transition",
                    active
                      ? "border-violet-200/20 bg-violet-300/10 text-white"
                      : "border-transparent text-white/45 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 xl:ml-2">
            <Link
              href="/wishes"
              className="rounded-xl border border-yellow-100/20 bg-yellow-200/[0.08] px-3 py-2"
            >
              <p className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-yellow-100/45">
                Wishes
              </p>

              <p className="text-sm font-black text-yellow-50">
                {Math.max(0, Math.floor(wishBalance))}
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
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span>{getInitial(displayName || username)}</span>
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
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white xl:hidden"
            >
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
          className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-lg xl:hidden"
          onPointerDown={() => setMenuOpen(false)}
        >
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(92vw,26rem)] flex-col border-l border-white/10 bg-[#080a24]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="font-black text-white">{displayName}</p>
                <p className="text-xs font-bold text-white/35">@{username}</p>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-black text-white"
              >
                X
              </button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto p-4">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "block rounded-2xl border px-4 py-4 text-sm font-black transition",
                      active
                        ? "border-violet-200/20 bg-violet-300/10 text-white"
                        : "border-transparent text-white/50 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="min-h-12 w-full rounded-xl border border-red-200/10 bg-red-400/[0.06] px-4 text-sm font-black text-red-100 disabled:opacity-40"
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
