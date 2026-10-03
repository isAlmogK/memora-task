/**
 * Response/request shapes of the Stacks API (v1).
 *
 * TEMPORARY: hand-written while the UI runs on mock data. Once the backend emits
 * openapi.json these become aliases of the generated `components['schemas']`
 * types, and nothing outside src/api/ should need to change.
 */

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished' | 'abandoned';
export type ProgressSource = 'manual' | 'device' | 'kindle_sim';
export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface BookDto {
  olWorkKey: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  firstPublishedYear: number | null;
  /** One primary genre, mapped from Open Library subjects when the book enters the catalog. */
  genre: string | null;
}

export interface CatalogBookDto extends BookDto {
  /** Set when the caller already has this book in their library. */
  libraryBookId: string | null;
}

export interface ProgressDto {
  /** Canonical unit: e-readers report percent, not pages. 0 when nothing logged yet. */
  percent: number;
  page: number | null;
  source: ProgressSource | null;
  occurredAt: string | null;
}

export interface PaceDto {
  /** Percent gained over the trailing 14 days ÷ 14. Null when not reading. */
  percentPerDay: number | null;
  pagesPerDay: number | null;
  /** Projected finish date (ISO). Null when pace is zero/unknown. */
  eta: string | null;
}

export interface LibraryBookDto {
  id: string;
  book: BookDto;
  status: ReadingStatus;
  addedAt: string;
  finishedAt: string | null;
  progress: ProgressDto;
  pace: PaceDto;
}

export interface ReadingEventDto {
  id: string;
  percent: number;
  page: number | null;
  source: ProgressSource;
  occurredAt: string;
  receivedAt: string;
}

export interface StackRefDto {
  id: string;
  name: string;
}

export interface LibraryBookDetailDto extends LibraryBookDto {
  /** Newest first, max 50. */
  events: ReadingEventDto[];
  stacks: StackRefDto[];
}

export interface StackSummaryDto {
  id: string;
  name: string;
  description: string | null;
  targetCount: number | null;
  dueOn: string | null;
  createdAt: string;
  bookCount: number;
  finishedCount: number;
  /** coalesce(targetCount, bookCount) */
  goal: number;
  /** null when there is no due date; otherwise finished/goal ≥ elapsed fraction of the window. */
  onTrack: boolean | null;
  /** First few books, in stack order, for the spine preview. */
  preview: { libraryBookId: string; title: string; coverUrl: string | null; pageCount: number | null; status: ReadingStatus }[];
}

export interface StackDetailDto extends StackSummaryDto {
  books: LibraryBookDto[];
}

export interface SyncRunDto {
  id: string;
  source: ProgressSource;
  status: SyncStatus;
  eventsIngested: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * `GET /v1/stats`: everything on the "Read" page, computed from reading events in one
 * query. Days are UTC calendar days. "Pages read" counts new ground only: a page you
 * re-read after jumping back is not counted twice.
 */
export interface ReadingStatsDto {
  year: number;
  booksFinished: { thisYear: number; allTime: number };
  pagesRead: { thisYear: number; allTime: number };
  /** Books finished this year by primary genre, most first. */
  genres: { genre: string; books: number; pages: number }[];
  /** The last 12 calendar months, oldest first; `month` is YYYY-MM. */
  monthly: { month: string; books: number; pages: number }[];
  /** The last 182 days (26 weeks), oldest first; `day` is YYYY-MM-DD. */
  daily: { day: string; pages: number }[];
  pace: {
    /** Pages read in the last 30 days ÷ 30. */
    pagesPerDay30d: number;
    /** Consecutive reading days up to today (or yesterday, if you haven't read yet today). */
    currentStreakDays: number;
    longestStreakDays: number;
  };
  /** Fewest days from first reading event to finished. */
  fastestFinish: { libraryBookId: string; title: string; days: number } | null;
}

/** Uniform error body: `{ error: { code, message, details? } }`. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ---- request bodies ----
export interface AddToLibraryBody {
  olWorkKey: string;
}
export type LogProgressBody = { percent: number } | { page: number };
export interface UpdateLibraryBookBody {
  finished?: boolean;
  abandoned?: boolean;
}
export interface CreateStackBody {
  name: string;
  description?: string | null;
  targetCount?: number | null;
  dueOn?: string | null;
}
export type UpdateStackBody = Partial<CreateStackBody>;
export type LibraryStatusFilter = ReadingStatus | undefined;
