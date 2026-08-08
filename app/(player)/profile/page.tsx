"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CardArtwork,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerPrimaryButton,
  PlayerSecondaryButton,
  PlayerStatCard,
  RarityPill,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatDate,
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";

type ProfileRow = {
  user_id: string | null;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favourite_pokemon: string | null;
  location_label: string | null;
  signature_card_id: string | null;
  profile_public: boolean | null;
  joined_at: string | null;
  wish_balance: number | string | null;
  lifetime_wishes: number | string | null;
  total_cards: number | string | null;
  unique_cards: number | string | null;
  collection_value: number | string | null;
  signature_name: string | null;
  signature_set_name: string | null;
  signature_card_no: string | null;
  signature_rarity: string | null;
  signature_market_value: number | string | null;
  signature_image_url: string | null;
};

type ProfileData = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  favouritePokemon: string;
  locationLabel: string;
  signatureCardId: string | null;
  profilePublic: boolean;
  joinedAt: string | null;
  wishBalance: number;
  lifetimeWishes: number;
  totalCards: number;
  uniqueCards: number;
  collectionValue: number;
  signatureName: string;
  signatureSetName: string;
  signatureCardNumber: string | null;
  signatureRarity: string;
  signatureMarketValue: number;
  signatureImageUrl: string | null;
};

const EMPTY_PROFILE: ProfileData = {
  userId: "",
  email: "",
  username: "",
  displayName: "",
  avatarUrl: "",
  bio: "",
  favouritePokemon: "",
  locationLabel: "",
  signatureCardId: null,
  profilePublic: true,
  joinedAt: null,
  wishBalance: 0,
  lifetimeWishes: 0,
  totalCards: 0,
  uniqueCards: 0,
  collectionValue: 0,
  signatureName: "",
  signatureSetName: "",
  signatureCardNumber: null,
  signatureRarity: "Common",
  signatureMarketValue: 0,
  signatureImageUrl: null,
};

function parseProfile(value: unknown): ProfileData {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return EMPTY_PROFILE;
  }

  const data = row as ProfileRow;

  return {
    userId: data.user_id || "",
    email: data.email || "",
    username: data.username || "",
    displayName: data.display_name || "",
    avatarUrl: data.avatar_url || "",
    bio: data.bio || "",
    favouritePokemon: data.favourite_pokemon || "",
    locationLabel: data.location_label || "",
    signatureCardId: data.signature_card_id,
    profilePublic: data.profile_public !== false,
    joinedAt: data.joined_at,
    wishBalance: toWholeNumber(data.wish_balance),
    lifetimeWishes: toWholeNumber(
      data.lifetime_wishes,
    ),
    totalCards: toWholeNumber(data.total_cards),
    uniqueCards: toWholeNumber(data.unique_cards),
    collectionValue: toNumber(data.collection_value),
    signatureName: data.signature_name || "",
    signatureSetName: data.signature_set_name || "",
    signatureCardNumber:
      data.signature_card_no || null,
    signatureRarity:
      data.signature_rarity || "Common",
    signatureMarketValue: toNumber(
      data.signature_market_value,
    ),
    signatureImageUrl:
      data.signature_image_url || null,
  };
}

async function getVerifiedPlayerUser() {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      "Your player session expired. Sign in again.",
    );
  }

  return data.user;
}

export default function ProfilePage() {
  const profileOwnerRef =
    useRef<string | null>(null);

  const [profile, setProfile] =
    useState<ProfileData>(EMPTY_PROFILE);
  const [form, setForm] =
    useState<ProfileData>(EMPTY_PROFILE);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const activeUser =
        await getVerifiedPlayerUser();

      const currentOwner =
        profileOwnerRef.current;

      if (
        currentOwner &&
        currentOwner !== activeUser.id
      ) {
        throw new Error(
          "The signed-in player changed. Reload the profile before continuing.",
        );
      }

      const { data, error } = await supabase.rpc(
        "get_player_profile_dashboard",
      );

      if (error) {
        throw error;
      }

      const parsed = parseProfile(data);

      if (
        !parsed.userId ||
        parsed.userId !== activeUser.id
      ) {
        throw new Error(
          "The profile response belonged to a different player account.",
        );
      }

      profileOwnerRef.current =
        activeUser.id;

      setProfile(parsed);
      setForm(parsed);
    } catch (error: unknown) {
      console.error("Profile error:", error);
      setErrorMessage(
        getErrorMessage(
          error,
          "Your trainer profile could not be loaded.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();

    const handleProfileUpdated = () => {
      void loadProfile();
    };

    window.addEventListener(
      "pocketpulls:profile-updated",
      handleProfileUpdated,
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_OUT" ||
          !session
        ) {
          return;
        }

        const currentOwner =
          profileOwnerRef.current;

        if (
          currentOwner &&
          currentOwner !== session.user.id
        ) {
          window.location.reload();
        }
      },
    );

    return () => {
      window.removeEventListener(
        "pocketpulls:profile-updated",
        handleProfileUpdated,
      );

      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const saveProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setSaving(true);
      setSavedMessage(null);
      setErrorMessage(null);

      try {
        const activeUser =
          await getVerifiedPlayerUser();

        if (
          !profileOwnerRef.current ||
          profileOwnerRef.current !==
            activeUser.id ||
          form.userId !== activeUser.id
        ) {
          throw new Error(
            "The signed-in player changed. Reload the profile before saving.",
          );
        }

        const { error } = await supabase.rpc(
          "update_player_profile",
          {
            p_username: form.username,
            p_display_name: form.displayName,
            p_avatar_url: form.avatarUrl,
            p_bio: form.bio,
            p_favourite_pokemon:
              form.favouritePokemon,
            p_location_label: form.locationLabel,
            p_profile_public: form.profilePublic,
          },
        );

        if (error) {
          throw error;
        }

        await loadProfile();

        setSavedMessage(
          "Your trainer profile has been saved.",
        );

        window.dispatchEvent(
          new CustomEvent("pocketpulls:profile-updated"),
        );

        window.setTimeout(() => {
          setSavedMessage(null);
        }, 3500);
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "Your profile could not be saved.",
          ),
        );
      } finally {
        setSaving(false);
      }
    },
    [form, saving, loadProfile],
  );

  const initials =
    (form.displayName || form.username || "T")
      .charAt(0)
      .toUpperCase();

  return (
    <section className="mx-auto w-full max-w-[1450px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Your trainer identity"
        title="Profile"
        description="Choose how you appear across Unown Pulls, select the card that represents you and decide whether your profile can appear publicly in the rankings."
        actions={
          <PlayerSecondaryButton
            onClick={() => void loadProfile()}
          >
            Reload profile
          </PlayerSecondaryButton>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadProfile()}
      />

      {savedMessage ? (
        <div className="mt-6 rounded-2xl border border-emerald-100/15 bg-emerald-300/[0.08] p-4 text-sm font-bold text-emerald-50">
          {savedMessage}
        </div>
      ) : null}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PlayerStatCard
          label="Wish balance"
          value={formatWholeNumber(profile.wishBalance)}
          detail="Ready to spend"
          accent="yellow"
        />

        <PlayerStatCard
          label="Lifetime wishes"
          value={formatWholeNumber(
            profile.lifetimeWishes,
          )}
          detail="Completed wishes"
          accent="violet"
        />

        <PlayerStatCard
          label="Physical cards"
          value={formatWholeNumber(profile.totalCards)}
          detail="Cards currently owned"
          accent="cyan"
        />

        <PlayerStatCard
          label="Unique cards"
          value={formatWholeNumber(profile.uniqueCards)}
          detail="Different discoveries"
          accent="pink"
        />

        <PlayerStatCard
          label="Collection value"
          value={formatMoney(profile.collectionValue)}
          detail="Current raw-card value"
          accent="green"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <PlayerPanel className="p-5 sm:p-7">
          {loading ? (
            <div className="h-[44rem] animate-pulse rounded-2xl bg-white/[0.03]" />
          ) : (
            <form
              onSubmit={(event) =>
                void saveProfile(event)
              }
            >
              <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 text-3xl font-black text-white">
                  {form.avatarUrl ? (
                    <img
                      src={form.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white">
                    {form.displayName ||
                      "Pokemon Trainer"}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-violet-100/38">
                    @{form.username || "trainer"}
                  </p>

                  <p className="mt-3 text-xs font-semibold text-white/28">
                    Joined {formatDate(profile.joinedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <ProfileField
                  label="Username"
                  hint="3-24 lowercase letters, numbers or underscores"
                >
                  <input
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                          .slice(0, 24),
                      }))
                    }
                    minLength={3}
                    maxLength={24}
                    required
                    className="profile-input"
                  />
                </ProfileField>

                <ProfileField label="Display name">
                  <input
                    value={form.displayName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        displayName:
                          event.target.value.slice(0, 60),
                      }))
                    }
                    maxLength={60}
                    required
                    className="profile-input"
                  />
                </ProfileField>

                <ProfileField label="Favourite Pokemon">
                  <input
                    value={form.favouritePokemon}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        favouritePokemon:
                          event.target.value.slice(0, 40),
                      }))
                    }
                    maxLength={40}
                    placeholder="Jirachi"
                    className="profile-input"
                  />
                </ProfileField>

                <ProfileField label="Location">
                  <input
                    value={form.locationLabel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        locationLabel:
                          event.target.value.slice(0, 80),
                      }))
                    }
                    maxLength={80}
                    placeholder="Surrey, UK"
                    className="profile-input"
                  />
                </ProfileField>

                <ProfileField
                  label="Avatar image URL"
                  className="sm:col-span-2"
                >
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        avatarUrl:
                          event.target.value.slice(0, 500),
                      }))
                    }
                    placeholder="https://..."
                    className="profile-input"
                  />
                </ProfileField>

                <ProfileField
                  label="Trainer bio"
                  hint={`${form.bio.length} / 280`}
                  className="sm:col-span-2"
                >
                  <textarea
                    value={form.bio}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bio: event.target.value.slice(
                          0,
                          280,
                        ),
                      }))
                    }
                    maxLength={280}
                    rows={5}
                    placeholder="Tell other trainers about your collection..."
                    className="profile-input resize-none py-3"
                  />
                </ProfileField>
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <input
                  type="checkbox"
                  checked={form.profilePublic}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      profilePublic:
                        event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-violet-300"
                />

                <span>
                  <strong className="block text-sm text-white">
                    Public trainer profile
                  </strong>

                  <span className="mt-1 block text-xs font-semibold leading-5 text-white/32">
                    Allow your display name, avatar and
                    collection score to appear on the
                    leaderboard.
                  </span>
                </span>
              </label>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <PlayerPrimaryButton
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving
                    ? "Saving profile..."
                    : "Save trainer profile"}
                </PlayerPrimaryButton>

                <PlayerSecondaryButton
                  onClick={() => setForm(profile)}
                  disabled={saving}
                  className="flex-1"
                >
                  Undo changes
                </PlayerSecondaryButton>
              </div>
            </form>
          )}
        </PlayerPanel>

        <div className="space-y-6">
          <PlayerPanel className="overflow-hidden p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-100/40">
              Signature card
            </p>

            {profile.signatureCardId ? (
              <>
                <CardArtwork
                  name={profile.signatureName}
                  imageUrl={profile.signatureImageUrl}
                  rarity={profile.signatureRarity}
                  className="mx-auto mt-5 aspect-[0.716] w-full max-w-[16rem] rounded-2xl border border-white/12 shadow-[0_22px_65px_rgba(0,0,0,0.45)]"
                />

                <div className="mt-5">
                  <RarityPill
                    rarity={profile.signatureRarity}
                  />

                  <h2 className="mt-3 text-xl font-black text-white">
                    {profile.signatureName}
                  </h2>

                  <p className="mt-1 text-xs font-semibold text-white/32">
                    {profile.signatureSetName}
                    {profile.signatureCardNumber
                      ? ` · #${profile.signatureCardNumber}`
                      : ""}
                  </p>

                  <p className="mt-3 text-sm font-black text-yellow-50">
                    {formatMoney(
                      profile.signatureMarketValue,
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <span className="text-7xl text-yellow-100/20">
                  *
                </span>

                <p className="mt-4 text-sm font-semibold text-white/32">
                  Choose a card from your collection to
                  represent your trainer profile.
                </p>
              </div>
            )}

            <Link
              href="/collection"
              className="mt-5 flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Choose from collection
            </Link>
          </PlayerPanel>

          <PlayerPanel className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
              Account
            </p>

            <p className="mt-3 break-all text-sm font-bold text-white/55">
              {profile.email}
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/achievements"
                className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/55"
              >
                View achievements
                <span>→</span>
              </Link>

              <Link
                href="/history"
                className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/55"
              >
                View wish history
                <span>→</span>
              </Link>
            </div>
          </PlayerPanel>
        </div>
      </div>

      <style jsx global>{`
        .profile-input {
          min-height: 3rem;
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.045);
          padding-left: 1rem;
          padding-right: 1rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          outline: none;
        }

        .profile-input::placeholder {
          color: rgba(255, 255, 255, 0.22);
        }

        .profile-input:focus {
          border-color: rgba(165, 180, 252, 0.28);
          box-shadow: 0 0 0 2px rgba(165, 180, 252, 0.08);
        }
      `}</style>
    </section>
  );
}

function ProfileField({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-white/35">
        <span>{label}</span>
        {hint ? (
          <span className="normal-case tracking-normal text-white/20">
            {hint}
          </span>
        ) : null}
      </span>

      {children}
    </label>
  );
}
