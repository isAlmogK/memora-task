/**
 * In-memory tables for the mock API, shaped like the planned Postgres schema
 * (book, user_book, reading_event, stack, stack_book, sync_run) for a single user.
 */
import type { ProgressSource, SyncStatus } from '../types';
import snapshot from './books.json';

export interface MockBook {
  olWorkKey: string;
  title: string;
  authors: string[];
  coverId: number | null;
  pageCount: number | null;
  firstPublishedYear: number | null;
  genre: string | null;
}
export interface MockLibraryBook {
  id: string;
  olWorkKey: string;
  addedAt: number;
  finishedAt: number | null;
  abandonedAt: number | null;
}
export interface MockEvent {
  id: number;
  libraryBookId: string;
  source: ProgressSource;
  percent: number;
  page: number | null;
  occurredAt: number;
  receivedAt: number;
}
export interface MockStack {
  id: string;
  name: string;
  description: string | null;
  targetCount: number | null;
  dueOn: string | null;
  createdAt: number;
  /** stack_book rows, in position order */
  bookIds: string[];
}
export interface MockSyncRun {
  id: string;
  source: ProgressSource;
  status: SyncStatus;
  eventsIngested: number;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface MockStore {
  books: MockBook[];
  library: MockLibraryBook[];
  events: MockEvent[];
  stacks: MockStack[];
  syncRuns: MockSyncRun[];
  nextEventId: number;
}

export const catalog: MockBook[] = snapshot;

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Deterministic PRNG so the seeded history looks the same on every reload. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function emptyStore(): MockStore {
  return { books: catalog, library: [], events: [], stacks: [], syncRuns: [], nextEventId: 1 };
}

type Plan =
  | { title: string; state: 'want'; addedDaysAgo: number }
  | {
      title: string;
      state: 'reading' | 'finished' | 'abandoned';
      startedDaysAgo: number;
      /** last event (hours ago) */
      lastHoursAgo: number;
      percent: number;
      source?: ProgressSource;
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
  // Finished earlier: a year of history for the stats page (two of them last year).
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

export function seededStore(now: number): MockStore {
  const store = emptyStore();
  const rand = mulberry32(42);
  const byTitle = new Map(catalog.map((b) => [b.title, b]));
  const idByTitle = new Map<string, string>();

  for (const p of PLAN) {
    const book = byTitle.get(p.title);
    if (!book) throw new Error(`mock seed: ${p.title} missing from books.json`);
    const id = uuid();
    idByTitle.set(p.title, id);

    if (p.state === 'want') {
      store.library.push({ id, olWorkKey: book.olWorkKey, addedAt: now - p.addedDaysAgo * DAY, finishedAt: null, abandonedAt: null });
      continue;
    }

    const start = now - p.startedDaysAgo * DAY;
    const end = now - p.lastHoursAgo * HOUR;
    store.library.push({
      id,
      olWorkKey: book.olWorkKey,
      addedAt: start - 2 * DAY,
      finishedAt: p.state === 'finished' ? end : null,
      abandonedAt: p.state === 'abandoned' ? end + 3 * DAY : null,
    });

    // Roughly one reading session a day, uneven sizes, ending exactly on the planned percent.
    const sessions = Math.max(2, Math.round((end - start) / DAY));
    const weights = Array.from({ length: sessions }, () => 0.3 + rand());
    const total = weights.reduce((a, b) => a + b, 0);
    let pct = 0;
    weights.forEach((w, i) => {
      const last = i === sessions - 1;
      pct = last ? p.percent : Math.min(p.percent, pct + (w / total) * p.percent);
      const occurredAt = last ? end : start + ((end - start) * (i + 1)) / sessions - rand() * 4 * HOUR;
      const source: ProgressSource = p.source ?? (rand() < 0.85 ? 'kindle_sim' : 'manual');
      store.events.push({
        id: store.nextEventId++,
        libraryBookId: id,
        source,
        percent: Math.round(pct * 100) / 100,
        page: book.pageCount ? Math.round((pct / 100) * book.pageCount) : null,
        occurredAt,
        receivedAt: source === 'kindle_sim' ? occurredAt + rand() * 6 * HOUR : occurredAt,
      });
    });
  }

  const ids = (...titles: string[]) => titles.map((t) => idByTitle.get(t)!);
  store.stacks.push(
    {
      id: uuid(),
      name: 'Autumn sci-fi',
      description: 'Six spaceships before the year runs out.',
      targetCount: 6,
      dueOn: '2026-12-31',
      createdAt: Date.parse('2026-09-01T09:00:00Z'),
      bookIds: ids('The Martian', 'Klara and the Sun', 'Station Eleven', 'Project Hail Mary', 'Children of Time', 'Dune'),
    },
    {
      id: uuid(),
      name: 'Booker winners',
      description: 'Working through the prize list, slowly.',
      targetCount: 4,
      dueOn: '2026-11-30',
      createdAt: Date.parse('2026-08-01T09:00:00Z'),
      bookIds: ids('The Remains of the Day', 'Orbital'),
    },
    {
      id: uuid(),
      name: 'Ishiguro re-reads',
      description: null,
      targetCount: null,
      dueOn: null,
      createdAt: Date.parse('2026-07-12T09:00:00Z'),
      bookIds: ids('Klara and the Sun', 'The Remains of the Day', 'Never Let Me Go'),
    },
  );

  store.syncRuns.push({
    id: uuid(),
    source: 'kindle_sim',
    status: 'succeeded',
    eventsIngested: 3,
    error: null,
    createdAt: now - 2 * HOUR - 40_000,
    startedAt: now - 2 * HOUR - 38_000,
    finishedAt: now - 2 * HOUR,
  });

  return store;
}
