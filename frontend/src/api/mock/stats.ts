/**
 * The "Read" page numbers. Mirrors the planned SQL for GET /v1/stats:
 *   - pages read per event = greatest(percent - max(percent) over earlier events, 0) × page_count
 *     (new ground only; window function per user_book ordered by occurred_at, id)
 *   - bucketed by UTC day of occurred_at; finished books by year/month of finished_at
 *   - streaks = gaps-and-islands over the distinct reading days
 */
import type { ReadingStatsDto } from '../types';
import { currentEvent, deriveStatus } from './derive';
import type { MockEvent, MockStore } from './store';

const DAY_MS = 86_400_000;
const DAILY_DAYS = 182; // 26 weeks
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monthKey = (ms: number) => new Date(ms).toISOString().slice(0, 7);

export function deriveStats(s: MockStore, now: number): ReadingStatsDto {
  const year = new Date(now).getUTCFullYear();
  const pagesByDay = new Map<string, number>();
  const finished: { id: string; title: string; genre: string; pages: number; finishedAt: number; firstEventAt: number | null }[] = [];

  for (const lb of s.library) {
    const book = s.books.find((b) => b.olWorkKey === lb.olWorkKey)!;
    const events = s.events
      .filter((e) => e.libraryBookId === lb.id)
      .sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id);

    let maxSoFar = 0;
    for (const e of events) {
      const gained = Math.max(0, e.percent - maxSoFar);
      maxSoFar = Math.max(maxSoFar, e.percent);
      if (gained > 0 && book.pageCount) {
        const k = dayKey(e.occurredAt);
        pagesByDay.set(k, (pagesByDay.get(k) ?? 0) + (gained / 100) * book.pageCount);
      }
    }

    const current = currentEvent(events);
    if (deriveStatus(lb, current) !== 'finished') continue;
    finished.push({
      id: lb.id,
      title: book.title,
      genre: book.genre ?? 'Other',
      pages: book.pageCount ?? 0,
      finishedAt: lb.finishedAt ?? (current as MockEvent).occurredAt,
      firstEventAt: events[0]?.occurredAt ?? null,
    });
  }

  const thisYear = finished.filter((f) => new Date(f.finishedAt).getUTCFullYear() === year);
  const pagesIn = (pred: (day: string) => boolean) =>
    Math.round([...pagesByDay].reduce((sum, [day, pages]) => (pred(day) ? sum + pages : sum), 0));

  const genreMap = new Map<string, { books: number; pages: number }>();
  for (const f of thisYear) {
    const g = genreMap.get(f.genre) ?? { books: 0, pages: 0 };
    g.books++;
    g.pages += f.pages;
    genreMap.set(f.genre, g);
  }

  const monthly: ReadingStatsDto['monthly'] = [];
  const d = new Date(now);
  for (let i = 11; i >= 0; i--) {
    const month = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    monthly.push({
      month,
      books: finished.filter((f) => monthKey(f.finishedAt) === month).length,
      pages: pagesIn((day) => day.startsWith(month)),
    });
  }

  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daily = Array.from({ length: DAILY_DAYS }, (_, i) => {
    const day = dayKey(today - (DAILY_DAYS - 1 - i) * DAY_MS);
    return { day, pages: Math.round(pagesByDay.get(day) ?? 0) };
  });

  const last30 = dayKey(today - 29 * DAY_MS);
  const fastest = finished
    .filter((f) => f.firstEventAt !== null)
    .map((f) => ({ libraryBookId: f.id, title: f.title, days: Math.max(1, Math.ceil((f.finishedAt - f.firstEventAt!) / DAY_MS)) }))
    .sort((a, b) => a.days - b.days)[0];

  return {
    year,
    booksFinished: { thisYear: thisYear.length, allTime: finished.length },
    pagesRead: { thisYear: pagesIn((day) => day.startsWith(String(year))), allTime: pagesIn(() => true) },
    genres: [...genreMap].map(([genre, g]) => ({ genre, ...g })).sort((a, b) => b.books - a.books || b.pages - a.pages),
    monthly,
    daily,
    pace: {
      pagesPerDay30d: Math.round((pagesIn((day) => day >= last30) / 30) * 10) / 10,
      ...streaks(new Set([...pagesByDay.keys()]), today),
    },
    fastestFinish: fastest ?? null,
  };
}

function streaks(days: Set<string>, today: number): { currentStreakDays: number; longestStreakDays: number } {
  // Current: walk back from today; a streak still counts if you haven't read yet today.
  let cursor = days.has(dayKey(today)) ? today : today - DAY_MS;
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor -= DAY_MS;
  }
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of [...days].sort()) {
    const t = Date.parse(`${day}T00:00:00Z`);
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { currentStreakDays: current, longestStreakDays: longest };
}
