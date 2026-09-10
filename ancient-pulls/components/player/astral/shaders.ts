export const QUAD_VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main(){ v_uv = a_position * .5 + .5; gl_Position = vec4(a_position,0.,1.); }
`;
export const SPACE_FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time, u_gather, u_flight, u_horizon, u_engulf, u_reveal, u_impact;
uniform vec3 u_primary, u_secondary;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float cloud(vec2 p){return noise(p)*.55+noise(p*2.03)*.27+noise(p*4.07)*.12;}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(v_uv-.5)*vec2(aspect,1.);
  vec2 origin=vec2(0.,.06);
  vec2 bh=p-origin;
  float radius=length(bh);
  float horizon=u_horizon*.105 + pow(u_engulf,3.)*2.1;
  float lens=u_horizon*.016/(radius*radius+.012);
  vec2 warped=p+normalize(bh+vec2(.0001))*lens*.045;
  float rot=atan(bh.y,bh.x)+lens;
  vec2 flow=vec2(warped.x*.85+warped.y*.45,warped.y-warped.x*.38);
  float nebula=cloud(flow*4.+vec2(u_time*.009,-u_time*.006));
  float wisps=pow(cloud(flow*7.-vec2(u_time*.018,0.)),3.);
  float veil=exp(-pow((flow.y+.08+sin(flow.x*3.+u_time*.025)*.1)*4.5,2.));
  vec3 colour=vec3(.009,.017,.035);
  colour+=vec3(.070,.120,.185)*nebula*veil;
  colour+=vec3(.075,.051,.135)*wisps*2.;
  float filament=abs(flow.y+sin(flow.x*2.9+u_time*.025)*.12+.055);
  colour+=vec3(.031,.070,.100)*exp(-filament*20.)*(.3+nebula);
  colour+=u_primary*exp(-dot(p,p)*7.)*(.015+u_gather*.04)*(1.-u_reveal*.8);
  float velocity=smoothstep(.05,.40,u_flight)*(1.-u_reveal)*(1.-u_horizon);
  float rayAngle=atan(p.y,p.x);
  float sector=floor((rayAngle+3.141593)*95.);
  float streakSeed=hash(vec2(sector,19.));
  float ray=pow(max(0.,cos(rayAngle*190.)),80.);
  float run=fract(length(p)*.8-u_time*(.22+streakSeed*.32));
  float dash=exp(-pow((run-.5)*12.,2.))*smoothstep(.15,.55,length(p));
  colour+=u_primary*ray*dash*velocity*step(.62,streakSeed)*.2;
  float ring=abs(length(vec2(bh.x,bh.y*3.5))-(.135+u_horizon*.07));
  float disk=exp(-ring*130.)+exp(-ring*30.)*.20;
  float bands=.55+.45*sin(rot*3.+radius*70.-u_time*1.8);
  colour+=(u_primary*.45+u_secondary*.25)*disk*u_horizon*(.7+bands*.3);
  float photon=exp(-abs(radius-horizon)*290.)+exp(-abs(radius-horizon)*60.)*.16;
  colour+=vec3(.62,.77,1.)*photon*u_horizon*.9;
  colour*=1.-(1.-smoothstep(horizon-.013,horizon-.004,radius))*u_horizon;
  // Smooth optical occlusion, never a white frame or a hard screen flash.
  colour*=1.-smoothstep(.1,.85,u_engulf)*(1.-u_reveal);
  colour+=u_primary*u_impact*.15*exp(-length(p)*2.)*(1.-u_horizon);
  colour=mix(colour, vec3(.006,.009,.019)+u_primary*exp(-dot(p,p)*5.)*.035,u_reveal);
  float vignette=1.-smoothstep(.22,.88,length(p/vec2(aspect,1.)));
  colour*=.55+vignette*.45;
  colour+=(hash(gl_FragCoord.xy+fract(u_time)*71.)-.5)/650.;
  gl_FragColor=vec4(colour,1.);
}
`;
export const PARTICLE_VERTEX = `
attribute vec3 a_position;
attribute vec3 a_seed;
uniform float u_time,u_flight,u_gather,u_horizon,u_engulf,u_reveal,u_dpr,u_aspect;
varying float v_alpha, v_hue;
void main(){
  float depth=fract(a_position.z-u_time*.003-u_flight*.32);
  float z=.35+depth*2.8;
  float angle=u_time*.015+u_gather*.035;
  mat2 rotation=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
  vec2 p=rotation*a_position.xy/z;
  vec2 delta=p-vec2(0.,.06);
  float r=length(delta);
  float pull=u_horizon*u_horizon;
  float spin=pull*.3/(r+.13);
  mat2 twist=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));
  p=vec2(0.,.06)+twist*delta*(1.-pull*.88);
  gl_Position=vec4(p.x*2./u_aspect,p.y*2.,0.,1.);
  gl_PointSize=clamp((a_seed.x*2.3+.9)/z,1.,5.5)*u_dpr*(1.+u_flight*.3);
  v_alpha=(.35+a_seed.y*.65)*smoothstep(0.,.14,depth)*(1.-smoothstep(.88,1.,depth));
  v_alpha*=.72+.28*sin(u_time*(.5+a_seed.z)+a_seed.y*24.);
  v_alpha*=(1.-u_reveal*.8)*(1.-smoothstep(.15,.95,u_engulf));
  float hole=u_horizon*.105+pow(u_engulf,3.)*2.1;
  v_alpha*=mix(1.,smoothstep(hole,hole+.012,length(p-vec2(0.,.06))),step(.001,u_horizon));
  v_hue=a_seed.z;
}
`;
export const PARTICLE_FRAGMENT = `
precision mediump float;
varying float v_alpha,v_hue;
void main(){
  vec2 pixel=floor(gl_PointCoord*5.)-vec2(2.);
  float core=1.-step(.5,max(abs(pixel.x),abs(pixel.y)));
  float arms=(1.-step(.5,min(abs(pixel.x),abs(pixel.y))))*(1.-step(2.1,max(abs(pixel.x),abs(pixel.y))));
  float alpha=(core*.78+arms*.22)*v_alpha;
  gl_FragColor=vec4(mix(vec3(.60,.74,1.),vec3(1.,.91,.73),v_hue*.5),alpha);
}
`;
export const COLOUR_VERTEX = `
attribute vec2 a_position;
attribute vec4 a_colour;
uniform float u_aspect;
varying vec4 v_colour;
void main(){gl_Position=vec4(a_position.x*2./u_aspect,a_position.y*2.,0.,1.);v_colour=a_colour;}
`;
export const COLOUR_FRAGMENT = `precision mediump float;varying vec4 v_colour;void main(){gl_FragColor=v_colour;}`;
export const GLOW_VERTEX = `
attribute vec2 a_position;
uniform vec2 u_center;
uniform float u_size,u_aspect;
varying vec2 v_local;
varying vec2 v_world;
void main(){v_local=a_position;vec2 p=u_center+a_position*u_size;v_world=p;gl_Position=vec4(p.x*2./u_aspect,p.y*2.,0.,1.);}
`;
export const GLOW_FRAGMENT = `
precision mediump float;
varying vec2 v_local;
varying vec2 v_world;
uniform vec3 u_colour;
uniform float u_opacity,u_spikes,u_hole;
void main(){
  float r=length(v_local);
  float glow=exp(-r*r*6.)*.32+exp(-r*r*70.)*.7;
  float cross=pow(max(0.,1.-abs(v_local.x)*18.),3.)*exp(-abs(v_local.y)*5.);
  cross+=pow(max(0.,1.-abs(v_local.y)*35.),3.)*exp(-abs(v_local.x)*3.5);
  glow+=cross*u_spikes*.6;
  vec3 colour=mix(u_colour,vec3(1.),exp(-r*r*150.)*.8);
  float mask=mix(1.,smoothstep(u_hole,u_hole+.01,length(v_world-vec2(0.,.06))),step(.001,u_hole));
  gl_FragColor=vec4(colour,glow*u_opacity*(1.-smoothstep(.72,1.,r))*mask);
}
`;
export const MASCOT_VERTEX = `
attribute vec2 a_position;
uniform vec2 u_center;
uniform float u_time,u_scale,u_roll,u_stretch,u_aspect,u_gather;
varying vec2 v_uv;
varying vec2 v_world;
varying float v_light;
void main(){
  v_uv=a_position;
  vec2 p=(a_position-vec2(.5,.50))*vec2(1.,-1.);
  // The face and star hood stay intact; only the little arms and lower streamers flex.
  float arms=smoothstep(.56,.61,a_position.y)*(1.-smoothstep(.67,.72,a_position.y));
  float reach=smoothstep(.08,.18,abs(p.x));
  float tail=smoothstep(.70,.89,a_position.y);
  float beat=sin(u_time*3.5+sign(p.x)*.6);
  p.y+=beat*reach*arms*.014;
  p.x+=cos(u_time*3.5+sign(p.x)*.6)*reach*arms*.007;
  p.x+=sin(u_time*2.5-a_position.y*9.)*tail*.020;
  p.y+=cos(u_time*2.1-a_position.y*7.)*tail*.008;
  p.x*=1.-u_stretch*.22;
  p.y*=1.+u_stretch;
  mat2 roll=mat2(cos(u_roll),sin(u_roll),-sin(u_roll),cos(u_roll));
  p=u_center+roll*p*u_scale;
  v_world=p;
  gl_Position=vec4(p.x*2./u_aspect,p.y*2.,0.,1.);
  v_light=1.+u_gather*.025;
}
`;
export const MASCOT_FRAGMENT = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_world;
varying float v_light;
uniform sampler2D u_texture;
uniform vec3 u_colour;
uniform float u_opacity,u_colourMix,u_hole;
void main(){
  vec4 tex=texture2D(u_texture,v_uv);
  vec3 tint=mix(vec3(1.),u_colour*1.08+.16,u_colourMix*.55);
  float mask=mix(1.,smoothstep(u_hole,u_hole+.012,length(v_world-vec2(0.,.06))),step(.001,u_hole));
  // Opaque texels and transparent surroundings prevent pale fringes on dark skies.
  gl_FragColor=vec4(tex.rgb*tint*v_light,step(.5,tex.a)*u_opacity*mask);
}
`;
