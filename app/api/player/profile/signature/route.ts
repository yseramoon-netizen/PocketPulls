import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SignatureBody = {
  cardId?: unknown;
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

function readCardId(
  value: unknown,
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, 160);
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

function databaseError(
  error: DatabaseError,
  fallback: string,
): Error {
  return new Error(
    readString(error.message) || fallback,
  );
}

function getUsername(
  profile: Record<string, unknown> | null,
  email: string | null | undefined,
): string {
  const username = readString(
    profile?.username,
  );

  if (username) {
    return username;
  }

  return (
    email
      ?.split("@")[0]
      ?.trim() ||
    "trainer"
  );
}

function errorResponse(
  error: unknown,
): Response {
  const message =
    error instanceof Error &&
    error.message.trim()
      ? error.message.trim()
      : "Your signature card could not be saved.";

  console.error(
    "Player signature-card error:",
    error,
  );

  const lower = message.toLowerCase();
  const status =
    lower.includes("session") ||
    lower.includes("sign in")
      ? 401
      : lower.includes("only choose") ||
          lower.includes("valid card")
        ? 400
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

async function getVerifiedUser(
  service: ServiceClient,
  token: string,
) {
  const { data, error } =
    await service.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      "Your player session expired. Sign in again.",
    );
  }

  return data.user;
}

export async function POST(
  request: Request,
) {
  try {
    const token = getBearerToken(request);

    let body: SignatureBody;

    try {
      body =
        (await request.json()) as SignatureBody;
    } catch {
      throw new Error(
        "The signature-card request was not valid JSON.",
      );
    }

    const cardId = readCardId(body.cardId);

    if (!cardId) {
      throw new Error(
        "Choose a valid card from your collection.",
      );
    }

    const service = getServiceClient();
    const database =
      getDatabaseClient(service);
    const user = await getVerifiedUser(
      service,
      token,
    );

    const ownershipResult =
      await database
        .from("player_inventory")
        .select("user_id,card_id,quantity")
        .eq("user_id", user.id)
        .eq("card_id", cardId)
        .limit(1)
        .maybeSingle();

    if (ownershipResult.error) {
      throw databaseError(
        ownershipResult.error,
        "Your collection ownership could not be checked.",
      );
    }

    const ownership = asRecord(
      ownershipResult.data,
    );

    if (
      !ownership ||
      readString(ownership.user_id) !==
        user.id ||
      String(ownership.card_id ?? "") !==
        cardId ||
      Number(ownership.quantity) <= 0
    ) {
      throw new Error(
        "You can only choose a card owned by the currently signed-in player.",
      );
    }

    const updatedAt =
      new Date().toISOString();

    const updateResult =
      await database
        .from("player_profile_details")
        .upsert(
          {
            user_id: user.id,
            signature_card_id: cardId,
            updated_at: updatedAt,
          },
          {
            onConflict: "user_id",
          },
        );

    if (updateResult.error) {
      throw databaseError(
        updateResult.error,
        "Your signature card could not be stored.",
      );
    }

    const verifyResult =
      await database
        .from("player_profile_details")
        .select(
          "user_id,signature_card_id,updated_at",
        )
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (verifyResult.error) {
      throw databaseError(
        verifyResult.error,
        "The signature-card save could not be verified.",
      );
    }

    const savedDetails = asRecord(
      verifyResult.data,
    );

    if (
      !savedDetails ||
      readString(savedDetails.user_id) !==
        user.id ||
      String(
        savedDetails.signature_card_id ??
          "",
      ) !== cardId
    ) {
      throw new Error(
        "The signature card did not save to the expected player account.",
      );
    }

    const profileResult =
      await database
        .from("player_profiles")
        .select("user_id,username")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (profileResult.error) {
      throw databaseError(
        profileResult.error,
        "The saved player profile could not be reloaded.",
      );
    }

    return Response.json(
      {
        ok: true,
        userId: user.id,
        username: getUsername(
          asRecord(profileResult.data),
          user.email,
        ),
        cardId,
        savedAt: updatedAt,
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
