import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { Db, InjectDb } from '../db/db.module';
import { userBookProgress as ubp } from '../db/schema';
import type { ProgressSource, PulledEvent } from './progress-source';

const MINUTE = 60_000;

/**
 * Pretends to be a Kindle: for each book you're reading, reports that you read a little
 * further (4–12%, or to the end when you're close). Readings are dated within the last
 * half hour, never before the book's current progress (so they really are newer).
 */
@Injectable()
export class SimulatedKindleSource implements ProgressSource {
  readonly source = 'kindle_sim' as const;

  constructor(@InjectDb() private readonly db: Db) {}

  async *pull({ userId, runId }: { userId: string; runId: string }): AsyncIterable<PulledEvent> {
    const reading = await this.db
      .select({ id: ubp.userBookId, percent: ubp.percent, progressAt: ubp.progressAt })
      .from(ubp)
      .where(and(eq(ubp.userId, userId), eq(ubp.status, 'reading')))
      .orderBy(desc(ubp.progressAt));

    for (const book of reading) {
      const remaining = 100 - book.percent;
      const step = remaining <= 15 ? remaining : 4 + Math.round(Math.random() * 8);
      const now = Date.now();
      const after = (book.progressAt?.getTime() ?? 0) + MINUTE;
      yield {
        userBookId: book.id,
        percent: Math.min(100, Math.round((book.percent + step) * 100) / 100),
        occurredAt: new Date(Math.min(now, Math.max(after, now - Math.random() * 30 * MINUTE))),
        externalId: `kindle-sim:${runId}:${book.id}`,
      };
    }
  }
}
