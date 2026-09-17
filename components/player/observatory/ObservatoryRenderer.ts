import { ZODIAC_SHAPES, type ZodiacSign } from '@/lib/player/zodiac-constellations';
import { type ConstellationStar, type SpatialPoint, VOLUME_STARS, getZodiacSpatialPoint } from './ConstellationModel';
import { paintObservatorySky, paintStarlight } from './SkyArt';
import { buildGalaxyNodes, createProjector, drawGalaxyCached, drawOrbitingBlackHole, paintUniverseFrame, projectGalaxyDisk, resolveGalaxyPosition, hashString, clamp, lerp, type GalaxyNode, type GalaxyHit, type LeaderboardPlayer, type Camera } from './UniverseRenderer';
import { disposeBlackHoleRenderer } from './BlackHoleRenderer';
import { paintSingularity } from './SingularityArt';

export type ObservatoryView = { distance:number; singularity:number; yaw:number; pitch:number; focusX:number; focusY:number; focusZ:number; starX:number; starY:number; starZ:number };
export const HOME_VIEW:ObservatoryView={distance:0,singularity:0,yaw:0,pitch:0,focusX:0,focusY:0,focusZ:0,starX:0,starY:0,starZ:0};
export const clampDistance=(value:number)=>clamp(Number.isFinite(value)?value:0,-.62,1.34);
export const smooth=(a:number,b:number,value:number)=>{const t=clamp((value-a)/(b-a),0,1);return t*t*(3-2*t);};
export const observatoryLevel=(distance:number,singularity=0)=>singularity>.82?'singularity':singularity>.001?'black-hole':distance<.24?'stars':distance<.78?'galaxy':'universe';
export type ObservatoryLevel=ReturnType<typeof observatoryLevel>;
export const BLACK_HOLE_VISITOR_LIMIT=.46;
export const ownsBlackHole=(scene:ObservatoryScene|null)=>!!scene?.entryConfirmed&&!!scene.leader&&scene.leader.rank===1&&scene.owner.rank===1&&scene.leader.userId===scene.owner.userId&&scene.owner.isCurrentUser;
export function clampSingularityDepth(value:number,scene:ObservatoryScene|null){
  if(!scene?.leader)return 0;
  return clamp(Number.isFinite(value)?value:0,0,ownsBlackHole(scene)?1:BLACK_HOLE_VISITOR_LIMIT);
}
export function blackHoleApproach(width:number,height:number,depth:number,camera:Camera){
  const measure=Math.min(width,height),compact=width<768;
  const centre=createProjector(camera,width,height)({x:0,y:0,z:0});
  const baseRadius=clamp(measure*.105*centre.scale,compact?24:56,compact?76:126);
  const coverage=Math.hypot(width,height)*.71;
  const scale=Math.exp(Math.log(Math.max(1,coverage/baseRadius))*Math.min(depth,.72)/.68);
  const focus=1-smooth(0,.13,depth);
  return {camera:{...camera,zoom:camera.zoom*scale,focusX:camera.focusX*focus,focusY:camera.focusY*focus,focusZ:camera.focusZ*focus},radius:baseRadius*scale};
}
export function dampView(current:ObservatoryView,target:ObservatoryView,delta:number,reduced:boolean):boolean {
  const amount=reduced?1:1-Math.exp(-Math.min(64,Math.max(0,delta))/155);
  let unsettled=false;
  for(const key of Object.keys(current) as (keyof ObservatoryView)[]){
    const difference=target[key]-current[key];
    if(Math.abs(difference)>.00008){current[key]+=difference*amount;unsettled=true;}else current[key]=target[key];
  }
  return unsettled;
}

export type ObservatoryScene={stars:ConstellationStar[];zodiac:ZodiacSign|null;players:LeaderboardPlayer[];nodes:GalaxyNode[];owner:LeaderboardPlayer;ownerNode:GalaxyNode|null;leader:LeaderboardPlayer|null;entryConfirmed:boolean};
export function buildObservatoryScene(stars:ConstellationStar[],zodiac:ZodiacSign|null,players:LeaderboardPlayer[],user:{id:string;name:string}):ObservatoryScene {
  const ranked=players.map(player=>({...player,isCurrentUser:player.userId===user.id}));
  const owner=ranked.find(player=>player.isCurrentUser)??{rank:0,userId:user.id,username:'',displayName:user.name,avatarUrl:null,totalCards:0,uniqueCards:0,collectionValue:0,lifetimeWishes:0,score:0,isCurrentUser:true,cosmicIssueNumber:null};
  const nodes=buildGalaxyNodes(ranked);
  let ownerNode=nodes.find(node=>node.player.userId===user.id)??null;
  if(owner.rank!==1&&!ownerNode){
    const personal=buildGalaxyNodes([{...owner,rank:100,totalCards:stars.length}])[0];
    ownerNode={...personal,player:owner,orbitRadius:1.49,orbitAngle:(hashString(user.id)%6283)/1000,orbitEccentricity:1.03,orbitFlatten:.68,size:.032,orbitSpeed:Math.PI*2/250};
    nodes.push(ownerNode);
  }
  return {stars,zodiac,players:ranked,nodes,owner,ownerNode,leader:ranked.find(player=>player.rank===1)??null,entryConfirmed:true};
}

export function observatoryProjection(scene:ObservatoryScene,view:ObservatoryView,width:number,height:number,time:number,insets={top:0,bottom:0}){
  const measure=Math.min(width,height),fit=lerp(.60,1,clamp((width/height-.65)/.75,0,1));
  const point=scene.ownerNode?resolveGalaxyPosition(scene.ownerNode,time,false):{x:0,y:0,z:0};
  const size=scene.ownerNode?.size??.105,initialRadius=measure*.24;
  const startZoom=.24/(size*fit),distance=clampDistance(view.distance),pullback=smooth(0,1,distance);
  const zoom=distance<0?startZoom*Math.pow(2,-distance*1.75):distance>1?Math.exp(-(distance-1)*1.15):Math.exp(lerp(Math.log(startZoom),0,pullback));
  const release=smooth(.42,1,distance);
  const camera:Camera={yaw:view.yaw,pitch:view.pitch,zoom,focusX:lerp(-point.x,-view.focusX,release),focusY:lerp(-point.y,-view.focusY,release),focusZ:lerp(-point.z,-view.focusZ,release)};
  const project=createProjector(camera,width,height),anchor=project(point),unbounded=size*measure*anchor.scale;
  anchor.y+=(insets.top-insets.bottom)*.5*(1-release);
  const farRadius=scene.ownerNode?clamp(unbounded,width<768?5.2:5.8,width<768?40:70):clamp(unbounded,width<768?24:56,width<768?76:126);
  const radius=lerp(unbounded,farRadius,smooth(.70,1,distance));
  const axes=scene.ownerNode?projectGalaxyDisk(scene.ownerNode,time,project,measure):[{x:1,y:0},{x:0,y:1}];
  const align=smooth(.12,.77,distance);
  const basis=[{x:lerp(1,axes[0].x,align),y:lerp(0,axes[0].y,align)},{x:lerp(0,axes[1].x,align),y:lerp(1,axes[1].y,align)}];
  const span=Math.min(width*.90,Math.max(height*.35,height-insets.top-insets.bottom)*.95)*radius/initialRadius;
  const sinY=Math.sin(view.yaw),cosY=Math.cos(view.yaw),sinX=Math.sin(view.pitch),cosX=Math.cos(view.pitch);
  const starPoint=(star:SpatialPoint,identity?:string)=>{
    const x=(star.x-50-view.starX)/100,y=(star.y-50-view.starY)/100,z=(star.z-view.starZ)/100;
    const rx=x*cosY+z*sinY,rz=-x*sinY+z*cosY,ry=y*cosX-rz*sinX,depth=y*sinX+rz*cosX;
    const perspective=2.8/Math.max(1.5,2.8-depth);
    const local={x:anchor.x+(rx*basis[0].x+ry*basis[1].x)*span*perspective,y:anchor.y+(rx*basis[0].y+ry*basis[1].y)*span*perspective};
    if(identity&&scene.ownerNode){
      const particle=scene.ownerNode.particles[hashString(identity)%scene.ownerNode.particles.length];
      const x=Math.cos(particle.angle)*particle.radius*radius,y=Math.sin(particle.angle)*particle.radius*radius;
      const galaxy={x:anchor.x+x*axes[0].x+y*axes[1].x,y:anchor.y+x*axes[0].y+y*axes[1].y};
      const gather=smooth(.16,.72,distance);local.x=lerp(local.x,galaxy.x,gather);local.y=lerp(local.y,galaxy.y,gather);
    }
    return {...local,depth,scale:perspective*radius/initialRadius};
  };
  return {camera,project,anchor,radius,initialRadius,starPoint,basis,starOpacity:1-smooth(.52,.90,distance),universeOpacity:smooth(.44,.96,distance),galaxyOpacity:smooth(.08,.43,distance)*(1-smooth(.88,1,distance))};
}

export type StarHit={star:ConstellationStar;x:number;y:number;radius:number;depth:number};
export type ObservatoryFrame={stars:StarHit[];galaxies:GalaxyHit[];owner:{x:number;y:number;radius:number};pending:boolean};
export class ObservatoryRenderer {
  private sky=document.createElement('canvas');
  private universe=document.createElement('canvas');
  private skyContext=this.sky.getContext('2d')!;
  private universeContext=this.universe.getContext('2d')!;
  private sprites=new Map<string,HTMLCanvasElement>();
  private width=0;
  private height=0;
  private density=0;
  constructor(private context:CanvasRenderingContext2D){}
  invalidate(){this.sprites.clear();}
  dispose(){disposeBlackHoleRenderer(this.universeContext);if(this.local)disposeBlackHoleRenderer(this.local.getContext('2d')!);this.sprites.clear();this.sky.width=this.universe.width=1;if(this.local)this.local.width=1;}
  render(width:number,height:number,density:number,view:ObservatoryView,time:number,scene:ObservatoryScene,options:{reduced:boolean;low:boolean;selectedStar:string|null;selectedGalaxy:string|null;arriving:Set<string>;insets?:{top:number;bottom:number}}):ObservatoryFrame {
    const c=this.context;
    if(width!==this.width||height!==this.height||density!==this.density){
      this.width=width;this.height=height;this.density=density;
      for(const canvas of [this.sky,this.universe,c.canvas]){canvas.width=Math.max(1,Math.round(width*density));canvas.height=Math.max(1,Math.round(height*density));}
      this.skyContext.setTransform(density,0,0,density,0,0);paintObservatorySky(this.skyContext,width,height);
    }
    c.setTransform(density,0,0,density,0,0);c.globalAlpha=1;c.drawImage(this.sky,0,0,width,height);
    const p=observatoryProjection(scene,view,width,height,time,options.insets),compact=width<768;
    // Clamp at the renderer as well as the controls, including after a ranking refresh.
    const entry=clampSingularityDepth(view.singularity,scene),interior=smooth(.56,.82,entry);
    const approach=blackHoleApproach(width,height,entry,p.camera);
    let galaxyHits:GalaxyHit[]=[],pending=false;
    if(view.distance>.16&&interior<1){
      const uc=this.universeContext;uc.setTransform(density,0,0,density,0,0);
      const frame=paintUniverseFrame(uc,width,height,approach.camera,time,scene.nodes,scene.leader,options.selectedGalaxy,null,options.reduced,this.sprites,compact,entry>0?approach.radius:undefined);
      pending=frame.pendingSprites>0;galaxyHits=frame.hits;
      c.globalAlpha=p.universeOpacity;c.drawImage(this.universe,0,0,width,height);c.globalAlpha=1;
    }
    if(p.galaxyOpacity>.001&&entry===0){
      c.save();c.globalAlpha=p.galaxyOpacity;
      // Composite the near galaxy on its own layer because its painter also controls alpha.
      // Reuse the detailed local galaxy sprite; the viewport itself stays fixed in size.
      if(scene.ownerNode){
        const neutral={...scene.ownerNode,player:{...scene.owner,rank:100,isCurrentUser:false}};
        const scratch=this.localLayer(width,height,density);
        drawGalaxyCached(scratch,neutral,p.anchor,p.radius,time,false,false,options.reduced,this.sprites,compact,p.basis);
        c.drawImage(this.local!,0,0,width,height);
      }else{
        const scratch=this.localLayer(width,height,density);
        drawOrbitingBlackHole(scratch,p.anchor,p.radius,time,false,p.project,Math.min(width,height),p.camera);
        c.drawImage(this.local!,0,0,width,height);
      }
      c.restore();
    }
    const hits:StarHit[]=[];
    if(p.starOpacity>.001&&entry===0){
      const ambient=options.low?40:compact?72:VOLUME_STARS.length;
      for(let i=0;i<ambient;i++){
        const star=VOLUME_STARS[i],point=p.starPoint(star);
        const pulse=options.reduced?1:.85+.15*Math.sin(time*.0008+i*1.3);
        c.globalAlpha=p.starOpacity*star.brightness*.42*pulse;
        c.fillStyle=star.colour;c.beginPath();c.arc(point.x,point.y,Math.max(.3,star.size*point.scale*.45),0,Math.PI*2);c.fill();
      }
      if(scene.zodiac){
        const shape=ZODIAC_SHAPES[scene.zodiac],points=shape.points.map((_,i)=>p.starPoint(getZodiacSpatialPoint(scene.zodiac!,i)));
        const complete=scene.stars.filter(star=>star.zodiacAnchor).length>=shape.points.length;
        const lineOpacity=1-smooth(.08,.35,view.distance);
        c.strokeStyle=complete?'#d0c7ab':'#9db9ce';c.lineWidth=compact?.65:.85;c.globalAlpha=lineOpacity*(complete?.40:.18);
        c.setLineDash(complete?[]:[3,6]);c.beginPath();
        for(const [a,b] of shape.segments){c.moveTo(points[a].x,points[a].y);c.lineTo(points[b].x,points[b].y);}c.stroke();c.setLineDash([]);
        for(const point of points){c.globalAlpha=lineOpacity*.58;paintStarlight(c,point.x,point.y,Math.max(.8,1.4*point.scale),'#d8d4b9',false,false);}
      }
      for(const star of scene.stars){
        const point=p.starPoint(star,star.id),active=options.selectedStar===star.id;
        const radius=Math.max(.36,Math.min(active?8:5.8,star.size*(star.zodiacAnchor?.29:.18)*point.scale));
        if(p.starOpacity>.25)hits.push({star,...point,radius:Math.max(compact?18:12,radius+7)});
        if(options.arriving.has(star.id))continue;
        if(point.x < -30||point.x>width+30||point.y < -30||point.y>height+30)continue;
        c.globalAlpha=p.starOpacity*(active?1:star.zodiacAnchor?.95:.72)*lerp(1,.24,smooth(.16,.58,view.distance));
        if(radius<1){c.fillStyle=star.colour;c.beginPath();c.arc(point.x,point.y,Math.max(.24,radius*.7),0,Math.PI*2);c.fill();}
        else paintStarlight(c,point.x,point.y,radius,star.colour,active,!options.low&&(active||!!star.zodiacAnchor||star.rank>=5));
      }
    }
    c.globalAlpha=1;
    if(view.distance>.70&&entry<.01){
      const alpha=smooth(.7,.94,view.distance),radius=Math.max(14,p.radius*1.42);
      c.save();c.globalAlpha=alpha*.75;c.strokeStyle='#e2c89b';c.lineWidth=.8;c.setLineDash([2,6]);c.beginPath();c.arc(p.anchor.x,p.anchor.y,radius,0,Math.PI*2);c.stroke();c.restore();
    }
    if(interior>0){
      const layer=this.localLayer(width,height,density);
      paintSingularity(layer,width,height,time,view.yaw,view.pitch,options.low);
      c.save();c.globalAlpha=interior;c.drawImage(this.local!,0,0,width,height);c.restore();
    }
    return {stars:hits,galaxies:view.distance>.65&&entry<.04?galaxyHits:[],owner:{x:p.anchor.x,y:p.anchor.y,radius:p.radius},pending};
  }
  private local:HTMLCanvasElement|null=null;
  private localLayer(width:number,height:number,density:number){
    if(!this.local)this.local=document.createElement('canvas');
    const w=Math.round(width*density),h=Math.round(height*density);
    if(this.local.width!==w||this.local.height!==h){this.local.width=w;this.local.height=h;}
    const context=this.local.getContext('2d')!;context.setTransform(density,0,0,density,0,0);context.clearRect(0,0,width,height);return context;
  }
}
