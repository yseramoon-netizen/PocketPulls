"use client";

import Link from "next/link";

import ShayminMoodButton from "@/components/admin/ShayminMoodButton";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import {
  signOutAdmin,
} from "@/lib/admin/client-auth";

type AdminNavItem = {
  href: string;
  label: string;
  shortLabel: string;
};

const ADMIN_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Admin",
    shortLabel: "Home",
  },
  {
    href: "/admin/add",
    label: "Add Card",
    shortLabel: "Add",
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    shortLabel: "Stock",
  },
  {
    href: "/admin/pulls",
    label: "Wish Lab",
    shortLabel: "Lab",
  },
  {
    href: "/admin/players",
    label: "Players",
    shortLabel: "Players",
  },
];

function isActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/admin") {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}

export default function AdminNav() {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await signOutAdmin();
    } catch (error: unknown) {
      console.error(
        "Admin sign-out error:",
        error,
      );

      router.replace(
        "/admin/sign-in",
      );
      router.refresh();
    }
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav
      className="
        relative
        z-50
        overflow-visible
        rounded-[2rem]
        border
        border-emerald-100/15
        bg-[#061a13]/82
        px-3
        py-3
        shadow-[0_24px_80px_rgba(0,0,0,0.32)]
        backdrop-blur-3xl
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-x-8
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-emerald-100/35
          to-transparent
        "
      />

      <div
        className="
          flex
          min-h-14
          items-center
          gap-3
        "
      >
        <div className="flex min-w-0 items-center gap-3 px-2 py-1">
          <ShayminMoodButton />

          <Link
            href="/admin"
            className="hidden min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:block"
          >
            <p className="truncate text-sm font-black tracking-tight text-white">
              Ancient Pulls
            </p>

            <p className="mt-0.5 truncate text-[0.58rem] font-black uppercase tracking-[0.17em] text-emerald-100/38">
              Operations console
            </p>
          </Link>
        </div>

        <div
          className="
            ml-auto
            hidden
            items-center
            gap-1
            lg:flex
          "
        >
          {ADMIN_ITEMS.map(
            (item) => {
              const active =
                isActive(
                  pathname,
                  item.href,
                );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "relative inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-black transition",
                    active
                      ? "border-emerald-100/25 bg-emerald-200/[0.12] text-emerald-50 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.04)]"
                      : "border-transparent text-white/48 hover:border-white/10 hover:bg-white/[0.055] hover:text-white",
                  ].join(
                    " ",
                  )}
                >
                  {item.label}

                  {active ? (
                    <span
                      className="
                        absolute
                        bottom-1
                        h-0.5
                        w-6
                        rounded-full
                        bg-emerald-200
                        shadow-[0_0_8px_rgba(110,231,183,0.7)]
                      "
                    />
                  ) : null}
                </Link>
              );
            },
          )}
        </div>

        <Link
          href="/admin/database"
          className="
            hidden
            min-h-11
            items-center
            justify-center
            rounded-xl
            border
            border-cyan-100/15
            bg-cyan-200/[0.06]
            px-4
            text-xs
            font-black
            text-cyan-50/75
            transition
            hover:bg-cyan-200/[0.11]
            xl:inline-flex
          "
        >
          Database
        </Link>

        <button
          type="button"
          onClick={() =>
            void handleSignOut()
          }
          disabled={signingOut}
          className="hidden min-h-11 items-center justify-center rounded-xl border border-rose-200/15 bg-rose-300/[0.06] px-4 text-xs font-black text-rose-50/80 transition hover:bg-rose-300/[0.12] disabled:opacity-45 xl:inline-flex"
        >
          {signingOut
            ? "Logging out..."
            : "Log out"}
        </button>

        <button
          type="button"
          onClick={() =>
            setMobileOpen(
              (current) =>
                !current,
            )
          }
          aria-expanded={mobileOpen}
          aria-label="Open admin navigation"
          className="
            ml-auto
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            border
            border-white/10
            bg-white/[0.055]
            text-xl
            font-black
            text-white
            transition
            hover:bg-white/[0.09]
            lg:hidden
          "
        >
          {mobileOpen
            ? "×"
            : "☰"}
        </button>
      </div>

      {mobileOpen ? (
        <div
          className="
            mt-3
            grid
            grid-cols-2
            gap-2
            border-t
            border-white/10
            pt-3
            sm:grid-cols-3
            lg:hidden
          "
        >
          {ADMIN_ITEMS.map(
            (item) => {
              const active =
                isActive(
                  pathname,
                  item.href,
                );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-black transition",
                    active
                      ? "border-emerald-100/25 bg-emerald-200/[0.12] text-emerald-50"
                      : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white",
                  ].join(
                    " ",
                  )}
                >
                  {item.shortLabel}
                </Link>
              );
            },
          )}

          <Link
            href="/admin/database"
            className="
              flex
              min-h-12
              items-center
              justify-center
              rounded-xl
              border
              border-cyan-100/15
              bg-cyan-200/[0.06]
              px-3
              text-sm
              font-black
              text-cyan-50/75
            "
          >
            Database
          </Link>

          <button
            type="button"
            onClick={() =>
              void handleSignOut()
            }
            disabled={signingOut}
            className="flex min-h-12 items-center justify-center rounded-xl border border-rose-200/15 bg-rose-300/[0.07] px-3 text-sm font-black text-rose-50/80 disabled:opacity-45"
          >
            {signingOut
              ? "Leaving..."
              : "Log out"}
          </button>
        </div>
      ) : null}
    </nav>
  );
}
