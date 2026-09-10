import TextRecognition from "@react-native-ml-kit/text-recognition";
import { detectPageNumber } from "./pageNumber";

export interface OcrResult {
  text: string;
  pageNumber: number | null;
}

export class OcrUnavailableError extends Error {}

/** OCR no aparelho com ML Kit. Só existe em dev build; no Expo Go lança OcrUnavailableError. */
export async function recognizePage(uri: string): Promise<OcrResult> {
  let result;
  try {
    result = await TextRecognition.recognize(uri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("linked")) throw new OcrUnavailableError("OCR indisponível no Expo Go; gere o dev build.");
    throw error;
  }

  const lines = result.blocks.flatMap((block) => block.lines);
  const pageNumber = detectPageNumber(lines);
  return { text: cleanText(result.text), pageNumber };
}

/** Junta palavras hifenizadas na quebra de linha e normaliza espaços. */
function cleanText(text: string): string {
  return text
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
