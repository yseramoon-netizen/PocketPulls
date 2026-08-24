import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const nextRoot = path.join(root, ".next");
const publicRoot = path.join(root, "public");
const budgets = {
  initialRouteJsBytes: 470 * 1024,
  publicAssetBytes: 2.5 * 1024 * 1024,
  serverChunkBytes: 1024 * 1024,
};

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function routeLabel(manifestPath) {
  const manifestRelative = path.relative(path.join(nextRoot, "server", "app"), manifestPath)
    .replaceAll(path.sep, "/");
  if (manifestRelative === "page_client-reference-manifest.js") return "/";

  const relative = manifestRelative
    .replace(/\/page_client-reference-manifest\.js$/, "")
    .replace(/(^|\/)\([^/]+\)(?=\/|$)/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return relative ? `/${relative}` : "/";
}

async function routeInitialJs() {
  const manifests = (await filesBelow(path.join(nextRoot, "server", "app")))
    .filter((file) => file.endsWith("page_client-reference-manifest.js"));
  const routes = [];

  for (const manifest of manifests) {
    const source = await readFile(manifest, "utf8");
    const sandbox = { globalThis: {} };
    vm.runInNewContext(source, sandbox, { timeout: 1_000 });
    const registry = sandbox.globalThis.__RSC_MANIFEST ?? {};
    const record = Object.values(registry)[0];
    const entries = record?.entryJSFiles ?? {};
    const pageEntry = Object.entries(entries)
      .filter(([key]) => /\/page$/.test(key))
      .at(-1);
    if (!pageEntry) continue;

    const chunks = [...new Set(pageEntry[1])];
    let bytes = 0;
    for (const chunk of chunks) {
      bytes += (await stat(path.join(nextRoot, chunk))).size;
    }
    routes.push({ route: routeLabel(manifest), bytes, chunks: chunks.length });
  }

  return routes.sort((left, right) => right.bytes - left.bytes);
}

function roundedKiB(bytes) {
  return Math.round(bytes / 1024 * 10) / 10;
}

const [routes, publicFiles, clientFiles, serverFiles] = await Promise.all([
  routeInitialJs(),
  filesBelow(publicRoot),
  filesBelow(path.join(nextRoot, "static", "chunks")),
  filesBelow(path.join(nextRoot, "server", "chunks")),
]);

const publicAssets = await Promise.all(publicFiles.map(async (file) => ({
  file: path.relative(publicRoot, file).replaceAll(path.sep, "/"),
  bytes: (await stat(file)).size,
})));
const clientJs = await Promise.all(clientFiles
  .filter((file) => file.endsWith(".js"))
  .map(async (file) => ({ file, bytes: (await stat(file)).size })));
const serverJs = await Promise.all(serverFiles
  .filter((file) => file.endsWith(".js"))
  .map(async (file) => ({ file, bytes: (await stat(file)).size })));
const largestPublic = publicAssets.sort((a, b) => b.bytes - a.bytes)[0];
const largestServer = serverJs.sort((a, b) => b.bytes - a.bytes)[0];
const violations = [
  ...routes
    .filter((route) => route.bytes > budgets.initialRouteJsBytes)
    .map((route) => `${route.route} initial JS is ${roundedKiB(route.bytes)} KiB`),
  ...publicAssets
    .filter((asset) => asset.bytes > budgets.publicAssetBytes)
    .map((asset) => `${asset.file} is ${roundedKiB(asset.bytes)} KiB`),
  ...(largestServer?.bytes > budgets.serverChunkBytes
    ? [`Largest server chunk is ${roundedKiB(largestServer.bytes)} KiB`]
    : []),
];

const report = {
  budgets: {
    initialRouteJsKiB: roundedKiB(budgets.initialRouteJsBytes),
    publicAssetKiB: roundedKiB(budgets.publicAssetBytes),
    serverChunkKiB: roundedKiB(budgets.serverChunkBytes),
  },
  totals: {
    publicMiB: Math.round(publicAssets.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024 * 10) / 10,
    clientJsKiB: roundedKiB(clientJs.reduce((sum, item) => sum + item.bytes, 0)),
  },
  largestPublicAsset: largestPublic && {
    file: largestPublic.file,
    kiB: roundedKiB(largestPublic.bytes),
  },
  largestServerChunk: largestServer && {
    file: path.basename(largestServer.file),
    kiB: roundedKiB(largestServer.bytes),
  },
  heaviestRoutes: routes.slice(0, 12).map((route) => ({
    route: route.route,
    initialJsKiB: roundedKiB(route.bytes),
    chunks: route.chunks,
  })),
  keyRoutes: [
    "/wishes",
    "/collection",
    "/constellation",
    "/wishes/preview",
    "/admin/add",
  ].flatMap((routeName) => {
    const route = routes.find((item) => item.route === routeName);
    return route ? [{
      route: route.route,
      initialJsKiB: roundedKiB(route.bytes),
      chunks: route.chunks,
    }] : [];
  }),
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exitCode = 1;
