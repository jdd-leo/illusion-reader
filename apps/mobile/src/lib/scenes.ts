import type { Scene } from "@illusion/schema";

/** Cena usada quando o leitor diz que a atual não combina: escura, lenta e quase muda. */
export function neutralScene(weight: number): Scene {
  return {
    weight,
    mood: ["leitura", "calma"],
    visual: { palette: ["#0e1014", "#1d2130", "#4a5068", "#c8ccd8"], brightness: 0.35, contrast: 0.4, motion: "fog_drift", speed: 0.15 },
    sound: [{ id: "library_quiet", gain: 0.3 }],
    transitionSeconds: 30,
  };
}
