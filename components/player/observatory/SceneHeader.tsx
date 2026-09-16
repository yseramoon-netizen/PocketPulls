"use client";
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** The measured header reserves space for long names and translated controls. */
export default function SceneHeader({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}) {
  const ref=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const header=ref.current, scene=header?.closest<HTMLElement>('.ap-scene');
    if(!header||!scene)return;
    const measure=()=>scene.style.setProperty('--ap-scene-headspace',`${Math.ceil(header.offsetHeight+20)}px`);
    const observer=new ResizeObserver(measure);observer.observe(header);measure();
    return()=>observer.disconnect();
  },[]);
  return <header ref={ref} className="ap-scene-header">
    <div className="ap-scene-heading"><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
    <div className="ap-scene-actions">{children}</div>
  </header>;
}
