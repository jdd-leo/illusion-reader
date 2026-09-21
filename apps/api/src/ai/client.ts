import Anthropic from "@anthropic-ai/sdk";

/** Cliente e tratamento de erros compartilhados por todas as análises (página, sumário, livro, capítulo). */

export const MODEL = process.env.ANALYZE_MODEL ?? "claude-opus-5";
export const EFFORT = (process.env.ANALYZE_EFFORT ?? "medium") as "low" | "medium" | "high";

export class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 429 | 502 | 503,
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

export interface Completion {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/**
 * Executa a requisição em streaming (a análise de um livro inteiro pode passar de 10k tokens de saída),
 * mapeia erros da API para AnalyzeError e devolve o texto da resposta já verificado.
 */
export async function complete(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Completion> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await createWithFallbacks(params);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AnalyzeError("limite de requisições do modelo", 429);
    if (error instanceof Anthropic.APIConnectionError) throw new AnalyzeError("sem conexão com o modelo", 503);
    if (error instanceof Anthropic.APIError) throw new AnalyzeError(`erro do modelo: ${error.message}`, 502);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new AnalyzeError("o modelo recusou a análise", 502);
  if (response.stop_reason === "max_tokens") throw new AnalyzeError("resposta do modelo truncada", 502);

  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new AnalyzeError("resposta do modelo sem conteúdo", 502);

  return {
    text,
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
  if (!fallbacksSupported) return client.beta.messages.stream(params).finalMessage();

  const withFallbacks: ParamsWithFallbacks = { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  try {
    return await client.beta.messages.stream(withFallbacks as Anthropic.Beta.MessageCreateParamsNonStreaming).finalMessage();
  } catch (error) {
    const isFallbackRejection = error instanceof Anthropic.BadRequestError && /fallback/i.test(error.message);
    if (!isFallbackRejection) throw error;
    console.warn("[ai] API rejeitou fallbacks; seguindo sem eles:", error.message);
    fallbacksSupported = false;
    return client.beta.messages.stream(params).finalMessage();
  }
}

export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
