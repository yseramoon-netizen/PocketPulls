import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  user_id: string;
  trainer_code: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  is_banned: boolean | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  blocked_by: string | null;
};


type DatabaseError = {
  message?: string;
};

type LooseResult = {
  data: unknown;
  error: DatabaseError | null;
};

type LooseQuery = PromiseLike<LooseResult> & {
  select(columns?: string): LooseQuery;
  or(filters: string): LooseQuery;
  limit(count: number): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  maybeSingle(): Promise<LooseResult>;
};

type LooseDatabaseClient = {
  from(table: string): LooseQuery;
};

const RESULT_LIMIT = 12;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function requireEnvironment(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  throw new Error(`Missing server environment value: ${names.join(" or ")}.`);
}

function getServiceClient() {
  return createClient(
    requireEnvironment(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
    requireEnvironment(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

function getBearerToken(request: Request): string {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) throw new Error("Your player session is missing. Sign in again.");
  return token;
}

function normaliseQuery(value: string | null): string {
  return (value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 40);
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() - ONLINE_WINDOW_MS;
}

function relationshipFor(
  currentUserId: string,
  targetUserId: string,
  friendship: FriendshipRow | undefined,
) {
  if (!friendship) {
    return {
      relationship_status: "none" as const,
      direction: "none" as const,
      friendship_id: null,
    };
  }

  if (friendship.status === "blocked" && friendship.blocked_by !== currentUserId) {
    return null;
  }

  if (friendship.status === "accepted") {
    return {
      relationship_status: "accepted" as const,
      direction: "accepted" as const,
      friendship_id: friendship.id,
    };
  }

  if (friendship.status === "blocked") {
    return {
      relationship_status: "blocked" as const,
      direction: "blocked" as const,
      friendship_id: friendship.id,
    };
  }

  return {
    relationship_status: "pending" as const,
    direction:
      friendship.requester_id === currentUserId
        ? ("outgoing" as const)
        : ("incoming" as const),
    friendship_id: friendship.id,
  };
}

export async function GET(request: Request) {
  try {
    const service = getServiceClient();
    const token = getBearerToken(request);
    const { data: authData, error: authError } = await service.auth.getUser(token);

    if (authError || !authData.user) {
      throw new Error("Your player session expired. Sign in again.");
    }

    const currentUserId = authData.user.id;
    const query = normaliseQuery(new URL(request.url).searchParams.get("q"));

    // Privacy by default: an empty search never returns a player directory.
    if (!query) {
      return Response.json(
        { ok: true, query: "", results: [], selfMatch: false, directoryCount: 0 },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const database = service as unknown as LooseDatabaseClient;

    const upperQuery = query.toUpperCase();
    const profileResult = await database
      .from("player_profiles")
      .select("user_id,trainer_code,username,display_name,avatar_url,last_seen_at,is_banned")
      .or(`username.ilike.${query}%,trainer_code.ilike.${upperQuery}%`)
      .limit(RESULT_LIMIT + 2);

    if (profileResult.error) throw profileResult.error;

    const profiles = (Array.isArray(profileResult.data) ? profileResult.data : []) as ProfileRow[];

    const currentProfileResult = await database
      .from("player_profiles")
      .select("user_id,trainer_code,username")
      .eq("user_id", currentUserId)
      .maybeSingle();

    const currentProfile = currentProfileResult.data as
      | Pick<ProfileRow, "user_id" | "trainer_code" | "username">
      | null;

    const selfMatch = Boolean(
      currentProfile &&
        [currentProfile.username || "", currentProfile.trainer_code || ""].some((value) =>
          value.toLowerCase().startsWith(query.toLowerCase()),
        ),
    );

    const targetProfiles = profiles
      .filter((profile) => profile.user_id !== currentUserId && profile.is_banned !== true)
      .sort((first, second) => {
        const needle = query.toLowerCase();
        const firstValues = [first.username || "", first.trainer_code || ""].map((value) => value.toLowerCase());
        const secondValues = [second.username || "", second.trainer_code || ""].map((value) => value.toLowerCase());
        const firstExact = firstValues.some((value) => value === needle) ? 0 : 1;
        const secondExact = secondValues.some((value) => value === needle) ? 0 : 1;
        if (firstExact !== secondExact) return firstExact - secondExact;
        return (first.username || "").localeCompare(second.username || "");
      })
      .slice(0, RESULT_LIMIT);

    const friendshipResult = await database
      .from("player_friendships")
      .select("id,requester_id,addressee_id,status,blocked_by")
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

    if (friendshipResult.error) throw friendshipResult.error;

    const friendships = (Array.isArray(friendshipResult.data)
      ? friendshipResult.data
      : []) as FriendshipRow[];

    const friendshipMap = new Map<string, FriendshipRow>();
    for (const friendship of friendships) {
      const otherId =
        friendship.requester_id === currentUserId
          ? friendship.addressee_id
          : friendship.requester_id;
      friendshipMap.set(otherId, friendship);
    }

    const results = targetProfiles.flatMap((profile) => {
      const relationship = relationshipFor(
        currentUserId,
        profile.user_id,
        friendshipMap.get(profile.user_id),
      );

      if (!relationship) return [];

      return [
        {
          user_id: profile.user_id,
          trainer_code: profile.trainer_code || "",
          username: profile.username || "trainer",
          display_name: profile.display_name || "Trainer",
          avatar_url: profile.avatar_url,
          ...relationship,
          online: isOnline(profile.last_seen_at),
          last_seen_at: profile.last_seen_at,
        },
      ];
    });

    return Response.json(
      { ok: true, query, results, selfMatch, directoryCount: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("Private player search error:", error);

    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Player search failed.";

    return Response.json(
      { ok: false, error: { message } },
      {
        status: message.toLowerCase().includes("session") ? 401 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
