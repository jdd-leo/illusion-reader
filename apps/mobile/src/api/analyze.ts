import { AnalyzeResponseSchema, type AnalyzeRequest, type AnalyzeResponse } from "@illusion/schema";
import { apiUrl } from "./config";

const TIMEOUT_MS = 90_000;

/** POST /pages/analyze. Texto do OCR ou foto reduzida; a API devolve a Page validada. */
export async function analyzePage(host: string, request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl(host)}/pages/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return AnalyzeResponseSchema.parse(body);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("a análise demorou demais");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
