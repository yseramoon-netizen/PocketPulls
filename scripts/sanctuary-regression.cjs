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
const { staffPower, staffGesture, STAFF_POWER_STEPS } = loader()('lib/player/astraInteraction');
const { getWishRevealConfig } = loader()('lib/player/wish-reveal');
test('An empty or invalid wallet is dormant, never a charged star',()=>{
 for(const value of [0,-1,-200,NaN,Infinity,-Infinity]) {const p=staffPower(value);assert.equal(p.count,0);assert.equal(p.dormant,true);}
});
for(const step of STAFF_POWER_STEPS)test(`Staff colour at ${step.at} matches ${step.rarity}`,()=>{
 const p=staffPower(step.at),t=getWishRevealConfig(step.rarity);assert.equal(p.primary,t.primary);assert.equal(p.secondary,t.secondary);
});
test('The star colour saturates at 250 while the displayed balance stays accurate',()=>{
 for(const count of [250,251,1000,1000000]) {const p=staffPower(count);assert.equal(p.primary,staffPower(250).primary);assert.equal(p.secondary,staffPower(250).secondary);assert.equal(p.count,count);assert.equal(p.capped,250);}
});
test('Thresholds are inclusive; each preceding balance retains the previous colour',()=>{
 for(let i=1;i<STAFF_POWER_STEPS.length;i++)assert.equal(staffPower(STAFF_POWER_STEPS[i].at-1).primary,staffPower(STAFF_POWER_STEPS[i-1].at).primary);
});
test('A tap cannot spend a wish',()=>{assert.equal(staffGesture(0,0,0),'tap');assert.equal(staffGesture(4,4,6),'tap');});
test('The full downward stroke is required',()=>{assert.equal(staffGesture(0,87,87),'cancel');assert.equal(staffGesture(0,88,88),'pull');assert.equal(staffGesture(35,120,125),'pull');});
test('Upward, sideways, cancelled and invalid strokes cannot spend',()=>{
 for(const [x,y,t,c] of [[0,-150,150,false],[150,100,180,false],[0,120,120,true],[NaN,120,120,false],[0,Infinity,120,false]])assert.equal(staffGesture(x,y,t,c),'cancel');
});
test('Dragging back to the start does not turn into an accidental menu tap',()=>assert.equal(staffGesture(0,0,105),'cancel'));
