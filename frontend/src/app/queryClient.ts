import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // 4xx won't get better by retrying (404 for someone else's stack, 400 for bad input).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});
