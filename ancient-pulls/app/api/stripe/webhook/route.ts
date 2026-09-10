import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  getServiceClient,
  requireEnvironment,
} from "@/lib/player/wish-store-server";
import { sendWishOrderConfirmation } from "@/lib/player/order-confirmation";

/* eslint-disable @typescript-eslint/no-explicit-any -- this export does not include generated Supabase database types */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: unknown;
  };
};

type StripeCheckoutSession = {
  id?: unknown;
  payment_status?: unknown;
  payment_intent?: unknown;
  metadata?: unknown;
  customer_email?: unknown;
  customer_details?: {
    email?: unknown;
  } | null;
};

function parseStripeSignature(header: string) {
  const timestamp = header
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("t="))
    ?.slice(2);

  const signatures = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return {
    timestamp: timestamp ? Number(timestamp) : NaN,
    signatures,
  };
}

function safeHexEqual(leftHex: string, rightHex: string): boolean {
  try {
    const left = Buffer.from(leftHex, "hex");
    const right = Buffer.from(rightHex, "hex");

    if (left.length === 0 || left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): void {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new Error("Stripe webhook signature is malformed.");
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);

  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Stripe webhook signature is outside the allowed time window.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!signatures.some((signature) => safeHexEqual(signature, expected))) {
    throw new Error("Stripe webhook signature verification failed.");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function completePurchase(
  session: StripeCheckoutSession,
  requestOrigin: string,
) {
  const checkoutSessionId = readString(session.id);
  const paymentIntentId = readString(session.payment_intent);
  const metadata = asRecord(session.metadata);
  const orderId = readString(metadata?.order_id);

  if (!checkoutSessionId || !orderId) {
    throw new Error("Paid Stripe session is missing ancientpulls order metadata.");
  }

  const service = getServiceClient();
  const database = service as unknown as {
    rpc(
      name: string,
      parameters: Record<string, unknown>,
    ): Promise<{ data: unknown; error: unknown }>;
    from(table: string): any;
    auth: {
      admin: {
        getUserById(userId: string): Promise<{
          data: { user: { email?: string | null } | null };
          error: unknown;
        }>;
      };
    };
  };

  const result = await database.rpc("complete_wish_purchase", {
    p_order_id: orderId,
    p_checkout_session_id: checkoutSessionId,
    p_payment_intent_id: paymentIntentId || null,
  });

  if (result.error) {
    throw result.error;
  }

  const orderResult = await database
    .from("wish_purchase_orders")
    .select(
      "id,user_id,package_id,wishes,amount_pence,currency,first_recharge,paid_at,confirmation_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) {
    throw orderResult.error;
  }

  const order = orderResult.data as {
    id?: unknown;
    user_id?: unknown;
    package_id?: unknown;
    wishes?: unknown;
    amount_pence?: unknown;
    currency?: unknown;
    first_recharge?: unknown;
    paid_at?: unknown;
    confirmation_sent_at?: unknown;
  } | null;

  if (!order || readString(order.confirmation_sent_at)) {
    return;
  }

  const userId = readString(order.user_id);
  let recipient =
    readString(session.customer_details?.email) ||
    readString(session.customer_email);

  if (!recipient && userId) {
    const userResult = await database.auth.admin.getUserById(userId);
    if (userResult.error) throw userResult.error;
    recipient = userResult.data.user?.email?.trim() || "";
  }

  if (!recipient) {
    throw new Error("The paid order has no email address for its confirmation.");
  }

  await sendWishOrderConfirmation({
    recipient,
    siteOrigin: requestOrigin,
    order: {
      id: readString(order.id),
      packageId: readString(order.package_id),
      wishes: Math.max(0, Math.floor(Number(order.wishes) || 0)),
      amountPence: Math.max(0, Math.floor(Number(order.amount_pence) || 0)),
      currency: readString(order.currency) || "gbp",
      firstRecharge: order.first_recharge === true,
      paidAt: readString(order.paid_at) || null,
    },
  });

  const confirmationResult = await database
    .from("wish_purchase_orders")
    .update({
      confirmation_sent_at: new Date().toISOString(),
      confirmation_email: recipient,
    })
    .eq("id", orderId)
    .is("confirmation_sent_at", null);

  if (confirmationResult.error) {
    throw confirmationResult.error;
  }
}

async function expirePurchase(session: StripeCheckoutSession) {
  const checkoutSessionId = readString(session.id);

  if (!checkoutSessionId) {
    return;
  }

  const service = getServiceClient();
  const database = service as unknown as {
    from(table: string): any;
  };

  await database
    .from("wish_purchase_orders")
    .update({ status: "expired" })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .eq("status", "pending");
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature") || "";

    verifyStripeSignature(
      rawBody,
      signatureHeader,
      requireEnvironment(["STRIPE_WEBHOOK_SECRET"]),
    );

    const event = JSON.parse(rawBody) as StripeEvent;
    const eventType = readString(event.type);
    const session = (event.data?.object ?? {}) as StripeCheckoutSession;

    if (
      (eventType === "checkout.session.completed" &&
        readString(session.payment_status) === "paid") ||
      eventType === "checkout.session.async_payment_succeeded"
    ) {
      await completePurchase(session, new URL(request.url).origin);
    } else if (eventType === "checkout.session.expired") {
      await expirePurchase(session);
    }

    return Response.json({ received: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Stripe webhook processing failed.";

    console.error("Stripe wish webhook error:", error);

    return Response.json(
      {
        received: false,
        error: { message },
      },
      { status: 400 },
    );
  }
}
