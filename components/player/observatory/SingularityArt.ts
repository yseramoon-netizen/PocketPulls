/** A stylised gravitational descent. Geometry is bounded and each loop fades at its seam. */
const TAU=Math.PI*2;
const frac=(n:number)=>n-Math.floor(n);
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const particles=Array.from({length:240},(_,i)=>({phase:frac(i*.61803398875),angle:frac(i*.754877666)*TAU,spread:.62+frac(i*.321)*.64,weight:.3+frac(i*.73)*.7}));

export function paintSingularity(c:CanvasRenderingContext2D,width:number,height:number,time:number,yaw:number,pitch:number,low=false,depth=1,passage=0){
  const u=Math.min(width,height),travel=Math.max(0,depth-.54),flow=time*.00012+travel*.5;
  const cx=width*(.5+Math.sin(yaw)*.025),cy=height*(.5+Math.sin(pitch)*.025);
  const intensity=1-Math.exp(-travel*.55),turn=Math.sin(yaw)*.16-pitch*.09;
  c.save();c.globalAlpha=1;c.globalCompositeOperation='source-over';
  c.fillStyle='#02040a';c.fillRect(0,0,width,height);
  const halo=c.createRadialGradient(cx,cy,u*.02,cx,cy,u*.82);
  halo.addColorStop(0,'#918478');halo.addColorStop(.048,'#353134');halo.addColorStop(.16,'#101620');halo.addColorStop(.5,'#080e18');halo.addColorStop(1,'#02040a');
  c.fillStyle=halo;c.fillRect(0,0,width,height);
  c.translate(cx,cy);c.rotate(turn);c.globalCompositeOperation='lighter';
  const project=(age:number,angle:number,spread=1)=>{
    const radius=(.024+Math.pow(age,2.8)*1.6)*u*spread;
    const twist=angle+1.05*Math.log(.075+age)+Math.sin(age*3.1+flow*.22)*.075;
    const stretch=1+Math.sin(twist*2+.8)*.08;
    return {x:Math.cos(twist)*radius*stretch,y:Math.sin(twist)*radius*(.84+Math.cos(age*2.6)*.16)};
  };
  // Light surfaces expand past the camera. Zoom, as well as time, drives their movement.
  for(let i=0;i<(low?12:26);i++){
    const age=frac(i/(low?12:26)+flow*.11),alpha=Math.sin(age*Math.PI)**2;
    c.beginPath();
    for(let j=0;j<=96;j++){
      const a=frac(i*.618)*TAU+flow*.12+j/96*(.38+frac(i*.37)*1.1),p=project(age,a,1+Math.sin(a*3+flow*.38+i)*.055);
      if(j===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);
    }
    c.strokeStyle=i%5?'#8aaac3':'#ecd5b1';c.globalAlpha=alpha*(i%5?.11:.24);
    c.lineWidth=.35+age*.8;c.stroke();
  }
  const filaments=low?24:48;
  const stream=c.createRadialGradient(0,0,u*.022,0,0,u*.94);
  stream.addColorStop(0,'#fce4c4');stream.addColorStop(.15,'#c8c3bbac');stream.addColorStop(.5,'#8aafcb65');stream.addColorStop(1,'#91afce00');
  for(let i=0;i<filaments;i++){
    c.beginPath();
    for(let j=0;j<=64;j++){
      const age=j/64,arm=i%3,offset=Math.floor(i/3)/(filaments/3),p=project(age,arm*TAU/3+offset*.31+Math.sin(flow*.17+arm)*.10);
      if(j===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);
    }
    c.strokeStyle=stream;c.globalAlpha=i%4?.12:.21;c.lineWidth=i%4?.5:.85;c.stroke();
  }
  for(let i=0;i<particles.length;i++){
    if(low&&i%2)continue;
    const star=particles[i],age=frac(star.phase+flow*(.14+star.weight*.03));
    const angle=star.angle+Math.sin(flow*.14)*.05;
    const p=project(age,angle,star.spread),tail=project(Math.max(0,age-(.012+intensity*.035)*age),angle,star.spread);
    c.globalAlpha=smooth(0,.14,age)*(1-smooth(.84,1,age))*star.weight*.88;
    c.strokeStyle=i%7?'#d5e5f0':'#f6d8ab';c.lineWidth=.3+age*star.weight*1.5;
    c.beginPath();c.moveTo(tail.x,tail.y);c.lineTo(p.x,p.y);c.stroke();
  }
  const radius=u*(.024+.009*Math.exp(-travel*.3));
  for(let i=8;i>=0;i--){
    c.strokeStyle=i%3?'#f5ddb9':'#c1d7e8';c.globalAlpha=.42*Math.exp(-i*.42);
    c.lineWidth=.65;c.beginPath();c.ellipse(0,0,radius*(1+i*.065),radius*(.82+i*.055),-.2,0,TAU);c.stroke();
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#010205';
  c.beginPath();c.ellipse(0,0,radius*.96,radius*.78,-.2,0,TAU);c.fill();
  c.restore();
  // Only the verified owner receives an aperture into the live constellation.
  if(passage>0){
    const radius=(.028+Math.pow(passage,2.1)*Math.hypot(width,height)/u*.8)*u;
    c.save();c.globalCompositeOperation='destination-out';
    const aperture=c.createRadialGradient(cx,cy,radius*.70,cx,cy,radius);
    aperture.addColorStop(0,'#000');aperture.addColorStop(1,'#0000');
    c.fillStyle=aperture;c.fillRect(0,0,width,height);c.restore();
  }
}
