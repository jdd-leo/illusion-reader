import { z } from "zod";
import { SoundLayerSchema, VisualSchema } from "./page";

const unit = z.number().min(0).max(1);
const WEIGHT_TOLERANCE = 0.02;

/**
 * Uma cena dentro de um capítulo. Igual a uma Page no que o receptor renderiza;
 * difere em como é posicionada: pelo peso (fração do capítulo), não por número de página.
 */
export const SceneSchema = z.object({
  /** Fração do capítulo que a cena ocupa. A soma por capítulo é 1. */
  weight: unit,
  /** Palavras de clima mostradas ao leitor ("chuva", "madrugada"). Nunca enredo, nomes ou eventos. */
  mood: z.array(z.string().trim().min(1).max(24)).min(1).max(4),
  visual: VisualSchema,
  sound: z.array(SoundLayerSchema).max(6),
  /** Cenas de capítulo trocam devagar: ambientação de fundo, não slideshow. */
  transitionSeconds: z.number().min(0).max(60).default(20),
});

export const ChapterSchema = z
  .object({
    /** Posição no livro, a partir de 1, na ordem do sumário. */
    index: z.number().int().positive(),
    title: z.string().trim().min(1).max(200).optional(),
    /** Páginas impressas, quando conhecidas pelo sumário. Base do avanço por tempo no app. */
    startPage: z.number().int().positive().optional(),
    endPage: z.number().int().positive().optional(),
    /** Quanto a IA conhece este trecho. Baixa: cenas do clima geral do livro; o app convida a fotografar a primeira página. */
    confidence: unit,
    scenes: z.array(SceneSchema).min(1).max(8),
  })
  .refine((chapter) => chapter.startPage === undefined || chapter.endPage === undefined || chapter.endPage >= chapter.startPage, {
    message: "endPage menor que startPage",
    path: ["endPage"],
  })
  .refine(
    (chapter) => Math.abs(chapter.scenes.reduce((sum, scene) => sum + scene.weight, 0) - 1) <= WEIGHT_TOLERANCE,
    { message: "pesos das cenas devem somar 1", path: ["scenes"] },
  );

export type Scene = z.infer<typeof SceneSchema>;
export type SceneInput = z.input<typeof SceneSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterInput = z.input<typeof ChapterSchema>;
