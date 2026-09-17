/** A stylised interior, revealed only after the owner crosses the horizon. */
const TAU=Math.PI*2;
const frac=(value:number)=>value-Math.floor(value);
const particles=Array.from({length:96},(_,index)=>({
  phase:frac(index*.61803398875),angle:frac(index*.754877666)*TAU,
  speed:.025+frac(index*.137)*.021,weight:.4+frac(index*.73)*.6,
}));

export function paintSingularity(
  c:CanvasRenderingContext2D,width:number,height:number,time:number,
  yaw:number,pitch:number,low=false,
){
  const measure=Math.min(width,height),cx=width*.5,cy=height*.51,t=time/1000;
  c.save();c.globalAlpha=1;c.fillStyle='#020307';c.fillRect(0,0,width,height);
  const halo=c.createRadialGradient(cx,cy,0,cx,cy,measure*.66);
  halo.addColorStop(0,'#352d29');halo.addColorStop(.13,'#11121b');halo.addColorStop(.45,'#090c15');halo.addColorStop(1,'#020307');
  c.fillStyle=halo;c.fillRect(0,0,width,height);
  c.translate(cx,cy);c.rotate(-.23+Math.sin(yaw)*.16);
  const flatten=.53+Math.sin(pitch)*.11;
  const point=(r:number,angle:number)=>({x:Math.cos(angle)*r*measure*.72,y:Math.sin(angle)*r*measure*.72*flatten});

  c.globalCompositeOperation='lighter';
  const filament=c.createRadialGradient(0,0,measure*.02,0,0,measure*.8);
  filament.addColorStop(0,'#ffe7c7');filament.addColorStop(.12,'#cdbda9a6');filament.addColorStop(.48,'#8eaab56b');filament.addColorStop(1,'#829aaa00');
  // Fine, continuous light paths bend progressively toward the vanishing point.
  const strands=low?24:48;
  for(let strand=0;strand<strands;strand++){
    const arm=strand%3,offset=Math.floor(strand/3)/Math.ceil(strands/3);
    c.beginPath();
    for(let step=0;step<=96;step++){
      const r=.031+step/96*1.12;
      const angle=arm*TAU/3+Math.log(r+.016)*1.08+offset*.27+t*.035/(r+.55);
      const p=point(r,angle);
      if(!step)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);
    }
    c.strokeStyle=filament;c.globalAlpha=.11+(1-offset)*.045;
    c.lineWidth=measure*(strand%4?.00065:.0011);c.stroke();
  }
  // Tapered particles travel inward; fade-in/out hides every loop seam.
  for(const [index,particle] of particles.entries()){
    if(low&&index%2)continue;
    const age=frac(particle.phase+t*particle.speed),r=.027+Math.pow(1-age,1.9)*1.14;
    const angle=particle.angle+Math.log(r+.02)*1.18+t*.023;
    const p=point(r,angle),q=point(r+.005+age*.008,angle+.014+age*.035);
    c.globalAlpha=Math.sin(age*Math.PI)**2*particle.weight*.76;
    c.strokeStyle=index%5?'#ead6b7':'#bbd8ed';c.lineWidth=.35+particle.weight*.7;
    c.beginPath();c.moveTo(q.x,q.y);c.lineTo(p.x,p.y);c.stroke();
  }
  // The innermost images converge into one calm, sharply defined point.
  const radius=measure*.036;
  c.save();c.scale(1,flatten);
  const light=c.createRadialGradient(0,0,radius*.3,0,0,radius*3.9);
  light.addColorStop(0,'#ffe3b84d');light.addColorStop(.32,'#dbab6525');light.addColorStop(1,'#d8984e00');
  c.globalAlpha=1;c.fillStyle=light;c.beginPath();c.arc(0,0,radius*3.9,0,TAU);c.fill();c.restore();
  for(let i=0;i<9;i++){
    c.strokeStyle=i<3?'#f8e7cf':'#d3b18a';c.globalAlpha=.62*Math.exp(-i*.5);
    c.lineWidth=Math.max(.55,measure*.001);c.beginPath();c.ellipse(0,0,radius*(1+i*.065),radius*(1+i*.065)*flatten,0,0,TAU);c.stroke();
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#010205';c.beginPath();c.ellipse(0,0,radius*.91,radius*.91*flatten,0,0,TAU);c.fill();
  c.restore();
}
