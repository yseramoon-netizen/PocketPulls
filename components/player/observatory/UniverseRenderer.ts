import { toNumber, toWholeNumber } from "@/lib/player/format";
import { paintSingularity, paintObservatorySky } from "./SkyArt";
import { paintBlackHoleShader } from "./BlackHoleRenderer";

export const MAX_VISIBLE_RANKS = 100;
export const MAX_VISIBLE_GALAXIES = MAX_VISIBLE_RANKS - 1;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const TAU = Math.PI * 2;
export const INNER_ORBIT_SPEED = TAU / 90;
export const OUTER_ORBIT_SPEED = TAU / 210;

export type LeaderboardRow = {
  rank_position: number | string | null;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_cards: number | string | null;
  unique_cards: number | string | null;
  collection_value: number | string | null;
  lifetime_wishes: number | string | null;
  score: number | string | null;
  is_current_user: boolean | null;
};

export type LeaderboardPlayer = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalCards: number;
  uniqueCards: number;
  collectionValue: number;
  lifetimeWishes: number;
  score: number;
  isCurrentUser: boolean;
  cosmicIssueNumber: number | null;
};

export type GalaxyParticle = {
  radius: number;
  angle: number;
  size: number;
  brightness: number;
  warmth: number;
};

export type GalaxyNode = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
  z: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitDepth: number;
  orbitDirection: number;
  orbitInclination: number;
  orbitEccentricity: number;
  orbitFlatten: number;
  size: number;
  hue: number;
  tilt: number;
  flatten: number;
  spin: number;
  particles: GalaxyParticle[];
};

export type BackgroundStar = {
  x: number;
  y: number;
  z: number;
  size: number;
  brightness: number;
  phase: number;
  temperature: number;
};

export type BlackHoleDust = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  brightness: number;
  warmth: number;
};

export type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
  focusX: number;
  focusY: number;
  focusZ: number;
};

export type ProjectedPoint = {
  x: number;
  y: number;
  scale: number;
  depth: number;
};

export type GalaxyHit = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
  radius: number;
  depth: number;
};

export type HoverLabel = {
  player: LeaderboardPlayer;
  x: number;
  y: number;
};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseRows(value: unknown): LeaderboardPlayer[] {
  if (!Array.isArray(value)) return [];

  return (value as LeaderboardRow[])
    .map((row) => ({
      rank: toWholeNumber(row.rank_position),
      userId: row.user_id || "",
      username: row.username?.trim() || "trainer",
      displayName: row.display_name?.trim() || "Star Trainer",
      avatarUrl: row.avatar_url?.trim() || null,
      totalCards: toWholeNumber(row.total_cards),
      uniqueCards: toWholeNumber(row.unique_cards),
      collectionValue: toNumber(row.collection_value),
      lifetimeWishes: toWholeNumber(row.lifetime_wishes),
      score: toWholeNumber(row.score),
      isCurrentUser: row.is_current_user === true,
      cosmicIssueNumber: null,
    }))
    .filter((player, index, all) => player.userId && player.rank > 0 && player.rank <= MAX_VISIBLE_RANKS && all.findIndex(other => other.userId === player.userId || other.rank === player.rank) === index)
    .sort((first, second) => first.rank - second.rank)
    .slice(0, MAX_VISIBLE_RANKS);
}

export function buildGalaxyParticles(seed: number, rank: number): GalaxyParticle[] {
  // XOR produces a signed int32. Keep modulo arithmetic non-negative so arms never becomes zero.
  seed = seed >>> 0;
  const random = seededRandom(seed);
  const count = Math.round(clamp(220 - rank * 1.4, 55, 220));
  const arms = 2 + (seed % 3);

  return Array.from({ length: count }, (_, index) => {
    const radius = Math.pow(random(), 0.7);
    const arm = index % arms;
    const scatter = (random() - 0.5) * (0.28 + radius * 0.34);

    return {
      radius,
      angle: (arm / arms) * TAU + radius * (5.8 + (seed % 17) / 18) + scatter,
      size: 0.42 + random() * (radius < 0.25 ? 1.28 : 0.86),
      brightness: 0.28 + random() * 0.72,
      warmth: random(),
    };
  });
}

export function buildGalaxyNodes(players: readonly LeaderboardPlayer[]): GalaxyNode[] {
  const galaxyPlayers = players
    .filter((player) => player.rank >= 2)
    .slice(0, MAX_VISIBLE_GALAXIES);
  const maximumCards = Math.max(1, ...galaxyPlayers.map((player) => player.totalCards));
  let previousSize = 0.108;
  const placed:{x:number;y:number;size:number}[]=[];

  return galaxyPlayers.map((player, index) => {
    const progress = clamp((player.rank - 2) / (MAX_VISIBLE_RANKS - 2), 0, 1);
    const rankPower = Math.pow(1 - progress, 1.6);
    const cardPower = Math.sqrt(player.totalCards / maximumCards);
    const requestedSize = 0.018 + rankPower * 0.035 + cardPower * 0.009;
    const size = clamp(Math.min(previousSize - 0.00038, requestedSize), 0.018, 0.092);
    previousSize = size;

    const seed = hashString(player.userId + ":" + player.rank);
    const random = seededRandom(seed);
    let angle = index * GOLDEN_ANGLE + (random() - 0.5) * 0.09;
    const orbit = 0.74 + Math.pow(progress, 0.72) * 0.64;
    const orbitInclination = (random() - 0.5) * 0.64;
    const orbitEccentricity = 1.02 + random() * 0.12;
    const orbitFlatten = 0.64 + random() * 0.14;
    const positionAt=(a:number)=>{
      const x=Math.cos(a)*orbit*orbitEccentricity,y=Math.sin(a)*orbit*orbitFlatten;
      return {x:x*Math.cos(orbitInclination)-y*Math.sin(orbitInclination),y:x*Math.sin(orbitInclination)+y*Math.cos(orbitInclination)};
    };
    // Distribute the initial view around already placed, larger galaxies. This is
    // computed once, leaving each galaxy free to follow its continuous 3D orbit.
    if(placed.length){
      let best=-Infinity,chosen=angle;
      for(let attempt=0;attempt<48;attempt++){
        const candidate=angle+attempt*GOLDEN_ANGLE,point=positionAt(candidate);
        const clearance=Math.min(...placed.map(other=>Math.hypot(point.x-other.x,(point.y-other.y)*1.25)/(2.05*(size+other.size)+.025)));
        if(clearance>best){best=clearance;chosen=candidate;}
      }
      angle=chosen;
    }
    const orbitX = Math.cos(angle) * orbit * orbitEccentricity;
    const orbitY = Math.sin(angle) * orbit * orbitFlatten;
    placed.push({...positionAt(angle),size});

    return {
      player,
      x: orbitX * Math.cos(orbitInclination) - orbitY * Math.sin(orbitInclination),
      y: orbitX * Math.sin(orbitInclination) + orbitY * Math.cos(orbitInclination),
      z: 0.03 + (random() - 0.5) * 0.32,
      orbitAngle: angle,
      orbitRadius: orbit,
      orbitSpeed: lerp(INNER_ORBIT_SPEED, OUTER_ORBIT_SPEED, Math.pow(progress, 0.72)),
      orbitDepth: 0.045 + progress * 0.055,
      orbitDirection: 1,
      orbitInclination,
      orbitEccentricity,
      orbitFlatten,
      size,
      hue: [38, 202, 212, 222, 35, 195][seed % 6],
      tilt: (random() - 0.5) * 1.2,
      flatten: 0.34 + random() * 0.23,
      spin: (random() > 0.5 ? 1 : -1) * (0.045 + random() * 0.062),
      particles: buildGalaxyParticles(seed ^ 0xa57ea, player.rank),
    };
  });
}

export function resolveGalaxyPosition(
  node: GalaxyNode,
  time: number,
  reducedMotion: boolean,
): { x: number; y: number; z: number } {

  const angle = node.orbitAngle + time * 0.001 * node.orbitSpeed * node.orbitDirection;
  const orbitX = Math.cos(angle) * node.orbitRadius * node.orbitEccentricity;
  const orbitY = Math.sin(angle) * node.orbitRadius * node.orbitFlatten;
  const cosInclination = Math.cos(node.orbitInclination);
  const sinInclination = Math.sin(node.orbitInclination);
  return {
    x: orbitX * cosInclination - orbitY * sinInclination,
    y: orbitX * sinInclination + orbitY * cosInclination,
    z: node.z + Math.sin(angle + node.tilt * 0.35) * node.orbitDepth,
  };
}

export const BACKGROUND_STARS: BackgroundStar[] = (() => {
  const random = seededRandom(0x51a7c0de);
  return Array.from({ length: 320 }, () => ({
    x: (random() - 0.5) * 3.2,
    y: (random() - 0.5) * 2.25,
    z: -1.2 + random() * 1.8,
    size: 0.36 + random() * 1.34,
    brightness: 0.18 + random() * 0.66,
    phase: random() * TAU,
    temperature: random(),
  }));
})();

export const BLACK_HOLE_DUST: BlackHoleDust[] = (() => {
  const random = seededRandom(0xb1ac40de);
  return Array.from({ length: 86 }, () => ({
    angle: random() * TAU,
    radius: 1.05 + Math.pow(random(), 0.72) * 1.08,
    speed: 0.00012 + random() * 0.00022,
    size: 0.34 + random() * 1.08,
    brightness: 0.18 + random() * 0.68,
    warmth: random(),
  }));
})();

export function createProjector(
  camera: Camera,
  width: number,
  height: number,
): (point: { x: number; y: number; z: number }) => ProjectedPoint {
  const sinYaw = Math.sin(camera.yaw);
  const cosYaw = Math.cos(camera.yaw);
  const sinPitch = Math.sin(camera.pitch);
  const cosPitch = Math.cos(camera.pitch);
  const measure = Math.min(width, height);

  return (point) => {
    const worldX = point.x + camera.focusX;
    const worldY = point.y + camera.focusY;
    const worldZ = point.z + camera.focusZ;
    const yawX = worldX * cosYaw + worldZ * sinYaw;
    const yawZ = -worldX * sinYaw + worldZ * cosYaw;
    const pitchY = worldY * cosPitch - yawZ * sinPitch;
    const depth = worldY * sinPitch + yawZ * cosPitch;
    const perspective = 2.9 / Math.max(1.45, 2.9 - depth);
    // Fit the full orbital array in portrait without changing saved zoom levels.
    const viewportFit = lerp(.60, 1, clamp((width / height - .65) / .75, 0, 1));
    const scale = perspective * camera.zoom * viewportFit;

    return {
      x: width / 2 + yawX * measure * 0.47 * scale,
      y: height / 2 + pitchY * measure * 0.47 * scale,
      scale,
      depth,
    };
  };
}

export function hsla(hue: number, saturation: number, lightness: number, alpha: number): string {
  return "hsla(" + hue + "," + saturation + "%," + lightness + "%," + alpha + ")";
}

const backgrounds = new WeakMap<CanvasRenderingContext2D, {width:number;height:number;canvas:HTMLCanvasElement}>();
export function drawBackground(context:CanvasRenderingContext2D,width:number,height:number,camera:Camera,time:number,reducedMotion:boolean) {
  let cached=backgrounds.get(context);
  if(!cached||cached.width!==width||cached.height!==height){
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
    const c=canvas.getContext('2d');if(c)paintObservatorySky(c,width,height);
    cached={width,height,canvas};backgrounds.set(context,cached);
  }
  context.drawImage(cached.canvas,0,0,width,height);
  const projectBackground = createProjector({
    ...camera,
    focusX: camera.focusX * 0.08,
    focusY: camera.focusY * 0.08,
    focusZ: 0,
    zoom: 0.82 + camera.zoom * 0.12,
  }, width, height);

  for (const star of BACKGROUND_STARS) {
    const projected = projectBackground(star);
    if (projected.x < -4 || projected.x > width + 4 || projected.y < -4 || projected.y > height + 4) continue;
    const pulse = reducedMotion ? 1 : 0.78 + Math.sin(time * 0.00072 + star.phase) * 0.22;
    const colour = star.temperature > 0.68
      ? "rgba(213,247,255,"
      : star.temperature < 0.22
        ? "rgba(255,244,214,"
        : "rgba(238,235,255,";
    context.fillStyle = colour + clamp(star.brightness * pulse, 0.06, 0.82) + ")";
    context.beginPath();
    context.arc(projected.x, projected.y, Math.max(0.32, star.size * projected.scale), 0, TAU);
    context.fill();
  }
}

export function drawGalaxy(context:CanvasRenderingContext2D,node:GalaxyNode,projected:ProjectedPoint,radius:number,time:number,selected:boolean,hovered:boolean,reducedMotion:boolean){
  const random=seededRandom(hashString(node.player.userId)), arms=2+(hashString(node.player.userId)%2);
  context.save();context.translate(projected.x,projected.y);context.rotate(node.tilt);
  context.scale(1,node.flatten+.08);context.globalCompositeOperation='lighter';
  const glow=context.createRadialGradient(0,0,0,0,0,radius*1.4);
  glow.addColorStop(0,'#eddfc571');glow.addColorStop(.14,hsla(node.hue,38,70,.27));glow.addColorStop(.5,hsla(node.hue,43,50,.05));glow.addColorStop(1,'transparent');
  context.fillStyle=glow;context.fillRect(-radius*1.4,-radius*1.4,radius*2.8,radius*2.8);
  // Resolve fine-grained spiral dust only when building a cached sprite.
  for(let i=0;i<940;i++){
    const t=Math.pow(random(),.75),scatter=(random()+random()-1)*(.13+t*.34),angle=(i%arms)*TAU/arms+t*5.5+scatter;
    const r=t*radius,x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    context.globalAlpha=(.12+random()*.36)*(1-t*.6);
    context.fillStyle=i%9===0?'#f2d6aa':hsla(node.hue+(random()-.5)*18,35,65+random()*23,1);
    const dot=.22+random()*.66;
    context.beginPath();context.arc(x,y,dot,0,TAU);context.fill();
  }
  // Broad arms carry a luminous edge and a narrow dark dust lane.
  for(let arm=0;arm<arms;arm++){
    context.lineWidth=radius*.025;context.strokeStyle=hsla(node.hue,42,76,.12);context.beginPath();
    for(let i=4;i<=64;i++){const t=i/64,a=arm*TAU/arms+t*5.5,x=Math.cos(a)*radius*t,y=Math.sin(a)*radius*t;if(i===4)context.moveTo(x,y);else context.lineTo(x,y);}context.stroke();
  }
  context.globalAlpha=1;
  const core=context.createRadialGradient(0,0,0,0,0,radius*.19);
  core.addColorStop(0,'#fff6db');core.addColorStop(.2,'#f5e5cbbb');core.addColorStop(1,'transparent');
  context.fillStyle=core;context.fillRect(-radius*.2,-radius*.2,radius*.4,radius*.4);
  context.restore();
}

export function drawGalaxyTrails(
  context: CanvasRenderingContext2D,
  nodes: readonly GalaxyNode[],
  project: (point: { x: number; y: number; z: number }) => ProjectedPoint,
  measure: number,
  time: number,
  selectedUserId: string | null,
  hoveredUserId: string | null,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (const node of nodes) {
    const highlighted = node.player.userId === selectedUserId ||
      node.player.userId === hoveredUserId || node.player.isCurrentUser;
    if (!highlighted && node.player.rank > 24) continue;

    const samples = highlighted ? 11 : 7;
    const interval = highlighted ? 430 : 360;
    let previous = project(resolveGalaxyPosition(node, time - samples * interval, false));

    for (let sample = 1; sample <= samples; sample += 1) {
      const current = project(resolveGalaxyPosition(node, time - (samples - sample) * interval, false));
      const strength = sample / samples;
      context.strokeStyle = hsla(
        node.hue + 8,
        92,
        72,
        (highlighted ? 0.15 : 0.055) * strength,
      );
      context.lineWidth = clamp(node.size * measure * 0.045 * current.scale, 0.45, highlighted ? 2.1 : 1.15);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke();
      previous = current;
    }
  }

  context.restore();
}

export function drawOrbitLanes(
  context: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  reducedMotion: boolean,
) {
  const radii = [0.31, 0.53, 0.77, 1.02];
  const inclinations = [0.04, -0.085, 0.11, -0.055];

  context.save();
  context.lineWidth = 0.65;
  context.setLineDash([1.5, 8]);
  const project = createProjector(camera, width, height);

  for (let lane = 0; lane < radii.length; lane += 1) {
    const radius = radii[lane];
    const inclination = inclinations[lane];
    const cosInclination = Math.cos(inclination);
    const sinInclination = Math.sin(inclination);
    context.lineDashOffset = -time * (0.002 + lane * 0.0004);
    context.strokeStyle = lane % 2 === 0
      ? "rgba(170,235,250,0.035)"
      : "rgba(205,188,255,0.03)";
    context.beginPath();

    for (let step = 0; step <= 72; step += 1) {
      const angle = (step / 72) * TAU;
      const orbitX = Math.cos(angle) * radius * 1.13;
      const orbitY = Math.sin(angle) * radius * 0.62;
      const projected = project({
        x: orbitX * cosInclination - orbitY * sinInclination,
        y: orbitX * sinInclination + orbitY * cosInclination,
        z: -0.08 + Math.sin(angle) * (0.025 + lane * 0.008),
      });

      if (step === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    }

    context.stroke();
  }

  context.restore();
}

export function drawBlackHoleDust(
  context: CanvasRenderingContext2D,
  point: ProjectedPoint,
  radius: number,
  time: number,
  reducedMotion: boolean,
) {
  context.save();
  context.translate(point.x, point.y);
  context.rotate(-0.12);
  context.scale(1, 0.29);
  context.globalCompositeOperation = "lighter";

  for (const mote of BLACK_HOLE_DUST) {
    const angle = mote.angle + (time * mote.speed);
    const orbitRadius = radius * mote.radius;
    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius;
    const alpha = mote.brightness * (0.2 + Math.max(0, Math.sin(angle)) * 0.44);
    context.fillStyle = mote.warmth > 0.62
      ? "rgba(255,219,150," + alpha + ")"
      : "rgba(157,213,255," + alpha * 0.82 + ")";
    context.beginPath();
    context.arc(x, y, Math.max(0.4, mote.size * radius * 0.009), 0, TAU);
    context.fill();
  }

  context.restore();
}

export function drawBlackHole(context:CanvasRenderingContext2D,point:ProjectedPoint,radius:number,time:number,active:boolean,reducedMotion:boolean) {
  paintSingularity(context,point.x,point.y,radius,time,active);
}

/** Project a physical disk's two axes, so it foreshortens and turns edge-on with the camera. */
export function projectGalaxyDisk(node:GalaxyNode,time:number,project:ReturnType<typeof createProjector>,measure:number) {
  const position=resolveGalaxyPosition(node,time,false),centre=project(position);
  const tilt=node.tilt, inclination=Math.acos(node.flatten), spin=time*.001*node.spin;
  const a={x:Math.cos(tilt),y:Math.sin(tilt),z:0};
  const b={x:-Math.sin(tilt)*Math.cos(inclination),y:Math.cos(tilt)*Math.cos(inclination),z:Math.sin(inclination)};
  const axes=[{x:a.x*Math.cos(spin)+b.x*Math.sin(spin),y:a.y*Math.cos(spin)+b.y*Math.sin(spin),z:a.z*Math.cos(spin)+b.z*Math.sin(spin)},
    {x:b.x*Math.cos(spin)-a.x*Math.sin(spin),y:b.y*Math.cos(spin)-a.y*Math.sin(spin),z:b.z*Math.cos(spin)-a.z*Math.sin(spin)}];
  const unit=.001,normalise=unit*measure*.47*centre.scale;
  return axes.map(axis=>{const p=project({x:position.x+axis.x*unit,y:position.y+axis.y*unit,z:position.z+axis.z*unit});return{x:(p.x-centre.x)/normalise,y:(p.y-centre.y)/normalise};});
}

type BlackHoleView = { angle:number; flatten:number };
const BLACK_HOLE_TEXTURES = new Map<number,HTMLCanvasElement>();
const HOLE_TEXTURE_WIDTH=768,HOLE_TEXTURE_HEIGHT=768,HOLE_TEXTURE_RADIUS=108;

/** The disk's apparent ellipse comes from its two projected world-space axes. */
export function blackHoleView(project:ReturnType<typeof createProjector>):BlackHoleView {
  const origin=project({x:0,y:0,z:0}),tilt=-.075,inclination=1.43,step=.002;
  const a=project({x:Math.cos(tilt)*step,y:Math.sin(tilt)*step,z:0});
  const b=project({x:-Math.sin(tilt)*Math.cos(inclination)*step,y:Math.cos(tilt)*Math.cos(inclination)*step,z:Math.sin(inclination)*step});
  const ax=a.x-origin.x,ay=a.y-origin.y,bx=b.x-origin.x,by=b.y-origin.y;
  const xx=ax*ax+bx*bx,yy=ay*ay+by*by,xy=ax*ay+bx*by;
  const d=Math.hypot(xx-yy,2*xy),major=Math.max(.000001,(xx+yy+d)/2),minor=Math.max(0,(xx+yy-d)/2);
  return {angle:.5*Math.atan2(2*xy,xx-yy),flatten:clamp(Math.sqrt(minor/major),.045,1)};
}

/** An art-directed lensed ribbon; not a general-relativistic ray solver. */
function lensedRibbon(c:CanvasRenderingContext2D,r:number,band:number,flatten:number,under=false) {
  const lens=Math.pow(1-flatten,.65),h=r*(.83+band*.085)*lens,span=r*(.86+band*.072);
  const side=under?1:-1,y=r*flatten*.34;
  c.beginPath();c.moveTo(-r*3.3,y);
  c.bezierCurveTo(-r*1.62,y,-span*1.22,y+side*h*.045,-span,y+side*h*.43);
  c.bezierCurveTo(-span*.82,y+side*h*.89,-span*.48,y+side*h,0,y+side*h);
  c.bezierCurveTo(span*.48,y+side*h,span*.82,y+side*h*.89,span,y+side*h*.43);
  c.bezierCurveTo(span*1.22,y+side*h*.045,r*1.62,y,r*3.3,y);
}

function blackHoleTexture(bucket:number):HTMLCanvasElement {
  const cached=BLACK_HOLE_TEXTURES.get(bucket);
  if(cached){BLACK_HOLE_TEXTURES.delete(bucket);BLACK_HOLE_TEXTURES.set(bucket,cached);return cached;}
  const canvas=document.createElement('canvas');canvas.width=HOLE_TEXTURE_WIDTH;canvas.height=HOLE_TEXTURE_HEIGHT;
  const c=canvas.getContext('2d');if(!c)return canvas;
  const r=HOLE_TEXTURE_RADIUS,f=Math.max(.045,bucket/24),lens=Math.pow(1-f,1.8);
  c.translate(canvas.width/2,canvas.height/2);c.lineCap='round';
  const haze=(rx:number,ry:number,colour:string)=>{
    c.save();c.scale(1,ry/rx);const g=c.createRadialGradient(0,0,r*.55,0,0,rx);
    g.addColorStop(0,colour);g.addColorStop(.5,'#dc491516');g.addColorStop(1,'#dc491500');
    c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
  };
  haze(r*3.5,r*1.9,'#ff73264d');haze(r*3.5,r*(.25+f*.9),'#ff8e424a');
  c.globalCompositeOperation='lighter';
  const ribbonColour=(colour:string)=>{
    const g=c.createLinearGradient(-r*3.3,0,r*3.3,0);
    g.addColorStop(0,colour+'00');g.addColorStop(.16,colour+'22');g.addColorStop(.32,colour);
    g.addColorStop(.68,colour);g.addColorStop(.84,colour+'22');g.addColorStop(1,colour+'00');return g;
  };
  // Distant disk: continuous hot gas, with fine, overlapping dust lanes.
  for(let i=76;i>=0;i--){
    const t=i/76,rad=r*(1.02+t*2.22);
    c.globalAlpha=Math.pow(1-t,1.65)*.21;c.strokeStyle=i%9<2?'#ff6025':'#ffb56e';c.lineWidth=r*.04;
    c.beginPath();c.ellipse(0,0,rad,rad*f,0,Math.PI,TAU);c.stroke();
  }
  // Broad warm scattering beneath several crisp, almost white lensed images.
  for(const [width,alpha] of [[.25,.032],[.14,.06],[.065,.13]]){
    c.strokeStyle=ribbonColour('#ff642a');c.lineWidth=r*width;c.globalAlpha=alpha*lens;
    lensedRibbon(c,r,.65,f);c.stroke();
  }
  for(let i=17;i>=0;i--){
    c.strokeStyle=ribbonColour(i%5===0?'#ffecc0':i<7?'#fff3d9':'#ff9d66');
    c.globalAlpha=(i<7?.32:.075)*lens;c.lineWidth=r*(i<7?.014:.019);
    lensedRibbon(c,r,i/7,f);c.stroke();
  }
  // A round, dark event horizon remains opaque through every viewing angle.
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  const dark=c.createRadialGradient(0,-r*.18,0,0,0,r*.79);
  dark.addColorStop(0,'#030304');dark.addColorStop(.87,'#060303');dark.addColorStop(1,'#210905');
  c.fillStyle=dark;c.beginPath();c.arc(0,0,r*.79,0,TAU);c.fill();
  c.globalCompositeOperation='lighter';
  for(const [width,alpha] of [[.1,.065],[.035,.18],[.009,.82]]){
    c.strokeStyle='#ffc58e';c.lineWidth=r*width;c.globalAlpha=alpha;
    c.beginPath();c.arc(0,0,r*.805,0,TAU);c.stroke();
  }
  // The faint second image wraps beneath the shadow, linking back into the disk.
  for(let i=0;i<5;i++){
    c.strokeStyle=ribbonColour(i%2?'#ff965c':'#ffe1b3');c.globalAlpha=.18*lens;c.lineWidth=r*.009;
    lensedRibbon(c,r,i*.24,f,true);c.stroke();
  }
  // Near-side emission crosses in front of the horizon. Its bright side is asymmetric.
  // Fade the extra foreground emission at the disk plane, avoiding a half-disk seam.
  for(let i=76;i>=0;i--){
    const t=i/76,rad=r*(1.02+t*2.22);
    c.globalAlpha=Math.pow(1-t,1.65)*.21;c.strokeStyle=i%9<2?'#ff6025':'#ffb56e';c.lineWidth=r*.04;
    c.beginPath();c.ellipse(0,0,rad,rad*f,0,0,Math.PI);c.stroke();
  }
  const heat=c.createLinearGradient(0,0,0,r*f*.65);
  heat.addColorStop(0,'#ffab6000');heat.addColorStop(.38,'#ffd49b40');heat.addColorStop(.72,'#fff1c6');heat.addColorStop(1,'#fffbea');
  for(let i=78;i>=0;i--){
    const t=i/78,rad=r*(.89+t*2.36),strength=Math.pow(1-t,2.15);
    c.globalAlpha=strength*.42;c.strokeStyle=heat;c.lineWidth=r*(.018+(1-t)*.038);
    c.beginPath();c.ellipse(0,0,rad,rad*f,0,0,Math.PI);c.stroke();
  }
  // Radial wisps break up the outer disk without a tiled or photographic background.
  const random=seededRandom(0x7b1ac);
  for(let i=0;i<180;i++){
    const a=random()*Math.PI,rad=r*(.92+random()*2.2);
    c.globalAlpha=.02+random()*.1;c.strokeStyle=i%3?'#ffb16c':'#ffe9bc';c.lineWidth=.4+random()*.75;
    c.beginPath();c.ellipse(0,0,rad,rad*f,0,a,a+.05+random()*.18);c.stroke();
  }
  // Remove the texture boundary completely, including at maximum inclination.
  c.globalCompositeOperation='destination-in';c.globalAlpha=1;
  const fade=c.createRadialGradient(0,0,r*1.6,0,0,r*3.54);fade.addColorStop(0,'#fff');fade.addColorStop(.65,'#fff');fade.addColorStop(1,'#ffffff00');
  c.fillStyle=fade;c.fillRect(-canvas.width/2,-canvas.height/2,canvas.width,canvas.height);
  if(BLACK_HOLE_TEXTURES.size>=10)BLACK_HOLE_TEXTURES.delete(BLACK_HOLE_TEXTURES.keys().next().value!);
  BLACK_HOLE_TEXTURES.set(bucket,canvas);return canvas;
}

/** A live GPU accretion flow, with a Canvas fallback when WebGL is unavailable. */
export function drawOrbitingBlackHole(c:CanvasRenderingContext2D,point:ProjectedPoint,radius:number,time:number,active:boolean,project:ReturnType<typeof createProjector>,measure:number,camera?:Camera) {
  const extent=radius*3.6,transform=c.getTransform(),width=c.canvas.width/Math.max(.01,transform.a),height=c.canvas.height/Math.max(.01,transform.d);
  if(point.x+extent<0||point.y+extent<0||point.x-extent>width||point.y-extent>height)return;
  if(camera&&paintBlackHoleShader(c,point.x,point.y,radius,time,camera))return;
  const view=blackHoleView(project),bucket=view.flatten*24,lo=Math.floor(bucket),hi=Math.min(24,lo+1),blend=bucket-lo;
  const scale=radius/HOLE_TEXTURE_RADIUS,draw=(texture:HTMLCanvasElement,alpha:number)=>{
    c.globalAlpha=alpha;c.drawImage(texture,-HOLE_TEXTURE_WIDTH/2*scale,-HOLE_TEXTURE_HEIGHT/2*scale,HOLE_TEXTURE_WIDTH*scale,HOLE_TEXTURE_HEIGHT*scale);
  };
  c.save();c.translate(point.x,point.y);c.rotate(view.angle);
  // Draw the opaque horizon first: interpolation must never show stars through it.
  c.fillStyle='#030304';c.beginPath();c.arc(0,0,radius*.79,0,TAU);c.fill();
  draw(blackHoleTexture(lo),1);
  if(blend>.001)draw(blackHoleTexture(hi),blend);
  c.globalCompositeOperation='lighter';
  const motion=time*.00016;
  for(let i=0;i<64;i++){
    const radial=.95+(i%19)*.115,angle=i*GOLDEN_ANGLE+motion/(radial**1.5),front=Math.sin(angle)>=0;
    if(!front)continue;
    const a=angle%TAU,heat=1-(radial-.95)/2.3;
    c.globalAlpha=(.08+heat*.22)*(active?1.25:1);c.strokeStyle=i%4?'#ffd6a0':'#fff9e8';c.lineWidth=Math.max(.55,radius*.008);
    c.beginPath();c.ellipse(0,0,radius*radial,radius*radial*view.flatten,0,a,a+.025+heat*.045);c.stroke();
  }
  c.restore();
}

/** Paint detailed spiral textures once; orbit frames reuse the same bounded sprite cache. */
export function drawGalaxyCached(context: CanvasRenderingContext2D, node: GalaxyNode, projected: ProjectedPoint, radius: number, time: number, selected: boolean, hovered: boolean, reducedMotion: boolean, sprites: Map<string, HTMLCanvasElement>, compact: boolean, axes?:{x:number;y:number}[],cinema=false) {
  const key = node.player.userId + (compact ? ":compact" : ":full");
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = document.createElement("canvas");
    const pixels = compact ? 128 : 192;
    sprite.width = pixels; sprite.height = pixels;
    const painter = sprite.getContext("2d");
    if (!painter) { drawGalaxy(context,node,projected,radius,time,selected,hovered,reducedMotion); return; }
    const neutral = {...node, tilt:0, flatten:.92, player:{...node.player,rank:100,isCurrentUser:false}};
    drawGalaxy(painter,neutral,{x:pixels/2,y:pixels/2,scale:1,depth:0},pixels/3.4,0,false,false,true);
    sprites.set(key,sprite);
  }
  context.save();
  context.translate(projected.x,projected.y);
  if(axes)context.transform(axes[0].x,axes[0].y,axes[1].x,axes[1].y,0,0);
  else {context.rotate(node.tilt+time*.001*node.spin);context.scale(1,node.flatten);}
  context.globalAlpha=selected||hovered||node.player.isCurrentUser?1:clamp(.77+projected.depth*.16,.38,.92);
  context.drawImage(sprite,-radius*1.7,-radius*1.7,radius*3.4,radius*3.4);
  context.restore();
  if(!cinema&&(selected||hovered||node.player.isCurrentUser)){
    context.save();context.strokeStyle=node.player.isCurrentUser?"#ddc498aa":"#c7dfeb99";context.lineWidth=selected?1.15:.75;context.setLineDash(selected?[]:[2,5]);context.beginPath();context.arc(projected.x,projected.y,radius*1.28,0,TAU);context.stroke();context.restore();
  }
  if(!cinema&&node.player.rank>0 && node.player.rank<=10 && radius>=15){
    context.save();context.fillStyle="#c3cddd99";context.font="400 12px system-ui, sans-serif";context.textAlign="center";context.fillText("#"+node.player.rank,projected.x,projected.y+radius+14);context.restore();
  }
}


/** Frame-rate-independent camera damping (the same response at 30, 60 and 120 Hz). */
export const cameraDamping=(dt:number)=>1-Math.exp(-Math.max(0,Math.min(80,dt))/210);

export function paintUniverseFrame(context:CanvasRenderingContext2D,width:number,height:number,camera:Camera,time:number,nodes:readonly GalaxyNode[],leader:LeaderboardPlayer|null,selectedId:string|null,hoveredId:string|null,reduced:boolean,sprites:Map<string,HTMLCanvasElement>,compact=width<768,approachRadius?:number,cinema=false) {
  drawBackground(context,width,height,camera,time,reduced);
  if(!cinema)drawOrbitLanes(context,camera,width,height,time,reduced);
  const measure=Math.min(width,height),project=createProjector(camera,width,height),centre=project({x:0,y:0,z:0});
  const holeRadius=approachRadius??clamp(measure*.105*centre.scale,compact?24:56,compact?76:126);
  const active=!!leader&&(selectedId===leader.userId||hoveredId===leader.userId);
  if(!cinema)drawGalaxyTrails(context,nodes,project,measure,time,selectedId,hoveredId,reduced);
  const projected=nodes.map(node=>({node,point:project(resolveGalaxyPosition(node,time,reduced))})).sort((a,b)=>a.point.depth-b.point.depth);
  const hits:GalaxyHit[]=[];let holeDrawn=false,prepared=0,pendingSprites=0;
  for(const {node,point} of projected){
    if(!holeDrawn&&point.depth>=centre.depth){drawOrbitingBlackHole(context,centre,holeRadius,time,active,project,measure,camera);holeDrawn=true;}
    const radius=clamp(node.size*measure*point.scale,compact?5.2:5.8,compact?40:70);
    if(point.x < -radius*2 || point.x>width+radius*2 || point.y < -radius*2 || point.y>height+radius*2)continue;
    const cached=sprites.has(node.player.userId+(compact?':compact':':full'));
    // Spread first-load texture work across frames, including in reduced-motion mode.
    if(cached||prepared<4){
      drawGalaxyCached(context,node,point,radius,time,selectedId===node.player.userId,hoveredId===node.player.userId,reduced,sprites,compact,projectGalaxyDisk(node,time,project,measure),cinema);
      if(!cached)prepared++;
    }else{
      pendingSprites++;
      context.fillStyle=hsla(node.hue,30,76,.5);
      context.beginPath();context.ellipse(point.x,point.y,2,1,node.tilt,0,TAU);context.fill();
    }
    if(point.depth>=centre.depth||Math.hypot(point.x-centre.x,point.y-centre.y)>holeRadius*.78)
      hits.push({player:node.player,x:point.x,y:point.y,radius:Math.max(compact?18:13,radius*1.35),depth:point.depth});
  }
  if(!holeDrawn)drawOrbitingBlackHole(context,centre,holeRadius,time,active,project,measure,camera);
  if(leader)hits.push({player:leader,x:centre.x,y:centre.y,radius:holeRadius*.8,depth:centre.depth});
  return {hits:hits.sort((a,b)=>b.depth-a.depth),centre,holeRadius,pendingSprites};
}
