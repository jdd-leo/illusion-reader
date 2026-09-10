export type Rgb = readonly [number, number, number];

export const PALETTE_SLOTS = 5;

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Reamostra uma paleta de 3 a 5 cores para exatamente 5 stops, preservando o gradiente. */
export function resamplePalette(colors: readonly string[]): Rgb[] {
  const rgb = colors.map(hexToRgb);
  const last = rgb.length - 1;
  const out: Rgb[] = [];
  for (let slot = 0; slot < PALETTE_SLOTS; slot++) {
    const x = (slot / (PALETTE_SLOTS - 1)) * last;
    const i = Math.min(Math.floor(x), last);
    const j = Math.min(i + 1, last);
    out.push(lerpRgb(rgb[i]!, rgb[j]!, x - i));
  }
  return out;
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function lerpPalette(a: readonly Rgb[], b: readonly Rgb[], t: number): Rgb[] {
  return a.map((color, i) => lerpRgb(color, b[i]!, t));
}

export function flattenPalette(palette: readonly Rgb[]): Float32Array {
  return new Float32Array(palette.flat());
}
