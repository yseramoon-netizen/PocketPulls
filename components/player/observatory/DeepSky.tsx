"use client";
import { useEffect, useRef } from "react";
import usePlayerPreferences from "../usePlayerPreferences";
/** A cached, procedural sky; the expensive dust field is painted only on resize. */
export { paintObservatorySky as paintDeepSky } from "./SkyArt";
import { paintObservatorySky as paintDeepSky } from "./SkyArt";
export default function DeepSky({className="",still=false}:{className?:string;still?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);const preferences=usePlayerPreferences();
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)return;
  const texture=document.createElement("canvas"),textureContext=texture.getContext("2d");if(!textureContext)return;
  let frame=0,w=0,h=0,dpr=1,visible=true;
  const reduced=still||preferences.reducedMotion||preferences.lowVisualEffects||preferences.dataSaver;
  const draw=(t:number)=>{frame=0;if(!visible||document.hidden)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(texture,0,0,w,h);
   if(!reduced){for(let i=0;i<12;i++){const x=((i*137.508+91)%997)/997*w,y=((i*211.217+53)%601)/601*h;const a=.08+Math.sin(t*.00065+i*1.7)**2*.22;ctx.fillStyle=`rgba(218,230,241,${a})`;ctx.fillRect(x-2,y,5,1);ctx.fillRect(x,y-2,1,5)}frame=requestAnimationFrame(draw)}
  };
  const queue=()=>{if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw)};
  const resize=()=>{w=canvas.clientWidth;h=canvas.clientHeight;if(!w||!h)return;dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/(w*h)));canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);texture.width=canvas.width;texture.height=canvas.height;textureContext.setTransform(dpr,0,0,dpr,0,0);paintDeepSky(textureContext,w,h);queue()};
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)queue();else{cancelAnimationFrame(frame);frame=0}});observer.observe(canvas);
  const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else queue()};document.addEventListener("visibilitychange",onVisibility);
  return()=>{cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();document.removeEventListener("visibilitychange",onVisibility)};
 },[still,preferences.reducedMotion,preferences.lowVisualEffects,preferences.dataSaver]);
 return <canvas ref={ref} aria-hidden="true" className={className} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}
