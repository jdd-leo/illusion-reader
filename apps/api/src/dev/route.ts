import { PresetSchema } from "@illusion/schema";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rotas de desenvolvimento. `GET /dev/presets` serve o preset gerado por
 * `npm run test:analyze` (scripts/out/preset.json) para o app importar sem OCR.
 */
export const devRoute = new Hono();

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PRESET = path.resolve(here, "../../scripts/out/preset.json");

devRoute.get("/presets", async (c) => {
  let raw: string;
  try {
    raw = await readFile(SAMPLE_PRESET, "utf8");
  } catch {
    return c.json({ error: "nenhum preset gerado; rode npm run test:analyze -w @illusion/api" }, 404);
  }

  const parsed = PresetSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return c.json({ error: "preset gerado é inválido", issues: parsed.error.issues }, 500);
  }
  return c.json([parsed.data]);
});
