import { z } from "zod";

export const BookInfoSchema = z.object({
  isbn13: z.string().regex(/^\d{13}$/),
  title: z.string().min(1),
  authors: z.array(z.string()),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  thumbnail: z.string().url().optional(),
});
export type BookInfo = z.infer<typeof BookInfoSchema>;

const OpenLibrarySchema = z.record(
  z.string(),
  z.object({
    title: z.string(),
    authors: z.array(z.object({ name: z.string() })).optional(),
    publishers: z.array(z.object({ name: z.string() })).optional(),
    publish_date: z.string().optional(),
    number_of_pages: z.number().optional(),
    cover: z.object({ medium: z.string().optional() }).optional(),
  }),
);

const GoogleBooksSchema = z.object({
  items: z
    .array(
      z.object({
        volumeInfo: z.object({
          title: z.string(),
          authors: z.array(z.string()).optional(),
          publisher: z.string().optional(),
          publishedDate: z.string().optional(),
          pageCount: z.number().optional(),
          imageLinks: z.object({ thumbnail: z.string().optional() }).optional(),
        }),
      }),
    )
    .optional(),
});

/**
 * Busca metadados pelo ISBN. Open Library primeiro (sem chave, sem limite agressivo);
 * Google Books como segunda tentativa. Limite de taxa ou indisponibilidade de uma fonte
 * não é erro: só significa passar para a próxima e, no fim, cair no cadastro manual.
 * Em produção isso deve migrar para a API com cache, para não depender do IP do celular.
 */
export async function lookupIsbn(isbn13: string): Promise<BookInfo | null> {
  const sources = [fromOpenLibrary, fromGoogleBooks];
  let lastError: unknown;
  for (const source of sources) {
    try {
      const book = await source(isbn13);
      if (book) return book;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) console.warn("[books] todas as fontes falharam", lastError);
  return null;
}

async function fromOpenLibrary(isbn13: string): Promise<BookInfo | null> {
  const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`);
  if (!response.ok) throw new Error(`Open Library respondeu ${response.status}`);
  const parsed = OpenLibrarySchema.safeParse(await response.json());
  const info = parsed.success ? parsed.data[`ISBN:${isbn13}`] : undefined;
  if (!info) return null;

  return compact({
    isbn13,
    title: info.title,
    authors: (info.authors ?? []).map((author) => author.name),
    publisher: info.publishers?.[0]?.name,
    publishedDate: info.publish_date,
    pageCount: info.number_of_pages,
    thumbnail: info.cover?.medium,
  });
}

async function fromGoogleBooks(isbn13: string): Promise<BookInfo | null> {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`);
  if (response.status === 429) return null;
  if (!response.ok) throw new Error(`Google Books respondeu ${response.status}`);
  const parsed = GoogleBooksSchema.safeParse(await response.json());
  const info = parsed.success ? parsed.data.items?.[0]?.volumeInfo : undefined;
  if (!info) return null;

  return compact({
    isbn13,
    title: info.title,
    authors: info.authors ?? [],
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    pageCount: info.pageCount,
    thumbnail: info.imageLinks?.thumbnail?.replace(/^http:/, "https:"),
  });
}

/** Remove campos vazios e valida, para o que vier torto das fontes não entrar na biblioteca. */
function compact(raw: {
  isbn13: string;
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  thumbnail?: string;
}): BookInfo | null {
  const book: BookInfo = { isbn13: raw.isbn13, title: raw.title.trim(), authors: raw.authors.map((a) => a.trim()).filter(Boolean) };
  if (raw.publisher) book.publisher = raw.publisher;
  if (raw.publishedDate) book.publishedDate = raw.publishedDate;
  if (raw.pageCount && raw.pageCount > 0) book.pageCount = raw.pageCount;
  if (raw.thumbnail) book.thumbnail = raw.thumbnail;
  const parsed = BookInfoSchema.safeParse(book);
  return parsed.success ? parsed.data : null;
}
