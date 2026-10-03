/** Sync runs: one active per user, the worker's claim/process cycle, and failure handling. */
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { PROGRESS_SOURCE, type ProgressSource } from '../src/sync/progress-source';
import { SyncWorker } from '../src/sync/sync.worker';
import { as, createHarness, daysAgo, Fixture, Harness, KEYS, resetDb } from './harness';

describe('with the simulated Kindle', () => {
  let h: Harness;
  let fx: Fixture;
  let worker: SyncWorker;
  const alice = () => as(h.app, KEYS.alice);

  beforeAll(async () => {
    h = await createHarness();
    worker = h.app.get(SyncWorker);
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    fx = await resetDb(h.db);
  });

  async function reading(bookId: string, percent: number) {
    const [ub] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId }).returning();
    await h.db.insert(schema.readingEvent).values({ userId: fx.alice, userBookId: ub!.id, source: 'manual', percent, occurredAt: daysAgo(1) });
    return ub!.id;
  }

  it('queues a run (202); starting again while it is active returns the same run', async () => {
    const first = await alice().post('/v1/sync-runs').expect(202);
    expect(first.body).toMatchObject({ status: 'queued', source: 'kindle_sim', eventsIngested: 0 });
    const again = await alice().post('/v1/sync-runs').expect(202);
    expect(again.body.id).toBe(first.body.id);
    // another user has their own slot
    const bob = await as(h.app, KEYS.bob).post('/v1/sync-runs').expect(202);
    expect(bob.body.id).not.toBe(first.body.id);
  });

  it('the worker claims the run, moves every book you are reading forward, and finishes', async () => {
    const dune = await reading(fx.books.dune, 40);
    const phm = await reading(fx.books.hailMary, 90); // ≤ 15% left: the sync finishes it
    const { body: run } = await alice().post('/v1/sync-runs');

    expect(await worker.tick()).toBe(true);
    expect(await worker.tick()).toBe(false); // nothing left to claim

    const done = (await alice().get(`/v1/sync-runs/${run.id}`).expect(200)).body;
    expect(done).toMatchObject({ status: 'succeeded', eventsIngested: 2, error: null });
    expect(done.startedAt).not.toBeNull();

    const duneNow = (await alice().get(`/v1/library/${dune}`)).body;
    expect(duneNow.progress.percent).toBeGreaterThan(40);
    expect(duneNow.progress.source).toBe('kindle_sim');
    expect((await alice().get(`/v1/library/${phm}`)).body.status).toBe('finished');

    // the slot is free again
    const next = await alice().post('/v1/sync-runs').expect(202);
    expect(next.body.id).not.toBe(run.id);
  });

  it('marks a run whose worker died as failed, freeing the slot', async () => {
    const [stuck] = await h.db
      .insert(schema.syncRun)
      .values({ userId: fx.alice, source: 'kindle_sim', status: 'running', startedAt: new Date(Date.now() - 10 * 60_000) })
      .returning();
    await worker.tick();
    const [row] = await h.db.select().from(schema.syncRun).where(eq(schema.syncRun.id, stuck!.id));
    expect(row).toMatchObject({ status: 'failed', error: 'The sync was interrupted. Try again.' });
  });

  it('keeps runs private, lists newest first, and validates', async () => {
    const { body: run } = await alice().post('/v1/sync-runs');
    await as(h.app, KEYS.bob).get(`/v1/sync-runs/${run.id}`).expect(404);
    await as(h.app, KEYS.aliceDevice).post('/v1/sync-runs').expect(403);
    await alice().get('/v1/sync-runs?limit=0').expect(400);
    const list = (await alice().get('/v1/sync-runs?limit=5').expect(200)).body as { id: string }[];
    expect(list.map((r) => r.id)).toEqual([run.id]);
  });
});

describe('when the source fails', () => {
  let h: Harness;
  const broken: ProgressSource = {
    source: 'kindle_sim',
    pull: () => ({
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('Kindle session expired')) }),
    }),
  };

  beforeAll(async () => {
    h = await createHarness((b) => b.overrideProvider(PROGRESS_SOURCE).useValue(broken));
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await resetDb(h.db);
  });

  it('ends the run as failed with a message the UI can show', async () => {
    const { body: run } = await as(h.app, KEYS.alice).post('/v1/sync-runs');
    await h.app.get(SyncWorker).tick();
    const res = await as(h.app, KEYS.alice).get(`/v1/sync-runs/${run.id}`);
    expect(res.body).toMatchObject({ status: 'failed', error: 'The Kindle sync stopped unexpectedly. Try again.' });
  });
});
