import type { z } from "zod";
import { apiUrl } from "./config";

/** POST JSON na API com timeout e resposta validada pelo schema. Erros da API viram Error com a mensagem do servidor. */
export async function postJson<T>(host: string, path: string, body: unknown, schema: z.ZodType<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiUrl(host)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error: unknown }).error) : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("o servidor demorou demais");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
