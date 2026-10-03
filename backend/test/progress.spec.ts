/**
 * The queries that would embarrass us if wrong: current progress, derived status, pace/ETA
 * (the user_book_progress view) and stack on-track (StacksService.summaries).
 */
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { as, createHarness, DAY, daysAgo, Fixture, Harness, KEYS, resetDb } from './harness';

let h: Harness;
let fx: Fixture;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  fx = await resetDb(h.db);
});

async function addBook(bookId: string, extra: Partial<typeof schema.userBook.$inferInsert> = {}) {
  const [ub] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId, ...extra }).returning();
  return ub!.id;
}

async function event(userBookId: string, percent: number, occurredAt: Date, receivedAt = new Date()) {
  await h.db.insert(schema.readingEvent).values({ userId: fx.alice, userBookId, source: 'kindle_sim', percent, occurredAt, receivedAt });
}

const get = (id: string) => as(h.app, KEYS.alice).get(`/v1/library/${id}`);

describe('current progress', () => {
  it('uses the event that occurred last, not the one that arrived last', async () => {
    const id = await addBook(fx.books.dune);
    await event(id, 40, daysAgo(1), daysAgo(1));
    // A device was offline: this older reading arrives later. It must not win.
    await event(id, 25, daysAgo(3), new Date());

    const res = await get(id).expect(200);
    expect(res.body.progress.percent).toBe(40);
  });

  it('allows going backwards when a later reading really is lower (a re-read)', async () => {
    const id = await addBook(fx.books.dune);
    await event(id, 80, daysAgo(5));
    await event(id, 10, daysAgo(1));
    expect((await get(id)).body.progress.percent).toBe(10);
  });

  it('breaks ties on occurred_at by insertion order', async () => {
    const id = await addBook(fx.books.dune);
    const at = daysAgo(1);
    await event(id, 30, at);
    await event(id, 35, at);
    expect((await get(id)).body.progress.percent).toBe(35);
  });

  it('ingests a device event once, however often it is resent', async () => {
    const id = await addBook(fx.books.dune);
    const body = { libraryBookId: id, percent: 12, occurredAt: daysAgo(1).toISOString(), externalId: 'kindle-123' };
    const device = as(h.app, KEYS.aliceDevice);

    await device.post('/v1/progress-events', body).expect(202, { recorded: true });
    await device.post('/v1/progress-events', body).expect(202, { recorded: false });

    const { rows } = await h.db.execute(sql`select count(*)::int as n from reading_event where user_book_id = ${id}`);
    expect(rows[0]).toEqual({ n: 1 });
  });
});

describe('derived status', () => {
  it('walks want_to_read → reading → finished (at 100%)', async () => {
    const id = await addBook(fx.books.dune);
    expect((await get(id)).body.status).toBe('want_to_read');

    await event(id, 50, daysAgo(2));
    expect((await get(id)).body.status).toBe('reading');

    const finishedAt = daysAgo(1);
    await event(id, 100, finishedAt);
    const res = await get(id);
    expect(res.body.status).toBe('finished');
    expect(res.body.finishedAt).toBe(finishedAt.toISOString());
  });

  it('respects explicit choices: abandoned, and finished winning over abandoned', async () => {
    const abandoned = await addBook(fx.books.dune, { abandonedAt: daysAgo(1) });
    await event(abandoned, 30, daysAgo(3));
    expect((await get(abandoned)).body.status).toBe('abandoned');

    const both = await addBook(fx.books.hailMary, { abandonedAt: daysAgo(2), finishedAt: daysAgo(1) });
    expect((await get(both)).body.status).toBe('finished');
  });
});

describe('pace and ETA', () => {
  it('is percent gained over the last 14 days ÷ 14, from the baseline before the window', async () => {
    const id = await addBook(fx.books.dune); // 600 pages
    await event(id, 20, daysAgo(20)); // baseline: before the window
    await event(id, 30, daysAgo(10));
    await event(id, 48, daysAgo(0.1));

    const { pace } = (await get(id)).body;
    expect(pace.percentPerDay).toBe(2); // (48 - 20) / 14
    expect(pace.pagesPerDay).toBe(12); // 2% of 600
    const daysLeft = (Date.parse(pace.eta) - Date.now()) / DAY;
    expect(daysLeft).toBeCloseTo(26, 1); // (100 - 48) / 2
  });

  it('has no ETA when nothing moved in the window, and no pace when not reading', async () => {
    const stalled = await addBook(fx.books.dune);
    await event(stalled, 40, daysAgo(30));
    expect((await get(stalled)).body.pace).toEqual({ percentPerDay: 0, pagesPerDay: null, eta: null });

    const done = await addBook(fx.books.hailMary);
    await event(done, 100, daysAgo(1));
    expect((await get(done)).body.pace).toEqual({ percentPerDay: null, pagesPerDay: null, eta: null });
  });
});

describe('stack on-track', () => {
  /** A stack that started 10 days ago and is due in 10: half the window has passed. */
  async function halfwayStack(finished: number, goal: number) {
    const dueOn = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
    const [s] = await h.db
      .insert(schema.stack)
      .values({ userId: fx.alice, name: `s${finished}`, targetCount: goal, dueOn, createdAt: daysAgo(10) })
      .returning();
    const books = [fx.books.dune, fx.books.hailMary, fx.books.noPages].slice(0, finished);
    for (const [i, bookId] of books.entries()) {
      const ub = await addBook(bookId, { finishedAt: daysAgo(1) });
      await h.db.insert(schema.stackBook).values({ userId: fx.alice, stackId: s!.id, userBookId: ub, position: i + 1 });
    }
    return (await as(h.app, KEYS.alice).get(`/v1/stacks/${s!.id}`).expect(200)).body;
  }

  it('is on track when finished/goal keeps up with elapsed time', async () => {
    const s = await halfwayStack(2, 4); // 50% done, 50% elapsed
    expect([s.finishedCount, s.goal, s.onTrack]).toEqual([2, 4, true]);
  });

  it('is behind when it does not', async () => {
    const s = await halfwayStack(1, 4); // 25% done, 50% elapsed
    expect(s.onTrack).toBe(false);
  });

  it('is null without a due date, and goal falls back to the book count', async () => {
    const res = await as(h.app, KEYS.alice).post('/v1/stacks', { name: 'Someday' }).expect(201);
    expect(res.body).toMatchObject({ onTrack: null, goal: 0, targetCount: null, dueOn: null });
  });
});
