"use client";

import type {
  ReactNode,
} from "react";
import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import ForestBackground from "@/components/ForestBackground";
import {
  adminFetch,
  clearAdminGate,
  readAdminGate,
  writeAdminGate,
} from "@/lib/admin/client-auth";
import { adminSupabase as supabase } from "@/lib/admin/supabase";

type AdminLayoutProps = {
  children: ReactNode;
};

type AdminSessionResponse = {
  ok: true;
  admin: {
    userId: string;
    email: string;
    aal: "aal1" | "aal2" | null;
    founder: "lukas" | "skye" | null;
    mfaRequired: boolean;
  };
};

const FOUNDER_ADMIN_PATHS = [
  "/admin/shaymin",
  "/admin/tree",
] as const;

function isFounderAdminPath(pathname: string): boolean {
  return FOUNDER_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function getSignInPath(
  pathname: string,
): string {
  const next =
    pathname.startsWith("/admin") &&
    pathname !== "/admin/sign-in"
      ? pathname
      : "/admin/add";

  return `/admin/sign-in?next=${encodeURIComponent(
    next,
  )}`;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isSignIn =
    pathname === "/admin/sign-in";

  const [verifiedPathname, setVerifiedPathname] =
    useState<string | null>(null);

  const allowed =
    verifiedPathname === pathname;

  useEffect(() => {
    if (isSignIn) {
      return;
    }

    let active = true;

    async function verifyFreshAdminGate() {
      const gate = readAdminGate();

      if (!gate) {
        clearAdminGate();
        await supabase.auth
          .signOut()
          .catch(() => undefined);

        if (active) {
          router.replace(
            getSignInPath(pathname),
          );
        }
        return;
      }

      try {
        const session =
          await adminFetch<AdminSessionResponse>(
            "/api/admin/session",
          );

        if (
          session.admin.userId !==
          gate.userId ||
          session.admin.aal !== "aal2"
        ) {
          throw new Error(
            "The active admin did not match the account that unlocked the administrator gateway.",
          );
        }

        if (
          isFounderAdminPath(pathname) &&
          !session.admin.founder
        ) {
          router.replace("/admin");
          return;
        }

        if (active) {
          writeAdminGate({
            userId: session.admin.userId,
            email: session.admin.email,
            founder: session.admin.founder,
            verifiedAt: Date.now(),
            aal2: true,
          });
          setVerifiedPathname(pathname);
        }
      } catch {
        clearAdminGate();
        await supabase.auth
          .signOut()
          .catch(() => undefined);

        if (active) {
          router.replace(
            getSignInPath(pathname),
          );
        }
      }
    }

    void verifyFreshAdminGate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string) => {
        if (
          event === "SIGNED_OUT" &&
          active
        ) {
          clearAdminGate();
          setVerifiedPathname(null);
          router.replace(
            getSignInPath(pathname),
          );
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [
    isSignIn,
    pathname,
    router,
  ]);

  if (isSignIn) {
    return children;
  }

  if (!allowed) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#03130d] px-5 text-white">
        <ForestBackground />

        <section className="relative z-10 w-full max-w-sm rounded-[2rem] border border-emerald-100/15 bg-[#082117]/88 p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-100/15 border-t-lime-200" />

          <p className="mt-5 text-sm font-black text-emerald-50/75">
            Verifying administrator access...
          </p>
        </section>
      </main>
    );
  }

  return children;
}
