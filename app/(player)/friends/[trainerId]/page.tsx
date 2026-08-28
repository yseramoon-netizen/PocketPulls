"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import BinderSpread, { type BinderDisplayCard } from "@/components/player/BinderSpread";
import PlayerCardModal, { type PlayerCardModalCard } from "@/components/player/PlayerCardModal";
import {
  CardArtwork,
  PlayerErrorBanner,
  PlayerPanel,
  PlayerSecondaryButton,
  PlayerStatCard,
  RarityPill,
} from "@/components/player/PlayerUI";
import {
  formatDate,
  formatMarketValue,
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

type FriendProfileRow = {
  user_id: string | null;
  trainer_code: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favourite_pokemon: string | null;
  location_label: string | null;
  joined_at: string | null;
  lifetime_wishes: number | string | null;
  total_cards: number | string | null;
  unique_cards: number | string | null;
  collection_value: number | string | null;
  signature_card_id: string | null;
  signature_name: string | null;
  signature_set_name: string | null;
  signature_card_no: string | null;
  signature_rarity: string | null;
  signature_market_value: number | string | null;
  signature_image_url: string | null;
  binder_theme_key: string | null;
  binder_name: string | null;
  online: boolean | null;
  last_seen_at: string | null;
};

type FriendBinderRow = {
  card_id: string | number | null;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value: number | string | null;
  image_url: string | null;
  quantity: number | string | null;
  is_signature: boolean | null;
  binder_position: number | string | null;
  total_count: number | string | null;
};

type FriendProfile = {
  userId: string;
  trainerCode: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  favouritePokemon: string;
  locationLabel: string;
  joinedAt: string | null;
  lifetimeWishes: number;
  totalCards: number;
  uniqueCards: number;
  collectionValue: number;
  signatureCardId: string | null;
  signatureName: string;
  signatureSetName: string;
  signatureCardNumber: string | null;
  signatureRarity: string;
  signatureMarketValue: number;
  signatureImageUrl: string | null;
  binderThemeKey: string;
  binderName: string;
  online: boolean;
  lastSeenAt: string | null;
};

type FriendBinderCard = PlayerCardModalCard & BinderDisplayCard & {
  quantity: number;
  isSignature: boolean;
};

const PAGE_SIZE = 18;

function parseProfile(value: unknown): FriendProfile | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const data = row as FriendProfileRow;
  if (!data.user_id) return null;

  return {
    userId: data.user_id,
    trainerCode: data.trainer_code || "",
    username: data.username || "trainer",
    displayName: data.display_name || data.username || "Trainer",
    avatarUrl: data.avatar_url || null,
    bio: data.bio || "",
    favouritePokemon: data.favourite_pokemon || "",
    locationLabel: data.location_label || "",
    joinedAt: data.joined_at,
    lifetimeWishes: toWholeNumber(data.lifetime_wishes),
    totalCards: toWholeNumber(data.total_cards),
    uniqueCards: toWholeNumber(data.unique_cards),
    collectionValue: toNumber(data.collection_value),
    signatureCardId: data.signature_card_id,
    signatureName: data.signature_name || "",
    signatureSetName: data.signature_set_name || "",
    signatureCardNumber: data.signature_card_no || null,
    signatureRarity: data.signature_rarity || "Common",
    signatureMarketValue: toNumber(data.signature_market_value),
    signatureImageUrl: data.signature_image_url || null,
    binderThemeKey: data.binder_theme_key || "classic",
    binderName: data.binder_name?.trim() || `${data.display_name || data.username || "Trainer"}'s Binder`,
    online: data.online === true,
    lastSeenAt: data.last_seen_at,
  };
}

function parseBinder(value: unknown): { cards: FriendBinderCard[]; totalCount: number } {
  if (!Array.isArray(value)) return { cards: [], totalCount: 0 };
  const rows = value as FriendBinderRow[];

  return {
    cards: rows.map((row) => ({
      id: String(row.card_id ?? ""),
      name: row.name?.trim() || "Unknown card",
      setName: row.set_name?.trim() || "Unknown set",
      cardNumber: row.card_no?.trim() || null,
      rarity: row.rarity?.trim() || "Common",
      imageUrl: row.image_url?.trim() || null,
      marketValue: toNumber(row.market_value),
      quantity: toWholeNumber(row.quantity),
      isSignature: row.is_signature === true,
    })),
    totalCount: rows.length > 0 ? toWholeNumber(rows[0].total_count) : 0,
  };
}

function formatPresence(profile: FriendProfile): string {
  if (profile.online) return "Online now";
  if (!profile.lastSeenAt) return "Offline";

  const date = new Date(profile.lastSeenAt);
  if (Number.isNaN(date.getTime())) return "Recently active";

  return `Last seen ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

export default function FriendProfilePage() {
  const params = useParams<{ trainerId: string }>();
  const trainerId = typeof params?.trainerId === "string" ? params.trainerId : "";

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [cards, setCards] = useState<FriendBinderCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCard, setSelectedCard] = useState<FriendBinderCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadProfile = useCallback(async () => {
    if (!trainerId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const [profileResult, binderResult] = await Promise.all([
        supabase.rpc("get_friend_profile", { p_target_user_id: trainerId }),
        supabase.rpc("get_friend_binder", {
          p_target_user_id: trainerId,
          p_page: page,
          p_page_size: PAGE_SIZE,
        }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (binderResult.error) throw binderResult.error;

      const parsedProfile = parseProfile(profileResult.data);
      if (!parsedProfile) {
        throw new Error("This trainer profile is only available to accepted friends.");
      }

      const parsedBinder = parseBinder(binderResult.data);
      setProfile(parsedProfile);
      setCards(parsedBinder.cards);
      setTotalCount(parsedBinder.totalCount);
    } catch (error: unknown) {
      console.error("Friend profile error:", error);
      setProfile(null);
      setCards([]);
      setTotalCount(0);
      setErrorMessage(getErrorMessage(error, "That friend profile could not be opened."));
    } finally {
      setLoading(false);
    }
  }, [page, trainerId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const initials = useMemo(
    () => (profile?.displayName || profile?.username || "T").charAt(0).toUpperCase(),
    [profile],
  );

  return (
    <section className="mx-auto w-full max-w-[1660px] px-4 pb-24 pt-7 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/friends"
          className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          ← Friends
        </Link>

        {profile ? (
          <Link
            href={`/friends?friend=${encodeURIComponent(profile.userId)}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-cyan-100/20 bg-cyan-200/[0.08] px-4 text-xs font-black text-cyan-50 transition hover:bg-cyan-200/[0.14]"
          >
            Trade cards
          </Link>
        ) : null}
      </div>

      <PlayerErrorBanner message={errorMessage} onRetry={() => void loadProfile()} />

      {loading && !profile ? (
        <div className="mt-6 min-h-[38rem] animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.025]" />
      ) : profile ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <PlayerPanel className="overflow-hidden p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative flex h-28 w-28 flex-none items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 text-4xl font-black text-white">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                  <span
                    className={`absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-[#090b27] ${
                      profile.online ? "bg-emerald-300" : "bg-slate-500"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100/38">
                    Friend profile
                  </p>
                  <h1 className="mt-2 truncate text-4xl font-black tracking-tight text-white sm:text-5xl">
                    {profile.displayName}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-white/38">
                    <span>@{profile.username}</span>
                    {profile.trainerCode ? <span>{profile.trainerCode}</span> : null}
                    <span>{formatPresence(profile)}</span>
                  </div>
                  {profile.bio ? (
                    <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-white/52">
                      {profile.bio}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PlayerStatCard
                  label="Lifetime wishes"
                  value={formatWholeNumber(profile.lifetimeWishes)}
                  detail="Stars answered"
                  accent="yellow"
                />
                <PlayerStatCard
                  label="Cards"
                  value={formatWholeNumber(profile.totalCards)}
                  detail="Physical collection"
                  accent="cyan"
                />
                <PlayerStatCard
                  label="Unique"
                  value={formatWholeNumber(profile.uniqueCards)}
                  detail="Different cards"
                  accent="violet"
                />
                <PlayerStatCard
                  label="Collection value"
                  value={formatMoney(profile.collectionValue)}
                  detail="Current catalogue value"
                  accent="green"
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <ProfileDetail label="Favourite card or character" value={profile.favouritePokemon || "Not set"} />
                <ProfileDetail label="Location" value={profile.locationLabel || "Not shared"} />
                <ProfileDetail label="Joined" value={formatDate(profile.joinedAt)} />
              </div>
            </PlayerPanel>

            <PlayerPanel className="overflow-hidden p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-100/40">
                Favourite card
              </p>

              {profile.signatureCardId ? (
                <>
                  <CardArtwork
                    name={profile.signatureName}
                    imageUrl={profile.signatureImageUrl}
                    rarity={profile.signatureRarity}
                    className="mx-auto mt-5 aspect-[0.716] w-full max-w-[15rem] rounded-2xl border border-white/12 shadow-[0_22px_65px_rgba(0,0,0,0.45)]"
                  />
                  <div className="mt-5">
                    <RarityPill rarity={profile.signatureRarity} />
                    <h2 className="mt-3 text-xl font-black text-white">{profile.signatureName}</h2>
                    <p className="mt-1 text-xs font-semibold text-white/32">
                      {profile.signatureSetName}
                      {profile.signatureCardNumber ? ` · #${profile.signatureCardNumber}` : ""}
                    </p>
                    <p className="mt-3 text-sm font-black text-yellow-50">
                      {formatMarketValue(profile.signatureMarketValue)}
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-14 text-center text-sm font-semibold text-white/28">
                  No favourite card selected yet.
                </div>
              )}
            </PlayerPanel>
          </section>

          <section className="mt-7">
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/38">
                  Friend binder
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">{profile.binderName}</h2>
              </div>
              <span className="text-xs font-bold text-white/28">
                {formatWholeNumber(totalCount)} unique cards
              </span>
            </div>

            {cards.length > 0 ? (
              <BinderSpread
                cards={cards}
                themeKey={profile.binderThemeKey}
                readonly
                onOpen={(card) => setSelectedCard(card as FriendBinderCard)}
              />
            ) : (
              <div className="grid min-h-72 place-items-center rounded-[2rem] border border-white/10 bg-white/[0.025] text-sm font-black text-white/30">
                This binder is still waiting for its first card.
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-white/28">
                Spread {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <PlayerSecondaryButton
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </PlayerSecondaryButton>
                <PlayerSecondaryButton
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </PlayerSecondaryButton>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {selectedCard ? (
        <PlayerCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          showShippingLink={false}
        />
      ) : null}
    </section>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-white/27">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-black text-white/72">{value}</p>
    </div>
  );
}
