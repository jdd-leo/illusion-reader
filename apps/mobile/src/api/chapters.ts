import {
  BookAnalyzeResponseSchema,
  ChapterRefineResponseSchema,
  TocResponseSchema,
  type BookAnalyzeRequest,
  type BookAnalyzeResponse,
  type ChapterRefineRequest,
  type ChapterRefineResponse,
  type TocRequest,
  type TocResponse,
} from "@illusion/schema";
import { postJson } from "./http";

/** Fluxo por capítulo: sumário, livro inteiro e refinamento de um capítulo. */

export const readToc = (host: string, request: TocRequest): Promise<TocResponse> => postJson(host, "/books/toc", request, TocResponseSchema, 90_000);

/** Um livro inteiro leva em torno de um minuto; o app não espera na tela, roda em segundo plano. */
export const analyzeBook = (host: string, request: BookAnalyzeRequest): Promise<BookAnalyzeResponse> =>
  postJson(host, "/books/analyze", request, BookAnalyzeResponseSchema, 300_000);

export const refineChapter = (host: string, request: ChapterRefineRequest): Promise<ChapterRefineResponse> =>
  postJson(host, "/chapters/refine", request, ChapterRefineResponseSchema, 90_000);
