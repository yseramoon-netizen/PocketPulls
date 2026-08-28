import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import {
  launchEnvironmentReadiness,
  readLaunchSettings,
  type LaunchSettings,
} from "@/lib/launch/server";
import { SCANNER_VERSION } from "@/lib/scanner/version";

/* eslint-disable @typescript-eslint/no-explicit-any -- service-role Supabase queries span launch tables not yet present in the generated client schema */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LooseDatabase = {
  from(table: string): any;
  rpc(name: string, parameters?: Record<string, unknown>): Promise<{
    data: any;
    error: any;
  }>;
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{
        data: { signedUrl?: string } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

type JsonRecord = Record<string, unknown>;

const BOOLEAN_SETTINGS = new Set([
  "beta_mode",
  "maintenance_mode",
  "purchases_enabled",
  "wishes_enabled",
  "trades_enabled",
  "shipping_enabled",
  "scanner_auto_write_enabled",
]);

const INTEGER_SETTINGS = new Map<string, [number, number]>([
  ["global_daily_revenue_limit_pence", [0, 100_000_000]],
  ["default_daily_spend_limit_pence", [0, 10_000_000]],
  ["default_daily_wish_limit", [1, 10_000]],
]);

function noStore(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function readText(value: unknown, maximum = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function readHttpUrl(value: unknown, maximum = 800): string {
  const candidate = readText(value, maximum);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Tracking links must be valid HTTPS addresses.");
  }
}

function readUuid(value: unknown): string {
  const text = readText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(text)
    ? text
    : "";
}

function readInteger(value: unknown, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("A Launch Control number was invalid.");
  }
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord =>
        typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )).toISOString();
}

async function writeAudit(
  database: LooseDatabase,
  actor: { userId: string; email: string },
  input: {
    action: string;
    targetType: string;
    targetId?: string | null;
    requestId: string;
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: JsonRecord;
  },
) {
  const result = await database
    .from("admin_audit_events")
    .insert({
      admin_user_id: actor.userId,
      admin_email: actor.email,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId || null,
      request_id: input.requestId,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      metadata: input.metadata || {},
    });

  if (result.error) {
    throw result.error;
  }
}

async function countRows(query: PromiseLike<{ count: number | null; error: any }>) {
  const result = await query;
  if (result.error) throw result.error;
  return result.count || 0;
}

async function loadTicketThread(
  database: LooseDatabase,
  ticketId: string,
) {
  const [ticketResult, messageResult, attachmentResult] = await Promise.all([
    database
      .from("support_tickets")
      .select("id,ticket_number,user_id,category,subject,status,priority,related_wish_id,related_order_id,related_shipment_id,last_message_at,created_at,updated_at")
      .eq("id", ticketId)
      .single(),
    database
      .from("support_messages")
      .select("id,ticket_id,sender_user_id,sender_role,admin_email,body,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    database
      .from("support_attachments")
      .select("id,ticket_id,message_id,user_id,storage_path,file_name,content_type,size_bytes,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketResult.error) throw ticketResult.error;
  if (messageResult.error) throw messageResult.error;
  if (attachmentResult.error) throw attachmentResult.error;

  const attachments = await Promise.all(
    rows(attachmentResult.data).map(async (attachment) => {
      const storagePath = readText(attachment.storage_path, 600);
      const signed = storagePath
        ? await database.storage
            .from("support-attachments")
            .createSignedUrl(storagePath, 15 * 60)
        : { data: null, error: null };

      return {
        ...attachment,
        signedUrl: signed.data?.signedUrl || null,
      };
    }),
  );

  await database
    .from("support_tickets")
    .update({ admin_last_read_at: new Date().toISOString() })
    .eq("id", ticketId);

  return {
    ticket: ticketResult.data,
    messages: messageResult.data || [],
    attachments,
  };
}

export async function GET(request: Request) {
  try {
    const { user, email, admin } = await requireAdmin(request);
    const database = admin as unknown as LooseDatabase;
    const url = new URL(request.url);
    const ticketId = readUuid(url.searchParams.get("ticket"));

    if (ticketId) {
      return noStore({
        ok: true,
        thread: await loadTicketThread(database, ticketId),
      });
    }

    const today = startOfUtcDay();

    const [
      settings,
      betaResult,
      benchmarkResult,
      ticketsResult,
      sourcingResult,
      activeShipmentsResult,
      auditResult,
      stripeFailuresResult,
      financialExceptionsResult,
      ordersTodayResult,
      inventoryResult,
      catalogueCount,
      poolCount,
      visualCount,
      readyCount,
      sourcingCount,
      openTicketCount,
    ] = await Promise.all([
      readLaunchSettings(database),
      database
        .from("launch_beta_members")
        .select("id,user_id,email,active,daily_spend_limit_pence,daily_wish_limit,notes,created_at,updated_at")
        .order("active", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100),
      database
        .from("scanner_release_benchmarks")
        .select("id,scanner_version,total_samples,auto_accepted_samples,wrong_auto_writes,unresolved_samples,queue_drops,duplicate_writes,p95_latency_ms,auto_coverage_percent,dataset_sha256,passed,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(10),
      database
        .from("support_tickets")
        .select("id,ticket_number,user_id,category,subject,status,priority,related_wish_id,related_order_id,related_shipment_id,last_message_at,player_last_read_at,admin_last_read_at,created_at,updated_at")
        .order("last_message_at", { ascending: false })
        .limit(50),
      database
        .from("wish_fulfilment_obligations")
        .select("id,wish_id,user_id,card_id,status,physical_inventory_id,shipment_id,created_at,source_requested_at")
        .in("status", ["source_needed", "source_requested"])
        .order("created_at", { ascending: true })
        .limit(100),
      database
        .from("player_shipping_shipments")
        .select("id,user_id,status,card_count,tracking_number,tracking_url,notes,requested_at,packed_at,shipped_at")
        .in("status", ["requested", "packing", "shipped"])
        .order("requested_at", { ascending: true })
        .limit(100),
      database
        .from("admin_audit_events")
        .select("id,admin_user_id,admin_email,action,target_type,target_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      database
        .from("stripe_webhook_events")
        .select("event_id,event_type,processing_status,attempt_count,order_id,error_message,received_at,updated_at")
        .in("processing_status", ["failed", "processing"])
        .order("received_at", { ascending: false })
        .limit(50),
      database
        .from("wish_purchase_orders")
        .select("id,user_id,status,amount_pence,wishes,failure_reason,last_stripe_event_id,created_at,paid_at")
        .in("status", ["refunded", "partially_refunded", "disputed"])
        .order("updated_at", { ascending: false })
        .limit(50),
      database
        .from("wish_purchase_orders")
        .select("id,user_id,status,amount_pence,wishes,created_at,paid_at")
        .gte("created_at", today)
        .order("created_at", { ascending: false }),
      database.from("inventory").select("quantity"),
      countRows(database.from("pokemon_cards").select("id", { count: "exact", head: true })),
      countRows(database.from("wish_pool_cards").select("card_id", { count: "exact", head: true }).eq("enabled", true)),
      countRows(database.from("pokemon_card_visual_fingerprints").select("card_id", { count: "exact", head: true }).eq("fingerprint_version", 3)),
      countRows(database.from("wish_fulfilment_obligations").select("id", { count: "exact", head: true }).in("status", ["ready", "sourced", "packed", "shipped"])),
      countRows(database.from("wish_fulfilment_obligations").select("id", { count: "exact", head: true }).in("status", ["source_needed", "source_requested"])),
      countRows(database.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "waiting_admin", "waiting_player"])),
    ]);

    for (const result of [
      betaResult,
      benchmarkResult,
      ticketsResult,
      sourcingResult,
      activeShipmentsResult,
      auditResult,
      stripeFailuresResult,
      financialExceptionsResult,
      ordersTodayResult,
      inventoryResult,
    ]) {
      if (result.error) throw result.error;
    }

    const sourcingRows = rows(sourcingResult.data);
    const cardIds = [...new Set(
      sourcingRows.map((row) => readText(row.card_id, 100)).filter(Boolean),
    )];
    let cardMap = new Map<string, JsonRecord>();

    if (cardIds.length) {
      const cardsResult = await database
        .from("pokemon_cards")
        .select("id,name,set_name,card_no,rarity,image_url,market_value")
        .in("id", cardIds);

      if (cardsResult.error) throw cardsResult.error;
      cardMap = new Map(
        rows(cardsResult.data).map((card) => [String(card.id), card]),
      );
    }

    const orderRows = rows(ordersTodayResult.data);
    const revenueTodayPence = orderRows
      .filter((order) => order.status === "paid")
      .reduce((sum, order) => sum + numberValue(order.amount_pence), 0);
    const pendingRevenuePence = orderRows
      .filter((order) => order.status === "pending")
      .reduce((sum, order) => sum + numberValue(order.amount_pence), 0);
    const physicalUnits = rows(inventoryResult.data)
      .reduce((sum, stock) => sum + Math.max(0, numberValue(stock.quantity)), 0);

    const environment = launchEnvironmentReadiness();
    const latestBenchmark = rows(benchmarkResult.data)[0] || null;
    const readiness = {
      businessIdentity:
        environment.businessNameConfigured &&
        environment.businessAddressConfigured &&
        environment.supportEmailConfigured,
      stripe:
        environment.stripeSecretConfigured &&
        environment.stripeWebhookSecretConfigured,
      reconciliation: environment.reconciliationSecretConfigured,
      ordersEnvironment: environment.ordersEnvironmentOpen,
      legalReview:
        settings.legal_review_status === "approved" &&
        Boolean(settings.legal_review_reference.trim()),
      scanner:
        settings.scanner_release_status === "passed" &&
        Boolean(latestBenchmark?.passed),
      inventoryBacked: settings.inventory_backed_wishes,
      noSourcingDebt: sourcingCount === 0,
      noWebhookFailures: rows(stripeFailuresResult.data).length === 0,
      mfa: true,
    };

    return noStore({
      ok: true,
      generatedAt: new Date().toISOString(),
      viewer: { userId: user.id, email },
      settings,
      environment,
      readiness,
      metrics: {
        physicalUnits,
        catalogueCards: catalogueCount,
        enabledPoolCards: poolCount,
        visualIndexCards: visualCount,
        readyObligations: readyCount,
        sourcingObligations: sourcingCount,
        openSupportTickets: openTicketCount,
        activeShipments: rows(activeShipmentsResult.data).length,
        revenueTodayPence,
        pendingRevenuePence,
        paidOrdersToday: orderRows.filter((order) => order.status === "paid").length,
      },
      betaMembers: betaResult.data || [],
      scannerBenchmarks: benchmarkResult.data || [],
      tickets: ticketsResult.data || [],
      sourcing: sourcingRows.map((obligation) => ({
        ...obligation,
        card: cardMap.get(String(obligation.card_id)) || null,
      })),
      shipments: activeShipmentsResult.data || [],
      webhookProblems: stripeFailuresResult.data || [],
      financialExceptions: financialExceptionsResult.data || [],
      audit: auditResult.data || [],
    });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, email, admin } = await requireAdmin(request);
    const database = admin as unknown as LooseDatabase;
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    const body = (await request.json()) as { settings?: unknown };
    const proposed = typeof body.settings === "object" && body.settings !== null
      ? body.settings as JsonRecord
      : null;

    if (!proposed) {
      return noStore({
        ok: false,
        error: { message: "Launch Control settings were missing." },
      }, 400);
    }

    const current = await readLaunchSettings(database);
    const update: JsonRecord = {};

    for (const [key, value] of Object.entries(proposed)) {
      if (BOOLEAN_SETTINGS.has(key)) {
        if (typeof value !== "boolean") {
          throw new Error(`${key} must be true or false.`);
        }
        update[key] = value;
        continue;
      }

      const bounds = INTEGER_SETTINGS.get(key);
      if (bounds) {
        update[key] = readInteger(value, bounds[0], bounds[1]);
        continue;
      }

      if (key === "maintenance_message") {
        update[key] = readText(value, 500);
      } else if (key === "legal_review_status") {
        const status = readText(value, 20);
        if (!["pending", "approved", "rejected", "expired"].includes(status)) {
          throw new Error("Legal review status is invalid.");
        }
        update[key] = status;
      } else if (key === "legal_review_reference") {
        update[key] = readText(value, 500);
      }
    }

    if ("inventory_backed_wishes" in proposed && proposed.inventory_backed_wishes !== true) {
      throw new Error("Inventory-backed wishes cannot be disabled in the production release layer.");
    }

    const next = { ...current, ...update } as LaunchSettings;
    const environment = launchEnvironmentReadiness();

    if ("legal_review_status" in update || "legal_review_reference" in update) {
      update.legal_reviewed_at = next.legal_review_status === "approved" &&
        next.legal_review_reference.trim()
        ? new Date().toISOString()
        : null;
    }

    if (next.scanner_auto_write_enabled && next.scanner_release_status !== "passed") {
      throw new Error("Scanner automatic writes require a passing locked benchmark.");
    }

    if (next.purchases_enabled) {
      const missing = [
        next.legal_review_status === "approved" && next.legal_review_reference.trim()
          ? null : "independent legal review",
        next.scanner_release_status === "passed" ? null : "scanner acceptance benchmark",
        next.inventory_backed_wishes ? null : "inventory-backed wishes",
        environment.ordersEnvironmentOpen ? null : "ANCIENT_PULLS_ORDERS_OPEN=true",
        environment.stripeSecretConfigured ? null : "STRIPE_SECRET_KEY",
        environment.stripeWebhookSecretConfigured ? null : "STRIPE_WEBHOOK_SECRET",
        environment.reconciliationSecretConfigured ? null : "CRON_SECRET",
        environment.businessNameConfigured ? null : "business legal name",
        environment.businessAddressConfigured ? null : "business address",
        environment.supportEmailConfigured ? null : "support email",
      ].filter(Boolean);

      if (missing.length) {
        throw new Error(`Purchases cannot open yet: ${missing.join(", ")}.`);
      }
    }

    update.updated_by = user.id;
    update.updated_at = new Date().toISOString();

    const result = await database
      .from("launch_control_settings")
      .update(update)
      .eq("id", 1)
      .select("*")
      .single();

    if (result.error || !result.data) {
      throw result.error || new Error("Launch Control settings were not saved.");
    }

    await writeAudit(database, {
      userId: user.id,
      email,
    }, {
      action: "launch.settings.updated",
      targetType: "launch_control",
      targetId: "1",
      requestId,
      beforeState: current,
      afterState: result.data,
    });

    return noStore({ ok: true, settings: result.data });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, email, admin } = await requireAdmin(request);
    const database = admin as unknown as LooseDatabase;
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    const body = await request.json() as JsonRecord;
    const action = readText(body.action, 80);

    if (!action) {
      return noStore({ ok: false, error: { message: "An action is required." } }, 400);
    }

    if (action === "beta.add") {
      const betaEmail = readText(body.email, 320).toLowerCase();
      const notes = readText(body.notes, 500);
      const dailySpend = body.dailySpendLimitPence === null || body.dailySpendLimitPence === undefined
        ? null
        : readInteger(body.dailySpendLimitPence, 0, 10_000_000);
      const dailyWishes = body.dailyWishLimit === null || body.dailyWishLimit === undefined
        ? null
        : readInteger(body.dailyWishLimit, 1, 10_000);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(betaEmail)) {
        throw new Error("Enter a valid beta-member email address.");
      }

      let userId: string | null = null;
      const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!usersResult.error) {
        userId = usersResult.data.users.find(
          (candidate) => candidate.email?.trim().toLowerCase() === betaEmail,
        )?.id || null;
      }

      const existing = await database
        .from("launch_beta_members")
        .select("*")
        .ilike("email", betaEmail)
        .maybeSingle();
      if (existing.error) throw existing.error;

      const payload = {
        user_id: userId,
        email: betaEmail,
        active: true,
        daily_spend_limit_pence: dailySpend,
        daily_wish_limit: dailyWishes,
        notes,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const result = existing.data
        ? await database.from("launch_beta_members")
            .update(payload).eq("id", existing.data.id).select("*").single()
        : await database.from("launch_beta_members")
            .insert(payload).select("*").single();
      if (result.error) throw result.error;

      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "launch_beta_member",
        targetId: String(result.data.id),
        requestId,
        beforeState: existing.data || null,
        afterState: result.data,
      });

      return noStore({ ok: true, betaMember: result.data });
    }

    if (action === "beta.disable") {
      const id = readUuid(body.id);
      if (!id) throw new Error("Choose a valid beta member.");
      const before = await database.from("launch_beta_members").select("*").eq("id", id).single();
      if (before.error) throw before.error;
      const result = await database
        .from("launch_beta_members")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (result.error) throw result.error;
      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "launch_beta_member",
        targetId: id,
        requestId,
        beforeState: before.data,
        afterState: result.data,
      });
      return noStore({ ok: true, betaMember: result.data });
    }

    if (action === "support.reply") {
      const ticketId = readUuid(body.ticketId);
      const message = readText(body.message, 4000);
      if (!ticketId || !message) throw new Error("Ticket and reply are required.");
      const ticket = await database.from("support_tickets").select("*").eq("id", ticketId).single();
      if (ticket.error) throw ticket.error;
      const messageResult = await database
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          sender_user_id: user.id,
          sender_role: "admin",
          admin_email: email,
          body: message,
        })
        .select("*")
        .single();
      if (messageResult.error) throw messageResult.error;
      const updated = await database
        .from("support_tickets")
        .update({
          status: "waiting_player",
          priority: ticket.data.priority === "urgent" ? "high" : ticket.data.priority,
          last_message_at: new Date().toISOString(),
          admin_last_read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId)
        .select("*")
        .single();
      if (updated.error) throw updated.error;
      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "support_ticket",
        targetId: ticketId,
        requestId,
        beforeState: ticket.data,
        afterState: updated.data,
      });
      return noStore({ ok: true, thread: await loadTicketThread(database, ticketId) });
    }

    if (action === "support.update") {
      const ticketId = readUuid(body.ticketId);
      const status = readText(body.status, 30);
      const priority = readText(body.priority, 30);
      if (!ticketId) throw new Error("Choose a valid support ticket.");
      if (!["open", "waiting_admin", "waiting_player", "resolved", "closed"].includes(status)) {
        throw new Error("Support status is invalid.");
      }
      if (!["low", "normal", "high", "urgent"].includes(priority)) {
        throw new Error("Support priority is invalid.");
      }
      const before = await database.from("support_tickets").select("*").eq("id", ticketId).single();
      if (before.error) throw before.error;
      const updated = await database
        .from("support_tickets")
        .update({
          status,
          priority,
          resolved_at: status === "resolved" || status === "closed"
            ? new Date().toISOString() : null,
          admin_last_read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId)
        .select("*")
        .single();
      if (updated.error) throw updated.error;
      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "support_ticket",
        targetId: ticketId,
        requestId,
        beforeState: before.data,
        afterState: updated.data,
      });
      return noStore({ ok: true, ticket: updated.data });
    }

    if (action === "sourcing.mark_sourced") {
      const obligationId = readUuid(body.obligationId);
      if (!obligationId) throw new Error("Choose a valid sourcing obligation.");
      const before = await database.from("wish_fulfilment_obligations").select("*").eq("id", obligationId).single();
      if (before.error) throw before.error;
      const result = await database.rpc("admin_mark_wish_card_sourced", {
        p_obligation_id: obligationId,
      });
      if (result.error) throw result.error;
      const after = await database.from("wish_fulfilment_obligations").select("*").eq("id", obligationId).single();
      if (after.error) throw after.error;
      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "wish_fulfilment",
        targetId: obligationId,
        requestId,
        beforeState: before.data,
        afterState: after.data,
      });
      return noStore({ ok: true, obligation: after.data });
    }

    if (action === "shipment.update") {
      const shipmentId = readUuid(body.shipmentId);
      const status = readText(body.status, 30);
      if (!shipmentId || !["requested", "packing", "shipped", "delivered", "cancelled"].includes(status)) {
        throw new Error("Shipment update is invalid.");
      }
      const before = await database.from("player_shipping_shipments").select("*").eq("id", shipmentId).single();
      if (before.error) throw before.error;
      const allowedTransitions: Record<string, string[]> = {
        requested: ["requested", "packing", "cancelled"],
        packing: ["packing", "shipped", "cancelled"],
        shipped: ["shipped", "delivered"],
        delivered: ["delivered"],
        cancelled: ["cancelled"],
      };
      if (!(allowedTransitions[String(before.data.status)] || []).includes(status)) {
        throw new Error(`A ${before.data.status} shipment cannot move directly to ${status}.`);
      }
      const now = new Date().toISOString();
      const trackingNumber = readText(body.trackingNumber, 200);
      const trackingUrl = readHttpUrl(body.trackingUrl, 800);
      if ((status === "shipped" || status === "delivered") && !trackingNumber) {
        throw new Error("Enter the carrier tracking number before marking a shipment shipped.");
      }
      const payload: JsonRecord = {
        status,
        tracking_number: trackingNumber || null,
        tracking_url: trackingUrl || null,
        notes: readText(body.notes, 2000),
      };
      if (status === "packing") payload.packed_at = before.data.packed_at || now;
      if (status === "shipped") payload.shipped_at = before.data.shipped_at || now;
      if (status === "delivered") payload.delivered_at = before.data.delivered_at || now;
      if (status === "cancelled") payload.cancelled_at = before.data.cancelled_at || now;
      const updated = await database.from("player_shipping_shipments")
        .update(payload).eq("id", shipmentId).select("*").single();
      if (updated.error) throw updated.error;

      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "shipment",
        targetId: shipmentId,
        requestId,
        beforeState: before.data,
        afterState: updated.data,
      });
      return noStore({ ok: true, shipment: updated.data });
    }

    if (action === "scanner.record_benchmark") {
      const scannerVersion = readText(body.scannerVersion, 120);
      const benchmarkRecords = rows(body.records);
      if (!benchmarkRecords.length || benchmarkRecords.length > 10_000) {
        throw new Error("The scanner benchmark must contain 1-10,000 exported records.");
      }
      if (scannerVersion !== SCANNER_VERSION) {
        throw new Error(`This release only accepts scanner ${SCANNER_VERSION} evidence.`);
      }

      const caseIds = new Set<string>();
      for (const record of benchmarkRecords) {
        const caseId = readText(record.caseId, 180);
        const acceptance = readText(record.acceptance, 20);
        const predicted = readText(record.predictedCardId, 120);
        const expected = readText(record.expectedCardId, 120);
        const latency = Number(record.totalLatencyMs);

        if (!caseId || caseIds.has(caseId)) {
          throw new Error("Every benchmark row needs a unique case ID.");
        }
        caseIds.add(caseId);
        if (record.verificationStatus !== "verified" || typeof record.correct !== "boolean") {
          throw new Error("Every benchmark prediction must be operator-verified before release evidence is recorded.");
        }
        if (acceptance !== "auto" && acceptance !== "review") {
          throw new Error("A benchmark row contains an invalid acceptance decision.");
        }
        if (!Number.isFinite(latency) || latency < 1 || latency > 120_000) {
          throw new Error("Every benchmark row needs a valid end-to-end latency.");
        }
        if (acceptance === "auto" && !predicted) {
          throw new Error("An automatic benchmark decision is missing its predicted card.");
        }
        if (record.correct === true && (!predicted || predicted !== expected)) {
          throw new Error("A correct benchmark row has inconsistent card IDs.");
        }
        if (record.correct === false && predicted && predicted === expected) {
          throw new Error("An incorrect benchmark row has identical predicted and expected cards.");
        }
      }
      const totalSamples = benchmarkRecords.length;
      const automaticRecords = benchmarkRecords.filter(
        (record) => record.acceptance === "auto",
      );
      const autoAcceptedSamples = automaticRecords.length;
      const wrongAutoWrites = automaticRecords.filter(
        (record) => record.correct !== true,
      ).length;
      const unresolvedSamples = benchmarkRecords.filter(
        (record) => !readText(record.predictedCardId, 120),
      ).length;
      const queueDrops = readInteger(body.queueDrops, 0, 1_000_000);
      const duplicateWrites = readInteger(body.duplicateWrites, 0, 1_000_000);
      const latencies = benchmarkRecords
        .map((record) => Number(record.totalLatencyMs))
        .sort((left, right) => left - right);
      const p95LatencyMs = latencies[
        Math.min(latencies.length - 1, Math.max(0, Math.ceil(latencies.length * 0.95) - 1))
      ] || 0;
      const datasetSha256 = readText(body.datasetSha256, 64).toLowerCase();
      if (!scannerVersion || !/^[a-f0-9]{64}$/.test(datasetSha256)) {
        throw new Error("Scanner benchmark metadata is invalid.");
      }
      const autoCoverage = totalSamples > 0
        ? autoAcceptedSamples / totalSamples * 100 : 0;
      const passed = totalSamples >= 1000
        && autoAcceptedSamples >= 500
        && wrongAutoWrites === 0
        && queueDrops === 0
        && duplicateWrites === 0
        && p95LatencyMs <= 1000;
      const result = await database.from("scanner_release_benchmarks").insert({
        scanner_version: scannerVersion,
        total_samples: totalSamples,
        auto_accepted_samples: autoAcceptedSamples,
        wrong_auto_writes: wrongAutoWrites,
        unresolved_samples: unresolvedSamples,
        queue_drops: queueDrops,
        duplicate_writes: duplicateWrites,
        p95_latency_ms: p95LatencyMs,
        auto_coverage_percent: autoCoverage,
        dataset_sha256: datasetSha256,
        passed,
        recorded_by: user.id,
      }).select("*").single();
      if (result.error) throw result.error;

      const settingsBefore = await readLaunchSettings(database);
      const settingsResult = await database.from("launch_control_settings")
        .update({
          scanner_release_status: passed ? "passed" : "blocked",
          scanner_auto_write_enabled: passed
            ? settingsBefore.scanner_auto_write_enabled
            : false,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1)
        .select("*")
        .single();
      if (settingsResult.error) throw settingsResult.error;

      await writeAudit(database, { userId: user.id, email }, {
        action,
        targetType: "scanner_benchmark",
        targetId: String(result.data.id),
        requestId,
        beforeState: settingsBefore,
        afterState: { benchmark: result.data, settings: settingsResult.data },
      });
      return noStore({ ok: true, benchmark: result.data, settings: settingsResult.data });
    }

    throw new Error("Unknown Launch Control action.");
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
