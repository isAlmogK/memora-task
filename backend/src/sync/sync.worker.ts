import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { config } from '../config';
import { Db, InjectDb } from '../db/db.module';
import { syncRun } from '../db/schema';
import { ProgressService } from '../progress/progress.service';
import { PROGRESS_SOURCE, type ProgressSource } from './progress-source';

/** A run still "running" this long after it started has lost its worker. */
const STALE_AFTER = '5 minutes';
/** Looking for stale runs is housekeeping: once a minute is plenty, not every poll. */
const STALE_CHECK_EVERY_MS = 60_000;

/**
 * Background worker: polls for queued runs and processes them one at a time.
 *
 * Claiming uses FOR UPDATE SKIP LOCKED, so several API instances can each run a worker
 * without ever taking the same job. Events go through ProgressService (the same path as
 * manual entry and device pushes), and events_ingested ticks up after each one, so the
 * UI can show the sync landing book by book.
 */
@Injectable()
export class SyncWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(SyncWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lastStaleCheck = 0;

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly progress: ProgressService,
    @Inject(PROGRESS_SOURCE) private readonly source: ProgressSource,
  ) {}

  onApplicationBootstrap(): void {
    if (!config.sync.workerEnabled) return; // tests drive tick() themselves
    // The poll is a backstop (runs queued by another instance, or while this one was busy):
    // a run queued here gets kick()ed straight away.
    this.timer = setInterval(() => void this.drain(), config.sync.pollMs);
  }

  /** Called when a run is queued in this process, so it starts now instead of on the next poll. */
  kick(): void {
    if (config.sync.workerEnabled) void this.drain();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Processes queued runs until there are none left. */
  private async drain(): Promise<void> {
    while (await this.tick());
  }

  /** Claims and processes at most one queued run. Returns whether it found one. */
  async tick(): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      if (Date.now() - this.lastStaleCheck >= STALE_CHECK_EVERY_MS) {
        this.lastStaleCheck = Date.now();
        await this.recoverStaleRuns();
      }
      const { rows } = await this.db.execute<{ id: string; user_id: string }>(sql`
        update ${syncRun} set status = 'running', started_at = now()
        where id = (
          select id from ${syncRun}
          where status = 'queued'
          order by created_at
          for update skip locked
          limit 1
        )
        returning id, user_id
      `);
      const job = rows[0];
      if (!job) return false;
      await this.process(job.id, job.user_id);
      return true;
    } finally {
      this.busy = false;
    }
  }

  private async process(runId: string, userId: string): Promise<void> {
    try {
      for await (const ev of this.source.pull({ userId, runId })) {
        const recorded = await this.progress.record(userId, ev.userBookId, {
          source: this.source.source,
          percent: ev.percent,
          occurredAt: ev.occurredAt,
          externalId: ev.externalId,
        });
        if (recorded) {
          await this.db
            .update(syncRun)
            .set({ eventsIngested: sql`${syncRun.eventsIngested} + 1` })
            .where(eq(syncRun.id, runId));
        }
        if (config.sync.stepMs > 0) await new Promise((r) => setTimeout(r, config.sync.stepMs));
      }
      await this.finish(runId, 'succeeded', null);
    } catch (err) {
      this.log.warn(`sync ${runId} failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.finish(runId, 'failed', 'The Kindle sync stopped unexpectedly. Try again.');
    }
  }

  private async finish(runId: string, status: 'succeeded' | 'failed', error: string | null): Promise<void> {
    await this.db.update(syncRun).set({ status, error, finishedAt: new Date() }).where(eq(syncRun.id, runId));
  }

  /** A crash mid-run would otherwise leave the user's single active slot taken forever. */
  async recoverStaleRuns(): Promise<void> {
    await this.db
      .update(syncRun)
      .set({ status: 'failed', error: 'The sync was interrupted. Try again.', finishedAt: new Date() })
      .where(and(eq(syncRun.status, 'running'), lt(syncRun.startedAt, sql`now() - ${STALE_AFTER}::interval`)));
  }
}
