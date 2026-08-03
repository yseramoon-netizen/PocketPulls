"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: "⌂",
    description: "Operations overview",
  },
  {
    label: "Add Cards",
    href: "/admin/add",
    icon: "＋",
    description: "Inventory intake",
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: "▦",
    description: "Physical stock",
  },
  {
    label: "Pulls",
    href: "/admin/pulls",
    icon: "✦",
    description: "Discovery terminal",
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [signingOut, setSigningOut] =
    useState(false);

  const [adminName, setAdminName] =
    useState("Lukas");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadAdminName() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Admin profile error:",
            profileError,
          );
        }

        const profileName =
          typeof profile?.name === "string"
            ? profile.name.trim()
            : "";

        const metadataName =
          typeof user.user_metadata?.full_name ===
          "string"
            ? user.user_metadata.full_name.trim()
            : typeof user.user_metadata?.name ===
                "string"
              ? user.user_metadata.name.trim()
              : "";

        setAdminName(
          profileName ||
            metadataName ||
            "Lukas",
        );
      } catch (error) {
        console.error(
          "Admin navigation user error:",
          error,
        );

        setAdminName("Lukas");
      }
    }

    void loadAdminName();
  }, []);

  const currentPage = useMemo(() => {
    return (
      navigationItems.find((item) =>
        isActiveRoute(pathname, item.href),
      ) || navigationItems[0]
    );
  }, [pathname]);

  async function handleLogout() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setSigningOut(false);
    }
  }

  return (
    <nav className="sticky top-4 z-50 w-full">
      <div
        className="
          relative
          overflow-hidden
          rounded-[2rem]
          border
          border-white/15
          bg-[#03150f]/80
          shadow-[0_24px_80px_rgba(0,0,0,0.35)]
          backdrop-blur-3xl
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-gradient-to-r
            from-emerald-300/[0.08]
            via-white/[0.025]
            to-cyan-300/[0.05]
          "
        />

        <div
          className="
            relative
            z-10
            flex
            min-h-20
            items-center
            justify-between
            gap-4
            px-4
            py-3
            md:px-5
          "
        >
          <Link
            href="/admin"
            className="
              group
              flex
              min-w-0
              items-center
              gap-3
              rounded-2xl
              outline-none
              transition
              focus-visible:ring-2
              focus-visible:ring-emerald-300
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
                rounded-[1.1rem]
                border
                border-emerald-200/20
                bg-gradient-to-br
                from-emerald-300/20
                to-emerald-950/30
                shadow-[0_0_28px_rgba(52,211,153,0.16)]
                transition
                group-hover:border-emerald-200/35
                group-hover:shadow-[0_0_36px_rgba(52,211,153,0.24)]
              "
            >
              <img
                src="/shaymin.png"
                alt=""
                className="
                  h-11
                  w-11
                  object-contain
                  drop-shadow-lg
                  transition
                  group-hover:scale-105
                "
              />

              <span
                className="
                  absolute
                  bottom-1
                  right-1
                  h-2
                  w-2
                  rounded-full
                  bg-emerald-300
                  shadow-[0_0_10px_rgba(110,231,183,1)]
                "
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="
                    truncate
                    text-lg
                    font-black
                    tracking-[-0.025em]
                    text-white
                  "
                >
                  PocketPulls
                </p>

                <span
                  className="
                    hidden
                    rounded-full
                    border
                    border-emerald-200/15
                    bg-emerald-300/10
                    px-2
                    py-0.5
                    text-[0.62rem]
                    font-black
                    uppercase
                    tracking-[0.14em]
                    text-emerald-100/70
                    sm:inline-flex
                  "
                >
                  Admin
                </span>
              </div>

              <p
                className="
                  truncate
                  text-xs
                  font-semibold
                  text-white/35
                "
              >
                {currentPage.description}
              </p>
            </div>
          </Link>

          <div
            className="
              hidden
              items-center
              gap-1.5
              xl:flex
            "
          >
            {navigationItems.map((item) => {
              const active = isActiveRoute(
                pathname,
                item.href,
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={`
                    relative
                    flex
                    min-h-12
                    items-center
                    gap-2.5
                    rounded-2xl
                    border
                    px-4
                    text-sm
                    font-black
                    outline-none
                    transition
                    focus-visible:ring-2
                    focus-visible:ring-emerald-300
                    ${
                      active
                        ? `
                          border-emerald-200/25
                          bg-emerald-300
                          text-emerald-950
                          shadow-[0_0_28px_rgba(110,231,183,0.18)]
                        `
                        : `
                          border-transparent
                          text-white/55
                          hover:border-white/10
                          hover:bg-white/[0.07]
                          hover:text-white
                        `
                    }
                  `}
                >
                  <span
                    className={`
                      flex
                      h-7
                      w-7
                      items-center
                      justify-center
                      rounded-lg
                      text-base
                      ${
                        active
                          ? "bg-emerald-950/10"
                          : "bg-white/[0.055]"
                      }
                    `}
                  >
                    {item.icon}
                  </span>

                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="
                hidden
                items-center
                gap-3
                rounded-2xl
                border
                border-white/10
                bg-black/15
                px-3
                py-2
                lg:flex
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-emerald-200/15
                  bg-emerald-300/10
                  text-sm
                "
              >
                ◉
              </div>

              <div className="max-w-40">
                <p
                  className="
                    truncate
                    text-xs
                    font-black
                    text-white/75
                  "
                >
                  {adminName}
                </p>

                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="
                      h-1.5
                      w-1.5
                      rounded-full
                      bg-emerald-300
                      shadow-[0_0_8px_rgba(110,231,183,1)]
                    "
                  />

                  <p
                    className="
                      text-[0.65rem]
                      font-bold
                      uppercase
                      tracking-[0.1em]
                      text-emerald-100/45
                    "
                  >
                    Connected
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void handleLogout()
              }
              disabled={signingOut}
              className="
                hidden
                min-h-12
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                border-red-300/15
                bg-red-500/[0.07]
                px-4
                text-sm
                font-black
                text-red-100
                outline-none
                transition
                hover:border-red-300/30
                hover:bg-red-500/15
                focus-visible:ring-2
                focus-visible:ring-red-300
                disabled:cursor-not-allowed
                disabled:opacity-50
                md:flex
              "
            >
              <span
                className={
                  signingOut
                    ? "animate-spin"
                    : ""
                }
              >
                {signingOut ? "◌" : "↪"}
              </span>

              {signingOut
                ? "Signing out"
                : "Logout"}
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  (current) => !current,
                )
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-menu"
              aria-label={
                mobileMenuOpen
                  ? "Close admin menu"
                  : "Open admin menu"
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
                font-black
                text-white
                outline-none
                transition
                hover:border-emerald-200/20
                hover:bg-white/10
                focus-visible:ring-2
                focus-visible:ring-emerald-300
                xl:hidden
              "
            >
              <span className="relative block h-5 w-6">
                <span
                  className={`
                    absolute
                    left-0
                    top-0
                    h-0.5
                    w-6
                    rounded-full
                    bg-current
                    transition
                    duration-200
                    ${
                      mobileMenuOpen
                        ? "translate-y-[9px] rotate-45"
                        : ""
                    }
                  `}
                />

                <span
                  className={`
                    absolute
                    left-0
                    top-[9px]
                    h-0.5
                    w-6
                    rounded-full
                    bg-current
                    transition
                    duration-200
                    ${
                      mobileMenuOpen
                        ? "opacity-0"
                        : ""
                    }
                  `}
                />

                <span
                  className={`
                    absolute
                    bottom-0
                    left-0
                    h-0.5
                    w-6
                    rounded-full
                    bg-current
                    transition
                    duration-200
                    ${
                      mobileMenuOpen
                        ? "-translate-y-[9px] -rotate-45"
                        : ""
                    }
                  `}
                />
              </span>
            </button>
          </div>
        </div>

        <div
          id="admin-mobile-menu"
          className={`
            relative
            z-10
            overflow-hidden
            border-t
            border-white/10
            transition-all
            duration-300
            xl:hidden
            ${
              mobileMenuOpen
                ? "max-h-[42rem] opacity-100"
                : "max-h-0 border-transparent opacity-0"
            }
          `}
        >
          <div className="bg-black/15 p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {navigationItems.map((item) => {
                const active = isActiveRoute(
                  pathname,
                  item.href,
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={
                      active ? "page" : undefined
                    }
                    className={`
                      flex
                      min-h-16
                      items-center
                      gap-4
                      rounded-2xl
                      border
                      px-4
                      outline-none
                      transition
                      focus-visible:ring-2
                      focus-visible:ring-emerald-300
                      ${
                        active
                          ? `
                            border-emerald-200/25
                            bg-emerald-300
                            text-emerald-950
                          `
                          : `
                            border-white/10
                            bg-white/[0.045]
                            text-white
                            hover:bg-white/[0.08]
                          `
                      }
                    `}
                  >
                    <span
                      className={`
                        flex
                        h-10
                        w-10
                        flex-none
                        items-center
                        justify-center
                        rounded-xl
                        text-lg
                        ${
                          active
                            ? "bg-emerald-950/10"
                            : "bg-white/[0.06]"
                        }
                      `}
                    >
                      {item.icon}
                    </span>

                    <span className="min-w-0">
                      <span
                        className="
                          block
                          truncate
                          font-black
                        "
                      >
                        {item.label}
                      </span>

                      <span
                        className={`
                          mt-0.5
                          block
                          truncate
                          text-xs
                          font-semibold
                          ${
                            active
                              ? "text-emerald-950/55"
                              : "text-white/35"
                          }
                        `}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div
              className="
                mt-3
                flex
                flex-col
                gap-3
                rounded-2xl
                border
                border-white/10
                bg-black/20
                p-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-sm
                    font-black
                    text-white
                  "
                >
                  {adminName}
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="
                      h-2
                      w-2
                      rounded-full
                      bg-emerald-300
                      shadow-[0_0_9px_rgba(110,231,183,1)]
                    "
                  />

                  <p
                    className="
                      text-xs
                      font-bold
                      text-emerald-100/45
                    "
                  >
                    Secure admin session
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void handleLogout()
                }
                disabled={signingOut}
                className="
                  flex
                  min-h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-red-300/15
                  bg-red-500/10
                  px-5
                  font-black
                  text-red-100
                  outline-none
                  transition
                  hover:border-red-300/30
                  hover:bg-red-500/20
                  focus-visible:ring-2
                  focus-visible:ring-red-300
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <span
                  className={
                    signingOut
                      ? "animate-spin"
                      : ""
                  }
                >
                  {signingOut ? "◌" : "↪"}
                </span>

                {signingOut
                  ? "Signing out..."
                  : "Logout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function isActiveRoute(
  pathname: string,
  href: string,
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}