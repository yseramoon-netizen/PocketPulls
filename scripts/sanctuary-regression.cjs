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
test('A tap cannot spend a wish',()=>{assert.equal(staffGesture(0,true,0),'tap');assert.equal(staffGesture(4,true,6),'tap');});
test('A deliberate clockwise arc requires the end of the 45 degree stroke',()=>{assert.equal(staffGesture(41,true,55),'cancel');assert.equal(staffGesture(42,true,57),'pull');assert.equal(staffGesture(45,true,62),'pull');});
test('An invalid arc, cancellation or nonfinite input cannot spend',()=>{
 for(const [angle,valid,travel,cancel] of [[45,false,60,false],[45,true,60,true],[NaN,true,60,false],[45,true,Infinity,false]])assert.equal(staffGesture(angle,valid,travel,cancel),'cancel');
});
test('Dragging back to the start cannot become an accidental menu tap',()=>assert.equal(staffGesture(0,true,65),'cancel'));
const load=loader();const {staffArc,searchAstraRequests}=load('lib/player/astraInteraction');
const {stepStaffSpring,sampleAstraPose}=load('lib/player/astraMotion');const {flightHand}=load('components/player/astral/flight');
test('Arc projection accepts a thumb’s 0–45 degree rotation at different screen scales',()=>{
 for(const scale of [.67,.85,1,2])for(const angle of [0,15,30,45]){const a=angle*Math.PI/180,r=82*scale;const result=staffArc(200+Math.sin(a)*r,200-Math.cos(a)*r,200,200,r);assert.ok(result.valid);assert.ok(Math.abs(result.angle-angle)<1e-8);}
});
test('The former straight downward drag cannot summon',()=>{for(let dy=0;dy<180;dy++){const arc=staffArc(168,81+dy,168,163,82);assert.notEqual(staffGesture(arc.angle,arc.valid,dy),'pull');}});
test('Returning to upright disarms the arc',()=>{const arc=staffArc(168,81,168,163,82);assert.equal(staffGesture(arc.angle,arc.valid,65),'cancel');});
test('Exact staff spring has matching positions at 30, 60 and 120 frames per second',()=>{const endpoints=[30,60,120].map(hz=>{let position=0,velocity=0;for(let i=0;i<hz;i++){const next=stepStaffSpring(position,velocity,45,1/hz);position=next.position;velocity=next.velocity;}return position;});assert.ok(Math.max(...endpoints)-Math.min(...endpoints)<1e-8);});
test('All articulated poses keep Astra’s hand on the staff pivot',()=>{for(const mood of ['idle','greeting','listening','charging','celebrating','resting'])for(let t=0;t<9;t+=.1){const pose=sampleAstraPose(t,30,mood,t);const hand=flightHand(pose,1,180,260,320);assert.ok(Math.abs(hand.x-168)<1e-8);assert.ok(Math.abs(hand.y-163)<1e-8);assert.ok(Object.values(pose).every(Number.isFinite));}});
test('The spring returns smoothly without overshooting past upright',()=>{let position=45,velocity=0;for(let i=0;i<120;i++){const next=stepStaffSpring(position,velocity,0,1/60);assert.ok(next.position<=position&&next.position>=0);position=next.position;velocity=next.velocity;}assert.ok(position<.001);});
test('Request search matches useful synonyms and can find every route',()=>{assert.equal(searchAstraRequests('sound')[0].id,'settings');assert.equal(searchAstraRequests('collection')[0].id,'binder');assert.equal(searchAstraRequests('rank')[0].id,'galaxies');assert.equal(searchAstraRequests('zzyyxx').length,0);assert.equal(searchAstraRequests('   ').length,11);});
