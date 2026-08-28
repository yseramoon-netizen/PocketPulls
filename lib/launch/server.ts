/* eslint-disable @typescript-eslint/no-explicit-any -- launch tables are installed by V66 after the generated Supabase types */
type LooseDatabase = {
  from(table: string): any;
};

export type LaunchSettings = {
  id: number;
  beta_mode: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  purchases_enabled: boolean;
  wishes_enabled: boolean;
  trades_enabled: boolean;
  shipping_enabled: boolean;
  scanner_auto_write_enabled: boolean;
  inventory_backed_wishes: boolean;
  global_daily_revenue_limit_pence: number;
  default_daily_spend_limit_pence: number;
  default_daily_wish_limit: number;
  legal_review_status: "pending" | "approved" | "rejected" | "expired";
  legal_review_reference: string;
  legal_reviewed_at: string | null;
  scanner_release_status: "shadow" | "passed" | "blocked";
  updated_by: string | null;
  updated_at: string;
};

export type BetaMember = {
  id: string;
  user_id: string | null;
  email: string | null;
  active: boolean;
  daily_spend_limit_pence: number | null;
  daily_wish_limit: number | null;
  notes: string;
};

export type LaunchGate = {
  allowed: boolean;
  reason: string | null;
  settings: LaunchSettings;
  betaMember: BetaMember | null;
  spentTodayPence: number;
  spendLimitPence: number;
};

const SETTINGS_SELECT = [
  "id",
  "beta_mode",
  "maintenance_mode",
  "maintenance_message",
  "purchases_enabled",
  "wishes_enabled",
  "trades_enabled",
  "shipping_enabled",
  "scanner_auto_write_enabled",
  "inventory_backed_wishes",
  "global_daily_revenue_limit_pence",
  "default_daily_spend_limit_pence",
  "default_daily_wish_limit",
  "legal_review_status",
  "legal_review_reference",
  "legal_reviewed_at",
  "scanner_release_status",
  "updated_by",
  "updated_at",
].join(",");

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )).toISOString();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function readLaunchSettings(
  database: LooseDatabase,
): Promise<LaunchSettings> {
  const result = await database
    .from("launch_control_settings")
    .select(SETTINGS_SELECT)
    .eq("id", 1)
    .single();

  if (result.error || !result.data) {
    throw result.error || new Error(
      "Launch Control is unavailable. Run the V66 launch-readiness migration.",
    );
  }

  return result.data as LaunchSettings;
}

export async function readBetaMember(
  database: LooseDatabase,
  user: { id: string; email?: string | null },
): Promise<BetaMember | null> {
  const email = user.email?.trim().toLowerCase() || "";

  const byUser = await database
    .from("launch_beta_members")
    .select("id,user_id,email,active,daily_spend_limit_pence,daily_wish_limit,notes")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (byUser.error) {
    throw byUser.error;
  }

  if (byUser.data) {
    return byUser.data as BetaMember;
  }

  if (!email) {
    return null;
  }

  const byEmail = await database
    .from("launch_beta_members")
    .select("id,user_id,email,active,daily_spend_limit_pence,daily_wish_limit,notes")
    .ilike("email", email)
    .eq("active", true)
    .maybeSingle();

  if (byEmail.error) {
    throw byEmail.error;
  }

  return (byEmail.data || null) as BetaMember | null;
}

export async function getPlayerPurchaseGate(
  database: LooseDatabase,
  user: { id: string; email?: string | null },
): Promise<LaunchGate> {
  const [settings, betaMember, spendResult] = await Promise.all([
    readLaunchSettings(database),
    readBetaMember(database, user),
    database
      .from("wish_purchase_orders")
      .select("amount_pence")
      .eq("user_id", user.id)
      .in("status", ["pending", "paid"])
      .gte("created_at", startOfUtcDay()),
  ]);

  if (spendResult.error) {
    throw spendResult.error;
  }

  const spentTodayPence = (Array.isArray(spendResult.data)
    ? spendResult.data
    : [])
    .reduce(
      (total: number, row: { amount_pence?: unknown }) =>
        total + Math.max(0, asNumber(row.amount_pence)),
      0,
    );

  const spendLimitPence = Math.max(
    0,
    asNumber(
      betaMember?.daily_spend_limit_pence ??
      settings.default_daily_spend_limit_pence,
    ),
  );

  let reason: string | null = null;

  if (settings.maintenance_mode) {
    reason = settings.maintenance_message.trim() ||
      "Ancient Pulls is temporarily paused for maintenance.";
  } else if (!settings.purchases_enabled) {
    reason = "Paid orders are currently closed by Launch Control.";
  } else if (
    settings.legal_review_status !== "approved" ||
    !settings.legal_review_reference.trim()
  ) {
    reason = "Paid orders remain closed while launch approval is completed.";
  } else if (settings.scanner_release_status !== "passed") {
    reason = "Paid orders remain closed while inventory verification is completed.";
  } else if (settings.beta_mode && !betaMember) {
    reason = "This account is not in the Founder beta yet.";
  } else if (
    spendLimitPence > 0 &&
    spentTodayPence >= spendLimitPence
  ) {
    reason = "This account has reached its daily spending limit.";
  }

  return {
    allowed: !reason,
    reason,
    settings,
    betaMember,
    spentTodayPence,
    spendLimitPence,
  };
}

export function launchEnvironmentReadiness() {
  return {
    ordersEnvironmentOpen:
      process.env.ANCIENT_PULLS_ORDERS_OPEN?.trim().toLowerCase() === "true",
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripeWebhookSecretConfigured: Boolean(
      process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    ),
    reconciliationSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    businessNameConfigured: Boolean(
      process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME?.trim(),
    ),
    supportEmailConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim(),
    ),
    businessAddressConfigured: Boolean(
      process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim(),
    ),
  };
}
