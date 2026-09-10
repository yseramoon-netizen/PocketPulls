"use client";
import { useEffect, useRef } from "react";
import usePlayerPreferences from "../usePlayerPreferences";
/** A cached, procedural sky; the expensive dust field is painted only on resize. */
export function paintDeepSky(ctx:CanvasRenderingContext2D,w:number,h:number){
 let seed=89125;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296};
 ctx.fillStyle="#050a12";ctx.fillRect(0,0,w,h);
 const haze=(x:number,y:number,r:number,color:string)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)};
 haze(w*.68,h*.56,w*.53,"#14334b34");haze(w*.35,h*.58,w*.38,"#3f3e6723");haze(w*.72,h*.7,w*.3,"#66523210");
 for(let i=0;i<2400;i++){
  const u=random(),offset=(random()+random()+random()-1.5)*.09;
  const x=(u-.1)*w*1.2,y=(.72-u*.31+offset)*h;
  ctx.globalAlpha=random()*.1;ctx.fillStyle=i%3===0?"#b0b9d2":"#6c97b8";ctx.fillRect(x,y,.65+random(),.65+random());
 }
 for(let i=0;i<480;i++){
  const x=random()*w,y=random()*h,r=.28+Math.pow(random(),5)*1.25;
  ctx.globalAlpha=.13+random()*.5;ctx.fillStyle=i%7===0?"#d9c5a3":"#b8cddb";ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
}
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
