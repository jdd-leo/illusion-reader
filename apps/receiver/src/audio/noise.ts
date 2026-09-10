export type NoiseColor = "white" | "pink" | "brown";

const NOISE_SECONDS = 12;
const CROSSFADE_SECONDS = 1.5;
const cache = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

/**
 * Buffer estéreo em loop de ruído branco, rosa (Paul Kellet) ou marrom, um por contexto.
 * O fim do buffer é misturado ao começo com crossfade de potência constante, então o loop
 * não tem emenda nem queda de volume.
 */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let perContext = cache.get(ctx);
  if (!perContext) {
    perContext = new Map();
    cache.set(ctx, perContext);
  }
  const cached = perContext.get(color);
  if (cached) return cached;

  const length = NOISE_SECONDS * ctx.sampleRate;
  const overlap = Math.floor(CROSSFADE_SECONDS * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const raw = new Float32Array(length + overlap);
    fill(raw, color);
    const data = buffer.getChannelData(channel);
    data.set(raw.subarray(0, length));
    for (let i = 0; i < overlap; i++) {
      const t = (i / overlap) * Math.PI * 0.5;
      data[i] = raw[i]! * Math.sin(t) + raw[length + i]! * Math.cos(t);
    }
  }
  perContext.set(color, buffer);
  return buffer;
}

function fill(data: Float32Array, color: NoiseColor): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "white") {
      data[i] = white * 0.5;
    } else if (color === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.5;
    }
  }
}
