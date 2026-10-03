import createClient from 'openapi-fetch';
import type { StacksApi } from './client';
import { ApiError } from './errors';
import type { paths } from './schema';
import type { ApiErrorBody, ReadingStatsDto, SyncRunDto } from './types';

/**
 * The real API. Paths, params and bodies are checked against the generated OpenAPI types.
 * Vite proxies /v1 to the Nest server in dev, so there's no CORS and no hard-coded host;
 * the key defaults to the seeded dev user.
 */
const KEY = import.meta.env.VITE_API_KEY ?? 'dev-alice-user-key';

const client = createClient<paths>({ baseUrl: '' });
client.use({
  onRequest({ request }) {
    request.headers.set('Authorization', `Bearer ${KEY}`);
    return request;
  },
});

/** openapi-fetch result → data, or the API's `{ error }` body as an ApiError. */
async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach the API. Is the backend running? (npm run start:dev in backend/)');
  }
  const { data, error, response } = result;
  if (response.ok) return data as T; // 204s come back as undefined
  const body = (error as ApiErrorBody | undefined)?.error;
  throw new ApiError(response.status, body?.code ?? 'http_error', body?.message ?? `Request failed (${response.status})`, body?.details);
}

/** For endpoints the backend doesn't serve yet (not in the spec, so no generated types). */
async function untyped<T>(method: 'GET' | 'POST', path: string): Promise<T> {
  return unwrap(
    fetch(path, { method, headers: { Authorization: `Bearer ${KEY}` } }).then(async (response) => {
      const json: unknown = await response.json().catch(() => undefined);
      return response.ok ? { data: json as T, response } : { error: json, response };
    }),
  );
}

export const httpApi: StacksApi = {
  searchCatalog: (q) => unwrap(client.GET('/v1/catalog/search', { params: { query: { q } } })),

  listLibrary: (status) => unwrap(client.GET('/v1/library', { params: { query: { status } } })),
  getLibraryBook: (id) => unwrap(client.GET('/v1/library/{id}', { params: { path: { id } } })),
  addToLibrary: (body) => unwrap(client.POST('/v1/library', { body })),
  logProgress: (id, body) => unwrap(client.POST('/v1/library/{id}/progress', { params: { path: { id } }, body })),
  updateLibraryBook: (id, body) => unwrap(client.PATCH('/v1/library/{id}', { params: { path: { id } }, body })),
  removeFromLibrary: (id) => unwrap(client.DELETE('/v1/library/{id}', { params: { path: { id } } })),

  listStacks: () => unwrap(client.GET('/v1/stacks')),
  getStack: (id) => unwrap(client.GET('/v1/stacks/{id}', { params: { path: { id } } })),
  createStack: (body) => unwrap(client.POST('/v1/stacks', { body })),
  updateStack: (id, body) => unwrap(client.PATCH('/v1/stacks/{id}', { params: { path: { id } }, body })),
  deleteStack: (id) => unwrap(client.DELETE('/v1/stacks/{id}', { params: { path: { id } } })),
  addToStack: (stackId, libraryBookId) =>
    unwrap(client.PUT('/v1/stacks/{id}/books/{libraryBookId}', { params: { path: { id: stackId, libraryBookId } } })),
  removeFromStack: (stackId, libraryBookId) =>
    unwrap(client.DELETE('/v1/stacks/{id}/books/{libraryBookId}', { params: { path: { id: stackId, libraryBookId } } })),
  reorderStack: (stackId, libraryBookIds) =>
    unwrap(client.PUT('/v1/stacks/{id}/order', { params: { path: { id: stackId } }, body: { libraryBookIds } })),
  moveStackBook: (fromStackId, libraryBookId, toStackId) =>
    unwrap(
      client.POST('/v1/stacks/{id}/books/{libraryBookId}/move', {
        params: { path: { id: fromStackId, libraryBookId } },
        body: { toStackId },
      }),
    ),

  // TEMPORARY: the next backend step. Until then these get the API's 404 and the UI shows
  // its error state.
  getStats: () => untyped<ReadingStatsDto>('GET', '/v1/stats'),
  startSync: () => untyped<SyncRunDto>('POST', '/v1/sync-runs'),
  getSyncRun: (id) => untyped<SyncRunDto>('GET', `/v1/sync-runs/${id}`),
  listSyncRuns: (limit) => untyped<SyncRunDto[]>('GET', `/v1/sync-runs?limit=${limit}`),
};
