// Resets the dev database to a known state: two users, the Open Library snapshot as the
// catalog, about a year of reading history for Alice, and three stacks.
// The reading plan mirrors frontend/src/api/mock/store.ts so the UI looks the same against
// the mock and the real API. Timestamps are relative to "now", so pace/streaks stay live.
//   npm run db:seed
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DEV_KEYS, hashKey } from '../auth/api-key';
import { config } from '../config';
import { createPool } from './db.module';
import * as schema from './schema';
import snapshot from './seed/openlibrary-snapshot.json';

type Source = 'manual' | 'device' | 'kindle_sim';
type Plan =
  | { title: string; state: 'want'; addedDaysAgo: number }
  | {
      title: string;
      state: 'reading' | 'finished' | 'abandoned';
      startedDaysAgo: number;
      lastHoursAgo: number;
      percent: number;
      source?: Source;
    };

const PLAN: Plan[] = [
  { title: 'Project Hail Mary', state: 'reading', startedDaysAgo: 12, lastHoursAgo: 2, percent: 64 },
  { title: 'Never Let Me Go', state: 'reading', startedDaysAgo: 20, lastHoursAgo: 26, percent: 85 },
  { title: 'Piranesi', state: 'reading', startedDaysAgo: 9, lastHoursAgo: 30, percent: 30 },
  { title: 'Children of Time', state: 'reading', startedDaysAgo: 4, lastHoursAgo: 5, percent: 12, source: 'device' },
  { title: 'The Martian', state: 'finished', startedDaysAgo: 82, lastHoursAgo: 70 * 24, percent: 100 },
  { title: 'Klara and the Sun', state: 'finished', startedDaysAgo: 52, lastHoursAgo: 40 * 24, percent: 100 },
  { title: 'The Remains of the Day', state: 'finished', startedDaysAgo: 64, lastHoursAgo: 55 * 24, percent: 100 },
  { title: 'Station Eleven', state: 'finished', startedDaysAgo: 34, lastHoursAgo: 22 * 24, percent: 100 },
  { title: 'The Midnight Library', state: 'finished', startedDaysAgo: 330, lastHoursAgo: 321 * 24, percent: 100 },
  { title: 'Born a Crime', state: 'finished', startedDaysAgo: 302, lastHoursAgo: 290 * 24, percent: 100 },
  { title: 'The Night Circus', state: 'finished', startedDaysAgo: 268, lastHoursAgo: 255 * 24, percent: 100 },
  { title: 'Educated', state: 'finished', startedDaysAgo: 247, lastHoursAgo: 233 * 24, percent: 100 },
  { title: 'Circe', state: 'finished', startedDaysAgo: 228, lastHoursAgo: 213 * 24, percent: 100 },
  { title: 'The Thursday Murder Club', state: 'finished', startedDaysAgo: 205, lastHoursAgo: 197 * 24, percent: 100 },
  { title: 'Sapiens', state: 'finished', startedDaysAgo: 190, lastHoursAgo: 161 * 24, percent: 100 },
  { title: 'Gone Girl', state: 'finished', startedDaysAgo: 150, lastHoursAgo: 142 * 24, percent: 100 },
  { title: 'The Song of Achilles', state: 'finished', startedDaysAgo: 139, lastHoursAgo: 128 * 24, percent: 100 },
  { title: 'Recursion', state: 'finished', startedDaysAgo: 121, lastHoursAgo: 113 * 24, percent: 100 },
  { title: 'Lessons in Chemistry', state: 'finished', startedDaysAgo: 106, lastHoursAgo: 93 * 24, percent: 100 },
  { title: 'Dark Matter', state: 'finished', startedDaysAgo: 89, lastHoursAgo: 85 * 24, percent: 100 },
  { title: 'Demon Copperhead', state: 'abandoned', startedDaysAgo: 48, lastHoursAgo: 30 * 24, percent: 38 },
  { title: 'Dune', state: 'want', addedDaysAgo: 30 },
  { title: 'Babel', state: 'want', addedDaysAgo: 18 },
  { title: 'Orbital', state: 'want', addedDaysAgo: 15 },
  { title: 'Hyperion', state: 'want', addedDaysAgo: 11 },
  { title: 'Tomorrow, and Tomorrow, and Tomorrow', state: 'want', addedDaysAgo: 8 },
  { title: 'A Memory Called Empire', state: 'want', addedDaysAgo: 6 },
  { title: 'Sea of Tranquility', state: 'want', addedDaysAgo: 3 },
  { title: 'Exhalation', state: 'want', addedDaysAgo: 1 },
];

const STACKS = [
  {
    name: 'Autumn sci-fi',
    description: 'Six spaceships before the year runs out.',
    targetCount: 6,
    dueOn: '2026-12-31',
    createdAt: '2026-09-01T09:00:00Z',
    books: ['The Martian', 'Klara and the Sun', 'Station Eleven', 'Project Hail Mary', 'Children of Time', 'Dune'],
  },
  {
    name: 'Booker winners',
    description: 'Working through the prize list, slowly.',
    targetCount: 4,
    dueOn: '2026-11-30',
    createdAt: '2026-08-01T09:00:00Z',
    books: ['The Remains of the Day', 'Orbital'],
  },
  {
    name: 'Ishiguro re-reads',
    description: null,
    targetCount: null,
    dueOn: null,
    createdAt: '2026-07-12T09:00:00Z',
    books: ['Klara and the Sun', 'The Remains of the Day', 'Never Let Me Go'],
  },
];

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Deterministic PRNG (same as the mock) so the seeded history is stable across runs. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seed() {
  const pool = createPool(config.databaseUrl);
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const rand = mulberry32(42);

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate app_user, book restart identity cascade`);

    const [alice, bob] = await tx
      .insert(schema.appUser)
      .values([{ displayName: 'Alice' }, { displayName: 'Bob' }])
      .returning();
    await tx.insert(schema.apiKey).values([
      { userId: alice!.id, keyHash: hashKey(DEV_KEYS.aliceUser), scope: 'user', label: 'Alice (dev)' },
      { userId: alice!.id, keyHash: hashKey(DEV_KEYS.aliceDevice), scope: 'device', label: "Alice's Kindle (dev)" },
      { userId: bob!.id, keyHash: hashKey(DEV_KEYS.bobUser), scope: 'user', label: 'Bob (dev)' },
    ]);

    const books = await tx.insert(schema.book).values(snapshot).returning();
    const bookByTitle = new Map(books.map((b) => [b.title, b]));
    const libraryIdByTitle = new Map<string, string>();

    for (const p of PLAN) {
      const b = bookByTitle.get(p.title);
      if (!b) throw new Error(`seed: ${p.title} missing from the snapshot`);
      if (p.state === 'want') {
        const [ub] = await tx
          .insert(schema.userBook)
          .values({ userId: alice!.id, bookId: b.id, addedAt: new Date(now - p.addedDaysAgo * DAY) })
          .returning();
        libraryIdByTitle.set(p.title, ub!.id);
        continue;
      }

      const start = now - p.startedDaysAgo * DAY;
      const end = now - p.lastHoursAgo * HOUR;
      const [ub] = await tx
        .insert(schema.userBook)
        .values({
          userId: alice!.id,
          bookId: b.id,
          addedAt: new Date(start - 2 * DAY),
          finishedAt: p.state === 'finished' ? new Date(end) : null,
          abandonedAt: p.state === 'abandoned' ? new Date(end + 3 * DAY) : null,
        })
        .returning();
      libraryIdByTitle.set(p.title, ub!.id);

      // About one session a day, uneven sizes, ending exactly on the planned percent.
      const sessions = Math.max(2, Math.round((end - start) / DAY));
      const weights = Array.from({ length: sessions }, () => 0.3 + rand());
      const total = weights.reduce((a, w) => a + w, 0);
      let pct = 0;
      const events = weights.map((w, i) => {
        const last = i === sessions - 1;
        pct = last ? p.percent : Math.min(p.percent, pct + (w / total) * p.percent);
        const occurredAt = last ? end : start + ((end - start) * (i + 1)) / sessions - rand() * 4 * HOUR;
        const source: Source = p.source ?? (rand() < 0.85 ? 'kindle_sim' : 'manual');
        return {
          userId: alice!.id,
          userBookId: ub!.id,
          source,
          percent: Math.round(pct * 100) / 100,
          page: b.pageCount ? Math.round((pct / 100) * b.pageCount) : null,
          occurredAt: new Date(occurredAt),
          receivedAt: new Date(source === 'kindle_sim' ? occurredAt + rand() * 6 * HOUR : occurredAt),
        };
      });
      await tx.insert(schema.readingEvent).values(events);
    }

    for (const s of STACKS) {
      const [st] = await tx
        .insert(schema.stack)
        .values({ userId: alice!.id, name: s.name, description: s.description, targetCount: s.targetCount, dueOn: s.dueOn, createdAt: new Date(s.createdAt) })
        .returning();
      await tx.insert(schema.stackBook).values(
        s.books.map((title, i) => ({ userId: alice!.id, stackId: st!.id, userBookId: libraryIdByTitle.get(title)!, position: i + 1 })),
      );
    }

    // Bob: a small, separate library, there to prove one user can't see another's data.
    const [bobBook] = await tx
      .insert(schema.userBook)
      .values({ userId: bob!.id, bookId: bookByTitle.get('Dune')!.id })
      .returning();
    const [bobStack] = await tx.insert(schema.stack).values({ userId: bob!.id, name: 'Desert island' }).returning();
    await tx.insert(schema.stackBook).values({ userId: bob!.id, stackId: bobStack!.id, userBookId: bobBook!.id, position: 1 });
  });

  await pool.end();
  console.log(`seeded: Alice (${DEV_KEYS.aliceUser}), Bob (${DEV_KEYS.bobUser}), device key ${DEV_KEYS.aliceDevice}`);
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
