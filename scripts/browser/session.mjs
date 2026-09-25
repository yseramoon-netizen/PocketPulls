import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const qaRoot = process.env.ANCIENT_PULLS_QA_REPORTS || path.join(projectRoot, 'docs/verification');
const origin = process.env.ANCIENT_PULLS_QA_ORIGIN || 'http://localhost:3100';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
export const uid='11111111-1111-4111-8111-111111111111';
const uuid=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const rares=['Common','Uncommon','Rare','Double Rare','Ultra Rare','Illustration Rare','Special Illustration Rare','Hyper Rare','Crown Rare'];
const names=['Moonlit Sentinel','Glasswing Oracle','The Last Stargazer','Echo of Andromeda','Solar Ascendant','Nightfall Keeper','The Celestial Archive','Wanderer of Worlds','Crown of Starlight'];
export async function capture(page, output) {
 const c = await page.context().newCDPSession(page);
 let timer;
 try {
  const result = await Promise.race([c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Screenshot capture timed out: ' + path.basename(output))), 12000); })]);
  fs.writeFileSync(output, Buffer.from(result.data, 'base64'));
 } finally { clearTimeout(timer); await c.detach().catch(() => {}); }
}
export async function session({mobile=false,balance=34,empty=false,reduced=false,loseResponse=false}={}){
 const browser=await chromium.launch({executablePath:process.env.ANCIENT_PULLS_BROWSER || undefined,args:process.env.ANCIENT_PULLS_BROWSER?['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']:[],headless:true});
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:reduced?'reduce':'no-preference'});
 context.setDefaultTimeout(25000);
 const state={balance,calls:[],awards:new Map(),errors:[],requests:[],loss:loseResponse};
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'preview@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Lukas Moon',username:'lukas'}};
 const token=[{alg:'HS256',typ:'JWT'},{sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+7200},'preview'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await context.addInitScript(({user,token,reduced})=>{localStorage.setItem('sb-ancient-preview-auth-token',JSON.stringify({access_token:token,refresh_token:'offline-preview-refresh',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user}));localStorage.setItem('ancient-pulls:cookie-notice:2026-09','seen');localStorage.setItem('pocketpulls:player-preferences-v1',JSON.stringify({reducedMotion:reduced,lowVisualEffects:false,largerText:false,dataSaver:false,cinematicSeen:true,skipPullCinematic:false,musicVolume:35,sfxVolume:72}));}, {user,token,reduced});
 const card=n=>({id:'card-'+n,name:names[n%9],set_name:'Celestial Origins',card_no:String(n).padStart(3,'0')+'/100',rarity:rares[n%9],market_value:2+n*3,image_url:origin+'/qa-card/'+n+'.svg'});
 const wishes=empty?[]:Array.from({length:72},(_,i)=>({id:uuid(i+1),card_id:card(i).id,market_value_at_wish:2+i*3,created_at:new Date(Date.UTC(2026,6,1+i)).toISOString()}));
 await context.route('**/qa-card/*.svg',async route=>{const n=Number(route.request().url().split('/').at(-1).split('.')[0]);const c=['#99c8ea','#92ddb0','#80c9f1','#b2a0fa','#e1c477','#daa0c1','#88d4d4','#e6d073','#efecd4'][n%9];await route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="500" viewBox="0 0 360 500"><defs><radialGradient id="g"><stop stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="#071321"/></radialGradient></defs><rect width="360" height="500" rx="18" fill="#111d2d"/><rect x="10" y="10" width="340" height="480" rx="12" fill="url(#g)" stroke="${c}" stroke-opacity=".6"/><circle cx="180" cy="211" r="108" fill="none" stroke="${c}" opacity=".4"/><ellipse cx="180" cy="211" rx="135" ry="42" fill="none" stroke="${c}" transform="rotate(-40 180 211)"/><path d="m180 105 26 79 79 27-79 25-26 79-26-79-79-25 79-27z" fill="${c}"/><text x="180" y="400" text-anchor="middle" fill="#ede5d4" font-family="serif" font-size="23">${names[n%9]}</text><text x="180" y="439" text-anchor="middle" fill="${c}" font-family="sans-serif" font-size="11" letter-spacing="3">CELESTIAL ORIGINS</text><text x="180" y="472" text-anchor="middle" fill="#8998a8" font-size="10">FICTIONAL TEST CARD</text></svg>`});});
 await context.route('https://ancient-preview.supabase.co/**',async route=>{
  const req=route.request(), url=new URL(req.url()), name=url.pathname.split('/').at(-1);state.requests.push(name);
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  let data=[];
  if(url.pathname.includes('/auth/')) data=name==='user'?user:{access_token:token,refresh_token:'offline-preview-refresh',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user};
  else if(name==='player_profiles')data=[{user_id:uid,username:'lukas',display_name:'Lukas Moon',avatar_url:null,is_banned:false}];
  else if(name==='player_wallets')data=[{user_id:uid,wish_balance:state.balance,lifetime_wishes_spent:72}];
  else if(name==='get_player_purchase_consent')data=[{accepted:true}];
  else if(name==='get_player_launch_state')data=[{maintenance_mode:false}];
  else if(name==='get_player_zodiac_sign')data=[{zodiac_sign:'taurus'}];
  else if(name==='get_player_preferences')data=[{reduced_motion:reduced,music_volume:35,sfx_volume:72,low_visual_effects:false,larger_text:false,skip_pull_cinematic:false,data_saver:false,cinematic_seen:true}];
  else if(name==='player_wishes')data=wishes;
  else if(name==='pokemon_cards')data=Array.from({length:74},(_,i)=>card(i));
  else if(name==='get_player_leaderboard')data=Array.from({length:35},(_,i)=>({rank_position:i+1,user_id:i===6?uid:uuid(200+i),username:i===6?'lukas':'stargazer'+i,display_name:i===6?'Lukas Moon':['Orion','Lyra','Seren','Atlas','Sol','Nova'][i%6],total_cards:2000-i*40,unique_cards:500-i*4,collection_value:10000-i*120,lifetime_wishes_spent:2300-i*40,is_current_user:i===6}));
  else if(name==='get_player_collection_overview')data=[{total_cards:72,unique_cards:72,available_cards:72,reserved_cards:0,collection_value:2628,sets:['Celestial Origins'],rarities:rares}];
  else if(name==='get_player_collection')data=Array.from({length:18},(_,i)=>({...card(i),card_id:card(i).id,quantity:1,reserved_quantity:0,available_quantity:1,owned_value:2+i*3,total_count:72}));
  else if(name==='get_player_binder_settings')data=[{binder_name:'My cosmic binder',theme_key:'midnight',is_public:true}];
  else if(name==='get_player_binder_themes')data=[];
  else if(name==='make_player_wish'){
   const key=JSON.parse(req.postData()||'{}').p_idempotency_key;state.calls.push(key);
   if(!state.awards.has(key)){
    if(state.balance===0)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Not enough wishes',code:'P0001'})});
    state.balance--;const result={wish_id:uuid(900+state.awards.size),card_id:'card-73',...card(73),wish_balance:state.balance};
    state.awards.set(key,result);wishes.push({id:result.wish_id,card_id:result.card_id,market_value_at_wish:result.market_value,created_at:new Date().toISOString()});
   }
   if(state.loss){state.loss=false;return route.abort('connectionreset');}
   data=[state.awards.get(key)];
  }
  if(req.headers().accept?.includes('vnd.pgrst.object'))data=Array.isArray(data)?data[0]??null:data;
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,(data?.length||1)-1)}/${data?.length||1}`},body:JSON.stringify(data)});
 });
 await context.route('**/api/player/**',async route=>{const url=route.request().url();let data={ok:true};if(url.includes('wishes/store'))data={ok:true,ordersOpen:false,firstRechargeAvailable:false,firstRechargeDiscountPercent:20,packages:[10,25,50,100,250].map((n,i)=>({id:['little-star','wishing-cluster','starfall','constellation','celestial-vault'][i],name:['Little Star','Wishing Cluster','Starfall','Constellation','Celestial Vault'][i],subtitle:n+' wishes',wishes:n,amountPence:[500,1175,2250,4200,9500][i],firstRechargeAmountPence:[400,940,1800,3360,7600][i],bulkDiscountPercent:[0,6,10,16,24][i]}))};if(url.includes('nebu-entitlements'))data={skins:[]};await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
 const page=await context.newPage();page.on('pageerror',e=>state.errors.push(e.message));
 await page.goto(origin+'/observatory',{waitUntil:'networkidle'});
 await page.waitForSelector('[data-testid="constellation-shell"]',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('[data-observatory-level] canvas')?.style.opacity==='1',{timeout:30000});
 return {browser,context,page,state};
}
if(process.argv[1]?.endsWith('session.mjs')){
 const {browser,page,state}=await session();fs.mkdirSync(path.join(qaRoot,'screenshots'),{recursive:true});
 await page.screenshot({path:path.join(qaRoot,'screenshots/desktop-home.png')});
 await page.getByRole('button',{name:'Call Astra',exact:true}).click();await page.waitForTimeout(900);
 await page.screenshot({path:path.join(qaRoot,'screenshots/desktop-astra.png')});
 await page.getByTestId('astra-staff').click();await page.waitForTimeout(500);
 await page.screenshot({path:path.join(qaRoot,'screenshots/desktop-menu.png')});
 console.log(JSON.stringify({errors:state.errors,body:(await page.locator('body').innerText()).slice(0,1200),requests:[...new Set(state.requests)]}));await browser.close();
}
