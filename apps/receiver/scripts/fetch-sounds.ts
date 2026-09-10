import { SOUND_LAYER_IDS, type SoundLayerId } from "@illusion/schema";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Baixa uma gravação CC0 do Freesound para cada id da taxonomia, em public/sounds/<id>.ogg.
 * Usa o preview HQ em OGG (128 kbps), suficiente para ambiência e sem precisar de ffmpeg.
 * Exige FREESOUND_API_KEY (https://freesound.org/apiv2/apply). Grava manifest.json com a origem.
 *
 *   FREESOUND_API_KEY=... npx tsx scripts/fetch-sounds.ts            # só ids ainda sem arquivo
 *   FREESOUND_API_KEY=... npx tsx scripts/fetch-sounds.ts --force    # baixa tudo de novo
 *   FREESOUND_API_KEY=... npx tsx scripts/fetch-sounds.ts river ocean_waves
 */

interface FreesoundResult {
  id: number;
  name: string;
  username: string;
  license: string;
  duration: number;
  avg_rating: number;
  num_ratings: number;
  tags: string[];
  previews: { "preview-hq-ogg": string };
}

interface Query {
  query: string;
  tags: string[];
  /** Palavras em nome ou tags que descartam o resultado. */
  exclude?: string[];
  allowMusic?: boolean;
}

/** Palavras que denunciam música ou efeito processado, não ambiência. */
const OFF_TOPIC = /(\d*\s?bpm|\b(song|track|beat|remix|melody|synth|chord|riff|jingle)\b)/i;

interface ManifestEntry {
  freesoundId: number;
  name: string;
  author: string;
  license: string;
  duration: number;
  query: string;
  url: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "sounds");
const manifestPath = path.join(outDir, "manifest.json");
const queries: Record<string, Query> = JSON.parse(readFileSync(path.join(here, "sound-queries.json"), "utf8"));

const apiKey = process.env.FREESOUND_API_KEY;
if (!apiKey) {
  console.error("Defina FREESOUND_API_KEY. Chave gratuita em https://freesound.org/apiv2/apply");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const requested = args.filter((arg) => !arg.startsWith("--"));
const ids: SoundLayerId[] = requested.length > 0 ? (requested as SoundLayerId[]) : [...SOUND_LAYER_IDS];

mkdirSync(outDir, { recursive: true });
const manifest: Record<string, ManifestEntry> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

let downloaded = 0;
for (const id of ids) {
  const target = path.join(outDir, `${id}.ogg`);
  if (!force && existsSync(target)) continue;
  const query = queries[id];
  if (!query) {
    console.warn(`${id}: sem consulta em sound-queries.json`);
    continue;
  }

  try {
    const result = await search(query);
    if (!result) {
      console.warn(`${id}: nada encontrado para "${query.query}"`);
      continue;
    }
    const audio = await fetch(result.previews["preview-hq-ogg"]);
    if (!audio.ok) throw new Error(`download ${audio.status}`);
    writeFileSync(target, Buffer.from(await audio.arrayBuffer()));
    manifest[id] = {
      freesoundId: result.id,
      name: result.name,
      author: result.username,
      license: result.license,
      duration: Math.round(result.duration),
      query: query.query,
      url: `https://freesound.org/s/${result.id}/`,
    };
    downloaded++;
    console.log(`${id}: "${result.name}" (${Math.round(result.duration)}s, nota ${result.avg_rating.toFixed(1)}, tags ${result.tags.slice(0, 5).join(",")})`);
  } catch (error) {
    console.warn(`${id}: falhou: ${error instanceof Error ? error.message : String(error)}`);
  }
  // Freesound limita a 60 requisições por minuto na chave gratuita.
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n${downloaded} arquivo(s) baixado(s). Manifesto em ${path.relative(process.cwd(), manifestPath)}`);

/**
 * Busca por relevância e reordena: cada tag esperada presente vale mais que nota.
 * Nota só desempata, e só quando há avaliações. Nomes musicais são descartados.
 */
async function search({ query, tags, exclude = [], allowMusic = false }: Query): Promise<FreesoundResult | null> {
  const params = new URLSearchParams({
    query,
    filter: 'license:"Creative Commons 0" duration:[20 TO 240]',
    fields: "id,name,username,license,duration,avg_rating,num_ratings,tags,previews",
    sort: "score",
    page_size: "40",
    token: apiKey!,
  });
  const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
  if (!response.ok) throw new Error(`busca ${response.status}`);
  const body = (await response.json()) as { results: FreesoundResult[] };

  const wanted = tags.map((tag) => tag.toLowerCase());
  const banned = exclude.map((word) => word.toLowerCase());
  const scored = body.results
    .filter((r) => allowMusic || !OFF_TOPIC.test(r.name))
    .map((r) => {
      const haystack = [...r.tags.map((t) => t.toLowerCase()), r.name.toLowerCase()];
      if (banned.some((word) => haystack.some((h) => h.includes(word)))) return { r, score: 0 };
      const matches = wanted.filter((tag) => haystack.some((h) => h.includes(tag))).length;
      const rating = r.num_ratings >= 2 ? r.avg_rating / 5 : 0.5;
      const lengthBonus = r.duration >= 40 && r.duration <= 180 ? 0.3 : 0;
      return { r, score: matches * 2 + rating + lengthBonus };
    })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.r ?? null;
}
