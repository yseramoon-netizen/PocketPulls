const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'..');
function compile(code){return ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText}
const clockCode=fs.readFileSync(path.join(root,'components/player/observatory/OrbitClock.ts'),'utf8').replace('export class','class');
const {OrbitClock}=vm.runInNewContext(compile(clockCode)+';({OrbitClock})');
const source=fs.readFileSync(path.join(root,'components/player/observatory/UniverseRenderer.ts'),'utf8').replace(/^export /gm,'');
const model=source.slice(source.indexOf('const MAX_VISIBLE_RANKS'),source.indexOf('const BACKGROUND_STARS'));
const numeric='function toNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}function toWholeNumber(v){return Math.max(0,Math.floor(toNumber(v)))}';
const {parseRows,buildGalaxyNodes,resolveGalaxyPosition,buildGalaxyParticles}=vm.runInNewContext(numeric+compile(model)+';({parseRows,buildGalaxyNodes,resolveGalaxyPosition,buildGalaxyParticles})');
const rows=Array.from({length:240},(_,i)=>({rank_position:i+1,user_id:'user-'+i,total_cards:Math.max(0,1000000-i*3917),username:'collector'+i,display_name:'Collector '+i}));
test('ranked universe contains at most 100 real entries and 99 orbiting galaxies',()=>{const players=parseRows(rows);assert.equal(players.length,100);const nodes=buildGalaxyNodes(players);assert.equal(nodes.length,99);assert.ok(nodes.every(n=>n.player.rank>=2));});
test('galaxy sizes stay finite and bounded with extreme collection sizes',()=>{rows[1].total_cards=1e12;const nodes=buildGalaxyNodes(parseRows(rows));for(let i=0;i<nodes.length;i++){assert.ok(Number.isFinite(nodes[i].size));assert.ok(nodes[i].size>=.018&&nodes[i].size<=.105);if(i){assert.ok(nodes[i].size<=nodes[i-1].size);assert.ok(nodes[i].orbitRadius>=nodes[i-1].orbitRadius)}}});
test('galaxies visibly orbit while the number one entry remains reserved for the black hole',()=>{const nodes=buildGalaxyNodes(parseRows(rows));for(const node of [nodes[0],nodes[40],nodes[98]]){const a=resolveGalaxyPosition(node,0,false),b=resolveGalaxyPosition(node,5000,false);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.025);assert.ok(Object.values(b).every(Number.isFinite))}});
test('pause and reduced motion preserve a galaxy position without snapping',()=>{const n=buildGalaxyNodes(parseRows(rows))[0];assert.deepEqual(resolveGalaxyPosition(n,6320,false),resolveGalaxyPosition(n,6320,true));const c=new OrbitClock();c.sample(0,true);c.sample(40,true);c.suspend();assert.equal(c.sample(60000,false),40);c.suspend();assert.equal(c.sample(61000,true),40);assert.equal(c.sample(61016,true),56)});
test('hidden tabs do not advance the orbital clock or cause a resume jump',()=>{const c=new OrbitClock();c.sample(100,true);c.sample(116,true);c.suspend();c.sample(90116,true);assert.equal(c.time,16);c.sample(90132,true);assert.equal(c.time,32)});
test('continuous frame time produces equivalent orbits at 60 and 120 Hz',()=>{const clocks=[60,120].map(fps=>{const c=new OrbitClock();c.sample(0,true);for(let i=1;i<=fps;i++)c.sample(i*1000/fps,true);return c});assert.ok(Math.abs(clocks[0].time-clocks[1].time)<1e-6);});

test('signed account seeds never produce missing or invalid galaxy arms',()=>{for(const seed of [-2147483648,-2147483647,-2000000000,-17,-5,-2,-1,0,1,4294967295]){const particles=buildGalaxyParticles(seed,36);assert.ok(particles.length>0);for(const particle of particles)for(const value of Object.values(particle))assert.ok(Number.isFinite(value),`Invalid particle for seed ${seed}`)}});

// Load the production camera/model without mounting a canvas or mocking its maths.
const modules=new Map();
function loadProduction(relative){
  let file=path.resolve(root,relative);
  if(!path.extname(file))file+='.ts';
  if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',code)(id=>id.startsWith('@/')?loadProduction(id.slice(2)):id.startsWith('.')?loadProduction(path.resolve(path.dirname(file),id)):require(id),module,module.exports);
  return module.exports;
}
const Observatory=loadProduction('components/player/observatory/ObservatoryRenderer');
const Model=loadProduction('components/player/observatory/ConstellationModel');
const Universe=loadProduction('components/player/observatory/UniverseRenderer');
const Navigation=loadProduction('lib/player/observatoryNavigation');
const wishRows=Array.from({length:700},(_,i)=>({id:'wish-'+i,card_id:'card-'+i,market_value_at_wish:5,created_at:'2026-01-02T00:00:00Z'}));
const cardMap=new Map(wishRows.map(wish=>[wish.card_id,{id:wish.card_id,name:wish.card_id,rarity:'Common',market_value:5}]));
const wishStars=Model.buildConstellationStars(wishRows,cardMap,'taurus');
const makeScene=id=>Observatory.buildObservatoryScene(wishStars,'taurus',Universe.parseRows(rows),{id,name:'My collection'});

test('old constellation, card, arrival and ranking URLs retain their destination',()=>{
  assert.equal(Navigation.observatoryHref({panel:'history'}),'/observatory?panel=history');
  assert.equal(Navigation.observatoryHref({},true),'/observatory?view=universe');
  const card=new URL(Navigation.observatoryHref({card:'a b/1'},true),'https://example.test');
  assert.equal(card.searchParams.get('card'),'a b/1');assert.equal(card.searchParams.get('view'),null);
  const arrivals=new URL(Navigation.observatoryHref({arrive:['wish-a','wish-b']},true),'https://example.test');
  assert.deepEqual(arrivals.searchParams.getAll('arrive'),['wish-a','wish-b']);assert.equal(arrivals.searchParams.get('view'),null);
});

test('initial cloud is deterministic and has rounded, tapered edges rather than a rectangle',()=>{
  const again=Model.buildConstellationStars(wishRows,cardMap,'taurus');
  assert.deepEqual(wishStars,again);
  const cloud=wishStars.filter(star=>!star.zodiacAnchor);
  assert.ok(cloud.every(star=>Math.hypot(star.x-50,(star.y-49)/.88)<=53.000001));
  const inner=cloud.filter(star=>Math.hypot(star.x-50,(star.y-49)/.88)<25).length;
  assert.ok(inner>cloud.length*.4,'most density remains near the centre, with quieter edges');
  assert.ok(cloud.some(star=>star.z>20)&&cloud.some(star=>star.z< -20));
});

test('first drag continues the existing projection without switching from flat Earth view',()=>{
  const scene=makeScene('user-7'),home={...Observatory.HOME_VIEW};
  const a=Observatory.observatoryProjection(scene,home,390,720,0,{top:190,bottom:124});
  const b=Observatory.observatoryProjection(scene,{...home,yaw:.00001,pitch:.00001},390,720,0,{top:190,bottom:124});
  assert.equal(a.anchor.x,195);assert.equal(a.anchor.y,393);
  for(const star of wishStars){const first=a.starPoint(star,star.id),next=b.starPoint(star,star.id);assert.ok(Math.hypot(first.x-next.x,first.y-next.y)<.02);}
});

test('both ends of the zoom share the real owner galaxy position and orbital time',()=>{
  for(const id of ['user-0','user-1','user-67','outside-ranking'])for(const [width,height] of [[1280,800],[390,720]]){
    const scene=makeScene(id);
    for(const time of [0,5300,97000]){
      const near=Observatory.observatoryProjection(scene,{...Observatory.HOME_VIEW},width,height,time);
      assert.ok(Math.abs(near.anchor.x-width/2)<1e-8&&Math.abs(near.anchor.y-height/2)<1e-8);
      const far=Observatory.observatoryProjection(scene,{...Observatory.HOME_VIEW,distance:1,yaw:.6,pitch:-.4},width,height,time);
      const position=scene.ownerNode?Universe.resolveGalaxyPosition(scene.ownerNode,time,false):{x:0,y:0,z:0};
      const expected=Universe.createProjector(far.camera,width,height)(position);
      assert.ok(Math.hypot(far.anchor.x-expected.x,far.anchor.y-expected.y)<1e-8);
    }
  }
});

test('unranked accounts retain a personal galaxy without a fabricated ranking',()=>{
  const scene=makeScene('outside-ranking');
  assert.equal(scene.players.length,100);assert.equal(scene.owner.rank,0);assert.equal(scene.nodes.length,100);
  assert.equal(scene.nodes.filter(node=>node.player.isCurrentUser).length,1);
  assert.equal(scene.ownerNode.player.userId,'outside-ranking');
  const pharaoh=makeScene('user-0');assert.equal(pharaoh.owner.rank,1);assert.equal(pharaoh.ownerNode,null);
  const empty=Observatory.buildObservatoryScene([],null,[],{id:'new-account',name:'New player'});
  assert.equal(empty.players.length,0);assert.equal(empty.owner.rank,0);assert.ok(empty.ownerNode);
});

test('full zoom path stays finite and continuous across constellation and galaxy handoff',()=>{
  const scene=makeScene('user-8');let previous=null;
  for(let step=0;step<=2000;step++){
    const distance=-.62+step*(1.96/2000);
    const p=Observatory.observatoryProjection(scene,{...Observatory.HOME_VIEW,distance,yaw:.25,pitch:-.18},390,720,4500,{top:190,bottom:124});
    const sample=p.starPoint(wishStars[21],wishStars[21].id);
    assert.ok([sample.x,sample.y,p.anchor.x,p.anchor.y,p.radius].every(Number.isFinite));
    assert.ok(p.radius>0);
    if(previous)assert.ok(Math.hypot(sample.x-previous.x,sample.y-previous.y)<4,'no positional jump at a transition boundary');
    previous=sample;
  }
});

test('Observatory camera damping behaves consistently at 30, 60 and 120 Hz',()=>{
  const views=[30,60,120].map(hz=>{
    const current={...Observatory.HOME_VIEW},target={...Observatory.HOME_VIEW,distance:1,yaw:4,pitch:-3};
    for(let i=0;i<hz;i++)Observatory.dampView(current,target,1000/hz,false);
    return current;
  });
  for(const key of ['distance','yaw','pitch'])assert.ok(Math.abs(views[0][key]-views[2][key])<1e-9);
  const current={...Observatory.HOME_VIEW},target={...Observatory.HOME_VIEW,distance:1,pitch:2};
  Observatory.dampView(current,target,16,true);assert.deepEqual(current,target);
});
