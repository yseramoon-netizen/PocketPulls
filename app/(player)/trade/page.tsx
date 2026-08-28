"use client";

import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerPrimaryButton,
  PlayerSecondaryButton,
  PlayerStatCard,
  RarityPill,
} from "@/components/player/PlayerUI";
import { formatMarketValue } from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

type TradeInboxRow = {
  trade_id: string;
  other_user_id: string;
  username:
    | string
    | null;
  display_name:
    | string
    | null;
  avatar_url:
    | string
    | null;
  status:
    | "open"
    | "countdown"
    | "completed"
    | "cancelled";
  self_locked: boolean;
  other_locked: boolean;
  self_ready: boolean;
  other_ready: boolean;
  countdown_started_at:
    | string
    | null;
  updated_at: string;
};

type FriendChoice = {
  other_user_id: string;
  username:
    | string
    | null;
  display_name:
    | string
    | null;
  avatar_url:
    | string
    | null;
  online: boolean;
};

type TradeSummary = {
  trade_id: string;
  status:
    | "open"
    | "countdown"
    | "completed"
    | "cancelled";
  initiator_id: string;
  recipient_id: string;
  current_user_id: string;
  initiator_username:
    | string
    | null;
  initiator_display_name:
    | string
    | null;
  initiator_avatar_url:
    | string
    | null;
  recipient_username:
    | string
    | null;
  recipient_display_name:
    | string
    | null;
  recipient_avatar_url:
    | string
    | null;
  initiator_locked: boolean;
  recipient_locked: boolean;
  initiator_ready: boolean;
  recipient_ready: boolean;
  countdown_started_at:
    | string
    | null;
  completed_at:
    | string
    | null;
  updated_at: string;
};

type TradeItem = {
  owner_id: string;
  card_id: string;
  quantity: number;
  name: string;
  set_name:
    | string
    | null;
  card_no:
    | string
    | null;
  rarity:
    | string
    | null;
  market_value:
    | number
    | string
    | null;
  image_url:
    | string
    | null;
};

type InventoryCard = {
  card_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  name: string;
  set_name:
    | string
    | null;
  card_no:
    | string
    | null;
  rarity:
    | string
    | null;
  market_value:
    | number
    | string
    | null;
  image_url:
    | string
    | null;
};

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

  return "The trade could not be updated.";
}

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

function formatMoney(
  value: number,
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
      value,
    ),
  );
}

function identityName(
  displayName:
    | string
    | null,
  username:
    | string
    | null,
): string {
  return (
    displayName?.trim() ||
    username?.trim() ||
    "Trainer"
  );
}

function initial(
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

export default function TradePage() {
  const autoOpenRef =
    useRef(false);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState("");

  const [
    inbox,
    setInbox,
  ] =
    useState<TradeInboxRow[]>(
      [],
    );

  const [
    friends,
    setFriends,
  ] =
    useState<FriendChoice[]>(
      [],
    );

  const [
    activeTradeId,
    setActiveTradeId,
  ] =
    useState("");

  const [
    summary,
    setSummary,
  ] =
    useState<TradeSummary | null>(
      null,
    );

  const [
    items,
    setItems,
  ] =
    useState<TradeItem[]>([]);

  const [
    inventory,
    setInventory,
  ] =
    useState<InventoryCard[]>(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    tradeLoading,
    setTradeLoading,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    completing,
    setCompleting,
  ] =
    useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    now,
    setNow,
  ] =
    useState(
      Date.now(),
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const loadLists =
    useCallback(
      async (
        background =
          false,
      ) => {
        if (!background) {
          setLoading(true);
        }

        try {
          const client =
            supabase as any;

          const [
            userResult,
            inboxResult,
            friendsResult,
          ] =
            await Promise.all([
              supabase.auth.getUser(),
              client.rpc(
                "get_player_trade_inbox",
              ),
              client.rpc(
                "get_player_friend_dashboard",
              ),
            ]);

          if (
            userResult.error ||
            !userResult.data.user
          ) {
            throw (
              userResult.error ||
              new Error(
                "Your player session has expired.",
              )
            );
          }

          if (
            inboxResult.error
          ) {
            throw inboxResult.error;
          }

          if (
            friendsResult.error
          ) {
            throw friendsResult.error;
          }

          setCurrentUserId(
            userResult.data.user.id,
          );

          setInbox(
            Array.isArray(
              inboxResult.data,
            )
              ? (
                  inboxResult.data as
                    TradeInboxRow[]
                )
              : [],
          );

          const accepted =
            Array.isArray(
              friendsResult.data,
            )
              ? (
                  friendsResult.data as
                    Array<
                      FriendChoice & {
                        relationship_status:
                          string;
                      }
                    >
                ).filter(
                  (row) =>
                    row.relationship_status ===
                    "accepted",
                )
              : [];

          setFriends(
            accepted,
          );
        } catch (
          error: unknown
        ) {
          setErrorMessage(
            getErrorMessage(
              error,
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

  const loadTrade =
    useCallback(
      async (
        tradeId: string,
        background = false,
      ): Promise<TradeSummary | null> => {
        if (!tradeId) {
          return null;
        }

        if (!background) {
          setTradeLoading(true);
        }

        try {
          const client =
            supabase as any;

          /*
           * Load the summary first. A completed trade must be allowed to
           * update the screen even if a secondary inventory request fails.
           * The old Promise.all path could hide a successful final transfer
           * behind an unrelated refresh error.
           */
          const summaryResult =
            await client.rpc(
              "get_player_trade_summary",
              {
                p_trade_id: tradeId,
              },
            );

          if (summaryResult.error) {
            throw summaryResult.error;
          }

          const summaryRow =
            Array.isArray(summaryResult.data)
              ? summaryResult.data[0]
              : summaryResult.data;

          if (!summaryRow) {
            throw new Error(
              "That trade no longer exists.",
            );
          }

          const nextSummary =
            summaryRow as TradeSummary;

          setSummary(nextSummary);

          const itemsResult =
            await client.rpc(
              "get_player_trade_items",
              {
                p_trade_id: tradeId,
              },
            );

          if (itemsResult.error) {
            throw itemsResult.error;
          }

          setItems(
            Array.isArray(itemsResult.data)
              ? (itemsResult.data as TradeItem[])
              : [],
          );

          if (
            nextSummary.status === "open" ||
            nextSummary.status === "countdown"
          ) {
            const inventoryResult =
              await client.rpc(
                "get_player_trade_inventory",
                {
                  p_trade_id: tradeId,
                },
              );

            if (inventoryResult.error) {
              console.warn(
                "Trade inventory refresh failed:",
                inventoryResult.error,
              );
            } else {
              setInventory(
                Array.isArray(inventoryResult.data)
                  ? (inventoryResult.data as InventoryCard[])
                  : [],
              );
            }
          } else {
            setInventory([]);
          }

          setErrorMessage(null);
          return nextSummary;
        } catch (error: unknown) {
          setErrorMessage(
            getErrorMessage(error),
          );
          return null;
        } finally {
          if (!background) {
            setTradeLoading(false);
          }
        }
      },
      [],
    );

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (
      autoOpenRef.current ||
      loading
    ) {
      return;
    }

    autoOpenRef.current =
      true;

    const params =
      new URLSearchParams(
        window.location.search,
      );

    const requestedTrade =
      params.get("trade") ||
      "";

    const requestedFriend =
      params.get("friend") ||
      "";

    if (requestedTrade) {
      setActiveTradeId(
        requestedTrade,
      );
      void loadTrade(
        requestedTrade,
      );
      return;
    }

    if (requestedFriend) {
      void createTrade(
        requestedFriend,
      );
      return;
    }

    const firstOpen =
      inbox.find(
        (row) =>
          row.status ===
            "open" ||
          row.status ===
            "countdown",
      );

    if (firstOpen) {
      setActiveTradeId(
        firstOpen.trade_id,
      );
      void loadTrade(
        firstOpen.trade_id,
      );
    }
  }, [
    inbox,
    loadTrade,
    loading,
  ]);

  useEffect(() => {
    if (!activeTradeId) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState !==
            "visible"
          ) {
            return;
          }

          void loadTrade(
            activeTradeId,
            true,
          );
        },
        summary?.status === "countdown"
          ? 2500
          : 15000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    activeTradeId,
    loadTrade,
    summary?.status,
  ]);

  useEffect(() => {
    if (!activeTradeId) {
      return;
    }

    const client = supabase as any;
    const channel = client
      .channel(`player-trade-${activeTradeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "player_trades",
          filter: `id=eq.${activeTradeId}`,
        },
        () => {
          void loadTrade(activeTradeId, true);
          void loadLists(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_trade_items",
          filter: `trade_id=eq.${activeTradeId}`,
        },
        () => {
          void loadTrade(activeTradeId, true);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [
    activeTradeId,
    loadLists,
    loadTrade,
  ]);

  useEffect(() => {
    if (
      summary?.status !==
      "countdown"
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now(),
          );
        },
        250,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [summary?.status]);

  async function createTrade(
    friendUserId: string,
  ) {
    if (
      busy ||
      !friendUserId
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const client =
        supabase as any;

      const {
        data,
        error,
      } =
        await client.rpc(
          "create_player_trade",
          {
            p_friend_user_id:
              friendUserId,
          },
        );

      if (error) {
        throw error;
      }

      const tradeId =
        typeof data ===
          "string"
          ? data
          : Array.isArray(data)
            ? String(
                data[0] ||
                "",
              )
            : String(
                data ||
                "",
              );

      if (!tradeId) {
        throw new Error(
          "The trade did not return an ID.",
        );
      }

      setActiveTradeId(
        tradeId,
      );

      window.history.replaceState(
        null,
        "",
        `/trade?trade=${encodeURIComponent(
          tradeId,
        )}`,
      );

      await Promise.all([
        loadTrade(
          tradeId,
        ),
        loadLists(
          true,
        ),
      ]);
    } catch (
      error: unknown
    ) {
      setErrorMessage(
        getErrorMessage(
          error,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function runTradeAction(
    functionName: string,
    args: Record<string, unknown>,
  ) {
    if (
      busy ||
      !activeTradeId
    ) {
      return;
    }

    const finalConfirmation =
      functionName ===
      "set_player_trade_ready";

    setBusy(true);
    setCompleting(
      finalConfirmation,
    );
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const client =
        supabase as any;

      const {
        data,
        error,
      } = await client.rpc(
        functionName,
        args,
      );

      if (error) {
        throw error;
      }

      const result =
        typeof data === "string"
          ? data
          : Array.isArray(data)
            ? String(data[0] || "")
            : String(data || "");

      if (
        finalConfirmation &&
        result === "completed"
      ) {
        /*
         * Reflect completion immediately, then confirm it from the server.
         * This prevents the second trainer from seeing a frozen countdown
         * while the normal polling cycle catches up.
         */
        setSummary((current) =>
          current
            ? {
                ...current,
                status: "completed",
                completed_at:
                  new Date().toISOString(),
                initiator_ready: true,
                recipient_ready: true,
              }
            : current,
        );

        setSuccessMessage(
          "Trade complete — both collections were transferred safely.",
        );

        window.dispatchEvent(
          new CustomEvent(
            "pocketpulls:collection-changed",
          ),
        );
      } else if (
        finalConfirmation &&
        result === "waiting"
      ) {
        setSuccessMessage(
          "Your final confirmation is saved. Waiting for the other trainer.",
        );
      }

      /*
       * The transaction has committed before the RPC resolves. A short retry
       * loop handles PostgREST/cache latency without requiring another click.
       */
      let loaded: TradeSummary | null = null;

      for (
        let attempt = 0;
        attempt < 4;
        attempt += 1
      ) {
        loaded = await loadTrade(
          activeTradeId,
          true,
        );

        if (
          !finalConfirmation ||
          result !== "completed" ||
          loaded?.status === "completed"
        ) {
          break;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(
            resolve,
            220 * (attempt + 1),
          );
        });
      }

      await loadLists(true);
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setCompleting(false);
      setBusy(false);
    }
  }

  function handleDragStart(
    event:
      DragEvent<HTMLElement>,
    cardId: string,
  ) {
    event.dataTransfer
      .setData(
        "application/x-unknown-pulls-card",
        cardId,
      );

    event.dataTransfer.effectAllowed =
      "copy";
  }

  function handleDrop(
    event:
      DragEvent<HTMLElement>,
  ) {
    event.preventDefault();

    const cardId =
      event.dataTransfer
        .getData(
          "application/x-unknown-pulls-card",
        );

    if (!cardId) {
      return;
    }

    void runTradeAction(
      "add_player_trade_card",
      {
        p_trade_id:
          activeTradeId,
        p_card_id:
          cardId,
      },
    );
  }

  const selfIsInitiator =
    summary?.current_user_id ===
    summary?.initiator_id;

  const selfLocked =
    summary
      ? selfIsInitiator
        ? summary.initiator_locked
        : summary.recipient_locked
      : false;

  const otherLocked =
    summary
      ? selfIsInitiator
        ? summary.recipient_locked
        : summary.initiator_locked
      : false;

  const selfReady =
    summary
      ? selfIsInitiator
        ? summary.initiator_ready
        : summary.recipient_ready
      : false;

  const otherReady =
    summary
      ? selfIsInitiator
        ? summary.recipient_ready
        : summary.initiator_ready
      : false;

  const bothLocked =
    selfLocked &&
    otherLocked;

  const countdownEndsAt =
    summary
      ?.countdown_started_at
      ? new Date(
          summary.countdown_started_at,
        ).getTime() +
        3000
      : 0;

  const countdownMs =
    countdownEndsAt > 0
      ? Math.max(
          0,
          countdownEndsAt -
            now,
        )
      : 0;

  const countdownComplete =
    bothLocked &&
    countdownEndsAt > 0 &&
    countdownMs <= 0;

  const initiatorItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.owner_id ===
            summary?.initiator_id,
        ),
      [
        items,
        summary?.initiator_id,
      ],
    );

  const recipientItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.owner_id ===
            summary?.recipient_id,
        ),
      [
        items,
        summary?.recipient_id,
      ],
    );

  const initiatorValue =
    useMemo(
      () =>
        initiatorItems.reduce(
          (
            total,
            item,
          ) =>
            total +
            toNumber(
              item.market_value,
            ) *
              Math.max(
                1,
                Number(
                  item.quantity,
                ) || 1,
              ),
          0,
        ),
      [initiatorItems],
    );

  const recipientValue =
    useMemo(
      () =>
        recipientItems.reduce(
          (
            total,
            item,
          ) =>
            total +
            toNumber(
              item.market_value,
            ) *
              Math.max(
                1,
                Number(
                  item.quantity,
                ) || 1,
              ),
          0,
        ),
      [recipientItems],
    );

  const filteredInventory =
    useMemo(() => {
      const cleaned =
        search
          .trim()
          .toLowerCase();

      if (!cleaned) {
        return inventory;
      }

      return inventory.filter(
        (card) =>
          [
            card.name,
            card.set_name,
            card.card_no,
            card.rarity,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    cleaned,
                  ),
            ),
      );
    }, [
      inventory,
      search,
    ]);

  const activeTrades =
    inbox.filter(
      (row) =>
        row.status === "open" ||
        row.status ===
          "countdown",
    );

  return (
    <section className="mx-auto w-full max-w-[1760px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Protected card exchange"
        title="Trade Cards"
        description="Exchange cards safely with friends."
      />

      <PlayerErrorBanner
        message={
          errorMessage
        }
        onRetry={() => {
          void loadLists();
          if (
            activeTradeId
          ) {
            void loadTrade(
              activeTradeId,
            );
          }
        }}
      />

      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] px-5 py-4 text-sm font-black text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      {summary ? (
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <PlayerStatCard
            label={
              identityName(
                summary.initiator_display_name,
                summary.initiator_username,
              )
            }
            value={formatMoney(
              initiatorValue,
            )}
            detail={`${initiatorItems.reduce(
              (
                total,
                item,
              ) =>
                total +
                Math.max(
                  1,
                  item.quantity,
                ),
              0,
            )} offered cards`}
            accent="cyan"
          />

          <PlayerStatCard
            label={
              identityName(
                summary.recipient_display_name,
                summary.recipient_username,
              )
            }
            value={formatMoney(
              recipientValue,
            )}
            detail={`${recipientItems.reduce(
              (
                total,
                item,
              ) =>
                total +
                Math.max(
                  1,
                  item.quantity,
                ),
              0,
            )} offered cards`}
            accent="violet"
          />

          <PlayerStatCard
            label="Difference"
            value={formatMoney(
              Math.abs(
                initiatorValue -
                  recipientValue,
              ),
            )}
            detail="Current market-value gap"
            accent="yellow"
          />

          <PlayerStatCard
            label="Trade status"
            value={
              summary.status ===
              "completed"
                ? "Complete"
                : summary.status ===
                    "cancelled"
                  ? "Cancelled"
                  : bothLocked
                    ? countdownComplete
                      ? "Ready"
                      : `${Math.ceil(
                          countdownMs /
                            1000,
                        )}s`
                    : "Building"
            }
            detail={
              summary.status ===
              "completed"
                ? "Collections transferred"
                : bothLocked
                  ? "Both offers are locked"
                  : "Waiting for both confirmations"
            }
            accent={
              summary.status ===
              "completed"
                ? "green"
                : "pink"
            }
          />
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <PlayerPanel>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100/40">
              Trade rooms
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Friends and offers
            </h2>

            <div className="mt-5 space-y-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/30">
                Start a trade
              </p>

              {friends.length ===
              0 ? (
                <PlayerEmptyState
                  title="No friends available"
                  description="Add a friend first, then return here to trade."
                />
              ) : (
                friends.map(
                  (friend) => (
                    <button
                      key={
                        friend.other_user_id
                      }
                      type="button"
                      onClick={() =>
                        void createTrade(
                          friend.other_user_id,
                        )
                      }
                      disabled={busy}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-100/20 hover:bg-white/[0.065] disabled:opacity-40"
                    >
                      <Avatar
                        avatarUrl={
                          friend.avatar_url
                        }
                        name={identityName(
                          friend.display_name,
                          friend.username,
                        )}
                      />

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-white">
                          {identityName(
                            friend.display_name,
                            friend.username,
                          )}
                        </span>

                        <span className="block truncate text-xs font-bold text-white/35">
                          @
                          {friend.username ||
                            "trainer"}
                        </span>
                      </span>
                    </button>
                  ),
                )
              )}

              <div className="my-5 h-px bg-white/10" />

              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/30">
                Active trades
              </p>

              {activeTrades.length ===
              0 ? (
                <p className="rounded-xl border border-white/10 bg-black/15 px-4 py-5 text-center text-xs font-semibold text-white/30">
                  No open trades
                </p>
              ) : (
                activeTrades.map(
                  (trade) => (
                    <button
                      key={
                        trade.trade_id
                      }
                      type="button"
                      onClick={() => {
                        setActiveTradeId(
                          trade.trade_id,
                        );

                        window.history.replaceState(
                          null,
                          "",
                          `/trade?trade=${encodeURIComponent(
                            trade.trade_id,
                          )}`,
                        );

                        void loadTrade(
                          trade.trade_id,
                        );
                      }}
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition",
                        activeTradeId ===
                        trade.trade_id
                          ? "border-cyan-100/25 bg-cyan-200/[0.08]"
                          : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]",
                      ].join(
                        " ",
                      )}
                    >
                      <p className="truncate text-sm font-black text-white">
                        {identityName(
                          trade.display_name,
                          trade.username,
                        )}
                      </p>

                      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/30">
                        {trade.self_locked
                          ? "Your offer locked"
                          : "Offer editable"}
                      </p>
                    </button>
                  ),
                )
              )}
            </div>
          </div>
        </PlayerPanel>

        <div className="min-w-0">
          {!activeTradeId ? (
            <PlayerPanel>
              <div className="p-8">
                <PlayerEmptyState
                  title="Choose a friend"
                  description="Start a protected trade from the friend list on the left."
                />
              </div>
            </PlayerPanel>
          ) : tradeLoading &&
            !summary ? (
            <PlayerPanel>
              <div className="py-24 text-center font-black text-white/45">
                Opening trade room...
              </div>
            </PlayerPanel>
          ) : summary ? (
            <>
              <section className="grid gap-5 2xl:grid-cols-2">
                <OfferColumn
                  title={identityName(
                    summary.initiator_display_name,
                    summary.initiator_username,
                  )}
                  username={
                    summary.initiator_username
                  }
                  avatarUrl={
                    summary.initiator_avatar_url
                  }
                  value={
                    initiatorValue
                  }
                  items={
                    initiatorItems
                  }
                  ownSide={
                    summary.current_user_id ===
                    summary.initiator_id
                  }
                  locked={
                    summary.initiator_locked
                  }
                  ready={
                    summary.initiator_ready
                  }
                  tradeClosed={
                    summary.status ===
                      "completed" ||
                    summary.status ===
                      "cancelled"
                  }
                  onDrop={
                    handleDrop
                  }
                  onRemove={(
                    cardId,
                  ) =>
                    void runTradeAction(
                      "remove_player_trade_card",
                      {
                        p_trade_id:
                          activeTradeId,
                        p_card_id:
                          cardId,
                      },
                    )
                  }
                />

                <OfferColumn
                  title={identityName(
                    summary.recipient_display_name,
                    summary.recipient_username,
                  )}
                  username={
                    summary.recipient_username
                  }
                  avatarUrl={
                    summary.recipient_avatar_url
                  }
                  value={
                    recipientValue
                  }
                  items={
                    recipientItems
                  }
                  ownSide={
                    summary.current_user_id ===
                    summary.recipient_id
                  }
                  locked={
                    summary.recipient_locked
                  }
                  ready={
                    summary.recipient_ready
                  }
                  tradeClosed={
                    summary.status ===
                      "completed" ||
                    summary.status ===
                      "cancelled"
                  }
                  onDrop={
                    handleDrop
                  }
                  onRemove={(
                    cardId,
                  ) =>
                    void runTradeAction(
                      "remove_player_trade_card",
                      {
                        p_trade_id:
                          activeTradeId,
                        p_card_id:
                          cardId,
                      },
                    )
                  }
                />
              </section>

              <PlayerPanel className="mt-5">
                <div className="p-5 sm:p-7">
                  {summary.status ===
                  "completed" ? (
                    <div className="rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] p-6 text-center">
                      <p className="text-2xl font-black text-emerald-100">
                        Trade complete
                      </p>

                      <p className="mt-2 text-sm font-semibold text-white/45">
                        Both collections were transferred in one protected database transaction.
                      </p>
                    </div>
                  ) : summary.status ===
                    "cancelled" ? (
                    <div className="rounded-2xl border border-red-200/15 bg-red-400/[0.07] p-6 text-center">
                      <p className="text-2xl font-black text-red-100">
                        Trade cancelled
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                          Two-step confirmation
                        </p>

                        <p className="mt-2 text-lg font-black text-white">
                          {!selfLocked
                            ? "Step 1: confirm and lock your offer"
                            : !otherLocked
                              ? "Your offer is locked. Waiting for the other trainer."
                              : !countdownComplete
                                ? `Safety countdown: ${Math.ceil(
                                    countdownMs /
                                      1000,
                                  )}`
                                : selfReady
                                  ? "You pressed Trade. Waiting for the other trainer."
                                  : otherReady
                                    ? "The other trainer pressed Trade. Your final press completes it."
                                    : "Step 2: both trainers must press Trade"}
                        </p>

                        <p className="mt-2 text-sm font-semibold text-white/40">
                          Editing either offer clears both locks, forcing both trainers to review the new values again.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {!selfLocked ? (
                          <PlayerPrimaryButton
                            onClick={() =>
                              void runTradeAction(
                                "set_player_trade_locked",
                                {
                                  p_trade_id:
                                    activeTradeId,
                                  p_locked:
                                    true,
                                },
                              )
                            }
                            disabled={
                              busy
                            }
                          >
                            I confirm this offer
                          </PlayerPrimaryButton>
                        ) : !bothLocked ? (
                          <PlayerSecondaryButton
                            onClick={() =>
                              void runTradeAction(
                                "set_player_trade_locked",
                                {
                                  p_trade_id:
                                    activeTradeId,
                                  p_locked:
                                    false,
                                },
                              )
                            }
                            disabled={
                              busy
                            }
                          >
                            Unlock my offer
                          </PlayerSecondaryButton>
                        ) : countdownComplete ? (
                          <>
                            <PlayerPrimaryButton
                              onClick={() =>
                                void runTradeAction(
                                  "set_player_trade_ready",
                                  {
                                    p_trade_id:
                                      activeTradeId,
                                  },
                                )
                              }
                              disabled={
                                busy ||
                                selfReady
                              }
                            >
                              {completing
                                ? otherReady
                                  ? "Completing trade..."
                                  : "Saving confirmation..."
                                : selfReady
                                  ? "Trade pressed"
                                  : otherReady
                                    ? "Complete trade"
                                    : "Trade"}
                            </PlayerPrimaryButton>

                            {!selfReady ? (
                              <PlayerSecondaryButton
                                onClick={() =>
                                  void runTradeAction(
                                    "set_player_trade_locked",
                                    {
                                      p_trade_id:
                                        activeTradeId,
                                      p_locked:
                                        false,
                                    },
                                  )
                                }
                                disabled={
                                  busy
                                }
                              >
                                Unlock and edit
                              </PlayerSecondaryButton>
                            ) : null}
                          </>
                        ) : (
                          <div className="min-w-40 rounded-xl border border-yellow-100/20 bg-yellow-200/[0.08] px-5 py-3 text-center font-black text-yellow-100">
                            {Math.ceil(
                              countdownMs /
                                1000,
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void runTradeAction(
                              "cancel_player_trade",
                              {
                                p_trade_id:
                                  activeTradeId,
                              },
                            )
                          }
                          disabled={
                            busy ||
                            selfReady
                          }
                          className="min-h-12 rounded-xl border border-red-200/15 bg-red-400/[0.07] px-5 text-sm font-black text-red-100 disabled:opacity-40"
                        >
                          Cancel trade
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </PlayerPanel>

              {summary.status !==
                "completed" &&
              summary.status !==
                "cancelled" ? (
                <PlayerPanel className="mt-5">
                  <div className="p-5 sm:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
                          Your available collection
                        </p>

                        <h2 className="mt-2 text-2xl font-black text-white">
                          Drag cards into your offer
                        </h2>
                      </div>

                      <input
                        value={search}
                        onChange={(
                          event,
                        ) =>
                          setSearch(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Search your cards..."
                        className="min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-bold text-white outline-none placeholder:text-white/25 focus:border-cyan-100/25 sm:max-w-sm"
                      />
                    </div>

                    {selfLocked ? (
                      <div className="mt-5 rounded-xl border border-yellow-100/15 bg-yellow-200/[0.06] px-4 py-3 text-sm font-semibold text-yellow-100/70">
                        Unlock your offer before adding or removing cards.
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {filteredInventory.length ===
                      0 ? (
                        <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-4">
                          <PlayerEmptyState
                            title="No available cards"
                            description="Cards already reserved by a trade or shipping request are not shown."
                          />
                        </div>
                      ) : (
                        filteredInventory.map(
                          (card) => (
                            <InventoryCardTile
                              key={
                                card.card_id
                              }
                              card={card}
                              disabled={
                                busy ||
                                selfLocked
                              }
                              onDragStart={
                                handleDragStart
                              }
                              onAdd={() =>
                                void runTradeAction(
                                  "add_player_trade_card",
                                  {
                                    p_trade_id:
                                      activeTradeId,
                                    p_card_id:
                                      card.card_id,
                                  },
                                )
                              }
                            />
                          ),
                        )
                      )}
                    </div>
                  </div>
                </PlayerPanel>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function Avatar({
  avatarUrl,
  name,
}: {
  avatarUrl:
    | string
    | null;
  name: string;
}) {
  return (
    <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 font-black text-white">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initial(
          name,
        )
      )}
    </div>
  );
}

function OfferColumn({
  title,
  username,
  avatarUrl,
  value,
  items,
  ownSide,
  locked,
  ready,
  tradeClosed,
  onDrop,
  onRemove,
}: {
  title: string;
  username:
    | string
    | null;
  avatarUrl:
    | string
    | null;
  value: number;
  items: TradeItem[];
  ownSide: boolean;
  locked: boolean;
  ready: boolean;
  tradeClosed: boolean;
  onDrop: (
    event:
      DragEvent<HTMLElement>,
  ) => void;
  onRemove: (
    cardId: string,
  ) => void;
}) {
  return (
    <PlayerPanel>
      <div
        onDragOver={(
          event,
        ) => {
          if (
            ownSide &&
            !locked &&
            !tradeClosed
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect =
              "copy";
          }
        }}
        onDrop={(
          event,
        ) => {
          if (
            ownSide &&
            !locked &&
            !tradeClosed
          ) {
            onDrop(event);
          }
        }}
        className="min-h-[31rem] p-5 sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              avatarUrl={
                avatarUrl
              }
              name={title}
            />

            <div className="min-w-0">
              <p className="truncate text-lg font-black text-white">
                {title}
              </p>

              <p className="truncate text-xs font-bold text-white/35">
                @{username ||
                  "trainer"}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-black text-cyan-100">
              {formatMoney(
                value,
              )}
            </p>

            <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/30">
              Market value
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-black",
              locked
                ? "border-yellow-100/20 bg-yellow-200/[0.08] text-yellow-100"
                : "border-white/10 bg-white/[0.04] text-white/35",
            ].join(
              " ",
            )}
          >
            {locked
              ? "Offer locked"
              : "Offer editable"}
          </span>

          {ready ? (
            <span className="rounded-full border border-emerald-100/20 bg-emerald-200/[0.08] px-3 py-1.5 text-xs font-black text-emerald-100">
              Trade pressed
            </span>
          ) : null}
        </div>

        <div
          className={[
            "mt-5 min-h-[21rem] rounded-[1.5rem] border border-dashed p-3 transition",
            ownSide &&
            !locked &&
            !tradeClosed
              ? "border-cyan-100/25 bg-cyan-200/[0.025]"
              : "border-white/10 bg-black/10",
          ].join(
            " ",
          )}
        >
          {items.length ===
          0 ? (
            <div className="flex min-h-[19rem] items-center justify-center px-6 text-center">
              <div>
                <p className="text-lg font-black text-white/55">
                  {ownSide
                    ? "Drop cards here"
                    : "Waiting for cards"}
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-white/28">
                  {ownSide
                    ? "Drag from your available collection below, or use the Add button on mobile."
                    : "The other trainer has not added a card yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map(
                (item) => (
                  <article
                    key={
                      `${item.owner_id}:${item.card_id}`
                    }
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-28 w-20 flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        {item.image_url ? (
                          <img
                            src={
                              item.image_url
                            }
                            alt={
                              item.name
                            }
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-3xl">
                            🎴
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-black text-white">
                          {item.name}
                        </p>

                        <p className="mt-1 truncate text-xs font-semibold text-white/35">
                          {item.set_name ||
                            "Unknown set"}
                          {item.card_no
                            ? ` · #${item.card_no}`
                            : ""}
                        </p>

                        <div className="mt-3">
                          <RarityPill
                            rarity={
                              item.rarity ||
                              "Common"
                            }
                          />
                        </div>

                        <p className="mt-3 font-black text-cyan-100">
                          {formatMarketValue(
                            toNumber(
                              item.market_value,
                            ) *
                              Math.max(
                                1,
                                item.quantity,
                              ),
                          )}
                        </p>
                      </div>
                    </div>

                    {item.quantity >
                    1 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-cyan-100 px-2 py-1 text-[0.65rem] font-black text-[#111329]">
                        x
                        {item.quantity}
                      </span>
                    ) : null}

                    {ownSide &&
                    !locked &&
                    !tradeClosed ? (
                      <button
                        type="button"
                        onClick={() =>
                          onRemove(
                            item.card_id,
                          )
                        }
                        className="mt-3 min-h-10 w-full rounded-xl border border-red-200/15 bg-red-400/[0.06] text-xs font-black text-red-100"
                      >
                        Remove one
                      </button>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </PlayerPanel>
  );
}

function InventoryCardTile({
  card,
  disabled,
  onDragStart,
  onAdd,
}: {
  card: InventoryCard;
  disabled: boolean;
  onDragStart: (
    event:
      DragEvent<HTMLElement>,
    cardId: string,
  ) => void;
  onAdd: () => void;
}) {
  return (
    <article
      draggable={
        !disabled
      }
      onDragStart={(
        event,
      ) =>
        onDragStart(
          event,
          card.card_id,
        )
      }
      className={[
        "group rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-grab hover:-translate-y-0.5 hover:border-cyan-100/20 hover:bg-white/[0.06] active:cursor-grabbing",
      ].join(
        " ",
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-32 w-24 flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
          {card.image_url ? (
            <img
              src={
                card.image_url
              }
              alt={
                card.name
              }
              className="h-full w-full object-contain p-1 transition group-hover:scale-105"
            />
          ) : (
            <span className="text-3xl">
              🎴
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-black text-white">
            {card.name}
          </p>

          <p className="mt-1 truncate text-xs font-semibold text-white/35">
            {card.set_name ||
              "Unknown set"}
            {card.card_no
              ? ` · #${card.card_no}`
              : ""}
          </p>

          <p className="mt-3 text-sm font-black text-cyan-100">
            {formatMarketValue(
              toNumber(
                card.market_value,
              ),
            )}
          </p>

          <p className="mt-1 text-xs font-bold text-white/30">
            {card.available_quantity} available
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-3 min-h-10 w-full rounded-xl border border-cyan-100/20 bg-cyan-200/[0.08] text-xs font-black text-cyan-50 transition hover:bg-cyan-200/[0.14] disabled:opacity-40"
      >
        Add one to trade
      </button>
    </article>
  );
}
