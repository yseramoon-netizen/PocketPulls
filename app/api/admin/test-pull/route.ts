import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InventoryRow = {
  id: string | number;
  card_id:
    | string
    | number
    | null;
  quantity:
    | number
    | string
    | null;
  finish?: string | null;
  location?: string | null;
};

type CardRow = {
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
  image_url_large?:
    | string
    | null;
};

function toNumber(
  value: unknown,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function readCount(
  value: unknown,
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      25,
      Math.floor(parsed),
    ),
  );
}

function chooseWeighted(
  rows: InventoryRow[],
): InventoryRow {
  const total =
    rows.reduce(
      (
        sum,
        row,
      ) =>
        sum +
        Math.max(
          0,
          toNumber(
            row.quantity,
          ),
        ),
      0,
    );

  if (total <= 0) {
    return rows[
      Math.floor(
        Math.random() *
        rows.length,
      )
    ];
  }

  let cursor =
    Math.random() *
    total;

  for (const row of rows) {
    cursor -=
      Math.max(
        0,
        toNumber(
          row.quantity,
        ),
      );

    if (cursor <= 0) {
      return row;
    }
  }

  return rows[
    rows.length - 1
  ];
}

function isMissingColumn(
  error: unknown,
  column: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const record =
    error as Record<
      string,
      unknown
    >;

  const text = [
    record.message,
    record.details,
  ]
    .filter(
      (value) =>
        typeof value ===
        "string",
    )
    .join(" ")
    .toLowerCase();

  return (
    text.includes(
      column.toLowerCase(),
    ) &&
    (
      text.includes(
        "does not exist",
      ) ||
      text.includes(
        "schema cache",
      )
    )
  );
}

export async function POST(
  request: Request,
) {
  try {
    const {
      email,
      admin,
    } =
      await requireAdmin(request);

    let count = 1;

    try {
      const body =
        (await request.json()) as {
          count?: unknown;
        };

      count =
        readCount(body.count);
    } catch {
      count = 1;
    }

    let inventoryResult =
      await admin
        .from("inventory")
        .select(
          "id,card_id,quantity,finish,location",
        )
        .gt("quantity", 0)
        .limit(10000);

    if (
      inventoryResult.error &&
      isMissingColumn(
        inventoryResult.error,
        "finish",
      )
    ) {
      inventoryResult =
        await admin
          .from("inventory")
          .select(
            "id,card_id,quantity,location",
          )
          .gt("quantity", 0)
          .limit(10000);
    }

    if (
      inventoryResult.error
    ) {
      throw inventoryResult.error;
    }

    const inventory =
      (
        inventoryResult.data ||
        []
      )
        .map(
          (row) =>
            row as InventoryRow,
        )
        .filter(
          (row) =>
            row.card_id !==
              null &&
            toNumber(
              row.quantity,
            ) > 0,
        );

    if (!inventory.length) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "test_pool_empty",
            message:
              "There are no positive-quantity cards available for the test pool.",
          },
        },
        {
          status: 409,
        },
      );
    }

    const cardIds =
      Array.from(
        new Set(
          inventory.map(
            (row) =>
              String(
                row.card_id,
              ),
          ),
        ),
      );

    const cards:
      CardRow[] = [];

    for (
      let index = 0;
      index <
      cardIds.length;
      index += 500
    ) {
      const chunk =
        cardIds.slice(
          index,
          index + 500,
        );

      let cardResult =
        await admin
          .from(
            "pokemon_cards",
          )
          .select(
            "id,name,set_name,card_no,rarity,market_value,image_url,image_url_large",
          )
          .in("id", chunk);

      if (
        cardResult.error &&
        isMissingColumn(
          cardResult.error,
          "image_url_large",
        )
      ) {
        cardResult =
          await admin
            .from(
              "pokemon_cards",
            )
            .select(
              "id,name,set_name,card_no,rarity,market_value,image_url",
            )
            .in(
              "id",
              chunk,
            );
      }

      if (cardResult.error) {
        throw cardResult.error;
      }

      cards.push(
        ...(
          cardResult.data ||
          []
        ).map(
          (row) =>
            row as CardRow,
        ),
      );
    }

    const cardsById =
      new Map(
        cards.map(
          (card) => [
            String(card.id),
            card,
          ],
        ),
      );

    const drawable =
      inventory.filter(
        (row) =>
          cardsById.has(
            String(
              row.card_id,
            ),
          ),
      );

    if (!drawable.length) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "test_pool_unlinked",
            message:
              "Inventory exists, but none of its card IDs match the master card database.",
          },
        },
        {
          status: 409,
        },
      );
    }

    const results =
      Array.from(
        {
          length: count,
        },
        (
          _,
          index,
        ) => {
          const stock =
            chooseWeighted(
              drawable,
            );

          const card =
            cardsById.get(
              String(
                stock.card_id,
              ),
            )!;

          return {
            testId:
              crypto.randomUUID(),
            sequence:
              index + 1,
            inventoryId:
              String(
                stock.id,
              ),
            cardId:
              String(
                card.id,
              ),
            name:
              card.name ||
              "Unknown card",
            setName:
              card.set_name ||
              "Unknown set",
            cardNumber:
              card.card_no ||
              "",
            rarity:
              card.rarity ||
              "Unknown rarity",
            marketValue:
              toNumber(
                card.market_value,
              ),
            imageUrl:
              card.image_url_large ||
              card.image_url ||
              null,
            finish:
              stock.finish ||
              "normal",
            stockSnapshot:
              toNumber(
                stock.quantity,
              ),
            location:
              stock.location ||
              "Main Inventory",
          };
        },
      );

    /*
     * TEST SAFETY GUARANTEE
     *
     * This route performs SELECT queries only.
     * It does not UPDATE inventory, INSERT
     * player_wishes, alter wallets or create
     * permanent pull history.
     */
    return Response.json(
      {
        ok: true,
        mode:
          "read_only_test",
        inventoryChanged:
          false,
        adminEmail:
          email,
        pulledAt:
          new Date()
            .toISOString(),
        results,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
          "X-Unknown-Pulls-Test-Mode":
            "read-only",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(
      error,
    );
  }
}
