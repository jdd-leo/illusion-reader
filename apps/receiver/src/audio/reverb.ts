/** Resposta ao impulso sintética: ruído estéreo com decaimento exponencial e escurecimento progressivo. */
export function impulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const damping = 1 - Math.exp((-2 * Math.PI * 3500) / ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      low += damping * (1 - t * 0.8) * (white - low);
      data[i] = low * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}
