export { ApiError } from './errors';
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

  listStacks(): Promise<StackSummaryDto[]>;
  getStack(id: string): Promise<StackDetailDto>;
  createStack(body: CreateStackBody): Promise<StackSummaryDto>;
  updateStack(id: string, body: UpdateStackBody): Promise<StackSummaryDto>;
  deleteStack(id: string): Promise<void>;
  addToStack(stackId: string, libraryBookId: string): Promise<StackDetailDto>;
  removeFromStack(stackId: string, libraryBookId: string): Promise<StackDetailDto>;

  getStats(): Promise<ReadingStatsDto>;

  startSync(): Promise<SyncRunDto>;
  getSyncRun(id: string): Promise<SyncRunDto>;
  listSyncRuns(limit: number): Promise<SyncRunDto[]>;
}

export const api: StacksApi = mockApi;
