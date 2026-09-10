import {
  getBearerToken,
  getServiceClient,
  getVerifiedUser,
  playerErrorResponse,
} from "@/lib/player/wish-store-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LooseDatabase = {
  from(table: string): any;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = (url.searchParams.get("session_id") || "").trim().slice(0, 240);

    if (!sessionId) {
      throw new Error("The purchase session is missing.");
    }

    const service = getServiceClient();
    const database = service as unknown as LooseDatabase;
    const token = getBearerToken(request);
    const user = await getVerifiedUser(service, token);

    const orderResult = await database
      .from("wish_purchase_orders")
      .select(
        "id,status,wishes,amount_pence,first_recharge,paid_at,stripe_checkout_session_id",
      )
      .eq("user_id", user.id)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (orderResult.error) {
      throw orderResult.error;
    }

    if (!orderResult.data) {
      throw new Error("This wish purchase could not be found for your account.");
    }

    const walletResult = await database
      .from("player_wallets")
      .select("wish_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletResult.error) {
      throw walletResult.error;
    }

    return Response.json(
      {
        ok: true,
        purchase: orderResult.data,
        wishBalance: Math.max(0, Number(walletResult.data?.wish_balance) || 0),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return playerErrorResponse(error, "The purchase status could not be checked.");
  }
}
