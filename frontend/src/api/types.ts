/**
 * Shapes of the Stacks API (v1).
 *
 * Everything the backend already serves is an alias of the types generated from its
 * OpenAPI spec (schema.d.ts, via `npm run gen:api`), so a contract change on the server
 * shows up here as a compile error, not a runtime surprise. The mock implements the
 * same types.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type BookDto = Schemas['BookDto'];
export type CatalogBookDto = Schemas['CatalogBookDto'];
export type ProgressDto = Schemas['ProgressDto'];
export type PaceDto = Schemas['PaceDto'];
export type LibraryBookDto = Schemas['LibraryBookDto'];
export type LibraryBookDetailDto = Schemas['LibraryBookDetailDto'];
export type ReadingEventDto = Schemas['ReadingEventDto'];
export type StackRefDto = Schemas['StackRefDto'];
export type StackSummaryDto = Schemas['StackSummaryDto'];
export type StackDetailDto = Schemas['StackDetailDto'];
export type ApiErrorBody = Schemas['ApiErrorBody'];

export type ReadingStatus = LibraryBookDto['status'];
export type ProgressSource = ReadingEventDto['source'];
export type LibraryStatusFilter = ReadingStatus | undefined;

// ---------- request bodies ----------
export type AddToLibraryBody = Schemas['AddToLibraryBody'];
/** The API takes exactly one of the two; the union says so at compile time too. */
export type LogProgressBody = { percent: number; page?: never } | { page: number; percent?: never };
export type UpdateLibraryBookBody = Schemas['UpdateLibraryBookBody'];
export type CreateStackBody = Schemas['CreateStackBody'];
export type UpdateStackBody = Schemas['UpdateStackBody'];

// ---------- not served by the backend yet ----------
// TEMPORARY: hand-written until GET /v1/stats and /v1/sync-runs exist; the mock serves
// them meanwhile. Then these become aliases like the ones above.

export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'failed';

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

