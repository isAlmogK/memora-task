export { ApiError } from './errors';
import { httpApi } from './http';
import { mockApi } from './mock/server';
import type {
  AddToLibraryBody,
  CatalogBookDto,
  CreateStackBody,
  LibraryBookDetailDto,
  LibraryBookDto,
  LibraryStatusFilter,
  ReadingStatsDto,
  LogProgressBody,
  MoveResultDto,
  StackDetailDto,
  StackSummaryDto,
  SyncRunDto,
  UpdateLibraryBookBody,
  UpdateStackBody,
} from './types';

/** One method per endpoint. The mock and (later) the openapi-fetch client both implement this. */
export interface StacksApi {
  searchCatalog(q: string): Promise<CatalogBookDto[]>;

  listLibrary(status?: LibraryStatusFilter): Promise<LibraryBookDto[]>;
  getLibraryBook(id: string): Promise<LibraryBookDetailDto>;
  addToLibrary(body: AddToLibraryBody): Promise<LibraryBookDto>;
  logProgress(id: string, body: LogProgressBody): Promise<LibraryBookDetailDto>;
  updateLibraryBook(id: string, body: UpdateLibraryBookBody): Promise<LibraryBookDto>;
  removeFromLibrary(id: string): Promise<void>;

  listStacks(): Promise<StackSummaryDto[]>;
  getStack(id: string): Promise<StackDetailDto>;
  createStack(body: CreateStackBody): Promise<StackSummaryDto>;
  updateStack(id: string, body: UpdateStackBody): Promise<StackSummaryDto>;
  deleteStack(id: string): Promise<void>;
  addToStack(stackId: string, libraryBookId: string): Promise<StackDetailDto>;
  removeFromStack(stackId: string, libraryBookId: string): Promise<StackDetailDto>;
  /** The complete new order: every book in the stack, exactly once. */
  reorderStack(stackId: string, libraryBookIds: string[]): Promise<StackDetailDto>;
  moveStackBook(fromStackId: string, libraryBookId: string, toStackId: string): Promise<MoveResultDto>;

  getStats(): Promise<ReadingStatsDto>;

  startSync(): Promise<SyncRunDto>;
  getSyncRun(id: string): Promise<SyncRunDto>;
  listSyncRuns(limit: number): Promise<SyncRunDto[]>;
}

/**
 * `npm run dev` talks to the real API; `npm run dev:mock` runs on the in-browser mock (no
 * backend needed, plus slow/error/empty modes for reviewing UI states). Both implement
 * this interface, so nothing above this file knows which one it's using.
 */
export const isMock = import.meta.env.VITE_API_MODE === 'mock';
export const api: StacksApi = isMock ? mockApi : httpApi;
