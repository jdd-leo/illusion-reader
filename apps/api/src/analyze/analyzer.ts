import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MOTION_TYPES, PageSchema, SOUND_LAYER_IDS, type AnalyzeRequest, type AnalyzeResponse } from "@illusion/schema";
import { z } from "zod";
import { AnalyzeError, complete, EFFORT, MODEL, safeJson } from "../ai/client";
import { clamp, normalizeSound, normalizeVisual, round } from "../ai/normalize";
import { SYSTEM_PROMPT } from "./prompt";

export { AnalyzeError } from "../ai/client";

const MAX_TOKENS = 2000;

/**
 * Forma que o modelo devolve. Sem regex, limites ou defaults: a validação estrita
 * é feita depois com PageSchema, após normalizar o que for só ruído numérico.
 */
const SceneOutputSchema = z.object({
  visual: z.object({
    palette: z.array(z.string()).describe("3 a 5 cores hex #rrggbb, da mais escura para a mais clara"),
    brightness: z.number(),
    contrast: z.number(),
    motion: z.enum(MOTION_TYPES),
    speed: z.number(),
  }),
  sound: z.array(z.object({ id: z.enum(SOUND_LAYER_IDS), gain: z.number() })),
  transitionSeconds: z.number(),
  detectedPage: z.number().nullable(),
  summary: z.string(),
});

export async function analyzePage(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (request.image) {
    content.push({ type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.data } });
  }
  // A página informada pelo leitor não vai ao modelo: detectedPage deve sair só do texto ou da foto.
  const context = [
    request.isbn13 ? `ISBN: ${request.isbn13}` : null,
    request.text ? `Texto da página:\n\n${request.text}` : "A página está na imagem.",
  ]
    .filter((line) => line !== null)
    .join("\n");
  content.push({ type: "text", text: context });

  const result = await complete({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: EFFORT, format: zodOutputFormat(SceneOutputSchema) },
  });

  const scene = SceneOutputSchema.safeParse(safeJson(result.text));
  if (!scene.success) throw new AnalyzeError("resposta do modelo fora do formato", 502);

  const page = PageSchema.safeParse({
    page: request.page ?? scene.data.detectedPage ?? 1,
    visual: normalizeVisual(scene.data.visual),
    sound: normalizeSound(scene.data.sound),
    transitionSeconds: round(clamp(scene.data.transitionSeconds, 0, 30)),
  });
  if (!page.success) throw new AnalyzeError(`cena inválida: ${page.error.issues[0]?.message ?? "?"}`, 502);

  return {
    page: page.data,
    detectedPage: scene.data.detectedPage,
    summary: scene.data.summary,
    model: result.model,
    usage: result.usage,
  };
}
