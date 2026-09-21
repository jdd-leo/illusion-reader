import type { ChapterOutline } from "@illusion/schema";
import { create } from "zustand";
import { analyzeBook } from "../api/chapters";
import { useLibrary, type Book } from "./library";
import { useSettings } from "./settings";

/**
 * Geração do ambiente de um livro em segundo plano. O leitor confirma o sumário e vai ler;
 * quando a análise termina, o preset entra na biblioteca e o leitor recebe as cenas.
 * Só em memória: fechar o app no meio cancela, e o livro volta a oferecer "Preparar ambiente".
 */

interface Job {
  status: "running" | "error";
  error?: string;
  startedAt: number;
}

interface PreparationState {
  jobs: Record<string, Job>;
  prepare: (book: Book, chapters: ChapterOutline[]) => Promise<void>;
  dismissError: (isbn13: string) => void;
}

export const usePreparation = create<PreparationState>()((set, get) => ({
  jobs: {},

  prepare: async (book, chapters) => {
    if (get().jobs[book.isbn13]?.status === "running") return;
    set((state) => ({ jobs: { ...state.jobs, [book.isbn13]: { status: "running", startedAt: Date.now() } } }));
    try {
      const result = await analyzeBook(useSettings.getState().serverHost, {
        isbn13: book.isbn13,
        title: book.title,
        ...(book.authors[0] ? { author: book.authors.join(", ") } : {}),
        ...(book.pageCount ? { totalPages: book.pageCount } : {}),
        chapters,
      });
      useLibrary.getState().setBookChapters(book.isbn13, book.title, result.chapters);
      set((state) => {
        const jobs = { ...state.jobs };
        delete jobs[book.isbn13];
        return { jobs };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha ao preparar o ambiente";
      set((state) => ({ jobs: { ...state.jobs, [book.isbn13]: { status: "error", error: message, startedAt: state.jobs[book.isbn13]?.startedAt ?? Date.now() } } }));
    }
  },

  dismissError: (isbn13) =>
    set((state) => {
      const jobs = { ...state.jobs };
      delete jobs[isbn13];
      return { jobs };
    }),
}));
