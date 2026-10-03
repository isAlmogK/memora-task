/**
 * Pure derivations the real API will do in SQL (view `user_book_progress` + stack query).
 * Kept deliberately close to that SQL so the mock behaves like the backend will.
 */
import type { PaceDto, ProgressDto, ReadingStatus } from '../types';
import type { MockEvent, MockLibraryBook, MockStack } from './store';

export const PACE_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

/** Latest by occurredAt (then id) — not by receivedAt, so late device events can't regress you. */
export function currentEvent(events: MockEvent[]): MockEvent | undefined {
  let best: MockEvent | undefined;
  for (const e of events) {
    if (!best || e.occurredAt > best.occurredAt || (e.occurredAt === best.occurredAt && e.id > best.id)) best = e;
  }
  return best;
}

export function deriveStatus(lb: MockLibraryBook, current: MockEvent | undefined): ReadingStatus {
  if (lb.abandonedAt && !lb.finishedAt) return 'abandoned';
  if (lb.finishedAt || (current && current.percent >= 100)) return 'finished';
  return current ? 'reading' : 'want_to_read';
}

export function deriveProgress(current: MockEvent | undefined): ProgressDto {
  return {
    percent: current?.percent ?? 0,
    page: current?.page ?? null,
    source: current?.source ?? null,
    occurredAt: current ? new Date(current.occurredAt).toISOString() : null,
  };
}

/** pace = percent gained in the trailing window ÷ window days; ETA = now + remaining ÷ pace. */
export function derivePace(
  events: MockEvent[],
  status: ReadingStatus,
  pageCount: number | null,
  now: number,
): PaceDto {
  const none = { percentPerDay: null, pagesPerDay: null, eta: null };
  if (status !== 'reading') return none;
  const current = currentEvent(events);
  if (!current) return none;

  const windowStart = now - PACE_WINDOW_DAYS * DAY_MS;
  const baseline = currentEvent(events.filter((e) => e.occurredAt <= windowStart));
  const gained = current.percent - (baseline?.percent ?? 0);
  const percentPerDay = round2(gained / PACE_WINDOW_DAYS);
  if (percentPerDay <= 0) return { percentPerDay, pagesPerDay: null, eta: null };

  const daysLeft = (100 - current.percent) / percentPerDay;
  return {
    percentPerDay,
    pagesPerDay: pageCount ? round2((percentPerDay * pageCount) / 100) : null,
    eta: new Date(now + daysLeft * DAY_MS).toISOString(),
  };
}

/** finished/goal ≥ fraction of [createdAt, dueOn] already elapsed. Null without a due date. */
export function deriveOnTrack(stack: MockStack, finishedCount: number, goal: number, now: number): boolean | null {
  if (!stack.dueOn) return null;
  if (goal > 0 && finishedCount >= goal) return true;
  const start = startOfDay(stack.createdAt);
  const due = Date.parse(`${stack.dueOn}T00:00:00Z`);
  const span = Math.max(due - start, DAY_MS);
  const elapsed = Math.min(Math.max((startOfDay(now) - start) / span, 0), 1);
  return goal > 0 && finishedCount / goal >= elapsed;
}

function startOfDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
