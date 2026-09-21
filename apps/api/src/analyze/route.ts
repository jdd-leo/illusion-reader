import { AnalyzeRequestSchema } from "@illusion/schema";
import { Hono } from "hono";
import { AnalyzeError, analyzePage } from "./analyzer";

export const analyzeRoute = new Hono();

analyzeRoute.post("/analyze", async (c) => {
  const body = AnalyzeRequestSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) {
    return c.json({ error: "requisição inválida", issues: body.error.issues }, 400);
  }

  try {
    const started = Date.now();
    const result = await analyzePage(body.data);
    console.log(`[analyze] ${result.model} ${Date.now() - started}ms in=${result.usage.inputTokens} out=${result.usage.outputTokens} "${result.summary}"`);
    return c.json(result);
  } catch (error) {
    if (error instanceof AnalyzeError) {
      console.warn(`[analyze] ${error.status} ${error.message}`);
      return c.json({ error: error.message }, error.status);
    }
    console.error("[analyze] erro inesperado", error);
    return c.json({ error: "erro interno" }, 500);
  }
});
