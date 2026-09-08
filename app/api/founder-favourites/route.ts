import { NextResponse } from "next/server";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FounderOwner =
  | "lukas"
  | "skye";

type FavouriteDatabaseRow = {
  owner: FounderOwner;
  card_id: string;
  updated_at: string;
};

type PokemonCardDatabaseRow = {
  id: unknown;
  name: string;
  rarity: string | null;
  set_name: string | null;
  card_no: string | null;
  image_url: string | null;
  market_value: number | string | null;
};

type FavouriteRequest = {
  cardId?: unknown;
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

function normaliseIdentifier(
  value: unknown,
): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return "";
}

function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function readAllowlist(
  value: string | undefined,
): string[] {
  return (value || "")
    .split(",")
    .map((entry) =>
      entry.trim(),
    )
    .filter(Boolean);
}

async function authenticate(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

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

  return user;
}

function resolveFounder(
  user: {
    id: string;
    email?: string | null;
  },
): FounderOwner | null {
  const lukasIds =
    readAllowlist(
      process.env
        .POCKETPULLS_LUKAS_USER_IDS,
    );

  const skyeIds =
    readAllowlist(
      process.env
        .POCKETPULLS_SKYE_USER_IDS,
    );

  const lukasEmails =
    readAllowlist(
      process.env
        .POCKETPULLS_LUKAS_EMAILS,
    ).map((email) =>
      email.toLowerCase(),
    );

  const skyeEmails =
    readAllowlist(
      process.env
        .POCKETPULLS_SKYE_EMAILS,
    ).map((email) =>
      email.toLowerCase(),
    );

  const email =
    user.email
      ?.trim()
      .toLowerCase() || "";

  const isLukas =
    lukasIds.includes(user.id) ||
    Boolean(
      email &&
        lukasEmails.includes(email),
    );

  const isSkye =
    skyeIds.includes(user.id) ||
    Boolean(
      email &&
        skyeEmails.includes(email),
    );

  if (isLukas && isSkye) {
    throw new RouteError(
      "This account is assigned to both founder profiles. Correct the environment configuration.",
      500,
    );
  }

  if (isLukas) {
    return "lukas";
  }

  if (isSkye) {
    return "skye";
  }

  return null;
}

async function loadFavourites(
  viewerOwner: FounderOwner | null,
) {
  const {
    data: favouriteData,
    error: favouriteError,
  } = await supabase
    .from("founder_favourites")
    .select(`
      owner,
      card_id,
      updated_at
    `);

  if (favouriteError) {
    throw new RouteError(
      favouriteError.message,
      500,
    );
  }

  const favouriteRows =
    (favouriteData ||
      []) as FavouriteDatabaseRow[];

  const cardIds = [
    ...new Set(
      favouriteRows
        .map((row) =>
          normaliseIdentifier(
            row.card_id,
          ),
        )
        .filter(Boolean),
    ),
  ];

  const cardRows:
    PokemonCardDatabaseRow[] = [];

  if (cardIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("pokemon_cards")
      .select(`
        id,
        name,
        rarity,
        set_name,
        card_no,
        image_url,
        market_value
      `)
      .in("id", cardIds);

    if (error) {
      throw new RouteError(
        error.message,
        500,
      );
    }

    cardRows.push(
      ...((data ||
        []) as PokemonCardDatabaseRow[]),
    );
  }

  const cardsById =
    new Map<
      string,
      PokemonCardDatabaseRow
    >();

  for (const card of cardRows) {
    const cardId =
      normaliseIdentifier(
        card.id,
      );

    if (cardId) {
      cardsById.set(
        cardId,
        card,
      );
    }
  }

  function createFavourite(
    owner: FounderOwner,
  ) {
    const favourite =
      favouriteRows.find(
        (row) =>
          row.owner === owner,
      );

    if (!favourite) {
      return null;
    }

    const cardId =
      normaliseIdentifier(
        favourite.card_id,
      );

    const card =
      cardsById.get(cardId);

    if (!card) {
      return null;
    }

    return {
      owner,

      founderName:
        owner === "lukas"
          ? "Lukas"
          : "Skye",

      updatedAt:
        favourite.updated_at,

      card: {
        id: cardId,

        name:
          card.name ||
          "Unknown Pokemon",

        rarity:
          card.rarity ||
          "Unknown rarity",

        setName:
          card.set_name ||
          "Unknown set",

        cardNumber:
          card.card_no ||
          "",

        imageUrl:
          card.image_url ||
          null,

        marketValue:
          toNumber(
            card.market_value,
          ),
      },
    };
  }

  return {
    success: true,

    viewerOwner,

    favourites: {
      lukas:
        createFavourite(
          "lukas",
        ),

      skye:
        createFavourite(
          "skye",
        ),
    },
  };
}

export async function GET(
  request: Request,
) {
  try {
    const user =
      await authenticate(request);

    const viewerOwner =
      resolveFounder(user);

    const response =
      await loadFavourites(
        viewerOwner,
      );

    return NextResponse.json(
      response,
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "Founder favourites GET error:",
      error,
    );

    const status =
      error instanceof RouteError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "The founder favourites could not be loaded.",
      },
      {
        status,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const user =
      await authenticate(request);

    const owner =
      resolveFounder(user);

    if (!owner) {
      throw new RouteError(
        "Only the configured Lukas and Skye accounts can change founder favourites.",
        403,
      );
    }

    let body: FavouriteRequest;

    try {
      body =
        (await request.json()) as FavouriteRequest;
    } catch {
      throw new RouteError(
        "The request body is invalid.",
        400,
      );
    }

    const requestedCardId =
      normaliseIdentifier(
        body.cardId,
      );

    if (!requestedCardId) {
      throw new RouteError(
        "A valid card ID is required.",
        400,
      );
    }

    const {
      data: selectedCard,
      error: cardError,
    } = await supabase
      .from("pokemon_cards")
      .select(`
        id,
        name
      `)
      .eq(
        "id",
        requestedCardId,
      )
      .maybeSingle();

    if (cardError) {
      throw new RouteError(
        cardError.message,
        500,
      );
    }

    if (!selectedCard) {
      throw new RouteError(
        "The selected Pokemon card does not exist.",
        404,
      );
    }

    const cardId =
      normaliseIdentifier(
        selectedCard.id,
      );

    if (!cardId) {
      throw new RouteError(
        "The selected card has an invalid database ID.",
        500,
      );
    }

    const updatedAt =
      new Date().toISOString();

    const {
      error: favouriteError,
    } = await supabase
      .from("founder_favourites")
      .upsert(
        {
          owner,
          card_id: cardId,
          updated_by:
            user.id,
          updated_at:
            updatedAt,
        },
        {
          onConflict:
            "owner",
        },
      );

    if (favouriteError) {
      throw new RouteError(
        favouriteError.message,
        500,
      );
    }

    console.info(
      "Founder favourite updated:",
      {
        owner,
        cardId,
        cardName:
          selectedCard.name,

        changedBy:
          user.email ||
          user.id,
      },
    );

    const response =
      await loadFavourites(owner);

    return NextResponse.json(
      response,
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "Founder favourites POST error:",
      error,
    );

    const status =
      error instanceof RouteError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "The founder favourite could not be saved.",
      },
      {
        status,
      },
    );
  }
}