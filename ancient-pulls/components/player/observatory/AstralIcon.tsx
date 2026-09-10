import type { SVGProps } from "react";
export type AstralIconName = "star" | "home" | "constellation" | "universe" | "binder" | "friends" | "catalogue" | "menu" | "close" | "arrow" | "search" | "info" | "reset";
const paths: Record<AstralIconName, string> = {
  star: "M12 2 14.6 9.4 22 12 14.6 14.6 12 22 9.4 14.6 2 12 9.4 9.4Z",
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  constellation: "m4 16 5-11 6 8 5-7M4 16l12 6-1-9M3 15h2v2H3ZM8 4h2v2H8Zm6 8h2v2h-2Zm5-7h2v2h-2Zm-4 16h2v2h-2Z",
  universe: "M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM3 16c-2-3 1-8 6-11s11-3 12 0-1 8-6 11S5 19 3 16Z",
  binder: "M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18m5-13h3m-3 4h3",
  friends: "M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21v-3a6 6 0 0 1 12 0v3M18 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2",
  catalogue: "M3 3h7v8H3Zm11 0h7v8h-7ZM3 15h7v6H3Zm11 0h7v6h-7Z",
  menu: "M4 7h16M4 12h16M4 17h16", close: "m6 6 12 12M6 18 18 6",
  arrow: "M4 12h16m-6-6 6 6-6 6", search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6m0-10v1",
  reset: "M3 10a9 9 0 1 1 1 7M3 3v7h7",
};
export default function AstralIcon({ name = "star", ...props }: SVGProps<SVGSVGElement> & { name?: AstralIconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
