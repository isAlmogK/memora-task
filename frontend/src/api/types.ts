/**
 * Shapes of the Stacks API (v1).
 *
 * Every type here is an alias of (or narrows) the types generated from the backend's
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
export type MoveResultDto = Schemas['MoveResultDto'];
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

// ---------- stats and sync ----------
export type ReadingStatsDto = Schemas['ReadingStatsDto'];
export type SyncRunDto = Schemas['SyncRunDto'];
export type SyncStatus = SyncRunDto['status'];
