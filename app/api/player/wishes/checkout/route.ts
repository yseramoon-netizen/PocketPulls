import {
  applyFirstRechargeDiscount,
  getWishPackage,
} from "@/lib/player/wish-store";
import {
  getBearerToken,
  getServiceClient,
  getVerifiedUser,
  playerErrorResponse,
} from "@/lib/player/wish-store-server";
import { PURCHASE_CONSENT_VERSION } from "@/lib/player/purchase-consent";
import {
  areOrdersOpen,
  ORDERS_NOT_READY_MESSAGE,
} from "@/lib/player/orders";
import { getPlayerPurchaseGate } from "@/lib/launch/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* eslint-disable @typescript-eslint/no-explicit-any -- V66 purchase tables and RPCs are newer than the generated Supabase schema */

type CheckoutBody = {
  packageId?: unknown;
  requestId?: unknown;
};

type LooseDatabase = {
  from(table: string): any;
  rpc(
    name: string,
    parameters?: Record<string, unknown>,
  ): Promise<{ data: any; error: any }>;
};

function readPackageId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

async function createStripeCheckout(input: {
  secret: string;
  origin: string;
  orderId: string;
  userId: string;
  email: string | null;
  packageId: string;
  packageName: string;
  wishes: number;
  amountPence: number;
  firstRecharge: boolean;
  idempotencyKey: string;
}) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set(
    "success_url",
    `${input.origin}/wishes/shop?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
  );
  body.set("cancel_url", `${input.origin}/wishes/shop?purchase=cancelled`);
  body.set("client_reference_id", input.userId);
  body.set("expires_at", String(Math.floor(Date.now() / 1000) + 31 * 60));
  body.set("line_items[0][price_data][currency]", "gbp");
  body.set(
    "line_items[0][price_data][product_data][name]",
    `${input.wishes} ancientpulls Wish${input.wishes === 1 ? "" : "es"}`,
  );
  body.set(
    "line_items[0][price_data][product_data][description]",
    input.firstRecharge
      ? `${input.packageName} · first recharge discount applied`
      : `${input.packageName} · wish credit recharge`,
  );
  body.set("line_items[0][price_data][unit_amount]", String(input.amountPence));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[order_id]", input.orderId);
  body.set("metadata[user_id]", input.userId);
  body.set("metadata[package_id]", input.packageId);
  body.set("metadata[wishes]", String(input.wishes));
  body.set("metadata[first_recharge]", input.firstRecharge ? "true" : "false");
  body.set("payment_intent_data[metadata][order_id]", input.orderId);
  body.set("payment_intent_data[metadata][user_id]", input.userId);

  if (input.email) {
    body.set("customer_email", input.email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    id?: unknown;
    url?: unknown;
    error?: { message?: unknown };
  };

  if (!response.ok) {
    const message =
      typeof payload.error?.message === "string" && payload.error.message.trim()
        ? payload.error.message.trim()
        : "Stripe could not create the checkout session.";
    throw new Error(message);
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  const url = typeof payload.url === "string" ? payload.url : "";

  if (!id || !url) {
    throw new Error("Stripe returned an incomplete checkout session.");
  }

  return { id, url };
}

export async function POST(request: Request) {
  try {
    let body: CheckoutBody;

    try {
      body = (await request.json()) as CheckoutBody;
    } catch {
      throw new Error("The wish purchase request was not valid JSON.");
    }

    const packageId = readPackageId(body.packageId);
    const requestId = readPackageId(body.requestId);
    const wishPackage = getWishPackage(packageId);

    if (!wishPackage) {
      throw new Error("Choose a valid wish package.");
    }

    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
      throw new Error("Checkout request ID is missing or invalid.");
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

    if (!areOrdersOpen() || !stripeSecret) {
      return Response.json(
        {
          ok: false,
          error: { message: ORDERS_NOT_READY_MESSAGE },
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const service = getServiceClient();
    const database = service as unknown as LooseDatabase;
    const token = getBearerToken(request);
    const user = await getVerifiedUser(service, token);

    const launchGate = await getPlayerPurchaseGate(database, user);

    if (!launchGate.allowed) {
      return Response.json(
        {
          ok: false,
          error: {
            message: launchGate.reason || ORDERS_NOT_READY_MESSAGE,
          },
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const consentResult = await database
      .from("player_legal_consents")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("consent_version", PURCHASE_CONSENT_VERSION)
      .eq("age_18_confirmed", true)
      .eq("random_physical_card_ack", true)
      .eq("terms_ack", true)
      .maybeSingle();

    if (consentResult.error) {
      throw consentResult.error;
    }

    if (!consentResult.data) {
      throw new Error(
        "Your trainer account must accept the current purchase terms before recharging wishes.",
      );
    }

    const orderResult = await database.rpc(
      "create_guarded_wish_purchase_order",
      {
        p_user_id: user.id,
        p_email: user.email || "",
        p_package_id: wishPackage.id,
        p_wishes: wishPackage.wishes,
        p_base_amount_pence: wishPackage.amountPence,
        p_first_recharge_amount_pence: applyFirstRechargeDiscount(
          wishPackage.amountPence,
        ),
        p_client_request_id: requestId,
      },
    );

    if (orderResult.error) throw orderResult.error;

    const orderRow = Array.isArray(orderResult.data)
      ? orderResult.data[0]
      : orderResult.data;
    const orderId = typeof orderRow?.order_id === "string"
      ? orderRow.order_id
      : "";
    const firstRecharge = orderRow?.first_recharge === true;
    const amountPence = Number(orderRow?.amount_pence);
    const existingCheckoutUrl =
      typeof orderRow?.existing_checkout_url === "string"
        ? orderRow.existing_checkout_url.trim()
        : "";

    if (!orderId || !Number.isFinite(amountPence) || amountPence < 1) {
      throw new Error("The wish order could not be created.");
    }

    if (existingCheckoutUrl) {
      return Response.json(
        {
          ok: true,
          checkoutUrl: existingCheckoutUrl,
          orderId,
          firstRecharge,
          wishes: wishPackage.wishes,
          amountPence,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const stripe = await createStripeCheckout({
        secret: stripeSecret,
        origin: new URL(request.url).origin,
        orderId,
        userId: user.id,
        email: user.email ?? null,
        packageId: wishPackage.id,
        packageName: wishPackage.name,
        wishes: wishPackage.wishes,
        amountPence,
        firstRecharge,
        idempotencyKey: `ancient-pulls-order-${orderId}`,
      });

      const updateResult = await database
        .from("wish_purchase_orders")
        .update({
          stripe_checkout_session_id: stripe.id,
          stripe_checkout_session_url: stripe.url,
        })
        .eq("id", orderId)
        .eq("user_id", user.id);

      if (updateResult.error) {
        throw updateResult.error;
      }

      return Response.json(
        {
          ok: true,
          checkoutUrl: stripe.url,
          orderId,
          firstRecharge,
          wishes: wishPackage.wishes,
          amountPence,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } catch (stripeError: unknown) {
      await database
        .from("wish_purchase_orders")
        .update({
          failure_reason:
            stripeError instanceof Error
              ? stripeError.message.slice(0, 1000)
              : "Stripe checkout creation failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "pending");
      throw stripeError;
    }
  } catch (error: unknown) {
    return playerErrorResponse(error, "The wish checkout could not be started.");
  }
}
