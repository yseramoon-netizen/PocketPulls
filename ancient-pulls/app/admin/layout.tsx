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
  };
};

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

  const [allowed, setAllowed] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const isSignIn =
    pathname === "/admin/sign-in";

  useEffect(() => {
    if (isSignIn) {
      setAllowed(true);
      setChecking(false);
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
          gate.userId
        ) {
          throw new Error(
            "The active admin did not match the account that unlocked the administrator gateway.",
          );
        }

        if (active) {
          setAllowed(true);
          setChecking(false);
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
          setAllowed(false);
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

  if (checking || !allowed) {
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
