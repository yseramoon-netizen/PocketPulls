"use client";

import { useEffect, useRef } from 'react';
import usePlayerPreferences from '../usePlayerPreferences';
import { paintObservatorySky } from './SkyArt';
import { buildGalaxyNodes, drawGalaxy, type LeaderboardPlayer } from './UniverseRenderer';

/** Decorative, cached galaxy study. Never presents fabricated player or card data. */
export default function CelestialWindow({className=''}:{className?:string}){
  const canvas=useRef<HTMLCanvasElement>(null),preferences=usePlayerPreferences();
  useEffect(()=>{
    const element=canvas.current,context=element?.getContext('2d',{alpha:false});
    if(!element||!context)return;
    const sky=document.createElement('canvas'),galaxy=document.createElement('canvas');
    const skyContext=sky.getContext('2d'),galaxyContext=galaxy.getContext('2d');if(!skyContext||!galaxyContext)return;
    const player:LeaderboardPlayer={userId:'celestial-art',rank:2,username:'',displayName:'',avatarUrl:null,totalCards:1,uniqueCards:1,collectionValue:0,lifetimeWishes:0,score:0,isCurrentUser:false,cosmicIssueNumber:null};
    const node=buildGalaxyNodes([player])[0];
    galaxy.width=galaxy.height=800;
    drawGalaxy(galaxyContext,{...node,flatten:.62,tilt:-.3,hue:210},{x:400,y:400,depth:0,scale:1},240,0,false,false,true);
    const reduced=preferences.reducedMotion||preferences.lowVisualEffects||preferences.dataSaver;
    let raf=0,visible=true,w=0,h=0,dpr=1,elapsed=0,previous:number|null=null;
    const draw=(stamp:number)=>{
      raf=0;if(!visible||document.hidden)return;
      if(previous!==null&&!reduced)elapsed+=Math.min(64,stamp-previous);previous=stamp;
      context.setTransform(dpr,0,0,dpr,0,0);context.drawImage(sky,0,0,w,h);
      context.save();context.translate(w*.61,h*.46);context.rotate(Math.sin(elapsed*.000018)*.09);
      const size=Math.max(w*.88,h*.95);context.drawImage(galaxy,-size/2,-size/2,size,size);context.restore();
      if(!reduced)raf=requestAnimationFrame(draw);
    };
    const queue=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(draw);};
    const resize=()=>{w=element.clientWidth;h=element.clientHeight;if(!w||!h)return;dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1400000/(w*h)));element.width=sky.width=Math.round(w*dpr);element.height=sky.height=Math.round(h*dpr);skyContext.setTransform(dpr,0,0,dpr,0,0);paintObservatorySky(skyContext,w,h);queue();};
    const size=new ResizeObserver(resize);size.observe(element);resize();
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;previous=null;if(visible)queue();else{cancelAnimationFrame(raf);raf=0;}});intersection.observe(element);
    const visibility=()=>{previous=null;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else queue();};document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(raf);size.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);sky.width=galaxy.width=1;};
  },[preferences.reducedMotion,preferences.lowVisualEffects,preferences.dataSaver]);
  return <canvas ref={canvas} aria-hidden="true" className={className} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}
