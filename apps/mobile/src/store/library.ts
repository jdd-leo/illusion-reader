import type { Page, Preset } from "@illusion/schema";
import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BookInfo } from "../api/books";

export interface Book extends BookInfo {
  addedAt: string;
}

interface LibraryState {
  books: Record<string, Book>;
  presets: Record<string, Preset>;
  addBook: (info: BookInfo) => void;
  removeBook: (isbn13: string) => void;
  addPreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  /** Adiciona ou substitui uma página no preset gerado por IA do livro, criando o preset se preciso. */
  upsertAiPage: (isbn13: string, bookTitle: string, page: Page) => void;
  /** Renumera uma página do preset de IA (correção manual do usuário). */
  moveAiPage: (isbn13: string, from: number, to: number) => void;
}

export const aiPresetId = (isbn13: string): string => `ai-${isbn13}`;

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      books: {},
      presets: {},
      addBook: (info) =>
        set((state) => ({
          books: { ...state.books, [info.isbn13]: { ...state.books[info.isbn13], ...info, addedAt: state.books[info.isbn13]?.addedAt ?? new Date().toISOString() } },
        })),
      removeBook: (isbn13) =>
        set((state) => {
          const books = { ...state.books };
          delete books[isbn13];
          const presets = Object.fromEntries(Object.entries(state.presets).filter(([, preset]) => preset.isbn13 !== isbn13));
          return { books, presets };
        }),
      addPreset: (preset) => set((state) => ({ presets: { ...state.presets, [preset.id]: preset } })),
      removePreset: (id) =>
        set((state) => {
          const presets = { ...state.presets };
          delete presets[id];
          return { presets };
        }),
      upsertAiPage: (isbn13, bookTitle, page) =>
        set((state) => {
          const id = aiPresetId(isbn13);
          const existing = state.presets[id];
          const pages = [...(existing?.pages ?? []).filter((p) => p.page !== page.page), page].sort((a, b) => a.page - b.page);
          const preset: Preset = existing
            ? { ...existing, pages }
            : { version: 1, id, isbn13, title: `${bookTitle} (IA)`, source: "ai", pageOffset: 0, pages };
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
