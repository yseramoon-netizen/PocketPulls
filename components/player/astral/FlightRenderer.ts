import { paintObservatorySky } from "../observatory/SkyArt";
import { AstraRig } from './AstraRig';
import { sampleArrival, sampleFlight, visibleOptions, ascentDistance, type ArrivalTarget, type FlightFrame } from './flight';
import { clamp, curve, ease, lerp, smooth, type AstralOptions } from './timeline';
const TAU = Math.PI * 2, fract = (n: number) => n - Math.floor(n), random = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453), NEUTRAL = '#cce9ff';
export class FlightRenderer {
    readonly context: CanvasRenderingContext2D;
    private rig: AstraRig;
    private width = 1;
    private height = 1;
    private unit = 1;
    private dpr = 1;
    private background: HTMLCanvasElement;
    private glows = new Map<string, HTMLCanvasElement>();
    private particles = Array.from({ length: 650 }, (_, i) => ({ x: random(i * 3), y: random(i * 3 + 1), z: random(i * 3 + 2), phase: random(i + 789) * TAU }));
    constructor(private canvas: HTMLCanvasElement, image: HTMLImageElement, private low = false) {
        const c = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!c)
            throw Error('Canvas unavailable');
        this.context = c;
        this.rig = new AstraRig(image);
        this.background = document.createElement('canvas');
        this.resize();
    }
    resize(scale = 1) {
        this.width = Math.max(1, this.canvas.clientWidth);
        this.height = Math.max(1, this.canvas.clientHeight);
        this.unit = Math.min(this.width, this.height);
        this.dpr = Math.min(window.devicePixelRatio || 1, this.low ? 1 : 1.65, Math.sqrt(2400000 / (this.width * this.height))) * scale;
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        const bg = this.background;
        bg.width = this.canvas.width;
        bg.height = this.canvas.height;
        const c = bg.getContext('2d')!;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        paintObservatorySky(c,this.width,this.height);
    }
    private glow(colour: string) {
        const cached = this.glows.get(colour);
        if (cached)
            return cached;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const c = canvas.getContext('2d')!, g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, colour);
        g.addColorStop(.04, colour);
        g.addColorStop(.2, colour + '95');
        g.addColorStop(.55, colour + '20');
        g.addColorStop(1, colour + '00');
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
        this.glows.set(colour, canvas);
        return canvas;
    }
    private light(x: number, y: number, r: number, colour: string, alpha = 1) {
        if (alpha <= 0 || r <= 0)
            return;
        const c = this.context;
        c.globalAlpha = clamp(alpha);
        c.drawImage(this.glow(colour), x - r, y - r, r * 2, r * 2);
        c.globalAlpha = 1;
    }
    private star(x: number, y: number, r: number, colour: string, alpha = 1, rotation = 0, blackHole = false) {
        if (r <= 0 || alpha <= 0)
            return;
        const c = this.context;
        c.save();
        c.globalCompositeOperation = 'lighter';
        this.light(x, y, r * 5, colour, alpha * .55);
        c.translate(x, y);
        c.rotate(rotation);
        c.globalAlpha = alpha;
        c.fillStyle = colour;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * .25 : r, xx = Math.cos(a) * rr, yy = Math.sin(a) * rr;
            if (i)
                c.lineTo(xx, yy);
            else
                c.moveTo(xx, yy);
        }
        c.closePath();
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(-r * .08, -r * .25, r * .16, r * .5);
        c.fillRect(-r * .25, -r * .08, r * .5, r * .16);
        if (blackHole) {
            c.globalCompositeOperation = 'source-over';
            c.fillStyle = '#010107';
            c.beginPath();
            c.arc(0, 0, r * .46, 0, TAU);
            c.fill();
            c.strokeStyle = '#f3c9ff';
            c.lineWidth = 1;
            c.beginPath();
            c.ellipse(0, 0, r * .8, r * .22, -.32, 0, TAU);
            c.stroke();
        }
        c.restore();
    }
    private space(time: number, ascent = 0, travel = time * .002) {
        const c = this.context, w = this.width, h = this.height;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        c.globalAlpha = 1;
        c.drawImage(this.background, 0, 0, w, h);
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < (this.low ? 140 : 340); i++) {
            const p = this.particles[i], x = fract(p.x + Math.sin(time * .11 + p.phase) * .001) * w, y = fract(p.y + travel * (p.z + .3)) * h;
            c.globalAlpha = (.18 + p.z * .4) * (.75 + Math.sin(time * .9 + p.phase) * .25);
            c.strokeStyle = '#a7c7e6';
            c.lineWidth = .6 + p.z;
            if (ascent > .1) {
                c.beginPath();
                c.moveTo(x, y);
                c.lineTo(x, y - ascent * (p.z + .2) * h * .16);
                c.stroke();
            }
            else {
                c.fillStyle = '#b8d1e7';
                c.fillRect(x, y, .7 + p.z, .7 + p.z);
            }
        }
        c.restore();
    }
    private trail(ms: number, count: number, fade: number) {
        if (fade < .002)
            return;
        const c = this.context;
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 32; i++) {
            const a = sampleFlight(ms - i * 27, count).pose, b = sampleFlight(ms - (i + 1) * 27, count).pose;
            c.globalAlpha = (1 - i / 32) * .24 * fade;
            c.lineWidth = (1 - i / 32) * this.unit * .005 + .3;
            c.strokeStyle = i % 3 ? '#b8d9ef' : '#f8d894';
            c.beginPath();
            c.moveTo(a.x * this.width, a.y * this.height);
            c.lineTo(b.x * this.width, b.y * this.height);
            c.stroke();
            if(!this.low){
                const offset=Math.sin(ms*.002-i*.21)*this.unit*.012*(1-i/32);
                c.globalAlpha=(1-i/32)*.12*fade;c.lineWidth=.75;c.strokeStyle='#f4ddb0';
                c.beginPath();c.moveTo(a.x*this.width+offset,a.y*this.height-offset*.5);c.lineTo(b.x*this.width+offset,b.y*this.height-offset*.5);c.stroke();
                if(i%3===0){this.star(a.x*this.width+offset*2,a.y*this.height-offset*1.7,1.2,'#cde7f6',(1-i/32)*fade*.6,ms*.001);}
            }
        }
        c.restore();
    }
    private magic(s: FlightFrame) {
        const c = this.context, w = this.width, h = this.height, u = this.unit, x = s.seed.x * w, y = s.seed.y * h, cast = s.cast * (1 - smooth(.2, 1, s.reveal));
        if (cast < .01)
            return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        this.light(x, y, u * .25, NEUTRAL, .18 * cast);
        for (let ring = 0; ring < 3; ring++) {
            const r = u * (.11 + ring * .028) * (.55 + cast * .45), a = s.time * (ring % 2 ? .38 : -.28) + ring;
            c.save();
            c.translate(x, y);
            c.rotate(a);
            c.strokeStyle = ring === 1 ? '#e6c48c' : '#8ab7cd';
            c.lineWidth = .7;
            c.globalAlpha = .4 * cast;
            c.beginPath();
            c.ellipse(0, 0, r, r * (.45 + ring * .17), ring * .8, 0, TAU);
            c.stroke();
            for (let n = 0; n < 8; n++) {
                const a = n / 8 * TAU;
                c.save();
                c.translate(Math.cos(a) * r, Math.sin(a) * r * (.45 + ring * .17));
                c.rotate(a);
                c.strokeRect(-2, -2, 4, 4);
                c.restore();
            }
            c.restore();
        }
        for (let i = 0; i < (this.low ? 90 : 180); i++) {
            const p = this.particles[i], travel = fract(s.time * .28 + p.z), r = (1 - travel) * u * .38, a = p.phase + s.time * .56 + travel * 3.5, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .65;
            c.strokeStyle = i % 5 ? '#93c7e3' : '#f4dc9d';
            c.globalAlpha = cast * travel * .66;
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(px, py);
            c.lineTo(px + Math.sin(a) * 6, py - Math.cos(a) * 4);
            c.stroke();
        }
        const size = u * .42 * s.pose.scale * (w / h < .72 ? 1.25 : 1);
        for (const side of [-1, 1]) {
            const a = side < 0 ? s.pose.leftArm : s.pose.rightArm, hx = s.pose.x * w + (side * 14 - Math.sin(a) * 21) / 100 * size, hy = s.pose.y * h + (4 + Math.cos(a) * 21) / 100 * size;
            c.strokeStyle = '#e0d7ad';
            c.globalAlpha = cast * .65;
            c.lineWidth = 1.4;
            c.beginPath();
            c.moveTo(hx, hy);
            c.bezierCurveTo(hx + side * u * .1, hy - u * .1, x + side * u * .12, y + u * .09, x, y);
            c.stroke();
            this.light(hx, hy, u * .045, NEUTRAL, cast * .8);
            this.star(hx, hy, 3.5, '#f6df9b', cast, s.time);
        }
        c.restore();
    }
    private disk(s: FlightFrame, front: boolean) {
        if (s.disk <= 0)
            return;
        const c = this.context, u = this.unit, x = s.pose.x * this.width, y = s.pose.y * this.height + u * .022, radius = u * .37 * s.disk;
        c.save();
        c.translate(x, y);
        c.rotate(-.23);
        c.globalCompositeOperation = 'lighter';
        if (!front) {
            this.light(0, 0, radius * .8, '#92aadc', s.disk * .35);
            c.globalCompositeOperation = 'source-over';
            c.fillStyle = 'rgba(1,3,10,.72)';
            c.beginPath();
            c.ellipse(0, 0, radius * .57, radius * .13, 0, 0, TAU);
            c.fill();
            c.globalCompositeOperation = 'lighter';
        }
        const amount = this.low ? 230 : 480;
        for (let i = 0; i < amount; i++) {
            const a = i / amount * TAU + s.time * .52, r = radius * (.62 + random(i + 1400) * .4);
            if ((Math.sin(a) > 0) !== front)
                continue;
            c.strokeStyle = i % 6 === 0 ? '#b2d9ff' : i % 3 === 0 ? '#f8ecc4' : '#c2a477';
            c.globalAlpha = s.disk * (.35 + random(i + 641) * .6) * (1 - s.reveal * .3);
            c.lineWidth = .7 + random(i + 983) * 1.8;
            c.beginPath();
            c.moveTo(Math.cos(a) * r, Math.sin(a) * r * .26);
            c.lineTo(Math.cos(a + .018) * r, Math.sin(a + .018) * r * .26);
            c.stroke();
        }
        for (let j = 0; j < 5; j++) {
            c.strokeStyle = j % 2 ? '#93a7c5' : '#f7d599';
            c.lineWidth = .55;
            c.globalAlpha = s.disk * .3;
            c.beginPath();
            c.ellipse(0, 0, radius * (.65 + j * .095), radius * (.65 + j * .095) * .26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
            c.stroke();
        }
        for (let j = 0; j < 12; j++) {
            const r = radius * (.6 + j * .007);
            c.strokeStyle = j < 6 ? '#fae1ac' : '#c5cde6';
            c.globalAlpha = s.disk * .055;
            c.lineWidth = 2.5;
            c.beginPath();
            c.ellipse(0, 0, r, r * .26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
            c.stroke();
        }
        c.restore();
    }
    render(ms: number, options: readonly AstralOptions[]): FlightFrame {
        const count = options.length, s = sampleFlight(ms, count), colours = visibleOptions(ms, options), c = this.context, u = this.unit;
        // Keep the ten-wish seed above the crown at every viewport aspect ratio.
        if (count === 10)
            s.seed.y = s.pose.y - (u / this.height) * (this.width / this.height < .72 ? .34 : .28);
        this.space(s.time, s.ascent, s.time * .002 + (count === 10 ? ascentDistance(s.time) * .16 : 0));
        this.trail(ms, count, 1 - s.cast);
        this.disk(s, false);
        this.magic(s);
        if (s.pose.charge > .05) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            this.light(s.pose.x * this.width, s.pose.y * this.height - u * .06, u * .2, NEUTRAL, s.pose.charge * .35);
            c.restore();
        }
        const reflected=colours[0].primary;
        this.rig.draw(c, s.pose, s.time, u * .42 * s.pose.scale * (this.width / this.height < .72 ? 1.25 : 1), this.width, this.height, {colour:reflected,amount:s.reveal*.27+s.pose.charge*.09});
        this.disk(s, true);
        if (count === 10 && s.reveal > 0) {
            const portrait = this.width / this.height < .72, orbit = u * .4 * ease(s.reveal), cy = s.pose.y * this.height - u * .075;
            this.star(s.seed.x * this.width, s.seed.y * this.height, u * .028 * (1 - s.reveal), NEUTRAL, s.seed.opacity * (1 - s.reveal), s.time * .07);
            const nodes = colours.map((o, i) => {
                const a = i / 10 * TAU + s.time * .4;
                return { o, i, z: Math.sin(a), x: this.width * .5 + Math.cos(a) * orbit, y: cy + Math.sin(a) * orbit * (portrait ? 1.02 : .77) };
            }).sort((a, b) => a.z - b.z);
            for (const n of nodes) {
                const m = smooth(n.i * .055, .48 + n.i * .045, s.reveal);
                this.star(lerp(s.seed.x * this.width, n.x, ease(s.reveal)), lerp(s.seed.y * this.height, n.y, ease(s.reveal)), u * (.012 + n.o.tier * .0009) * m * (1 + n.z * .16), n.o.primary, m, s.time * .13, n.o.blackHole);
            }
        }
        else {
            const o = colours[0], r = s.seed.radius * (u / 720) * (1 + s.reveal * (o.tier * .08 + (o.blackHole ? .3 : 0))), x = s.seed.x * this.width, y = s.seed.y * this.height;
            this.star(x, y, r, NEUTRAL, s.seed.opacity * (1 - s.reveal), s.time * .07);
            this.star(x, y, r, o.primary, s.seed.opacity * s.reveal, s.time * .07, o.blackHole);
        }
        if (s.burst > 0) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            const colour = colours[0].primary, p = s.reveal, r = u * (.04 + p * .5);
            this.light(this.width * .5, this.height * s.seed.y, u * .8, colour, s.burst * .36);
            c.globalAlpha = (1 - p) * .6;
            c.strokeStyle = colour;
            c.lineWidth = 1;
            c.beginPath();
            c.ellipse(this.width * .5, this.height * s.seed.y, r, r * .6, -.2, 0, TAU);
            c.stroke();
            for (let i = 0; i < 56; i++) {
                const a = i / 56 * TAU, rr = u * .44 * ease(p);
                c.globalAlpha = (1 - p) * .7;
                c.fillStyle = colour;
                c.fillRect(this.width * .5 + Math.cos(a) * rr, this.height * s.seed.y + Math.sin(a) * rr * .7, 1.6, 1.6);
            }
            c.restore();
        }
        if(s.reveal>0&&!this.low){
            c.save();c.globalCompositeOperation='lighter';
            const age=Math.max(0,s.time-(count===10?11.6:9.6));
            for(let i=0;i<36;i++){
                const p=this.particles[i+380],life=clamp(age/2.7),a=p.phase,rr=u*(.04+life*(.15+p.z*.32));
                if(life>=1)break;
                c.strokeStyle=colours[i%colours.length].primary;c.globalAlpha=(1-life)**2*.65;c.lineWidth=.6+p.z;
                c.beginPath();c.moveTo(this.width*.5+Math.cos(a)*rr,this.height*s.seed.y+Math.sin(a)*rr*.8);
                c.lineTo(this.width*.5+Math.cos(a)*(rr-4-life*12),this.height*s.seed.y+Math.sin(a)*(rr-4-life*12)*.8);c.stroke();
            }
            c.restore();
        }
        return s;
    }
    renderArrival(ms: number, targets: readonly ArrivalTarget[], overlay = false) {
        const a = sampleArrival(ms, targets.length), c = this.context, u = this.unit;
        if (overlay) {
            c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            c.clearRect(0, 0, this.width, this.height);
            c.fillStyle = `rgba(2,5,14,${.86 * (1 - smooth(.1, .7, a.t))})`;
            c.fillRect(0, 0, this.width, this.height);
        }
        else
            this.space(ms / 1000);
        c.save();
        c.globalAlpha = 1 - a.fade;
        if (!overlay) {
            c.strokeStyle = '#56728c';
            c.lineWidth = .6;
            c.globalAlpha = .28;
            for (let i = 1; i < targets.length; i++) {
                c.beginPath();
                c.moveTo(targets[i - 1].x * this.width, targets[i - 1].y * this.height);
                c.lineTo(targets[i].x * this.width, targets[i].y * this.height);
                c.stroke();
            }
            c.globalAlpha = 1 - a.fade;
        }
        this.rig.draw(c, a.pose, ms / 1000, u * .42 * a.pose.scale, this.width, this.height);
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i], p = a.starProgress(i), angle = i / Math.max(1, targets.length) * TAU + ms * .001, sx = a.pose.x + Math.cos(angle) * .085, sy = a.pose.y - .12 + Math.sin(angle) * .055, [x, y] = curve([[sx, sy], [lerp(sx, t.x, .38), Math.min(sy, t.y) - .12], [t.x, t.y]], ease(p));
            if (p > .01 && p < .995) {
                c.save();
                c.globalCompositeOperation = 'lighter';
                c.strokeStyle = t.colour;
                c.globalAlpha = .5;
                c.lineWidth = 1.2;
                c.beginPath();
                c.moveTo(sx * this.width, sy * this.height);
                c.quadraticCurveTo((sx + t.x) * .5 * this.width, (Math.min(sy, t.y) - .12) * this.height, x * this.width, y * this.height);
                c.stroke();
                c.restore();
            }
            this.star(x * this.width, y * this.height, u * lerp(.017, .007, p), t.colour, !overlay && p >= .999 ? 1 : 1 - a.fade, ms * .0002);
            const ring = smooth(.72, 1, p);
            if (ring > 0 && ring < 1) {
                c.strokeStyle = t.colour;
                c.lineWidth = 1;
                c.globalAlpha = (1 - ring) * .75;
                c.beginPath();
                c.arc(t.x * this.width, t.y * this.height, 5 + ring * 30, 0, TAU);
                c.stroke();
                c.globalAlpha = 1;
            }
        }
        c.restore();
        return a;
    }
    dispose() {
        this.glows.clear();
        this.background.width = this.background.height = 1;
    }
}
let rigPromise: Promise<HTMLImageElement | null> | null = null;
export function loadAstraRig(url = '/ancient-pulls/wish/astral/astra-rig.png'): Promise<HTMLImageElement | null> {
    if (rigPromise)
        return rigPromise;
    rigPromise = new Promise(resolve => {
        const image = new Image();
        let done = false;
        const settle = (ok: boolean) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            image.onload = image.onerror = null;
            if (!ok)
                rigPromise = null;
            resolve(ok ? image : null);
        };
        // A mobile connection can need more than five seconds for the atlas.
        const timer = setTimeout(() => settle(false), 15000);
        image.fetchPriority = 'high';
        image.onload = () => settle(true);
        image.onerror = () => settle(false);
        image.src = url;
    });
    return rigPromise;
}
