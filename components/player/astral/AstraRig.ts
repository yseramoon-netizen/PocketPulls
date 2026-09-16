import type { FlightPose } from './flight';
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
    private last = 0;
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
        c.drawImage(this.parts[side < 0 ? 4 : 5].canvas, side < 0 ? -14 * .81 : -14 * .19, -26 * .09, 14, 26);
        c.restore();
    }
    private simulate(time: number, pose: FlightPose) {
        if (this.last && (time < this.last || time - this.last > .2)) {
            this.cloth = Array.from({ length: 17 }, (_, i) => ({ x: 0, y: -6 + i * 2.9, px: 0, py: -6 + i * 2.9 }));
            this.last = 0;
            this.velocityX = this.velocityY = 0;
        }
        let dt = this.last ? Math.max(0, Math.min(.045, time - this.last)) : 1 / 60;
        if (!dt)
            return;
        const vx = this.last ? (pose.x - this.lastX) / dt : 0, vy = this.last ? (pose.y - this.lastY) / dt : 0, ax = Math.max(-8, Math.min(8, (vx - this.velocityX) / Math.max(.016, dt))), ay = Math.max(-6, Math.min(6, (vy - this.velocityY) / Math.max(.016, dt)));
        this.last = time;
        this.lastX = pose.x;
        this.lastY = pose.y;
        this.velocityX = vx;
        this.velocityY = vy;
        const steps = Math.max(1, Math.ceil(dt * 120));
        dt /= steps;
        for (let k = 0; k < steps; k++) {
            this.cloth[0] = { x: 0, y: -6, px: 0, py: -6 };
            for (let i = 1; i < 17; i++) {
                const p = this.cloth[i], x = p.x, y = p.y, drag = Math.pow(.965, dt * 120), wind = Math.sin(time * 3.8 - i * .52) * 32 + Math.sin(time * 6.4 - i * .27) * 13;
                p.x += (p.x - p.px) * drag + (wind + Math.sin(pose.roll) * 260 - vx * 480 - ax * 35) * dt * dt;
                p.y += (p.y - p.py) * drag + (Math.cos(pose.roll) * 260 - vy * 240 - ay * 18) * dt * dt;
                p.px = x;
                p.py = y;
            }
            for (let pass = 0; pass < 5; pass++)
                for (let i = 1; i < 17; i++) {
                    const a = this.cloth[i - 1], b = this.cloth[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .001, v = (d - 2.9) / d, f = i === 1 ? 1 : .5;
                    b.x -= dx * v * f;
                    b.y -= dy * v * f;
                    if (i > 1) {
                        a.x += dx * v * .5;
                        a.y += dy * v * .5;
                    }
                }
        }
    }
    draw(c: CanvasRenderingContext2D, pose: FlightPose, time: number, size: number, width: number, height: number, light?:{colour:string;amount:number}) {
        this.light=undefined;
        if(light&&light.amount>.01){
            let parts=this.tints.get(light.colour);
            if(!parts){parts=this.parts.map(part=>{const canvas=document.createElement('canvas');canvas.width=part.width;canvas.height=part.height;const p=canvas.getContext('2d')!;p.drawImage(part.canvas,0,0);p.globalCompositeOperation='source-atop';p.fillStyle=light.colour;p.fillRect(0,0,canvas.width,canvas.height);return canvas;});if(this.tints.size>=12)this.tints.delete(this.tints.keys().next().value!);this.tints.set(light.colour,parts);}
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
                const a = this.cloth[i], b = this.cloth[i + 1], u = i / 16, w = (12 + u * 29) * (.8 + facingWidth * .2), angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
                c.save();
                c.translate(a.x, a.y);
                c.rotate(angle);
                c.drawImage(cape.canvas, 0, u * cape.height, cape.width, cape.height / 16, -w / 2, 0, w, 3.8);
                c.restore();
            }
        };
        if (!rear)
            drawCape();
        for (const side of [-1, 1])
            this.part(c, side < 0 ? 9 : 10, side * 9, 0, 9, 36, side * .38 + Math.sin(time * 4.5 + side) * .27, 0);
        c.save();
        c.scale(facingWidth, 1);
        this.part(c, 6, -6, 12, 12, 15, pose.kick + .2, .1);
        this.part(c, 7, 6, 12, 12, 15, -pose.kick - .2, .1);
        this.arm(c, -1, pose.leftArm);
        this.arm(c, 1, pose.rightArm);
        this.part(c, 3, 0, 3, 29, 24, Math.sin(time * 3.1) * .025);
        this.part(c, 11, 0, -6, 5, 5);
        let head = rear ? 2 : Math.abs(Math.sin(pose.yaw)) > .55 ? 1 : 0;
        if (head === 0 && pose.expression)
            head = 11 + pose.expression;
        if (head === 1 && pose.expression === 3)
            head = 15;
        c.save();
        if ((head === 1 || head === 15) && Math.sin(pose.yaw) < 0)
            c.scale(-1, 1);
        this.part(c, head, 0, -22, 59, 50, Math.sin(time * 1.9) * .035 - pose.roll * .18 - pose.gaze * .025);
        c.restore();
        c.restore();
        if (rear)
            drawCape();
        c.restore();
    }
}
