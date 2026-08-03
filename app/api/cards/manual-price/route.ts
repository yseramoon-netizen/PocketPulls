import { NextResponse } from "next/server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManualPriceRequest = {
  cardId?: unknown;
  card_id?: unknown;
  id?: unknown;

  inventoryId?: unknown;
  inventory_id?: unknown;

  marketValue?: unknown;
  market_value?: unknown;
};

type AuthorisedAdmin = {
  id: string;
  email: string | null;
};

class RouteError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name = "RouteError";
    this.status = status;
  }
}

function readString(
  ...values: unknown[]
): string {
  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function readAllowlist(
  value: string | undefined,
): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function authenticateAdmin(
  request: Request,
): Promise<AuthorisedAdmin> {
  const authorization =
    request.headers.get("authorization");

  const accessToken =
    authorization?.match(
      /^Bearer\s+(.+)$/i,
    )?.[1];

  if (!accessToken) {
    throw new RouteError(
      "Authentication required.",
      401,
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    accessToken,
  );

  if (error || !user) {
    throw new RouteError(
      "Your session could not be verified.",
      401,
    );
  }

  const allowedUserIds =
    readAllowlist(
      process.env
        .POCKETPULLS_ADMIN_USER_IDS,
    );

  const allowedEmails =
    readAllowlist(
      process.env
        .POCKETPULLS_ADMIN_EMAILS,
    ).map((email) =>
      email.toLowerCase(),
    );

  if (
    allowedUserIds.length === 0 &&
    allowedEmails.length === 0
  ) {
    throw new RouteError(
      "The PocketPulls admin allowlist has not been configured.",
      500,
    );
  }

  const normalisedEmail =
    user.email?.toLowerCase() ||
    null;

  const authorisedById =
    allowedUserIds.includes(
      user.id,
    );

  const authorisedByEmail =
    Boolean(
      normalisedEmail &&
        allowedEmails.includes(
          normalisedEmail,
        ),
    );

  if (
    !authorisedById &&
    !authorisedByEmail
  ) {
    throw new RouteError(
      "You are not authorised to alter card values.",
      403,
    );
  }

  return {
    id: user.id,
    email: normalisedEmail,
  };
}

async function resolveCardId(
  body: ManualPriceRequest,
): Promise<string> {
  /*
   * Accept the common card-ID field names first.
   */

  const suppliedCardId =
    readString(
      body.cardId,
      body.card_id,
      body.id,
    );

  if (suppliedCardId) {
    return suppliedCardId;
  }

  /*
   * If the browser only has the inventory record ID,
   * resolve its pokemon_cards ID on the server.
   */

  const inventoryId =
    readString(
      body.inventoryId,
      body.inventory_id,
    );

  if (!inventoryId) {
    throw new RouteError(
      "A card ID or inventory ID is required.",
      400,
    );
  }

  const {
    data: inventoryRow,
    error: inventoryError,
  } = await supabase
    .from("inventory")
    .select("card_id")
    .eq("id", inventoryId)
    .maybeSingle();

  if (inventoryError) {
    throw new RouteError(
      inventoryError.message,
      500,
    );
  }

  const resolvedCardId =
    readString(
      inventoryRow?.card_id,
    );

  if (!resolvedCardId) {
    throw new RouteError(
      "The inventory record does not reference a Pokémon card.",
      404,
    );
  }

  return resolvedCardId;
}

export async function POST(
  request: Request,
) {
  try {
    const admin =
      await authenticateAdmin(
        request,
      );

    let body: ManualPriceRequest;

    try {
      body =
        (await request.json()) as ManualPriceRequest;
    } catch {
      throw new RouteError(
        "The request body is invalid.",
        400,
      );
    }

    const cardId =
      await resolveCardId(body);

    const requestedValue =
      Number(
        body.marketValue ??
          body.market_value,
      );

    if (
      !Number.isFinite(
        requestedValue,
      ) ||
      requestedValue <= 0
    ) {
      throw new RouteError(
        "Enter a valid card value greater than £0.00.",
        400,
      );
    }

    if (requestedValue > 1_000_000) {
      throw new RouteError(
        "The supplied card value is outside the permitted range.",
        400,
      );
    }

    const roundedValue =
      Math.round(
        (requestedValue +
          Number.EPSILON) *
          100,
      ) / 100;

    const {
      data: existingCard,
      error: lookupError,
    } = await supabase
      .from("pokemon_cards")
      .select(`
        id,
        name
      `)
      .eq("id", cardId)
      .maybeSingle();

    if (lookupError) {
      throw new RouteError(
        lookupError.message,
        500,
      );
    }

    if (!existingCard) {
      throw new RouteError(
        "The selected Pokémon card no longer exists.",
        404,
      );
    }

    const updatedAt =
      new Date().toISOString();

    const {
      data: updatedCard,
      error: updateError,
    } = await supabase
      .from("pokemon_cards")
      .update({
        market_value:
          roundedValue,

        price_source:
          "manual",

        price_updated_at:
          updatedAt,
      })
      .eq("id", cardId)
      .select(`
        id,
        name,
        market_value,
        price_source,
        price_updated_at
      `)
      .maybeSingle();

    if (updateError) {
      throw new RouteError(
        updateError.message,
        500,
      );
    }

    if (!updatedCard) {
      throw new RouteError(
        "The card value was not updated.",
        500,
      );
    }

    console.info(
      "Manual card valuation saved:",
      {
        cardId:
          updatedCard.id,

        cardName:
          updatedCard.name,

        marketValue:
          updatedCard.market_value,

        changedBy:
          admin.email ||
          admin.id,
      },
    );

    return NextResponse.json(
      {
        success: true,

        card: {
          id:
            updatedCard.id,

          name:
            updatedCard.name,

          marketValue:
            Number(
              updatedCard.market_value,
            ),

          priceSource:
            updatedCard.price_source ||
            "manual",

          priceUpdatedAt:
            updatedCard.price_updated_at ||
            updatedAt,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "Manual price API error:",
      error,
    );

    if (
      error instanceof RouteError
    ) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "The manual card value could not be saved.",
      },
      {
        status: 500,
      },
    );
  }
}