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
import {
  CHECKOUT_ACKNOWLEDGEMENT_VERSION,
  PURCHASE_CONSENT_VERSION,
} from "@/lib/player/purchase-consent";
import {
  areOrdersOpen,
  ORDERS_NOT_READY_MESSAGE,
} from "@/lib/player/orders";
import { getConfiguredPublicOrigin } from "@/lib/auth/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any -- this export does not include generated Supabase database types */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckoutBody = {
  packageId?: unknown;
  purchaseAcknowledged?: unknown;
  immediateAccessRequested?: unknown;
};

type LooseDatabase = {
  from(table: string): any;
};

const REUSABLE_CHECKOUT_WINDOW_MS = 30 * 60 * 1_000;

function readPackageId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function readStripeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function createPendingOrder(
  database: LooseDatabase,
  input: {
    userId: string;
    packageId: string;
    wishes: number;
    baseAmountPence: number;
    firstRecharge: boolean;
    amountPence: number;
    purchaseAcknowledged: boolean;
    immediateAccessRequested: boolean;
  },
) {
  const discountPence = Math.max(0, input.baseAmountPence - input.amountPence);

  const result = await database
    .from("wish_purchase_orders")
    .insert({
      user_id: input.userId,
      package_id: input.packageId,
      wishes: input.wishes,
      base_amount_pence: input.baseAmountPence,
      discount_pence: discountPence,
      amount_pence: input.amountPence,
      currency: "gbp",
      first_recharge: input.firstRecharge,
      status: "pending",
      checkout_acknowledgement_version: CHECKOUT_ACKNOWLEDGEMENT_VERSION,
      checkout_acknowledged_at: new Date().toISOString(),
      immediate_access_requested: input.immediateAccessRequested,
    })
    .select("id")
    .single();

  return result as {
    data: { id?: unknown } | null;
    error: { code?: string; message?: string } | null;
  };
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
      ? `${input.packageName} · random physical trading-card wish credits · first recharge discount applied`
      : `${input.packageName} · random physical trading-card wish credits`,
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
      "Idempotency-Key": `ancient-pulls-checkout-${input.orderId}`,
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
  const url = readStripeCheckoutUrl(payload.url) || "";

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
    const wishPackage = getWishPackage(packageId);

    if (!wishPackage) {
      throw new Error("Choose a valid wish package.");
    }

    if (
      body.purchaseAcknowledged !== true ||
      body.immediateAccessRequested !== true
    ) {
      throw new Error(
        "Confirm the price, random physical-card purchase and immediate-access request before continuing to payment.",
      );
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

    const reusableCheckoutCutoff = new Date(
      Date.now() - REUSABLE_CHECKOUT_WINDOW_MS,
    ).toISOString();

    const [reusableCheckoutResult, paidResult, reservationResult] =
      await Promise.all([
        database
          .from("wish_purchase_orders")
          .select(
            "id,wishes,amount_pence,first_recharge,stripe_checkout_session_url,checkout_acknowledgement_version,immediate_access_requested",
          )
          .eq("user_id", user.id)
          .eq("package_id", wishPackage.id)
          .eq("status", "pending")
          .gte("created_at", reusableCheckoutCutoff)
          .not("stripe_checkout_session_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
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

    if (reusableCheckoutResult.error) {
      throw reusableCheckoutResult.error;
    }

    if (paidResult.error) {
      throw paidResult.error;
    }

    if (reservationResult.error) {
      throw reservationResult.error;
    }

    const reusableCheckout = reusableCheckoutResult.data as
      | {
          id?: unknown;
          wishes?: unknown;
          amount_pence?: unknown;
          first_recharge?: unknown;
          stripe_checkout_session_url?: unknown;
          checkout_acknowledgement_version?: unknown;
          immediate_access_requested?: unknown;
        }
      | null;
    const reusableCheckoutUrl = readStripeCheckoutUrl(
      reusableCheckout?.stripe_checkout_session_url,
    );
    const reusableOrderId =
      typeof reusableCheckout?.id === "string" ? reusableCheckout.id : "";
    const reusableWishes = Number(reusableCheckout?.wishes);
    const reusableAmountPence = Number(reusableCheckout?.amount_pence);

    if (
      reusableCheckoutUrl &&
      reusableOrderId &&
      reusableCheckout?.checkout_acknowledgement_version ===
        CHECKOUT_ACKNOWLEDGEMENT_VERSION &&
      reusableCheckout?.immediate_access_requested === true &&
      Number.isSafeInteger(reusableWishes) &&
      reusableWishes === wishPackage.wishes &&
      Number.isSafeInteger(reusableAmountPence) &&
      reusableAmountPence > 0
    ) {
      return Response.json(
        {
          ok: true,
          checkoutUrl: reusableCheckoutUrl,
          orderId: reusableOrderId,
          firstRecharge: reusableCheckout?.first_recharge === true,
          wishes: reusableWishes,
          amountPence: reusableAmountPence,
          reused: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const hasPaidRecharge = Array.isArray(paidResult.data) && paidResult.data.length > 0;
    const hasReservedFirstRecharge =
      Array.isArray(reservationResult.data) && reservationResult.data.length > 0;

    let firstRecharge = !hasPaidRecharge && !hasReservedFirstRecharge;
    let amountPence = firstRecharge
      ? applyFirstRechargeDiscount(wishPackage.amountPence)
      : wishPackage.amountPence;

    let orderResult = await createPendingOrder(database, {
      userId: user.id,
      packageId: wishPackage.id,
      wishes: wishPackage.wishes,
      baseAmountPence: wishPackage.amountPence,
      firstRecharge,
      amountPence,
      purchaseAcknowledged: true,
      immediateAccessRequested: true,
    });

    if (orderResult.error?.code === "23505" && firstRecharge) {
      firstRecharge = false;
      amountPence = wishPackage.amountPence;
      orderResult = await createPendingOrder(database, {
        userId: user.id,
        packageId: wishPackage.id,
        wishes: wishPackage.wishes,
        baseAmountPence: wishPackage.amountPence,
        firstRecharge,
        amountPence,
        purchaseAcknowledged: true,
        immediateAccessRequested: true,
      });
    }

    if (orderResult.error) {
      throw orderResult.error;
    }

    const orderId =
      typeof orderResult.data?.id === "string" ? orderResult.data.id : "";

    if (!orderId) {
      throw new Error("The wish order could not be created.");
    }

    try {
      const stripe = await createStripeCheckout({
        secret: stripeSecret,
        origin: getConfiguredPublicOrigin() || new URL(request.url).origin,
        orderId,
        userId: user.id,
        email: user.email ?? null,
        packageId: wishPackage.id,
        packageName: wishPackage.name,
        wishes: wishPackage.wishes,
        amountPence,
        firstRecharge,
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
        .update({ status: "failed" })
        .eq("id", orderId)
        .eq("status", "pending");
      throw stripeError;
    }
  } catch (error: unknown) {
    return playerErrorResponse(error, "The wish checkout could not be started.");
  }
}
