import type { SoundLayerId } from "@illusion/schema";
import type { EventsPart, LayerRecipe, NoisePart, Part } from "./generators";

/**
 * Receita procedural para cada id de som. Usada quando não existe /sounds/<id>.ogg.
 * Ganhos são relativos: a camada inteira ainda passa pelo ganho da página e pelo compressor do master.
 */

const noise = (part: Omit<NoisePart, "kind">): NoisePart => ({ kind: "noise", ...part });
const events = (part: Omit<EventsPart, "kind">): EventsPart => ({ kind: "events", ...part });
const layer = (reverb: number, ...parts: Part[]): LayerRecipe => ({ reverb, parts });

const PENTATONIC = [1, 1.125, 1.25, 1.5, 1.6875, 2, 2.25, 2.5];

const rumble = (gain: number) =>
  noise({ color: "brown", gain, filter: { type: "lowpass", freq: 150 }, swell: { min: 0.4, max: 1, every: [3, 7] } });

const murmur = (gain: number, low: number, high: number, every: [number, number]) =>
  noise({
    color: "pink",
    gain,
    filter: { type: "bandpass", freq: (low + high) / 2, q: 1.5 },
    drift: { min: low, max: high, every },
    swell: { min: 0.3, max: 1, every },
  });

const gust = (gain: number, low: number, high: number, q: number, every: [number, number]) =>
  noise({
    color: "brown",
    gain,
    filter: { type: "bandpass", freq: (low + high) / 2, q },
    drift: { min: low, max: high, every },
    swell: { min: 0.2, max: 1, every },
  });

const hiss = (gain: number, freq: number) =>
  noise({ color: "pink", gain: gain * 0.5, filter: { type: "highpass", freq }, filter2: { type: "lowpass", freq: 5000 }, swell: { min: 0.5, max: 1, every: [2, 5] } });

/** Água corrente: corpo grave marrom + textura rosa filtrada, sempre com respiração lenta. Nada de chiado fixo. */
const water = (bodyGain: number, textureGain: number, textureFreq: number, every: [number, number]) => [
  noise({ color: "brown", gain: bodyGain, filter: { type: "lowpass", freq: 400 }, swell: { min: 0.6, max: 1, every } }),
  noise({ color: "pink", gain: textureGain, filter: { type: "lowpass", freq: textureFreq }, filter2: { type: "highpass", freq: 250 }, swell: { min: 0.5, max: 1, every } }),
];

const crackle = (gap: [number, number], gain: number) =>
  events({ sound: "crackle", gap, freq: [1500, 5500], decay: 0.02, gain, spread: 0.6 });

export const RECIPES: Record<SoundLayerId, LayerRecipe> = {
  rain_light: layer(
    0.25,
    noise({ color: "pink", gain: 0.28, filter: { type: "lowpass", freq: 3000 }, filter2: { type: "highpass", freq: 600 }, swell: { min: 0.6, max: 1, every: [3, 7] } }),
    events({ sound: "drip", gap: [0.03, 0.12], freq: [1800, 4000], decay: 0.03, gain: 0.07, spread: 1 }),
  ),
  rain_heavy: layer(
    0.3,
    noise({ color: "pink", gain: 0.45, filter: { type: "lowpass", freq: 2600 }, filter2: { type: "highpass", freq: 300 }, swell: { min: 0.7, max: 1, every: [3, 6] } }),
    noise({ color: "brown", gain: 0.35, filter: { type: "highpass", freq: 150 } }),
    events({ sound: "drip", gap: [0.008, 0.04], freq: [1500, 3500], decay: 0.04, gain: 0.09, spread: 1 }),
  ),
  thunder_distant: layer(
    0.7,
    rumble(0.15),
    events({ sound: "whoosh", gap: [7, 20], freq: [60, 120], decay: 4, gain: 0.9, sweep: -0.5, spread: 0.8, filter: { type: "lowpass", freq: 250 } }),
  ),
  wind_light: layer(0.3, gust(0.4, 400, 1200, 2, [3, 7])),
  wind_strong: layer(0.3, gust(0.7, 200, 900, 3, [2, 5]), hiss(0.08, 2000)),
  forest_day: layer(
    0.5,
    noise({ color: "pink", gain: 0.12, filter: { type: "bandpass", freq: 3000, q: 0.7 }, swell: { min: 0.3, max: 1, every: [2, 5] } }),
    events({ sound: "chirp", gap: [0.6, 3], freq: [2200, 4200], decay: 0.1, gain: 0.09, sweep: 0.35, burst: [1, 4], burstGap: 0.16, spread: 1 }),
    gust(0.15, 400, 900, 2, [4, 8]),
  ),
  forest_night: layer(
    0.5,
    noise({ color: "brown", gain: 0.15, filter: { type: "lowpass", freq: 400 } }),
    events({ sound: "chirp", gap: [0.8, 2], freq: [3800, 4400], decay: 0.03, gain: 0.04, burst: [4, 9], burstGap: 0.04, spread: 1 }),
    events({ sound: "drip", gap: [6, 16], freq: [320, 400], decay: 0.5, gain: 0.1, spread: 0.8 }),
  ),
  birds_morning: layer(
    0.75,
    events({ sound: "chirp", gap: [0.3, 1.6], freq: [2000, 4200], decay: 0.09, gain: 0.1, sweep: 0.45, burst: [1, 5], burstGap: 0.13, spread: 1 }),
    events({ sound: "chirp", gap: [1.5, 5], freq: [2400, 3400], decay: 0.22, gain: 0.07, sweep: -0.35, burst: [1, 2], burstGap: 0.3, spread: 1 }),
    noise({ color: "pink", gain: 0.05, filter: { type: "lowpass", freq: 1200 }, swell: { min: 0.5, max: 1, every: [3, 7] } }),
  ),
  crickets: layer(
    0.3,
    events({ sound: "chirp", gap: [0.5, 1.4], freq: [4000, 4400], decay: 0.025, gain: 0.06, burst: [6, 12], burstGap: 0.035, spread: 1 }),
    events({ sound: "chirp", gap: [0.8, 2], freq: [3400, 3800], decay: 0.03, gain: 0.04, burst: [4, 8], burstGap: 0.05, spread: 1 }),
  ),
  river: layer(
    0.35,
    ...water(0.35, 0.3, 1800, [1.5, 4]),
    events({ sound: "drip", gap: [0.15, 0.5], freq: [500, 1500], decay: 0.06, gain: 0.04, spread: 1 }),
  ),
  waterfall: layer(0.55, ...water(0.55, 0.35, 2400, [2, 5])),
  ocean_waves: layer(
    0.45,
    noise({ color: "brown", gain: 0.6, filter: { type: "lowpass", freq: 500 }, swell: { min: 0.1, max: 1, every: [5, 9] } }),
    noise({ color: "pink", gain: 0.18, filter: { type: "bandpass", freq: 1200, q: 0.7 }, swell: { min: 0, max: 0.7, every: [5, 9] } }),
  ),
  seagulls: layer(
    0.6,
    events({ sound: "chirp", gap: [2, 7], freq: [1100, 1600], decay: 0.45, gain: 0.08, sweep: -0.35, burst: [1, 3], burstGap: 0.35, spread: 1 }),
  ),
  snow_wind: layer(0.4, gust(0.45, 300, 700, 4, [3, 6])),
  desert_wind: layer(0.3, gust(0.45, 150, 500, 2, [4, 8]), hiss(0.04, 3000)),
  cave_wind: layer(
    0.9,
    noise({ color: "brown", gain: 0.4, filter: { type: "lowpass", freq: 250 }, swell: { min: 0.3, max: 0.9, every: [4, 8] } }),
    events({ sound: "drip", gap: [2, 7], freq: [1200, 2400], decay: 0.3, gain: 0.12, spread: 1 }),
  ),
  underwater: layer(
    0.5,
    noise({ color: "brown", gain: 0.5, filter: { type: "lowpass", freq: 200 } }),
    { kind: "drone", wave: "sine", freqs: [40, 60], gain: 0.15, cutoff: 200 },
    events({ sound: "chirp", gap: [0.5, 3], freq: [400, 900], decay: 0.15, gain: 0.06, sweep: 1, spread: 1 }),
  ),
  fireplace: layer(
    0.15,
    noise({ color: "brown", gain: 0.3, filter: { type: "lowpass", freq: 300 }, swell: { min: 0.4, max: 0.8, every: [1, 3] } }),
    crackle([0.03, 0.4], 0.3),
    hiss(0.03, 3000),
  ),
  campfire: layer(0.25, noise({ color: "brown", gain: 0.25, filter: { type: "lowpass", freq: 250 } }), crackle([0.02, 0.25], 0.35), hiss(0.05, 3000), gust(0.1, 400, 900, 2, [4, 8])),
  torch: layer(
    0.3,
    noise({ color: "pink", gain: 0.3, filter: { type: "bandpass", freq: 900, q: 0.8 }, swell: { min: 0.5, max: 1, every: [0.5, 1.5] } }),
    crackle([0.1, 0.8], 0.18),
  ),
  tavern_crowd: layer(
    0.5,
    murmur(0.35, 300, 700, [0.5, 1.5]),
    murmur(0.2, 800, 1400, [0.7, 2]),
    events({ sound: "tick", gap: [3, 9], freq: [2500, 5000], decay: 0.12, gain: 0.06, spread: 1 }),
    events({ sound: "whoosh", gap: [3, 9], freq: [350, 700], decay: 1.2, gain: 0.18, sweep: 0.2, spread: 1 }),
  ),
  kitchen: layer(
    0.35,
    events({ sound: "tick", gap: [0.5, 3], freq: [2500, 7000], decay: 0.1, gain: 0.12, spread: 1 }),
    noise({ color: "pink", gain: 0.06, filter: { type: "lowpass", freq: 800 } }),
    events({ sound: "crackle", gap: [0.1, 0.6], freq: [2000, 6000], decay: 0.03, gain: 0.08, spread: 0.5 }),
  ),
  clock_ticking: layer(0.3, events({ sound: "tick", gap: [1, 1], freq: [2200, 2800], decay: 0.04, gain: 0.3, spread: 0 })),
  creaking_wood: layer(
    0.5,
    events({ sound: "chirp", gap: [3, 9], freq: [120, 220], decay: 0.6, gain: 0.12, sweep: 0.4, wave: "sawtooth", filter: { type: "lowpass", freq: 800 }, spread: 0.8 }),
  ),
  library_quiet: layer(
    0.6,
    noise({ color: "brown", gain: 0.2, filter: { type: "lowpass", freq: 150 } }),
    events({ sound: "tick", gap: [4, 12], freq: [1500, 3000], decay: 0.08, gain: 0.05, spread: 1 }),
    events({ sound: "tick", gap: [1, 1], freq: [2400, 2600], decay: 0.03, gain: 0.05, spread: 0 }),
  ),
  church_reverb: layer(1, { kind: "drone", wave: "triangle", freqs: [110, 165, 220, 330], gain: 0.25, voices: 2, detune: 4, cutoff: 1200, lfo: { rate: 0.1, depth: 400 } }),
  dungeon_drips: layer(
    1,
    events({ sound: "drip", gap: [1, 5], freq: [1500, 3500], decay: 0.25, gain: 0.3, spread: 1 }),
    noise({ color: "brown", gain: 0.15, filter: { type: "lowpass", freq: 150 } }),
  ),
  ship_hull: layer(
    0.6,
    { kind: "drone", wave: "sawtooth", freqs: [55], gain: 0.3, voices: 3, detune: 8, cutoff: 250, lfo: { rate: 0.07, depth: 100 } },
    events({ sound: "chirp", gap: [4, 10], freq: [90, 160], decay: 0.9, gain: 0.12, sweep: 0.3, wave: "sawtooth", filter: { type: "lowpass", freq: 600 }, spread: 0.8 }),
    noise({ color: "brown", gain: 0.25, filter: { type: "lowpass", freq: 300 }, swell: { min: 0.3, max: 1, every: [4, 8] } }),
  ),
  city_traffic: layer(
    0.3,
    gust(0.5, 100, 300, 1, [2, 6]),
    events({ sound: "whoosh", gap: [3, 9], freq: [600, 1500], decay: 2.5, gain: 0.2, sweep: -0.4, spread: 1 }),
    hiss(0.05, 1500),
  ),
  street_market: layer(
    0.4,
    murmur(0.35, 500, 1200, [0.4, 1.2]),
    events({ sound: "whoosh", gap: [1.5, 5], freq: [400, 900], decay: 0.9, gain: 0.15, sweep: 0.3, spread: 1 }),
    events({ sound: "tick", gap: [2, 6], freq: [2500, 5000], decay: 0.1, gain: 0.05, spread: 1 }),
  ),
  horse_carriage: layer(
    0.35,
    events({ sound: "drum", gap: [0.85, 0.85], freq: [180, 260], decay: 0.06, gain: 0.3, pattern: [0, 0.14, 0.32, 0.46], spread: 0.2 }),
    noise({ color: "brown", gain: 0.15, filter: { type: "lowpass", freq: 200 } }),
    events({ sound: "tick", gap: [0.4, 0.4], freq: [800, 1200], decay: 0.05, gain: 0.08, spread: 0.3 }),
  ),
  train: layer(
    0.35,
    events({ sound: "drum", gap: [0.22, 0.22], freq: [90, 110], decay: 0.07, gain: 0.35, pattern: [0, 0.11], spread: 0.1 }),
    noise({ color: "brown", gain: 0.3, filter: { type: "lowpass", freq: 500 } }),
    hiss(0.08, 3000),
  ),
  church_bells: layer(
    0.9,
    events({ sound: "bell", gap: [2.5, 3.5], freq: [330, 336], decay: 4, gain: 0.3, spread: 0.3 }),
    events({ sound: "bell", gap: [5, 8], freq: [440, 446], decay: 3.5, gain: 0.18, spread: 0.5 }),
  ),
  harbor: layer(
    0.5,
    noise({ color: "brown", gain: 0.4, filter: { type: "lowpass", freq: 450 }, swell: { min: 0.2, max: 1, every: [4, 8] } }),
    events({ sound: "chirp", gap: [4, 12], freq: [900, 1400], decay: 0.5, gain: 0.07, sweep: -0.3, spread: 1, wave: "triangle" }),
    events({ sound: "bell", gap: [12, 25], freq: [520, 530], decay: 3, gain: 0.08, spread: 0.8 }),
    events({ sound: "chirp", gap: [5, 12], freq: [100, 170], decay: 0.8, gain: 0.08, sweep: 0.3, wave: "sawtooth", filter: { type: "lowpass", freq: 600 } }),
  ),
  drone_low: layer(
    0.5,
    { kind: "drone", wave: "sine", freqs: [55, 82.5], gain: 0.25, cutoff: 300 },
    { kind: "drone", wave: "sawtooth", freqs: [55], gain: 0.2, voices: 3, detune: 5, cutoff: 180, lfo: { rate: 0.05, depth: 60 } },
  ),
  drone_dark: layer(
    0.7,
    { kind: "drone", wave: "sawtooth", freqs: [41.2, 61.7], gain: 0.3, voices: 3, detune: 9, cutoff: 220, lfo: { rate: 0.04, depth: 120 } },
    rumble(0.15),
  ),
  heartbeat: layer(0.1, events({ sound: "drum", gap: [0.92, 0.92], freq: [55, 60], decay: 0.18, gain: 0.5, pattern: [0, 0.22], filter: { type: "lowpass", freq: 200 }, spread: 0 })),
  whispers: layer(
    0.5,
    events({ sound: "whoosh", gap: [0.3, 1.2], freq: [1500, 4000], decay: 0.5, gain: 0.15, sweep: 0.3, spread: 1 }),
    noise({ color: "pink", gain: 0.03, filter: { type: "bandpass", freq: 2500, q: 1 } }),
  ),
  choir_distant: layer(1, { kind: "drone", wave: "triangle", freqs: [220, 277.2, 329.6, 440], gain: 0.2, voices: 2, detune: 6, cutoff: 1500, lfo: { rate: 0.15, depth: 600 } }),
  music_box: layer(0.8, events({ sound: "pluck", gap: [0.35, 0.7], freq: [523, 523], decay: 1.1, gain: 0.12, scale: PENTATONIC, spread: 0.4 })),
  crowd_shouting: layer(
    0.5,
    murmur(0.45, 400, 900, [0.2, 0.6]),
    events({ sound: "whoosh", gap: [0.4, 1.5], freq: [300, 800], decay: 0.7, gain: 0.25, sweep: 0.4, spread: 1 }),
  ),
  swords_distant: layer(
    0.6,
    events({ sound: "bell", gap: [0.4, 1.6], freq: [1800, 3200], decay: 0.35, gain: 0.14, spread: 1 }),
    events({ sound: "whoosh", gap: [0.8, 2.5], freq: [800, 2000], decay: 0.3, gain: 0.1, sweep: 0.5, spread: 1 }),
  ),
  war_drums: layer(0.5, events({ sound: "drum", gap: [0.6, 0.6], freq: [60, 80], decay: 0.35, gain: 0.5, pattern: [0, 0.3, 0.45], spread: 0.3 })),
  cannons: layer(0.8, events({ sound: "drum", gap: [4, 12], freq: [35, 50], decay: 1.5, gain: 0.7, spread: 0.8 }), rumble(0.2)),
  spaceship_hum: layer(
    0.4,
    { kind: "drone", wave: "sawtooth", freqs: [60, 90], gain: 0.3, voices: 3, detune: 6, cutoff: 300, lfo: { rate: 0.08, depth: 120 } },
    noise({ color: "pink", gain: 0.08, filter: { type: "lowpass", freq: 400 } }),
  ),
  machinery: layer(
    0.4,
    events({ sound: "drum", gap: [0.3, 0.3], freq: [150, 180], decay: 0.05, gain: 0.3, pattern: [0, 0.15], spread: 0.2 }),
    noise({ color: "brown", gain: 0.3, filter: { type: "bandpass", freq: 200, q: 3 } }),
    events({ sound: "tick", gap: [0.075, 0.075], freq: [3000, 3200], decay: 0.02, gain: 0.06, spread: 0.6 }),
  ),
  electric_buzz: layer(
    0.1,
    { kind: "drone", wave: "sawtooth", freqs: [60, 120], gain: 0.15, voices: 2, detune: 2, cutoff: 2500 },
    noise({ color: "white", gain: 0.04, filter: { type: "bandpass", freq: 3000, q: 8 }, swell: { min: 0.2, max: 1, every: [0.2, 0.8] } }),
    events({ sound: "crackle", gap: [0.5, 3], freq: [3000, 7000], decay: 0.03, gain: 0.12, spread: 1 }),
  ),
};
