import { z } from "zod";
import { PageSchema } from "./page";

/** Contrato de POST /pages/analyze entre app e API. */

export const ImageMediaTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const AnalyzeRequestSchema = z
  .object({
    isbn13: z.string().regex(/^\d{13}$/).optional(),
    /** Página impressa, se o app já souber. */
    page: z.number().int().positive().optional(),
    /** Texto vindo do OCR no dispositivo. */
    text: z.string().trim().min(20).max(20_000).optional(),
    /** Foto da página, quando não há OCR. Base64 sem prefixo data:. */
    image: z
      .object({
        mediaType: ImageMediaTypeSchema,
        data: z.string().min(100).max(8_000_000),
      })
      .optional(),
  })
  .refine((body) => body.text !== undefined || body.image !== undefined, {
    message: "informe text ou image",
  });

export const AnalyzeResponseSchema = z.object({
  page: PageSchema,
  /** Número de página lido do texto/foto, se houver. */
  detectedPage: z.number().int().positive().nullable(),
  /** Resumo curto da cena, para depuração e para o editor de preset. */
  summary: z.string(),
  model: z.string(),
  usage: z.object({ inputTokens: z.number().int(), outputTokens: z.number().int(), cacheReadTokens: z.number().int() }),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
