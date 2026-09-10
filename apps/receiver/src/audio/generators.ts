import { noiseBuffer, type NoiseColor } from "./noise";
import { randomIn, type Range, type Scheduler } from "./scheduler";

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  q?: number;
}

/** Passeio aleatório suave de um parâmetro: a cada `every` segundos rampa para um novo valor em [min, max]. */
export interface Walk {
  min: number;
  max: number;
  every: Range;
}

export interface NoisePart {
  kind: "noise";
  color: NoiseColor;
  gain: number;
  filter?: FilterSpec;
  filter2?: FilterSpec;
  /** Frequência do primeiro filtro, em Hz. */
  drift?: Walk;
  /** Multiplicador do ganho. */
  swell?: Walk;
}

export interface DronePart {
  kind: "drone";
  wave: OscillatorType;
  freqs: number[];
  gain: number;
  voices?: number;
  /** Cents entre vozes. */
  detune?: number;
  cutoff: number;
  lfo?: { rate: number; depth: number };
}

export type EventSound = "drip" | "crackle" | "chirp" | "drum" | "bell" | "tick" | "pluck" | "whoosh";

export interface EventsPart {
  kind: "events";
  sound: EventSound;
  gap: Range;
  freq: Range;
  decay: number;
  gain: number;
  /** Abertura do pan aleatório, 0 a 1. */
  spread?: number;
  /** chirp/whoosh: variação relativa de frequência ao longo do evento (0.4 sobe 40%, -0.3 desce 30%). */
  sweep?: number;
  wave?: OscillatorType;
  filter?: FilterSpec;
  /** Repetições por disparo. */
  burst?: Range;
  burstGap?: number;
  /** Offsets fixos em segundos (padrões rítmicos). Sobrepõe burst. */
  pattern?: number[];
  /** Multiplicadores de frequência sorteados a cada evento (escala musical). */
  scale?: number[];
}

export type Part = NoisePart | DronePart | EventsPart;

export interface LayerRecipe {
  /** Quanto da camada vai para o reverb, 0 a 1. */
  reverb: number;
  parts: Part[];
}

export interface Voice {
  stop(): void;
}

export function buildPart(ctx: AudioContext, scheduler: Scheduler, part: Part, out: AudioNode): Voice {
  switch (part.kind) {
    case "noise":
      return buildNoise(ctx, scheduler, part, out);
    case "drone":
      return buildDrone(ctx, part, out);
    case "events":
      return buildEvents(ctx, scheduler, part, out);
  }
}

function makeFilter(ctx: AudioContext, spec: FilterSpec): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.value = spec.freq;
  filter.Q.value = spec.q ?? 1;
  return filter;
}

function walk(ctx: AudioContext, scheduler: Scheduler, param: AudioParam, spec: Walk, scale = 1): () => void {
  param.setValueAtTime(param.value, ctx.currentTime);
  return scheduler.add(spec.every, (time) => {
    const gap = randomIn(spec.every);
    param.linearRampToValueAtTime(scale * randomIn([spec.min, spec.max]), time + gap);
    return gap;
  });
}

function buildNoise(ctx: AudioContext, scheduler: Scheduler, part: NoisePart, out: AudioNode): Voice {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, part.color);
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = part.gain;

  let head: AudioNode = source;
  let first: BiquadFilterNode | undefined;
  if (part.filter) {
    first = makeFilter(ctx, part.filter);
    head.connect(first);
    head = first;
  }
  if (part.filter2) {
    const second = makeFilter(ctx, part.filter2);
    head.connect(second);
    head = second;
  }
  head.connect(gain);
  gain.connect(out);
  source.start(0, Math.random() * 5);

  const cancels: Array<() => void> = [];
  if (part.drift && first) cancels.push(walk(ctx, scheduler, first.frequency, part.drift));
  if (part.swell) cancels.push(walk(ctx, scheduler, gain.gain, part.swell, part.gain));

  return {
    stop() {
      for (const cancel of cancels) cancel();
      source.stop();
      gain.disconnect();
    },
  };
}

function buildDrone(ctx: AudioContext, part: DronePart, out: AudioNode): Voice {
  const voices = part.voices ?? 1;
  const detune = part.detune ?? 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = part.cutoff;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.value = part.gain / (part.freqs.length * voices);
  filter.connect(gain);
  gain.connect(out);

  const oscillators: OscillatorNode[] = [];
  for (const freq of part.freqs) {
    for (let v = 0; v < voices; v++) {
      const osc = ctx.createOscillator();
      osc.type = part.wave;
      osc.frequency.value = freq;
      osc.detune.value = (v - (voices - 1) / 2) * detune;
      osc.connect(filter);
      osc.start(0);
      oscillators.push(osc);
    }
  }

  if (part.lfo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = part.lfo.rate;
    const depth = ctx.createGain();
    depth.gain.value = part.lfo.depth;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    lfo.start(0);
    oscillators.push(lfo);
  }

  return {
    stop() {
      for (const osc of oscillators) osc.stop();
      gain.disconnect();
    },
  };
}

function buildEvents(ctx: AudioContext, scheduler: Scheduler, part: EventsPart, out: AudioNode): Voice {
  const cancel = scheduler.add(part.gap, (time) => {
    const count = part.burst ? Math.round(randomIn(part.burst)) : 1;
    const offsets = part.pattern ?? Array.from({ length: count }, (_, i) => i * (part.burstGap ?? 0.05));
    const scale = part.scale ? part.scale[Math.floor(Math.random() * part.scale.length)]! : 1;
    const freq = randomIn(part.freq) * scale;
    for (const offset of offsets) playEvent(ctx, part, out, time + offset, freq);
    return undefined;
  });
  return { stop: cancel };
}

function playEvent(ctx: AudioContext, part: EventsPart, out: AudioNode, time: number, freq: number): void {
  const env = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = (Math.random() * 2 - 1) * (part.spread ?? 0.4);
  env.connect(panner);
  panner.connect(out);

  let tail: AudioNode = env;
  if (part.filter) {
    const filter = makeFilter(ctx, part.filter);
    filter.connect(env);
    tail = filter;
  }

  const stopAt = (end: number, ...sources: AudioScheduledSourceNode[]) => {
    for (const source of sources) source.stop(end + 0.05);
  };
  const envelope = (attack: number, decay: number, peak: number) => {
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    return time + attack + decay;
  };

  /**
   * Ruído branco por um filtro ressonante cuja frequência varre. É o que dá caráter físico
   * (gota, assobio, grito de gaivota) em vez do "bip" de senoide pura, que soa a videogame.
   */
  const resonantNoise = (fromHz: number, toHz: number, q: number, duration: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, "white");
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.setValueAtTime(fromHz, time);
    band.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), time + duration);
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = Math.min(6000, fromHz * 2.5);
    source.connect(band);
    band.connect(soften);
    soften.connect(tail);
    source.start(time, Math.random() * 5, duration + 0.1);
  };

  switch (part.sound) {
    case "drip": {
      resonantNoise(freq, freq * 0.6, 12, part.decay + 0.02);
      envelope(0.002, part.decay, part.gain * 1.6);
      return;
    }
    case "crackle": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, "white");
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = 1.5;
      source.connect(band);
      band.connect(tail);
      source.start(time, Math.random() * 5, part.decay + 0.05);
      envelope(0.001, part.decay, part.gain);
      return;
    }
    case "chirp": {
      // Assobio: ruído com ressonância alta. Q menor em graves (vozes, rangidos) para não virar apito.
      const q = freq > 1500 ? 18 : 6;
      resonantNoise(freq, freq * (1 + (part.sweep ?? 0)), q, part.decay + 0.03);
      envelope(0.015, part.decay, part.gain * 2.2);
      return;
    }
    case "drum": {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq * 2.5, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + 0.06);
      osc.connect(tail);
      osc.start(time);
      const thump = ctx.createBufferSource();
      thump.buffer = noiseBuffer(ctx, "white");
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 600;
      thump.connect(low);
      low.connect(tail);
      thump.start(time, Math.random() * 5, 0.03);
      stopAt(envelope(0.002, part.decay, part.gain), osc);
      return;
    }
    case "bell": {
      const partials = [1, 2.0, 2.98, 4.2, 5.4];
      const levels = [1, 0.6, 0.4, 0.25, 0.15];
      const decays = [1, 0.7, 0.5, 0.4, 0.3];
      const end = envelope(0.002, part.decay, part.gain);
      const warm = ctx.createBiquadFilter();
      warm.type = "lowpass";
      warm.frequency.value = 3500;
      warm.connect(tail);
      for (const [i, ratio] of partials.entries()) {
        const osc = ctx.createOscillator();
        // leve desafinação por parcial: metal real não é harmônico perfeito
        osc.frequency.value = freq * ratio * (1 + (Math.random() - 0.5) * 0.006);
        const level = ctx.createGain();
        level.gain.setValueAtTime(levels[i]!, time);
        level.gain.exponentialRampToValueAtTime(0.0001, time + part.decay * decays[i]!);
        osc.connect(level);
        level.connect(warm);
        osc.start(time);
        osc.stop(end + 0.05);
      }
      return;
    }
    case "tick": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, "white");
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = 6;
      source.connect(band);
      band.connect(tail);
      source.start(time, Math.random() * 5, 0.004);
      envelope(0.001, part.decay, part.gain);
      return;
    }
    case "pluck": {
      const osc = ctx.createOscillator();
      osc.type = part.wave ?? "triangle";
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004);
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.setValueAtTime(freq * 3, time);
      low.frequency.exponentialRampToValueAtTime(freq * 1.2, time + part.decay);
      osc.connect(low);
      low.connect(tail);
      osc.start(time);
      stopAt(envelope(0.003, part.decay, part.gain), osc);
      return;
    }
    case "whoosh": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, "pink");
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.5;
      band.frequency.setValueAtTime(freq, time);
      band.frequency.linearRampToValueAtTime(freq * (1 + (part.sweep ?? 0)), time + part.decay);
      source.connect(band);
      band.connect(tail);
      source.start(time, Math.random() * 5, part.decay + 0.1);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(part.gain, time + part.decay * 0.4);
      env.gain.exponentialRampToValueAtTime(0.0001, time + part.decay);
      return;
    }
  }
}
