"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import useModalFocus from "@/lib/client/useModalFocus";
import { isRouteActive } from "@/lib/player/routes";
import QuickNavigation from "./QuickNavigation";
import AstralIcon, { type AstralIconName } from "./observatory/AstralIcon";
import styles from "./observatory/Navigation.module.css";
const Preferences = dynamic(() => import("./PlayerPreferences"), { ssr: false });
const Notifications = dynamic(() => import("./NotificationCentre"), { ssr: false });
const primary: {href:string;label:string;short:string;icon:AstralIconName}[] = [
 {href:"/hq",label:"Overview",short:"Home",icon:"home"},
 {href:"/constellation",label:"Constellation",short:"Stars",icon:"constellation"},
 {href:"/wishes",label:"Wishes",short:"Wish",icon:"star"},
 {href:"/collection",label:"Binder",short:"Binder",icon:"binder"},
 {href:"/leaderboard",label:"Universe",short:"Ranks",icon:"universe"},
];
const secondary = [
 {href:"/catalogue",label:"Catalogue",detail:"Explore every card",icon:"catalogue" as const},
 {href:"/friends",label:"Friends",detail:"Visit collections and trade",icon:"friends" as const},
 {href:"/shipping",label:"Shipping & orders",detail:"Select cards and track deliveries",icon:"binder" as const},
 {href:"/achievements",label:"Achievements",detail:"Your milestones and rewards",icon:"star" as const},
 {href:"/profile",label:"Profile",detail:"Your identity and star sign",icon:"constellation" as const},
 {href:"/help",label:"Help",detail:"Answers and support",icon:"info" as const},
];
export default function PlayerNav({username,displayName,avatarUrl,wishBalance}:{username:string;displayName:string;avatarUrl:string|null;wishBalance:number}) {
 const pathname=usePathname();
 const [menu,setMenu]=useState(false), [balance,setBalance]=useState(wishBalance), [cinematic,setCinematic]=useState(false),[signingOut,setSigningOut]=useState(false),[ready,setReady]=useState(false),[reward,setReward]=useState(false);
 const menuRef=useModalFocus<HTMLElement>(menu,()=>setMenu(false));
 useEffect(()=>{const id=requestAnimationFrame(()=>setMenu(false));return()=>cancelAnimationFrame(id)},[pathname]);
 useEffect(()=>{const id=requestAnimationFrame(()=>setBalance(wishBalance));return()=>cancelAnimationFrame(id)},[wishBalance]);
 useEffect(()=>{const id=window.setTimeout(()=>setReady(true),800);return()=>clearTimeout(id)},[]);
 useEffect(()=>{
  const onBalance=(e:Event)=>{const n=Number((e as CustomEvent).detail?.wishBalance);if(Number.isFinite(n))setBalance(Math.max(0,Math.floor(n)))};
  const onCinematic=(e:Event)=>{setCinematic(Boolean((e as CustomEvent).detail?.open));setMenu(false)};
  window.addEventListener("pocketpulls:wish-balance",onBalance);window.addEventListener("pocketpulls:wish-cinematic-visibility",onCinematic);
  return()=>{window.removeEventListener("pocketpulls:wish-balance",onBalance);window.removeEventListener("pocketpulls:wish-cinematic-visibility",onCinematic)};
 },[]);
 useEffect(()=>{
  if(!ready)return;let active=true;
  const check=async()=>{const {data,error}=await supabase.rpc("get_player_achievements");if(active&&!error&&Array.isArray(data))setReward(data.some((r:Record<string,unknown>)=>Boolean(r.unlocked_at)&&!r.reward_claimed_at&&Number(r.reward_wishes)>0))};
  void check();window.addEventListener("pocketpulls:achievement-reward-claimed",check);
  return()=>{active=false;window.removeEventListener("pocketpulls:achievement-reward-claimed",check)};
 },[ready]);
 async function signOut(){if(signingOut)return;setSigningOut(true);const timer=setTimeout(()=>window.location.replace("/sign-in"),1800);try{await supabase.auth.signOut({scope:"local"})}finally{clearTimeout(timer);window.location.replace("/sign-in")}}
 if(cinematic)return null;
 return <>
  <header data-player-nav className={styles.header}>
   <Link href="/hq" className={styles.brand} aria-label="Ancient Pulls home"><span className={styles.mark}><AstralIcon /></span><span>ANCIENT<span className={styles.brandLight}>PULLS</span></span></Link>
   <nav className={styles.desktop} aria-label="Main navigation">{primary.map(item=><Link key={item.href} href={item.href} aria-current={isRouteActive(pathname,item.href)?"page":undefined} data-onboarding-target={item.href==="/wishes"?"nav-wishes":undefined}>{item.label}</Link>)}</nav>
   <div className={styles.utilities}>
    <Link href="/wishes/shop" className={styles.balance} aria-label={`${balance} wishes. Open recharge.`}><AstralIcon/><span>{balance.toLocaleString("en-GB")}</span><small>Wishes</small><span aria-hidden="true">+</span></Link>
    <div className={styles.notifications}>{ready?<Notifications/>:null}</div>
    <button type="button" className={styles.menuButton} aria-label="Open menu" aria-expanded={menu} onClick={()=>setMenu(true)}><AstralIcon name="menu"/>{reward?<i aria-label="Reward available"/>:null}</button>
   </div>
  </header>
  <nav className={styles.mobile} aria-label="Mobile navigation">{primary.map(item=><Link key={item.href} href={item.href} aria-current={isRouteActive(pathname,item.href)?"page":undefined}><AstralIcon name={item.icon}/><span>{item.short}</span></Link>)}</nav>
  <QuickNavigation/>
  {menu?<div className={styles.scrim} onClick={()=>setMenu(false)}><aside ref={menuRef} className={styles.drawer} role="dialog" aria-modal="true" aria-label="Explore Ancient Pulls" tabIndex={-1} onClick={e=>e.stopPropagation()}>
   <div className={styles.drawerHead}><span>Explore</span><button onClick={()=>setMenu(false)} aria-label="Close menu"><AstralIcon name="close"/></button></div>
   <Link href="/profile" className={styles.identity}><span className={styles.avatar}>{avatarUrl?/* eslint-disable-next-line @next/next/no-img-element */<img src={avatarUrl} alt=""/>:displayName.slice(0,1)}</span><span><strong>{displayName}</strong><small>@{username}</small></span><AstralIcon name="arrow"/></Link>
   <nav className={styles.drawerLinks} aria-label="Explore">{secondary.map(item=><Link key={item.href} href={item.href} aria-current={isRouteActive(pathname,item.href)?"page":undefined}><AstralIcon name={item.icon}/><span><strong>{item.label}{item.href==="/achievements"&&reward?<i className={styles.rewardDot}/>:null}</strong><small>{item.detail}</small></span><AstralIcon name="arrow"/></Link>)}</nav>
   <div className={styles.drawerBottom}><span>Appearance & sound</span>{ready?<Preferences/>:null}</div>
   <button onClick={()=>void signOut()} disabled={signingOut} className={styles.signOut}>{signingOut?"Signing out…":"Sign out"}</button>
   <small className={styles.version}>Ancient Pulls · Astral 71</small>
  </aside></div>:null}
 </>;
}
