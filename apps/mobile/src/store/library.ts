import type { Chapter, Page, Preset } from "@illusion/schema";
import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BookInfo } from "../api/books";
import { neutralScene } from "../lib/scenes";

export interface Book extends BookInfo {
  addedAt: string;
}

export interface ReadingProgress {
  chapterIndex: number;
  sceneIndex: number;
  updatedAt: string;
}

/** "Não combina" guardado para envio quando o servidor tiver o endpoint de feedback. */
export interface SceneFeedback {
  isbn13: string;
  chapterIndex: number;
  sceneIndex: number;
  at: string;
}

interface LibraryState {
  books: Record<string, Book>;
  presets: Record<string, Preset>;
  progress: Record<string, ReadingProgress>;
  feedback: SceneFeedback[];
  addBook: (info: BookInfo) => void;
  removeBook: (isbn13: string) => void;
  addPreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  /** Ambiente por capítulo do livro (fluxo principal). Substitui o anterior. */
  setBookChapters: (isbn13: string, bookTitle: string, chapters: Chapter[]) => void;
  /** Troca um capítulo do ambiente do livro (refinamento pela primeira página). */
  replaceChapter: (isbn13: string, chapter: Chapter) => void;
  /** Leitor disse que a cena não combina: vira neutra e o feedback fica guardado. */
  markSceneWrong: (isbn13: string, chapterIndex: number, sceneIndex: number) => void;
  setProgress: (isbn13: string, chapterIndex: number, sceneIndex: number) => void;
  /** Adiciona ou substitui uma página no preset por página do livro (modo avançado). */
  upsertAiPage: (isbn13: string, bookTitle: string, page: Page) => void;
  /** Renumera uma página do preset por página (correção manual do usuário). */
  moveAiPage: (isbn13: string, from: number, to: number) => void;
}

export const aiPresetId = (isbn13: string): string => `ai-${isbn13}`;
export const bookPresetId = (isbn13: string): string => `book-${isbn13}`;
export const isbnFromBookPresetId = (presetId: string): string | null => (presetId.startsWith("book-") ? presetId.slice(5) : null);

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      books: {},
      presets: {},
      progress: {},
      feedback: [],
      addBook: (info) =>
        set((state) => ({
          books: { ...state.books, [info.isbn13]: { ...state.books[info.isbn13], ...info, addedAt: state.books[info.isbn13]?.addedAt ?? new Date().toISOString() } },
        })),
      removeBook: (isbn13) =>
        set((state) => {
          const books = { ...state.books };
          delete books[isbn13];
          const progress = { ...state.progress };
          delete progress[isbn13];
          const presets = Object.fromEntries(Object.entries(state.presets).filter(([, preset]) => preset.isbn13 !== isbn13));
          return { books, presets, progress };
        }),
      addPreset: (preset) => set((state) => ({ presets: { ...state.presets, [preset.id]: preset } })),
      removePreset: (id) =>
        set((state) => {
          const presets = { ...state.presets };
          delete presets[id];
          return { presets };
        }),
      setBookChapters: (isbn13, bookTitle, chapters) =>
        set((state) => {
          const id = bookPresetId(isbn13);
          const preset: Preset = { version: 1, id, isbn13, title: bookTitle, source: "ai", pageOffset: 0, chapters, pages: [] };
          return { presets: { ...state.presets, [id]: preset } };
        }),
      replaceChapter: (isbn13, chapter) =>
        set((state) => {
          const id = bookPresetId(isbn13);
          const preset = state.presets[id];
          if (!preset) return {};
          const chapters = preset.chapters.map((existing) => (existing.index === chapter.index ? chapter : existing));
          return { presets: { ...state.presets, [id]: { ...preset, chapters } } };
        }),
      markSceneWrong: (isbn13, chapterIndex, sceneIndex) =>
        set((state) => {
          const id = bookPresetId(isbn13);
          const preset = state.presets[id];
          const chapter = preset?.chapters.find((c) => c.index === chapterIndex);
          const scene = chapter?.scenes[sceneIndex];
          if (!preset || !chapter || !scene) return {};
          const scenes = chapter.scenes.map((existing, i) => (i === sceneIndex ? neutralScene(existing.weight) : existing));
          const chapters = preset.chapters.map((existing) => (existing.index === chapterIndex ? { ...chapter, scenes } : existing));
          const feedback = [...state.feedback, { isbn13, chapterIndex, sceneIndex, at: new Date().toISOString() }].slice(-200);
          return { presets: { ...state.presets, [id]: { ...preset, chapters } }, feedback };
        }),
      setProgress: (isbn13, chapterIndex, sceneIndex) =>
        set((state) => ({ progress: { ...state.progress, [isbn13]: { chapterIndex, sceneIndex, updatedAt: new Date().toISOString() } } })),
      upsertAiPage: (isbn13, bookTitle, page) =>
        set((state) => {
          const id = aiPresetId(isbn13);
          const existing = state.presets[id];
          const pages = [...(existing?.pages ?? []).filter((p) => p.page !== page.page), page].sort((a, b) => a.page - b.page);
          const preset: Preset = existing
            ? { ...existing, pages }
            : { version: 1, id, isbn13, title: `${bookTitle} (por página)`, source: "ai", pageOffset: 0, chapters: [], pages };
          return { presets: { ...state.presets, [id]: preset } };
        }),
      moveAiPage: (isbn13, from, to) =>
        set((state) => {
          const id = aiPresetId(isbn13);
          const preset = state.presets[id];
          const moved = preset?.pages.find((p) => p.page === from);
          if (!preset || !moved || from === to) return {};
          const pages = [...preset.pages.filter((p) => p.page !== from && p.page !== to), { ...moved, page: to }].sort((a, b) => a.page - b.page);
          return { presets: { ...state.presets, [id]: { ...preset, pages } } };
        }),
    }),
    { name: "illusion.library", storage: createJSONStorage(() => Storage) },
  ),
);

export function presetsForBook(presets: Record<string, Preset>, isbn13: string): Preset[] {
  return Object.values(presets).filter((preset) => preset.isbn13 === isbn13);
}

/** Presets por página de um livro (modo avançado); o ambiente por capítulo fica de fora. */
export function pagePresetsForBook(presets: Record<string, Preset>, isbn13: string): Preset[] {
  return presetsForBook(presets, isbn13).filter((preset) => preset.chapters.length === 0);
}
