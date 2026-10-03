import type { ReadingStatus } from '../api/types';

const STATUSES: readonly ReadingStatus[] = ['reading', 'want_to_read', 'finished', 'abandoned'];

/** For `?status=` from the URL: anything unknown means "all". */
export function parseStatus(value: string | null): ReadingStatus | undefined {
  return STATUSES.find((s) => s === value);
}
