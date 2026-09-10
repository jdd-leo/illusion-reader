import { AnalyzeResponseSchema, type Preset } from "@illusion/schema";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Envia trechos de teste para POST /pages/analyze e imprime a cena escolhida para cada um.
 * Requer a API rodando (npm run dev -w @illusion/api) com ANTHROPIC_API_KEY no .env.
 * Ao final grava um preset com todas as páginas em scripts/out/preset.json para carregar no receptor.
 */

interface Sample {
  name: string;
  page: number;
  text: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL ?? "http://localhost:8787";
const samples: Sample[] = JSON.parse(readFileSync(path.join(here, "samples.json"), "utf8"));

const health = await fetch(`${API_URL}/health`).catch(() => null);
if (!health?.ok) {
  console.error(`API não respondeu em ${API_URL}. Rode: npm run dev -w @illusion/api`);
  process.exit(1);
}

const pages: Preset["pages"] = [];
let totalIn = 0;
let totalOut = 0;

for (const sample of samples) {
  const started = Date.now();
  const response = await fetch(`${API_URL}/pages/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ page: sample.page, text: sample.text }),
  });
  const elapsed = Date.now() - started;
  const body: unknown = await response.json();

  if (!response.ok) {
    console.log(`\n## ${sample.name}  →  HTTP ${response.status}`);
    console.log(JSON.stringify(body));
    continue;
  }

  const result = AnalyzeResponseSchema.parse(body);
  const { visual, sound, transitionSeconds } = result.page;
  totalIn += result.usage.inputTokens;
  totalOut += result.usage.outputTokens;
  pages.push(result.page);

  console.log(`\n## ${sample.name}  (pág. ${sample.page}, ${elapsed} ms, tokens in=${result.usage.inputTokens} cache=${result.usage.cacheReadTokens} out=${result.usage.outputTokens})`);
  console.log(`   ${result.summary}`);
  console.log(`   motion=${visual.motion} speed=${visual.speed} brightness=${visual.brightness} contrast=${visual.contrast} transição=${transitionSeconds}s`);
  console.log(`   paleta=${visual.palette.join(" ")}`);
  console.log(`   som=${sound.map((layer) => `${layer.id}:${layer.gain}`).join("  ")}`);
  console.log(`   página detectada=${result.detectedPage ?? "nenhuma"}`);
}

if (pages.length > 0) {
  const preset: Preset = {
    version: 1,
    id: "ai-samples",
    isbn13: "9780000000001",
    title: "Amostras geradas por IA",
    source: "ai",
    pageOffset: 0,
    pages,
  };
  const outDir = path.join(here, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "preset.json"), JSON.stringify(preset, null, 2));
  console.log(`\n${pages.length} páginas, ${totalIn} tokens de entrada, ${totalOut} de saída. Preset em ${path.relative(process.cwd(), path.join(outDir, "preset.json"))}`);
}
