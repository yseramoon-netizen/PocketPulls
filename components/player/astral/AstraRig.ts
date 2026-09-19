import { rigBodyScale, type FlightPose } from './flight';
type Part = {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
};
type Node = {
    x: number;
    y: number;
    px: number;
    py: number;
};
const PART_CACHE = new WeakMap<HTMLImageElement, Part[]>();
const BOUNDS = [[17, 61, 312, 311], [338, 59, 616, 311], [636, 61, 933, 311], [986, 145, 1208, 291], [92, 396, 218, 549], [408, 396, 534, 549], [691, 429, 823, 550], [1059, 429, 1190, 550], [24, 650, 325, 894], [384, 636, 535, 907], [719, 636, 870, 907], [1043, 709, 1151, 833], [17, 946, 312, 1196], [324, 945, 618, 1196], [630, 945, 927, 1196], [947, 945, 1231, 1196]];
/** Articulation and an inertial cloth chain; the matte is keyed once at load. */
export class AstraRig {
    private parts: Part[] = [];
    private cloth: Node[] = Array.from({ length: 17 }, (_, i) => ({ x: 0, y: -6 + i * 2.9, px: 0, py: -6 + i * 2.9 }));
    private tints=new Map<string,HTMLCanvasElement[]>();
    private light: {parts:HTMLCanvasElement[];amount:number}|undefined;
    private last: number|null = null;
    private accumulator=0;
    private ribbons=[-1,1].map(side=>Array.from({length:9},(_,i)=>({x:side*9,y:i*4.3,px:side*9,py:i*4.3})));
    private lastX = 0;
    private lastY = 0;
    private velocityX = 0;
    private velocityY = 0;
    constructor(image: HTMLImageElement) {
        const cached = PART_CACHE.get(image);
        if (cached) { this.parts = cached; return; }
        for (const [l, t, r, b] of BOUNDS) {
            const w = r - l + 4, h = b - t + 4, canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const c = canvas.getContext('2d', { willReadFrequently: true })!;
            c.drawImage(image, l - 2, t - 2, w, h, 0, 0, w, h);
            const data = c.getImageData(0, 0, w, h), p = data.data;
            for (let i = 0; i < p.length; i += 4)
                if (p[i + 1] > 50 && p[i + 1] > p[i] * 1.45 && p[i + 1] > p[i + 2] * 1.45)
                    p[i + 3] = 0;
            c.putImageData(data, 0, 0);
            this.parts.push({ canvas, width: w, height: h });
        }
        PART_CACHE.set(image, this.parts);
    }
    private part(c: CanvasRenderingContext2D, index: number, x: number, y: number, w: number, h: number, rotation = 0, pivot = .5) {
        c.save();
        c.translate(x, y);
        c.rotate(rotation);
        c.drawImage(this.parts[index].canvas, -w / 2, -h * pivot, w, h);
        if(this.light){c.globalAlpha*=this.light.amount;c.drawImage(this.light.parts[index],-w/2,-h*pivot,w,h);}
        c.restore();
    }
    private arm(c: CanvasRenderingContext2D, side: number, rotation: number) {
        c.save();
        c.translate(side * 14, 4);
        c.rotate(rotation + side * .38);
        const index=side<0?4:5,x=side<0?-14*.81:-14*.19;
        c.drawImage(this.parts[index].canvas,x,-26*.09,14,26);
        if(this.light){c.globalAlpha*=this.light.amount;c.drawImage(this.light.parts[index],x,-26*.09,14,26);}
        c.restore();
    }
    private simulate(time:number,pose:FlightPose){
        if(this.last!==null&&(time<this.last||time-this.last>.25)){
            this.cloth=Array.from({length:17},(_,i)=>({x:0,y:-6+i*2.9,px:0,py:-6+i*2.9}));
            this.ribbons=[-1,1].map(side=>Array.from({length:9},(_,i)=>({x:side*9,y:i*4.3,px:side*9,py:i*4.3})));
            this.last=null;this.accumulator=0;this.velocityX=this.velocityY=0;
        }
        const elapsed=this.last===null?1/60:Math.max(0,Math.min(.06,time-this.last));
        if(!elapsed)return;
        const vx=this.last===null?0:(pose.x-this.lastX)/elapsed,vy=this.last===null?0:(pose.y-this.lastY)/elapsed;
        const ax=Math.max(-6,Math.min(6,(vx-this.velocityX)/elapsed)),ay=Math.max(-6,Math.min(6,(vy-this.velocityY)/elapsed));
        this.last=time;this.lastX=pose.x;this.lastY=pose.y;this.velocityX=vx;this.velocityY=vy;
        const cosine=Math.cos(pose.roll),sine=Math.sin(pose.roll),windX=vx*cosine+vy*sine,windY=-vx*sine+vy*cosine;
        this.accumulator+=elapsed;
        const dt=1/120,chains=[{nodes:this.cloth,x:0,y:-6,length:2.9},{nodes:this.ribbons[0],x:-9,y:0,length:4.3},{nodes:this.ribbons[1],x:9,y:0,length:4.3}];
        while(this.accumulator>=dt){
            this.accumulator-=dt;
            const sample=time-this.accumulator;
            for(const [index,chain] of chains.entries()){
                for(let i=1;i<chain.nodes.length;i++){
                    const node=chain.nodes[i],x=node.x,y=node.y;
                    const flutter=Math.sin(sample*4.2-i*.48+index*1.7)*(25+(pose.wind??0)*60)+Math.sin(sample*7.1-i*.29)*12;
                    node.x+=(node.x-node.px)*.966+(flutter+sine*260-windX*600-(ax*cosine+ay*sine)*27)*dt*dt;
                    node.y+=(node.y-node.py)*.966+(cosine*260-windY*390-(-ax*sine+ay*cosine)*20)*dt*dt;
                    node.px=x;node.py=y;
                }
                for(let pass=0;pass<7;pass++){
                    Object.assign(chain.nodes[0],{x:chain.x,y:chain.y,px:chain.x,py:chain.y});
                    for(let i=1;i<chain.nodes.length;i++){
                        const a=chain.nodes[i-1],b=chain.nodes[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||.001;
                        const error=(length-chain.length)/length;
                        b.x-=dx*error*(i===1?1:.5);b.y-=dy*error*(i===1?1:.5);
                        if(i>1){a.x+=dx*error*.5;a.y+=dy*error*.5;}
                    }
                }
            }
        }
    }
    draw(c: CanvasRenderingContext2D, pose: FlightPose, time: number, size: number, width: number, height: number, light?:{colour:string;amount:number}) {
        this.light=undefined;
        if(light&&light.amount>.01){
            let parts=this.tints.get(light.colour);
            if(!parts){parts=this.parts.map(part=>{const canvas=document.createElement('canvas');canvas.width=part.width;canvas.height=part.height;const p=canvas.getContext('2d')!;p.drawImage(part.canvas,0,0);p.globalCompositeOperation='source-atop';p.fillStyle=light.colour;p.fillRect(0,0,canvas.width,canvas.height);return canvas;});if(this.tints.size>=6)this.tints.delete(this.tints.keys().next().value!);this.tints.set(light.colour,parts);}
            this.light={parts,amount:Math.max(0,Math.min(.45,light.amount))};
        }
        this.simulate(time, pose);
        const turn = Math.cos(pose.yaw), facingWidth = .65 + Math.abs(turn) * .35, rear = turn < -.3;
        c.save();
        c.translate(pose.x * width, pose.y * height);
        c.rotate(pose.roll);
        c.scale(size / 100, size / 100);
        c.imageSmoothingEnabled = false;
        const cape = this.parts[8], drawCape = () => {
            for (let i = 0; i < 16; i++) {
                const a = this.cloth[i], b = this.cloth[i + 1], u = i / 16, w = (12 + u * 29) * (.8 + facingWidth * .2) * (1+Math.sin(time*3.8-u*5)*u*.06), angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
                c.save();
                c.translate(a.x, a.y);
                c.rotate(angle);
                c.drawImage(cape.canvas, 0, u * cape.height, cape.width, cape.height / 16, -w / 2, 0, w, Math.hypot(b.x-a.x,b.y-a.y)+.8);
                c.restore();
            }
        };
        if (!rear)
            drawCape();
        for(const [index,nodes] of this.ribbons.entries()){
            const part=this.parts[index+9];
            for(let i=0;i<nodes.length-1;i++){
                const a=nodes[i],b=nodes[i+1],angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2;
                c.save();c.translate(a.x,a.y);c.rotate(angle);
                c.drawImage(part.canvas,0,i/(nodes.length-1)*part.height,part.width,part.height/(nodes.length-1),-4.5,0,9,Math.hypot(b.x-a.x,b.y-a.y)+.7);c.restore();
            }
        }
        c.save();
        const body=rigBodyScale(pose);c.scale(body.x,body.y);
        this.part(c,6,-6,12,12,15,(pose.leftLeg??pose.kick)+.2,.1);
        this.part(c,7,6,12,12,15,(pose.rightLeg??-pose.kick)-.2,.1);
        this.arm(c, -1, pose.leftArm);
        this.arm(c, 1, pose.rightArm);
        this.part(c, 3, 0, 3, 29, 24, Math.sin(time * 3.1) * .025);
        this.part(c, 11, 0, -6, 5, 5);
        const side=Math.abs(Math.sin(pose.yaw)),mix=Math.max(0,Math.min(1,(side-.25)/.6)),profile=mix*mix*(3-2*mix);
        const face=turn<0?2:pose.expression?11+pose.expression:0;
        const tilt=pose.headTilt??Math.sin(time*1.9)*.035-Math.sin(pose.roll)*.18-pose.gaze*.025;
        const head=(index:number,alpha:number)=>{
            if(alpha<.001)return;
            c.save();c.globalAlpha*=alpha;
            if((index===1||index===15)&&Math.sin(pose.yaw)<0)c.scale(-1,1);
            this.part(c,index,0,-22,59,50,tilt);c.restore();
        };
        head(face,1-profile);head(pose.expression===3?15:1,profile);
        c.restore();
        if (rear)
            drawCape();
        c.restore();
    }
}
