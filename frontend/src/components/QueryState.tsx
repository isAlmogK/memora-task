import type { UseQueryResult } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../api/errors';
import { cx } from '../lib/cx';

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  /** Shape-of-the-content placeholder shown on first load. */
  loading: ReactNode;
  /** Shown when the request succeeded but there's nothing to show. */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

/** Every query on screen goes through this, so loading / error / empty are never forgotten. */
export function QueryState<T>({ query, loading, empty, isEmpty, children }: QueryStateProps<T>) {
  if (query.isPending) return <DelayedSkeleton>{loading}</DelayedSkeleton>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Check your connection and try again.';
}

/**
 * Most responses land in well under 200ms; showing a skeleton for those just flickers.
 * So the placeholder only appears if the wait is actually noticeable, and fades in.
 */
function DelayedSkeleton({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 180);
    return () => clearTimeout(t);
  }, []);
  return show ? (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  ) : null;
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={cx('flex items-baseline gap-3 text-sm', compact ? 'py-1' : 'py-10')}>
      <span className="text-danger">{errorMessage(error)}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded bg-ink/[0.07]', className)} />;
}

export function CoverSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cx('aspect-[2/3] rounded-[3px]', className)} />;
}
