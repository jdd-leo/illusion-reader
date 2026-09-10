interface Line {
  text: string;
  frame?: { top: number; height: number };
}

const PAGE_NUMBER = /^\s*(\d{1,4})\s*$/;

/**
 * Número de página impresso: uma linha só com dígitos no topo ou no rodapé da foto.
 * Com as caixas do OCR escolhe a linha mais extrema; sem elas, a primeira ou a última.
 */
export function detectPageNumber(lines: Line[]): number | null {
  const candidates = lines
    .map((line, index) => ({ index, value: line.text.match(PAGE_NUMBER)?.[1], frame: line.frame }))
    .filter((c): c is { index: number; value: string; frame: Line["frame"] } => c.value !== undefined);
  if (candidates.length === 0) return null;

  const total = lines.length;
  const withFrames = candidates.filter((c) => c.frame);
  const pick =
    withFrames.length > 0
      ? withFrames.reduce((best, c) => (extremeness(c.frame!, lines) > extremeness(best.frame!, lines) ? c : best))
      : candidates.reduce((best, c) => (Math.min(c.index, total - 1 - c.index) < Math.min(best.index, total - 1 - best.index) ? c : best));

  const value = Number(pick.value);
  return value > 0 ? value : null;
}

/** Distância do centro vertical da página: cabeçalho e rodapé pontuam alto. */
function extremeness(frame: { top: number; height: number }, lines: Line[]): number {
  const tops = lines.map((l) => l.frame?.top ?? 0);
  const bottoms = lines.map((l) => (l.frame ? l.frame.top + l.frame.height : 0));
  const minTop = Math.min(...tops);
  const maxBottom = Math.max(...bottoms);
  const center = (minTop + maxBottom) / 2;
  return Math.abs(frame.top + frame.height / 2 - center);
}
