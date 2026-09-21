import { z } from "zod";
import { ImageMediaTypeSchema } from "./analyze";
import { ChapterSchema } from "./chapter";

/** Contratos dos endpoints por capítulo: POST /books/toc, POST /books/analyze, POST /chapters/refine. */

const isbn13 = z.string().regex(/^\d{13}$/);

export const ImagePayloadSchema = z.object({
  mediaType: ImageMediaTypeSchema,
  /** Base64 sem prefixo data:. */
  data: z.string().min(100).max(8_000_000),
});

export const ModelUsageSchema = z.object({
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
});

/** Um capítulo como aparece no sumário, antes de ter cenas. */
export const ChapterOutlineSchema = z
  .object({
    index: z.number().int().positive(),
    title: z.string().trim().min(1).max(200).optional(),
    startPage: z.number().int().positive().optional(),
    endPage: z.number().int().positive().optional(),
  })
  .refine((chapter) => chapter.startPage === undefined || chapter.endPage === undefined || chapter.endPage >= chapter.startPage, {
    message: "endPage menor que startPage",
    path: ["endPage"],
  });

const outlineList = z
  .array(ChapterOutlineSchema)
  .min(1)
  .max(60)
  .refine((chapters) => chapters.every((chapter, i) => i === 0 || chapter.index > chapters[i - 1]!.index), {
    message: "capítulos devem ter índices únicos e crescentes",
  });

export const TocRequestSchema = z.object({
  isbn13: isbn13.optional(),
  image: ImagePayloadSchema,
});

export const TocResponseSchema = z.object({
  chapters: z.array(ChapterOutlineSchema),
  model: z.string(),
  usage: ModelUsageSchema,
});

export const BookAnalyzeRequestSchema = z.object({
  isbn13: isbn13.optional(),
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().min(1).max(200).optional(),
  synopsis: z.string().trim().max(4000).optional(),
  /** Total de páginas da edição, para fechar o último capítulo. */
  totalPages: z.number().int().positive().optional(),
  chapters: outlineList,
});

export const BookAnalyzeResponseSchema = z.object({
  chapters: z.array(ChapterSchema),
  model: z.string(),
  usage: ModelUsageSchema,
});

export const ChapterRefineRequestSchema = z
  .object({
    isbn13: isbn13.optional(),
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().min(1).max(200).optional(),
    chapter: ChapterOutlineSchema,
    /** Primeira página do capítulo: texto do OCR ou foto. */
    text: z.string().trim().min(20).max(20_000).optional(),
    image: ImagePayloadSchema.optional(),
  })
  .refine((body) => body.text !== undefined || body.image !== undefined, { message: "informe text ou image" });

export const ChapterRefineResponseSchema = z.object({
  chapter: ChapterSchema,
  model: z.string(),
  usage: ModelUsageSchema,
});

export type ChapterOutline = z.infer<typeof ChapterOutlineSchema>;
export type ModelUsage = z.infer<typeof ModelUsageSchema>;
export type TocRequest = z.infer<typeof TocRequestSchema>;
export type TocResponse = z.infer<typeof TocResponseSchema>;
export type BookAnalyzeRequest = z.infer<typeof BookAnalyzeRequestSchema>;
export type BookAnalyzeResponse = z.infer<typeof BookAnalyzeResponseSchema>;
export type ChapterRefineRequest = z.infer<typeof ChapterRefineRequestSchema>;
export type ChapterRefineResponse = z.infer<typeof ChapterRefineResponseSchema>;
