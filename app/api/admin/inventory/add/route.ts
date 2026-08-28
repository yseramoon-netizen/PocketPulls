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
  condition?: unknown;
  language?: unknown;
  requestId?: unknown;
  source?: unknown;
};

const ALLOWED_FINISHES = new Set(["normal", "holo", "reverse_holo"]);
const ALLOWED_CONDITIONS = new Set([
  "mint",
  "near_mint",
  "excellent",
  "good",
  "played",
  "poor",
]);

function readString(value: unknown, maximum = 500): string {
  if (typeof value === "string") return value.trim().slice(0, maximum);
  if (typeof value === "number") return String(value);
  return "";
}

function readQuantity(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(9999, Math.floor(parsed)))
    : 0;
}

function readFinish(value: unknown): string {
  const finish = readString(value, 40).toLowerCase();
  return ALLOWED_FINISHES.has(finish) ? finish : "normal";
}

function readCondition(value: unknown): string {
  const condition = readString(value, 40).toLowerCase().replace(/\s+/g, "_");
  return ALLOWED_CONDITIONS.has(condition) ? condition : "near_mint";
}

function noStore(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const url = new URL(request.url);
    const cardId = readString(url.searchParams.get("cardId"), 100);
    const finish = readFinish(url.searchParams.get("finish"));
    const condition = readCondition(url.searchParams.get("condition"));
    const language = readString(url.searchParams.get("language"), 40) || "English";
    const location = readString(url.searchParams.get("location"), 160);

    if (!cardId) {
      return noStore({
        ok: false,
        error: { code: "card_id_missing", message: "A card ID is required." },
      }, 400);
    }

    let query = admin
      .from("inventory")
      .select("id,quantity,location,status,finish,card_condition,card_language")
      .eq("card_id", cardId)
      .eq("finish", finish)
      .eq("card_condition", condition)
      .ilike("card_language", language);

    if (location) query = query.eq("location", location);

    const result = await query
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (result.error) throw result.error;

    return noStore({
      ok: true,
      inventory: result.data
        ? {
            id: String(result.data.id),
            quantity: Math.max(0, Number(result.data.quantity) || 0),
            location: result.data.location,
            status: result.data.status,
            finish: result.data.finish || finish,
            condition: result.data.card_condition || condition,
            language: result.data.card_language || language,
          }
        : null,
    });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, email, admin } = await requireAdmin(request);
    let body: AddInventoryBody;

    try {
      body = await request.json() as AddInventoryBody;
    } catch {
      return noStore({
        ok: false,
        error: {
          code: "invalid_request_body",
          message: "The inventory request was not valid JSON.",
        },
      }, 400);
    }

    const cardId = readString(body.cardId, 100);
    const quantity = readQuantity(body.quantity);
    const location = readString(body.location, 160) || "Main Inventory";
    const finish = readFinish(body.finish);
    const condition = readCondition(body.condition);
    const language = readString(body.language, 40) || "English";
    const requestId = readString(body.requestId, 160);
    const requestedSource = readString(body.source, 30).toLowerCase();
    const source = requestedSource === "scanner" || requestedSource === "scanner_review"
      ? requestedSource
      : "manual";

    if (!cardId || quantity < 1) {
      return noStore({
        ok: false,
        error: {
          code: "invalid_inventory_item",
          message: "Select a card and enter a valid quantity.",
        },
      }, 400);
    }

    if (!/^[A-Za-z0-9:_-]{16,160}$/.test(requestId)) {
      return noStore({
        ok: false,
        error: {
          code: "inventory_request_id_missing",
          message: "This inventory request cannot be safely retried. Reopen the scanner and try again.",
        },
      }, 400);
    }

    const result = await admin.rpc("admin_add_inventory_idempotent", {
      p_admin_user_id: user.id,
      p_admin_email: email,
      p_card_id: cardId,
      p_quantity: quantity,
      p_location: location,
      p_finish: finish,
      p_card_condition: condition,
      p_card_language: language,
      p_idempotency_key: requestId,
      p_source: source,
    });

    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row?.inventory_id) {
      throw new Error("The inventory transaction returned no record.");
    }

    return noStore({
      ok: true,
      result: {
        inventoryId: String(row.inventory_id),
        cardId: String(row.card_id),
        cardName: readString(row.card_name, 300) || "Unknown card",
        quantityAdded: Number(row.quantity_added) || quantity,
        finalQuantity: Number(row.final_quantity) || quantity,
        location: readString(row.location, 160) || location,
        finish: readFinish(row.finish),
        condition: readCondition(row.card_condition),
        language: readString(row.card_language, 40) || language,
        adminEmail: email,
        source,
      },
    });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
