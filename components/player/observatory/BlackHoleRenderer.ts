/** Procedural accretion flow and approximate bent light paths. No image sequence or network assets. */
export const BLACK_HOLE_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){vUv=aPosition;gl_Position=vec4(aPosition,0.0,1.0);}
`;

export const BLACK_HOLE_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uDiskU;
uniform vec3 uDiskV;
uniform float uViewScale;
uniform vec2 uViewOffset;
uniform sampler2D uBackdrop;
uniform vec2 uBackdropSize;
uniform vec2 uLensCentre;
uniform float uLensExtent;
const float RS=0.385;
const float INNER=1.155;
float hash(vec3 p){p=fract(p*0.3183099+vec3(.17,.31,.47));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float turbulence(vec3 p){return noise(p)*.58+noise(p*2.03+3.7)*.28+noise(p*4.09+8.3)*.14;}
vec3 acceleration(vec3 p,float h2){float r2=max(dot(p,p),.018);return -1.5*RS*h2*p/(r2*r2*sqrt(r2));}
vec3 diskLight(vec3 p,vec3 direction,vec3 normal){
 float radius=length(p),x=dot(p,uDiskU),y=dot(p,uDiskV);
 float angle=atan(y,x),speed=.82/pow(radius,1.5),phase=angle-uTime*speed;
 vec3 flow=vec3(cos(phase)*5.0,sin(phase)*5.0,radius*6.0-uTime*.035);
 float gas=turbulence(flow),fine=noise(flow*3.2+vec3(0,0,uTime*.02));
 float lanes=.93+.07*sin(radius*38.0+gas*8.0+sin(phase*3.0)*.6);
 float edge=smoothstep(INNER,INNER+.16,radius)*(1.0-smoothstep(2.9,4.0,radius));
 float energy=pow(INNER/radius,1.85)*edge*(.23+gas*1.45)*(.82+fine*.36)*lanes;
 vec3 velocity=normalize(cross(normal,p))*sqrt(RS/(2.0*radius));
 float beta=dot(velocity,-normalize(direction));
 float doppler=sqrt(1.0-dot(velocity,velocity))/max(.3,1.0-beta);
 float redshift=sqrt(max(.01,1.0-RS/radius));
 energy*=pow(doppler,3.0)*redshift;
 vec3 warm=mix(vec3(1.55,.31,.075),vec3(1.5,.96,.53),clamp((2.25-radius)/1.2,0.0,1.0));
 warm=mix(warm,vec3(1.38,1.28,1.12),clamp((doppler-1.0)*1.7,0.0,.65));
 return warm*energy*2.1;
}
void main(){
 vec2 uv=(vUv*uViewScale+uViewOffset)*4.35;
 vec3 position=vec3(uv,8.0),direction=vec3(0,0,-1),normal=normalize(cross(uDiskU,uDiskV));
 float h2=dot(cross(position,direction),cross(position,direction));
 vec3 radiance=vec3(0);float opacity=0.0;float captured=0.0;
 for(int step=0;step<160;step++){
  float radius=length(position);
  if(radius<RS*1.03){captured=1.0;break;}
  if(radius>12.0)break;
  float ds=clamp(radius*.065,.025,.42);
  vec3 force=acceleration(position,h2);
  vec3 next=position+direction*ds+force*(.5*ds*ds);
  float height=dot(position,normal),nextHeight=dot(next,normal);
  if(height*nextHeight<0.0){
   vec3 point=mix(position,next,height/(height-nextHeight));float diskRadius=length(point);
   if(diskRadius>INNER&&diskRadius<4.0){
    radiance+=diskLight(point,direction,normal)*(1.0-opacity);
    opacity+=.94*(1.0-opacity);
    if(opacity>.98)break;
   }
  }
  direction+=(force+acceleration(next,h2))*(.5*ds);
  position=next;
 }
 vec3 colour=1.0-exp(-radiance*1.45);
 // Higher-order photon images are thinner than a screen pixel. Integrate that
 // unresolved boundary into a continuous profile instead of letting it sparkle.
 float photonDistance=length(uv)-1.005;
 float photonBand=1.0-smoothstep(.018,.045,abs(photonDistance));
 float photonOffset=photonDistance/.021;
 vec3 photon=vec3(.95,.49,.19)*exp(-photonOffset*photonOffset)*.58;
 colour=mix(colour,photon,photonBand);
 // A faint corona softens the photon boundary, without washing out disk structure.
 float corona=exp(-abs(length(uv)-1.005)*15.0)*.008;
 colour+=vec3(.9,.38,.1)*corona;
 // Sample the actual sky along the escaped ray. Near the photon boundary the
 // ray reverses its source direction, stretching background stars into arcs.
 float lensWeight=1.0-smoothstep(2.7,4.25,length(uv));
 vec2 source=uv+normalize(direction).xy*3.2*lensWeight;
 vec2 pixel=uLensCentre+vec2(source.x,-source.y)*(uLensExtent/4.35);
 vec2 skyUv=vec2(pixel.x/uBackdropSize.x,1.0-pixel.y/uBackdropSize.y);
 vec3 background=texture2D(uBackdrop,clamp(skyUv,vec2(.001),vec2(.999))).rgb;
 colour+=background*(1.0-opacity)*(1.0-captured)*(1.0-photonBand*.8);
 float alpha=1.0-smoothstep(4.0,4.32,length(uv));
 gl_FragColor=vec4(colour*alpha,alpha);
}
`;

export const BLACK_HOLE_BLOOM = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform sampler2D uScene;
uniform vec2 uDirection;
uniform float uComposite;
void main(){
 vec2 uv=vUv*.5+.5;
 vec3 glow=texture2D(uSource,uv).rgb*.227027;
 glow+=(texture2D(uSource,uv+uDirection*1.384615).rgb+texture2D(uSource,uv-uDirection*1.384615).rgb)*.316216;
 glow+=(texture2D(uSource,uv+uDirection*3.230769).rgb+texture2D(uSource,uv-uDirection*3.230769).rgb)*.070270;
 if(uComposite<.5){gl_FragColor=vec4(glow,1.0);return;}
 vec4 scene=texture2D(uScene,uv);
 glow*=.38;
 vec3 light=scene.rgb+glow*(1.0-scene.rgb);
 float alpha=max(scene.a,max(light.r,max(light.g,light.b)));
 gl_FragColor=vec4(light,alpha);
}
`;

type CameraAngles={yaw:number;pitch:number};
/** Keep close approaches sharp by shading the visible region, rather than enlarging a tiny texture. */
export function blackHoleCrop(width:number,height:number,x:number,y:number,radius:number){
 const extent=radius*3.58,side=extent*2;
 if(side<=Math.max(width,height))return {x:x-extent,y:y-extent,size:side,scale:1,offsetX:0,offsetY:0};
 const left=Math.max(0,x-extent),right=Math.min(width,x+extent),top=Math.max(0,y-extent),bottom=Math.min(height,y+extent);
 const size=Math.max(1,right-left,bottom-top),cx=(left+right)/2,cy=(top+bottom)/2;
 return {x:cx-size/2,y:cy-size/2,size,scale:size/side,offsetX:(cx-x)/extent,offsetY:(y-cy)/extent};
}
export function blackHoleDiskAxes(camera:CameraAngles):[number[],number[]] {
 const tilt=-.075,inclination=1.43;
 const rotate=([x,y,z]:number[])=>{
  const px=x*Math.cos(camera.yaw)+z*Math.sin(camera.yaw),pz=-x*Math.sin(camera.yaw)+z*Math.cos(camera.yaw);
  return [px,-(y*Math.cos(camera.pitch)-pz*Math.sin(camera.pitch)),y*Math.sin(camera.pitch)+pz*Math.cos(camera.pitch)];
 };
 return [rotate([Math.cos(tilt),Math.sin(tilt),0]),rotate([-Math.sin(tilt)*Math.cos(inclination),Math.cos(tilt)*Math.cos(inclination),Math.sin(inclination)])];
}

class BlackHoleRenderer {
 readonly canvas=document.createElement('canvas');
 private gl:WebGLRenderingContext;
 private program:WebGLProgram;
 private bloom:WebGLProgram;
 private targets:{texture:WebGLTexture;framebuffer:WebGLFramebuffer}[]=[];
 private buffer:WebGLBuffer|null=null;
 private bloomSource:WebGLUniformLocation|null;
 private bloomScene:WebGLUniformLocation|null;
 private bloomDirection:WebGLUniformLocation|null;
 private bloomComposite:WebGLUniformLocation|null;
 private quality=1;
 private samples=0;
 private cost=0;
 private time:WebGLUniformLocation|null;
 private diskU:WebGLUniformLocation|null;
 private diskV:WebGLUniformLocation|null;
 private viewScale:WebGLUniformLocation|null;
 private viewOffset:WebGLUniformLocation|null;
 private backdrop:WebGLTexture;
 private backdropCanvas=document.createElement('canvas');
 private backdropContext=this.backdropCanvas.getContext('2d')!;
 private backdropSize:WebGLUniformLocation|null;
 private lensCentre:WebGLUniformLocation|null;
 private lensExtent:WebGLUniformLocation|null;
 private lost=false;
 constructor(){
  const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL is unavailable');this.gl=gl;
  const shaders:WebGLShader[]=[];
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type);if(!shader)throw new Error('Shader unavailable');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');return shader;};
  const link=(fragment:string)=>{const program=gl.createProgram();if(!program)throw new Error('Program unavailable');try{gl.attachShader(program,compile(gl.VERTEX_SHADER,BLACK_HOLE_VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.bindAttribLocation(program,0,'aPosition');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');return program;}catch(error){gl.deleteProgram(program);throw error;}};
  try{this.program=link(BLACK_HOLE_FRAGMENT);this.bloom=link(BLACK_HOLE_BLOOM);}finally{for(const shader of shaders)gl.deleteShader(shader);}
  const program=this.program;gl.useProgram(program);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  this.time=gl.getUniformLocation(program,'uTime');this.diskU=gl.getUniformLocation(program,'uDiskU');this.diskV=gl.getUniformLocation(program,'uDiskV');
  this.viewScale=gl.getUniformLocation(program,'uViewScale');this.viewOffset=gl.getUniformLocation(program,'uViewOffset');
  this.backdropSize=gl.getUniformLocation(program,'uBackdropSize');this.lensCentre=gl.getUniformLocation(program,'uLensCentre');this.lensExtent=gl.getUniformLocation(program,'uLensExtent');
  const backdrop=gl.createTexture();if(!backdrop)throw new Error('Lens texture unavailable');this.backdrop=backdrop;
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,backdrop);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'uBackdrop'),2);gl.activeTexture(gl.TEXTURE0);
  this.bloomSource=gl.getUniformLocation(this.bloom,'uSource');this.bloomScene=gl.getUniformLocation(this.bloom,'uScene');this.bloomDirection=gl.getUniformLocation(this.bloom,'uDirection');this.bloomComposite=gl.getUniformLocation(this.bloom,'uComposite');
  for(let i=0;i<2;i++){
   const texture=gl.createTexture(),framebuffer=gl.createFramebuffer();if(!texture||!framebuffer)throw new Error('Render target unavailable');
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);this.targets.push({texture,framebuffer});
  }
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
 }
 render(radius:number,time:number,camera:CameraAngles,crop:ReturnType<typeof blackHoleCrop>,source:HTMLCanvasElement,x:number,y:number,width:number,height:number){
  if(this.lost||this.gl.isContextLost())return null;
  // Quantised sizes avoid reallocating textures on every damped camera frame.
  const ceiling=crop.scale<1?768:512;
  const requested=Math.min(ceiling,crop.size*Math.min(1.35,typeof devicePixelRatio==='number'?devicePixelRatio:1))*this.quality;
  const pixels=Math.max(192,Math.min(ceiling,Math.ceil(requested/32)*32));
  if(this.canvas.width!==pixels){this.canvas.width=this.canvas.height=pixels;this.gl.viewport(0,0,pixels,pixels);for(const target of this.targets){this.gl.bindTexture(this.gl.TEXTURE_2D,target.texture);this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,pixels,pixels,0,this.gl.RGBA,this.gl.UNSIGNED_BYTE,null);}}
  const gl=this.gl,axes=blackHoleDiskAxes(camera);gl.useProgram(this.program);gl.uniform1f(this.time,time/1000);gl.uniform3fv(this.diskU,axes[0]);gl.uniform3fv(this.diskV,axes[1]);
  gl.uniform1f(this.viewScale,crop.scale);gl.uniform2f(this.viewOffset,crop.offsetX,crop.offsetY);
  const backdropScale=Math.min(1,1024/Math.max(width,height));
  const bw=Math.max(1,Math.round(width*backdropScale)),bh=Math.max(1,Math.round(height*backdropScale));
  if(this.backdropCanvas.width!==bw||this.backdropCanvas.height!==bh){this.backdropCanvas.width=bw;this.backdropCanvas.height=bh;}
  this.backdropContext.drawImage(source,0,0,bw,bh);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.backdrop);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.backdropCanvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.uniform2f(this.backdropSize,width,height);gl.uniform2f(this.lensCentre,x,y);gl.uniform1f(this.lensExtent,radius*3.58);gl.activeTexture(gl.TEXTURE0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[0].framebuffer);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.useProgram(this.bloom);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);gl.uniform1i(this.bloomSource,0);
  gl.uniform1f(this.bloomComposite,0);gl.uniform2f(this.bloomDirection,2.4/pixels,0);gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[1].framebuffer);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);gl.uniform1i(this.bloomScene,1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.targets[1].texture);
  gl.uniform1f(this.bloomComposite,1);gl.uniform2f(this.bloomDirection,0,2.4/pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawArrays(gl.TRIANGLES,0,6);return this.canvas;
 }
 recordCost(milliseconds:number){
  this.cost+=milliseconds;this.samples++;
  // Lower GPU work under sustained pressure; preserve continuous motion and geometry.
  if(this.samples===45){if(this.cost/this.samples>9)this.quality=Math.max(.45,this.quality*.82);this.cost=0;this.samples=0;}
 }
 dispose(){
  const gl=this.gl;for(const target of this.targets){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.framebuffer);}
  gl.deleteTexture(this.backdrop);this.backdropCanvas.width=this.backdropCanvas.height=1;
  gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.deleteProgram(this.bloom);gl.getExtension('WEBGL_lose_context')?.loseContext();
 }
}
const renderers=new WeakMap<CanvasRenderingContext2D,BlackHoleRenderer|null>();
export function disposeBlackHoleRenderer(context:CanvasRenderingContext2D){renderers.get(context)?.dispose();renderers.delete(context);}
export function paintBlackHoleShader(context:CanvasRenderingContext2D,x:number,y:number,radius:number,time:number,camera:CameraAngles):boolean {
 if(!renderers.has(context)){try{const renderer=new BlackHoleRenderer();renderers.set(context,renderer);renderer.canvas.addEventListener('webglcontextrestored',()=>{renderers.delete(context);},{once:true});}catch{renderers.set(context,null);}}
 const renderer=renderers.get(context);if(!renderer)return false;
 try{
  const started=performance.now(),transform=context.getTransform();
  const width=context.canvas.width/Math.max(.01,transform.a),height=context.canvas.height/Math.max(.01,transform.d);
  const crop=blackHoleCrop(width,height,x,y,radius),canvas=renderer.render(radius,time,camera,crop,context.canvas,x,y,width,height);if(!canvas)return false;
  context.drawImage(canvas,crop.x,crop.y,crop.size,crop.size);renderer.recordCost(performance.now()-started);return true;
 }catch{disposeBlackHoleRenderer(context);renderers.set(context,null);return false;}
}
