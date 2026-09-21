import { BookAnalyzeRequestSchema, BookAnalyzeResponseSchema, type Preset } from "@illusion/schema";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Envia um livro de exemplo (book-sample.json: título, autor, sinopse e sumário) para
 * POST /books/analyze e grava o preset por capítulo em scripts/out/book-preset.json,
 * que o receptor e o app importam. Exige a API rodando (npm run dev:api).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL ?? "http://localhost:8787";

const request = BookAnalyzeRequestSchema.parse(JSON.parse(readFileSync(path.join(here, "book-sample.json"), "utf8")));

console.log(`"${request.title}" ${request.chapters.length} capítulos → ${API}/books/analyze`);
const started = Date.now();
const response = await fetch(`${API}/books/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(request),
});
const body: unknown = await response.json();
if (!response.ok) {
  console.error(`HTTP ${response.status}`, body);
  process.exit(1);
}
const result = BookAnalyzeResponseSchema.parse(body);
console.log(`${result.model} ${Math.round((Date.now() - started) / 1000)}s in=${result.usage.inputTokens} out=${result.usage.outputTokens} cache=${result.usage.cacheReadTokens}\n`);

for (const chapter of result.chapters) {
  console.log(`${chapter.index}. ${chapter.title ?? ""}  conf=${chapter.confidence}`);
  for (const scene of chapter.scenes) {
    console.log(`   ${scene.weight.toFixed(2)}  ${scene.mood.join(", ").padEnd(34)} ${scene.visual.motion.padEnd(12)} ${scene.sound.map((layer) => `${layer.id}:${layer.gain}`).join(" ")}`);
  }
}

const preset: Preset = {
  version: 1,
  id: `ai-book-${request.isbn13 ?? "sample"}`,
  isbn13: request.isbn13 ?? "9780000000003",
  title: request.title,
  source: "ai",
  pageOffset: 0,
  chapters: result.chapters,
  pages: [],
};
const outDir = path.join(here, "out");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "book-preset.json");
writeFileSync(outFile, JSON.stringify(preset, null, 2));
console.log(`\nPreset em ${path.relative(process.cwd(), outFile)}`);
