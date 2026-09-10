import type { SoundLayer, SoundLayerId } from "@illusion/schema";
import { buildPart, type Voice } from "./generators";
import { RECIPES } from "./recipes";
import { impulseResponse } from "./reverb";
import { Scheduler } from "./scheduler";

interface ActiveLayer {
  gain: GainNode;
  ready: Promise<void>;
  voices: Voice[];
}

const SOUND_LIBRARY_PATH = "/sounds";
/** Gravações são normalizadas para este RMS antes do ganho da camada, para que a paleta soe equilibrada. */
const FILE_TARGET_RMS = 0.08;
const FILE_CROSSFADE_SECONDS = 2.5;
const REVERB_SECONDS = 3.5;
const MASTER_GAIN = 1.0;

/**
 * Mixer de camadas. Cada SoundLayerId vira um conjunto de geradores (ou um loop de arquivo, se existir)
 * com um GainNode próprio e um envio para o reverb compartilhado. Trocar de página só muda os alvos
 * de ganho, com rampa ao longo da transição. O master passa por um compressor para não estourar.
 */
export class Mixer {
  private readonly ctx: AudioContext;
  private readonly scheduler: Scheduler;
  private readonly dry: GainNode;
  private readonly reverbSend: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly layers = new Map<SoundLayerId, ActiveLayer>();

  constructor() {
    this.ctx = new AudioContext();
    this.scheduler = new Scheduler(this.ctx);

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.4;

    // Tom do master: corta o extremo agudo e abaixa a presença. Síntese por ruído cansa o ouvido
    // justamente nessa região; ambiência de fundo não precisa dela.
    const airCut = this.ctx.createBiquadFilter();
    airCut.type = "lowpass";
    airCut.frequency.value = 6500;
    airCut.Q.value = 0.5;
    const presenceShelf = this.ctx.createBiquadFilter();
    presenceShelf.type = "highshelf";
    presenceShelf.frequency.value = 3000;
    presenceShelf.gain.value = -5;

    const master = this.ctx.createGain();
    master.gain.value = MASTER_GAIN;
    compressor.connect(presenceShelf);
    presenceShelf.connect(airCut);
    airCut.connect(master);
    master.connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    master.connect(this.analyser);

    this.dry = this.ctx.createGain();
    this.dry.connect(compressor);

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulseResponse(this.ctx, REVERB_SECONDS, 2.5);
    const reverbReturn = this.ctx.createGain();
    reverbReturn.gain.value = 0.6;
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.connect(convolver);
    convolver.connect(reverbReturn);
    reverbReturn.connect(compressor);
  }

  /** Nível RMS do master (0..1), para diagnóstico. */
  level(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const sample of data) sum += sample * sample;
    return Math.sqrt(sum / data.length);
  }

  activeLayers(): SoundLayerId[] {
    return [...this.layers.keys()];
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  setLayers(target: readonly SoundLayer[], seconds: number): void {
    const wanted = new Map(target.map((layer) => [layer.id, layer.gain]));

    for (const [id, layer] of this.layers) {
      if (!wanted.has(id)) {
        this.ramp(layer.gain, 0, seconds);
        setTimeout(() => this.release(id), (seconds + 1) * 1000);
      }
    }
    for (const [id, gain] of wanted) {
      const layer = this.layers.get(id) ?? this.spawn(id);
      void layer.ready.then(() => this.ramp(layer.gain, gain, seconds));
    }
  }

  private spawn(id: SoundLayerId): ActiveLayer {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const recipe = RECIPES[id];

    const send = this.ctx.createGain();
    send.gain.value = recipe.reverb;
    gain.connect(this.dry);
    gain.connect(send);
    send.connect(this.reverbSend);

    const layer: ActiveLayer = { gain, voices: [], ready: Promise.resolve() };
    layer.ready = this.fetchLibraryBuffer(id)
      .then((buffer) => {
        layer.voices.push(this.startFileLoop(buffer, gain));
      })
      .catch(() => {
        for (const part of recipe.parts) layer.voices.push(buildPart(this.ctx, this.scheduler, part, gain));
      });

    this.layers.set(id, layer);
    return layer;
  }

  /**
   * Loop de gravação sem emenda: duas cópias alternadas com crossfade, começando de um ponto
   * aleatório para camadas iguais em páginas seguidas não soarem sincronizadas.
   */
  private startFileLoop(buffer: AudioBuffer, out: GainNode): Voice {
    const normalize = this.ctx.createGain();
    normalize.gain.value = Math.min(8, Math.max(0.1, FILE_TARGET_RMS / rms(buffer)));
    normalize.connect(out);

    const duration = buffer.duration;
    const fade = Math.min(FILE_CROSSFADE_SECONDS, duration / 4);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const sources = new Set<AudioBufferSourceNode>();

    const schedule = (startAt: number, offset: number) => {
      if (stopped) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, startAt);
      env.gain.linearRampToValueAtTime(1, startAt + fade);
      const length = duration - offset;
      env.gain.setValueAtTime(1, startAt + length - fade);
      env.gain.linearRampToValueAtTime(0, startAt + length);
      source.connect(env);
      env.connect(normalize);
      source.start(startAt, offset);
      source.stop(startAt + length + 0.05);
      sources.add(source);
      source.onended = () => sources.delete(source);

      const nextStart = startAt + length - fade;
      timer = setTimeout(() => schedule(nextStart, 0), Math.max(0, (nextStart - this.ctx.currentTime - 0.5) * 1000));
    };
    schedule(this.ctx.currentTime, Math.random() * Math.max(0, duration - fade * 2));

    return {
      stop() {
        stopped = true;
        clearTimeout(timer);
        for (const source of sources) source.stop();
        normalize.disconnect();
      },
    };
  }

  /** Só libera se a camada continuar indesejada; a página pode ter voltado a pedi-la durante o fade. */
  private release(id: SoundLayerId): void {
    const layer = this.layers.get(id);
    if (!layer || layer.gain.gain.value > 0.001) return;
    for (const voice of layer.voices) voice.stop();
    layer.gain.disconnect();
    this.layers.delete(id);
  }

  private ramp(node: GainNode, target: number, seconds: number): void {
    const now = this.ctx.currentTime;
    const gain = node.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + Math.max(seconds, 0.05));
  }

  private async fetchLibraryBuffer(id: SoundLayerId): Promise<AudioBuffer> {
    const response = await fetch(`${SOUND_LIBRARY_PATH}/${id}.ogg`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("audio/")) {
      throw new Error(`sem arquivo para ${id}`);
    }
    return this.ctx.decodeAudioData(await response.arrayBuffer());
  }
}

function rms(buffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i]! * data[i]!;
      count++;
    }
  }
  return count === 0 ? 1 : Math.sqrt(sum / count) || 1e-4;
}
