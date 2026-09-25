/** Original, gesture-unlocked instrument. No downloads, autoplay or looping music. */
export class AstraAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private voices = new Set<OscillatorNode>();
  private pull: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  private enabled = false;
  private volume = .5;

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume / 100));
    if (this.context && this.master) this.master.gain.setTargetAtTime(enabled ? this.volume * .23 : 0, this.context.currentTime, .04);
    if (!enabled) this.stopPull();
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        const c = this.context = new Constructor();
        const master = this.master = c.createGain();
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.ratio.value = 6;
        master.gain.value = this.volume * .23; master.connect(limiter); limiter.connect(c.destination);
        const reverb = c.createConvolver(), impulse = c.createBuffer(2, Math.floor(c.sampleRate * 1.6), c.sampleRate);
        let seed = 73;
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          for (let i = 0; i < data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 4294967296 * 2 - 1) * Math.pow(1 - i / data.length, 3) * .32; }
        }
        reverb.buffer = impulse; this.wet = c.createGain(); this.wet.gain.value = .3;
        this.wet.connect(reverb); reverb.connect(master);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound is optional; every action retains visible feedback. */ }
  }
  private tone(frequency: number, delay = 0, length = .6, level = .25, type: OscillatorType = 'sine') {
    const c = this.context, master = this.master;
    if (!this.enabled || !c || !master || c.state !== 'running' || this.voices.size >= 24) return;
    const o = c.createOscillator(), g = c.createGain(), at = c.currentTime + delay;
    o.type = type; o.frequency.value = frequency;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + .018); g.gain.exponentialRampToValueAtTime(.0001, at + length);
    o.connect(g); g.connect(master); if (this.wet) g.connect(this.wet);
    this.voices.add(o); o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
    o.start(at); o.stop(at + length + .03);
  }
  cue(name: 'portal' | 'menu' | 'magic' | 'release' | 'reveal' | 'place' | 'rest', tier = 1) {
    this.unlock();
    const notes = { portal: [523.25, 783.99, 1046.5], menu: [659.25, 987.77], magic: [523.25, 659.25, 783.99, 1046.5], release: [130.81, 261.63, 523.25], reveal: [261.63, 392, 523.25, 659.25, 1046.5], place: [783.99, 1046.5, 1567.98], rest: [329.63, 261.63] }[name];
    notes.forEach((note, index) => this.tone(note * (name === 'reveal' ? 1 + Math.min(tier, 9) * .008 : 1), index * (name === 'magic' ? .16 : .085), name === 'reveal' ? 1.8 : .8, name === 'reveal' ? .18 : .16));
  }
  tension(amount: number) {
    this.unlock(); const c = this.context;
    if (!this.enabled || !c || !this.master || c.state !== 'running') return;
    if (!this.pull) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; g.gain.value = 0;
      o.connect(g); g.connect(this.master); o.start(); this.pull = { oscillator: o, gain: g };
    }
    this.pull.oscillator.frequency.setTargetAtTime(180 + Math.min(1, amount) * 460, c.currentTime, .045);
    this.pull.gain.gain.setTargetAtTime(.03 + Math.min(1, amount) * .085, c.currentTime, .04);
  }
  stopPull() {
    if (!this.pull || !this.context) return;
    const p = this.pull; this.pull = null;
    p.gain.gain.setTargetAtTime(0, this.context.currentTime, .025); p.oscillator.stop(this.context.currentTime + .15);
    p.oscillator.onended = () => { p.oscillator.disconnect(); p.gain.disconnect(); };
  }
  hush() {
    this.stopPull();
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }
  dispose() { this.hush(); void this.context?.close().catch(() => {}); this.context = null; }
}
