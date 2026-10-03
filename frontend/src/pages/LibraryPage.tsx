import { AnimatePresence, motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import { useLibrary } from '../api/queries';
import type { LibraryBookDto, LibraryStatusFilter } from '../api/types';
import { Cover } from '../components/Cover';
import { ProgressBar } from '../components/ProgressBar';
import { CoverSkeleton, EmptyState, QueryState, Skeleton } from '../components/QueryState';
import { SearchButton } from '../components/SearchOverlay';
import { StatusLabel } from '../components/StatusLabel';
import { ArrowIcon } from '../components/icons';
import { bookLink, coverLayoutId } from '../lib/coverMorph';
import { cx } from '../lib/cx';
import { STATUS_LABEL } from '../lib/format';
import { parseStatus } from '../lib/status';
import { spring } from '../motion/presets';

const FILTERS: LibraryStatusFilter[] = [undefined, 'reading', 'want_to_read', 'finished', 'abandoned'];

/**
 * The Library automatic stack: every book you've added, filtered by status. The filter
 * lives in the URL (?status=), so the Want to read / Put down cards link straight to a
 * filtered view and back/forward work.
 */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const setStatus = (next: LibraryStatusFilter) => setParams(next ? { status: next } : {}, { replace: true });
  const library = useLibrary(status);

  return (
    <div className="pt-6">
      <Link to="/stacks" className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <span className="transition-transform group-hover:-translate-x-0.5">
          <ArrowIcon dir="left" width={15} height={15} />
        </span>
        Stacks
      </Link>
      <div className="mt-4 mb-8 flex items-center gap-2">
        <h1 className="font-display text-4xl sm:text-5xl">Library</h1>
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-paper">Auto</span>
      </div>
      <div role="tablist" aria-label="Filter by status" className="-mx-1 mb-8 flex flex-wrap gap-1 text-sm">
        {FILTERS.map((f) => {
          const active = f === status;
          return (
            <button
              key={f ?? 'all'}
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(f)}
              className={cx('relative rounded-full px-3.5 py-1.5 transition-colors', active ? 'text-paper' : 'text-muted hover:text-ink')}
            >
              {active && <motion.span layoutId="library-filter" transition={spring.bouncy} className="absolute inset-0 rounded-full bg-ink" />}
              <span className="relative">{f ? STATUS_LABEL[f] : 'All'}</span>
            </button>
          );
        })}
      </div>

      <QueryState
        query={library}
        loading={<GridSkeleton />}
        isEmpty={(books) => books.length === 0}
        empty={
          <EmptyState title={status ? `Nothing ${STATUS_LABEL[status].toLowerCase()}` : 'Your library is empty'}>
            {!status && (
              <SearchButton className="underline underline-offset-4">Search for a book to add</SearchButton>
            )}
          </EmptyState>
        }
      >
        {(books) => (
          <motion.ul
            layout
            className={cx(
              'grid grid-cols-3 gap-x-5 gap-y-9 transition-opacity sm:grid-cols-4 lg:grid-cols-6',
              library.isPlaceholderData && 'opacity-60',
            )}
          >
            <AnimatePresence mode="popLayout" initial={true}>
              {books.map((b, i) => (
                <motion.li
                  key={b.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ ...spring.smooth, delay: Math.min(i, 12) * 0.03, layout: spring.morph }}
                >
                  <LibraryTile item={b} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </QueryState>
    </div>
  );
}

function LibraryTile({ item }: { item: LibraryBookDto }) {
  return (
    <Link {...bookLink(item.id, 'grid')} className="group block">
      <motion.div whileHover={{ y: -6 }} transition={spring.bouncy}>
        <Cover book={item.book} size="md" layoutId={coverLayoutId('grid', item.id)} className="w-full!" />
      </motion.div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{item.book.title}</p>
      {item.status === 'reading' ? (
        <ProgressBar value={item.progress.percent} label={`${item.book.title} progress`} className="mt-2" />
      ) : (
        <StatusLabel status={item.status} className="mt-1.5 text-[0.65rem]!" />
      )}
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-x-5 gap-y-9 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <CoverSkeleton />
          <Skeleton className="mt-3 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
