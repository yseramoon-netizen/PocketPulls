import {
  adminErrorResponse,
  requireAdmin,
  type ServerAdminClient,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UnknownRow = Record<
  string,
  unknown
>;

type Branch = {
  name: string;
  email: string;
  cardsPlanted: number;
  plantingSessions: number;
  lastPlantedAt: string | null;
};

function rows(
  value: unknown,
): UnknownRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is UnknownRow =>
          typeof item === "object" &&
          item !== null,
      )
    : [];
}

function numberValue(
  value: unknown,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function textValue(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function adminName(
  email: string,
  displayName: string,
): string {
  if (displayName) {
    return displayName;
  }

  if (
    email === "pullspocket@gmail.com" ||
    email.includes("lukas")
  ) {
    return "Lukas";
  }

  if (email.includes("skye")) {
    return "Skye";
  }

  const prefix = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  return prefix
    ? prefix.replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      )
    : "Shaymin keeper";
}

async function safeSelect(
  admin: ServerAdminClient,
  tableName: string,
  columns: string,
): Promise<UnknownRow[]> {
  try {
    const result = await (
      admin.from(tableName) as any
    ).select(columns);

    if (result.error) {
      console.warn(
        `Tree metric ${tableName} unavailable:`,
        result.error,
      );
      return [];
    }

    return rows(result.data);
  } catch (error: unknown) {
    console.warn(
      `Tree metric ${tableName} failed:`,
      error,
    );
    return [];
  }
}

export async function GET(
  request: Request,
) {
  try {
    const {
      admin,
      email: viewerEmail,
    } = await requireAdmin(request);

    const [
      inventory,
      profiles,
      wallets,
      wishes,
      admins,
    ] = await Promise.all([
      safeSelect(
        admin,
        "inventory",
        "quantity,added_by,created_at,status",
      ),
      safeSelect(
        admin,
        "player_profiles",
        "user_id",
      ),
      safeSelect(
        admin,
        "player_wallets",
        "wish_balance,lifetime_wishes_spent",
      ),
      safeSelect(
        admin,
        "player_wishes",
        "id,market_value_at_wish,created_at,user_id",
      ),
      safeSelect(
        admin,
        "admin_users",
        "email,display_name,is_active,user_id",
      ),
    ]);

    const activeAdmins = admins
      .filter(
        (row) =>
          row.is_active !== false,
      )
      .map((row) => {
        const email = textValue(
          row.email,
        ).toLowerCase();

        return {
          email,
          name: adminName(
            email,
            textValue(
              row.display_name,
            ),
          ),
        };
      })
      .filter(
        (adminRow) =>
          Boolean(adminRow.email),
      );

    if (
      !activeAdmins.some(
        (adminRow) =>
          adminRow.email ===
          "pullspocket@gmail.com",
      )
    ) {
      activeAdmins.unshift({
        email: "pullspocket@gmail.com",
        name: "Lukas",
      });
    }

    const branches: Branch[] =
      activeAdmins.map(
        (adminRow) => {
          const matchingRows =
            inventory.filter(
              (row) => {
                const addedBy = textValue(
                  row.added_by,
                ).toLowerCase();

                return (
                  addedBy ===
                    adminRow.email ||
                  addedBy.includes(
                    adminRow.name
                      .toLowerCase(),
                  )
                );
              },
            );

          const lastPlantedAt =
            matchingRows
              .map((row) =>
                textValue(
                  row.created_at,
                ),
              )
              .filter(Boolean)
              .sort()
              .at(-1) || null;

          return {
            name: adminRow.name,
            email: adminRow.email,
            cardsPlanted:
              matchingRows.reduce(
                (sum, row) =>
                  sum +
                  Math.max(
                    0,
                    numberValue(
                      row.quantity,
                    ),
                  ),
                0,
              ),
            plantingSessions:
              matchingRows.length,
            lastPlantedAt,
          };
        },
      );

    const stockCards = inventory.reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          numberValue(row.quantity),
        ),
      0,
    );

    const sharedCards = Math.max(
      0,
      stockCards -
        branches.reduce(
          (sum, branch) =>
            sum + branch.cardsPlanted,
          0,
        ),
    );

    const availableWishes =
      wallets.reduce(
        (sum, row) =>
          sum +
          Math.max(
            0,
            numberValue(
              row.wish_balance,
            ),
          ),
        0,
      );

    const wishesSpent =
      wallets.reduce(
        (sum, row) =>
          sum +
          Math.max(
            0,
            numberValue(
              row.lifetime_wishes_spent,
            ),
          ),
        0,
      );

    const cardsFound = wishes.length;

    const valueShared = wishes.reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          numberValue(
            row.market_value_at_wish,
          ),
        ),
      0,
    );

    const growthScore = Math.round(
      stockCards +
      cardsFound * 5 +
      profiles.length * 12 +
      wishesSpent * 2,
    );

    const stage =
      growthScore >= 10000
        ? "Ancient canopy"
        : growthScore >= 5000
          ? "Wide canopy"
          : growthScore >= 1500
            ? "Young woodland"
            : growthScore >= 400
              ? "Strong sapling"
              : "New roots";

    return Response.json(
      {
        ok: true,
        viewerEmail,
        generatedAt:
          new Date().toISOString(),
        tree: {
          stage,
          growthScore,
          stockCards,
          trainers: profiles.length,
          cardsFound,
          availableWishes,
          wishesSpent,
          valueShared,
          sharedCards,
          branches,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
