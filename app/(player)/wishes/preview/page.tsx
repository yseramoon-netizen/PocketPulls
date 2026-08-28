"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import WishCinematic, {
  type WishRevealCard,
  getWishRarityTheme,
} from "@/components/player/WishCinematic";
import { primeWishAudio } from "@/components/player/wishAudio";
import { supabase } from "@/lib/supabase";

type PreviewCard = WishRevealCard & {
  cosmicIssueNumber?: number;
};

const DEMO_CARDS: PreviewCard[] = [
  {
    id: "common-preview",
    name: "Dune Spark",
    rarity: "Common",
    setName: "ancientpulls Preview",
    cardNumber: "001",
    marketValue: 0.12,
  },
  {
    id: "uncommon-preview",
    name: "Papyrus Mouse",
    rarity: "Uncommon",
    setName: "ancientpulls Preview",
    cardNumber: "002",
    marketValue: 0.28,
  },
  {
    id: "rare-preview",
    name: "Moon Moth",
    rarity: "Rare Holo",
    setName: "ancientpulls Preview",
    cardNumber: "003",
    marketValue: 1.45,
  },
  {
    id: "double-preview",
    name: "Temple Bird",
    rarity: "Double Rare",
    setName: "ancientpulls Preview",
    cardNumber: "004",
    marketValue: 3.8,
  },
  {
    id: "ultra-preview",
    name: "Sunbeam Relic",
    rarity: "Ultra Rare",
    setName: "ancientpulls Preview",
    cardNumber: "005",
    marketValue: 18.4,
  },
  {
    id: "illustration-preview",
    name: "Living Mural",
    rarity: "Illustration Rare",
    setName: "ancientpulls Preview",
    cardNumber: "006",
    marketValue: 11.25,
  },
  {
    id: "special-preview",
    name: "Catnip Star",
    rarity: "Special Illustration Rare",
    setName: "ancientpulls Preview",
    cardNumber: "007",
    marketValue: 79.5,
  },
  {
    id: "hyper-preview",
    name: "Solar Crown",
    rarity: "Hyper Rare",
    setName: "ancientpulls Preview",
    cardNumber: "008",
    marketValue: 125,
  },
  {
    id: "crown-preview",
    name: "Crown of the Constellation",
    rarity: "Crown Rare",
    setName: "ancientpulls Preview",
    cardNumber: "009",
    marketValue: 500,
  },
  {
    id: "black-hole-preview",
    name: "Event Horizon Relic",
    rarity: "Crown Rare",
    setName: "ancientpulls Preview",
    cardNumber: "010",
    marketValue: 501,
  },
  {
    id: "cosmic-nebu-preview",
    name: "The First Constellation",
    rarity: "Rare Holo",
    setName: "ancientpulls Preview",
    cardNumber: "∞",
    marketValue: 1.45,
    cosmicIssueNumber: 1,
  },
];

export default function WishPreviewPage() {
  const router = useRouter();
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );
  const [selectedIndex, setSelectedIndex] =
    useState(6);

  const [open, setOpen] = useState(false);
  const [runNumber, setRunNumber] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function verifyFounderAccess() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) setAccess("denied");
          return;
        }

        const response = await fetch("/api/player/nebu-entitlements", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const payload = response.ok
          ? ((await response.json().catch(() => null)) as
              | { skins?: unknown[] }
              | null)
          : null;
        const skins = Array.isArray(payload?.skins) ? payload.skins : [];
        const allowed =
          skins.includes("sherry") || skins.includes("bubbles");

        if (!cancelled) setAccess(allowed ? "allowed" : "denied");
      } catch {
        if (!cancelled) setAccess("denied");
      }
    }

    void verifyFounderAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access !== "denied") return;

    const timer = window.setTimeout(() => router.replace("/wishes"), 900);
    return () => window.clearTimeout(timer);
  }, [access, router]);

  const selectedCard = useMemo(() => {
    const card = DEMO_CARDS[selectedIndex];

    return {
      ...card,
      id: `${card.id}-${runNumber}`,
    };
  }, [selectedIndex, runNumber]);

  function playPreview(index: number) {
    if (access !== "allowed") return;

    void primeWishAudio();
    setSelectedIndex(index);
    setRunNumber((current) => current + 1);
    setOpen(true);
  }

  if (access !== "allowed") {
    return (
      <section className="relative mx-auto flex min-h-[62vh] w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/90 p-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-yellow-100/20 bg-yellow-100/[0.07] text-2xl text-yellow-100 shadow-[0_0_42px_rgba(250,204,21,0.12)]">
            ✦
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
            Founder preview studio
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            {access === "checking"
              ? "Verifying founder access..."
              : "This studio is private."}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-white/40">
            {access === "checking"
              ? "Nebu is checking the private founder key."
              : "Returning you to the Wish Chamber."}
          </p>

          {access === "denied" ? (
            <Link
              href="/wishes"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Back to wishes
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/85 p-6 backdrop-blur-xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/45">
          Final cinematic laboratory
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          ancientpulls Wish Ceremony
        </h1>

        <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
          Every upgrade now travels beyond the current star to a farther
          destination. Cards valued above £500 end at the black hole, while
          Cosmic Nebu stays on the planet for its transformation. Test every
          route here before a real wish.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_CARDS.map((card, index) => {
            const theme = getWishRarityTheme(
              card.rarity,
            );

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => playPreview(index)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div
                  className="absolute inset-y-0 left-0 w-1"
                  style={{
                    background: theme.primary,
                  }}
                />

                <p
                  className="text-[0.6rem] font-black uppercase tracking-[0.16em]"
                  style={{
                    color: theme.primary,
                  }}
                >
                  {Number(card.marketValue) > 500
                    ? "£500+ override"
                    : card.cosmicIssueNumber
                      ? "1 in 100,000 discovery"
                    : `Tier ${theme.tier}`}
                </p>

                <h2 className="mt-2 text-lg font-black text-white">
                  {Number(card.marketValue) > 500
                    ? "Black Hole"
                    : card.cosmicIssueNumber
                      ? "Cosmic Nebu"
                    : theme.label}
                </h2>

                <p className="mt-2 text-sm font-semibold text-white/35">
                  {card.name}
                </p>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-white/35">
                    Play full ceremony
                  </span>

                  <span
                    className="h-3 w-3 rounded-full transition group-hover:scale-125"
                    style={{
                      background: theme.primary,
                      boxShadow: `0 0 18px ${theme.glow}`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <WishCinematic
        open={open}
        card={selectedCard}
        cosmicIssueNumber={selectedCard.cosmicIssueNumber}
        cosmicSourceSkin="midnight"
        allowSkip
        respectPreferences={false}
        onFinished={() => {
          console.log(
            "ancientpulls wish ceremony completed.",
          );
        }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
