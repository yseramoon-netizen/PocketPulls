import {
  type User,
} from "@supabase/supabase-js";

import {
  adminErrorResponse,
  requireAdmin,
  type ServerAdminClient,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const FOUNDER_ADMIN_EMAIL =
  "pullspocket@gmail.com";

type PlayerAction =
  | "adjust_wishes"
  | "adjust_card"
  | "set_ban"
  | "resend_confirmation"
  | "set_admin";

type ActionBody = {
  action?: unknown;
  userId?: unknown;
  delta?: unknown;
  cardId?: unknown;
  banned?: unknown;
  adminEnabled?: unknown;
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

type EnrichedPlayerAccount =
  PlayerAccountRow & {
    email_confirmed_at:
      | string
      | null;
    is_admin: boolean;
    admin_display_name:
      | string
      | null;
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

type AdminUserRow = {
  email: string;
  user_id: string | null;
  display_name: string | null;
  is_active: boolean | null;
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
      "set_ban" ||
    value ===
      "resend_confirmation" ||
    value ===
      "set_admin"
    ? value
    : null;
}

function asRows<T>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? (
        value.filter(
          (row) =>
            typeof row ===
              "object" &&
            row !== null,
        ) as T[]
      )
    : [];
}

function asSingle<T>(
  value: unknown,
): T | null {
  if (Array.isArray(value)) {
    const first =
      value.find(
        (row) =>
          typeof row ===
            "object" &&
          row !== null,
      );

    return first
      ? (first as T)
      : null;
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

function normaliseEmail(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value || ""
  )
    .trim()
    .toLowerCase();
}

function getAuthConfirmedAt(
  user:
    | User
    | null
    | undefined,
): string | null {
  if (!user) {
    return null;
  }

  const value =
    (
      user as User & {
        email_confirmed_at?:
          | string
          | null;
        confirmed_at?:
          | string
          | null;
      }
    ).email_confirmed_at ||
    (
      user as User & {
        confirmed_at?:
          | string
          | null;
      }
    ).confirmed_at;

  return typeof value ===
      "string" &&
    value.trim()
    ? value
    : null;
}

function getAuthLastSignInAt(
  user:
    | User
    | null
    | undefined,
): string | null {
  if (!user) {
    return null;
  }

  const value =
    (
      user as User & {
        last_sign_in_at?:
          | string
          | null;
      }
    ).last_sign_in_at;

  return typeof value ===
      "string" &&
    value.trim()
    ? value
    : null;
}

async function getAuthUser(
  admin: ServerAdminClient,
  userId: string,
): Promise<User> {
  const {
    data,
    error,
  } =
    await admin.auth.admin
      .getUserById(
        userId,
      );

  if (
    error ||
    !data.user
  ) {
    throw new Error(
      error?.message ||
      "The Supabase Auth account could not be loaded.",
    );
  }

  return data.user;
}

async function listAuthUsers(
  admin: ServerAdminClient,
): Promise<User[]> {
  const users:
    User[] = [];

  const perPage =
    200;

  for (
    let page = 1;
    page <= 10;
    page += 1
  ) {
    const {
      data,
      error,
    } =
      await admin.auth.admin
        .listUsers({
          page,
          perPage,
        });

    if (error) {
      throw new Error(
        error.message ||
        "Supabase Auth users could not be listed.",
      );
    }

    const pageUsers =
      Array.isArray(
        data.users,
      )
        ? data.users
        : [];

    users.push(
      ...pageUsers,
    );

    if (
      pageUsers.length <
      perPage
    ) {
      break;
    }
  }

  return users;
}

async function listActiveAdmins(
  admin: ServerAdminClient,
): Promise<AdminUserRow[]> {
  const table =
    admin.from(
      "admin_users",
    ) as any;

  const {
    data,
    error,
  } =
    await table
      .select(
        "email,user_id,display_name,is_active",
      )
      .eq(
        "is_active",
        true,
      );

  if (error) {
    throw error;
  }

  return asRows<AdminUserRow>(
    data,
  );
}

function buildAdminIndexes(
  rows: AdminUserRow[],
) {
  const byUserId =
    new Map<
      string,
      AdminUserRow
    >();

  const byEmail =
    new Map<
      string,
      AdminUserRow
    >();

  for (const row of rows) {
    if (
      row.user_id
    ) {
      byUserId.set(
        row.user_id,
        row,
      );
    }

    const email =
      normaliseEmail(
        row.email,
      );

    if (email) {
      byEmail.set(
        email,
        row,
      );
    }
  }

  return {
    byUserId,
    byEmail,
  };
}

function enrichPlayer(
  account:
    PlayerAccountRow,
  authUser:
    | User
    | null,
  adminIndexes:
    ReturnType<
      typeof buildAdminIndexes
    >,
): EnrichedPlayerAccount {
  const email =
    normaliseEmail(
      authUser?.email ||
      account.email,
    );

  const adminRow =
    adminIndexes.byUserId.get(
      account.user_id,
    ) ||
    adminIndexes.byEmail.get(
      email,
    ) ||
    null;

  return {
    ...account,
    email:
      authUser?.email ||
      account.email,
    created_at:
      (
        authUser as
          | (
              User & {
                created_at?:
                  | string
                  | null;
              }
            )
          | null
      )?.created_at ||
      account.created_at,
    last_sign_in_at:
      getAuthLastSignInAt(
        authUser,
      ) ||
      account.last_sign_in_at,
    email_confirmed_at:
      getAuthConfirmedAt(
        authUser,
      ),
    is_admin:
      Boolean(
        adminRow &&
        adminRow.is_active !==
          false,
      ),
    admin_display_name:
      adminRow
        ?.display_name ||
      null,
  };
}

function getPublicOrigin(
  request: Request,
): string {
  const configured = [
    process.env
      .NEXT_PUBLIC_SITE_URL,
    process.env
      .NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL,
    process.env
      .VERCEL_URL,
  ];

  for (
    const value
    of configured
  ) {
    const cleaned =
      value?.trim();

    if (!cleaned) {
      continue;
    }

    const candidate =
      /^https?:\/\//i.test(
        cleaned,
      )
        ? cleaned
        : `https://${cleaned}`;

    try {
      return new URL(
        candidate,
      ).origin;
    } catch {
      // Try the next configured value.
    }
  }

  return new URL(
    request.url,
  ).origin;
}

async function writeAdminAudit(
  admin: ServerAdminClient,
  values: {
    actorUserId: string;
    actorEmail: string;
    targetUserId: string;
    targetEmail: string;
    enabled: boolean;
    reason: string;
  },
): Promise<void> {
  try {
    const table =
      admin.from(
        "admin_access_events",
      ) as any;

    const {
      error,
    } =
      await table.insert({
        actor_user_id:
          values.actorUserId,
        actor_email:
          values.actorEmail,
        target_user_id:
          values.targetUserId,
        target_email:
          values.targetEmail,
        access_enabled:
          values.enabled,
        reason:
          values.reason ||
          null,
      });

    if (error) {
      console.warn(
        "Admin access audit could not be written:",
        error,
      );
    }
  } catch (
    auditError: unknown
  ) {
    console.warn(
      "Admin access audit failed:",
      auditError,
    );
  }
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

    const activeAdmins =
      await listActiveAdmins(
        admin,
      );

    const adminIndexes =
      buildAdminIndexes(
        activeAdmins,
      );

    if (userId) {
      const [
        accountResult,
        inventoryResult,
        authUser,
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

          getAuthUser(
            admin,
            userId,
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
          account:
            enrichPlayer(
              account,
              authUser,
              adminIndexes,
            ),
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

    const [
      accountResult,
      authUsers,
    ] =
      await Promise.all([
        admin.rpc(
          "admin_search_player_accounts",
          {
            p_query:
              query,
            p_limit:
              limit,
          },
        ),

        listAuthUsers(
          admin,
        ),
      ]);

    if (
      accountResult.error
    ) {
      throw accountResult.error;
    }

    const authById =
      new Map<
        string,
        User
      >(
        authUsers.map(
          (authUser) => [
            authUser.id,
            authUser,
          ],
        ),
      );

    const players =
      asRows<PlayerAccountRow>(
        accountResult.data,
      ).map(
        (account) =>
          enrichPlayer(
            account,
            authById.get(
              account.user_id,
            ) ||
              null,
            adminIndexes,
          ),
      );

    return Response.json(
      {
        ok: true,
        players,
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
      "resend_confirmation"
    ) {
      const target =
        await getAuthUser(
          admin,
          userId,
        );

      const targetEmail =
        normaliseEmail(
          target.email,
        );

      if (!targetEmail) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "player_email_missing",
              message:
                "This account has no email address to confirm.",
            },
          },
          {
            status: 409,
          },
        );
      }

      if (
        getAuthConfirmedAt(
          target,
        )
      ) {
        return Response.json({
          ok: true,
          action,
          email:
            targetEmail,
          alreadyConfirmed:
            true,
        });
      }

      const origin =
        getPublicOrigin(
          request,
        );

      const callbackUrl =
        `${origin}/auth/callback?next=${encodeURIComponent(
          "/wishes",
        )}`;

      const {
        error:
          resendError,
      } =
        await admin.auth
          .resend({
            type:
              "signup",
            email:
              targetEmail,
            options: {
              emailRedirectTo:
                callbackUrl,
            },
          });

      if (resendError) {
        throw new Error(
          resendError.message ||
          "Supabase could not resend the confirmation email.",
        );
      }

      return Response.json({
        ok: true,
        action,
        email:
          targetEmail,
        alreadyConfirmed:
          false,
      });
    }

    if (
      action ===
      "set_admin"
    ) {
      const target =
        await getAuthUser(
          admin,
          userId,
        );

      const targetEmail =
        normaliseEmail(
          target.email,
        );

      if (!targetEmail) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "admin_target_email_missing",
              message:
                "This player has no email address and cannot become an administrator.",
            },
          },
          {
            status: 409,
          },
        );
      }

      const enabled =
        body.adminEnabled ===
        true;

      if (
        !enabled &&
        targetEmail ===
          FOUNDER_ADMIN_EMAIL
      ) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "founder_admin_protected",
              message:
                "The founder administrator cannot be disabled from the player manager.",
            },
          },
          {
            status: 409,
          },
        );
      }

      if (
        !enabled &&
        userId ===
          user.id
      ) {
        return Response.json(
          {
            ok: false,
            error: {
              code:
                "admin_self_revoke_blocked",
              message:
                "You cannot remove your own active admin access while signed in.",
            },
          },
          {
            status: 409,
          },
        );
      }

      const adminsTable =
        admin.from(
          "admin_users",
        ) as any;

      if (enabled) {
        const displayName =
          typeof target
            .user_metadata
            ?.display_name ===
              "string"
            ? target
                .user_metadata
                .display_name
                .trim()
            : "";

        const existing =
          await adminsTable
            .select(
              "email,user_id,is_active",
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle();

        if (
          !existing.error &&
          existing.data
        ) {
          const {
            error:
              updateError,
          } =
            await adminsTable
              .update({
                email:
                  targetEmail,
                display_name:
                  displayName ||
                  targetEmail
                    .split("@")[0],
                is_active:
                  true,
                last_verified_at:
                  new Date()
                    .toISOString(),
                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "user_id",
                userId,
              );

          if (updateError) {
            throw updateError;
          }
        } else {
          const {
            error:
              upsertError,
          } =
            await adminsTable
              .upsert(
                {
                  email:
                    targetEmail,
                  user_id:
                    userId,
                  display_name:
                    displayName ||
                    targetEmail
                      .split("@")[0],
                  is_active:
                    true,
                  last_verified_at:
                    new Date()
                      .toISOString(),
                  updated_at:
                    new Date()
                      .toISOString(),
                },
                {
                  onConflict:
                    "email",
                },
              );

          if (upsertError) {
            throw upsertError;
          }
        }
      } else {
        const byUser =
          await adminsTable
            .update({
              is_active:
                false,
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "user_id",
              userId,
            );

        if (
          byUser.error
        ) {
          throw byUser.error;
        }

        const byEmail =
          await adminsTable
            .update({
              is_active:
                false,
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "email",
              targetEmail,
            );

        if (
          byEmail.error
        ) {
          throw byEmail.error;
        }
      }

      await writeAdminAudit(
        admin,
        {
          actorUserId:
            user.id,
          actorEmail:
            email,
          targetUserId:
            userId,
          targetEmail,
          enabled,
          reason,
        },
      );

      return Response.json({
        ok: true,
        action,
        isAdmin:
          enabled,
        email:
          targetEmail,
      });
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
