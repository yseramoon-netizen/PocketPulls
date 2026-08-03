"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthLoading from "@/components/auth/AuthLoading";
import AuthMessage from "@/components/auth/AuthMessage";
import AuthShell from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/auth/helpers";
import { getSafeNextPath } from "@/lib/auth/navigation";
import { supabase } from "@/lib/supabase";

export default function WelcomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("Trainer");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = useMemo(
    () =>
      typeof window === "undefined"
        ? "/wishes"
        : getSafeNextPath(),
    [],
  );

  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) {
          router.replace("/sign-in");
          return;
        }

        const { data: registration, error: registrationError } =
          await supabase.rpc("complete_player_registration");

        if (registrationError) throw registrationError;

        const row = Array.isArray(registration)
          ? registration[0]
          : registration;

        const name =
          row && typeof row.display_name === "string"
            ? row.display_name
            : data.user.user_metadata?.display_name;

        if (active) {
          setDisplayName(
            typeof name === "string" && name.trim()
              ? name.trim()
              : "Trainer",
          );
          setReady(true);
        }
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(
          getAuthErrorMessage(
            error,
            "Your trainer profile could not be prepared.",
          ),
        );
        setReady(true);
      }
    }

    void prepare();

    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return <AuthLoading title="Awakening your collection" />;
  }

  return (
    <AuthShell
      eyebrow="Account ready"
      title="Welcome To Unknown Pulls"
      description={`${displayName}, your trainer identity, wish wallet and private collection are ready.`}
      storyTitle="Your symbol has joined the constellation"
    >
      <div className="space-y-5">
        {errorMessage ? (
          <AuthMessage tone="error">{errorMessage}</AuthMessage>
        ) : (
          <AuthMessage tone="success">
            Email confirmed. Your ownership records now remain connected to this account.
          </AuthMessage>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <WelcomeCard icon="✦" title="Make wishes" text="Reveal real cards from live stock." />
          <WelcomeCard icon="◆" title="Build a collection" text="Every pull is recorded to your account." />
          <WelcomeCard icon="⌂" title="Ship together" text="Unlock free shipping as the collection grows." />
        </div>

        <button
          type="button"
          onClick={() => {
            router.replace(nextPath);
            router.refresh();
          }}
          className="flex min-h-13 w-full items-center justify-center rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Enter Unknown Pulls
        </button>
      </div>
    </AuthShell>
  );
}

function WelcomeCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <span className="text-2xl text-yellow-100/70">{icon}</span>
      <h2 className="mt-3 text-sm font-black text-white">{title}</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-white/30">{text}</p>
    </div>
  );
}
