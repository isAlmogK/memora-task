import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { book, userBook } from '../db/schema';
import { toBookDto } from '../library/library.queries';
import type { CatalogBookDto } from './catalog.dto';
import { CatalogEntry, OpenLibraryClient } from './open-library.client';

export type CatalogBook = typeof book.$inferSelect;

/**
 * Open Library is the source; the `book` table is our cache of it. Every work a search
 * returns is upserted so it can be added straight away. A row that's already cached is
 * left alone: first-seen data wins, so curated rows (pinned genres) aren't overwritten
 * by the next search.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly openLibrary: OpenLibraryClient,
  ) {}

  async search(userId: string, q: string, limit = 20): Promise<CatalogBookDto[]> {
    const entries = await this.openLibrary.search(q, limit);
    if (entries.length === 0) return [];
    await this.cache(entries);

    const keys = entries.map((e) => e.olWorkKey);
    const rows = await this.db
      .select({ book, libraryBookId: userBook.id })
      .from(book)
      .leftJoin(userBook, and(eq(userBook.bookId, book.id), eq(userBook.userId, userId)))
      .where(inArray(book.olWorkKey, keys));
    const byKey = new Map(rows.map((r) => [r.book.olWorkKey, r]));

    // keep Open Library's relevance order
    return keys.flatMap((k) => {
      const r = byKey.get(k);
      return r ? [{ ...toBookDto(r.book), libraryBookId: r.libraryBookId }] : [];
    });
  }

  /** The catalog row for a work; imports it from Open Library if it was never searched. */
  async ensureBook(olWorkKey: string): Promise<CatalogBook> {
    const cached = await this.find(olWorkKey);
    if (cached) return cached;
    const entry = await this.openLibrary.getWork(olWorkKey);
    if (!entry) throw new ApiError(404, 'book_not_found', `Open Library has no work ${olWorkKey}`);
    await this.cache([entry]);
    return (await this.find(olWorkKey))!;
  }

  private async find(olWorkKey: string): Promise<CatalogBook | undefined> {
    const [row] = await this.db.select().from(book).where(eq(book.olWorkKey, olWorkKey)).limit(1);
    return row;
  }

  private async cache(entries: CatalogEntry[]): Promise<void> {
    // one search can return the same work twice; a single INSERT can't touch a row twice
    const unique = [...new Map(entries.map((e) => [e.olWorkKey, e])).values()];
    await this.db.insert(book).values(unique).onConflictDoNothing({ target: book.olWorkKey });
  }
}
