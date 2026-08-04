"use client";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

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
    label: "Pull",
    shortLabel: "Pull",
  },
  {
    href: "/admin/tree",
    label: "Wallet",
    shortLabel: "Wallet",
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

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

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
        <Link
          href="/admin"
          className="
            flex
            min-w-0
            items-center
            gap-3
            rounded-2xl
            px-2
            py-1
            outline-none
            focus-visible:ring-2
            focus-visible:ring-emerald-200
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
              overflow-hidden
              rounded-2xl
              border
              border-emerald-100/20
              bg-emerald-200/10
              shadow-[inset_0_0_20px_rgba(110,231,183,0.08)]
            "
          >
            <img
              src="/shaymin-moods/lukas.png"
              alt=""
              draggable={false}
              className="
                h-full
                w-full
                object-cover
                object-center
              "
            />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p
              className="
                truncate
                text-sm
                font-black
                tracking-tight
                text-white
              "
            >
              PocketPulls
            </p>

            <p
              className="
                mt-0.5
                truncate
                text-[0.58rem]
                font-black
                uppercase
                tracking-[0.17em]
                text-emerald-100/38
              "
            >
              Shaymin operations
            </p>
          </div>
        </Link>

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
        </div>
      ) : null}
    </nav>
  );
}
