/**
 * Vocabulário fechado que a IA, o editor manual e o receptor compartilham.
 * Cada id de som corresponde a um loop na biblioteca do receptor; cada motion
 * corresponde a um shader. Adicionar um item aqui exige o asset/shader correspondente.
 */
export const SOUND_LAYER_IDS = [
  // natureza
  "rain_light",
  "rain_heavy",
  "thunder_distant",
  "wind_light",
  "wind_strong",
  "forest_day",
  "forest_night",
  "birds_morning",
  "crickets",
  "river",
  "waterfall",
  "ocean_waves",
  "seagulls",
  "snow_wind",
  "desert_wind",
  "cave_wind",
  "underwater",
  // fogo
  "fireplace",
  "campfire",
  "torch",
  // interiores
  "tavern_crowd",
  "kitchen",
  "clock_ticking",
  "creaking_wood",
  "library_quiet",
  "church_reverb",
  "dungeon_drips",
  "ship_hull",
  // urbano
  "city_traffic",
  "street_market",
  "horse_carriage",
  "train",
  "church_bells",
  "harbor",
  // tensão e atmosfera
  "drone_low",
  "drone_dark",
  "heartbeat",
  "whispers",
  "choir_distant",
  "music_box",
  // conflito
  "crowd_shouting",
  "swords_distant",
  "war_drums",
  "cannons",
  // tecnologia
  "spaceship_hum",
  "machinery",
  "electric_buzz",
] as const;

export const MOTION_TYPES = [
  "static_glow",
  "fire_flicker",
  "rain_streaks",
  "waves",
  "fog_drift",
  "starfield",
  "pulse",
  "embers",
  "snowfall",
  "lightning",
] as const;

export type SoundLayerId = (typeof SOUND_LAYER_IDS)[number];
export type MotionType = (typeof MOTION_TYPES)[number];
