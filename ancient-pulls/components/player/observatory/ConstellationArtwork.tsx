import { ZODIAC_SHAPES, type ZodiacSign } from "@/lib/player/zodiac-constellations";
/** Coordinate-derived constellation art used by the overview and sign-in. */
export default function ConstellationArtwork({sign,className=""}:{sign?:string|null;className?:string}){
 const shape=sign&&sign in ZODIAC_SHAPES?ZODIAC_SHAPES[sign as ZodiacSign]:null;
 const points=shape?.points??[{x:22,y:66},{x:34,y:38},{x:54,y:48},{x:69,y:23},{x:80,y:44},{x:63,y:72}];
 const segments=shape?.segments??[[0,1],[1,2],[2,3],[3,4],[4,5],[5,2]];
 return <svg viewBox="0 0 100 100" fill="none" className={`ap-constellation-art ${className}`} aria-hidden="true">
  <circle cx="50" cy="50" r="43" stroke="#bfcbd3" strokeOpacity=".09" strokeWidth=".15"/>
  <ellipse cx="50" cy="50" rx="43" ry="21" stroke="#bfcbd3" strokeOpacity=".08" strokeWidth=".15" transform="rotate(-25 50 50)"/>
  {Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,r=i%4?42:41;return <path key={i} d={`M ${50+Math.cos(a)*r} ${50+Math.sin(a)*r} L ${50+Math.cos(a)*43} ${50+Math.sin(a)*43}`} stroke="#ddc99f" strokeOpacity={i%4?.15:.38} strokeWidth=".15"/>})}
  {segments.map(([a,b],i)=><path key={i} d={`M${points[a].x} ${points[a].y}L${points[b].x} ${points[b].y}`} stroke="#d7c397" strokeWidth=".22" strokeOpacity=".66"/>)}
  {points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="2.3" fill="#d5bd87" opacity=".08"/><circle cx={p.x} cy={p.y} r="1.3" fill="#c3deee" opacity=".12"/><path d={`M${p.x-1} ${p.y}h2m-1-1v2`} stroke="#f5ebd6" strokeWidth=".22"/><circle cx={p.x} cy={p.y} r=".34" fill="#f4ebd8"/></g>)}
 </svg>;
}
