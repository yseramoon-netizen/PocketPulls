import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AddInventoryBody = {
  cardId?: unknown;
  quantity?: unknown;
  location?: unknown;
  finish?: unknown;
};

type InventoryRow = {
  id: string | number;
  quantity:
    | number
    | string
    | null;
  location: string | null;
  status: string | null;
  finish?: string | null;
};

type MasterCardRow = {
  id: string | number;
  name: string | null;
  set_name: string | null;
  card_no: string | null;
};

const ALLOWED_FINISHES =
  new Set([
    "normal",
    "holo",
    "reverse_holo",
  ]);

function readString(
  value: unknown,
): string {
  return typeof value ===
      "string"
    ? value.trim()
    : typeof value ===
        "number"
      ? String(value)
      : "";
}

function readQuantity(
  value: unknown,
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    1,
    Math.min(
      9999,
      Math.floor(parsed),
    ),
  );
}

function toNumber(
  value: unknown,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function isMissingColumnError(
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
    record.hint,
    record.code,
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
      ) ||
      text.includes(
        "column",
      )
    )
  );
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

    const cardId =
      readString(
        url.searchParams.get(
          "cardId",
        ),
      );

    const requestedFinish =
      readString(
        url.searchParams.get(
          "finish",
        ),
      ).toLowerCase();

    const finish =
      ALLOWED_FINISHES.has(
        requestedFinish,
      )
        ? requestedFinish
        : "normal";

    if (!cardId) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "card_id_missing",
            message:
              "A card ID is required.",
          },
        },
        {
          status: 400,
        },
      );
    }

    let finishSupported = true;

    let result: {
      data: unknown;
      error: unknown;
    } = await admin
      .from("inventory")
      .select(
        "id,quantity,location,status,finish",
      )
      .eq(
        "card_id",
        cardId,
      )
      .eq(
        "finish",
        finish,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      )
      .limit(1)
      .maybeSingle();

    if (
      result.error &&
      isMissingColumnError(
        result.error,
        "finish",
      )
    ) {
      finishSupported = false;

      result =
        await admin
          .from("inventory")
          .select(
            "id,quantity,location,status",
          )
          .eq(
            "card_id",
            cardId,
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          )
          .limit(1)
          .maybeSingle();
    }

    if (result.error) {
      throw result.error;
    }

    const inventory =
      result.data as
        | InventoryRow
        | null;

    return Response.json(
      {
        ok: true,
        inventory: inventory
          ? {
              id:
                String(
                  inventory.id,
                ),
              quantity:
                toNumber(
                  inventory.quantity,
                ),
              location:
                inventory.location,
              status:
                inventory.status,
              finish:
                finishSupported
                  ? inventory.finish ||
                    finish
                  : "normal",
            }
          : null,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error: unknown) {
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

    let body: AddInventoryBody;

    try {
      body =
        (await request.json()) as AddInventoryBody;
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "invalid_request_body",
            message:
              "The inventory request was not valid JSON.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const cardId =
      readString(body.cardId);

    const quantity =
      readQuantity(
        body.quantity,
      );

    const location =
      readString(
        body.location,
      ) ||
      "Main Inventory";

    const requestedFinish =
      readString(
        body.finish,
      ).toLowerCase();

    const finish =
      ALLOWED_FINISHES.has(
        requestedFinish,
      )
        ? requestedFinish
        : "normal";

    if (!cardId) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "card_id_missing",
            message:
              "Select a card before adding inventory.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const cardResult =
      await admin
        .from("pokemon_cards")
        .select(
          "id,name,set_name,card_no",
        )
        .eq("id", cardId)
        .maybeSingle();

    const card =
      (
        cardResult.data || null
      ) as
        | MasterCardRow
        | null;

    const cardError =
      cardResult.error;

    if (
      cardError ||
      !card
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "card_not_found",
            message:
              cardError?.message ||
              "The selected card is not in the master database.",
          },
        },
        {
          status: 404,
        },
      );
    }

    const cardName =
      typeof card.name === "string" &&
      card.name.trim()
        ? card.name.trim()
        : "Unknown card";

    let finishSupported = true;

    let currentQuery =
      admin
        .from("inventory")
        .select(
          "id,quantity,location,status,finish",
        )
        .eq(
          "card_id",
          cardId,
        )
        .eq(
          "finish",
          finish,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        )
        .limit(1);

    let currentResult =
      await currentQuery
        .maybeSingle();

    if (
      currentResult.error &&
      isMissingColumnError(
        currentResult.error,
        "finish",
      )
    ) {
      finishSupported = false;

      currentResult =
        await admin
          .from("inventory")
          .select(
            "id,quantity,location,status",
          )
          .eq(
            "card_id",
            cardId,
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          )
          .limit(1)
          .maybeSingle();
    }

    if (
      currentResult.error
    ) {
      throw currentResult.error;
    }

    const current =
      currentResult.data as
        | InventoryRow
        | null;

    const finalQuantity =
      toNumber(
        current?.quantity,
      ) + quantity;

    let inventoryId:
      | string
      | number;

    const basePayload:
      Record<string, unknown> = {
        quantity:
          finalQuantity,
        location,
        status:
          "in_stock",
        added_by:
          email,
        added_by_user_id:
          user.id,
      };

    if (finishSupported) {
      basePayload.finish =
        finish;
    }

    async function updateExisting(
      payload:
        Record<string, unknown>,
    ) {
      const inventoryTable =
        admin.from(
          "inventory",
        ) as any;

      return inventoryTable
        .update(payload)
        .eq(
          "id",
          current!.id,
        );
    }

    async function insertNew(
      payload:
        Record<string, unknown>,
    ) {
      const inventoryTable =
        admin.from(
          "inventory",
        ) as any;

      return inventoryTable
        .insert({
          card_id: cardId,
          ...payload,
        })
        .select("id")
        .single();
    }

    if (current) {
      inventoryId =
        current.id;

      let updateResult =
        await updateExisting(
          basePayload,
        );

      if (
        updateResult.error &&
        isMissingColumnError(
          updateResult.error,
          "added_by_user_id",
        )
      ) {
        const {
          added_by_user_id:
            _ignored,
          ...fallbackPayload
        } = basePayload;

        updateResult =
          await updateExisting(
            fallbackPayload,
          );
      }

      if (updateResult.error) {
        throw updateResult.error;
      }
    } else {
      let insertResult =
        await insertNew(
          basePayload,
        );

      if (
        insertResult.error &&
        isMissingColumnError(
          insertResult.error,
          "added_by_user_id",
        )
      ) {
        const {
          added_by_user_id:
            _ignored,
          ...fallbackPayload
        } = basePayload;

        insertResult =
          await insertNew(
            fallbackPayload,
          );
      }

      if (
        insertResult.error ||
        !insertResult.data
      ) {
        throw (
          insertResult.error ||
          new Error(
            "Inventory insert returned no row.",
          )
        );
      }

      inventoryId =
        (
          insertResult.data as {
            id:
              | string
              | number;
          }
        ).id;
    }

    /*
     * This audit table is separate from the
     * physical quantity record. Failure to
     * write audit history must not undo a
     * valid inventory addition.
     */
    const auditTable =
      admin.from(
        "admin_inventory_events",
      ) as any;

    const auditResult =
      await auditTable
        .insert({
          admin_user_id:
            user.id,
          admin_email:
            email,
          inventory_id:
            String(inventoryId),
          card_id:
            String(cardId),
          finish,
          quantity_delta:
            quantity,
          final_quantity:
            finalQuantity,
          event_type:
            "inventory_add",
          metadata: {
            card_name:
              cardName,
            location,
          },
        });

    if (
      auditResult.error
    ) {
      console.warn(
        "Inventory audit write failed:",
        auditResult.error.message,
      );
    }

    return Response.json(
      {
        ok: true,
        result: {
          inventoryId:
            String(inventoryId),
          cardId:
            String(cardId),
          cardName,
          quantityAdded:
            quantity,
          finalQuantity,
          location,
          finish:
            finishSupported
              ? finish
              : "normal",
          adminEmail:
            email,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(
      error,
    );
  }
}
