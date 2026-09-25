/* Offline security, ownership and interface regressions. Never spends a real wish. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
function loader(overrides={}){
  const cache=new Map();
  function load(file){
    let name=path.resolve(root,file);
    if(!path.extname(name))name+=fs.existsSync(name+'.ts')?'.ts':'.tsx';
    const key=path.relative(root,name).split(path.sep).join('/');
    if(key in overrides)return overrides[key];
    if(cache.has(name))return cache.get(name).exports;
    const m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(path.dirname(name));cache.set(name,m);
    m.require=id=>id in overrides?overrides[id]:id.startsWith('@/')?load(id.slice(2)):id.startsWith('.')?load(path.resolve(path.dirname(name),id)):require(id);
    m._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);
    return m.exports;
  }
  return load;
}
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const key='d1446391-15c6-4c2d-928c-29311b1f0a28';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='offline-test';
function wishHarness({user={id:'player'},data={wish_id:'wish',card_id:'card',wish_balance:4},rpcError=null}={}){
  const calls=[];
  const load=loader({'@supabase/supabase-js':{createClient:(url,anon,options)=>{
    calls.push(['create',url,anon,options]);return {auth:{getUser:async token=>{calls.push(['verify',token]);return {data:{user},error:user?null:{message:'expired'}};}},rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data,error:rpcError};}};
  }}});
  return {POST:load('app/api/player/wishes/make/route').POST,calls};
}
function request(headers={}){return new Request('https://ancientpulls.invalid/api/player/wishes/make',{method:'POST',headers});}
test('anonymous wish attempts stop before creating a database client',async()=>{const h=wishHarness();assert.equal((await h.POST(request())).status,401);assert.equal(h.calls.length,0);});
for(const value of [undefined,'','no-key','123'])test(`missing or malformed idempotency key is rejected (${String(value)})`,async()=>{const h=wishHarness();const headers={authorization:'Bearer session'};if(value!==undefined)headers['Idempotency-Key']=value;assert.equal((await h.POST(request(headers))).status,400);assert.equal(h.calls.length,0);});
test('expired wish sessions cannot invoke the spending RPC',async()=>{const h=wishHarness({user:null});const response=await h.POST(request({authorization:'Bearer expired','Idempotency-Key':key}));assert.equal(response.status,401);assert.ok(!h.calls.some(c=>c[0]==='rpc'));});
test('wish requests use the verified player token, not a body-supplied account',async()=>{const h=wishHarness();const req=new Request('https://ancientpulls.invalid/api/player/wishes/make',{method:'POST',headers:{authorization:'Bearer actual-player','Idempotency-Key':key},body:JSON.stringify({userId:'another-account'})});const response=await h.POST(req);assert.equal(response.status,200);assert.equal(h.calls[0][3].global.headers.Authorization,'Bearer actual-player');assert.deepEqual(h.calls.at(-1),['rpc','make_player_wish',{p_idempotency_key:key}]);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('idempotency-key'),key);});
test('wish retries preserve the supplied idempotency key',async()=>{const h=wishHarness();for(let i=0;i<2;i++)await h.POST(request({authorization:'Bearer player','Idempotency-Key':key}));assert.deepEqual(h.calls.filter(c=>c[0]==='rpc').map(c=>c[2].p_idempotency_key),[key,key]);});
for(const data of [null,{},[],{wish_id:'w',card_id:'c',wish_balance:null},{wish_id:'w',card_id:'c',wish_balance:'NaN'}])test(`incomplete wish responses stay recoverable (${JSON.stringify(data)})`,async()=>{const h=wishHarness({data});const response=await h.POST(request({authorization:'Bearer player','Idempotency-Key':key}));assert.equal(response.status,500);assert.match((await response.json()).error.message,/same Idempotency-Key/);});
test('insufficient wishes return a controlled error',async()=>{const h=wishHarness({rpcError:{message:'Not enough wishes'}});const response=await h.POST(request({authorization:'Bearer player','Idempotency-Key':key}));assert.equal(response.status,400);assert.equal((await response.json()).ok,false);});
test('retired allocation endpoint cannot spend or mutate inventory',async()=>{const load=loader({'lib/supabaseAdmin.ts':new Proxy({},{get:()=>{throw Error('Database must not be used');}})});assert.equal((await load('app/api/pull/route').POST(request())).status,410);});
test('price refresh rejects non-admin accounts before any price or database operation',async()=>{
  class AdminAccessError extends Error{constructor(){super('Administrator access required');this.status=403;}}
  let touched=false;const load=loader({'lib/admin/server-auth.ts':{AdminAccessError,requireAdmin:async()=>{throw new AdminAccessError();}},'lib/supabaseAdmin.ts':{supabaseAdmin:new Proxy({},{get:()=>{touched=true;throw Error('Unexpected database call');}})}});
  const response=await load('app/api/prices/refresh/route').POST(request({authorization:'Bearer regular-player'}));assert.equal(response.status,403);assert.equal(touched,false);
  const legacy=load('app/api/update-prices/route');assert.equal((await legacy.GET()).status,405);assert.equal((await legacy.POST(request())).status,403);
});
test('purchase status scopes the order and wallet to the authenticated account',async()=>{
  const queries=[];const service={from:table=>{const q={table,filters:[]};queries.push(q);const chain={select:()=>chain,eq:(k,v)=>{q.filters.push([k,v]);return chain;},maybeSingle:async()=>({data:table==='player_wallets'?{wish_balance:8}:{id:'owned-order',status:'paid'},error:null})};return chain;}};
  const load=loader({'lib/player/wish-store-server.ts':{getServiceClient:()=>service,getBearerToken:()=> 'verified-token',getVerifiedUser:async()=>({id:'owner'}),playerErrorResponse:()=>Response.json({ok:false},{status:500})}});
  const response=await load('app/api/player/wishes/purchase-status/route').GET(new Request('https://ancientpulls.invalid/api/player/wishes/purchase-status?session_id=cs_private'));
  assert.equal(response.status,200);assert.ok(queries.every(q=>q.filters.some(([key,value])=>key==='user_id'&&value==='owner')));assert.ok(queries[0].filters.some(([k,v])=>k==='stripe_checkout_session_id'&&v==='cs_private'));assert.equal(response.headers.get('cache-control'),'no-store');
});
test('checkout stays closed until business details and confirmation email are configured',()=>{
  const before={open:process.env.ANCIENT_PULLS_ORDERS_OPEN,key:process.env.RESEND_API_KEY,from:process.env.ANCIENT_PULLS_ORDER_EMAIL_FROM};
  try{process.env.ANCIENT_PULLS_ORDERS_OPEN='true';delete process.env.RESEND_API_KEY;delete process.env.ANCIENT_PULLS_ORDER_EMAIL_FROM;
    assert.equal(loader({'lib/player/legal.ts':{BUSINESS_DETAILS_COMPLETE:true}})('lib/player/orders').areOrdersOpen(),false);
    process.env.RESEND_API_KEY='offline';process.env.ANCIENT_PULLS_ORDER_EMAIL_FROM='orders@example.invalid';
    assert.equal(loader({'lib/player/legal.ts':{BUSINESS_DETAILS_COMPLETE:false}})('lib/player/orders').areOrdersOpen(),false);
  }finally{for(const [k,v]of [['ANCIENT_PULLS_ORDERS_OPEN',before.open],['RESEND_API_KEY',before.key],['ANCIENT_PULLS_ORDER_EMAIL_FROM',before.from]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('authentication redirects remain local',()=>{const {normaliseNextPath}=loader()('lib/auth/navigation');for(const path of ['https://example.com','//example.com','/\\example.com','/\u0000foo'])assert.equal(normaliseNextPath(path),'/hq');assert.equal(normaliseNextPath('/constellation?panel=history'),'/constellation?panel=history');});
test('rank parser excludes duplicate and empty accounts',()=>{const {parseRows}=loader()('components/player/observatory/UniverseRenderer');const rows=[{rank_position:1,user_id:'a'},{rank_position:1,user_id:'b'},{rank_position:2,user_id:'a'},{rank_position:3,user_id:''},{rank_position:4,user_id:'c'}];assert.deepEqual(parseRows(rows).map(p=>p.userId),['a','c']);});
test('camera damping is equivalent at 30, 60 and 120 Hz',()=>{const {cameraDamping}=loader()('components/player/observatory/UniverseRenderer');const values=[30,60,120].map(fps=>{let x=0;for(let i=0;i<fps;i++)x+=(1-x)*cameraDamping(1000/fps);return x;});assert.ok(Math.max(...values)-Math.min(...values)<1e-10);});
test('mobile orbital array fits within the initial portrait viewport',()=>{const u=loader()('components/player/observatory/UniverseRenderer');const rows=Array.from({length:100},(_,i)=>({rank_position:i+1,user_id:'u'+i,total_cards:100-i}));const nodes=u.buildGalaxyNodes(u.parseRows(rows)),project=u.createProjector({yaw:0,pitch:0,zoom:1,focusX:0,focusY:0,focusZ:0},390,760);for(let time=0;time<260000;time+=3000)for(const node of nodes){const p=project(u.resolveGalaxyPosition(node,time,false));assert.ok(p.x>4&&p.x<386);}});
test('shared error, loading and disabled-action states have accessible markup',()=>{
  const load=loader({'components/player/AsterismSigil.tsx':{default:()=>null}}),ui=load('components/player/PlayerUI.tsx');
  const error=renderToStaticMarkup(React.createElement(ui.PlayerErrorBanner,{message:'Offline',onRetry:()=>{}}));assert.match(error,/role="alert"/);assert.match(error,/Try again/);
  const loading=renderToStaticMarkup(React.createElement(ui.PlayerLoadingCards,{count:3}));assert.match(loading,/aria-busy="true"/);assert.match(loading,/Loading your cards/);
  const button=renderToStaticMarkup(React.createElement(ui.PlayerPrimaryButton,{disabled:true},'Make a wish'));assert.match(button,/disabled=""/);
});
test('consolidated routes remain redirects, not standalone navigation destinations',()=>{for(const [route,destination]of [['trade','friends'],['orders','shipping'],['history','constellation'],['support','help']])assert.ok(source(`app/(player)/${route}/page.tsx`).includes(destination));const {PLAYER_ROUTES}=loader()('lib/player/routes');assert.ok(!PLAYER_ROUTES.some(r=>['/trade','/orders','/history','/support'].includes(r.href)));});
test('map header measures content instead of hard-coded mobile toolbar offsets',()=>{assert.match(source('components/player/observatory/SceneHeader.tsx'),/ResizeObserver/);const css=source('app/astral.css');assert.match(css,/top:var\(--ap-scene-headspace\)/);assert.doesNotMatch(css,/ap-scene-actions\{top:136px/);});
