import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MOTION_TYPES, PageSchema, SOUND_LAYER_IDS, type AnalyzeRequest, type AnalyzeResponse } from "@illusion/schema";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./prompt";

const MODEL = process.env.ANALYZE_MODEL ?? "claude-opus-5";
const EFFORT = (process.env.ANALYZE_EFFORT ?? "medium") as "low" | "medium" | "high";
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

export class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

/** Criado no primeiro uso para a API subir (relay incluso) mesmo sem chave configurada. */
function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AnalyzeError("análise indisponível: ANTHROPIC_API_KEY não configurada", 503);
  }
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  client = new Anthropic({
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });
  return client;
}

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

  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: EFFORT, format: zodOutputFormat(SceneOutputSchema) },
  };

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await createWithFallbacks(params);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AnalyzeError("limite de requisições do modelo", 429);
    if (error instanceof Anthropic.APIConnectionError) throw new AnalyzeError("sem conexão com o modelo", 503);
    if (error instanceof Anthropic.APIError) throw new AnalyzeError(`erro do modelo: ${error.message}`, 502);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new AnalyzeError("o modelo recusou analisar esta página", 502);
  if (response.stop_reason === "max_tokens") throw new AnalyzeError("resposta do modelo truncada", 502);

  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new AnalyzeError("resposta do modelo sem conteúdo", 502);

  const scene = SceneOutputSchema.safeParse(safeJson(text));
  if (!scene.success) throw new AnalyzeError("resposta do modelo fora do formato", 502);

  const page = PageSchema.safeParse(normalize(scene.data, request.page ?? scene.data.detectedPage ?? 1));
  if (!page.success) throw new AnalyzeError(`cena inválida: ${page.error.issues[0]?.message ?? "?"}`, 502);

  return {
    page: page.data,
    detectedPage: scene.data.detectedPage,
    summary: scene.data.summary,
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Se o classificador de segurança recusar, o servidor reexecuta em outro modelo (fallbacks "default").
 * O SDK ainda não tipa o parâmetro; se a API rejeitar o beta, repete uma vez sem ele.
 */
type ParamsWithFallbacks = Anthropic.Beta.MessageCreateParamsNonStreaming & { fallbacks?: "default" };
let fallbacksSupported = true;

async function createWithFallbacks(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage> {
  const client = getClient();
  if (!fallbacksSupported) return client.beta.messages.create(params);

  const withFallbacks: ParamsWithFallbacks = { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  try {
    return await client.beta.messages.create(withFallbacks as Anthropic.Beta.MessageCreateParamsNonStreaming);
  } catch (error) {
    const isFallbackRejection = error instanceof Anthropic.BadRequestError && /fallback/i.test(error.message);
    if (!isFallbackRejection) throw error;
    console.warn("[analyze] API rejeitou fallbacks; seguindo sem eles:", error.message);
    fallbacksSupported = false;
    return client.beta.messages.create(params);
  }
}

/** Ajusta ruído numérico e deduplica camadas; o que não for corrigível o PageSchema rejeita. */
function normalize(scene: z.infer<typeof SceneOutputSchema>, pageNumber: number): unknown {
  const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const seen = new Set<string>();
  const sound = scene.sound
    .filter((layer) => (seen.has(layer.id) ? false : seen.add(layer.id)))
    .slice(0, 6)
    .map((layer) => ({ id: layer.id, gain: round(clamp(layer.gain)) }));

  return {
    page: pageNumber,
    visual: {
      palette: scene.visual.palette.slice(0, 5).map((color) => color.trim().toLowerCase()),
      brightness: round(clamp(scene.visual.brightness)),
      contrast: round(clamp(scene.visual.contrast)),
      motion: scene.visual.motion,
      speed: round(clamp(scene.visual.speed)),
    },
    sound,
    transitionSeconds: round(clamp(scene.transitionSeconds, 0, 30)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
