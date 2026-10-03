import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { book } from '../db/schema';

export type CatalogBook = typeof book.$inferSelect;

@Injectable()
export class CatalogService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** The catalog row for a work, or 404. (Search will import unknown works from Open Library.) */
  async ensureBook(olWorkKey: string): Promise<CatalogBook> {
    const [row] = await this.db.select().from(book).where(eq(book.olWorkKey, olWorkKey)).limit(1);
    if (!row) throw new ApiError(404, 'book_not_found', `No book ${olWorkKey} in the catalog`);
    return row;
  }
}
