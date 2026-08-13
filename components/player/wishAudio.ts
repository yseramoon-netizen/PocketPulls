"use client";

export type WishAudioSession = {
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
};

export type WishAudioTimeline = {
  impactAtMs: number;
  revealAtMs: number;
  mode?: "journey" | "cosmic";
  travelWindows?: readonly {
    startAtMs: number;
    durationMs: number;
    intensity: number;
  }[];
};

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (sharedAudioContext) {
    return sharedAudioContext;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as BrowserWindow).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

export async function primeWishAudio(): Promise<void> {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }
}

export function startWishAudio(
  tier: number,
  muted: boolean,
  volume = 72,
  timeline: WishAudioTimeline = {
    impactAtMs: 4550,
    revealAtMs: 5120,
  },
): WishAudioSession | null {
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return null;
  }

  const safeTier = Math.max(1, Math.min(8, Math.floor(tier)));
  const startedAt = context.currentTime + 0.045;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  let currentMuted = muted;
  let preferredGain = 0.72 * Math.max(0, Math.min(100, volume)) / 100;

  compressor.threshold.value = -17;
  compressor.knee.value = 16;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.22;

  master.gain.setValueAtTime(currentMuted ? 0 : preferredGain, startedAt);
  master.connect(compressor);
  compressor.connect(context.destination);

  const sources: AudioScheduledSourceNode[] = [];
  let stopped = false;
  const impactAtSeconds = Math.max(0.24, timeline.impactAtMs / 1000);
  const revealAtSeconds = Math.max(
    impactAtSeconds + 0.08,
    timeline.revealAtMs / 1000,
  );
  const flightStartsAt = Math.min(0.62, Math.max(0.1, impactAtSeconds - 1.15));
  const flightDuration = Math.max(
    0.24,
    impactAtSeconds - flightStartsAt - 0.06,
  );
  const awakeningAt = Math.max(0.95, impactAtSeconds - 1.28);
  const travelWindows = timeline.travelWindows || [];

  if (timeline.mode === "cosmic") {
    scheduleCharge(context, master, sources, startedAt, Math.max(6, safeTier));
    scheduleCosmicAscension(
      context,
      master,
      sources,
      startedAt + 0.72,
      Math.max(1.8, impactAtSeconds - 1.15),
    );
    scheduleAwakening(
      context,
      master,
      sources,
      startedAt + awakeningAt,
      8,
    );
  } else if (safeTier <= 2 && travelWindows.length === 0) {
    scheduleQuickReveal(
      context,
      master,
      sources,
      startedAt + Math.max(0.04, impactAtSeconds - 0.22),
      safeTier,
    );
  } else {
    scheduleCharge(context, master, sources, startedAt, safeTier);
    if (travelWindows.length > 0) {
      for (const window of travelWindows) {
        const windowTier = Math.max(1, Math.min(8, Math.round(window.intensity)));
        const windowStart = startedAt + Math.max(0, window.startAtMs / 1000);
        const windowDuration = Math.max(0.48, window.durationMs / 1000);
        scheduleFlight(
          context,
          master,
          sources,
          windowStart,
          windowTier,
          windowDuration,
        );
        scheduleDestinationTone(
          context,
          master,
          sources,
          windowStart + windowDuration,
          windowTier,
        );
      }
    } else {
      scheduleFlight(
        context,
        master,
        sources,
        startedAt + flightStartsAt,
        safeTier,
        Math.min(3.2, flightDuration),
      );
    }
    scheduleAwakening(
      context,
      master,
      sources,
      startedAt + awakeningAt,
      safeTier,
    );
  }
  scheduleImpact(
    context,
    master,
    sources,
    startedAt + impactAtSeconds,
    safeTier,
  );
  scheduleReveal(
    context,
    master,
    sources,
    startedAt + revealAtSeconds,
    safeTier,
  );

  return {
    setMuted(nextMuted: boolean) {
      if (stopped) {
        return;
      }

      currentMuted = nextMuted;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(
        currentMuted ? 0 : preferredGain,
        now,
        0.025,
      );
    },

    setVolume(nextVolume: number) {
      if (stopped) {
        return;
      }

      preferredGain =
        0.72 * Math.max(0, Math.min(100, Number(nextVolume) || 0)) / 100;

      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(
        currentMuted ? 0 : preferredGain,
        now,
        0.025,
      );
    },

    stop() {
      if (stopped) {
        return;
      }

      stopped = true;

      const now = context.currentTime;

      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(
        Math.max(0.0001, master.gain.value),
        now,
      );
      master.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.055,
      );

      for (const source of sources) {
        try {
          source.stop(now + 0.065);
        } catch {
          // A source may already have stopped.
        }
      }

      window.setTimeout(() => {
        try {
          master.disconnect();
          compressor.disconnect();
        } catch {
          // The graph may already be disconnected.
        }
      }, 120);
    },
  };
}

function scheduleDestinationTone(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  playTone(context, destination, sources, {
    start,
    frequency: 420 + tier * 42,
    endFrequency: 760 + tier * 68,
    duration: 0.72,
    volume: 0.018 + tier * 0.0025,
    type: "sine",
    attack: 0.012,
  });
  playTone(context, destination, sources, {
    start: start + 0.04,
    frequency: 630 + tier * 31,
    endFrequency: 1030 + tier * 54,
    duration: 0.58,
    volume: 0.012 + tier * 0.0016,
    type: "triangle",
    attack: 0.014,
  });
}

function scheduleCosmicAscension(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  duration: number,
) {
  playAir(context, destination, sources, start, duration, 260, 5200, 0.034);
  playTone(context, destination, sources, {
    start,
    frequency: 174.61,
    endFrequency: 1396.91,
    duration,
    volume: 0.024,
    type: "sine",
    attack: 0.42,
  });
  playTone(context, destination, sources, {
    start: start + 0.36,
    frequency: 261.63,
    endFrequency: 2093,
    duration: Math.max(0.8, duration - 0.32),
    volume: 0.016,
    type: "triangle",
    attack: 0.62,
  });
}

function scheduleQuickReveal(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  playTone(context, destination, sources, {
    start,
    frequency: 520 + tier * 55,
    endFrequency: 760 + tier * 80,
    duration: 0.3 + tier * 0.08,
    volume: 0.018 + tier * 0.004,
    type: "sine",
    attack: 0.012,
  });
}

function scheduleCharge(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  const pitchLift = tier * 7;

  playTone(
    context,
    destination,
    sources,
    {
      start: start + 0.08,
      frequency: 523.25 + pitchLift,
      endFrequency: 535 + pitchLift,
      duration: 0.62,
      volume: 0.035,
      type: "sine",
    },
  );

  playTone(
    context,
    destination,
    sources,
    {
      start: start + 0.34,
      frequency: 659.25 + pitchLift,
      endFrequency: 680 + pitchLift,
      duration: 0.7,
      volume: 0.03,
      type: "triangle",
    },
  );

  playTone(
    context,
    destination,
    sources,
    {
      start: start + 0.68,
      frequency: 783.99 + pitchLift,
      endFrequency: 825 + pitchLift,
      duration: 0.78,
      volume: 0.035 + tier * 0.0018,
      type: "sine",
    },
  );

  playAir(
    context,
    destination,
    sources,
    start + 0.05,
    1.3,
    850,
    2250 + tier * 120,
    0.008 + tier * 0.001,
  );
}

function scheduleFlight(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
  duration: number,
) {
  playAir(
    context,
    destination,
    sources,
    start,
    duration,
    180,
    3400 + tier * 220,
    0.035 + tier * 0.004,
  );

  playTone(
    context,
    destination,
    sources,
    {
      start,
      frequency: 150 + tier * 4,
      endFrequency: 455 + tier * 17,
      duration,
      volume: 0.018 + tier * 0.002,
      type: "sine",
      attack: 0.35,
    },
  );

  playTone(
    context,
    destination,
    sources,
    {
      start: start + 0.18,
      frequency: 295 + tier * 6,
      endFrequency: 880 + tier * 24,
      duration: duration - 0.16,
      volume: 0.012 + tier * 0.0015,
      type: "triangle",
      attack: 0.48,
    },
  );
}

function scheduleAwakening(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  const pulseCount = tier >= 7 ? 5 : tier >= 5 ? 4 : tier >= 3 ? 3 : 2;
  const base = 690 + tier * 28;

  for (let index = 0; index < pulseCount; index += 1) {
    playTone(
      context,
      destination,
      sources,
      {
        start: start + index * 0.18,
        frequency: base + index * (105 + tier * 3),
        endFrequency: base + 90 + index * (130 + tier * 4),
        duration: 0.55,
        volume: 0.026 + tier * 0.0024,
        type: index % 2 === 0 ? "sine" : "triangle",
        attack: 0.02,
      },
    );
  }

  if (tier >= 5) {
    playSparkles(
      context,
      destination,
      sources,
      start + 0.3,
      Math.min(5, tier - 2),
      tier,
      0.12,
    );
  }
}

function scheduleImpact(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  const impactVolume = tier <= 2
    ? 0.018 + tier * 0.006
    : 0.05 + tier * 0.01;

  playTone(
    context,
    destination,
    sources,
    {
      start,
      frequency: 125 + tier * 4,
      endFrequency: 34,
      duration: 0.82,
      volume: impactVolume,
      type: "sine",
      attack: 0.005,
    },
  );

  playTone(
    context,
    destination,
    sources,
    {
      start: start + 0.012,
      frequency: 72 + tier * 2,
      endFrequency: 28,
      duration: 1.02,
      volume: 0.035 + tier * 0.008,
      type: "triangle",
      attack: 0.005,
    },
  );

  playNoiseHit(
    context,
    destination,
    sources,
    start,
    0.92,
    2450 + tier * 320,
    tier <= 2 ? 0.014 + tier * 0.004 : 0.038 + tier * 0.009,
  );

  if (tier >= 4) {
    playNoiseHit(
      context,
      destination,
      sources,
      start + 0.075,
      0.7,
      4200 + tier * 260,
      0.025 + tier * 0.006,
    );
  }

  if (tier >= 6) {
    playTone(
      context,
      destination,
      sources,
      {
        start: start + 0.035,
        frequency: 1850 + tier * 80,
        endFrequency: 520,
        duration: 0.62,
        volume: 0.022 + tier * 0.002,
        type: "sawtooth",
        attack: 0.004,
      },
    );
  }
}

function scheduleReveal(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  tier: number,
) {
  const pitchLift = tier * 7;

  const notes =
    tier >= 7
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
      : tier >= 5
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
        : tier >= 3
          ? [523.25, 659.25, 783.99, 1046.5]
          : [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    playTone(
      context,
      destination,
      sources,
      {
        start: start + index * 0.075,
        frequency: frequency + pitchLift,
        endFrequency: frequency + pitchLift + 8,
        duration: 1.45 + tier * 0.065,
        volume: 0.027 + tier * 0.0026,
        type: index % 2 === 0 ? "sine" : "triangle",
        attack: 0.018,
      },
    );
  });

  if (tier >= 3) {
    playSparkles(
      context,
      destination,
      sources,
      start + 0.28,
      Math.min(7, tier),
      tier,
      0.095,
    );
  }

  if (tier >= 7) {
    playTone(
      context,
      destination,
      sources,
      {
        start: start + 0.2,
        frequency: 261.63,
        endFrequency: 263,
        duration: 2.2,
        volume: 0.022,
        type: "sine",
        attack: 0.08,
      },
    );
  }
}

function playSparkles(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  count: number,
  tier: number,
  spacing: number,
) {
  const frequencies = [
    1318.51,
    1567.98,
    2093,
    2637.02,
    3135.96,
    4186.01,
    5274.04,
  ];

  for (let index = 0; index < count; index += 1) {
    const frequency =
      frequencies[index % frequencies.length] + tier * 10;

    playTone(
      context,
      destination,
      sources,
      {
        start: start + index * spacing,
        frequency,
        endFrequency: frequency + 18,
        duration: 0.74,
        volume: 0.014 + tier * 0.0018,
        type: "sine",
        attack: 0.01,
      },
    );
  }
}

type ToneOptions = {
  start: number;
  frequency: number;
  endFrequency: number;
  duration: number;
  volume: number;
  type: OscillatorType;
  attack?: number;
};

function playTone(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  options: ToneOptions,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  const attack = Math.max(0.004, options.attack ?? 0.035);
  const end = options.start + options.duration;

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(
    Math.max(20, options.frequency),
    options.start,
  );
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, options.endFrequency),
    end,
  );

  gain.gain.setValueAtTime(0.0001, options.start);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, options.volume),
    options.start + attack,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(destination);

  oscillator.start(options.start);
  oscillator.stop(end + 0.03);

  sources.push(oscillator);
}

function playAir(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  duration: number,
  startFrequency: number,
  endFrequency: number,
  volume: number,
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, duration + 0.08);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(startFrequency, start);
  filter.frequency.exponentialRampToValueAtTime(
    endFrequency,
    start + duration,
  );
  filter.Q.value = 0.72;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, volume),
    start + Math.min(0.4, duration * 0.32),
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration,
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  source.start(start);
  source.stop(start + duration + 0.04);

  sources.push(source);
}

function playNoiseHit(
  context: AudioContext,
  destination: AudioNode,
  sources: AudioScheduledSourceNode[],
  start: number,
  duration: number,
  cutoff: number,
  volume: number,
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, duration + 0.05);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, start);
  filter.frequency.exponentialRampToValueAtTime(
    140,
    start + duration,
  );

  gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration,
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  source.start(start);
  source.stop(start + duration + 0.03);

  sources.push(source);
}

function createNoiseBuffer(
  context: AudioContext,
  duration: number,
): AudioBuffer {
  const length = Math.max(
    1,
    Math.floor(context.sampleRate * duration),
  );

  const buffer = context.createBuffer(
    1,
    length,
    context.sampleRate,
  );

  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const envelope = 1 - index / length;
    data[index] =
      (Math.random() * 2 - 1) *
      Math.pow(envelope, 0.72);
  }

  return buffer;
}
