"use client";
import { useEffect, useRef } from 'react';
import usePlayerPreferences from '../usePlayerPreferences';
import { AstraRig } from './AstraRig';
import type { FlightPose } from './flight';

let atlas: Promise<HTMLImageElement> | undefined;
export function loadAstraAtlas() {
  if(!atlas) atlas=new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{atlas=undefined;reject(new Error('Astra artwork unavailable'));};
    image.src='/ancient-pulls/wish/astral/astra-rig.png';
  });
  return atlas;
}

export function companionPose(t:number):FlightPose {
  const wave=Math.max(0,Math.sin(t*.6))**8;
  return {x:.5+Math.sin(t*.65)*.013,y:.55+Math.sin(t*1.4)*.017,scale:1,
    roll:Math.sin(t*.8)*.055,yaw:Math.sin(t*.48)*.27,leftArm:.35+Math.sin(t*1.6)*.09,
    rightArm:-.4-wave*(1.1+Math.sin(t*6)*.18),kick:Math.sin(t*1.8)*.13,leftLeg:Math.sin(t*1.8)*.13,rightLeg:-Math.sin(t*1.8+.7)*.13,stretch:1+Math.sin(t*2.2)*.012,headTilt:-wave*.08+Math.sin(t*.8)*.025,wind:.08,gaze:.5,charge:.2,expression:wave>.5?3:0};
}

/** A real articulated idle: cape inertia, body breathing, feet and a small wave. */
export default function AstraCompanion({className='',label='Astra, your star companion',still=false}:{className?:string;label?:string;still?:boolean}) {
  const ref=useRef<HTMLCanvasElement>(null), prefs=usePlayerPreferences();
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const c=canvas.getContext('2d');if(!c)return;
    let active=true,visible=true,frame=0,rig:AstraRig|undefined,last=0,elapsed=0;
    const reduced=still||prefs.reducedMotion||prefs.lowVisualEffects||prefs.dataSaver;
    const draw=(stamp:number)=>{
      frame=0;if(!active||!visible||document.hidden||!rig){last=0;return;}
      if(last)elapsed+=Math.min(50,stamp-last);last=stamp;
      const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
      if(!w||!h)return;
      if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
      c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
      rig.draw(c,companionPose(reduced?1:elapsed/1000),reduced?1:elapsed/1000,Math.min(w,h)*.74,w,h);
      if(!reduced)frame=requestAnimationFrame(draw);
    };
    const queue=()=>{if(active&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);};
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;last=0;if(visible)queue();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(canvas);
    const resize=new ResizeObserver(queue);resize.observe(canvas);
    const visibility=()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else queue();};
    document.addEventListener('visibilitychange',visibility);
    void loadAstraAtlas().then(image=>{if(active){rig=new AstraRig(image);queue();}}).catch(()=>{/* The accessible label remains available if artwork fails. */});
    return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',visibility);};
  },[still,prefs.reducedMotion,prefs.lowVisualEffects,prefs.dataSaver]);
  return <canvas ref={ref} className={`ap-astra-companion ${className}`} role={label?'img':undefined} aria-hidden={!label||undefined} aria-label={label||undefined}/>;
}
