import { z } from "zod";
import { MOTION_TYPES, SOUND_LAYER_IDS } from "./taxonomy";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor hex #RRGGBB");
const unit = z.number().min(0).max(1);

export const VisualSchema = z.object({
  /** Ordenada da cor mais escura para a mais clara; a última é usada como cor de luz (brasas, estrelas, relâmpagos). */
  palette: z.array(hexColor).min(3).max(5),
  brightness: unit,
  contrast: unit,
  motion: z.enum(MOTION_TYPES),
  speed: unit,
});

export const SoundLayerSchema = z.object({
  id: z.enum(SOUND_LAYER_IDS),
  gain: unit,
});

export const PageSchema = z.object({
  page: z.number().int().positive(),
  visual: VisualSchema,
  sound: z.array(SoundLayerSchema).max(6),
  transitionSeconds: z.number().min(0).max(30).default(6),
});

export type Visual = z.infer<typeof VisualSchema>;
export type SoundLayer = z.infer<typeof SoundLayerSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageInput = z.input<typeof PageSchema>;
