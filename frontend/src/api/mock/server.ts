/**
 * In-browser stand-in for the Stacks API so the UI can be built and reviewed first.
 * Same method-per-endpoint surface, status codes and error codes as the planned API;
 * derivations live in ./derive.ts and mirror the SQL view.
 */
import type { StacksApi } from '../client';
import { ApiError } from '../errors';
import type {
  BookDto,
  CatalogBookDto,
  LibraryBookDetailDto,
  LibraryBookDto,
  ReadingEventDto,
  StackDetailDto,
  StackSummaryDto,
  SyncRunDto,
} from '../types';
import { deriveStats } from './stats';
import { currentEvent, derivePace, deriveOnTrack, deriveProgress, deriveStatus, round2 } from './derive';
import { getMockMode } from './settings';
import {
  catalog,
  emptyStore,
  mulberry32,
  seededStore,
  uuid,
  type MockBook,
  type MockLibraryBook,
  type MockStack,
  type MockStore,
  type MockSyncRun,
} from './store';

const stores: { seeded: MockStore; empty: MockStore } = {
  seeded: seededStore(Date.now()),
  empty: emptyStore(),
};
const db = () => (getMockMode() === 'empty' ? stores.empty : stores.seeded);

export function resetMockData(): void {
  stores.seeded = seededStore(Date.now());
  stores.empty = emptyStore();
}

// ---------- plumbing ----------

async function respond<T>(fn: () => T, opts: { failInErrorMode?: boolean } = {}): Promise<T> {
  const mode = getMockMode();
  // "normal" is a fast local API; "slow" is there to review loading states.
  const [min, max] = mode === 'slow' ? [1800, 2800] : [50, 140];
  await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
  if (mode === 'error' && opts.failInErrorMode !== false) {
    throw new ApiError(500, 'internal', 'Simulated server error (mock mode: error)');
  }
  // Round-trip through JSON so callers can't mutate the store and dates are strings, like over HTTP.
  return JSON.parse(JSON.stringify(fn() ?? null)) as T;
}

const notFound = (what: string) => new ApiError(404, 'not_found', `${what} not found`);
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

function bookDto(b: MockBook): BookDto {
  return {
    olWorkKey: b.olWorkKey,
    title: b.title,
    authors: b.authors,
    coverUrl: b.coverId ? `https://covers.openlibrary.org/b/id/${b.coverId}-L.jpg` : null,
    pageCount: b.pageCount,
    firstPublishedYear: b.firstPublishedYear,
    genre: b.genre,
  };
}

function findBook(s: MockStore, olWorkKey: string): MockBook {
  const b = s.books.find((x) => x.olWorkKey === olWorkKey);
  if (!b) throw notFound('Book');
  return b;
}

function findLibraryBook(s: MockStore, id: string): MockLibraryBook {
  const lb = s.library.find((x) => x.id === id);
  if (!lb) throw notFound('Library book');
  return lb;
}

function findStack(s: MockStore, id: string): MockStack {
  const st = s.stacks.find((x) => x.id === id);
  if (!st) throw notFound('Stack');
  return st;
}

function libraryBookDto(s: MockStore, lb: MockLibraryBook, now = Date.now()): LibraryBookDto {
  const book = findBook(s, lb.olWorkKey);
  const events = s.events.filter((e) => e.libraryBookId === lb.id);
  const current = currentEvent(events);
  const status = deriveStatus(lb, current);
  const finishedAt = lb.finishedAt ?? (status === 'finished' && current ? current.occurredAt : null);
  return {
    id: lb.id,
    book: bookDto(book),
    status,
    addedAt: iso(lb.addedAt)!,
    finishedAt: iso(finishedAt),
    progress: deriveProgress(current),
    pace: derivePace(events, status, book.pageCount, now),
  };
}

function libraryBookDetail(s: MockStore, lb: MockLibraryBook): LibraryBookDetailDto {
  const events: ReadingEventDto[] = s.events
    .filter((e) => e.libraryBookId === lb.id)
    .sort((a, b) => b.occurredAt - a.occurredAt || b.id - a.id)
    .slice(0, 50)
    .map((e) => ({
      id: String(e.id),
      percent: e.percent,
      page: e.page,
      source: e.source,
      occurredAt: iso(e.occurredAt)!,
      receivedAt: iso(e.receivedAt)!,
    }));
  return {
    ...libraryBookDto(s, lb),
    events,
    stacks: s.stacks.filter((st) => st.bookIds.includes(lb.id)).map((st) => ({ id: st.id, name: st.name })),
  };
}

function stackSummary(s: MockStore, st: MockStack): StackSummaryDto {
  const now = Date.now();
  const books = st.bookIds.map((id) => libraryBookDto(s, findLibraryBook(s, id), now));
  const finishedCount = books.filter((b) => b.status === 'finished').length;
  const goal = st.targetCount ?? books.length;
  return {
    id: st.id,
    name: st.name,
    description: st.description,
    targetCount: st.targetCount,
    dueOn: st.dueOn,
    createdAt: iso(st.createdAt)!,
    bookCount: books.length,
    finishedCount,
    goal,
    onTrack: deriveOnTrack(st, finishedCount, goal, now),
    preview: books.slice(0, 8).map((b) => ({
      libraryBookId: b.id,
      title: b.book.title,
      coverUrl: b.book.coverUrl,
      pageCount: b.book.pageCount,
      status: b.status,
    })),
  };
}

function stackDetail(s: MockStore, st: MockStack): StackDetailDto {
  return { ...stackSummary(s, st), books: st.bookIds.map((id) => libraryBookDto(s, findLibraryBook(s, id))) };
}

function syncRunDto(r: MockSyncRun): SyncRunDto {
  return { ...r, createdAt: iso(r.createdAt)!, startedAt: iso(r.startedAt), finishedAt: iso(r.finishedAt) };
}

function validateStackFields(s: MockStore, body: { name?: string; targetCount?: number | null; dueOn?: string | null }, selfId?: string) {
  const details: Record<string, string> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 1 || name.length > 80) details.name = 'must be 1–80 characters';
    else if (s.stacks.some((x) => x.id !== selfId && x.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, 'stack_name_taken', `You already have a stack called “${name}”`);
    }
  }
  if (body.targetCount != null && (!Number.isInteger(body.targetCount) || body.targetCount < 1 || body.targetCount > 500)) {
    details.targetCount = 'must be a whole number between 1 and 500';
  }
  if (body.dueOn != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueOn)) details.dueOn = 'must be a YYYY-MM-DD date';
  if (Object.keys(details).length) throw new ApiError(400, 'validation_failed', 'Request body is invalid', details);
}

// ---------- simulated Kindle sync (the worker) ----------

const syncRand = mulberry32(7);

function runSync(s: MockStore, run: MockSyncRun) {
  const failThisRun = getMockMode() === 'error';
  setTimeout(() => {
    run.status = 'running';
    run.startedAt = Date.now();

    if (failThisRun) {
      setTimeout(() => {
        run.status = 'failed';
        run.error = 'Kindle session expired (simulated). Sign in again and retry.';
        run.finishedAt = Date.now();
      }, 1500);
      return;
    }

    const reading = s.library
      .map((lb) => libraryBookDto(s, lb))
      .filter((b) => b.status === 'reading')
      .sort((a, b) => (b.progress.occurredAt ?? '').localeCompare(a.progress.occurredAt ?? ''));

    // One "page turn" from the e-reader per tick, so the UI can show them landing one by one.
    let i = 0;
    const tick = () => {
      const lb = reading[i++];
      if (!lb) {
        run.status = 'succeeded';
        run.finishedAt = Date.now();
        return;
      }
      const remaining = 100 - lb.progress.percent;
      const delta = remaining <= 15 ? remaining : Math.round(4 + syncRand() * 8);
      const percent = round2(Math.min(100, lb.progress.percent + delta));
      const now = Date.now();
      s.events.push({
        id: s.nextEventId++,
        libraryBookId: lb.id,
        source: 'kindle_sim',
        percent,
        page: lb.book.pageCount ? Math.round((percent / 100) * lb.book.pageCount) : null,
        occurredAt: now - Math.round(syncRand() * 30) * 60_000,
        receivedAt: now,
      });
      run.eventsIngested++;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 600);
  }, 1100);
}

// ---------- the API ----------

export const mockApi: StacksApi = {
  searchCatalog: (q) =>
    respond(() => {
      const needle = normalise(q);
      if (needle.length < 2) throw new ApiError(400, 'validation_failed', 'q must be at least 2 characters');
      const s = db();
      return catalog
        .filter((b) => normalise(`${b.title} ${b.authors.join(' ')}`).includes(needle))
        .map<CatalogBookDto>((b) => ({
          ...bookDto(b),
          libraryBookId: s.library.find((lb) => lb.olWorkKey === b.olWorkKey)?.id ?? null,
        }));
    }),

  listLibrary: (status) =>
    respond(() => {
      const s = db();
      const now = Date.now();
      return s.library
        .map((lb) => libraryBookDto(s, lb, now))
        .filter((b) => !status || b.status === status)
        .sort((a, b) => (b.progress.occurredAt ?? b.addedAt).localeCompare(a.progress.occurredAt ?? a.addedAt));
    }),

  getLibraryBook: (id) => respond(() => libraryBookDetail(db(), findLibraryBook(db(), id))),

  addToLibrary: ({ olWorkKey }) =>
    respond(() => {
      const s = db();
      findBook(s, olWorkKey);
      if (s.library.some((lb) => lb.olWorkKey === olWorkKey)) {
        throw new ApiError(409, 'already_in_library', 'This book is already in your library');
      }
      const lb: MockLibraryBook = { id: uuid(), olWorkKey, addedAt: Date.now(), finishedAt: null, abandonedAt: null };
      s.library.push(lb);
      return libraryBookDto(s, lb);
    }),

  logProgress: (id, body) =>
    respond(() => {
      const s = db();
      const lb = findLibraryBook(s, id);
      const book = findBook(s, lb.olWorkKey);
      let percent: number;
      let page: number | null = null;
      if (body.page !== undefined) {
        if (!book.pageCount) throw new ApiError(400, 'page_unsupported', 'This book has no page count; log a percent instead');
        if (!Number.isInteger(body.page) || body.page < 0 || body.page > book.pageCount) {
          throw new ApiError(400, 'validation_failed', 'Request is invalid', { page: `must be between 0 and ${book.pageCount}` });
        }
        page = body.page;
        percent = round2((body.page / book.pageCount) * 100);
      } else {
        if (!(body.percent >= 0 && body.percent <= 100)) {
          throw new ApiError(400, 'validation_failed', 'Request is invalid', { percent: 'must be between 0 and 100' });
        }
        percent = round2(body.percent);
        page = book.pageCount ? Math.round((percent / 100) * book.pageCount) : null;
      }
      const now = Date.now();
      s.events.push({ id: s.nextEventId++, libraryBookId: id, source: 'manual', percent, page, occurredAt: now, receivedAt: now });
      return libraryBookDetail(s, lb);
    }),

  updateLibraryBook: (id, body) =>
    respond(() => {
      const s = db();
      const lb = findLibraryBook(s, id);
      if (body.finished !== undefined) lb.finishedAt = body.finished ? Date.now() : null;
      if (body.abandoned !== undefined) lb.abandonedAt = body.abandoned ? Date.now() : null;
      return libraryBookDto(s, lb);
    }),

  removeFromLibrary: (id) =>
    respond(() => {
      const s = db();
      findLibraryBook(s, id);
      s.library = s.library.filter((lb) => lb.id !== id);
      s.events = s.events.filter((e) => e.libraryBookId !== id);
      s.stacks.forEach((st) => (st.bookIds = st.bookIds.filter((b) => b !== id)));
    }),

  listStacks: () =>
    respond(() => {
      const s = db();
      return [...s.stacks].sort((a, b) => b.createdAt - a.createdAt).map((st) => stackSummary(s, st));
    }),

  getStack: (id) => respond(() => stackDetail(db(), findStack(db(), id))),

  createStack: (body) =>
    respond(() => {
      const s = db();
      validateStackFields(s, body);
      const st: MockStack = {
        id: uuid(),
        name: body.name.trim(),
        description: body.description?.trim() || null,
        targetCount: body.targetCount ?? null,
        dueOn: body.dueOn ?? null,
        createdAt: Date.now(),
        bookIds: [],
      };
      s.stacks.push(st);
      return stackSummary(s, st);
    }),

  updateStack: (id, body) =>
    respond(() => {
      const s = db();
      const st = findStack(s, id);
      validateStackFields(s, body, id);
      if (body.name !== undefined) st.name = body.name.trim();
      if (body.description !== undefined) st.description = body.description?.trim() || null;
      if (body.targetCount !== undefined) st.targetCount = body.targetCount;
      if (body.dueOn !== undefined) st.dueOn = body.dueOn;
      return stackSummary(s, st);
    }),

  deleteStack: (id) =>
    respond(() => {
      const s = db();
      findStack(s, id);
      s.stacks = s.stacks.filter((x) => x.id !== id);
    }),

  addToStack: (stackId, libraryBookId) =>
    respond(() => {
      const s = db();
      const st = findStack(s, stackId);
      findLibraryBook(s, libraryBookId);
      if (!st.bookIds.includes(libraryBookId)) st.bookIds.push(libraryBookId); // PUT: idempotent
      return stackDetail(s, st);
    }),

  removeFromStack: (stackId, libraryBookId) =>
    respond(() => {
      const s = db();
      const st = findStack(s, stackId);
      st.bookIds = st.bookIds.filter((x) => x !== libraryBookId);
      return stackDetail(s, st);
    }),

  getStats: () => respond(() => deriveStats(db(), Date.now())),

  startSync: () =>
    respond(
      () => {
        const s = db();
        const active = s.syncRuns.find((r) => r.status === 'queued' || r.status === 'running');
        if (active) return syncRunDto(active);
        const run: MockSyncRun = {
          id: uuid(),
          source: 'kindle_sim',
          status: 'queued',
          eventsIngested: 0,
          error: null,
          createdAt: Date.now(),
          startedAt: null,
          finishedAt: null,
        };
        s.syncRuns.unshift(run);
        runSync(s, run);
        return syncRunDto(run);
      },
      // In "error" mode the request is accepted and the *job* fails, so the failed state is visible.
      { failInErrorMode: false },
    ),

  getSyncRun: (id) =>
    respond(
      () => {
        const run = db().syncRuns.find((r) => r.id === id);
        if (!run) throw notFound('Sync run');
        return syncRunDto(run);
      },
      { failInErrorMode: false },
    ),

  listSyncRuns: (limit) => respond(() => db().syncRuns.slice(0, limit).map(syncRunDto), { failInErrorMode: false }),
};

function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
