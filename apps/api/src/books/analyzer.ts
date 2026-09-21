import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ChapterSchema,
  MOTION_TYPES,
  SOUND_LAYER_IDS,
  type BookAnalyzeRequest,
  type BookAnalyzeResponse,
  type Chapter,
  type ChapterOutline,
  type ChapterRefineRequest,
  type ChapterRefineResponse,
  type TocRequest,
  type TocResponse,
} from "@illusion/schema";
import { z } from "zod";
import { AnalyzeError, complete, EFFORT, MODEL, safeJson } from "../ai/client";
import { clamp, normalizeSound, normalizeVisual, round } from "../ai/normalize";
import { BOOK_PROMPT, REFINE_PROMPT, TOC_PROMPT } from "./prompt";

const TOC_MAX_TOKENS = 4000;
const REFINE_MAX_TOKENS = 3000;
/** Um livro de 60 capítulos com 5 cenas cada fica em torno de 30k tokens de saída. */
const BOOK_MAX_TOKENS = 40_000;

/** Formas soltas devolvidas pelo modelo; a validação estrita vem depois com ChapterSchema. */
const TocOutputSchema = z.object({
  isToc: z.boolean(),
  chapters: z.array(z.object({ index: z.number(), title: z.string().nullable(), startPage: z.number().nullable() })),
});

const SceneOutputSchema = z.object({
  weight: z.number(),
  mood: z.array(z.string()),
  visual: z.object({
    palette: z.array(z.string()).describe("3 a 5 cores hex #rrggbb, da mais escura para a mais clara"),
    brightness: z.number(),
    contrast: z.number(),
    motion: z.enum(MOTION_TYPES),
    speed: z.number(),
  }),
  sound: z.array(z.object({ id: z.enum(SOUND_LAYER_IDS), gain: z.number() })),
  transitionSeconds: z.number(),
});

const ChapterOutputSchema = z.object({ index: z.number(), confidence: z.number(), scenes: z.array(SceneOutputSchema) });
const BookOutputSchema = z.object({ chapters: z.array(ChapterOutputSchema) });

type SceneOutput = z.infer<typeof SceneOutputSchema>;
type ChapterOutput = z.infer<typeof ChapterOutputSchema>;

export async function readToc(request: TocRequest): Promise<TocResponse> {
  const result = await complete({
    model: MODEL,
    max_tokens: TOC_MAX_TOKENS,
    system: [{ type: "text", text: TOC_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.data } },
          { type: "text", text: request.isbn13 ? `ISBN: ${request.isbn13}. O sumário está na imagem.` : "O sumário está na imagem." },
        ],
      },
    ],
    output_config: { effort: EFFORT, format: zodOutputFormat(TocOutputSchema) },
  });

  const parsed = TocOutputSchema.safeParse(safeJson(result.text));
  if (!parsed.success) throw new AnalyzeError("resposta do modelo fora do formato", 502);
  if (!parsed.data.isToc || parsed.data.chapters.length === 0) throw new AnalyzeError("a imagem não parece um sumário legível", 422);

  const chapters: ChapterOutline[] = parsed.data.chapters
    .filter((chapter) => Number.isInteger(chapter.index) && chapter.index > 0)
    .sort((a, b) => a.index - b.index)
    .map((chapter, i) => {
      const title = chapter.title?.trim();
      const startPage = chapter.startPage !== null && Number.isInteger(chapter.startPage) && chapter.startPage > 0 ? chapter.startPage : undefined;
      return { index: i + 1, ...(title ? { title } : {}), ...(startPage !== undefined ? { startPage } : {}) };
    });

  return { chapters, model: result.model, usage: result.usage };
}

export async function analyzeBook(request: BookAnalyzeRequest): Promise<BookAnalyzeResponse> {
  const outline = withEndPages(request.chapters, request.totalPages);
  const context = [
    `Título: ${request.title}`,
    request.author ? `Autor: ${request.author}` : null,
    request.isbn13 ? `ISBN: ${request.isbn13}` : null,
    request.totalPages ? `Páginas: ${request.totalPages}` : null,
    request.synopsis ? `Sinopse: ${request.synopsis}` : null,
    "",
    "Capítulos:",
    ...outline.map(describeOutline),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await complete({
    model: MODEL,
    max_tokens: BOOK_MAX_TOKENS,
    system: [{ type: "text", text: BOOK_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: context }],
    output_config: { effort: EFFORT, format: zodOutputFormat(BookOutputSchema) },
  });

  const parsed = BookOutputSchema.safeParse(safeJson(result.text));
  if (!parsed.success) throw new AnalyzeError("resposta do modelo fora do formato", 502);

  const byIndex = new Map(parsed.data.chapters.map((chapter) => [chapter.index, chapter]));
  const missing: number[] = [];
  const chapters = outline.map((entry) => {
    const output = byIndex.get(entry.index);
    if (!output || output.scenes.length === 0) {
      missing.push(entry.index);
      return toChapter(entry, neutralChapter(entry.index));
    }
    return toChapter(entry, output);
  });
  if (missing.length > 0) console.warn(`[books] modelo não devolveu ${missing.length} capítulo(s): ${missing.join(", ")}; usando cena neutra`);

  return { chapters, model: result.model, usage: result.usage };
}

export async function refineChapter(request: ChapterRefineRequest): Promise<ChapterRefineResponse> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (request.image) {
    content.push({ type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.data } });
  }
  const context = [
    `Título: ${request.title}`,
    request.author ? `Autor: ${request.author}` : null,
    request.isbn13 ? `ISBN: ${request.isbn13}` : null,
    `Capítulo: ${describeOutline(request.chapter)}`,
    "",
    request.text ? `Primeira página do capítulo:\n\n${request.text}` : "A primeira página do capítulo está na imagem.",
  ]
    .filter((line) => line !== null)
    .join("\n");
  content.push({ type: "text", text: context });

  const result = await complete({
    model: MODEL,
    max_tokens: REFINE_MAX_TOKENS,
    system: [{ type: "text", text: REFINE_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: EFFORT, format: zodOutputFormat(ChapterOutputSchema) },
  });

  const parsed = ChapterOutputSchema.safeParse(safeJson(result.text));
  if (!parsed.success) throw new AnalyzeError("resposta do modelo fora do formato", 502);
  if (parsed.data.scenes.length === 0) throw new AnalyzeError("o modelo não devolveu cenas", 502);

  return { chapter: toChapter(request.chapter, parsed.data), model: result.model, usage: result.usage };
}

/** Fecha endPage de cada capítulo com a startPage do seguinte, e o último com o total de páginas. */
function withEndPages(chapters: ChapterOutline[], totalPages: number | undefined): ChapterOutline[] {
  return chapters.map((chapter, i) => {
    if (chapter.endPage !== undefined || chapter.startPage === undefined) return chapter;
    const nextStart = chapters[i + 1]?.startPage;
    const endPage = nextStart !== undefined ? nextStart - 1 : totalPages;
    return endPage !== undefined && endPage >= chapter.startPage ? { ...chapter, endPage } : chapter;
  });
}

function describeOutline(chapter: ChapterOutline): string {
  const pages =
    chapter.startPage !== undefined
      ? chapter.endPage !== undefined
        ? ` (páginas ${chapter.startPage} a ${chapter.endPage})`
        : ` (a partir da página ${chapter.startPage})`
      : "";
  return `${chapter.index}. ${chapter.title ?? "(sem título)"}${pages}`;
}

function toChapter(outline: ChapterOutline, output: ChapterOutput): Chapter {
  const candidate = {
    index: outline.index,
    ...(outline.title !== undefined ? { title: outline.title } : {}),
    ...(outline.startPage !== undefined ? { startPage: outline.startPage } : {}),
    ...(outline.endPage !== undefined ? { endPage: outline.endPage } : {}),
    confidence: round(clamp(output.confidence)),
    scenes: normalizeScenes(output.scenes.slice(0, 8)),
  };
  const chapter = ChapterSchema.safeParse(candidate);
  if (!chapter.success) {
    throw new AnalyzeError(`capítulo ${outline.index} inválido: ${chapter.error.issues[0]?.message ?? "?"}`, 502);
  }
  return chapter.data;
}

/** Renormaliza os pesos para somar exatamente 1 e limpa as palavras de clima. */
function normalizeScenes(scenes: SceneOutput[]): unknown[] {
  const raw = scenes.map((scene) => clamp(scene.weight));
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  const weights = total > 0 ? raw.map((weight) => round(weight / total)) : scenes.map(() => round(1 / scenes.length));
  const drift = round(1 - weights.reduce((sum, weight) => sum + weight, 0));
  weights[weights.length - 1] = round(weights[weights.length - 1]! + drift);

  return scenes.map((scene, i) => ({
    weight: weights[i],
    mood: normalizeMood(scene.mood),
    visual: normalizeVisual(scene.visual),
    sound: normalizeSound(scene.sound),
    transitionSeconds: round(clamp(scene.transitionSeconds, 0, 60)),
  }));
}

/**
 * Palavras de clima são minúsculas por instrução; uma inicial maiúscula denuncia nome próprio,
 * que é spoiler e sai. Se nada sobrar, a cena fica sem rótulo específico.
 */
function normalizeMood(mood: string[]): string[] {
  const words = mood
    .map((word) => word.trim().replace(/[.,;:!?]+$/, ""))
    .filter((word) => word.length > 0 && word.length <= 24 && word[0] === word[0]!.toLowerCase())
    .slice(0, 4);
  return words.length > 0 ? words : ["ambiente"];
}

function neutralChapter(index: number): ChapterOutput {
  return {
    index,
    confidence: 0,
    scenes: [
      {
        weight: 1,
        mood: ["leitura", "calma"],
        visual: { palette: ["#0e1014", "#1d2130", "#4a5068", "#c8ccd8"], brightness: 0.35, contrast: 0.4, motion: "fog_drift", speed: 0.15 },
        sound: [{ id: "library_quiet", gain: 0.3 }],
        transitionSeconds: 30,
      },
    ],
  };
}
