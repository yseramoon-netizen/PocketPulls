/* Offline behavioural regressions. Uses the project's TypeScript compiler; no extra dependency. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function loader(overrides = {}) {
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) filename += ".ts";
    const key = path.relative(root, filename).split(path.sep).join("/");
    if (key in overrides) return overrides[key];
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, mod);
    mod.require = (request) => request.startsWith("@/") ? load(request.slice(2))
      : request.startsWith(".") ? load(path.resolve(path.dirname(filename), request))
      : require(request);
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    mod._compile(output, filename);
    return mod.exports;
  }
  return load;
}
const load = loader();
const { parseBrowseFilters, writeBrowseFilters } = load("lib/player/browseFilters");
const { searchPlayerRoutes, PLAYER_ROUTES, isRouteActive } = load("lib/player/routes");
const { createLatestSave } = load("lib/client/latestSave");
const { shouldAutomaticallyAccept } = load("lib/scanner/acceptance");
const { scoreCandidates, scoreImageFirstMatches, calibrateCandidates } = load("lib/scanner/scoring");

test("browse filters round-trip Unicode, favourites and the selected page", () => {
  const query = "?q=Flab%C3%A9b%C3%A9&set=Scarlet+%26+Violet&rarity=Rare&page=4&favourites=1&campaign=friend";
  const filters = parseBrowseFilters(query);
  assert.equal(filters.search, "Flabébé");
  assert.equal(filters.page, 4);
  assert.equal(filters.favouritesOnly, true);
  assert.deepEqual(parseBrowseFilters(writeBrowseFilters(query, filters)), filters);
  assert.equal(new URLSearchParams(writeBrowseFilters(query, filters)).get("campaign"), "friend");
});
test("malformed pages and availability never reach database pagination", () => {
  for (const page of ["NaN", "Infinity", "-1", "2.5", "9007199254740992"]) assert.equal(parseBrowseFilters(`page=${page}&availability=all_stock`).page, 1);
  assert.equal(parseBrowseFilters("page=999999&availability=all_stock").page, 100000);
  assert.equal(parseBrowseFilters("availability=all_stock").availability, "all");
});
test("clearing filters removes the saved page, search and favourites", () => {
  assert.equal(writeBrowseFilters("q=test&page=4&favourites=1", parseBrowseFilters("")), "");
});
test("navigation keeps merged destinations and resolves recharge correctly", () => {
  for (const route of ["/trade", "/support", "/orders", "/history"]) assert.equal(PLAYER_ROUTES.some((item) => item.href === route), false);
  assert.equal(isRouteActive("/wishes/shop", "/wishes"), false);
  assert.equal(isRouteActive("/wishes/shop", "/wishes/shop"), true);
  assert.ok(searchPlayerRoutes("shipping").some((item) => item.href === "/shipping"));
  assert.ok(searchPlayerRoutes("history").some((item) => item.href === "/constellation?panel=history"));
});
test("rapid preference edits are coalesced and never written concurrently", async () => {
  let finishFirst;
  const calls = [];
  let concurrent = 0;
  const save = createLatestSave(async (value) => {
    assert.equal(++concurrent, 1);
    calls.push(value);
    if (value === 1) await new Promise((resolve) => { finishFirst = resolve; });
    concurrent--;
  });
  const done = save(1);
  await Promise.resolve();
  save(2); save(3);
  finishFirst();
  await done;
  assert.deepEqual(calls, [1, 3]);
  await save(4);
  assert.deepEqual(calls, [1, 3, 4]);
});
test("a failed save does not permanently lock the save lane", async () => {
  const calls = [];
  const save = createLatestSave(async (value) => { calls.push(value); if (value === 1) throw new Error("offline"); });
  await assert.rejects(save(1), /offline/);
  await save(2);
  assert.deepEqual(calls, [1, 2]);
});

test("wish recovery survives a module reload and remains scoped to its account", () => {
  const values = new Map();
  global.window = { sessionStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } };
  try {
    const first = loader()("lib/player/wishRequest");
    const request = first.getOrCreateWishRequest("player-a");
    const afterReload = loader()("lib/player/wishRequest");
    assert.equal(afterReload.getOrCreateWishRequest("player-a"), request);
    assert.notEqual(afterReload.getOrCreateWishRequest("player-b"), request);
    afterReload.completeWishRequest("player-a", "stale-response");
    assert.equal(afterReload.readPendingWish("player-a"), request);
    afterReload.completeWishRequest("player-a", request);
    assert.equal(afterReload.readPendingWish("player-a"), null);
    assert.notEqual(afterReload.getOrCreateWishRequest("player-a"), request);
  } finally { delete global.window; }
});
test("blocked storage still supports an in-memory wish retry", () => {
  global.window = { get sessionStorage() { throw new Error("blocked"); } };
  try {
    const requests = loader()("lib/player/wishRequest");
    assert.equal(requests.getOrCreateWishRequest("player"), requests.getOrCreateWishRequest("player"));
    assert.throws(() => requests.getOrCreateWishRequest(""), /Sign in/);
  } finally { delete global.window; }
});

const card = { id: "trumbeak-67", name: "Trumbeak", rarity: "Common", set_name: "Pitch Black", set_id: "BETS", set_code: "BETS", set_printed_total: 84, card_no: "67", hp: 90, image_url: null, image_url_large: null, market_value: null, api_id: null, supertype: "Pokémon", subtypes: null };
const evidence = { names: [{ value: "Trumbeak", weight: 2.9 }], collectorNumbers: [{ value: "67", weight: 1.7 }], collectorFractions: [{ numerator: "67", denominator: 84, raw: "067/084", confidence: .92, weight: 1.8 }], setCodes: [{ value: "BETS", weight: 1.8 }], hpValues: [{ value: 90, weight: 1.7 }], observations: 2 };
const match = { card, similarity: .96, agreement: .98, frameCount: 2, orientation: 0, breakdown: { artwork: .97, fullCard: .96, edge: .95, colour: .93 } };
const good = calibrateCandidates(scoreImageFirstMatches([match], evidence))[0];
test("independently verified two-frame identity is eligible for automatic intake", () => assert.equal(shouldAutomaticallyAccept([good]), true));
for (const [name, change] of Object.entries({
  "a single frame": { visualFrameCount: 1 },
  "frames that disagree": { visualAgreement: .7 },
  "missing agreement": { visualAgreement: undefined },
  "a weak image match": { visualConfidence: 83 },
  "an unproven collector number": { exactCollector: false },
  "an unproven set": { exactSet: false },
  "footer-only evidence": { evidence: { ...good.evidence, name: 0 } },
  "an identity conflict": { identityConflicts: ["HP needs confirmation"] },
  "low overall confidence": { confidence: 94 },
})) test(`automatic intake rejects ${name}`, () => assert.equal(shouldAutomaticallyAccept([{ ...good, ...change }]), false));
test("near-identical runners-up require a manual choice", () => assert.equal(shouldAutomaticallyAccept([good, { ...good, confidence: good.confidence - 4 }]), false));
for (const [name, change] of Object.entries({
  "wrong collector number": { collectorFractions: [{ ...evidence.collectorFractions[0], numerator: "68" }] },
  "wrong printed total": { collectorFractions: [{ ...evidence.collectorFractions[0], denominator: 85 }] },
  "wrong name": { names: [{ value: "Charizard", weight: 2 }] },
  "wrong HP": { hpValues: [{ value: 150, weight: 2 }] },
})) test(`strong artwork cannot automatically override a ${name}`, () => {
  const candidates = calibrateCandidates(scoreImageFirstMatches([match], { ...evidence, ...change }));
  assert.ok(candidates[0].identityConflicts.length > 0);
  assert.equal(shouldAutomaticallyAccept(candidates), false);
});
test("the earlier low-OCR Trumbeak recovery still appears as a strong candidate", () => {
  const candidates = calibrateCandidates(scoreCandidates([card], { ...evidence, collectorNumbers: [{ value: "67", weight: .98 }], collectorFractions: [{ numerator: "67", denominator: 84, raw: "067/084", confidence: .22, weight: .35 }] }));
  assert.ok(candidates[0].exactCollector && candidates[0].exactSet && candidates[0].confidence >= 95);
  assert.equal(shouldAutomaticallyAccept(candidates), false, "OCR-only recognition still needs confirmation");
});

test("cancelled recognition stops before OCR or candidate lookups", async () => {
  const controller = new AbortController();
  let finishVisual;
  let calls = 0;
  let ocrCalls = 0;
  const { CardIdentifier } = loader({
    "lib/admin/client-auth.ts": { adminFetch: () => { calls++; return new Promise((resolve) => { finishVisual = resolve; }); } },
    "lib/scanner/compact-visual.ts": { fingerprintCanvasOrientations: () => [] },
    "lib/scanner/ocr-engine.ts": { ScannerOcrEngine: class { async recogniseFrames() { ocrCalls++; } } },
  })("lib/scanner/identify");
  const identifier = new CardIdentifier(() => {});
  const result = identifier.identify([{ id: "frame", qualityWeight: 1, canvas: {} }], 240, { signal: controller.signal });
  controller.abort();
  finishVisual({ ready: false, matches: [], indexedCount: 0, totalCount: 0 });
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(calls, 1);
  assert.equal(ocrCalls, 0);
  await assert.rejects(identifier.identify([], 0, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});
test("invalid inventory quantities are rejected before database access", async () => {
  const route = loader({ "lib/admin/server-auth.ts": {
    requireAdmin: async () => ({ admin: { from() { throw new Error("Unexpected database access"); } } }),
    adminErrorResponse(error) { throw error; },
  } })("app/api/admin/inventory/add/route");
  for (const quantity of [0, -1, 1.5, 10000, "", null, "NaN", true]) {
    const response = await route.POST(new Request("https://example.test/api/admin/inventory/add", { method: "POST", body: JSON.stringify({ cardId: "123", quantity }) }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "quantity_invalid");
  }
  const { readInventoryQuantity } = load("lib/admin/inventory-input");
  assert.equal(readInventoryQuantity("3"), 3);
  assert.equal(readInventoryQuantity(9999), 9999);
});
