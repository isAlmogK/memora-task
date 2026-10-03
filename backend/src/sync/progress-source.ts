/**
 * Where reading progress comes from when we pull it (as opposed to a device pushing it).
 * There's no public Kindle API, so the only implementation is SimulatedKindleSource; a
 * real adapter (Kindle via a browser session, KOReader sync, Kobo) would implement this
 * same interface and the worker wouldn't change.
 */
export interface PulledEvent {
  userBookId: string;
  percent: number;
  occurredAt: Date;
  /** Stable per (run, book): re-running a job can't double-count (ingestion is idempotent). */
  externalId: string;
}

export interface ProgressSource {
  readonly source: 'kindle_sim';
  pull(ctx: { userId: string; runId: string }): AsyncIterable<PulledEvent>;
}

export const PROGRESS_SOURCE = Symbol('PROGRESS_SOURCE');
