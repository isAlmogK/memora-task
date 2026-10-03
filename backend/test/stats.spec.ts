/** GET /v1/stats against hand-computed numbers. */
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { as, createHarness, DAY, Fixture, Harness, KEYS, resetDb } from './harness';

let h: Harness;
let fx: Fixture;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  fx = await resetDb(h.db);
});

/** Noon UTC, n days ago: well inside its UTC day whatever the clock says. */
const noon = (daysAgo: number, hour = 12) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo, hour));
};

async function event(userBookId: string, percent: number, occurredAt: Date) {
  await h.db.insert(schema.readingEvent).values({ userId: fx.alice, userBookId, source: 'manual', percent, occurredAt });
}

const stats = async (key = KEYS.alice) => (await as(h.app, key).get('/v1/stats').expect(200)).body;

it('counts pages as new ground only, per UTC day', async () => {
  const [dune] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning(); // 600 pages
  await event(dune!.id, 10, noon(3)); //  60 pages
  await event(dune!.id, 30, noon(2, 9)); // 120
  await event(dune!.id, 20, noon(2, 18)); // jumped back: 0
  await event(dune!.id, 50, noon(1)); // 30 → 50 = 120 (re-reading 20 → 30 isn't new)

  const s = await stats();
  expect(s.pagesRead.allTime).toBe(300);
  const byDay = Object.fromEntries((s.daily as { day: string; pages: number }[]).map((d) => [d.day, d.pages]));
  expect([byDay[noon(3).toISOString().slice(0, 10)], byDay[noon(2).toISOString().slice(0, 10)], byDay[noon(1).toISOString().slice(0, 10)]]).toEqual([60, 120, 120]);
  expect(s.daily).toHaveLength(182);
  expect(s.monthly).toHaveLength(12);
  expect(s.pace.pagesPerDay30d).toBe(10); // 300 / 30
});

it('finds streaks: the current one may end yesterday; the longest is the longest run', async () => {
  const [dune] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning();
  let pct = 0;
  for (const d of [20, 19, 18, 17, 10, 3, 2, 1]) await event(dune!.id, (pct += 5), noon(d)); // runs: 4, 1, 3 (ending yesterday)

  const { pace } = await stats();
  expect([pace.currentStreakDays, pace.longestStreakDays]).toEqual([3, 4]);
});

it('counts finished books by genre and finds the fastest finish', async () => {
  const [dune] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning();
  const [phm] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.hailMary }).returning();
  await event(dune!.id, 10, noon(9));
  await event(dune!.id, 100, noon(1)); // finished at 100%, 8 days after starting
  await event(phm!.id, 50, noon(3));
  await h.db.update(schema.userBook).set({ finishedAt: noon(1) }).where(eq(schema.userBook.id, phm!.id));

  const s = await stats();
  expect(s.booksFinished.allTime).toBe(2);
  expect(s.fastestFinish).toEqual({ libraryBookId: phm!.id, title: 'Project Hail Mary', days: 2 });
  if (noon(9).getUTCFullYear() === new Date().getUTCFullYear()) {
    expect(s.genres).toEqual([{ genre: 'Science fiction', books: 2, pages: 1100 }]);
  }
});

it("only ever counts the caller's own reading", async () => {
  const [dune] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning();
  await event(dune!.id, 100, new Date(Date.now() - DAY));
  const bob = await stats(KEYS.bob);
  expect([bob.booksFinished.allTime, bob.pagesRead.allTime, bob.fastestFinish, bob.genres]).toEqual([0, 0, null, []]);
});
