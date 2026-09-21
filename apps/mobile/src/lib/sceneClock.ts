import type { Chapter } from "@illusion/schema";

/**
 * Avanço de cenas por tempo. O receptor não sabe de tempo; o app calcula quanto cada cena dura
 * a partir do número de páginas do capítulo e da velocidade de leitura, e manda goto_scene.
 */

export const DEFAULT_MINUTES_PER_PAGE = 1.5;
const MIN_MINUTES_PER_PAGE = 0.5;
const MAX_MINUTES_PER_PAGE = 5;
/** Capítulo sem páginas conhecidas: assume um tamanho típico para as cenas não trocarem cedo demais. */
const FALLBACK_CHAPTER_PAGES = 12;
/** Abaixo disto o capítulo foi pulado, não lido; não ensina nada sobre a velocidade. */
const MIN_MINUTES_TO_LEARN = 2;

export function chapterPageCount(chapter: Chapter): number {
  if (chapter.startPage !== undefined && chapter.endPage !== undefined) return Math.max(1, chapter.endPage - chapter.startPage + 1);
  return FALLBACK_CHAPTER_PAGES;
}

export function chapterDurationMs(chapter: Chapter, minutesPerPage: number): number {
  return chapterPageCount(chapter) * minutesPerPage * 60_000;
}

/** Índice da cena para o tempo decorrido no capítulo. A última cena nunca termina sozinha. */
export function sceneIndexAt(chapter: Chapter, elapsedMs: number, minutesPerPage: number): number {
  const total = chapterDurationMs(chapter, minutesPerPage);
  let cumulative = 0;
  for (const [i, scene] of chapter.scenes.entries()) {
    cumulative += scene.weight * total;
    if (elapsedMs < cumulative) return i;
  }
  return chapter.scenes.length - 1;
}

/** Tempo decorrido correspondente ao início de uma cena, para retomar exatamente nela. */
export function elapsedAtScene(chapter: Chapter, sceneIndex: number, minutesPerPage: number): number {
  const total = chapterDurationMs(chapter, minutesPerPage);
  return chapter.scenes.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.weight * total, 0);
}

export interface ReadingPosition {
  chapterIndex: number;
  sceneIndex: number;
  /** Quanto do capítulo já passou, em ms, para o relógio continuar dali. */
  elapsedMs: number;
}

/** "Estou na página N": capítulo que contém a página e a fração dele já lida. */
export function positionForPage(chapters: Chapter[], page: number, minutesPerPage: number): ReadingPosition | null {
  const withPages = chapters.filter((chapter) => chapter.startPage !== undefined);
  if (withPages.length === 0) return null;
  let chapter = withPages.find((c) => c.startPage! <= page && (c.endPage === undefined || page <= c.endPage));
  if (!chapter) {
    const before = withPages.filter((c) => c.startPage! <= page);
    chapter = before.at(-1) ?? withPages[0]!;
  }
  const pages = chapterPageCount(chapter);
  const fraction = Math.min(1, Math.max(0, (page - chapter.startPage!) / pages));
  const elapsedMs = fraction * chapterDurationMs(chapter, minutesPerPage);
  return { chapterIndex: chapter.index, sceneIndex: sceneIndexAt(chapter, elapsedMs, minutesPerPage), elapsedMs };
}

/** Atualiza a velocidade com o capítulo recém-terminado, suavizando para uma leitura atípica não distorcer. */
export function learnMinutesPerPage(current: number, chapter: Chapter, elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  if (chapter.startPage === undefined || chapter.endPage === undefined || minutes < MIN_MINUTES_TO_LEARN) return current;
  const observed = minutes / chapterPageCount(chapter);
  const blended = current * 0.7 + observed * 0.3;
  return Math.round(Math.min(MAX_MINUTES_PER_PAGE, Math.max(MIN_MINUTES_PER_PAGE, blended)) * 100) / 100;
}
