/** Shared, deterministic art direction for the observatory and Astra's ceremony.
 * Paint the expensive sky once at resize; stars use small, reusable light textures. */
const TAU = Math.PI * 2;
const lights = new Map<string, HTMLCanvasElement>();

export function skyRandom(seed = 89125) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function paintObservatorySky(c: CanvasRenderingContext2D, w: number, h: number) {
  const random = skyRandom();
  c.save();
  c.fillStyle = '#030812';
  c.fillRect(0, 0, w, h);
  const haze = (x: number, y: number, r: number, colour: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(x-r, y-r, r*2, r*2);
  };
  haze(w*.56, h*.48, Math.max(w,h)*.62, '#153b5158');
  haze(w*.75, h*.6, w*.43, '#344b7533');
  haze(w*.34, h*.73, w*.32, '#63507519');
  // A curved, broken dust lane: tiny light clouds, not a repeating star wallpaper.
  for (let i=0; i<95; i++) {
    const t=random(), x=w*(t*1.3-.15), bend=.77-t*.5+Math.sin(t*5)*.08;
    const y=h*(bend+(random()-.5)*.11), r=(.015+random()*.05)*w;
    haze(x,y,r,i%4 ? '#789fb209' : '#dbbd8a09');
  }
  for (let i=0; i<2600; i++) {
    const t=random(), band=(random()+random()+random()-1.5)*.065;
    const x=w*(t*1.3-.15), y=h*(.77-t*.5+Math.sin(t*5)*.08+band);
    c.fillStyle=i%5 ? '#8ab6d5' : '#ead4a5';
    c.globalAlpha=.035+random()*.16; const r=.35+random()*.7;
    c.fillRect(x,y,r,r);
  }
  for (let i=0; i<Math.min(1000,Math.round(w*h/1700)); i++) {
    const x=random()*w, y=random()*h, r=.3+Math.pow(random(),7)*1.5;
    c.globalAlpha=.16+random()*.59; c.fillStyle=i%8 ? '#b6d2e6' : '#f5dab1';
    c.beginPath(); c.arc(x,y,r,0,TAU); c.fill();
  }
  c.restore();
}

/** Bounded by the rarity palette; callers can supply any valid CSS colour. */
export function starlightTexture(colour: string): HTMLCanvasElement {
  let texture=lights.get(colour);
  if (texture) return texture;
  texture=document.createElement('canvas'); texture.width=texture.height=96;
  const c=texture.getContext('2d')!;
  const g=c.createRadialGradient(48,48,0,48,48,48);
  g.addColorStop(0,'#fff9ea'); g.addColorStop(.06,colour);
  g.addColorStop(.22,colour); g.addColorStop(1,'transparent');
  c.fillStyle=g; c.fillRect(0,0,96,96);
  if (lights.size>=32) lights.delete(lights.keys().next().value!);
  lights.set(colour,texture); return texture;
}

export function paintStarlight(c: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string, active=false, glow=true) {
  c.save(); c.translate(x,y); const alpha=c.globalAlpha;
  if (glow) {
    c.globalCompositeOperation='lighter'; c.globalAlpha*=active?.42:.25;
    const r=radius*(active?8:5); c.drawImage(starlightTexture(colour),-r,-r,r*2,r*2);
    c.globalAlpha=alpha;
  }
  c.fillStyle=colour; c.beginPath();
  for (let i=0;i<8;i++) {
    const a=i*Math.PI/4, r=radius*(i%2?.28:1.8);
    if(i)c.lineTo(Math.cos(a)*r,Math.sin(a)*r); else c.moveTo(r,0);
  }
  c.closePath(); c.fill(); c.fillStyle='#fff9e9';
  c.beginPath(); c.arc(0,0,Math.max(.8,radius*.34),0,TAU); c.fill();
  if(active) {
    c.globalAlpha=.7;c.strokeStyle=colour;c.lineWidth=.8;
    for(let i=0;i<4;i++){c.beginPath();c.arc(0,0,radius*3.7,i*Math.PI/2+.2,i*Math.PI/2+.9);c.stroke();}
  }
  c.restore();
}

/** Lensed back arc, photon ring and foreground disk are distinct depth layers. */
export function paintSingularity(c: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number, active=false) {
  c.save(); c.translate(x,y); c.rotate(-.14);
  const halo=c.createRadialGradient(0,0,radius*.42,0,0,radius*2.6);
  halo.addColorStop(0,'#e6c89100');halo.addColorStop(.28,active?'#b8d7ff28':'#83afcf19');halo.addColorStop(.58,'#396ba211');halo.addColorStop(1,'transparent');
  c.fillStyle=halo;c.fillRect(-radius*2.6,-radius*2.6,radius*5.2,radius*5.2);
  c.globalCompositeOperation='lighter';
  // A bright, asymmetric far-side arc bends over the event horizon.
  for(let band=0;band<14;band++) {
    const r=radius*(.79+band*.014);
    c.strokeStyle=band<4?'#fbebc8':'#91bbd6'; c.globalAlpha=(1-band/15)*.14;
    c.lineWidth=radius*.035; c.beginPath();
    c.ellipse(0,-radius*.014,r,r*.98,0,Math.PI*.98,TAU+.035);c.stroke();
  }
  for(let band=0;band<22;band++){
    const r=radius*(1.15+band*.047);c.lineWidth=radius*.025;c.strokeStyle=band%3?'#dfc598':'#a7c9df';c.globalAlpha=(1-band/24)*.085;
    c.beginPath();c.ellipse(0,0,r,r*.18,0,Math.PI,TAU);c.stroke();
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  c.fillStyle='#010309' ;c.beginPath();c.arc(0,0,radius*.77,0,TAU);c.fill();
  // Photon ring, warm on the approaching side and blue on the receding side.
  const edge=c.createLinearGradient(-radius,0,radius,0);
  edge.addColorStop(0,'#91c6ef66');edge.addColorStop(.55,'#fff4d5');edge.addColorStop(1,'#efbc7544');
  c.strokeStyle=edge;c.lineWidth=Math.max(1,radius*.02);c.beginPath();c.arc(0,0,radius*.8,0,TAU);c.stroke();
  c.globalCompositeOperation='lighter';
  for(let band=0;band<28;band++) {
    const r=radius*(.82+band*.05), flatten=.17;
    const g=c.createLinearGradient(-r,0,r,0);
    g.addColorStop(0,'#669cb000');g.addColorStop(.3,'#aacde28c');g.addColorStop(.56,'#fff2c9');g.addColorStop(.77,'#d6a46e8c');g.addColorStop(1,'#c1956800');
    c.strokeStyle=g;c.globalAlpha=(1-band/31)*.38;c.lineWidth=radius*.022;
    c.beginPath();c.ellipse(0,0,r,r*flatten,0,0,Math.PI);c.stroke();
    // The distant half remains outside the dark horizon.

  }
  for(let i=0;i<110;i++) {
    const a=i*2.399+time*.00019*(1+(i%5)*.07), r=radius*(.85+(i%19)*.057);
    if(Math.sin(a)<0)continue;
    c.globalAlpha=.12+(i%5)*.07;c.strokeStyle=i%3?'#e5cb9f':'#b3d9f6';c.lineWidth=.8;
    c.beginPath();c.ellipse(0,0,r,r*.17,0,a,a+.03);c.stroke();
  }
  c.restore();
}
