import { timingSafeEqual } from "node:crypto";

import { getServiceClient } from "@/lib/player/wish-store-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* eslint-disable @typescript-eslint/no-explicit-any -- reconciliation targets post-migration service-role tables */
type LooseDatabase = {
  from(table: string): any;
  rpc(name: string, parameters: Record<string, unknown>): Promise<{ data: unknown; error: any }>;
};

type PendingOrder = {
  id: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const supplied = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readStripeSession(secret: string, sessionId: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    },
  );
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const stripeError = payload.error as { message?: unknown } | undefined;
    throw new Error(typeof stripeError?.message === "string"
      ? stripeError.message
      : `Stripe session lookup returned HTTP ${response.status}.`);
  }
  return payload;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function reconcile(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return Response.json(
      { ok: false, error: { message: "Reconciliation authorisation failed." } },
      { status: 401 },
    );
  }

  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecret) throw new Error("STRIPE_SECRET_KEY is missing.");
    const database = getServiceClient() as unknown as LooseDatabase;
    const now = new Date();
    const staleOrders = new Date(now.getTime() - 40 * 60 * 1000).toISOString();
    const abandonedOrders = new Date(now.getTime() - 2 * 60 * 60 * 1000).getTime();
    const staleEvents = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const pendingResult = await database
      .from("wish_purchase_orders")
      .select("id,stripe_checkout_session_id,created_at")
      .eq("status", "pending")
      .lt("created_at", staleOrders)
      .order("created_at", { ascending: true })
      .limit(100);
    if (pendingResult.error) throw pendingResult.error;

    let completed = 0;
    let expired = 0;
    let stillOpen = 0;
    const failures: Array<{ orderId: string; message: string }> = [];

    for (const order of (pendingResult.data || []) as PendingOrder[]) {
      try {
        if (!order.stripe_checkout_session_id) {
          if (new Date(order.created_at).getTime() <= abandonedOrders) {
            const update = await database.from("wish_purchase_orders").update({
              status: "expired",
              failure_reason: "No Stripe Checkout session was attached before the reservation expired.",
              updated_at: now.toISOString(),
            }).eq("id", order.id).eq("status", "pending");
            if (update.error) throw update.error;
            expired += 1;
          }
          continue;
        }

        const session = await readStripeSession(stripeSecret, order.stripe_checkout_session_id);
        const paymentIntent = typeof session.payment_intent === "object" && session.payment_intent
          ? session.payment_intent as Record<string, unknown>
          : {};
        if (stringValue(session.payment_status) === "paid") {
          const completion = await database.rpc("complete_wish_purchase", {
            p_order_id: order.id,
            p_checkout_session_id: order.stripe_checkout_session_id,
            p_payment_intent_id: stringValue(paymentIntent.id) ||
              stringValue(session.payment_intent) || null,
          });
          if (completion.error) throw completion.error;
          completed += 1;
        } else if (stringValue(session.status) === "expired") {
          const update = await database.from("wish_purchase_orders").update({
            status: "expired",
            failure_reason: "Stripe confirmed that Checkout expired without payment.",
            updated_at: now.toISOString(),
          }).eq("id", order.id).eq("status", "pending");
          if (update.error) throw update.error;
          expired += 1;
        } else {
          stillOpen += 1;
        }
      } catch (error: unknown) {
        failures.push({
          orderId: order.id,
          message: error instanceof Error ? error.message.slice(0, 300) : "Unknown reconciliation error.",
        });
      }
    }

    const events = await database
      .from("stripe_webhook_events")
      .update({
        processing_status: "failed",
        error_message: "Processing lease expired before completion; Stripe retry or investigation is required.",
        updated_at: now.toISOString(),
      })
      .eq("processing_status", "processing")
      .lt("updated_at", staleEvents)
      .select("event_id");
    if (events.error) throw events.error;

    return Response.json({
      ok: failures.length === 0,
      reconciledAt: now.toISOString(),
      paidOrdersRecovered: completed,
      expiredCheckoutReservations: expired,
      checkoutSessionsStillOpen: stillOpen,
      failedStaleWebhookLeases: Array.isArray(events.data) ? events.data.length : 0,
      failures,
    }, {
      status: failures.length ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    console.error("Scheduled reconciliation failed:", error);
    return Response.json({
      ok: false,
      error: { message: error instanceof Error ? error.message : "Scheduled reconciliation failed." },
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = reconcile;
export const POST = reconcile;
