import { PresetSchema } from "@illusion/schema";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rotas de desenvolvimento. `GET /dev/presets` serve os presets gerados por
 * `npm run test:analyze` (scripts/out/preset.json, por página) e `npm run test:book`
 * (scripts/out/book-preset.json, por capítulo) para o app importar sem câmera.
 */
export const devRoute = new Hono();

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PRESETS = ["../../scripts/out/preset.json", "../../scripts/out/book-preset.json"].map((file) => path.resolve(here, file));

devRoute.get("/presets", async (c) => {
  const presets = [];
  for (const file of SAMPLE_PRESETS) {
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const parsed = PresetSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return c.json({ error: `preset gerado é inválido: ${path.basename(file)}`, issues: parsed.error.issues }, 500);
    }
    presets.push(parsed.data);
  }
  if (presets.length === 0) {
    return c.json({ error: "nenhum preset gerado; rode npm run test:analyze ou npm run test:book -w @illusion/api" }, 404);
  }
  return c.json(presets);
});
