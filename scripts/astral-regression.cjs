/* Behavioural guarantees for the award ceremony; no browser or additional dependencies. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){file=path.resolve(root,file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const m=new Module(file,module);cache.set(file,m);m.require=r=>r.startsWith('.')?load(path.resolve(path.dirname(file),r)):require(r);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;}
const {ASTRAL_TIMING:T,sampleAstral,ceremonyDuration,CeremonyClock,AdaptiveResolution}=load('components/player/astral/timeline');
const {getWishRevealConfig}=load('lib/player/wish-reveal');
const names=['Common','Uncommon','Rare','Double Rare','Ultra Rare','Illustration Rare','Special Illustration Rare','Hyper Rare','Crown Rare'];
const options=names.map(name=>getWishRevealConfig(name)).map(c=>({tier:c.tier,blackHole:!!c.blackHole,primary:c.primary,secondary:c.secondary}));
options.push({...options[8],blackHole:true});
function values(x){return typeof x==='number'?[x]:x&&typeof x==='object'?Object.values(x).flatMap(values):[];}
test('every rarity, including the black hole, has the exact same opening',()=>{
 for(let time=0;time<T.rarity;time+=1000/60){const first=sampleAstral(time,options[0]);for(const option of options)assert.deepEqual(sampleAstral(time,option),first,`Outcome leaked at ${time} ms`);}
});
test('all rarity timelines finish with a fully revealed card and finite geometry',()=>{
 for(const option of options){const end=ceremonyDuration(option.blackHole);assert.equal(sampleAstral(end-1,option).finished,false);const final=sampleAstral(end,option);assert.equal(final.finished,true);assert.equal(final.reveal,1);assert.equal(final.mascot.opacity,0);
  for(let time=0;time<=end;time+=1000/60)for(const value of values(sampleAstral(time,option)))assert.ok(Number.isFinite(value));
 }
});
test('motion is interpolated at 60 and 120 Hz, with no held 24 fps poses',()=>{
 for(const fps of [60,120])for(const option of options){let prior=sampleAstral(2000,option);for(let i=1;i<fps;i++){const current=sampleAstral(2000+i*1000/fps,option);assert.notDeepEqual(current.mascot,prior.mascot);prior=current;}}
});
test('the falling star grows throughout its flight',()=>{
 let size=0;for(let time=T.launch;time<=T.impact;time+=1000/60){const next=sampleAstral(time,options[7]).comet.size;assert.ok(next>=size);size=next;}
 assert.ok(sampleAstral(T.impact,options[7]).comet.size/sampleAstral(T.launch,options[7]).comet.size>8);
});
test('rare and black-hole branches do not introduce position or opacity jumps',()=>{
 for(const option of options)for(const at of [1700,4200,5900,7100,7750,9300,9850,10800,11200,12000]){
  const a=sampleAstral(at-.01,option),b=sampleAstral(at+.01,option);
  for(const key of ['x','y','scale','opacity','stretch'])assert.ok(Math.abs(a.mascot[key]-b.mascot[key])<.0002,`${key} jumps at ${at}`);
 }
});
test('black-hole absorption precedes its card and never appears in normal rarities',()=>{
 const bh=options[9];assert.equal(sampleAstral(T.rarity-1,bh).horizon,0);assert.equal(sampleAstral(T.horizonCard,bh).engulf,1);assert.equal(sampleAstral(T.horizonCard-1,bh).reveal,0);
 for(const option of options.slice(0,9))for(const time of [7500,9000,10500,12000])assert.equal(sampleAstral(time,option).horizon,0);
});
test('tab suspension and manual pause preserve the exact ceremony position',()=>{
 const clock=new CeremonyClock();clock.tick(100);assert.equal(clock.tick(150),50);clock.setPaused(true);clock.tick(60000);clock.tick(61000);assert.equal(clock.time,50);clock.setPaused(false);assert.equal(clock.tick(90000),50);assert.equal(clock.tick(90016),66);
});
test('skip advances to the award and a new clock starts at zero',()=>{
 const clock=new CeremonyClock();clock.tick(0);clock.tick(1500);clock.seek(T.horizonComplete);assert.equal(sampleAstral(clock.tick(3000),options[9]).finished,true);assert.equal(new CeremonyClock().tick(3000),0);
});
test('invalid clock samples and negative deltas cannot corrupt progress',()=>{
 const clock=new CeremonyClock();clock.tick(20);clock.tick(10);assert.equal(clock.time,0);clock.tick(NaN);clock.tick(Infinity);assert.equal(clock.tick(30),20);
});
test('adaptive quality reduces pixel cost while keeping every frame renderable',()=>{
 const quality=new AdaptiveResolution();for(let i=0;i<90;i++)quality.observe(16.67);assert.equal(quality.scale,1);
 for(let i=0;i<1800;i++)quality.observe(30);assert.ok(quality.scale>=.55);assert.ok(quality.scale<1);
 const before=quality.scale;for(let i=0;i<300;i++)quality.observe(60000);assert.equal(quality.scale,before);
});
test('existing market-value routing and public rarity configuration are preserved',()=>{
 assert.equal(getWishRevealConfig('Common',500).blackHole,false);assert.equal(getWishRevealConfig('Common',500.01).blackHole,true);
 assert.deepEqual(options.slice(0,9).map(o=>o.tier),[1,2,3,4,5,6,7,8,9]);
});
test('the new render dependency graph contains no removed mascot or skin assets',()=>{
 const visited=new Set();function visit(file){file=path.resolve(root,file);if(!path.extname(file))file+='.ts';if(visited.has(file))return;visited.add(file);const src=fs.readFileSync(file,'utf8');assert.doesNotMatch(src,/NebuWishSummon|nebu-cinematic|nebu-heat|nebu-skins|StellarWishJourney/);for(const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)){let next=path.resolve(path.dirname(file),m[1]);if(fs.existsSync(next+'.ts'))visit(next+'.ts');}}
 visit('components/player/WishCinematic.tsx');
});
test('mute, unavailable audio, seeking and repeat cleanup remain safe',async()=>{
 const api=load('components/player/wishAudio');assert.equal(api.startAstralWishAudio(options[0],true),null);await api.primeWishAudio();
});
test('the standalone preview embeds the production asset and offers all ten outcomes',()=>{
 const html=fs.readFileSync(path.resolve(process.argv.find(a=>a.endsWith('Aster-Astral-Preview.html'))||path.join(root,'Aster-Astral-Preview.html')),'utf8');
 assert.ok(html.includes('data:image/webp;base64,'));assert.equal((html.match(/<option value=/g)||[]).length,10);assert.ok(html.includes('class AstralRenderer'));assert.doesNotMatch(html,/<script[^>]+src=/);
});

test('the score also conceals the outcome until the terminal turn and releases its sources',()=>{
 const created=[];const current={nodes:[]};
 class Parameter {constructor(){this.events=[];this.value=0;}setValueAtTime(...v){this.events.push(['set',...v]);}exponentialRampToValueAtTime(...v){this.events.push(['ramp',...v]);}setTargetAtTime(...v){this.events.push(['target',...v]);}cancelScheduledValues(){}}
 class Node {constructor(kind){this.kind=kind;this.starts=[];this.stops=[];this.disconnected=false;for(const k of ['gain','frequency','Q','delayTime','threshold','knee','ratio','attack','release'])this[k]=new Parameter();current.nodes.push(this);}connect(){}disconnect(){this.disconnected=true;}start(t){this.starts.push(t);}stop(t){this.stops.push(t);}}
 class Context {constructor(){this.state='running';this.currentTime=0;this.sampleRate=8000;this.destination={};created.push(this);}createGain(){return new Node('gain');}createDynamicsCompressor(){return new Node('compressor');}createDelay(){return new Node('delay');}createOscillator(){return new Node('oscillator');}createBufferSource(){return new Node('noise');}createBiquadFilter(){return new Node('filter');}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)};}resume(){return Promise.resolve();}}
 global.window={AudioContext:Context,setTimeout:(cb)=>{cb();return 1;}};
 try{
  const api=load('components/player/wishAudio');let opening;
  for(const option of options){current.nodes=[];const session=api.startAstralWishAudio(option,false,65);assert.ok(session);const cues=current.nodes.filter(n=>n.starts.length&&n.starts[0]<T.rarity/1000).map(n=>({kind:n.kind,type:n.type,at:n.starts[0],frequency:n.frequency.events}));
   if(opening)assert.deepEqual(cues,opening);else opening=cues;
   session.setMuted(true);session.setVolume(25);session.stop();session.stop();assert.ok(current.nodes.every(n=>n.disconnected));assert.ok(current.nodes.filter(n=>n.starts.length).every(n=>n.stops.length>=2));
  }
  assert.equal(created.length,1,'Repeated previews reuse a single audio context');
 }finally{delete global.window;}
});
