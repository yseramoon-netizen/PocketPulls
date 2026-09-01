import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const productionMode = process.argv.includes("--production");
const failures = [];
const warnings = [];
let passed = 0;

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function pass(message) {
  passed += 1;
  console.log(`PASS  ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

function check(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function filePath(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(filePath(file), "utf8");
}

function checkFile(file) {
  check(fs.existsSync(filePath(file)), `${file} exists`);
}

function requireText(file, snippets) {
  if (!fs.existsSync(filePath(file))) {
    fail(`${file} is missing`);
    return;
  }

  const content = read(file);
  for (const snippet of snippets) {
    check(content.includes(snippet), `${file} contains ${snippet}`);
  }
}

function value(name) {
  return process.env[name]?.trim() || "";
}

function looksPlaceholder(candidate) {
  return (
    !candidate ||
    /(^<.*>$|replace[-_ ]with|your[-_ ]|example\.com|changeme)/i.test(candidate)
  );
}

function requireEnvironment(name) {
  if (looksPlaceholder(value(name))) fail(`${name} is missing or still a placeholder`);
  else pass(`${name} is configured`);
}

function checkEmail(name) {
  const candidate = value(name);
  check(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) && !looksPlaceholder(candidate),
    `${name} is a non-placeholder email address`,
  );
}

function visitFiles(directory, callback) {
  const ignoredDirectories = new Set([
    ".git",
    ".next",
    "node_modules",
    "coverage",
    "out",
    "build",
  ]);
  const textExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".json",
    ".md",
    ".sql",
    ".txt",
  ]);

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".env")) continue;
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) visitFiles(absolute, callback);
      continue;
    }

    if (
      entry.isFile() &&
      textExtensions.has(path.extname(entry.name)) &&
      fs.statSync(absolute).size <= 1_000_000
    ) {
      callback(absolute);
    }
  }
}

console.log(`Ancient Pulls V67.14 release preflight (${productionMode ? "production" : "source"} mode)`);
console.log("");

const requiredFiles = [
  ".env.example",
  "app/robots.ts",
  "app/sitemap.ts",
  "app/api/health/route.ts",
  "app/error.tsx",
  "app/global-error.tsx",
  "app/not-found.tsx",
  "app/(player)/terms/page.tsx",
  "app/(player)/returns/page.tsx",
  "app/(player)/shipping-policy/page.tsx",
  "app/(player)/privacy/page.tsx",
  "app/(player)/cookies/page.tsx",
  "app/(player)/contact/page.tsx",
  "supabase/migrations/20260901_consumer_privacy_checkout_v6712.sql",
  "supabase/migrations/20260901_consent_and_open_wishes_v6714.sql",
  "supabase/RELEASE_DATA_AUDIT.sql",
  "ANCIENT_PULLS_V67_14_INSTALL.txt",
  "RELEASE_CHECKLIST.md",
];

for (const file of requiredFiles) checkFile(file);

requireText("next.config.ts", [
  "Strict-Transport-Security",
  "X-Frame-Options",
  "Permissions-Policy",
  'source: "/api/:path*"',
  '{ source: "/support", destination: "/help#support", permanent: true }',
  '{ source: "/orders", destination: "/shipping#orders", permanent: true }',
  '{ source: "/trade", destination: "/friends?panel=trade", permanent: true }',
]);
requireText("lib/player/purchase-consent.ts", [
  'PURCHASE_CONSENT_VERSION = "2026-09-01-v2"',
  'CHECKOUT_ACKNOWLEDGEMENT_VERSION = "2026-09-01-v1"',
]);
requireText("app/api/player/wishes/checkout/route.ts", [
  '"Idempotency-Key"',
  "REUSABLE_CHECKOUT_WINDOW_MS",
  "checkout.stripe.com",
  "CHECKOUT_ACKNOWLEDGEMENT_VERSION",
]);
requireText("app/api/player/wishes/make/route.ts", [
  'request.headers.get("Idempotency-Key")',
  "p_idempotency_key: idempotencyKey",
]);
requireText("app/(player)/layout.tsx", [
  'supabase.rpc("complete_player_registration")',
  'console.warn("Launch Control check unavailable:"',
]);
requireText("supabase/migrations/20260901_consent_and_open_wishes_v6714.sql", [
  "on conflict on constraint player_legal_consents_pkey",
  "create function public.make_player_wish(",
  "p_idempotency_key uuid",
  "perform * from public.complete_player_registration()",
  "grant execute on function public.make_player_wish(uuid) to authenticated",
]);

const consentMigration = read(
  "supabase/migrations/20260901_consumer_privacy_checkout_v6712.sql",
);
check(
  !consentMigration.includes("on conflict (user_id, consent_version)"),
  "purchase-consent upserts use an unambiguous named constraint",
);
requireText("lib/player/orders.ts", [
  "ANCIENT_PULLS_ORDERS_OPEN",
  "BUSINESS_DETAILS_COMPLETE",
  "isOrderConfirmationConfigured",
]);
requireText("app/(player)/support/page.tsx", ['redirect("/help#support")']);
requireText("app/(player)/orders/page.tsx", ['redirect("/shipping#orders")']);
requireText("app/(player)/trade/page.tsx", ['redirect("/friends?panel=trade")']);
requireText("app/(player)/history/page.tsx", [
  'redirect("/constellation?panel=history")',
]);

let founderBetaFound = false;
for (const directory of ["app", "components", "lib"]) {
  visitFiles(filePath(directory), (file) => {
    if (fs.readFileSync(file, "utf8").toLowerCase().includes("founder beta")) {
      founderBetaFound = true;
      fail(`retired Founder Beta copy remains in ${relative(file)}`);
    }
  });
}
if (!founderBetaFound) pass("retired Founder Beta copy is absent from user-facing source");

const secretPatterns = [
  /sk_live_[A-Za-z0-9]{20,}/,
  /whsec_[A-Za-z0-9]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const secretFiles = new Set();

visitFiles(root, (file) => {
  const content = fs.readFileSync(file, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    secretFiles.add(relative(file));
  }
});

if (secretFiles.size === 0) {
  pass("no common live-secret signatures were found in source files");
} else {
  for (const file of secretFiles) fail(`possible live secret found in ${file}`);
}

const packageJson = JSON.parse(read("package.json"));
check(
  packageJson.scripts?.build === "next build --webpack",
  "production build uses the verified Webpack path",
);
check(packageJson.dependencies?.next === "16.3.4", "Next.js is pinned to 16.3.4");
check(packageJson.dependencies?.sharp === "0.35.4", "Sharp is pinned to 0.35.4");
check(packageJson.dependencies?.geist === "1.7.2", "local Geist fonts are pinned to 1.7.2");
check(
  packageJson.devDependencies?.["eslint-config-next"] === "16.3.4",
  "eslint-config-next matches the Next.js release",
);
check(
  packageJson.scripts?.["check:release:production"] ===
    "node scripts/release-preflight.mjs --production",
  "production preflight command is registered",
);

if (productionMode) {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_BUSINESS_LEGAL_NAME",
    "NEXT_PUBLIC_BUSINESS_ADDRESS",
  ]) {
    requireEnvironment(name);
  }

  checkEmail("NEXT_PUBLIC_SUPPORT_EMAIL");
  checkEmail("NEXT_PUBLIC_PRIVACY_EMAIL");

  const siteUrl = value("NEXT_PUBLIC_SITE_URL");
  let validProductionUrl = false;
  try {
    const parsed = new URL(siteUrl);
    validProductionUrl =
      parsed.protocol === "https:" &&
      !["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    validProductionUrl = false;
  }
  check(validProductionUrl, "NEXT_PUBLIC_SITE_URL is a public HTTPS origin");

  const orderFlag = value("ANCIENT_PULLS_ORDERS_OPEN").toLowerCase();
  check(
    orderFlag === "true" || orderFlag === "false",
    "ANCIENT_PULLS_ORDERS_OPEN is explicitly true or false",
  );

  if (orderFlag === "true") {
    for (const name of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "RESEND_API_KEY",
      "ANCIENT_PULLS_ORDER_EMAIL_FROM",
    ]) {
      requireEnvironment(name);
    }
  } else {
    warn("paid orders are locked; this is safe for a closed-shop release");
  }
} else {
  warn("environment values were not enforced; run npm run check:release:production with the deployment environment loaded");
}

console.log("");
console.log(`${passed} checks passed, ${warnings.length} warning(s), ${failures.length} failure(s).`);

if (failures.length > 0) process.exitCode = 1;
