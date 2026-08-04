import {
  createClient,
  type User,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  is_banned: boolean;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  blocked_by: string | null;
};

type SearchResult = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
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
  friendship_id: string | null;
  online: boolean;
  last_seen_at: string | null;
};

type DatabaseError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type LooseResult = {
  data: unknown;
  error: DatabaseError | null;
};

type LooseQuery = PromiseLike<LooseResult> & {
  select(columns?: string): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  in(column: string, values: readonly unknown[]): LooseQuery;
  or(filters: string): LooseQuery;
  limit(count: number): LooseQuery;
  maybeSingle(): Promise<LooseResult>;
  upsert(
    values:
      | Record<string, unknown>
      | readonly Record<string, unknown>[],
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
    },
  ): LooseQuery;
};

type LooseDatabaseClient = {
  from(table: string): LooseQuery;
};

type ServiceClient = ReturnType<
  typeof createClient
>;

const MAX_AUTH_USERS = 1000;
const AUTH_PAGE_SIZE = 200;
const PROFILE_BATCH_SIZE = 150;
const RESULT_LIMIT = 20;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function requireEnvironment(
  names: string[],
): string {
  for (const name of names) {
    const value = process.env[name];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  throw new Error(
    `Missing server environment value: ${names.join(
      " or ",
    )}.`,
  );
}

function getServiceClient(): ServiceClient {
  const url = requireEnvironment([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  ]);

  const serviceKey = requireEnvironment([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/*
 * Database schema generation has changed several times during development.
 * Keep the unsafe boundary in one place and parse every returned row below.
 * This prevents Supabase's ungenerated schema from narrowing inserts to never[].
 */
function getDatabaseClient(
  service: ServiceClient,
): LooseDatabaseClient {
  return service as unknown as LooseDatabaseClient;
}

function getBearerToken(
  request: Request,
): string {
  const authorization =
    request.headers.get("authorization") || "";

  const match = authorization.match(
    /^Bearer\s+(.+)$/i,
  );

  const token = match?.[1]?.trim();

  if (!token) {
    throw new Error(
      "Your player session is missing. Sign in again.",
    );
  }

  return token;
}

function normaliseQuery(
  value: string | null,
): string {
  return (value || "")
    .trim()
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

function cleanUsernamePart(
  value: string,
): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "trainer";
}

function getEmailPrefix(
  user: User,
): string {
  return (
    user.email
      ?.split("@")[0]
      ?.trim()
      .toLowerCase() || ""
  );
}

function getMetadataString(
  user: User,
  keys: string[],
): string {
  const metadata = user.user_metadata || {};

  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function buildMissingProfile(
  user: User,
): ProfileRow {
  const emailPrefix = getEmailPrefix(user);
  const metadataUsername = getMetadataString(
    user,
    ["username"],
  );

  const usernameBase = cleanUsernamePart(
    metadataUsername ||
      emailPrefix ||
      "trainer",
  );

  const suffix = user.id
    .replace(/-/g, "")
    .slice(0, 12);

  const displayName =
    getMetadataString(user, [
      "display_name",
      "full_name",
      "name",
    ]) ||
    emailPrefix ||
    "Unknown Trainer";

  const avatarUrl =
    getMetadataString(user, [
      "avatar_url",
      "picture",
    ]) || null;

  return {
    user_id: user.id,
    username: `${usernameBase.slice(
      0,
      11,
    )}_${suffix}`,
    display_name: displayName.slice(
      0,
      60,
    ),
    avatar_url: avatarUrl,
    last_seen_at: null,
    is_banned: false,
  };
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  );
}

function readString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function parseProfileRow(
  value: unknown,
): ProfileRow | null {
  const row = asRecord(value);
  const userId = readString(row?.user_id);

  if (!row || !userId) {
    return null;
  }

  return {
    user_id: userId,
    username: readString(row.username),
    display_name: readString(
      row.display_name,
    ),
    avatar_url: readString(row.avatar_url),
    last_seen_at: readString(
      row.last_seen_at,
    ),
    is_banned: row.is_banned === true,
  };
}

function parseFriendshipRow(
  value: unknown,
): FriendshipRow | null {
  const row = asRecord(value);

  if (!row) {
    return null;
  }

  const id = readString(row.id);
  const requesterId = readString(
    row.requester_id,
  );
  const addresseeId = readString(
    row.addressee_id,
  );
  const status = readString(row.status);

  if (
    !id ||
    !requesterId ||
    !addresseeId ||
    !status ||
    ![
      "pending",
      "accepted",
      "blocked",
    ].includes(status)
  ) {
    return null;
  }

  return {
    id,
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: status as FriendshipRow["status"],
    blocked_by: readString(row.blocked_by),
  };
}

function databaseError(
  error: DatabaseError,
  fallback: string,
): Error {
  return new Error(
    readString(error.message) || fallback,
  );
}

function chunk<T>(
  values: T[],
  size: number,
): T[][] {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size),
    );
  }

  return chunks;
}

async function listAuthUsers(
  service: ServiceClient,
): Promise<User[]> {
  const users: User[] = [];

  for (
    let page = 1;
    users.length < MAX_AUTH_USERS;
    page += 1
  ) {
    const { data, error } =
      await service.auth.admin.listUsers({
        page,
        perPage: AUTH_PAGE_SIZE,
      });

    if (error) {
      throw error;
    }

    const pageUsers = Array.isArray(
      data.users,
    )
      ? data.users
      : [];

    users.push(...pageUsers);

    if (
      pageUsers.length < AUTH_PAGE_SIZE
    ) {
      break;
    }
  }

  return users.slice(0, MAX_AUTH_USERS);
}

async function loadProfiles(
  database: LooseDatabaseClient,
  userIds: string[],
): Promise<ProfileRow[]> {
  const profiles: ProfileRow[] = [];

  for (const batch of chunk(
    userIds,
    PROFILE_BATCH_SIZE,
  )) {
    const fullResult =
      await database
        .from("player_profiles")
        .select(
          "user_id,username,display_name,avatar_url,last_seen_at,is_banned",
        )
        .in("user_id", batch);

    let rawData = fullResult.data;

    if (fullResult.error) {
      const fallbackResult =
        await database
          .from("player_profiles")
          .select(
            "user_id,username,display_name,avatar_url",
          )
          .in("user_id", batch);

      if (fallbackResult.error) {
        throw databaseError(
          fallbackResult.error,
          "Player profiles could not be loaded.",
        );
      }

      rawData = fallbackResult.data;
    }

    if (!Array.isArray(rawData)) {
      continue;
    }

    for (const value of rawData) {
      const profile = parseProfileRow(value);

      if (profile) {
        profiles.push(profile);
      }
    }
  }

  return profiles;
}

async function ensureMissingProfiles(
  database: LooseDatabaseClient,
  users: User[],
  profileMap: Map<string, ProfileRow>,
): Promise<void> {
  const missing = users
    .filter(
      (user) =>
        !profileMap.has(user.id),
    )
    .map(buildMissingProfile);

  if (missing.length === 0) {
    return;
  }

  for (const batch of chunk(
    missing,
    100,
  )) {
    const payload: Record<
      string,
      unknown
    >[] = batch.map((profile) => ({
      user_id: profile.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    }));

    const result =
      await database
        .from("player_profiles")
        .upsert(payload, {
          onConflict: "user_id",
          ignoreDuplicates: true,
        });

    if (result.error) {
      throw databaseError(
        result.error,
        "Missing player profiles could not be created.",
      );
    }
  }

  for (const profile of missing) {
    profileMap.set(
      profile.user_id,
      profile,
    );
  }
}

async function loadFriendships(
  database: LooseDatabaseClient,
  currentUserId: string,
): Promise<FriendshipRow[]> {
  const result =
    await database
      .from("player_friendships")
      .select(
        "id,requester_id,addressee_id,status,blocked_by",
      )
      .or(
        `requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`,
      );

  if (result.error) {
    throw databaseError(
      result.error,
      "Friendship records could not be loaded.",
    );
  }

  if (!Array.isArray(result.data)) {
    return [];
  }

  return result.data
    .map(parseFriendshipRow)
    .filter(
      (
        friendship,
      ): friendship is FriendshipRow =>
        friendship !== null,
    );
}

function matchesQuery(
  user: User,
  profile: ProfileRow,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const values = [
    profile.username || "",
    profile.display_name || "",
    getMetadataString(user, [
      "username",
    ]),
  ].map((value) =>
    value
      .trim()
      .replace(/^@+/, "")
      .toLowerCase(),
  );

  return values.some((value) =>
    value.includes(query),
  );
}

function rankCandidate(
  user: User,
  profile: ProfileRow,
  query: string,
): number {
  if (!query) {
    return 4;
  }

  const username = (
    profile.username || ""
  )
    .replace(/^@+/, "")
    .toLowerCase();

  const displayName = (
    profile.display_name || ""
  ).toLowerCase();

  const metadataUsername =
    getMetadataString(user, [
      "username",
    ]).toLowerCase();

  if (
    username === query ||
    metadataUsername === query
  ) {
    return 0;
  }

  if (
    username.startsWith(query) ||
    metadataUsername.startsWith(query)
  ) {
    return 1;
  }

  if (displayName.startsWith(query)) {
    return 2;
  }

  return 3;
}

function isOnline(
  lastSeenAt: string | null,
): boolean {
  if (!lastSeenAt) {
    return false;
  }

  const timestamp = new Date(
    lastSeenAt,
  ).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp >
      Date.now() - ONLINE_WINDOW_MS
  );
}

function buildRelationship(
  currentUserId: string,
  friendship:
    | FriendshipRow
    | undefined,
): Pick<
  SearchResult,
  | "relationship_status"
  | "direction"
  | "friendship_id"
> | null {
  if (!friendship) {
    return {
      relationship_status: "none",
      direction: "none",
      friendship_id: null,
    };
  }

  if (
    friendship.status === "blocked" &&
    friendship.blocked_by !==
      currentUserId
  ) {
    return null;
  }

  if (friendship.status === "accepted") {
    return {
      relationship_status: "accepted",
      direction: "accepted",
      friendship_id: friendship.id,
    };
  }

  if (friendship.status === "blocked") {
    return {
      relationship_status: "blocked",
      direction: "blocked",
      friendship_id: friendship.id,
    };
  }

  return {
    relationship_status: "pending",
    direction:
      friendship.requester_id ===
      currentUserId
        ? "outgoing"
        : "incoming",
    friendship_id: friendship.id,
  };
}

function errorResponse(
  error: unknown,
): Response {
  const message =
    error instanceof Error &&
    error.message.trim()
      ? error.message.trim()
      : "Player search failed.";

  console.error(
    "Player directory search error:",
    error,
  );

  const lower = message.toLowerCase();
  const status =
    lower.includes("session") ||
    lower.includes("sign in")
      ? 401
      : 500;

  return Response.json(
    {
      ok: false,
      error: { message },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(
  request: Request,
) {
  try {
    const service = getServiceClient();
    const database =
      getDatabaseClient(service);
    const token = getBearerToken(request);

    const { data, error } =
      await service.auth.getUser(token);

    if (error || !data.user) {
      throw new Error(
        "Your player session expired. Sign in again.",
      );
    }

    const currentUser = data.user;
    const url = new URL(request.url);
    const query = normaliseQuery(
      url.searchParams.get("q"),
    );

    const listedUsers =
      await listAuthUsers(service);

    const authUsers = listedUsers.filter(
      (user) =>
        user.id === currentUser.id ||
        Boolean(user.email_confirmed_at),
    );

    if (
      !authUsers.some(
        (user) =>
          user.id === currentUser.id,
      )
    ) {
      authUsers.push(currentUser);
    }

    const profiles = await loadProfiles(
      database,
      authUsers.map((user) => user.id),
    );

    const profileMap = new Map<
      string,
      ProfileRow
    >(
      profiles.map((profile) => [
        profile.user_id,
        profile,
      ]),
    );

    await ensureMissingProfiles(
      database,
      authUsers,
      profileMap,
    );

    const friendships =
      await loadFriendships(
        database,
        currentUser.id,
      );

    const friendshipMap = new Map<
      string,
      FriendshipRow
    >();

    for (const friendship of friendships) {
      const otherId =
        friendship.requester_id ===
        currentUser.id
          ? friendship.addressee_id
          : friendship.requester_id;

      friendshipMap.set(
        otherId,
        friendship,
      );
    }

    const currentProfile =
      profileMap.get(currentUser.id) ||
      buildMissingProfile(currentUser);

    const selfMatch = Boolean(
      query &&
      matchesQuery(
        currentUser,
        currentProfile,
        query,
      ),
    );

    const candidates = authUsers
      .filter(
        (user) =>
          user.id !== currentUser.id,
      )
      .map((user) => ({
        user,
        profile:
          profileMap.get(user.id) ||
          buildMissingProfile(user),
      }))
      .filter(
        ({ profile }) =>
          !profile.is_banned,
      )
      .filter(({ user, profile }) =>
        matchesQuery(
          user,
          profile,
          query,
        ),
      )
      .sort((first, second) => {
        const rankDifference =
          rankCandidate(
            first.user,
            first.profile,
            query,
          ) -
          rankCandidate(
            second.user,
            second.profile,
            query,
          );

        if (rankDifference !== 0) {
          return rankDifference;
        }

        const firstOnline = isOnline(
          first.profile.last_seen_at,
        );
        const secondOnline = isOnline(
          second.profile.last_seen_at,
        );

        if (firstOnline !== secondOnline) {
          return firstOnline ? -1 : 1;
        }

        return (
          first.profile.username || ""
        ).localeCompare(
          second.profile.username || "",
        );
      });

    const results: SearchResult[] = [];

    for (const candidate of candidates) {
      const relationship =
        buildRelationship(
          currentUser.id,
          friendshipMap.get(
            candidate.user.id,
          ),
        );

      if (!relationship) {
        continue;
      }

      results.push({
        user_id: candidate.user.id,
        username:
          candidate.profile.username ||
          "trainer",
        display_name:
          candidate.profile.display_name ||
          "Unknown Trainer",
        avatar_url:
          candidate.profile.avatar_url,
        ...relationship,
        online: isOnline(
          candidate.profile.last_seen_at,
        ),
        last_seen_at:
          candidate.profile.last_seen_at,
      });

      if (results.length >= RESULT_LIMIT) {
        break;
      }
    }

    return Response.json(
      {
        ok: true,
        query,
        results,
        selfMatch,
        directoryCount: Math.max(
          0,
          authUsers.length - 1,
        ),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
