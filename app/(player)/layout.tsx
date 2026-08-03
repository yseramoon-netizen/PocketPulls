"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import PlayerNav from "@/components/player/PlayerNav";
import UnownText from "@/components/player/UnownText";
import UnknownPullsBackdrop from "@/components/player/UnknownPullsBackdrop";
import { supabase } from "@/lib/supabase";

type PlayerLayoutProps = {
  children: ReactNode;
};

type PlayerProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type PlayerWalletRow = {
  user_id: string;
  wish_balance: number | null;
};

type PlayerShellData = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  wishBalance: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function getFallbackDisplayName(session: Session): string {
  const metadataName = session.user.user_metadata?.display_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = (session.user.email || "").split("@")[0]?.trim();

  return emailName || "Unknown Trainer";
}

function getFallbackUsername(session: Session): string {
  const emailName = (session.user.email || "")
    .split("@")[0]
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 24);

  if (emailName) {
    return emailName;
  }

  return `trainer_${session.user.id.replace(/-/g, "").slice(0, 8)}`;
}

function normaliseWishBalance(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

export default function PlayerLayout({ children }: PlayerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);

  const [player, setPlayer] = useState<PlayerShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectToSignIn = useCallback(() => {
    const nextPath = pathname || "/wishes";

    router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }, [pathname, router]);

  const loadPlayer = useCallback(async (session: Session) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [profileResult, walletResult] = await Promise.all([
        supabase
          .from("player_profiles")
          .select("user_id,username,display_name,avatar_url")
          .eq("user_id", session.user.id)
          .maybeSingle(),

        supabase
          .from("player_wallets")
          .select("user_id,wish_balance")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        throw new Error(
          getErrorMessage(
            profileResult.error,
            "The player profile query failed.",
          ),
        );
      }

      if (walletResult.error) {
        throw new Error(
          getErrorMessage(
            walletResult.error,
            "The wish wallet query failed.",
          ),
        );
      }

      const profile =
        profileResult.data as unknown as PlayerProfileRow | null;

      const wallet =
        walletResult.data as unknown as PlayerWalletRow | null;

      if (!profile) {
        throw new Error(
          "Your player profile does not exist. Run the player-system Supabase migration, then sign out and sign in again.",
        );
      }

      const username =
        typeof profile.username === "string" && profile.username.trim()
          ? profile.username.trim()
          : getFallbackUsername(session);

      const displayName =
        typeof profile.display_name === "string" &&
        profile.display_name.trim()
          ? profile.display_name.trim()
          : getFallbackDisplayName(session);

      const avatarUrl =
        typeof profile.avatar_url === "string" && profile.avatar_url.trim()
          ? profile.avatar_url.trim()
          : null;

      const nextPlayer: PlayerShellData = {
        username,
        displayName,
        avatarUrl,
        wishBalance: normaliseWishBalance(wallet?.wish_balance),
      };

      if (!mountedRef.current) {
        return;
      }

      setPlayer(nextPlayer);
    } catch (error: unknown) {
      console.error("Player layout error:", error);

      if (!mountedRef.current) {
        return;
      }

      setPlayer(null);
      setErrorMessage(
        getErrorMessage(error, "The player account could not be loaded."),
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadCurrentSession = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw new Error(
          getErrorMessage(error, "Your session could not be checked."),
        );
      }

      if (!session) {
        redirectToSignIn();
        return;
      }

      await loadPlayer(session);
    } catch (error: unknown) {
      console.error("Player session error:", error);

      if (!mountedRef.current) {
        return;
      }

      setPlayer(null);
      setErrorMessage(
        getErrorMessage(error, "Your session could not be verified."),
      );
      setLoading(false);
    }
  }, [loadPlayer, redirectToSignIn]);

  useEffect(() => {
    mountedRef.current = true;

    void loadCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setPlayer(null);
        redirectToSignIn();
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        window.setTimeout(() => {
          if (mountedRef.current) {
            void loadPlayer(session);
          }
        }, 0);
      }
    });

    const handleProfileUpdated = () => {
      void loadCurrentSession();
    };

    window.addEventListener(
      "pocketpulls:profile-updated",
      handleProfileUpdated,
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "pocketpulls:profile-updated",
        handleProfileUpdated,
      );
    };
  }, [loadCurrentSession, loadPlayer, redirectToSignIn]);

  if (loading && !player) {
    return <PlayerLoadingScreen />;
  }

  if (errorMessage && !player) {
    return (
      <PlayerErrorScreen
        message={errorMessage}
        onRetry={() => {
          void loadCurrentSession();
        }}
        onSignOut={() => {
          void supabase.auth.signOut().finally(() => {
            redirectToSignIn();
          });
        }}
      />
    );
  }

  if (!player) {
    return <PlayerLoadingScreen />;
  }

  return (
    <div className="unknown-pulls-shell relative min-h-[100dvh] overflow-x-hidden bg-[#02030d] text-white">
      <UnknownPullsBackdrop />

      <PlayerNav
        username={player.username}
        displayName={player.displayName}
        avatarUrl={player.avatarUrl}
        wishBalance={player.wishBalance}
      />

      <main className="relative z-10 min-h-[calc(100dvh-5rem)]">
        {children}
      </main>

      <style jsx global>{`
        .unknown-pulls-shell {
          --ancient-gold: #e5a93f;
          --ancient-copper: #a85b2a;
          --ancient-scarlet: #cf425f;
          --ancient-cyan: #35d1c5;
          --ancient-emerald: #3eb66f;
          --ancient-violet: #7548b5;
        }

        .unknown-pulls-shell main header,
        .unknown-pulls-shell main article {
          background-image:
            radial-gradient(
              circle at 4% 10%,
              rgba(207, 66, 95, 0.075),
              transparent 25%
            ),
            radial-gradient(
              circle at 94% 8%,
              rgba(53, 209, 197, 0.075),
              transparent 24%
            ),
            radial-gradient(
              circle at 75% 100%,
              rgba(62, 182, 111, 0.05),
              transparent 28%
            ),
            linear-gradient(
              135deg,
              rgba(229, 169, 63, 0.055),
              transparent 30%,
              rgba(117, 72, 181, 0.055) 68%,
              rgba(168, 91, 42, 0.045)
            );
          border-color: rgba(229, 169, 63, 0.18);
          box-shadow:
            inset 0 0 0 1px rgba(53, 209, 197, 0.035),
            inset 0 0 38px rgba(207, 66, 95, 0.025),
            0 24px 80px rgba(0, 0, 0, 0.22);
        }

        .unknown-pulls-shell main input,
        .unknown-pulls-shell main select,
        .unknown-pulls-shell main textarea {
          border-color: rgba(229, 169, 63, 0.16);
          background-image:
            linear-gradient(
              135deg,
              rgba(168, 91, 42, 0.07),
              rgba(53, 209, 197, 0.025) 48%,
              rgba(117, 72, 181, 0.06)
            );
        }

        .unknown-pulls-shell main input:focus,
        .unknown-pulls-shell main select:focus,
        .unknown-pulls-shell main textarea:focus {
          border-color: rgba(53, 209, 197, 0.34);
          box-shadow:
            0 0 0 2px rgba(53, 209, 197, 0.075),
            0 0 22px rgba(207, 66, 95, 0.045);
        }

        .unknown-pulls-shell ::selection {
          background: rgba(229, 169, 63, 0.38);
          color: #fff8dc;
        }

        .unknown-pulls-shell * {
          scrollbar-color:
            rgba(229, 169, 63, 0.42)
            rgba(5, 4, 17, 0.72);
        }
      `}</style>
    </div>
  );
}

function PlayerLoadingScreen() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-6 text-white">
      <UnknownPullsBackdrop />

      <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-2 animate-pulse rounded-full bg-yellow-200/15 blur-2xl" />

          <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-r-cyan-100/40 border-t-yellow-100/70 [animation-duration:2.5s]" />

          <img
            src="/jirachi.png"
            alt=""
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="relative h-20 w-20 object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.4)]"
          />

          <span className="absolute text-5xl text-yellow-100/20">*</span>
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
          The ancient archive is waking
        </p>

        <div className="mt-4">
          <UnownText
            text="Unknown Pulls"
            size="2rem"
            tone="holo"
            centred
          />
        </div>

        <p className="mt-4 text-sm font-black text-white/72">
          Preparing your wishes
        </p>

        <p className="mt-3 text-sm font-semibold leading-6 text-white/35">
          Loading your trainer profile and wish balance.
        </p>
      </div>
    </main>
  );
}

function PlayerErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02030d] px-4 py-12 text-white">
      <UnknownPullsBackdrop />

      <section className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/95 shadow-[0_35px_120px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <div className="h-1 bg-gradient-to-r from-[#d44860] via-[#e7ad46] to-[#42d2c7]" />

        <div className="p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/42">
            Wish interrupted
          </p>

          <div className="mt-4">
            <UnownText
              text="Wish Interrupted"
              size="1.55rem"
              tone="ancient"
            />
          </div>

          <p className="mt-4 text-xl font-black text-white">
            Your trainer profile could not be opened.
          </p>

          <p className="mt-4 text-sm font-semibold leading-6 text-white/55">
            {message}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-12 flex-1 rounded-xl bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:bg-yellow-100"
            >
              Try again
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Return to sign in
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
