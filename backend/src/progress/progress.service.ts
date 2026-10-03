import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { book, readingEvent, userBook } from '../db/schema';
import type { ProgressSource } from '../library/library.dto';

export interface ProgressInput {
  source: ProgressSource;
  percent?: number;
  page?: number;
  /** Defaults to now. Devices send when the reading happened. */
  occurredAt?: Date;
  /** The source's own id; a repeat is ignored (idempotent ingestion). */
  externalId?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The single write path for reading progress, whatever the source: manual entry, an
 * e-reader push, or a sync job. Everything else about progress is derived in SQL.
 */
@Injectable()
export class ProgressService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Returns false when the event was a duplicate (same source + externalId) and was ignored. */
  async record(userId: string, userBookId: string, input: ProgressInput): Promise<boolean> {
    const [target] = await this.db
      .select({ pageCount: book.pageCount })
      .from(userBook)
      .innerJoin(book, eq(book.id, userBook.bookId))
      .where(and(eq(userBook.userId, userId), eq(userBook.id, userBookId)))
      .limit(1);
    if (!target) throw ApiError.notFound('Library book');

    const { percent, page } = this.resolve(input, target.pageCount);
    const inserted = await this.db
      .insert(readingEvent)
      .values({
        userId,
        userBookId,
        source: input.source,
        externalId: input.externalId ?? null,
        percent,
        page,
        occurredAt: input.occurredAt ?? new Date(),
      })
      .onConflictDoNothing({
        target: [readingEvent.userId, readingEvent.source, readingEvent.externalId],
        where: isNotNull(readingEvent.externalId),
      })
      .returning({ id: readingEvent.id });
    return inserted.length > 0;
  }

  /** Percent is canonical; a page is converted with the book's page count (and kept for display). */
  private resolve(input: ProgressInput, pageCount: number | null): { percent: number; page: number | null } {
    const hasPercent = input.percent !== undefined;
    const hasPage = input.page !== undefined;
    if (hasPercent === hasPage) {
      throw ApiError.validation({ percent: 'send exactly one of percent or page' });
    }
    if (hasPage) {
      if (!pageCount) throw new ApiError(400, 'page_unsupported', 'This book has no page count; log a percent instead');
      if (input.page! > pageCount) throw ApiError.validation({ page: `must be between 0 and ${pageCount}` });
      return { percent: round2((input.page! / pageCount) * 100), page: input.page! };
    }
    return { percent: input.percent!, page: pageCount ? Math.round((input.percent! / 100) * pageCount) : null };
  }
}
