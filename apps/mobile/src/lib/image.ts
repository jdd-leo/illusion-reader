import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAX_WIDTH = 1000;
const JPEG_QUALITY = 0.7;

/** Reduz a foto para a análise por imagem: menos tokens, upload rápido, leitura ainda boa. */
export async function shrinkForAnalysis(uri: string): Promise<{ base64: string; width: number; height: number }> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH, height: null }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error("não foi possível codificar a imagem");
  return { base64: saved.base64, width: saved.width, height: saved.height };
}
