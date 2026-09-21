import { BookAnalyzeRequestSchema, ChapterRefineRequestSchema, TocRequestSchema } from "@illusion/schema";
import { Hono, type Context } from "hono";
import { AnalyzeError } from "../ai/client";
import { analyzeBook, readToc, refineChapter } from "./analyzer";

/** POST /books/toc, POST /books/analyze e POST /chapters/refine. */

export const booksRoute = new Hono();
export const chaptersRoute = new Hono();

booksRoute.post("/toc", async (c) => {
  const body = TocRequestSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "requisição inválida", issues: body.error.issues }, 400);

  return run(c, "toc", async () => {
    const result = await readToc(body.data);
    return { result, summary: `${result.chapters.length} capítulos` };
  });
});

booksRoute.post("/analyze", async (c) => {
  const body = BookAnalyzeRequestSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "requisição inválida", issues: body.error.issues }, 400);

  return run(c, "analyze", async () => {
    const result = await analyzeBook(body.data);
    const scenes = result.chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
    return { result, summary: `"${body.data.title}" ${result.chapters.length} capítulos ${scenes} cenas` };
  });
});

chaptersRoute.post("/refine", async (c) => {
  const body = ChapterRefineRequestSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "requisição inválida", issues: body.error.issues }, 400);

  return run(c, "refine", async () => {
    const result = await refineChapter(body.data);
    return { result, summary: `cap. ${result.chapter.index} ${result.chapter.scenes.length} cenas conf=${result.chapter.confidence}` };
  });
});

interface Logged {
  result: { model: string; usage: { inputTokens: number; outputTokens: number } };
  summary: string;
}

async function run(c: Context, label: string, work: () => Promise<Logged>) {
  try {
    const started = Date.now();
    const { result, summary } = await work();
    console.log(`[books:${label}] ${result.model} ${Date.now() - started}ms in=${result.usage.inputTokens} out=${result.usage.outputTokens} ${summary}`);
    return c.json(result);
  } catch (error) {
    if (error instanceof AnalyzeError) {
      console.warn(`[books:${label}] ${error.status} ${error.message}`);
      return c.json({ error: error.message }, error.status);
    }
    console.error(`[books:${label}] erro inesperado`, error);
    return c.json({ error: "erro interno" }, 500);
  }
}
