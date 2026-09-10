/* Bundled by build-astral-preview.cjs with the production engine, score and embedded artwork. */
const $=(id)=>document.getElementById(id);
const root=$('ceremony'),canvas=$('scene');
const rarityNames=['Common','Uncommon','Rare','Double Rare','Ultra Rare','Illustration Rare','Special Illustration Rare','Hyper Rare','Crown Rare','Crown Rare'];
const rarities=rarityNames.map((name,i)=>{const config=ASTRAL.getWishRevealConfig(name,i===9?501:0);return[config.label,config.primary,config.secondary];});
let engine=null,audio=null,raf=0,muted=true,running=false,paused=false,clock=new ASTRAL.CeremonyClock(),last=null;
let adaptive=new ASTRAL.AdaptiveResolution(),options=getOptions(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function getOptions(){const i=Number($('rarity').value),r=rarities[i];return{tier:Math.min(9,i+1),blackHole:i===9,primary:r[1],secondary:r[2]};}
function sound(){audio?.stop();audio=ASTRAL.startAstralWishAudio(options,muted,65,clock.time);}
function stillFallback(){engine?.dispose();engine=null;root.classList.add('still');$('qualityNote').hidden=false;$('qualityNote').textContent='Your device is using the gentle card reveal.';}
function updateReveal(p){root.style.setProperty('--reveal',p);root.style.setProperty('--card-y',((1-p)*45)+'px');root.style.setProperty('--card-rotate',((1-p)*-24)+'deg');root.style.setProperty('--card-scale',.76+p*.24);}
function tick(now){
 if(!running)return;
 const time=clock.tick(now);
 if(paused||document.hidden){last=null;raf=requestAnimationFrame(tick);return;}
 const f=engine?.render(time,options)||ASTRAL.sampleAstral(time,options);
 const p=reduced?Math.min(1,time/900):f.reveal;
 updateReveal(p);
 if(p>0){$('result').hidden=false;root.dataset.stage='revealing';$('caption').hidden=true;}
 if(f.finished||(reduced&&time>=900)){
  running=false;root.dataset.stage='complete';updateReveal(1);$('result').hidden=false;$('result').removeAttribute('inert');$('result').setAttribute('aria-hidden','false');$('pause').hidden=true;$('skip').hidden=true;
  $('announcement').textContent=rarities[Number($('rarity').value)][0]+'. Aster, your constellation spirit.';$('replay').focus({preventScroll:true});return;
 }
 if(last!==null&&!paused&&adaptive.observe(now-last))engine?.resize(adaptive.scale);
 last=now;raf=requestAnimationFrame(tick);
}
async function begin(){
 cancelAnimationFrame(raf);audio?.stop();clock=new ASTRAL.CeremonyClock();last=null;options=getOptions();running=true;paused=false;root.dataset.paused='false';root.dataset.stage='playing';
 root.style.setProperty('--rarity',options.primary);root.style.setProperty('--rarity-secondary',options.secondary);updateReveal(0);
 $('rarityLabel').textContent=rarities[Number($('rarity').value)][0];$('intro').hidden=true;$('result').hidden=true;$('result').setAttribute('inert','');$('result').setAttribute('aria-hidden','true');$('previewFlag').hidden=true;$('skip').hidden=false;$('pause').hidden=reduced;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause animation');$('pausedLabel').hidden=true;
 $('caption').hidden=false;$('caption').style.animation='none';void $('caption').offsetWidth;$('caption').style.animation='';
 if(!engine&&!reduced)clock.seek(ASTRAL.ceremonyDuration(options.blackHole)-1100);
 await ASTRAL.primeWishAudio();if(!running)return;clock.setPaused(document.hidden);if(!document.hidden&&!reduced)sound();raf=requestAnimationFrame(tick);$('skip').focus({preventScroll:true});
}
$('begin').onclick=begin;$('replay').onclick=begin;
$('choose').onclick=()=>{
 cancelAnimationFrame(raf);audio?.stop();audio=null;running=false;paused=false;root.dataset.stage='intro';$('result').hidden=true;$('intro').hidden=false;$('previewFlag').hidden=false;$('caption').hidden=true;$('pausedLabel').hidden=true;$('pause').hidden=true;$('skip').hidden=true;engine?.render(2300,getOptions());$('begin').focus({preventScroll:true});
};
$('skip').onclick=()=>{clock.seek(ASTRAL.ceremonyDuration(options.blackHole));clock.setPaused(false);paused=false;root.dataset.paused='false';$('pausedLabel').hidden=true;audio?.stop();};
$('pause').onclick=()=>{
 paused=!paused;clock.setPaused(paused||document.hidden);root.dataset.paused=paused;$('pausedLabel').hidden=!paused;$('pause').textContent=paused?'▷':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Resume animation':'Pause animation');if(paused)audio?.stop();else sound();
};
$('sound').onclick=async()=>{
 muted=!muted;$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Turn sound on':'Mute sound');$('soundPath').setAttribute('d',muted?'m16 9 5 6m0-6-5 6':'M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14');
 await ASTRAL.primeWishAudio();if(running&&!paused&&!document.hidden)sound();
};
document.addEventListener('visibilitychange',()=>{clock.setPaused(document.hidden||paused);last=null;audio?.stop();if(!document.hidden&&running&&!paused&&!reduced)sound();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&running)$('skip').click();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);audio?.stop();engine?.dispose();});
new ResizeObserver(()=>{engine?.resize(adaptive.scale);if(!running)engine?.render(root.dataset.stage==='intro'?2300:ASTRAL.ceremonyDuration(options.blackHole),options);}).observe(canvas);
(async()=>{
 $('cardMascot').src=ASSET;
 if(!reduced){const artwork=await ASTRAL.loadAstralArtwork(ASSET);try{if(!artwork)throw new Error('Artwork unavailable');engine=new ASTRAL.AstralRenderer(canvas,artwork,false,()=>{stillFallback();if(running)clock.seek(ASTRAL.ceremonyDuration(options.blackHole)-800);});engine.render(2300,options);}catch{stillFallback();}}
 else{root.classList.add('still');$('qualityNote').hidden=false;$('qualityNote').textContent='Reduced motion is enabled. Your wish uses a gentle reveal.';}
 $('begin').disabled=false;$('begin').innerHTML='Make a wish <span aria-hidden="true">↗</span>';
})();
