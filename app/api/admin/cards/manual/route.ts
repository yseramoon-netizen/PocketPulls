import {
  randomUUID,
} from "node:crypto";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ManualCardBody = {
  name?: unknown;
  setName?: unknown;
  cardNumber?: unknown;
  rarity?: unknown;
  imageUrl?: unknown;
  marketValue?: unknown;
};

type ManualCardRow = {
  id: string | number;
  name: string | null;
  rarity: string | null;
  set_name: string | null;
  card_no: string | null;
  image_url: string | null;
  market_value:
    | number
    | string
    | null;
  api_id: string | null;
};

function readString(
  value: unknown,
  maxLength: number,
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

function readMoney(
  value: unknown,
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return Math.round(
    parsed * 100,
  ) / 100;
}

function isHttpUrl(
  value: string,
): boolean {
  if (!value) {
    return true;
  }

  try {
    const url =
      new URL(value);

    return (
      url.protocol ===
        "https:" ||
      url.protocol ===
        "http:"
    );
  } catch {
    return false;
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
      ManualCardBody;

    try {
      body =
        (await request.json()) as
          ManualCardBody;
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "invalid_manual_card_body",
            message:
              "The manual card request was not valid JSON.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const name =
      readString(
        body.name,
        180,
      );

    const setName =
      readString(
        body.setName,
        180,
      );

    const cardNumber =
      readString(
        body.cardNumber,
        80,
      );

    const rarity =
      readString(
        body.rarity,
        120,
      );

    const imageUrl =
      readString(
        body.imageUrl,
        1200,
      );

    const marketValue =
      readMoney(
        body.marketValue,
      );

    if (
      !name ||
      !setName ||
      !cardNumber
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "manual_card_required_fields",
            message:
              "Card name, set and collector number are required.",
          },
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isHttpUrl(imageUrl)
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "manual_card_invalid_image",
            message:
              "The card image must be a valid HTTP or HTTPS URL.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const cardsTable =
      admin.from(
        "pokemon_cards",
      ) as any;

    const duplicateResult =
      await cardsTable
        .select(
          "id,name,rarity,set_name,card_no,image_url,market_value,api_id",
        )
        .ilike(
          "name",
          name,
        )
        .ilike(
          "set_name",
          setName,
        )
        .ilike(
          "card_no",
          cardNumber,
        )
        .limit(1)
        .maybeSingle();

    if (
      duplicateResult.error
    ) {
      throw duplicateResult.error;
    }

    if (
      duplicateResult.data
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code:
              "manual_card_already_exists",
            message:
              "That name, set and collector number already exist in the card database.",
          },
          existingCard:
            duplicateResult.data,
        },
        {
          status: 409,
        },
      );
    }

    const apiId =
      `manual-${randomUUID()}`;

    const insertResult =
      await cardsTable
        .insert({
          api_id:
            apiId,
          name,
          set_name:
            setName,
          card_no:
            cardNumber,
          rarity:
            rarity || null,
          image_url:
            imageUrl || null,
          market_value:
            marketValue,
        })
        .select(
          "id,name,rarity,set_name,card_no,image_url,market_value,api_id",
        )
        .single();

    if (
      insertResult.error ||
      !insertResult.data
    ) {
      throw (
        insertResult.error ||
        new Error(
          "The manual card insert returned no row.",
        )
      );
    }

    const card =
      insertResult.data as
        ManualCardRow;

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
            null,
          card_id:
            String(card.id),
          finish:
            null,
          quantity_delta:
            0,
          final_quantity:
            0,
          event_type:
            "manual_card_created",
          metadata: {
            card_name:
              card.name,
            set_name:
              card.set_name,
            card_number:
              card.card_no,
            api_id:
              card.api_id,
          },
        });

    if (
      auditResult.error
    ) {
      console.warn(
        "Manual card audit write failed:",
        auditResult.error,
      );
    }

    return Response.json(
      {
        ok: true,
        card,
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
