import type { MotionType, SoundLayerId } from "@illusion/schema";

/**
 * Ajusta ruído numérico do modelo antes da validação estrita pelo schema.
 * O que não for corrigível (cor fora do formato, id desconhecido) o schema rejeita.
 */

export interface LooseVisual {
  palette: string[];
  brightness: number;
  contrast: number;
  motion: MotionType;
  speed: number;
}

export interface LooseSound {
  id: SoundLayerId;
  gain: number;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeVisual(visual: LooseVisual): LooseVisual {
  return {
    palette: visual.palette.slice(0, 5).map((color) => color.trim().toLowerCase()),
    brightness: round(clamp(visual.brightness)),
    contrast: round(clamp(visual.contrast)),
    motion: visual.motion,
    speed: round(clamp(visual.speed)),
  };
}

/** Deduplica camadas e limita a 6. */
export function normalizeSound(sound: LooseSound[]): LooseSound[] {
  const seen = new Set<string>();
  return sound
    .filter((layer) => (seen.has(layer.id) ? false : seen.add(layer.id)))
    .slice(0, 6)
    .map((layer) => ({ id: layer.id, gain: round(clamp(layer.gain)) }));
}
