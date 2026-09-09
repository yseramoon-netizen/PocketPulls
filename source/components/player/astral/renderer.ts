import { cometPosition, sampleAstral, smooth, type AstralFrame, type AstralOptions } from "./timeline";
import * as shader from "./shaders";
type Program = {
    program: WebGLProgram;
    uniform: Record<string, WebGLUniformLocation | null>;
    attribute: Record<string, number>;
};
const DEFAULT_ASSET = "/ancient-pulls/wish/astral/aster.webp";
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadAstralArtwork(url = DEFAULT_ASSET): Promise<HTMLImageElement | null> {
    const cached = imageCache.get(url);
    if (cached)
        return cached;
    const promise = new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        let settled = false;
        const done = (success: boolean) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            image.onload = image.onerror = null;
            resolve(success ? image : null);
            if (!success)
                imageCache.delete(url);
        };
        const timeout = window.setTimeout(() => done(false), 3000);
        image.onload = () => done(true);
        image.onerror = () => done(false);
        image.decoding = "async";
        image.src = url;
    });
    imageCache.set(url, promise);
    return promise;
}
/** Five small GPU programs, one transparent articulated mesh, no render-time React updates. */
export class AstralRenderer {
    private readonly gl: WebGLRenderingContext;
    private readonly programs: Program[] = [];
    private readonly buffers: WebGLBuffer[] = [];
    private readonly space: Program;
    private readonly particles: Program;
    private readonly colour: Program;
    private readonly glow: Program;
    private readonly mascot: Program;
    private readonly quad: WebGLBuffer;
    private readonly stars: WebGLBuffer;
    private readonly geometry: WebGLBuffer;
    private readonly mesh: WebGLBuffer;
    private readonly texture: WebGLTexture;
    private readonly vertices = new Float32Array(180000);
    private cursor = 0;
    private starCount: number;
    private meshCount = 0;
    private aspect = 1;
    private dpr = 1;
    private hasTexture = false;
    private holeRadius = 0;
    private disposed = false;
    private lost = false;
    private readonly contextLost: (event: Event) => void;
    private readonly contextRestored: () => void;
    constructor(private readonly canvas: HTMLCanvasElement, artwork: HTMLImageElement | null, lowEffects = false, onLost?: () => void) {
        const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
        if (!gl)
            throw new Error("WebGL is unavailable");
        this.gl = gl;
        this.space = this.program(shader.QUAD_VERTEX, shader.SPACE_FRAGMENT);
        this.particles = this.program(shader.PARTICLE_VERTEX, shader.PARTICLE_FRAGMENT);
        this.colour = this.program(shader.COLOUR_VERTEX, shader.COLOUR_FRAGMENT);
        this.glow = this.program(shader.GLOW_VERTEX, shader.GLOW_FRAGMENT);
        this.mascot = this.program(shader.MASCOT_VERTEX, shader.MASCOT_FRAGMENT);
        this.quad = this.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
        this.starCount = lowEffects ? 420 : 1250;
        const stars = new Float32Array(this.starCount * 6);
        let seed = 19170621;
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < this.starCount; i++)
            stars.set([(random() - .5) * 5.5, (random() - .5) * 3.6, random(), random(), random(), random()], i * 6);
        this.stars = this.buffer(stars);
        this.geometry = this.buffer(this.vertices, gl.DYNAMIC_DRAW);
        const mesh: number[] = [];
        const divisions = 32;
        for (let y = 0; y < divisions; y++)
            for (let x = 0; x < divisions; x++) {
                const x0 = x / divisions, y0 = y / divisions, x1 = (x + 1) / divisions, y1 = (y + 1) / divisions;
                mesh.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
            }
        this.meshCount = mesh.length / 2;
        this.mesh = this.buffer(new Float32Array(mesh));
        const texture = gl.createTexture();
        if (!texture)
            throw new Error("Unable to allocate astral texture");
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (artwork) {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork);
            this.hasTexture = true;
        }
        else
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        this.contextLost = (event) => { event.preventDefault(); this.lost = true; onLost?.(); };
        // The controller offers a still reveal after loss instead of trying to draw with invalid resources.
        this.contextRestored = () => { this.lost = true; onLost?.(); };
        canvas.addEventListener("webglcontextlost", this.contextLost);
        canvas.addEventListener("webglcontextrestored", this.contextRestored);
        this.resize();
    }
    private program(vertex: string, fragment: string): Program {
        const gl = this.gl;
        const compile = (source: string, type: number) => {
            const shader = gl.createShader(type);
            if (!shader)
                throw new Error("Unable to allocate shader");
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const message = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(`Astral shader failed: ${message}`);
            }
            return shader;
        };
        const vs = compile(vertex, gl.VERTEX_SHADER), fs = compile(fragment, gl.FRAGMENT_SHADER);
        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            throw new Error("Unable to allocate program");
        }
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Astral program failed: ${message}`);
        }
        const output: Program = { program, uniform: {}, attribute: {} };
        const names = (vertex + fragment).matchAll(/uniform\s+(?:float|vec\d|sampler2D)\s+([^;]+);/g);
        for (const match of names)
            for (const name of match[1].split(","))
                output.uniform[name.trim()] = gl.getUniformLocation(program, name.trim());
        for (const match of vertex.matchAll(/attribute\s+vec\d\s+(\w+)/g))
            output.attribute[match[1]] = gl.getAttribLocation(program, match[1]);
        this.programs.push(output);
        return output;
    }
    private buffer(data: Float32Array, usage?: number): WebGLBuffer {
        const gl = this.gl, buffer = gl.createBuffer();
        if (!buffer)
            throw new Error("Unable to allocate buffer");
        this.buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
        return buffer;
    }
    private use(program: Program) {
        const gl = this.gl;
        for (let i = 0; i < 3; i++)
            gl.disableVertexAttribArray(i);
        gl.useProgram(program.program);
        gl.uniform1f(program.uniform.u_aspect, this.aspect);
    }
    private attribute(program: Program, name: string, size: number, stride = 0, offset = 0) {
        const location = program.attribute[name];
        if (location == null || location < 0)
            return;
        this.gl.enableVertexAttribArray(location);
        this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, stride, offset);
    }
    resize(resolutionScale = 1) {
        if (this.disposed)
            return;
        const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
        const maximumPixels = 1900000;
        this.dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(maximumPixels / (width * height))) * resolutionScale;
        this.aspect = width / height;
        this.canvas.width = Math.max(1, Math.round(width * this.dpr));
        this.canvas.height = Math.max(1, Math.round(height * this.dpr));
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    private vertex(x: number, y: number, c: readonly number[], alpha: number) {
        const v = this.vertices, i = this.cursor;
        v[i] = x;
        v[i + 1] = y;
        v[i + 2] = c[0];
        v[i + 3] = c[1];
        v[i + 4] = c[2];
        v[i + 5] = alpha;
        this.cursor += 6;
    }
    private segment(x0: number, y0: number, x1: number, y1: number, width: number, c: readonly number[], a0: number, a1 = a0) {
        if (this.cursor + 72 > this.vertices.length || (a0 <= 0 && a1 <= 0))
            return;
        const dx = x1 - x0, dy = y1 - y0, length = Math.sqrt(dx * dx + dy * dy) || 1;
        // Feathered edges preserve clean subpixel curves without a costly multisampled framebuffer.
        const feather = width + 1 / this.canvas.height;
        const nx = -dy / length * feather, ny = dx / length * feather;
        this.vertex(x0 - nx, y0 - ny, c, 0);
        this.vertex(x1 - nx, y1 - ny, c, 0);
        this.vertex(x0, y0, c, a0);
        this.vertex(x0, y0, c, a0);
        this.vertex(x1 - nx, y1 - ny, c, 0);
        this.vertex(x1, y1, c, a1);
        this.vertex(x0, y0, c, a0);
        this.vertex(x1, y1, c, a1);
        this.vertex(x0 + nx, y0 + ny, c, 0);
        this.vertex(x0 + nx, y0 + ny, c, 0);
        this.vertex(x1, y1, c, a1);
        this.vertex(x1 + nx, y1 + ny, c, 0);
    }
    private halo(x: number, y: number, size: number, c: readonly number[], opacity: number, spikes = 0) {
        if (opacity < .001)
            return;
        const gl = this.gl, p = this.glow;
        this.use(p);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        this.attribute(p, "a_position", 2);
        gl.uniform2f(p.uniform.u_center, x, y);
        gl.uniform1f(p.uniform.u_size, size);
        gl.uniform1f(p.uniform.u_opacity, opacity);
        gl.uniform1f(p.uniform.u_spikes, spikes);
        gl.uniform1f(p.uniform.u_hole, this.holeRadius);
        gl.uniform3f(p.uniform.u_colour, c[0], c[1], c[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    render(elapsedMs: number, options: AstralOptions): AstralFrame {
        const f = sampleAstral(elapsedMs, options);
        if (this.disposed || this.lost)
            return f;
        const gl = this.gl, horizontal = Math.min(1, this.aspect * 1.6);
        this.holeRadius = f.horizon * .105 + Math.pow(f.engulf, 3) * 2.1;
        gl.disable(gl.BLEND);
        this.use(this.space);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        this.attribute(this.space, "a_position", 2);
        const su = this.space.uniform;
        gl.uniform2f(su.u_resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(su.u_time, f.time);
        gl.uniform1f(su.u_gather, f.gather);
        gl.uniform1f(su.u_flight, f.flight);
        gl.uniform1f(su.u_horizon, f.horizon);
        gl.uniform1f(su.u_engulf, f.engulf);
        gl.uniform1f(su.u_reveal, f.reveal);
        gl.uniform1f(su.u_impact, f.impact);
        gl.uniform3fv(su.u_primary, f.primary);
        gl.uniform3fv(su.u_secondary, f.secondary);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        this.use(this.particles);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.stars);
        this.attribute(this.particles, "a_position", 3, 24, 0);
        this.attribute(this.particles, "a_seed", 3, 24, 12);
        const pu = this.particles.uniform;
        gl.uniform1f(pu.u_time, f.time);
        gl.uniform1f(pu.u_flight, f.flight);
        gl.uniform1f(pu.u_gather, f.gather);
        gl.uniform1f(pu.u_horizon, f.horizon);
        gl.uniform1f(pu.u_engulf, f.engulf);
        gl.uniform1f(pu.u_reveal, f.reveal);
        gl.uniform1f(pu.u_dpr, this.dpr);
        gl.drawArrays(gl.POINTS, 0, this.starCount);
        const visibility = (1 - smooth(5.7, 6.6, f.time)) * (1 - f.reveal);
        this.cursor = 0;
        // Concentric orbital meridians with real perspective, moving independently of the character.
        for (let orbit = 0; orbit < 3; orbit++) {
            const radius = (.29 + orbit * .105) * (1 - f.gather * .62);
            const tilt = .34 + orbit * .12 + Math.sin(f.time * .21 + orbit) * .055, spin = f.time * (.10 + orbit * .035) + orbit * 1.09;
            for (let i = 0; i < 128; i++) {
                const a = i / 128 * Math.PI * 2 + spin, b = (i + 1) / 128 * Math.PI * 2 + spin;
                const alpha = (.06 + Math.pow(Math.max(0, Math.sin(a - spin)), 7) * .3) * visibility * smooth(0, 1, f.time);
                this.segment(Math.cos(a) * radius * horizontal, Math.sin(a) * radius * tilt + .045, Math.cos(b) * radius * horizontal, Math.sin(b) * radius * tilt + .045, .00045, f.primary, alpha);
            }
        }
        const nodes = CONSTELLATION;
        const contract = 1 - f.gather * .86;
        for (let i = 0; i < EDGES.length; i++) {
            const [from, to] = EDGES[i], a = nodes[from], b = nodes[to], progress = smooth(i * .055, i * .055 + .19, f.trace);
            const ax = a[0] * contract * horizontal, ay = a[1] * contract + .045, bx = (a[0] + (b[0] - a[0]) * progress) * contract * horizontal, by = (a[1] + (b[1] - a[1]) * progress) * contract + .045;
            this.segment(ax, ay, bx, by, .0025, f.primary, visibility * .08);
            this.segment(ax, ay, bx, by, .00055, f.primary, visibility * .43);
        }
        // A ribbon has a luminous center and separate wide, faint wings, rather than a hard neon stroke.
        if (f.flight > 0 && f.comet.opacity > 0) {
            for (let layer = 0; layer < 3; layer++)
                for (let i = 0; i < 100; i++) {
                    const behind = (1 - i / 100) * .27;
                    const progress = Math.max(0, f.flight - behind), next = Math.max(0, f.flight - behind + .0027);
                    const a = cometPosition(progress), b = cometPosition(next);
                    const fade = Math.pow(i / 100, 2.2) * f.comet.opacity;
                    const width = (layer === 0 ? .018 : layer === 1 ? .006 : .0013) * (0.4 + f.flight * 1.4);
                    const col = layer === 0 ? f.secondary : f.primary;
                    this.segment(a[0] * horizontal, a[1], b[0] * horizontal, b[1], width, col, fade * (layer === 0 ? .055 : layer === 1 ? .22 : .95));
                }
        }
        // Starlight stretches into curved filaments as the event horizon consumes the scene.
        if (f.horizon > 0 && f.engulf < .97)
            for (let strand = 0; strand < 32; strand++) {
                const startAngle = strand * 2.399963 + f.time * .09;
                const radius = .20 + (strand % 7) * .082;
                for (let i = 0; i < 28; i++) {
                    const a = i / 28, b = (i + 1) / 28;
                    const ra = radius * (1 - a * .86) * (1 - f.horizon * .30), rb = radius * (1 - b * .86) * (1 - f.horizon * .30);
                    const aa = startAngle + a * a * f.horizon * 3.8, ab = startAngle + b * b * f.horizon * 3.8;
                    const alpha = Math.sin(a * Math.PI) * f.horizon * (1 - f.engulf) * .16;
                    this.segment(Math.cos(aa) * ra, Math.sin(aa) * ra + .06, Math.cos(ab) * rb, Math.sin(ab) * rb + .06, .0005 + f.horizon * .0005, f.primary, alpha * smooth(this.holeRadius, this.holeRadius + .015, ra), alpha * smooth(this.holeRadius, this.holeRadius + .015, rb));
                }
            }
        const impactAge = (elapsedMs - (options.blackHole ? 11200 : 9300)) / 1000;
        if (!options.blackHole && impactAge > 0 && impactAge < 1.8)
            for (let ring = 0; ring < 3; ring++) {
                const age = Math.max(0, impactAge - ring * .14), radius = age * (.40 + ring * .07), alpha = Math.max(0, 1 - age / 1.3) * .3;
                for (let i = 0; i < 160; i++) {
                    const a = i / 160 * Math.PI * 2, b = (i + 1) / 160 * Math.PI * 2;
                    this.segment(Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(b) * radius, Math.sin(b) * radius, .0007, f.primary, alpha);
                }
            }
        if (this.cursor) {
            this.use(this.colour);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.geometry);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices.subarray(0, this.cursor));
            this.attribute(this.colour, "a_position", 2, 24, 0);
            this.attribute(this.colour, "a_colour", 4, 24, 8);
            gl.drawArrays(gl.TRIANGLES, 0, this.cursor / 6);
        }
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i], lit = smooth(i * .037, i * .037 + .16, f.trace) * visibility;
            this.halo(n[0] * contract * horizontal, n[1] * contract + .045, .016 + f.gather * .018, f.primary, lit * .9, 1);
        }
        const m = f.mascot, mascotScale = Math.min(m.scale, this.aspect * .77);
        this.halo(m.x * horizontal, m.y + .015, mascotScale * .48, f.primary, m.opacity * .32 + f.gather * .12 * visibility);
        if (this.hasTexture && m.opacity > .001) {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            const mp = this.mascot, mu = mp.uniform;
            this.use(mp);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh);
            this.attribute(mp, "a_position", 2);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(mu.u_texture, 0);
            gl.uniform2f(mu.u_center, m.x * horizontal, m.y);
            gl.uniform1f(mu.u_time, f.time);
            gl.uniform1f(mu.u_scale, mascotScale);
            gl.uniform1f(mu.u_roll, m.roll);
            gl.uniform1f(mu.u_stretch, m.stretch);
            gl.uniform1f(mu.u_gather, f.gather);
            gl.uniform1f(mu.u_opacity, m.opacity);
            gl.uniform1f(mu.u_colourMix, f.colour);
            gl.uniform3fv(mu.u_colour, f.primary);
            gl.uniform1f(mu.u_hole, this.holeRadius);
            gl.drawArrays(gl.TRIANGLES, 0, this.meshCount);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        }
        // Diamond heart light follows the same deformed character, never an independent sticker.
        const heartOffset = .074 * mascotScale * (1 + m.stretch);
        const heartX = m.x * horizontal - Math.sin(m.roll) * heartOffset;
        const heartY = m.y + Math.cos(m.roll) * heartOffset;
        this.halo(heartX, heartY, .016 + f.gather * .055, f.primary, m.opacity * (.6 + f.gather * .6), 1);
        this.halo(f.comet.x * horizontal, f.comet.y, f.comet.size * 3.7, f.primary, f.comet.opacity * .62, .3);
        this.halo(f.comet.x * horizontal, f.comet.y, f.comet.size, f.primary, f.comet.opacity, 1);
        if (f.impact > 0)
            this.halo(0, 0, .55, f.primary, f.impact * .7, .5);
        return f;
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.canvas.removeEventListener("webglcontextlost", this.contextLost);
        this.canvas.removeEventListener("webglcontextrestored", this.contextRestored);
        for (const buffer of this.buffers)
            this.gl.deleteBuffer(buffer);
        for (const program of this.programs)
            this.gl.deleteProgram(program.program);
        this.gl.deleteTexture(this.texture);
    }
}
const CONSTELLATION: readonly (readonly [
    number,
    number
])[] = [[0, .30], [-.15, .15], [-.39, .19], [-.27, -.045], [-.14, -.13], [0, -.21], [.14, -.13], [.27, -.045], [.39, .19], [.15, .15], [0, .065], [0, -.045]];
const EDGES: readonly (readonly [
    number,
    number
])[] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [1, 10], [9, 10], [10, 11], [11, 4], [11, 6]];
