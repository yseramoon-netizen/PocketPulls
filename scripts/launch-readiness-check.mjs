import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const requiredFiles = [
  "supabase/migrations/20260827_ancient_pulls_launch_readiness_v66.sql",
  "app/admin/launch/page.tsx",
  "app/(player)/support/page.tsx",
  "app/(player)/orders/page.tsx",
  "app/(player)/privacy/page.tsx",
  "app/(player)/returns/page.tsx",
  "app/api/stripe/webhook/route.ts",
  "app/api/internal/reconcile/route.ts",
];

for (const path of requiredFiles) {
  check(`Required file ${path}`, existsSync(resolve(root, path)), "file is missing");
}

const migration = read(requiredFiles[0]);
const scanner = read("components/CardScanner.tsx");
const terms = [
  "app/(player)/terms/page.tsx",
  "app/(player)/rules/page.tsx",
  "app/(player)/player-protection/page.tsx",
  "app/(player)/faq/page.tsx",
  "app/(player)/odds/page.tsx",
  "app/(player)/how-wishes-work/page.tsx",
].map(read).join("\n").toLowerCase();

check("Migration transaction", migration.includes("begin;") && migration.trimEnd().endsWith("commit;"), "V66 must be atomic");
check("Inventory-backed allocation", migration.includes("No physically backed cards are currently available"), "wish function is not fail-closed");
check("Idempotent inventory", migration.includes("admin_add_inventory_idempotent"), "scanner inventory RPC is missing");
check("Idempotent checkout", migration.includes("create_guarded_wish_purchase_order"), "checkout reservation RPC is missing");
check("Stripe replay journal", migration.includes("begin_stripe_webhook_event"), "webhook claim function is missing");
check("Admin audit ledger", migration.includes("prevent_immutable_event_mutation"), "immutable audit protection is missing");
check("No silent scanner eviction", !scanner.includes("queueRef.current.shift();\n    queueRef.current.push"), "scanner still evicts queued captures");
check("No source-after-pull claims", !terms.includes("sourced after") && !terms.includes("sourced-on-demand"), "player wording contradicts held-stock allocation");
check("Unique scanner evidence", migration.includes("scanner_release_benchmarks_dataset_unique"), "benchmark datasets can be counted twice");
check("Shipment cancellation releases reservations", migration.includes("Reserved inventory could not be released"), "cancelled shipments can strand reserved cards");
check("Final delivered copy is constraint-safe", migration.includes("Remove a fully shipped row"), "last-copy delivery can violate player inventory constraints");

const strictEnvironment = process.argv.includes("--strict-env");
if (strictEnvironment) {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_BUSINESS_LEGAL_NAME",
    "NEXT_PUBLIC_BUSINESS_ADDRESS",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
  ]) {
    check(`Environment ${name}`, Boolean(process.env[name]?.trim()), "deployment value is missing");
  }
}

for (const item of checks) {
  process.stdout.write(`${item.passed ? "PASS" : "FAIL"}  ${item.name}\n`);
}

if (failures.length) {
  process.stderr.write(`\n${failures.length} release check(s) failed:\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write(`\nAll ${checks.length} static release checks passed.${strictEnvironment ? " Deployment environment is present." : " Run with --strict-env in the deployment environment."}\n`);
