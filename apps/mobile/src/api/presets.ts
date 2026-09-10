import { PresetSchema, type Preset } from "@illusion/schema";
import { z } from "zod";
import { apiUrl } from "./config";

const TIMEOUT_MS = 8000;

/** GET /dev/presets. Presets de amostra gerados no servidor, para testar sem escanear páginas. */
export async function fetchDevPresets(host: string): Promise<Preset[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl(host)}/dev/presets`, { signal: controller.signal });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return z.array(PresetSchema).parse(body);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("tempo esgotado");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
