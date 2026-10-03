import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { parseStatus } from '../lib/status';
import { api } from './client';
import type {
  CreateStackBody,
  LibraryBookDetailDto,
  LibraryBookDto,
  LibraryStatusFilter,
  LogProgressBody,
  SyncRunDto,
  UpdateLibraryBookBody,
  UpdateStackBody,
} from './types';

export const qk = {
  library: ['library'] as const,
  libraryList: (status: LibraryStatusFilter) => ['library', 'list', status ?? 'all'] as const,
  libraryBook: (id: string) => ['library', 'detail', id] as const,
  stacks: ['stacks'] as const,
  stack: (id: string) => ['stacks', id] as const,
  catalog: (q: string) => ['catalog', q] as const,
  latestSync: ['sync-runs', 'latest'] as const,
  stats: ['stats'] as const,
};

/**
 * Query definitions shared by the hooks below, the router loaders (which start fetching
 * as soon as a navigation begins) and hover prefetch — one key/fn pair per endpoint.
 */
export const queries = {
  library: (status?: LibraryStatusFilter) =>
    queryOptions({ queryKey: qk.libraryList(status), queryFn: () => api.listLibrary(status) }),
  libraryBook: (id: string) => queryOptions({ queryKey: qk.libraryBook(id), queryFn: () => api.getLibraryBook(id) }),
  stacks: () => queryOptions({ queryKey: qk.stacks, queryFn: () => api.listStacks() }),
  stack: (id: string) => queryOptions({ queryKey: qk.stack(id), queryFn: () => api.getStack(id) }),
  stats: () => queryOptions({ queryKey: qk.stats, queryFn: () => api.getStats() }),
};

/** Progress changes ripple into library rows, book detail, stack counts and search badges. */
function invalidateReadingData(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.library }),
    qc.invalidateQueries({ queryKey: qk.stacks }),
    qc.invalidateQueries({ queryKey: qk.stats }),
  ]);
}

// ---------- library ----------

export function useLibrary(status?: LibraryStatusFilter) {
  return useQuery({
    ...queries.library(status),
    // Switching the status filter keeps the old grid on screen so it can reflow, not blank out.
    placeholderData: keepPreviousData,
  });
}

export function useLibraryBook(id: string) {
  const qc = useQueryClient();
  return useQuery({
    ...queries.libraryBook(id),
    // Render the row we already have from a list instantly (lets the cover morph), then fill in events.
    placeholderData: () => {
      const rows = qc.getQueriesData<LibraryBookDto[]>({ queryKey: ['library', 'list'] }).flatMap(([, d]) => d ?? []);
      const row = rows.find((r) => r.id === id);
      return row ? ({ ...row, events: [], stacks: [] } satisfies LibraryBookDetailDto) : undefined;
    },
  });
}

export function useAddToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (olWorkKey: string) => api.addToLibrary({ olWorkKey }),
    onSuccess: () =>
      Promise.all([invalidateReadingData(qc), qc.invalidateQueries({ queryKey: ['catalog'] })]),
  });
}

export function useLogProgress(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogProgressBody) => api.logProgress(id, body),
    onSuccess: (detail) => {
      qc.setQueryData(qk.libraryBook(id), detail);
      return invalidateReadingData(qc);
    },
  });
}

export function useUpdateLibraryBook(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLibraryBookBody) => api.updateLibraryBook(id, body),
    onSuccess: () => invalidateReadingData(qc),
  });
}

export function useRemoveFromLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeFromLibrary(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: qk.libraryBook(id) });
      // not awaited, for the same reason as useDeleteStack
      void Promise.all([invalidateReadingData(qc), qc.invalidateQueries({ queryKey: ['catalog'] })]);
    },
  });
}

// ---------- catalog ----------

export function useCatalogSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.catalog(term),
    queryFn: () => api.searchCatalog(term),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// ---------- stacks ----------

export function useStacks() {
  return useQuery(queries.stacks());
}

export function useStack(id: string) {
  return useQuery(queries.stack(id));
}

export function useCreateStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStackBody) => api.createStack(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stacks }),
  });
}

export function useUpdateStack(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStackBody) => api.updateStack(id, body),
    onSuccess: () => invalidateReadingData(qc),
  });
}

export function useDeleteStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteStack(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: qk.stack(id) });
      // Don't await: the caller navigates away now, instead of after a refetch of the
      // page it's leaving (which would 404 and flash "not found").
      void invalidateReadingData(qc);
    },
  });
}

export function useStackMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stackId, libraryBookId, member }: { stackId: string; libraryBookId: string; member: boolean }) =>
      member ? api.addToStack(stackId, libraryBookId) : api.removeFromStack(stackId, libraryBookId),
    onSuccess: (stack) => {
      qc.setQueryData(qk.stack(stack.id), stack);
      return invalidateReadingData(qc);
    },
  });
}

// ---------- stats ----------

export function useStats() {
  return useQuery(queries.stats());
}

// ---------- prefetch on intent ----------

/**
 * Hovering or focusing a link starts its data request, so by the time the click lands
 * the page usually renders from cache with no loading state. One delegated listener
 * covers every link in the app; prefetchQuery respects staleTime, so it doesn't spam.
 */
export function usePrefetchOnIntent() {
  const qc = useQueryClient();
  useEffect(() => {
    const onIntent = (e: Event) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const path = new URL(link.href).pathname;
      const book = path.match(/^\/books\/([^/]+)$/)?.[1];
      const stack = path.match(/^\/stacks\/([^/]+)$/)?.[1];
      if (book) void qc.prefetchQuery(queries.libraryBook(book));
      else if (stack) void qc.prefetchQuery(queries.stack(stack));
      else if (path === '/read') void qc.prefetchQuery(queries.stats());
      else if (path === '/stacks') void qc.prefetchQuery(queries.stacks());
      else if (path === '/library') {
        void qc.prefetchQuery(queries.library(parseStatus(new URL(link.href).searchParams.get('status'))));
      }
    };
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    return () => {
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
    };
  }, [qc]);
}

// ---------- sync runs ----------

const isActive = (run: SyncRunDto | undefined) => run?.status === 'queued' || run?.status === 'running';

export function useLatestSyncRun() {
  return useQuery({
    queryKey: qk.latestSync,
    queryFn: async () => (await api.listSyncRuns(1))[0] ?? null,
    // Poll only while a job is in flight; idle otherwise.
    refetchInterval: (query) => (isActive(query.state.data ?? undefined) ? 700 : false),
  });
}

export function useStartSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.startSync(),
    onSuccess: (run) => qc.setQueryData(qk.latestSync, run),
  });
}

/**
 * Refreshes reading data each time the running job ingests another event, so
 * progress bars move one at a time while the sync is still going.
 */
export function useSyncSideEffects(run: SyncRunDto | null | undefined) {
  const qc = useQueryClient();
  const seen = useRef<{ id: string; events: number; status: string } | null>(null);
  useEffect(() => {
    if (!run) return;
    const prev = seen.current;
    seen.current = { id: run.id, events: run.eventsIngested, status: run.status };
    if (!prev || prev.id !== run.id) return;
    if (run.eventsIngested > prev.events || (run.status !== prev.status && !isActive(run))) {
      void invalidateReadingData(qc);
    }
  }, [run, qc]);
}
