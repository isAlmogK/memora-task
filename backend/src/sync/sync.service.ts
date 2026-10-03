import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { syncRun } from '../db/schema';
import type { SyncRunDto } from './sync.dto';
import { SyncWorker } from './sync.worker';

type SyncRunRow = typeof syncRun.$inferSelect;

export function toSyncRunDto(r: SyncRunRow): SyncRunDto {
  return {
    id: r.id,
    source: r.source,
    status: r.status,
    eventsIngested: r.eventsIngested,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

/** The API side of syncing: queue a run, read runs. The work happens in SyncWorker. */
@Injectable()
export class SyncService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly worker: SyncWorker,
  ) {}

  /**
   * Queues a Kindle sync, or returns the one already queued/running: the partial unique
   * index allows one active run per user, so a double click (or two tabs) can't start two.
   */
  async start(userId: string): Promise<SyncRunDto> {
    const [created] = await this.db
      .insert(syncRun)
      .values({ userId, source: 'kindle_sim' })
      .onConflictDoNothing({ target: syncRun.userId, where: inArray(syncRun.status, ['queued', 'running']) })
      .returning();
    if (created) {
      this.worker.kick();
      return toSyncRunDto(created);
    }

    const [active] = await this.db
      .select()
      .from(syncRun)
      .where(and(eq(syncRun.userId, userId), inArray(syncRun.status, ['queued', 'running'])))
      .limit(1);
    // the active run finished between the two statements: start a fresh one
    return active ? toSyncRunDto(active) : this.start(userId);
  }

  async get(userId: string, id: string): Promise<SyncRunDto> {
    const [row] = await this.db
      .select()
      .from(syncRun)
      .where(and(eq(syncRun.userId, userId), eq(syncRun.id, id)))
      .limit(1);
    if (!row) throw ApiError.notFound('Sync run');
    return toSyncRunDto(row);
  }

  async list(userId: string, limit = 10): Promise<SyncRunDto[]> {
    const rows = await this.db
      .select()
      .from(syncRun)
      .where(eq(syncRun.userId, userId))
      .orderBy(desc(syncRun.createdAt), desc(syncRun.id))
      .limit(limit);
    return rows.map(toSyncRunDto);
  }
}
