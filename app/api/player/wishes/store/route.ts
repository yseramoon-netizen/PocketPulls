import {
  FIRST_RECHARGE_DISCOUNT_PERCENT,
  WISH_PACKAGES,
  applyFirstRechargeDiscount,
} from "@/lib/player/wish-store";
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
    const service = getServiceClient();
    const database = service as unknown as LooseDatabase;
    const token = getBearerToken(request);
    const user = await getVerifiedUser(service, token);

    const [paidResult, reservationResult] = await Promise.all([
      database
        .from("wish_purchase_orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .limit(1),
      database
        .from("wish_purchase_orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("first_recharge", true)
        .in("status", ["pending", "paid"])
        .limit(1),
    ]);

    if (paidResult.error) {
      throw paidResult.error;
    }

    if (reservationResult.error) {
      throw reservationResult.error;
    }

    const hasPaidRecharge = Array.isArray(paidResult.data) && paidResult.data.length > 0;
    const hasReservedFirstRecharge =
      Array.isArray(reservationResult.data) && reservationResult.data.length > 0;
    const firstRechargeAvailable =
      !hasPaidRecharge && !hasReservedFirstRecharge;

    return Response.json(
      {
        ok: true,
        firstRechargeAvailable,
        firstRechargeDiscountPercent: FIRST_RECHARGE_DISCOUNT_PERCENT,
        packages: WISH_PACKAGES.map((item) => ({
          ...item,
          firstRechargeAmountPence: applyFirstRechargeDiscount(item.amountPence),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return playerErrorResponse(error, "The wish shop could not be loaded.");
  }
}
