"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ZODIAC_SHAPES, type ZodiacSign } from '@/lib/player/zodiac-constellations';
import { readArrivalIds, clearArrivalQuery } from '@/lib/player/constellationArrival';
import { getErrorMessage } from '@/lib/player/format';
import useModalFocus from '@/lib/client/useModalFocus';
import usePlayerPreferences from '../usePlayerPreferences';
import AstraArrival from '../astral/AstraArrival';
import type { ArrivalTarget } from '../astral/flight';
import SceneHeader from './SceneHeader';
import AstralIcon from './AstralIcon';
import { OrbitClock } from './OrbitClock';
import { parseRows, resolveGalaxyPosition, type LeaderboardPlayer } from './UniverseRenderer';
import { buildConstellationStars, parseZodiacSign, formatMoney, formatDate, anniversaryMessage, type WishRow, type CardRow, type ConstellationStar } from './ConstellationModel';
import { ObservatoryRenderer, HOME_VIEW, BLACK_HOLE_VISITOR_LIMIT, buildObservatoryScene, clampDistance, clampSingularityDepth, ownsBlackHole, dampView, observatoryLevel, type ObservatoryLevel, type ObservatoryView, type ObservatoryFrame, type ObservatoryScene } from './ObservatoryRenderer';
import styles from './Observatory.module.css';

type Panel='cards'|'galaxies'|'info'|null;
const emptyFrame:ObservatoryFrame={stars:[],galaxies:[],owner:{x:0,y:0,radius:0},pending:false};

export default function Observatory(){
  const preferences=usePlayerPreferences();
  const [stars,setStars]=useState<ConstellationStar[]>([]),[zodiac,setZodiac]=useState<ZodiacSign|null>(null);
  const [players,setPlayers]=useState<LeaderboardPlayer[]>([]),[user,setUser]=useState<{id:string;name:string}|null>(null);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[painted,setPainted]=useState(false);
  const [error,setError]=useState(''),[rankError,setRankError]=useState('');
  const [panel,setPanel]=useState<Panel>(null),[search,setSearch]=useState('');
  const [selectedStar,setSelectedStar]=useState<ConstellationStar|null>(null),[selectedGalaxy,setSelectedGalaxy]=useState<LeaderboardPlayer|null>(null);
  const [level,setLevel]=useState<ObservatoryLevel>('stars'),[paused,setPaused]=useState(false),[systemReduced,setSystemReduced]=useState(false);
  const [holeMode,setHoleModeState]=useState(false),holeModeRef=useRef(false);
  const setHoleMode=useCallback((value:boolean)=>{holeModeRef.current=value;setHoleModeState(value);},[]);
  const [arrivalIds,setArrivalIds]=useState<string[]>([]),[arrivalMessage,setArrivalMessage]=useState('');
  const viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),ownerLabel=useRef<HTMLButtonElement>(null);
  const zoomInput=useRef<HTMLInputElement>(null),zoomRail=useRef<HTMLDivElement>(null);
  const renderer=useRef<ObservatoryRenderer|null>(null),frame=useRef<ObservatoryFrame>(emptyFrame),clock=useRef(new OrbitClock());
  const current=useRef<ObservatoryView>({...HOME_VIEW}),target=useRef<ObservatoryView>({...HOME_VIEW});
  const requestFrame=useRef<()=>void>(()=>{}),loadVersion=useRef(0),levelRef=useRef(level),arriving=useRef(new Set<string>());
  const gestures=useRef({points:new Map<number,{x:number;y:number}>(),moved:false,travel:0});
  const deepLinkHandled=useRef(false);
  const scene=useMemo(()=>user?{...buildObservatoryScene(stars,zodiac,players,user),entryConfirmed:!rankError}:null,[stars,zodiac,players,user,rankError]);
  const reduced=preferences.reducedMotion||systemReduced;
  const runtime=useRef<{scene:ObservatoryScene|null;reduced:boolean;low:boolean;paused:boolean;star:string|null;galaxy:string|null}>({scene:null,reduced:false,low:false,paused:false,star:null,galaxy:null});

  const load=useCallback(async()=>{
    const version=++loadVersion.current;setRefreshing(true);setError('');setRankError('');
    try{
      const {data:{user:account},error:authError}=await supabase.auth.getUser();
      if(authError)throw authError;if(!account)throw new Error('Sign in to open your Observatory.');
      const [wishResult,zodiacResult,rankResult]=await Promise.all([
        supabase.from('player_wishes').select('id, card_id, market_value_at_wish, created_at').eq('user_id',account.id).order('created_at',{ascending:false}).limit(1600),
        supabase.rpc('get_player_zodiac_sign'),
        supabase.rpc('get_player_leaderboard',{p_limit:100}),
      ]);
      if(wishResult.error)throw wishResult.error;
      const wishes=(wishResult.data||[]) as WishRow[];
      const missing=readArrivalIds(window.location.search).filter(id=>!wishes.some(wish=>String(wish.id)===id));
      if(missing.length){const result=await supabase.from('player_wishes').select('id, card_id, market_value_at_wish, created_at').eq('user_id',account.id).in('id',missing);if(result.error)throw result.error;wishes.push(...(result.data||[]) as WishRow[]);}
      const linkedCard=new URLSearchParams(window.location.search).get('card');
      if(linkedCard&&!wishes.some(wish=>String(wish.card_id)===linkedCard)){
        const result=await supabase.from('player_wishes').select('id, card_id, market_value_at_wish, created_at').eq('user_id',account.id).eq('card_id',linkedCard).limit(1);
        if(result.error)throw result.error;wishes.push(...(result.data||[]) as WishRow[]);
      }
      wishes.sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
      const ids=[...new Set(wishes.map(wish=>wish.card_id).filter((id):id is string|number=>id!=null))],cards:CardRow[]=[];
      for(let start=0;start<ids.length;start+=200){
        const result=await supabase.from('pokemon_cards').select('id, name, set_name, card_no, rarity, market_value, image_url').in('id',ids.slice(start,start+200));
        if(result.error)throw result.error;cards.push(...(result.data||[]) as CardRow[]);
      }
      if(version!==loadVersion.current)return;
      const sign=zodiacResult.error?null:parseZodiacSign(Array.isArray(zodiacResult.data)?zodiacResult.data[0]:zodiacResult.data);
      const nextStars=buildConstellationStars(wishes,new Map(cards.map(card=>[String(card.id),card])),sign);
      setUser({id:account.id,name:account.user_metadata?.display_name||account.user_metadata?.username||'Your galaxy'});
      setZodiac(sign);setStars(nextStars);setPlayers(rankResult.error?[]:parseRows(rankResult.data));
      if(rankResult.error)setRankError('The rankings are unavailable. Your constellation is still here.');
      setSelectedStar(selected=>selected?nextStars.find(star=>star.id===selected.id)??null:null);
      const arrivals=readArrivalIds(window.location.search),available=arrivals.filter(id=>nextStars.some(star=>star.id===id));
      if(arrivals.length&&!available.length){clearArrivalQuery();arriving.current.clear();setArrivalIds([]);setArrivalMessage('These wish stars could not be found in your account.');}
      else if(available.length){arriving.current=new Set(available);setArrivalIds(available);Object.assign(target.current,HOME_VIEW);Object.assign(current.current,HOME_VIEW);}
    }catch(problem){if(version===loadVersion.current)setError(getErrorMessage(problem,'Your Observatory could not be loaded.'));}
    finally{if(version===loadVersion.current){setLoading(false);setRefreshing(false);}}
  },[]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search),ids=readArrivalIds(window.location.search);
    if(params.get('view')==='universe'&&!ids.length&&!params.get('card')){target.current.distance=current.current.distance=1;setLevel('universe');levelRef.current='universe';}
    if(params.get('panel')==='history')setPanel('cards');
    arriving.current=new Set(ids);setArrivalIds(ids);void load();
    return()=>{loadVersion.current++;};
  },[load]);

  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setSystemReduced(media.matches);
    sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);
  },[]);

  useEffect(()=>{
    runtime.current={scene,reduced,low:preferences.lowVisualEffects||preferences.dataSaver,paused,star:selectedStar?.id??null,galaxy:selectedGalaxy?.userId??null};
    requestFrame.current();
  },[scene,reduced,preferences.lowVisualEffects,preferences.dataSaver,paused,selectedStar,selectedGalaxy]);
  useEffect(()=>{renderer.current?.invalidate();requestFrame.current();},[scene]);
  useEffect(()=>{requestFrame.current();},[panel,holeMode,loading]);
  useEffect(()=>{
    if(!holeMode)return;
    let active=true,pending=false;
    const refreshRank=async()=>{
      if(pending||document.hidden)return;pending=true;
      try{
        const result=await supabase.rpc('get_player_leaderboard',{p_limit:100});
        if(!active)return;
        if(result.error)throw result.error;
        setPlayers(parseRows(result.data));setRankError('');
      }catch{if(active)setRankError('Rankings could not be verified. Singularity entry is paused.');}
      finally{pending=false;}
    };
    void refreshRank();const timer=window.setInterval(()=>void refreshRank(),60000);
    const visible=()=>{if(!document.hidden)void refreshRank();};document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[holeMode]);

  useEffect(()=>{
    const element=canvas.current,container=viewport.current;if(!element||!container)return;
    const context=element.getContext('2d',{alpha:false,desynchronized:true});if(!context){setError('Your browser could not create the sky. Try reloading the page.');return;}
    const painter=new ObservatoryRenderer(context);renderer.current=painter;
    let raf=0,last:number|null=null,active=true,didPaint=false;
    const insets={top:0,bottom:124};
    const draw=(stamp:number)=>{
      raf=0;if(!active||document.hidden){last=null;return;}
      const r=runtime.current;if(!r.scene)return;
      target.current.singularity=clampSingularityDepth(target.current.singularity,r.scene);
      current.current.singularity=clampSingularityDepth(current.current.singularity,r.scene);
      const dt=last===null?1000/60:stamp-last;last=stamp;
      const unsettled=dampView(current.current,target.current,dt,r.reduced);
      const moving=!r.reduced&&!r.paused&&current.current.distance>.16;
      const time=clock.current.sample(stamp,moving);
      const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;
      const density=Math.min(window.devicePixelRatio||1,r.low?1:width<768?1.2:1.5,Math.sqrt(1900000/(width*height)));
      try{
        frame.current=painter.render(width,height,density,current.current,time,r.scene,{reduced:r.reduced||r.paused,low:r.low,selectedStar:r.star,selectedGalaxy:r.galaxy,arriving:arriving.current,insets});
      }catch{last=null;setError('The sky could not be drawn. Try again to restore your Observatory.');return;}
      const nextLevel=observatoryLevel(current.current.distance,current.current.singularity);
      if(nextLevel!==levelRef.current){levelRef.current=nextLevel;setLevel(nextLevel);}
      const label=ownerLabel.current;if(label){
        const point=frame.current.owner;
        label.style.transform=`translate3d(${Math.max(70,Math.min(width-70,point.x))}px,${Math.max(insets.top,Math.min(height-155,point.y+point.radius*1.5+18))}px,0) translateX(-50%)`;
        label.style.visibility=current.current.singularity<.005&&!holeModeRef.current&&current.current.distance>.44&&point.x>-20&&point.x<width+20&&point.y>-20&&point.y<height+20?'visible':'hidden';
        label.style.opacity=String(Math.max(0,Math.min(1,(current.current.distance-.44)/.24)));
      }
      const railValue=holeModeRef.current?target.current.singularity:(1.34-target.current.distance)/1.96;
      if(zoomInput.current){
        zoomInput.current.value=String(railValue*100);
        zoomInput.current.setAttribute('aria-valuetext',holeModeRef.current&&!ownsBlackHole(r.scene)&&railValue>=BLACK_HOLE_VISITOR_LIMIT-.001?'Event horizon. Only first place can enter the singularity.':`${Math.round(railValue*100)}%`);
      }
      zoomRail.current?.style.setProperty('--zoom-position',`${Math.max(0,Math.min(1,railValue))*100}%`);
      if(!didPaint){didPaint=true;setPainted(true);}
      if(unsettled||moving||frame.current.pending)queue();else last=null;
    };
    const queue=()=>{if(active&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);};requestFrame.current=queue;
    const heading=container.parentElement?.querySelector('.ap-scene-header');
    const resize=()=>{insets.top=heading?Math.max(0,heading.getBoundingClientRect().bottom-container.getBoundingClientRect().top+10):0;queue();};
    const observer=new ResizeObserver(resize);observer.observe(container);if(heading)observer.observe(heading);resize();
    const visibility=()=>{clock.current.suspend();last=null;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else queue();};
    document.addEventListener('visibilitychange',visibility);queue();
    return()=>{active=false;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);painter.dispose();renderer.current=null;requestFrame.current=()=>{};};
  },[]);

  const updateUrl=useCallback((view:string|null)=>{
    const url=new URL(window.location.href);if(view)url.searchParams.set('view',view);else url.searchParams.delete('view');
    url.searchParams.delete('panel');url.searchParams.delete('target');
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  },[]);
  const goTo=useCallback((distance:number)=>{
    const blackHole=distance>0&&distance<.78&&ownsBlackHole(runtime.current.scene);
    setHoleMode(blackHole);
    Object.assign(target.current,{...HOME_VIEW,distance:blackHole?1:distance,singularity:blackHole?.24:0});setSelectedStar(null);setSelectedGalaxy(null);setPanel(null);setSearch('');
    updateUrl(distance>=.8?'universe':null);requestFrame.current();
  },[updateUrl,setHoleMode]);
  const zoomBy=useCallback((amount:number)=>{
    if(arriving.current.size)return;
    if(!holeModeRef.current&&ownsBlackHole(runtime.current.scene)&&target.current.distance>=.78&&amount<0){setHoleMode(true);Object.assign(target.current,{distance:1,singularity:0,focusX:0,focusY:0,focusZ:0});}
    if(holeModeRef.current){
      if(amount>0&&target.current.singularity<=0){setHoleMode(false);target.current.distance=clampDistance(1+amount);}
      else target.current.singularity=clampSingularityDepth(target.current.singularity-amount,runtime.current.scene);
    }else target.current.distance=clampDistance(target.current.distance+amount);
    target.current.starX=target.current.starY=target.current.starZ=0;
    setSelectedStar(null);setSelectedGalaxy(null);requestFrame.current();
  },[setHoleMode]);
  const aimAtBlackHole=useCallback((clientX:number,clientY:number)=>{
    if(holeModeRef.current||current.current.distance<.78)return;
    const bounds=viewport.current?.getBoundingClientRect();if(!bounds)return;
    const hit=frame.current.galaxies.find(hit=>hit.player.rank===1&&Math.hypot(hit.x-clientX+bounds.left,hit.y-clientY+bounds.top)<=hit.radius);
    if(!hit||hit.player.userId!==runtime.current.scene?.leader?.userId)return;
    setHoleMode(true);Object.assign(target.current,{distance:1,singularity:0,focusX:0,focusY:0,focusZ:0});
  },[setHoleMode]);
  const setRailZoom=useCallback((value:number)=>{
    if(arriving.current.size)return;
    const amount=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
    if(!holeModeRef.current&&ownsBlackHole(runtime.current.scene)&&target.current.distance>=.78&&amount>(1.34-target.current.distance)/1.96){setHoleMode(true);Object.assign(target.current,{distance:1,singularity:0,focusX:0,focusY:0,focusZ:0});}
    if(holeModeRef.current)target.current.singularity=clampSingularityDepth(amount,runtime.current.scene);
    else {target.current.distance=clampDistance(1.34-amount*1.96);target.current.starX=target.current.starY=target.current.starZ=0;}
    setSelectedStar(null);setSelectedGalaxy(null);requestFrame.current();
  },[setHoleMode]);
  const visitStar=useCallback((star:ConstellationStar)=>{
    setHoleMode(false);
    Object.assign(target.current,{...HOME_VIEW,distance:-.34,starX:star.x-50,starY:star.y-50,starZ:star.z});
    setSelectedGalaxy(null);setSelectedStar(star);setPanel(null);updateUrl(null);requestFrame.current();
  },[updateUrl,setHoleMode]);
  const visitGalaxy=useCallback((player:LeaderboardPlayer)=>{
    const r=runtime.current.scene;if(!r)return;
    const node=r.nodes.find(node=>node.player.userId===player.userId),position=node?resolveGalaxyPosition(node,clock.current.time,false):{x:0,y:0,z:0};
    setHoleMode(player.rank===1&&player.userId===r.leader?.userId);
    Object.assign(target.current,{distance:1,singularity:0,focusX:position.x*.64,focusY:position.y*.64,focusZ:position.z*.64,starX:0,starY:0,starZ:0});
    setSelectedStar(null);setSelectedGalaxy(player);setPanel(null);updateUrl('universe');requestFrame.current();
  },[updateUrl,setHoleMode]);
  const exploreBlackHole=useCallback(()=>{
    if(!runtime.current.scene?.leader)return;
    setHoleMode(true);Object.assign(target.current,{...HOME_VIEW,distance:1,singularity:.24});
    setSelectedGalaxy(null);setSelectedStar(null);setPanel(null);updateUrl('universe');requestFrame.current();
  },[setHoleMode,updateUrl]);

  useEffect(()=>{
    if(loading||!scene||deepLinkHandled.current)return;
    const id=new URLSearchParams(window.location.search).get('card');if(!id)return;
    deepLinkHandled.current=true;const star=stars.find(star=>star.cardId===id);if(star)visitStar(star);else setArrivalMessage('This card does not have a wish star in your constellation yet.');
  },[loading,scene,stars,visitStar]);
  useEffect(()=>{
    const restore=()=>{const params=new URLSearchParams(window.location.search);goTo(params.get('view')==='universe'?1:0);setPanel(params.get('panel')==='history'?'cards':null);};
    window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
  },[goTo]);

  const pointerDown=useCallback((event:ReactPointerEvent<HTMLDivElement>)=>{
    if(arriving.current.size||event.button>0)return;
    if((event.target as HTMLElement).closest('button,a,input'))return;
    event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
    gestures.current.points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gestures.current.points.size===1){gestures.current.moved=false;gestures.current.travel=0;}else gestures.current.moved=true;
    event.currentTarget.style.cursor='grabbing';
  },[]);
  const pointerMove=useCallback((event:ReactPointerEvent<HTMLDivElement>)=>{
    const g=gestures.current,previous=g.points.get(event.pointerId);if(!previous)return;
    const before=[...g.points.values()];g.points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(g.points.size>=2){
      const after=[...g.points.values()],a=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),b=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
      if(a>4&&b>4){if(b>a)aimAtBlackHole((after[0].x+after[1].x)/2,(after[0].y+after[1].y)/2);zoomBy(-Math.log(b/a)*.48);}g.moved=true;return;
    }
    const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
    g.travel+=Math.hypot(dx,dy);if(g.travel>3)g.moved=true;
    target.current.yaw+=dx*.005;target.current.pitch-=dy*.005;
    requestFrame.current();
  },[zoomBy,aimAtBlackHole]);
  const pointerUp=useCallback((event:ReactPointerEvent<HTMLDivElement>)=>{
    const g=gestures.current,tap=g.points.size===1&&!g.moved&&event.type!=='pointercancel';g.points.delete(event.pointerId);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(g.points.size){g.moved=true;return;}event.currentTarget.style.cursor='grab';
    if(!tap)return;
    const bounds=event.currentTarget.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    if(current.current.distance<.62){
      const hit=frame.current.stars.map(hit=>({hit,distance:Math.hypot(hit.x-x,hit.y-y)})).filter(item=>item.distance<=item.hit.radius).sort((a,b)=>a.distance-b.distance)[0];
      if(hit)visitStar(hit.hit.star);
    }else{
      const hit=frame.current.galaxies.map(hit=>({hit,distance:Math.hypot(hit.x-x,hit.y-y)})).filter(item=>item.distance<=item.hit.radius).sort((a,b)=>a.distance-b.distance)[0];
      if(hit)visitGalaxy(hit.hit.player);
    }
  },[visitGalaxy,visitStar]);
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();if(event.deltaY<0)aimAtBlackHole(event.clientX,event.clientY);const unit=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1;zoomBy(Math.max(-.18,Math.min(.18,event.deltaY*unit*.00052)));};
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
  },[zoomBy,aimAtBlackHole]);

  const closePanel=useCallback(()=>{setPanel(null);const url=new URL(window.location.href);url.searchParams.delete('panel');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);},[]);
  const panelRef=useModalFocus<HTMLElement>(panel!==null,closePanel);
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(arriving.current.size||event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable))return;
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();setPanel('cards');setSearch('');}
      if(event.key==='Escape'){setSelectedStar(null);setSelectedGalaxy(null);}
    };
    document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown);
  },[]);
  const openPanel=(next:Panel)=>{setSearch('');setSelectedStar(null);setSelectedGalaxy(null);setPanel(old=>old===next?null:next);};
  const getArrivalTargets=useCallback(():ArrivalTarget[]=>{
    const rect=canvas.current?.getBoundingClientRect();if(!rect)return [];
    return arrivalIds.flatMap(id=>{const hit=frame.current.stars.find(hit=>hit.star.id===id);return hit?[{id,x:(rect.left+hit.x)/window.innerWidth,y:(rect.top+hit.y)/window.innerHeight,colour:hit.star.colour,secondary:hit.star.colour}]:[];});
  },[arrivalIds]);
  const starArrived=useCallback((id:string)=>{arriving.current.delete(id);requestFrame.current();},[]);
  const finishArrival=useCallback(()=>{arriving.current.clear();setArrivalIds([]);clearArrivalQuery();setArrivalMessage('Stars added.');requestFrame.current();},[]);
  const filteredStars=useMemo(()=>[...stars].reverse().filter(star=>[star.name,star.setName,star.cardNumber,star.rarity].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase()))),[stars,search]);
  const ranked=scene?.players??[],filteredPlayers=ranked.filter(player=>`${player.displayName} ${player.username} #${player.rank}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalValue=useMemo(()=>stars.reduce((total,star)=>total+star.marketValue,0),[stars]);
  const rank=scene?.owner.rank??0;

  return <section className={`ap-scene ${styles.page}`} data-observatory-level={level} data-black-hole-selected={holeMode}>
    <SceneHeader title="Observatory">
      <button className="ap-scene-button" aria-expanded={panel==='cards'} onClick={()=>openPanel('cards')}><AstralIcon name="search"/>Find a card</button>
      <button className="ap-scene-button" aria-expanded={panel==='galaxies'} onClick={()=>openPanel('galaxies')}><AstralIcon name="universe"/>Galaxies</button>
      <button className="ap-scene-button" aria-label="Observatory information" aria-expanded={panel==='info'} onClick={()=>openPanel('info')}><AstralIcon name="info"/><span className={styles.infoText}>Info</span></button>
    </SceneHeader>
    <div ref={viewport} className={styles.viewport} data-onboarding-target="constellation" tabIndex={0} aria-label="Explore the Observatory" aria-describedby="observatory-controls" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onKeyDown={event=>{
        if(event.target!==event.currentTarget)return;
        if(event.key==='+'||event.key==='=')zoomBy(-.12);
        else if(event.key==='-')zoomBy(.12);
        else if(event.key==='0'||event.key==='Home')goTo(0);
        else if(event.key==='Escape'){setSelectedStar(null);setSelectedGalaxy(null);closePanel();}
        else if(event.key==='ArrowLeft')target.current.yaw-=.12;
        else if(event.key==='ArrowRight')target.current.yaw+=.12;
        else if(event.key==='ArrowUp')target.current.pitch+=.12;
        else if(event.key==='ArrowDown')target.current.pitch-=.12;
        else return;event.preventDefault();requestFrame.current();
      }}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" style={{opacity:painted?1:0}}/>
      <button ref={ownerLabel} className={styles.ownerLabel} onClick={()=>rank===1?exploreBlackHole():goTo(0)} style={{visibility:'hidden'}} aria-label={rank===1?'Explore your black hole':'Enter your constellation'}><i/><span>{rank===1?'Your black hole':'Your galaxy'}<small>{rank?`#${rank}`:'Personal galaxy'}</small></span></button>
    </div>
    <div className={styles.vignette} aria-hidden="true"/>
    {(loading||(!painted&&!error))&&<div className={styles.loading} role="status"><span/><p>Loading…</p></div>}
    {error&&<div className={styles.error} role="alert"><p>{error}</p><button onClick={()=>void load()}>Try again</button></div>}
    {!loading&&scene&&stars.length===0&&level==='stars'&&!error&&<div className={styles.empty}><AstralIcon/><h2>No wish stars yet.</h2><Link href="/wishes">Make a wish <AstralIcon name="arrow"/></Link></div>}
    {panel&&<aside ref={panelRef} className={`ap-scene-panel ${styles.panel}`} role="dialog" aria-modal="true" aria-label={panel==='cards'?'Find a card':panel==='galaxies'?'Find a galaxy':'Observatory information'} tabIndex={-1}>
      <div className="ap-panel-heading"><div><p>{panel==='cards'?'Your collection':panel==='galaxies'?'The ranked universe':'Your place in the sky'}</p><h2>{panel==='cards'?'Find a card':panel==='galaxies'?'Galaxies':'Observatory'}</h2></div><button className="ap-scene-button" onClick={closePanel} aria-label="Close panel"><AstralIcon name="close"/></button></div>
      {panel!=='info'?<>
        <label><span className="sr-only">{panel==='cards'?'Search by card name, set, number or rarity':'Search by name or rank'}</span><input data-autofocus value={search} onChange={event=>setSearch(event.target.value)} placeholder={panel==='cards'?'Name, set, number or rarity':'Name or rank'}/></label>
        {panel==='galaxies'&&<button className={styles.personal} onClick={()=>goTo(.54)}><AstralIcon name="constellation"/><span>Find my galaxy</span><small>{rank?`#${rank}`:'Personal'}</small></button>}
        {panel==='galaxies'&&rankError&&<div role="status" className={styles.notice}>{rankError}<button onClick={()=>void load()}>Retry rankings</button></div>}
        <div className={styles.results}>{panel==='cards'?filteredStars.map(star=><button className={styles.cardRow} key={star.id} onClick={()=>visitStar(star)}><span>{star.imageUrl?<img src={star.imageUrl} alt="" loading="lazy"/>:<AstralIcon/>}</span><span><strong>{star.name}</strong><small>{star.setName}{star.cardNumber?` · #${star.cardNumber}`:''}</small><small style={{color:star.colour}}>{star.rarity}</small></span><AstralIcon name="arrow"/></button>):filteredPlayers.map(player=><button className={styles.galaxyRow} key={player.userId} onClick={()=>visitGalaxy(player)}><span>{String(player.rank).padStart(2,'0')}</span><span><strong>{player.displayName}</strong><small>{player.rank===1?'Black hole':player.isCurrentUser?'Your galaxy':`@${player.username}`}</small></span><AstralIcon name="arrow"/></button>)}</div>
        {(panel==='cards'?filteredStars.length===0:filteredPlayers.length===0)&&<p className={styles.notice}>{loading?'Mapping your sky…':search?'Nothing matches that search.':panel==='cards'?'Your first wish will appear here.':rankError?'':'The first collection will become the centre.'}</p>}
      </>:<>
        <p>Zoom out from your stars to see your galaxy, then continue into the universe. Your galaxy stays marked. Select it to return.</p>
        <div className={styles.stats}><Stat label="Wish stars" value={String(stars.length)}/><Stat label="Star value" value={formatMoney(totalValue)}/><Stat label="Your rank" value={rankError?'Unavailable':rank?`#${rank}`:'Outside top 100'}/><Stat label="Ranked collections" value={String(ranked.length)}/></div>
        <p>The #1 collection owns the black hole. Only that account can zoom past the event horizon into the singularity.</p>
        {zodiac?<p>Your {ZODIAC_SHAPES[zodiac].label} constellation is clearest from its home view.</p>:<p><Link href="/profile">Choose your star sign</Link> to give your constellation a shape.</p>}
        {stars.length>=1600&&<p>The map shows your latest 1,600 wish stars and any stars arriving now.</p>}
        <button className="ap-scene-button" onClick={()=>void load()} disabled={refreshing}><AstralIcon name="reset"/>{refreshing?'Refreshing…':'Refresh Observatory'}</button>
      </>}
    </aside>}
    {selectedStar&&!panel&&<aside className={`ap-scene-panel ${styles.memory}`} aria-label="Card memory"><div className="ap-panel-heading"><div><p style={{color:selectedStar.colour}}>{selectedStar.rarity}</p><h2>{selectedStar.name}</h2></div><button className="ap-scene-button" onClick={()=>setSelectedStar(null)} aria-label="Close memory"><AstralIcon name="close"/></button></div><div className={styles.cardDetails}>{selectedStar.imageUrl?<img src={selectedStar.imageUrl} alt={selectedStar.name}/>:<AstralIcon/>}<div><p>{selectedStar.setName}</p>{selectedStar.cardNumber&&<p>Card #{selectedStar.cardNumber}</p>}<strong>{formatMoney(selectedStar.marketValue)}</strong><small>{formatDate(selectedStar.grantedAt)}</small></div></div>{selectedStar.anniversaryYears>0&&<p>{anniversaryMessage(selectedStar.anniversaryYears)}</p>}<button className={styles.personal} onClick={()=>goTo(0)}>Back to my stars <AstralIcon name="arrow"/></button></aside>}
    {selectedGalaxy&&!panel&&<aside className={`ap-scene-panel ${styles.memory}`} aria-label="Galaxy details"><div className="ap-panel-heading"><div><p>{selectedGalaxy.rank===1?'#1 · Black hole':selectedGalaxy.rank?`Galaxy #${selectedGalaxy.rank}`:'Your personal galaxy'}</p><h2>{selectedGalaxy.displayName}</h2></div><button className="ap-scene-button" onClick={()=>setSelectedGalaxy(null)} aria-label="Close galaxy"><AstralIcon name="close"/></button></div>{selectedGalaxy.rank>0?<div className={styles.stats}><Stat label="Cards" value={selectedGalaxy.totalCards.toLocaleString('en-GB')}/><Stat label="Unique cards" value={selectedGalaxy.uniqueCards.toLocaleString('en-GB')}/><Stat label="Collection value" value={formatMoney(selectedGalaxy.collectionValue)}/><Stat label="Wishes" value={selectedGalaxy.lifetimeWishes.toLocaleString('en-GB')}/></div>:<p>Your galaxy is shown outside the ranked top 100.</p>}{selectedGalaxy.rank===1&&<button className={styles.personal} onClick={exploreBlackHole}>Explore black hole <AstralIcon name="arrow"/></button>}{selectedGalaxy.isCurrentUser&&<button className={styles.personal} onClick={()=>goTo(0)}>Enter my constellation <AstralIcon name="arrow"/></button>}</aside>}
    <p id="observatory-controls" className="sr-only">Scroll or pinch to travel between your constellation and the universe. Drag or use arrow keys to rotate through 360 degrees. Plus and minus zoom. Home returns to your stars.</p>
    {!loading&&!error&&!panel&&!selectedStar&&!selectedGalaxy&&<div ref={zoomRail} className={styles.zoomRail} aria-label="Zoom controls">
      <button aria-label="Zoom in" onClick={()=>zoomBy(-.1)}>+</button>
      <div className={styles.zoomTrack}>
        {holeMode&&!ownsBlackHole(scene)&&<><span className={styles.zoomBlocked} style={{height:`${(1-BLACK_HOLE_VISITOR_LIMIT)*100}%`}} aria-hidden="true"/><span className={styles.zoomLimit} style={{top:`${(1-BLACK_HOLE_VISITOR_LIMIT)*100}%`}} title="Only the #1 account can enter the singularity"><svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="2" y="6" width="8" height="7" rx="2" fill="none" stroke="currentColor"/><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor"/></svg></span></>}
        <input ref={zoomInput} type="range" min="0" max="100" step="0.1" defaultValue={(holeModeRef.current?target.current.singularity:(1.34-target.current.distance)/1.96)*100} aria-orientation="vertical" aria-label={holeMode?'Black hole zoom':'Observatory zoom'} aria-describedby={holeMode&&!ownsBlackHole(scene)?'singularity-access':undefined}
          onChange={event=>{setRailZoom(Number(event.currentTarget.value)/100);event.currentTarget.value=String((holeModeRef.current?target.current.singularity:(1.34-target.current.distance)/1.96)*100);}}
          onKeyDown={event=>{const value=Number(event.currentTarget.value)/100;const next=event.key==='Home'?0:event.key==='End'?1:['ArrowUp','ArrowRight'].includes(event.key)?value+.025:['ArrowDown','ArrowLeft'].includes(event.key)?value-.025:event.key==='PageUp'?value+.1:event.key==='PageDown'?value-.1:null;if(next===null)return;event.preventDefault();setRailZoom(next);}}
        />
      </div>
      <button aria-label="Zoom out" onClick={()=>zoomBy(.1)}>−</button>
      <span id="singularity-access" className="sr-only">Only the current first-place account can fully enter the black hole. Other accounts stop at the event horizon.</span>
    </div>}
    {!loading&&!panel&&<div className={styles.controls}>
      <nav className={styles.stages} aria-label="Observatory scale"><button aria-current={level==='stars'?'step':undefined} onClick={()=>goTo(0)}>My stars</button><span/><button aria-current={level==='galaxy'?'step':undefined} onClick={()=>goTo(.54)}>{rank===1?'My black hole':'My galaxy'}</button><span/><button aria-current={level==='universe'?'step':undefined} onClick={()=>goTo(1)}>Universe</button></nav>
      <div className={styles.dock}><span className={styles.scaleLabel}>{level==='stars'?'Constellation':level==='galaxy'?'Galaxy':level==='singularity'?'Singularity':holeMode?'Black hole':'Universe'}</span><i/>{level!=='stars'&&!reduced&&<button onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Play':'Pause'}</button>}<button aria-label={holeMode?'Return to universe':'Return to my stars'} onClick={()=>goTo(holeMode?1:0)}><AstralIcon name="reset"/></button></div>
    </div>}
    {arrivalIds.length>0&&!loading&&painted&&!error&&<AstraArrival getTargets={getArrivalTargets} onArrived={starArrived} onDone={finishArrival}/>}
    {arrivalMessage&&<p className="ap-arrival-message" role="status">{arrivalMessage}</p>}
  </section>;
}

function Stat({label,value}:{label:string;value:string}){return <div><span>{label}</span><strong>{value}</strong></div>;}
