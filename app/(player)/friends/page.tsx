"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
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
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";

type FriendRow = {
  friendship_id:
    | string
    | null;
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
  relationship_status:
    | "pending"
    | "accepted"
    | "blocked";
  direction:
    | "incoming"
    | "outgoing"
    | "accepted"
    | "blocked";
  blocked_by_me: boolean;
  online: boolean;
  last_seen_at:
    | string
    | null;
  created_at: string;
};

type SearchRow = {
  user_id: string;
  trainer_code: string;
  username:
    | string
    | null;
  display_name:
    | string
    | null;
  avatar_url:
    | string
    | null;
  relationship_status:
    | "none"
    | "pending"
    | "accepted"
    | "blocked";
  direction:
    | "none"
    | "incoming"
    | "outgoing"
    | "accepted"
    | "blocked";
  friendship_id:
    | string
    | null;
  online: boolean;
  last_seen_at:
    | string
    | null;
};

type PlayerSearchResponse = {
  ok: true;
  query: string;
  results: SearchRow[];
  selfMatch: boolean;
  directoryCount: number;
};

type ViewMode =
  | "friends"
  | "incoming"
  | "sent"
  | "blocked";

type PlayerRpcResult = {
  data: unknown;
  error: unknown;
};

type PlayerRpcClient = {
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): PromiseLike<PlayerRpcResult>;
};

const playerRpcClient =
  supabase as unknown as PlayerRpcClient;

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

  return "The friend system could not complete that request.";
}

function normaliseFriendQuery(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /^@+/,
      "",
    )
    .trim()
    .slice(
      0,
      80,
    );
}

async function searchPlayerDirectory(
  query: string,
): Promise<PlayerSearchResponse> {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getSession();

  if (
    error ||
    !data.session
  ) {
    throw new Error(
      "Your player session expired. Sign in again.",
    );
  }

  const response =
    await fetch(
      `/api/player/friends/search?q=${encodeURIComponent(
        normaliseFriendQuery(
          query,
        ),
      )}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${data.session.access_token}`,
        },
        cache: "no-store",
      },
    );

  const payload =
    (await response.json()) as
      | PlayerSearchResponse
      | {
          ok: false;
          error?: {
            message?: string;
          };
        };

  if (
    !response.ok ||
    payload.ok !== true
  ) {
    throw new Error(
      payload.ok === false
        ? payload.error
            ?.message ||
          "Player search failed."
        : "Player search failed.",
    );
  }

  return payload;
}

function getInitial(
  value: string,
): string {
  const trimmed =
    value.trim();

  return trimmed
    ? trimmed
        .charAt(0)
        .toUpperCase()
    : "T";
}

function formatPresence(
  row: {
    online: boolean;
    last_seen_at:
      | string
      | null;
  },
): string {
  if (row.online) {
    return "Online now";
  }

  if (!row.last_seen_at) {
    return "No recent activity";
  }

  const date =
    new Date(
      row.last_seen_at,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Recently active";
  }

  return `Last seen ${new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date)}`;
}

export default function FriendsPage() {
  const [
    friends,
    setFriends,
  ] =
    useState<FriendRow[]>([]);

  const [
    searchResults,
    setSearchResults,
  ] =
    useState<SearchRow[]>([]);

  const [
    viewMode,
    setViewMode,
  ] =
    useState<ViewMode>(
      "friends",
    );

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    selfMatch,
    setSelfMatch,
  ] =
    useState(false);

  const [
    directoryCount,
    setDirectoryCount,
  ] =
    useState(0);

  const [
    searchRefresh,
    setSearchRefresh,
  ] =
    useState(0);

  const [
    busyKey,
    setBusyKey,
  ] =
    useState<string | null>(
      null,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const loadFriends =
    useCallback(
      async (
        background =
          false,
      ) => {
        if (!background) {
          setLoading(true);
        }

        setErrorMessage(null);

        try {
          await playerRpcClient.rpc(
            "touch_player_presence",
          );

          const {
            data,
            error,
          } =
            await playerRpcClient.rpc(
              "get_player_friend_dashboard",
            );

          if (error) {
            throw error;
          }

          setFriends(
            Array.isArray(data)
              ? (
                  data as
                    FriendRow[]
                )
              : [],
          );
        } catch (
          error: unknown
        ) {
          console.error(
            "Friend dashboard error:",
            error,
          );

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

  useEffect(() => {
    void loadFriends();

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadFriends(
              true,
            );
          }
        },
        30000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [loadFriends]);

  useEffect(() => {
    let active = true;

    const cleaned =
      normaliseFriendQuery(
        query,
      );

    if (!cleaned) {
      setSearchResults([]);
      setSelfMatch(false);
      setDirectoryCount(0);
      setSearching(false);
      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          setSearching(true);

          try {
            const response =
              await searchPlayerDirectory(
                cleaned,
              );

            if (!active) {
              return;
            }

            setSearchResults(
              response.results,
            );

            setSelfMatch(
              response.selfMatch,
            );

            setDirectoryCount(
              response.directoryCount,
            );
          } catch (
            searchError: unknown
          ) {
            if (!active) {
              return;
            }

            setSearchResults([]);
            setSelfMatch(false);

            setErrorMessage(
              getErrorMessage(
                searchError,
              ),
            );
          } finally {
            if (active) {
              setSearching(false);
            }
          }
        },
        180,
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer,
      );
    };
  }, [
    query,
    searchRefresh,
  ]);

  const counts =
    useMemo(
      () => ({
        friends:
          friends.filter(
            (row) =>
              row.relationship_status ===
              "accepted",
          ).length,

        incoming:
          friends.filter(
            (row) =>
              row.relationship_status ===
                "pending" &&
              row.direction ===
                "incoming",
          ).length,

        sent:
          friends.filter(
            (row) =>
              row.relationship_status ===
                "pending" &&
              row.direction ===
                "outgoing",
          ).length,

        blocked:
          friends.filter(
            (row) =>
              row.relationship_status ===
                "blocked" &&
              row.blocked_by_me,
          ).length,
      }),
      [friends],
    );

  const visibleFriends =
    useMemo(
      () =>
        friends.filter(
          (row) => {
            if (
              viewMode ===
              "friends"
            ) {
              return (
                row.relationship_status ===
                "accepted"
              );
            }

            if (
              viewMode ===
              "incoming"
            ) {
              return (
                row.relationship_status ===
                  "pending" &&
                row.direction ===
                  "incoming"
              );
            }

            if (
              viewMode ===
              "sent"
            ) {
              return (
                row.relationship_status ===
                  "pending" &&
                row.direction ===
                  "outgoing"
              );
            }

            return (
              row.relationship_status ===
                "blocked" &&
              row.blocked_by_me
            );
          },
        ),
      [
        friends,
        viewMode,
      ],
    );

  async function runAction(
    key: string,
    functionName: string,
    args:
      | Record<
          string,
          unknown
        >
      | undefined,
  ) {
    if (busyKey) {
      return;
    }

    setBusyKey(key);
    setErrorMessage(null);

    try {
      const {
        error,
      } =
        await playerRpcClient.rpc(
          functionName,
          args,
        );

      if (error) {
        throw error;
      }

      setQuery("");
      setSearchResults([]);
      setSelfMatch(false);

      await loadFriends(
        true,
      );

      setSearchRefresh(
        (current) =>
          current + 1,
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
      setBusyKey(null);
    }
  }

  const tabs: Array<{
    value: ViewMode;
    label: string;
    count: number;
  }> = [
    {
      value: "friends",
      label: "Friends",
      count: counts.friends,
    },
    {
      value: "incoming",
      label: "Requests",
      count: counts.incoming,
    },
    {
      value: "sent",
      label: "Sent",
      count: counts.sent,
    },
    {
      value: "blocked",
      label: "Blocked",
      count: counts.blocked,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1760px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="Trainer connections"
        title="Friends"
        description="Search by Trainer ID or username, manage requests and open your friends’ trainer profiles."
      />

      <PlayerErrorBanner
        message={
          errorMessage
        }
        onRetry={() => {
          void loadFriends();
        }}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <PlayerStatCard
          label="Friends"
          value={String(
            counts.friends,
          )}
          detail="Accepted trainers"
          accent="cyan"
        />

        <PlayerStatCard
          label="Incoming"
          value={String(
            counts.incoming,
          )}
          detail="Waiting for you"
          accent="yellow"
        />

        <PlayerStatCard
          label="Sent"
          value={String(
            counts.sent,
          )}
          detail="Awaiting reply"
          accent="violet"
        />

        <PlayerStatCard
          label="Online"
          value={String(
            friends.filter(
              (row) =>
                row.relationship_status ===
                  "accepted" &&
                row.online,
            ).length,
          )}
          detail="Active in the last five minutes"
          accent="green"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <PlayerPanel>
          <div className="p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
              Find a trainer
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Search trainers
            </h2>

            <div className="relative mt-5">
              <input
                value={query}
                onChange={(
                  event,
                ) =>
                  setQuery(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Trainer ID or username..."
                className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 pr-14 font-bold text-white outline-none placeholder:text-white/25 focus:border-cyan-200/30"
              />

              {searching ? (
                <span className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-cyan-100">
                  ◌
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-xs font-semibold leading-5 text-white/32">
              Nothing is shown until you search. Use a Trainer ID such as UP-1234-ABCD-5678 or a username; @ is optional.
            </p>

            <div className="mt-4 space-y-3">
              {searchResults.length === 0 && !searching ? (
                <PlayerEmptyState
                  title={
                    selfMatch
                      ? "That is your own account"
                      : query.trim()
                        ? "No trainers found"
                        : "Search when you are ready"
                  }
                  description={
                    selfMatch
                      ? "You cannot send a friend request to the account you are currently signed into."
                      : query.trim()
                        ? "Check the Trainer ID or username and try again."
                        : "Your player directory stays private until you enter a Trainer ID or username."
                  }
                />
              ) : (
                searchResults.map(
                  (row) => (
                    <SearchResultCard
                      key={
                        row.user_id
                      }
                      row={row}
                      busy={
                        busyKey ===
                        `search:${row.user_id}`
                      }
                      onSend={() =>
                        void runAction(
                          `search:${row.user_id}`,
                          "send_friend_request",
                          {
                            p_target_user_id:
                              row.user_id,
                          },
                        )
                      }
                      onAccept={() =>
                        void runAction(
                          `search:${row.user_id}`,
                          "respond_friend_request",
                          {
                            p_friendship_id:
                              row.friendship_id,
                            p_accept:
                              true,
                          },
                        )
                      }
                      onUnblock={() =>
                        void runAction(
                          `search:${row.user_id}`,
                          "unblock_player",
                          {
                            p_target_user_id:
                              row.user_id,
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

        <PlayerPanel>
          <div className="border-b border-white/10 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tabs.map(
                (tab) => (
                  <button
                    key={
                      tab.value
                    }
                    type="button"
                    onClick={() =>
                      setViewMode(
                        tab.value,
                      )
                    }
                    className={[
                      "min-h-12 rounded-xl border px-3 text-sm font-black transition",
                      viewMode ===
                      tab.value
                        ? "border-cyan-100/25 bg-cyan-200/[0.1] text-cyan-50"
                        : "border-white/10 bg-white/[0.035] text-white/45 hover:bg-white/[0.07] hover:text-white",
                    ].join(
                      " ",
                    )}
                  >
                    {tab.label}
                    <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[0.65rem]">
                      {tab.count}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {loading ? (
              <div className="py-20 text-center font-black text-white/45">
                Loading friends...
              </div>
            ) : visibleFriends.length ===
              0 ? (
              <PlayerEmptyState
                title={
                  viewMode ===
                  "friends"
                    ? "No friends yet"
                    : viewMode ===
                        "incoming"
                      ? "No incoming requests"
                      : viewMode ===
                          "sent"
                        ? "No sent requests"
                        : "No blocked trainers"
                }
                description={
                  viewMode ===
                  "friends"
                    ? "Search for another trainer to start building your friend list."
                    : "This section is currently empty."
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleFriends.map(
                  (row) => (
                    <FriendCard
                      key={
                        row.friendship_id ||
                        row.other_user_id
                      }
                      row={row}
                      busy={
                        busyKey ===
                        `friend:${row.other_user_id}`
                      }
                      onAccept={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "respond_friend_request",
                          {
                            p_friendship_id:
                              row.friendship_id,
                            p_accept:
                              true,
                          },
                        )
                      }
                      onDecline={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "respond_friend_request",
                          {
                            p_friendship_id:
                              row.friendship_id,
                            p_accept:
                              false,
                          },
                        )
                      }
                      onCancel={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "cancel_friend_request",
                          {
                            p_friendship_id:
                              row.friendship_id,
                          },
                        )
                      }
                      onRemove={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "remove_friend",
                          {
                            p_friendship_id:
                              row.friendship_id,
                          },
                        )
                      }
                      onBlock={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "block_player",
                          {
                            p_target_user_id:
                              row.other_user_id,
                          },
                        )
                      }
                      onUnblock={() =>
                        void runAction(
                          `friend:${row.other_user_id}`,
                          "unblock_player",
                          {
                            p_target_user_id:
                              row.other_user_id,
                          },
                        )
                      }
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </PlayerPanel>
      </section>
    </main>
  );
}

function TrainerIdentity({
  username,
  displayName,
  avatarUrl,
  online,
  presence,
}: {
  username:
    | string
    | null;
  displayName:
    | string
    | null;
  avatarUrl:
    | string
    | null;
  online: boolean;
  presence: string;
}) {
  const resolvedName =
    displayName?.trim() ||
    username?.trim() ||
    "Trainer";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full border border-violet-200/20 bg-violet-300/10 font-black text-white">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          getInitial(
            resolvedName,
          )
        )}

        <span
          className={[
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#090b27]",
            online
              ? "bg-emerald-300"
              : "bg-slate-500",
          ].join(" ")}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate font-black text-white">
          {resolvedName}
        </p>

        <p className="truncate text-xs font-bold text-violet-100/45">
          @{username || "trainer"}
        </p>

        <p className="mt-1 truncate text-[0.65rem] font-semibold text-white/30">
          {presence}
        </p>
      </div>
    </div>
  );
}

function SearchResultCard({
  row,
  busy,
  onSend,
  onAccept,
  onUnblock,
}: {
  row: SearchRow;
  busy: boolean;
  onSend: () => void;
  onAccept: () => void;
  onUnblock: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <TrainerIdentity
        username={row.username}
        displayName={
          row.display_name
        }
        avatarUrl={
          row.avatar_url
        }
        online={row.online}
        presence={formatPresence(
          row,
        )}
      />

      <p className="mt-3 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-cyan-100/38">
        Trainer ID · {row.trainer_code || "Pending"}
      </p>

      <div className="mt-4">
        {row.relationship_status ===
        "none" ? (
          <PlayerPrimaryButton
            onClick={onSend}
            disabled={busy}
            className="w-full"
          >
            {busy
              ? "Sending..."
              : "Add friend"}
          </PlayerPrimaryButton>
        ) : row.relationship_status ===
            "pending" &&
          row.direction ===
            "incoming" ? (
          <PlayerPrimaryButton
            onClick={onAccept}
            disabled={busy}
            className="w-full"
          >
            Accept request
          </PlayerPrimaryButton>
        ) : row.relationship_status ===
            "blocked" &&
          row.direction ===
            "blocked" ? (
          <PlayerSecondaryButton
            onClick={onUnblock}
            disabled={busy}
            className="w-full"
          >
            Unblock
          </PlayerSecondaryButton>
        ) : row.relationship_status === "accepted" ? (
          <Link
            href={`/friends/${encodeURIComponent(row.user_id)}`}
            className="flex min-h-11 items-center justify-center rounded-xl border border-violet-200/18 bg-violet-300/[0.08] px-4 text-sm font-black text-violet-50 transition hover:bg-violet-300/[0.14]"
          >
            View friend profile
          </Link>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white/40">
            Request pending
          </div>
        )}
      </div>
    </article>
  );
}

function FriendCard({
  row,
  busy,
  onAccept,
  onDecline,
  onCancel,
  onRemove,
  onBlock,
  onUnblock,
}: {
  row: FriendRow;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <TrainerIdentity
        username={row.username}
        displayName={
          row.display_name
        }
        avatarUrl={
          row.avatar_url
        }
        online={row.online}
        presence={formatPresence(
          row,
        )}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {row.relationship_status ===
        "accepted" ? (
          <>
            <Link
              href={`/friends/${encodeURIComponent(row.other_user_id)}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-violet-200/20 bg-violet-300/[0.08] px-4 text-sm font-black text-violet-50 transition hover:bg-violet-300/[0.14]"
            >
              View profile
            </Link>

            <Link
              href={`/trade?friend=${encodeURIComponent(
                row.other_user_id,
              )}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-200/[0.1] px-4 text-sm font-black text-cyan-50 transition hover:bg-cyan-200/[0.16]"
            >
              Trade cards
            </Link>

            <PlayerSecondaryButton
              onClick={onRemove}
              disabled={busy}
              className="flex-1"
            >
              Remove
            </PlayerSecondaryButton>

            <button
              type="button"
              onClick={onBlock}
              disabled={busy}
              className="min-h-11 rounded-xl border border-red-200/15 bg-red-400/[0.07] px-4 text-xs font-black text-red-100 disabled:opacity-40"
            >
              Block
            </button>
          </>
        ) : row.relationship_status ===
            "pending" &&
          row.direction ===
            "incoming" ? (
          <>
            <PlayerPrimaryButton
              onClick={onAccept}
              disabled={busy}
              className="flex-1"
            >
              Accept
            </PlayerPrimaryButton>

            <PlayerSecondaryButton
              onClick={onDecline}
              disabled={busy}
              className="flex-1"
            >
              Decline
            </PlayerSecondaryButton>
          </>
        ) : row.relationship_status ===
            "pending" &&
          row.direction ===
            "outgoing" ? (
          <PlayerSecondaryButton
            onClick={onCancel}
            disabled={busy}
            className="w-full"
          >
            Cancel request
          </PlayerSecondaryButton>
        ) : (
          <PlayerSecondaryButton
            onClick={onUnblock}
            disabled={busy}
            className="w-full"
          >
            Unblock trainer
          </PlayerSecondaryButton>
        )}
      </div>
    </article>
  );
}
