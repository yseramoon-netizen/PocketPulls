"use client";
import Link from "next/link";
import type {ReactNode} from "react";
import DeepSky from "@/components/player/observatory/DeepSky";
import AstralIcon from "@/components/player/observatory/AstralIcon";
import ConstellationArtwork from "@/components/player/observatory/ConstellationArtwork";
import AsterPortrait from "@/components/player/NebuPortrait";
import styles from "./AuthShell.module.css";
export default function AuthShell({eyebrow,title,description,children,footer}:{eyebrow:string;title:string;description:string;children:ReactNode;footer?:ReactNode;storyTitle?:string;storyDescription?:string}){
 return <main className={styles.page}>
  <aside className={styles.sky}><DeepSky still/><Link href="/sign-in" className={styles.brand}><AstralIcon/><span>ANCIENT PULLS</span></Link><ConstellationArtwork className={styles.art}/><div className={styles.story}><p>COLLECT SOMETHING EXTRAORDINARY</p><h2>A universe<br/>of your own.</h2><span>Discover cards. Build your constellation.</span></div><div className={styles.companion}><AsterPortrait alt="Aster"/><span>A little starlight.<br/>A world of discovery.</span></div></aside>
  <section className={styles.form}><div className={styles.formInner}><Link className={styles.mobileBrand} href="/sign-in"><AstralIcon/> ANCIENT PULLS</Link><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.description}>{description}</p><div className={styles.fields}>{children}</div>{footer?<div className={styles.footer}>{footer}</div>:null}</div></section>
 </main>;
}
