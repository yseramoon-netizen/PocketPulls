import {
  getServiceClient,
  requireEnvironment,
} from "@/lib/player/wish-store-server";
import { verifyStripeSignature } from "@/lib/security/stripe-webhook";

/* eslint-disable @typescript-eslint/no-explicit-any -- webhook reconciliation uses a narrow runtime wrapper around Supabase's ungenerated launch schema */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: { object?: unknown };
};

type LooseDatabase = {
  from(table: string): any;
  rpc(name: string, parameters?: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

type ProcessingResult = {
  status: "processed" | "ignored";
  orderId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "Stripe webhook processing failed.";
}

function objectMetadata(object: Record<string, unknown>): Record<string, unknown> {
  return asRecord(object.metadata);
}

async function findOrderId(
  database: LooseDatabase,
  object: Record<string, unknown>,
): Promise<string | null> {
  const metadataOrderId = readString(objectMetadata(object).order_id);
  if (metadataOrderId) return metadataOrderId;

  const checkoutId = readString(object.id).startsWith("cs_")
    ? readString(object.id)
    : readString(object.checkout_session);
  const paymentIntent = typeof object.payment_intent === "string"
    ? readString(object.payment_intent)
    : readString(asRecord(object.payment_intent).id) ||
      (readString(object.id).startsWith("pi_") ? readString(object.id) : "");

  let query = database.from("wish_purchase_orders").select("id");
  if (checkoutId) {
    query = query.eq("stripe_checkout_session_id", checkoutId);
  } else if (paymentIntent) {
    query = query.eq("stripe_payment_intent_id", paymentIntent);
  } else {
    return null;
  }

  const result = await query.limit(1).maybeSingle();
  if (result.error) throw result.error;
  return result.data?.id ? String(result.data.id) : null;
}

async function updateOrderStatus(
  database: LooseDatabase,
  orderId: string,
  status: "expired" | "failed" | "refunded" | "partially_refunded" | "disputed",
  eventId: string,
  failureReason: string | null,
) {
  let query = database
    .from("wish_purchase_orders")
    .update({
      status,
      last_stripe_event_id: eventId,
      failure_reason: failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  query = status === "expired" || status === "failed"
    ? query.eq("status", "pending")
    : query.in("status", ["paid", "partially_refunded", "disputed"]);

  const result = await query.select("id").maybeSingle();
  if (result.error) throw result.error;
}

async function completePurchase(
  database: LooseDatabase,
  object: Record<string, unknown>,
  eventId: string,
): Promise<string> {
  const checkoutSessionId = readString(object.id);
  const paymentIntentId = typeof object.payment_intent === "string"
    ? readString(object.payment_intent)
    : readString(asRecord(object.payment_intent).id);
  const orderId = await findOrderId(database, object);

  if (!checkoutSessionId || !orderId) {
    throw new Error("Paid Stripe session is missing its Ancient Pulls order metadata.");
  }

  const completion = await database.rpc("complete_wish_purchase", {
    p_order_id: orderId,
    p_checkout_session_id: checkoutSessionId,
    p_payment_intent_id: paymentIntentId || null,
  });
  if (completion.error) throw completion.error;

  const update = await database
    .from("wish_purchase_orders")
    .update({
      last_stripe_event_id: eventId,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (update.error) throw update.error;

  return orderId;
}

async function processEvent(
  database: LooseDatabase,
  eventId: string,
  eventType: string,
  object: Record<string, unknown>,
): Promise<ProcessingResult> {
  if (
    (eventType === "checkout.session.completed" &&
      readString(object.payment_status) === "paid") ||
    eventType === "checkout.session.async_payment_succeeded"
  ) {
    return {
      status: "processed",
      orderId: await completePurchase(database, object, eventId),
    };
  }

  if (
    eventType === "checkout.session.expired" ||
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "payment_intent.payment_failed"
  ) {
    const orderId = await findOrderId(database, object);
    if (!orderId) return { status: "ignored", orderId: null };

    const message = readString(asRecord(object.last_payment_error).message) ||
      (eventType === "checkout.session.expired"
        ? "Stripe Checkout expired before payment."
        : "Stripe reported that payment failed.");
    await updateOrderStatus(
      database,
      orderId,
      eventType === "checkout.session.expired" ? "expired" : "failed",
      eventId,
      message.slice(0, 1000),
    );
    return { status: "processed", orderId };
  }

  if (eventType === "charge.refunded" || eventType === "charge.dispute.created") {
    const orderId = await findOrderId(database, object);
    if (!orderId) return { status: "ignored", orderId: null };

    const disputed = eventType === "charge.dispute.created";
    const amount = Math.max(0, Number(object.amount) || 0);
    const amountRefunded = Math.max(0, Number(object.amount_refunded) || 0);
    const refundStatus = amount > 0 && amountRefunded < amount
      ? "partially_refunded" as const
      : "refunded" as const;
    await updateOrderStatus(
      database,
      orderId,
      disputed ? "disputed" : refundStatus,
      eventId,
      disputed
        ? "Stripe opened a payment dispute; manual reconciliation is required."
        : refundStatus === "partially_refunded"
          ? "Stripe reported a partial refund; manual wish-credit reconciliation is required."
          : "Stripe reported a refund; wish-credit reconciliation may be required.",
    );
    return { status: "processed", orderId };
  }

  return { status: "ignored", orderId: null };
}

async function finishEvent(
  database: LooseDatabase,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  orderId: string | null,
  error: string | null,
) {
  const result = await database
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      order_id: orderId,
      error_message: error,
      processed_at: status === "failed" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (result.error) throw result.error;
}

export async function POST(request: Request) {
  let eventId = "";
  let database: LooseDatabase | null = null;

  try {
    const rawBody = await request.text();
    verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature") || "",
      requireEnvironment(["STRIPE_WEBHOOK_SECRET"]),
    );

    const event = JSON.parse(rawBody) as StripeEvent;
    eventId = readString(event.id);
    const eventType = readString(event.type);
    if (!eventId || !eventType) {
      throw new Error("Stripe sent an event without an ID or type.");
    }

    database = getServiceClient() as unknown as LooseDatabase;
    const claim = await database.rpc("begin_stripe_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
    });
    if (claim.error) throw claim.error;
    if (claim.data !== true) {
      return Response.json({ received: true, duplicate: true });
    }

    const result = await processEvent(
      database,
      eventId,
      eventType,
      asRecord(event.data?.object),
    );
    await finishEvent(database, eventId, result.status, result.orderId, null);

    return Response.json({ received: true, handled: result.status === "processed" });
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("Stripe wish webhook error:", error);

    if (database && eventId) {
      await finishEvent(database, eventId, "failed", null, message.slice(0, 2000))
        .catch((journalError) => console.error("Stripe event journal error:", journalError));
    }

    return Response.json(
      { received: false, error: { message } },
      { status: 400 },
    );
  }
}
