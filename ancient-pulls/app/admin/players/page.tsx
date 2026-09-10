"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";
import {
  adminFetch,
} from "@/lib/admin/client-auth";

type PlayerAccount = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wish_balance:
    | number
    | string
    | null;
  lifetime_wishes_spent:
    | number
    | string
    | null;
  total_cards:
    | number
    | string
    | null;
  reserved_cards:
    | number
    | string
    | null;
  collection_value:
    | number
    | string
    | null;
  is_banned: boolean | null;
  ban_reason: string | null;
  banned_at?: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  email_confirmed_at:
    | string
    | null;
  is_admin: boolean;
  admin_display_name:
    | string
    | null;
};

type PlayerInventoryCard = {
  card_id: string;
  quantity:
    | number
    | string
    | null;
  reserved_quantity:
    | number
    | string
    | null;
  available_quantity:
    | number
    | string
    | null;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value:
    | number
    | string
    | null;
  image_url: string | null;
};

type CardSearchResult = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
  rarity: string | null;
  market_value:
    | number
    | string
    | null;
  image_url: string | null;
};

type PlayersResponse = {
  ok: true;
  players: PlayerAccount[];
};

type PlayerDetailResponse = {
  ok: true;
  account: PlayerAccount;
  inventory: PlayerInventoryCard[];
};

type CardSearchResponse = {
  ok: true;
  cards: CardSearchResult[];
};

type ActionResponse = {
  ok: true;
  action: string;
  finalWishBalance?: number;
  finalQuantity?: number;
  banned?: boolean;
  isAdmin?: boolean;
  email?: string;
  alreadyConfirmed?: boolean;
  startingWishBalance?: number;
  removedCards?: number;
  removedWishes?: number;
  warehouseCardsReturned?: number;
  metadataReset?: boolean;
};

function toNumber(
  value: unknown,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function toWhole(
  value: unknown,
): number {
  return Math.max(
    0,
    Math.floor(
      toNumber(value),
    ),
  );
}

function formatMoney(
  value: unknown,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    Math.max(
      0,
      toNumber(value),
    ),
  );
}

function formatDate(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function getName(
  player: PlayerAccount,
): string {
  return (
    player.display_name?.trim() ||
    player.username?.trim() ||
    player.email?.split("@")[0] ||
    "Unknown Trainer"
  );
}

function getInitial(
  value: string,
): string {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "T"
  );
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
        "string" &&
      message.trim()
    ) {
      return message.trim();
    }
  }

  return "The player account action could not be completed.";
}

export default function AdminPlayersPage() {
  const [
    players,
    setPlayers,
  ] =
    useState<PlayerAccount[]>([]);

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] =
    useState<PlayerAccount | null>(
      null,
    );

  const [
    inventory,
    setInventory,
  ] =
    useState<PlayerInventoryCard[]>(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    cardSearch,
    setCardSearch,
  ] =
    useState("");

  const [
    cardResults,
    setCardResults,
  ] =
    useState<CardSearchResult[]>(
      [],
    );

  const [
    selectedCard,
    setSelectedCard,
  ] =
    useState<CardSearchResult | null>(
      null,
    );

  const [
    wishAmount,
    setWishAmount,
  ] =
    useState(10);

  const [
    cardAmount,
    setCardAmount,
  ] =
    useState(1);

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    banReason,
    setBanReason,
  ] =
    useState("");

  const [
    resetReason,
    setResetReason,
  ] =
    useState("");

  const [
    resetConfirmation,
    setResetConfirmation,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    cardSearching,
    setCardSearching,
  ] =
    useState(false);

  const [
    actionKey,
    setActionKey,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const loadPlayers =
    useCallback(
      async (
        query = "",
        background =
          false,
      ) => {
        if (!background) {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await adminFetch<PlayersResponse>(
              `/api/admin/players?query=${encodeURIComponent(
                query,
              )}&limit=150`,
            );

          setPlayers(
            response.players,
          );
        } catch (
          loadError: unknown
        ) {
          setError(
            getErrorMessage(
              loadError,
            ),
          );
        } finally {
          if (!background) {
            setLoading(false);
          }
        }
      },
      [],
    );

  const loadPlayer =
    useCallback(
      async (
        userId: string,
        background =
          false,
      ) => {
        if (!background) {
          setDetailLoading(
            true,
          );

          setResetReason("");
          setResetConfirmation(
            "",
          );
        }

        setError("");

        try {
          const response =
            await adminFetch<PlayerDetailResponse>(
              `/api/admin/players?userId=${encodeURIComponent(
                userId,
              )}`,
            );

          setSelectedPlayer(
            response.account,
          );

          setInventory(
            response.inventory,
          );

          setBanReason(
            response.account
              .ban_reason ||
              "",
          );

          setPlayers(
            (current) =>
              current.map(
                (player) =>
                  player.user_id ===
                  userId
                    ? {
                        ...player,
                        ...response.account,
                      }
                    : player,
              ),
          );
        } catch (
          detailError: unknown
        ) {
          setError(
            getErrorMessage(
              detailError,
            ),
          );
        } finally {
          if (!background) {
            setDetailLoading(
              false,
            );
          }
        }
      },
      [],
    );

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadPlayers(
            search.trim(),
          );
        },
        280,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    loadPlayers,
    search,
  ]);

  useEffect(() => {
    const cleaned =
      cardSearch.trim();

    if (
      cleaned.length < 2
    ) {
      setCardResults([]);
      setCardSearching(
        false,
      );
      return;
    }

    let active = true;

    const timer =
      window.setTimeout(
        async () => {
          setCardSearching(
            true,
          );

          try {
            const response =
              await adminFetch<CardSearchResponse>(
                `/api/admin/players?cardQuery=${encodeURIComponent(
                  cleaned,
                )}`,
              );

            if (active) {
              setCardResults(
                response.cards,
              );
            }
          } catch (
            cardError: unknown
          ) {
            if (active) {
              setError(
                getErrorMessage(
                  cardError,
                ),
              );
            }
          } finally {
            if (active) {
              setCardSearching(
                false,
              );
            }
          }
        },
        280,
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer,
      );
    };
  }, [cardSearch]);

  async function runAction(
    key: string,
    body: Record<
      string,
      unknown
    >,
    message: string,
  ) {
    if (
      !selectedPlayer ||
      actionKey
    ) {
      return;
    }

    setActionKey(key);
    setError("");
    setSuccess("");

    try {
      await adminFetch<ActionResponse>(
        "/api/admin/players",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId:
              selectedPlayer.user_id,
            reason:
              reason.trim(),
            ...body,
          }),
        },
      );

      setSuccess(message);

      if (
        key ===
        "reset-account"
      ) {
        setResetReason("");
        setResetConfirmation("");
      }

      await Promise.all([
        loadPlayer(
          selectedPlayer.user_id,
          true,
        ),
        loadPlayers(
          search.trim(),
          true,
        ),
      ]);
    } catch (
      actionError: unknown
    ) {
      setError(
        getErrorMessage(
          actionError,
        ),
      );
    } finally {
      setActionKey(null);
    }
  }

  async function submitCard(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedCard ||
      !selectedPlayer
    ) {
      setError(
        "Choose a master database card first.",
      );
      return;
    }

    const amount =
      Math.max(
        1,
        Math.min(
          10000,
          Math.floor(
            cardAmount,
          ),
        ),
      );

    await runAction(
      "add-card",
      {
        action:
          "adjust_card",
        cardId:
          String(
            selectedCard.id,
          ),
        delta:
          amount,
      },
      `Added ${amount} × ${
        selectedCard.name ||
        "card"
      } to ${getName(
        selectedPlayer,
      )}.`,
    );
  }

  const totalPlayers =
    players.length;

  const bannedPlayers =
    players.filter(
      (player) =>
        player.is_banned ===
        true,
    ).length;

  const totalWishes =
    useMemo(
      () =>
        players.reduce(
          (
            total,
            player,
          ) =>
            total +
            toWhole(
              player.wish_balance,
            ),
          0,
        ),
      [players],
    );

  const totalCards =
    useMemo(
      () =>
        players.reduce(
          (
            total,
            player,
          ) =>
            total +
            toWhole(
              player.total_cards,
            ),
          0,
        ),
      [players],
    );

  const resetPhrase =
    selectedPlayer?.email
      ? `RESET ${selectedPlayer.email
          .trim()
          .toLowerCase()}`
      : "";

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-[#04130d]
        px-4
        pb-24
        pt-4
        text-white
        md:px-8
        md:pt-8
      "
    >
      <ForestBackground />

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(125,211,252,0.13),transparent_32%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(6,78,59,0.78),rgba(2,44,34,0.9))]
        "
      />

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-[1700px]
        "
      >
        <AdminNav />

        <header
          className="
            mt-7
            grid
            gap-5
            xl:grid-cols-[1fr_28rem]
          "
        >
          <section
            className="
              overflow-hidden
              rounded-[2.25rem]
              border
              border-emerald-100/15
              bg-white/[0.08]
              p-6
              shadow-[0_28px_90px_rgba(0,0,0,0.34)]
              backdrop-blur-3xl
              md:p-9
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >
              <span
                className="
                  rounded-full
                  border
                  border-emerald-200/20
                  bg-emerald-300/10
                  px-3
                  py-1.5
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-emerald-100
                "
              >
                Player operations
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-yellow-100/15
                  bg-yellow-200/[0.07]
                  px-3
                  py-1.5
                  text-xs
                  font-black
                  text-yellow-100
                "
              >
                Jirachi pulls are read-only tests
              </span>
            </div>

            <h1
              className="
                mt-5
                max-w-4xl
                text-4xl
                font-black
                leading-[0.96]
                tracking-tight
                text-white
                md:text-6xl
              "
            >
              Manage trainer accounts.
            </h1>

            <p
              className="
                mt-4
                max-w-3xl
                text-base
                font-semibold
                leading-7
                text-emerald-50/62
              "
            >
              Search every Jirachi account, suspend access,
              adjust wish balances and add or remove cards
              without touching the physical Forest Vault.
            </p>
          </section>

          <section
            className="
              grid
              grid-cols-2
              gap-3
              rounded-[2.25rem]
              border
              border-white/15
              bg-black/20
              p-4
              shadow-[0_28px_90px_rgba(0,0,0,0.25)]
              backdrop-blur-3xl
            "
          >
            <SummaryTile
              label="Loaded accounts"
              value={String(
                totalPlayers,
              )}
            />

            <SummaryTile
              label="Suspended"
              value={String(
                bannedPlayers,
              )}
            />

            <SummaryTile
              label="Visible wishes"
              value={String(
                totalWishes,
              )}
            />

            <SummaryTile
              label="Player cards"
              value={String(
                totalCards,
              )}
            />
          </section>
        </header>

        {error ? (
          <Notice
            tone="error"
            title="Action needs checking"
          >
            {error}
          </Notice>
        ) : null}

        {success ? (
          <Notice
            tone="success"
            title="Player account updated"
          >
            {success}
          </Notice>
        ) : null}

        <section
          className="
            mt-7
            grid
            gap-6
            xl:grid-cols-[24rem_minmax(0,1fr)]
          "
        >
          <aside
            className="
              overflow-hidden
              rounded-[2rem]
              border
              border-white/15
              bg-black/20
              shadow-[0_28px_90px_rgba(0,0,0,0.25)]
              backdrop-blur-3xl
            "
          >
            <div
              className="
                border-b
                border-white/10
                p-5
              "
            >
              <label
                className="
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.16em]
                  text-white/38
                "
              >
                Find account
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Email, username or name..."
                className="
                  mt-3
                  min-h-13
                  w-full
                  rounded-xl
                  border
                  border-white/10
                  bg-black/20
                  px-4
                  font-bold
                  text-white
                  outline-none
                  placeholder:text-white/25
                  focus:border-emerald-200/35
                "
              />
            </div>

            <div
              className="
                max-h-[72vh]
                overflow-y-auto
                p-3
              "
            >
              {loading ? (
                <div
                  className="
                    py-20
                    text-center
                    font-black
                    text-white/35
                  "
                >
                  Loading accounts...
                </div>
              ) : players.length ===
                0 ? (
                <div
                  className="
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.03]
                    px-5
                    py-12
                    text-center
                    text-sm
                    font-semibold
                    text-white/35
                  "
                >
                  No matching accounts.
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map(
                    (player) => {
                      const active =
                        selectedPlayer
                          ?.user_id ===
                        player.user_id;

                      return (
                        <button
                          key={
                            player.user_id
                          }
                          type="button"
                          onClick={() =>
                            void loadPlayer(
                              player.user_id,
                            )
                          }
                          className={[
                            "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                            active
                              ? "border-emerald-100/25 bg-emerald-200/[0.1]"
                              : "border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.055]",
                          ].join(
                            " ",
                          )}
                        >
                          <Avatar
                            player={
                              player
                            }
                          />

                          <span
                            className="
                              min-w-0
                              flex-1
                            "
                          >
                            <span
                              className="
                                block
                                truncate
                                text-sm
                                font-black
                                text-white
                              "
                            >
                              {getName(
                                player,
                              )}
                            </span>

                            <span
                              className="
                                mt-0.5
                                block
                                truncate
                                text-xs
                                font-bold
                                text-white/35
                              "
                            >
                              {player.email ||
                                `@${player.username}`}
                            </span>

                            <span
                              className="
                                mt-2
                                flex
                                items-center
                                gap-2
                                text-[0.65rem]
                                font-black
                                uppercase
                                tracking-[0.1em]
                                text-white/28
                              "
                            >
                              {toWhole(
                                player.wish_balance,
                              )}{" "}
                              wishes ·{" "}
                              {toWhole(
                                player.total_cards,
                              )}{" "}
                              cards
                            </span>
                          </span>

                          {player.is_banned ? (
                            <span
                              className="
                                rounded-full
                                border
                                border-red-200/15
                                bg-red-400/[0.09]
                                px-2.5
                                py-1
                                text-[0.58rem]
                                font-black
                                uppercase
                                text-red-100
                              "
                            >
                              Banned
                            </span>
                          ) : null}
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedPlayer ? (
              <div
                className="
                  flex
                  min-h-[34rem]
                  items-center
                  justify-center
                  rounded-[2rem]
                  border
                  border-white/15
                  bg-black/20
                  p-8
                  text-center
                  backdrop-blur-3xl
                "
              >
                <div>
                  <div
                    className="
                      mx-auto
                      flex
                      h-20
                      w-20
                      items-center
                      justify-center
                      overflow-hidden
                      rounded-[1.6rem]
                      border
                      border-emerald-100/20
                      bg-emerald-200/10
                    "
                  >
                    <img
                      src="/shaymin-moods/lukas.webp"
                      alt=""
                      className="
                        h-full
                        w-full
                        object-cover
                      "
                    />
                  </div>

                  <h2
                    className="
                      mt-5
                      text-2xl
                      font-black
                      text-white
                    "
                  >
                    Choose a trainer
                  </h2>

                  <p
                    className="
                      mt-3
                      max-w-md
                      text-sm
                      font-semibold
                      leading-6
                      text-white/38
                    "
                  >
                    Select an account from the left to manage
                    wishes, collection cards and access.
                  </p>
                </div>
              </div>
            ) : detailLoading ? (
              <div
                className="
                  flex
                  min-h-[34rem]
                  items-center
                  justify-center
                  rounded-[2rem]
                  border
                  border-white/15
                  bg-black/20
                  font-black
                  text-white/38
                  backdrop-blur-3xl
                "
              >
                Loading trainer account...
              </div>
            ) : (
              <div className="space-y-6">
                <PlayerHeader
                  player={
                    selectedPlayer
                  }
                />

                <section
                  className="
                    grid
                    gap-4
                    md:grid-cols-4
                  "
                >
                  <SummaryTile
                    label="Wish balance"
                    value={String(
                      toWhole(
                        selectedPlayer.wish_balance,
                      ),
                    )}
                  />

                  <SummaryTile
                    label="Total cards"
                    value={String(
                      toWhole(
                        selectedPlayer.total_cards,
                      ),
                    )}
                  />

                  <SummaryTile
                    label="Reserved"
                    value={String(
                      toWhole(
                        selectedPlayer.reserved_cards,
                      ),
                    )}
                  />

                  <SummaryTile
                    label="Collection value"
                    value={formatMoney(
                      selectedPlayer.collection_value,
                    )}
                  />
                </section>

                <Panel
                  eyebrow="Destructive account tool"
                  title="Reset to a fresh player account"
                  description="Keep this person's Supabase login identity while clearing their ancientpulls gameplay progress."
                >
                  <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-400/[0.08] p-5">
                    <p className="text-sm font-black text-red-50">
                      This cannot be undone from Shaymin.
                    </p>

                    <p className="mt-2 text-sm font-semibold leading-6 text-red-50/70">
                      Wishes, collection cards, wish history, achievements,
                      friends, trades, shipping addresses, binder choices,
                      onboarding and player preferences are cleared. Unshipped
                      allocated cards are returned to warehouse stock.
                    </p>

                    <p className="mt-3 text-sm font-semibold leading-6 text-emerald-50/70">
                      Their email, password, username, trainer code, legal
                      consent, payment records, Shaymin admin access and private
                      Nebu entitlement stay intact. Their wallet returns to the
                      current new-account starting offer.
                    </p>

                    <p className="mt-3 text-xs font-bold leading-5 text-white/45">
                      An active shipment must be finished or cancelled first.
                      You cannot reset the account currently running this admin
                      session.
                    </p>
                  </div>

                  <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-white/50">
                    Required audit reason
                  </label>

                  <input
                    value={resetReason}
                    onChange={(event) =>
                      setResetReason(
                        event.target.value,
                      )
                    }
                    placeholder="For example: Rebuild requested by the player"
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 font-bold text-white outline-none placeholder:text-white/25 focus:border-red-200/45"
                  />

                  <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-white/50">
                    Type this exact confirmation
                  </label>

                  <code className="mt-2 block overflow-x-auto rounded-xl border border-red-200/20 bg-black/35 px-4 py-3 text-sm font-black text-red-100">
                    {resetPhrase ||
                      "This account has no email address"}
                  </code>

                  <input
                    value={resetConfirmation}
                    onChange={(event) =>
                      setResetConfirmation(
                        event.target.value,
                      )
                    }
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Type the confirmation here"
                    className="mt-3 min-h-12 w-full rounded-xl border border-red-200/20 bg-black/30 px-4 font-black text-white outline-none placeholder:text-white/25 focus:border-red-200/55"
                  />

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ActionButton
                      tone="danger"
                      disabled={
                        Boolean(
                          actionKey,
                        ) ||
                        !resetPhrase ||
                        resetConfirmation !==
                          resetPhrase ||
                        resetReason
                          .trim()
                          .length < 5
                      }
                      onClick={() =>
                        void runAction(
                          "reset-account",
                          {
                            action:
                              "reset_account",
                            confirmation:
                              resetConfirmation,
                            reason:
                              resetReason.trim(),
                          },
                          `${getName(
                            selectedPlayer,
                          )} now has a fresh player account.`,
                        )
                      }
                    >
                      {actionKey ===
                      "reset-account"
                        ? "Resetting account..."
                        : "Reset player account"}
                    </ActionButton>

                    <p className="text-xs font-bold text-white/38">
                      The button unlocks only after both fields are valid.
                    </p>
                  </div>
                </Panel>

                <section
                  className="
                    grid
                    gap-6
                    2xl:grid-cols-2
                  "
                >
                  <Panel
                    eyebrow="Email verification"
                    title={
                      selectedPlayer.email_confirmed_at
                        ? "Email confirmed"
                        : "Confirmation pending"
                    }
                    description={
                      selectedPlayer.email_confirmed_at
                        ? `Confirmed ${formatDate(
                            selectedPlayer.email_confirmed_at,
                          )}.`
                        : "Send a fresh Supabase signup-confirmation email to this player's account address."
                    }
                  >
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-black",
                          selectedPlayer.email_confirmed_at
                            ? "border-emerald-100/20 bg-emerald-200/[0.08] text-emerald-100"
                            : "border-yellow-100/20 bg-yellow-200/[0.08] text-yellow-100",
                        ].join(" ")}
                      >
                        {selectedPlayer.email_confirmed_at
                          ? "Verified"
                          : "Awaiting confirmation"}
                      </span>

                      {!selectedPlayer.email_confirmed_at ? (
                        <ActionButton
                          disabled={
                            Boolean(
                              actionKey,
                            ) ||
                            !selectedPlayer.email
                          }
                          onClick={() =>
                            void runAction(
                              "resend-confirmation",
                              {
                                action:
                                  "resend_confirmation",
                              },
                              `Confirmation email sent to ${
                                selectedPlayer.email ||
                                "the player"
                              }.`,
                            )
                          }
                        >
                          {actionKey ===
                          "resend-confirmation"
                            ? "Sending..."
                            : "Resend confirmation email"}
                        </ActionButton>
                      ) : null}
                    </div>

                    <p className="mt-4 break-all text-xs font-semibold leading-5 text-white/35">
                      {selectedPlayer.email ||
                        "This account has no email address."}
                    </p>
                  </Panel>

                  <Panel
                    eyebrow="Shaymin permissions"
                    title={
                      selectedPlayer.is_admin
                        ? "Administrator access active"
                        : "Player access only"
                    }
                    description={
                      selectedPlayer.is_admin
                        ? "This account can sign into Shaymin with its own email and password."
                        : "Granting access lets this player manage the same Shaymin admin site as Lukas."
                    }
                  >
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-black",
                          selectedPlayer.is_admin
                            ? "border-cyan-100/20 bg-cyan-200/[0.08] text-cyan-50"
                            : "border-white/10 bg-white/[0.04] text-white/45",
                        ].join(" ")}
                      >
                        {selectedPlayer.is_admin
                          ? "Shaymin admin"
                          : "Not an admin"}
                      </span>

                      {selectedPlayer.is_admin ? (
                        <ActionButton
                          tone="danger"
                          disabled={
                            Boolean(
                              actionKey,
                            ) ||
                            selectedPlayer.email?.toLowerCase() ===
                              "pullspocket@gmail.com"
                          }
                          onClick={() =>
                            void runAction(
                              "revoke-admin",
                              {
                                action:
                                  "set_admin",
                                adminEnabled:
                                  false,
                              },
                              `Removed Shaymin administrator access from ${
                                selectedPlayer.email ||
                                getName(
                                  selectedPlayer,
                                )
                              }.`,
                            )
                          }
                        >
                          {actionKey ===
                          "revoke-admin"
                            ? "Removing..."
                            : "Remove admin access"}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          disabled={
                            Boolean(
                              actionKey,
                            ) ||
                            !selectedPlayer.email
                          }
                          onClick={() =>
                            void runAction(
                              "grant-admin",
                              {
                                action:
                                  "set_admin",
                                adminEnabled:
                                  true,
                              },
                              `${
                                selectedPlayer.email ||
                                getName(
                                  selectedPlayer,
                                )
                              } can now sign into Shaymin.`,
                            )
                          }
                        >
                          {actionKey ===
                          "grant-admin"
                            ? "Granting..."
                            : "Grant Shaymin admin access"}
                        </ActionButton>
                      )}
                    </div>

                    <p className="mt-4 text-xs font-semibold leading-5 text-white/35">
                      Each administrator keeps a separate Supabase login. No
                      shared password or hardcoded email is required.
                    </p>
                  </Panel>
                </section>

                <section
                  className="
                    grid
                    gap-6
                    2xl:grid-cols-2
                  "
                >
                  <Panel
                    eyebrow="Wallet"
                    title="Adjust wishes"
                    description="Test pulls currently return this balance unchanged."
                  >
                    <div
                      className="
                        mt-5
                        grid
                        grid-cols-[1fr_auto_auto]
                        gap-2
                      "
                    >
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={
                          wishAmount
                        }
                        onChange={(event) =>
                          setWishAmount(
                            Math.max(
                              1,
                              Math.min(
                                100000,
                                Number(
                                  event.target
                                    .value,
                                ) || 1,
                              ),
                            ),
                          )
                        }
                        className="
                          min-h-13
                          min-w-0
                          rounded-xl
                          border
                          border-white/10
                          bg-black/20
                          px-4
                          text-center
                          text-lg
                          font-black
                          text-white
                          outline-none
                          focus:border-emerald-200/35
                        "
                      />

                      <ActionButton
                        disabled={
                          Boolean(
                            actionKey,
                          )
                        }
                        onClick={() =>
                          void runAction(
                            "add-wishes",
                            {
                              action:
                                "adjust_wishes",
                              delta:
                                Math.max(
                                  1,
                                  Math.floor(
                                    wishAmount,
                                  ),
                                ),
                            },
                            `Added ${Math.max(
                              1,
                              Math.floor(
                                wishAmount,
                              ),
                            )} wishes.`,
                          )
                        }
                      >
                        Add
                      </ActionButton>

                      <ActionButton
                        tone="danger"
                        disabled={
                          Boolean(
                            actionKey,
                          )
                        }
                        onClick={() =>
                          void runAction(
                            "remove-wishes",
                            {
                              action:
                                "adjust_wishes",
                              delta:
                                -Math.max(
                                  1,
                                  Math.floor(
                                    wishAmount,
                                  ),
                                ),
                            },
                            `Removed up to ${Math.max(
                              1,
                              Math.floor(
                                wishAmount,
                              ),
                            )} wishes.`,
                          )
                        }
                      >
                        Remove
                      </ActionButton>
                    </div>

                    <label
                      className="
                        mt-4
                        block
                        text-xs
                        font-black
                        uppercase
                        tracking-[0.14em]
                        text-white/35
                      "
                    >
                      Audit note
                    </label>

                    <input
                      value={reason}
                      onChange={(event) =>
                        setReason(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Optional reason for card and wish changes"
                      className="
                        mt-2
                        min-h-12
                        w-full
                        rounded-xl
                        border
                        border-white/10
                        bg-black/20
                        px-4
                        font-bold
                        text-white
                        outline-none
                        placeholder:text-white/22
                        focus:border-emerald-200/35
                      "
                    />
                  </Panel>

                  <Panel
                    eyebrow="Account access"
                    title={
                      selectedPlayer.is_banned
                        ? "Account suspended"
                        : "Account active"
                    }
                    description={
                      selectedPlayer.is_banned
                        ? selectedPlayer.ban_reason ||
                          "This player cannot enter the Jirachi application."
                        : "Banning shows a dedicated suspension screen before any player page loads."
                    }
                  >
                    <label
                      className="
                        mt-5
                        block
                        text-xs
                        font-black
                        uppercase
                        tracking-[0.14em]
                        text-white/35
                      "
                    >
                      Ban reason
                    </label>

                    <textarea
                      value={banReason}
                      onChange={(event) =>
                        setBanReason(
                          event.target
                            .value,
                        )
                      }
                      rows={3}
                      placeholder="Reason shown to the player"
                      className="
                        mt-2
                        w-full
                        resize-none
                        rounded-xl
                        border
                        border-white/10
                        bg-black/20
                        px-4
                        py-3
                        font-semibold
                        text-white
                        outline-none
                        placeholder:text-white/22
                        focus:border-red-200/30
                      "
                    />

                    <div
                      className="
                        mt-4
                        flex
                        flex-wrap
                        gap-3
                      "
                    >
                      {selectedPlayer.is_banned ? (
                        <ActionButton
                          disabled={
                            Boolean(
                              actionKey,
                            )
                          }
                          onClick={() =>
                            void runAction(
                              "unban",
                              {
                                action:
                                  "set_ban",
                                banned:
                                  false,
                                reason:
                                  banReason,
                              },
                              "Player account restored.",
                            )
                          }
                        >
                          Unban player
                        </ActionButton>
                      ) : (
                        <ActionButton
                          tone="danger"
                          disabled={
                            Boolean(
                              actionKey,
                            )
                          }
                          onClick={() =>
                            void runAction(
                              "ban",
                              {
                                action:
                                  "set_ban",
                                banned:
                                  true,
                                reason:
                                  banReason,
                              },
                              "Player account suspended.",
                            )
                          }
                        >
                          Ban player
                        </ActionButton>
                      )}
                    </div>
                  </Panel>
                </section>

                <Panel
                  eyebrow="Collection tools"
                  title="Add a card"
                  description="Search the master database. This changes only the selected player's collection, never physical stock."
                >
                  <form
                    onSubmit={
                      submitCard
                    }
                    className="
                      mt-5
                      grid
                      gap-4
                      xl:grid-cols-[1fr_10rem_auto]
                    "
                  >
                    <div className="relative">
                      <input
                        value={
                          cardSearch
                        }
                        onChange={(event) => {
                          setCardSearch(
                            event.target
                              .value,
                          );

                          setSelectedCard(
                            null,
                          );
                        }}
                        placeholder="Search card name, set or number..."
                        className="
                          min-h-13
                          w-full
                          rounded-xl
                          border
                          border-white/10
                          bg-black/20
                          px-4
                          pr-12
                          font-bold
                          text-white
                          outline-none
                          placeholder:text-white/22
                          focus:border-cyan-200/35
                        "
                      />

                      {cardSearching ? (
                        <span
                          className="
                            absolute
                            right-4
                            top-1/2
                            -translate-y-1/2
                            animate-spin
                            text-cyan-100
                          "
                        >
                          ◌
                        </span>
                      ) : null}

                      {cardResults.length >
                        0 &&
                      !selectedCard ? (
                        <div
                          className="
                            absolute
                            inset-x-0
                            top-[calc(100%+0.5rem)]
                            z-50
                            max-h-80
                            overflow-y-auto
                            rounded-2xl
                            border
                            border-white/15
                            bg-[#071a14]/98
                            p-2
                            shadow-[0_25px_80px_rgba(0,0,0,0.5)]
                            backdrop-blur-3xl
                          "
                        >
                          {cardResults.map(
                            (card) => (
                              <button
                                key={
                                  String(
                                    card.id,
                                  )
                                }
                                type="button"
                                onClick={() => {
                                  setSelectedCard(
                                    card,
                                  );

                                  setCardSearch(
                                    card.name ||
                                      "Selected card",
                                  );
                                }}
                                className="
                                  flex
                                  w-full
                                  items-center
                                  gap-3
                                  rounded-xl
                                  p-2.5
                                  text-left
                                  transition
                                  hover:bg-white/[0.07]
                                "
                              >
                                <CardImage
                                  imageUrl={
                                    card.image_url
                                  }
                                  name={
                                    card.name ||
                                    "Card"
                                  }
                                />

                                <span
                                  className="
                                    min-w-0
                                    flex-1
                                  "
                                >
                                  <span
                                    className="
                                      block
                                      truncate
                                      text-sm
                                      font-black
                                      text-white
                                    "
                                  >
                                    {card.name ||
                                      "Unknown card"}
                                  </span>

                                  <span
                                    className="
                                      mt-0.5
                                      block
                                      truncate
                                      text-xs
                                      font-semibold
                                      text-white/35
                                    "
                                  >
                                    {card.set_name ||
                                      "Unknown set"}
                                    {card.card_no
                                      ? ` · #${card.card_no}`
                                      : ""}
                                  </span>
                                </span>

                                <span
                                  className="
                                    font-black
                                    text-cyan-100
                                  "
                                >
                                  {formatMoney(
                                    card.market_value,
                                  )}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>

                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={cardAmount}
                      onChange={(event) =>
                        setCardAmount(
                          Math.max(
                            1,
                            Math.min(
                              10000,
                              Number(
                                event.target
                                  .value,
                              ) || 1,
                            ),
                          ),
                        )
                      }
                      className="
                        min-h-13
                        rounded-xl
                        border
                        border-white/10
                        bg-black/20
                        px-4
                        text-center
                        text-lg
                        font-black
                        text-white
                        outline-none
                        focus:border-cyan-200/35
                      "
                    />

                    <ActionButton
                      type="submit"
                      disabled={
                        !selectedCard ||
                        Boolean(
                          actionKey,
                        )
                      }
                    >
                      Add to player
                    </ActionButton>
                  </form>
                </Panel>

                <Panel
                  eyebrow="Current collection"
                  title={`${inventory.length} card types`}
                  description="Reserved trade or shipping copies cannot be removed."
                >
                  {inventory.length ===
                  0 ? (
                    <div
                      className="
                        mt-5
                        rounded-2xl
                        border
                        border-white/10
                        bg-black/15
                        px-6
                        py-14
                        text-center
                        text-sm
                        font-semibold
                        text-white/35
                      "
                    >
                      This trainer has no cards.
                    </div>
                  ) : (
                    <div
                      className="
                        mt-5
                        grid
                        gap-4
                        md:grid-cols-2
                        2xl:grid-cols-3
                      "
                    >
                      {inventory.map(
                        (card) => (
                          <InventoryCard
                            key={
                              card.card_id
                            }
                            card={card}
                            busy={
                              actionKey ===
                              `remove:${card.card_id}`
                            }
                            disabled={
                              Boolean(
                                actionKey,
                              )
                            }
                            onRemove={(
                              amount,
                            ) =>
                              void runAction(
                                `remove:${card.card_id}`,
                                {
                                  action:
                                    "adjust_card",
                                  cardId:
                                    card.card_id,
                                  delta:
                                    -amount,
                                },
                                `Removed ${amount} × ${
                                  card.name ||
                                  "card"
                                }.`,
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  )}
                </Panel>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Avatar({
  player,
}: {
  player: PlayerAccount;
}) {
  const name =
    getName(player);

  return (
    <div
      className="
        flex
        h-11
        w-11
        flex-none
        items-center
        justify-center
        overflow-hidden
        rounded-full
        border
        border-emerald-100/20
        bg-emerald-200/10
        text-sm
        font-black
        text-white
      "
    >
      {player.avatar_url ? (
        <img
          src={
            player.avatar_url
          }
          alt=""
          className="
            h-full
            w-full
            object-cover
          "
        />
      ) : (
        getInitial(name)
      )}
    </div>
  );
}

function PlayerHeader({
  player,
}: {
  player: PlayerAccount;
}) {
  return (
    <section
      className="
        flex
        flex-col
        gap-5
        rounded-[2rem]
        border
        border-white/15
        bg-white/[0.07]
        p-6
        shadow-[0_25px_80px_rgba(0,0,0,0.25)]
        backdrop-blur-3xl
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <div
        className="
          flex
          min-w-0
          items-center
          gap-4
        "
      >
        <div
          className="
            flex
            h-20
            w-20
            flex-none
            items-center
            justify-center
            overflow-hidden
            rounded-[1.5rem]
            border
            border-emerald-100/20
            bg-emerald-200/10
            text-2xl
            font-black
            text-white
          "
        >
          {player.avatar_url ? (
            <img
              src={
                player.avatar_url
              }
              alt=""
              className="
                h-full
                w-full
                object-cover
              "
            />
          ) : (
            getInitial(
              getName(player),
            )
          )}
        </div>

        <div className="min-w-0">
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <h2
              className="
                truncate
                text-2xl
                font-black
                text-white
              "
            >
              {getName(player)}
            </h2>

            <span
              className={[
                "rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em]",
                player.is_banned
                  ? "border-red-200/15 bg-red-400/[0.08] text-red-100"
                  : "border-emerald-100/20 bg-emerald-200/[0.08] text-emerald-100",
              ].join(
                " ",
              )}
            >
              {player.is_banned
                ? "Suspended"
                : "Active"}
            </span>

            <span
              className={[
                "rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em]",
                player.email_confirmed_at
                  ? "border-emerald-100/20 bg-emerald-200/[0.08] text-emerald-100"
                  : "border-yellow-100/20 bg-yellow-200/[0.08] text-yellow-100",
              ].join(
                " ",
              )}
            >
              {player.email_confirmed_at
                ? "Email verified"
                : "Email pending"}
            </span>

            {player.is_admin ? (
              <span className="rounded-full border border-cyan-100/20 bg-cyan-200/[0.08] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-50">
                Shaymin admin
              </span>
            ) : null}
          </div>

          <p
            className="
              mt-1
              truncate
              text-sm
              font-bold
              text-emerald-100/42
            "
          >
            @{player.username ||
              "trainer"}
          </p>

          <p
            className="
              mt-1
              truncate
              text-sm
              font-semibold
              text-white/35
            "
          >
            {player.email ||
              "No email"}
          </p>
        </div>
      </div>

      <div
        className="
          grid
          gap-2
          text-sm
          font-semibold
          text-white/42
          sm:grid-cols-3
          lg:text-right
        "
      >
        <p>
          Joined{" "}
          <strong
            className="
              block
              text-white/70
            "
          >
            {formatDate(
              player.created_at,
            )}
          </strong>
        </p>

        <p>
          Last sign-in{" "}
          <strong
            className="
              block
              text-white/70
            "
          >
            {formatDate(
              player.last_sign_in_at,
            )}
          </strong>
        </p>

        <p>
          Last activity{" "}
          <strong
            className="
              block
              text-white/70
            "
          >
            {formatDate(
              player.last_seen_at,
            )}
          </strong>
        </p>
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-white/10
        bg-white/[0.045]
        p-4
      "
    >
      <p
        className="
          text-[0.62rem]
          font-black
          uppercase
          tracking-[0.14em]
          text-white/32
        "
      >
        {label}
      </p>

      <p
        className="
          mt-2
          truncate
          text-xl
          font-black
          text-white
        "
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children:
    ReactNode;
}) {
  return (
    <section
      className="
        rounded-[2rem]
        border
        border-white/15
        bg-black/20
        p-5
        shadow-[0_25px_80px_rgba(0,0,0,0.22)]
        backdrop-blur-3xl
        sm:p-7
      "
    >
      <p
        className="
          text-xs
          font-black
          uppercase
          tracking-[0.17em]
          text-emerald-100/40
        "
      >
        {eyebrow}
      </p>

      <h2
        className="
          mt-2
          text-2xl
          font-black
          text-white
        "
      >
        {title}
      </h2>

      <p
        className="
          mt-2
          text-sm
          font-semibold
          leading-6
          text-white/38
        "
      >
        {description}
      </p>

      {children}
    </section>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone:
    | "error"
    | "success";
  title: string;
  children:
    ReactNode;
}) {
  return (
    <div
      className={[
        "mt-6 rounded-[1.5rem] border px-5 py-4 backdrop-blur-2xl",
        tone === "error"
          ? "border-red-300/20 bg-red-500/10 text-red-100"
          : "border-emerald-200/20 bg-emerald-300/10 text-emerald-100",
      ].join(
        " ",
      )}
    >
      <p className="font-black">
        {title}
      </p>

      <div
        className="
          mt-1
          text-sm
          font-semibold
          opacity-75
        "
      >
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "normal",
  type = "button",
}: {
  children:
    ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?:
    | "normal"
    | "danger";
  type?:
    | "button"
    | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "min-h-13 rounded-xl border px-5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-red-200/20 bg-red-400/[0.1] text-red-100 hover:bg-red-400/[0.16]"
          : "border-emerald-100/25 bg-emerald-200 text-emerald-950 hover:bg-emerald-100",
      ].join(
        " ",
      )}
    >
      {children}
    </button>
  );
}

function CardImage({
  imageUrl,
  name,
}: {
  imageUrl:
    | string
    | null;
  name: string;
}) {
  return (
    <div
      className="
        flex
        h-14
        w-10
        flex-none
        items-center
        justify-center
        overflow-hidden
        rounded-lg
        border
        border-white/10
        bg-black/20
      "
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="
            h-full
            w-full
            object-contain
            p-0.5
          "
        />
      ) : (
        <span>🎴</span>
      )}
    </div>
  );
}

function InventoryCard({
  card,
  busy,
  disabled,
  onRemove,
}: {
  card: PlayerInventoryCard;
  busy: boolean;
  disabled: boolean;
  onRemove: (
    amount: number,
  ) => void;
}) {
  const [
    amount,
    setAmount,
  ] =
    useState(1);

  const available =
    toWhole(
      card.available_quantity,
    );

  return (
    <article
      className="
        rounded-2xl
        border
        border-white/10
        bg-white/[0.035]
        p-4
      "
    >
      <div
        className="
          flex
          gap-3
        "
      >
        <div
          className="
            flex
            h-28
            w-20
            flex-none
            items-center
            justify-center
            overflow-hidden
            rounded-xl
            border
            border-white/10
            bg-black/20
          "
        >
          {card.image_url ? (
            <img
              src={
                card.image_url
              }
              alt={
                card.name ||
                "Card"
              }
              className="
                h-full
                w-full
                object-contain
                p-1
              "
            />
          ) : (
            <span className="text-3xl">
              🎴
            </span>
          )}
        </div>

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className="
              line-clamp-2
              font-black
              text-white
            "
          >
            {card.name ||
              "Unknown card"}
          </p>

          <p
            className="
              mt-1
              truncate
              text-xs
              font-semibold
              text-white/35
            "
          >
            {card.set_name ||
              "Unknown set"}
            {card.card_no
              ? ` · #${card.card_no}`
              : ""}
          </p>

          <p
            className="
              mt-3
              font-black
              text-cyan-100
            "
          >
            {formatMoney(
              card.market_value,
            )}
          </p>

          <p
            className="
              mt-1
              text-xs
              font-bold
              text-white/32
            "
          >
            {toWhole(
              card.quantity,
            )} total ·{" "}
            {available} removable ·{" "}
            {toWhole(
              card.reserved_quantity,
            )} reserved
          </p>
        </div>
      </div>

      <div
        className="
          mt-4
          grid
          grid-cols-[6rem_1fr]
          gap-2
        "
      >
        <input
          type="number"
          min="1"
          max={Math.max(
            1,
            available,
          )}
          value={amount}
          onChange={(event) =>
            setAmount(
              Math.max(
                1,
                Math.min(
                  Math.max(
                    1,
                    available,
                  ),
                  Number(
                    event.target
                      .value,
                  ) || 1,
                ),
              ),
            )
          }
          disabled={
            available < 1 ||
            disabled
          }
          className="
            min-h-11
            rounded-xl
            border
            border-white/10
            bg-black/20
            px-3
            text-center
            font-black
            text-white
            outline-none
            disabled:opacity-35
          "
        />

        <button
          type="button"
          onClick={() =>
            onRemove(
              Math.max(
                1,
                Math.min(
                  available,
                  Math.floor(
                    amount,
                  ),
                ),
              ),
            )
          }
          disabled={
            available < 1 ||
            disabled
          }
          className="
            min-h-11
            rounded-xl
            border
            border-red-200/15
            bg-red-400/[0.07]
            px-4
            text-xs
            font-black
            text-red-100
            transition
            hover:bg-red-400/[0.13]
            disabled:opacity-35
          "
        >
          {busy
            ? "Removing..."
            : "Remove from player"}
        </button>
      </div>
    </article>
  );
}
