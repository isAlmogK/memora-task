import { createBrowserRouter } from 'react-router';
import { queries } from '../api/queries';
import { HomePage } from '../pages/HomePage';
import { SearchRedirect } from '../pages/SearchRedirect';
import { parseStatus } from '../lib/status';
import { Layout } from './Layout';
import { queryClient } from './queryClient';

/**
 * Home ships in the main bundle; every other page is its own chunk. The router loads a
 * chunk before it switches routes (no Suspense flash), and preloadRoutes() fetches them
 * all while the browser is idle, so in practice navigation never waits on code.
 */
const pages = {
  book: () => import('../pages/BookPage'),
  stacks: () => import('../pages/StacksPage'),
  stack: () => import('../pages/StackPage'),
  read: () => import('../pages/ReadPage'),
  library: () => import('../pages/LibraryPage'),
  notFound: () => import('../pages/NotFoundPage'),
};

export function preloadRoutes() {
  const run = () => Object.values(pages).forEach((load) => void load());
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 1200);
}

/**
 * Loaders start each page's requests the moment navigation begins (in parallel with its
 * code chunk) and return immediately: the page renders from cache when the data is there
 * and shows its own loading state when it isn't. Never blocks the transition.
 */
const warm = queryClient.prefetchQuery.bind(queryClient);
const started = (..._requests: Promise<void>[]) => null; // prefetchQuery never rejects



export const router = createBrowserRouter([
  {
    element: <Layout />,
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        element: <HomePage />,
        loader: () =>
          started(warm(queries.library('reading')), warm(queries.library()), warm(queries.library('want_to_read')), warm(queries.library('finished')), warm(queries.library('abandoned')), warm(queries.stacks()), warm(queries.stats())),
      },
      {
        path: 'books/:id',
        loader: ({ params }) => started(warm(queries.libraryBook(params.id!)), warm(queries.stacks())),
        lazy: async () => ({ Component: (await pages.book()).BookPage }),
      },
      { path: 'search', element: <SearchRedirect /> },
      {
        path: 'read',
        loader: () => started(warm(queries.stats()), warm(queries.library('finished'))),
        lazy: async () => ({ Component: (await pages.read()).ReadPage }),
      },
      {
        path: 'library',
        loader: ({ request }) => {
          return started(warm(queries.library(parseStatus(new URL(request.url).searchParams.get('status')))));
        },
        lazy: async () => ({ Component: (await pages.library()).LibraryPage }),
      },
      {
        path: 'stacks',
        loader: () =>
          started(warm(queries.stacks()), warm(queries.library()), warm(queries.library('want_to_read')), warm(queries.library('finished')), warm(queries.library('abandoned')), warm(queries.stats())),
        lazy: async () => ({ Component: (await pages.stacks()).StacksPage }),
      },
      {
        path: 'stacks/:id',
        loader: ({ params }) => started(warm(queries.stack(params.id!))),
        lazy: async () => ({ Component: (await pages.stack()).StackPage }),
      },
      { path: '*', lazy: async () => ({ Component: (await pages.notFound()).NotFoundPage }) },
    ],
  },
]);
