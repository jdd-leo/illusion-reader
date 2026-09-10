import { z } from "zod";
import { PageSchema } from "./page";

export const PRESET_SOURCES = ["ai", "manual", "official", "community"] as const;

export const PresetSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    isbn13: z.string().regex(/^\d{13}$/, "ISBN-13 com 13 dígitos"),
    title: z.string().min(1),
    source: z.enum(PRESET_SOURCES),
    /** Deslocamento aplicado ao número de página para tiragens com paginação diferente. */
    pageOffset: z.number().int().default(0),
    pages: z.array(PageSchema).min(1),
  })
  .refine(
    (preset) => new Set(preset.pages.map((p) => p.page)).size === preset.pages.length,
    { message: "páginas duplicadas no preset", path: ["pages"] },
  );

export type Preset = z.infer<typeof PresetSchema>;
export type PresetInput = z.input<typeof PresetSchema>;
export type PresetSource = (typeof PRESET_SOURCES)[number];
