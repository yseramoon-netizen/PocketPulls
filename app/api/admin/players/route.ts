import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlayerAction =
  | "adjust_wishes"
  | "adjust_card"
  | "set_ban";

type ActionBody = {
  action?: unknown;
  userId?: unknown;
  delta?: unknown;
  cardId?: unknown;
  banned?: unknown;
  reason?: unknown;
};

type PlayerAccountRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wish_balance: number | string | null;
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
};

type PlayerInventoryRow = {
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

type CardSearchRow = {
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

function readString(
  value: unknown,
  maxLength = 200,
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.trunc(parsed),
    ),
  );
}

function parseAction(
  value: unknown,
): PlayerAction | null {
  return value ===
      "adjust_wishes" ||
    value ===
      "adjust_card" ||
    value ===
      "set_ban"
    ? value
    : null;
}

function asRows<T>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : [];
}

function asSingle<T>(
  value: unknown,
): T | null {
  if (Array.isArray(value)) {
    return (
      (value[0] as T | undefined) ||
      null
    );
  }

  return typeof value ===
      "object" &&
    value !== null
    ? (value as T)
    : null;
}

function cleanSearch(
  value: string,
): string {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(
  request: Request,
) {
  try {
    const {
      admin,
    } =
      await requireAdmin(request);

    const url =
      new URL(request.url);

    const userId =
      readString(
        url.searchParams.get(
          "userId",
        ),
        80,
      );

    const cardQuery =
      cleanSearch(
        readString(
          url.searchParams.get(
            "cardQuery",
          ),
          120,
        ),
      );

    if (cardQuery) {
      const cardsTable =
        admin.from(
          "pokemon_cards",
        ) as any;

      const {
        data,
        error,
      } =
        await cardsTable
          .select(
            "id,name,set_name,card_no,rarity,market_value,image_url",
          )
          .or(
            [
              `name.ilike.%${cardQuery}%`,
              `set_name.ilike.%${cardQuery}%`,
              `card_no.ilike.%${cardQuery}%`,
            ].join(","),
          )
          .order(
            "name",
            {
              ascending: true,
            },
          )
          .limit(40);

      if (error) {
        throw error;
      }

      return Response.json(
        {
          ok: true,
          cards:
            asRows<CardSearchRow>(
              data,
            ),
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    if (userId) {
      const [
        accountResult,
        inventoryResult,
      ] =
        await Promise.all([
          admin.rpc(
            "admin_get_player_account",
            {
              p_user_id:
                userId,
            },
          ),

          admin.rpc(
            "admin_get_player_inventory",
            {
              p_user_id:
                userId,
            },
          ),
        ]);

      if (
        accountResult.error
      ) {
        throw accountResult.error;
      }

      if (
        inventoryResult.error
      ) {
        throw inventoryResult.error;
      }

      const account =
        asSingle<PlayerAccountRow>(
          accountResult.data,
        );

      if (!account) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "player_not_found",
              message:
                "That player account no longer exists.",
            },
          },
          {
            status: 404,
          },
        );
      }

      return Response.json(
        {
          ok: true,
          account,
          inventory:
            asRows<PlayerInventoryRow>(
              inventoryResult.data,
            ),
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const query =
      readString(
        url.searchParams.get(
          "query",
        ),
        120,
      );

    const limit =
      readInteger(
        url.searchParams.get(
          "limit",
        ),
        1,
        250,
      ) || 100;

    const {
      data,
      error,
    } =
      await admin.rpc(
        "admin_search_player_accounts",
        {
          p_query:
            query,
          p_limit:
            limit,
        },
      );

    if (error) {
      throw error;
    }

    return Response.json(
      {
        ok: true,
        players:
          asRows<PlayerAccountRow>(
            data,
          ),
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error: unknown
  ) {
    return adminErrorResponse(
      error,
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const {
      user,
      email,
      admin,
    } =
      await requireAdmin(request);

    let body:
      ActionBody;

    try {
      body =
        (await request.json()) as
          ActionBody;
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "invalid_player_action_body",
            message:
              "The player action request was not valid JSON.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const action =
      parseAction(
        body.action,
      );

    const userId =
      readString(
        body.userId,
        80,
      );

    const reason =
      readString(
        body.reason,
        500,
      );

    if (
      !action ||
      !userId
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "invalid_player_action",
            message:
              "Choose a valid player action and account.",
          },
        },
        {
          status: 400,
        },
      );
    }

    if (
      action ===
      "adjust_wishes"
    ) {
      const delta =
        readInteger(
          body.delta,
          -100000,
          100000,
        );

      if (
        delta === null ||
        delta === 0
      ) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "invalid_wish_adjustment",
              message:
                "Wish adjustment must be a non-zero whole number.",
            },
          },
          {
            status: 400,
          },
        );
      }

      const {
        data,
        error,
      } =
        await admin.rpc(
          "admin_adjust_player_wishes",
          {
            p_user_id:
              userId,
            p_delta:
              delta,
            p_reason:
              reason,
            p_admin_user_id:
              user.id,
            p_admin_email:
              email,
          },
        );

      if (error) {
        throw error;
      }

      return Response.json(
        {
          ok: true,
          action,
          finalWishBalance:
            Number(data) || 0,
        },
      );
    }

    if (
      action ===
      "adjust_card"
    ) {
      const cardId =
        readString(
          body.cardId,
          120,
        );

      const delta =
        readInteger(
          body.delta,
          -10000,
          10000,
        );

      if (
        !cardId ||
        delta === null ||
        delta === 0
      ) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "invalid_card_adjustment",
              message:
                "Choose a card and a non-zero quantity adjustment.",
            },
          },
          {
            status: 400,
          },
        );
      }

      const {
        data,
        error,
      } =
        await admin.rpc(
          "admin_adjust_player_card",
          {
            p_user_id:
              userId,
            p_card_id:
              cardId,
            p_delta:
              delta,
            p_reason:
              reason,
            p_admin_user_id:
              user.id,
            p_admin_email:
              email,
          },
        );

      if (error) {
        throw error;
      }

      return Response.json(
        {
          ok: true,
          action,
          cardId,
          finalQuantity:
            Number(data) || 0,
        },
      );
    }

    const banned =
      body.banned === true;

    const {
      data,
      error,
    } =
      await admin.rpc(
        "admin_set_player_ban",
        {
          p_user_id:
            userId,
          p_banned:
            banned,
          p_reason:
            reason,
          p_admin_user_id:
            user.id,
          p_admin_email:
            email,
        },
      );

    if (error) {
      throw error;
    }

    return Response.json(
      {
        ok: true,
        action,
        banned:
          data === true,
      },
    );
  } catch (
    error: unknown
  ) {
    return adminErrorResponse(
      error,
    );
  }
}
