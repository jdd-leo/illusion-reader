import { z } from "zod";
import { ChapterSchema } from "./chapter";
import { PageSchema } from "./page";

export const PRESET_SOURCES = ["ai", "manual", "official", "community"] as const;

/**
 * Um preset tem cenas por capítulo (fluxo principal) ou por página (modo avançado).
 * Quando os dois existem, o receptor prefere capítulos.
 */
export const PresetSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    isbn13: z.string().regex(/^\d{13}$/, "ISBN-13 com 13 dígitos"),
    title: z.string().min(1),
    source: z.enum(PRESET_SOURCES),
    /** Deslocamento aplicado ao número de página para tiragens com paginação diferente. Só afeta `pages`. */
    pageOffset: z.number().int().default(0),
    chapters: z.array(ChapterSchema).default([]),
    pages: z.array(PageSchema).default([]),
  })
  .refine((preset) => preset.chapters.length > 0 || preset.pages.length > 0, {
    message: "preset sem capítulos e sem páginas",
    path: ["chapters"],
  })
  .refine((preset) => new Set(preset.pages.map((p) => p.page)).size === preset.pages.length, {
    message: "páginas duplicadas no preset",
    path: ["pages"],
  })
  .refine((preset) => preset.chapters.every((chapter, i) => i === 0 || chapter.index > preset.chapters[i - 1]!.index), {
    message: "capítulos devem ter índices únicos e crescentes",
    path: ["chapters"],
  });

export type Preset = z.infer<typeof PresetSchema>;
export type PresetInput = z.input<typeof PresetSchema>;
export type PresetSource = (typeof PRESET_SOURCES)[number];
