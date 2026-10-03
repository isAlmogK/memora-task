import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/errors';
import { useLibraryBook, useRemoveFromLibrary, useStackMembership, useStacks, useUpdateLibraryBook } from '../api/queries';
import type { LibraryBookDetailDto, ReadingEventDto } from '../api/types';
import { CountUp } from '../components/CountUp';
import { Cover } from '../components/Cover';
import { PaceLine } from '../components/Pace';
import { ProgressBar } from '../components/ProgressBar';
import { ProgressUpdater } from '../components/ProgressUpdater';
import { CoverSkeleton, ErrorState, QueryState, Skeleton } from '../components/QueryState';
import { StatusLabel } from '../components/StatusLabel';
import { useAmbientFrom } from '../components/ambient';
import { ArrowIcon, CheckIcon, PlusIcon } from '../components/icons';
import { coverLayoutId, useCoverScope, type CoverScope } from '../lib/coverMorph';
import { cx } from '../lib/cx';
import { authorsLine, formatPercent, SOURCE_LABEL, timeAgo } from '../lib/format';
import { spring, staggerItem, staggerList } from '../motion/presets';
import { NotFoundPage } from './NotFoundPage';

export function BookPage() {
  const { id = '' } = useParams();
  const scope = useCoverScope();
  const book = useLibraryBook(id);

  if (book.error instanceof ApiError && book.error.status === 404) {
    return <NotFoundPage title="That book isn’t in your library" />;
  }
  return (
    <QueryState query={book} loading={<BookSkeleton />}>
      {(item) => <BookDetail item={item} scope={scope} loadingDetail={book.isPlaceholderData} />}
    </QueryState>
  );
}

function BookDetail({ item, scope, loadingDetail }: { item: LibraryBookDetailDto; scope: CoverScope; loadingDetail: boolean }) {
  const { book, progress } = item;
  useAmbientFrom(book.coverUrl);
  return (
    <div className="pt-6">
      <BackLink />
      <div className="mt-8 grid gap-10 md:grid-cols-[auto_1fr] md:gap-16">
        <div className="justify-self-center md:justify-self-start">
          <div className="md:sticky md:top-28">
            <Cover book={book} size="xl" tilt layoutId={coverLayoutId(scope, item.id)} />
          </div>
        </div>

        {/* everything but the cover staggers in while the cover is still flying */}
        <motion.div variants={staggerList} initial="hidden" animate="show" className="min-w-0">
          <motion.div variants={staggerItem}>
            <StatusLabel status={item.status} />
            <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{book.title}</h1>
            <p className="mt-2 text-lg text-muted">{authorsLine(book.authors)}</p>
            <p className="mt-1 text-sm text-muted">
              {[book.firstPublishedYear, book.pageCount && `${book.pageCount} pages`].filter(Boolean).join(' · ')}
            </p>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-10">
            <div className="flex items-center gap-5">
              <ProgressBar value={progress.percent} size="thick" label={`${book.title} progress`} className="flex-1" />
              <span className="w-16 text-right font-display text-3xl">
                <CountUp value={progress.percent} format={formatPercent} />
              </span>
            </div>
            <div className="mt-2 space-y-0.5">
              {progress.page != null && book.pageCount && (
                <p className="text-sm text-muted">
                  Page {progress.page} of {book.pageCount}
                </p>
              )}
              <PaceLine item={item} />
            </div>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-8 flex flex-wrap items-start gap-3">
            {item.status !== 'finished' && <ProgressUpdater key={item.id} item={item} />}
            <StatusActions item={item} />
          </motion.div>

          <motion.div variants={staggerItem} className="mt-12">
            <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted">In stacks</h2>
            <StackChips item={item} />
          </motion.div>

          <motion.div variants={staggerItem} className="mt-12">
            <h2 className="mb-1 text-xs uppercase tracking-[0.14em] text-muted">Activity</h2>
            {loadingDetail ? <ActivitySkeleton /> : <Activity events={item.events} />}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function BackLink() {
  const navigate = useNavigate();
  // React Router keeps its own history index; > 0 means there's an in-app page to go back to.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  return (
    <button
      onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
      className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
    >
      <span className="transition-transform group-hover:-translate-x-0.5">
        <ArrowIcon dir="left" width={15} height={15} />
      </span>
      Back
    </button>
  );
}

/** Finished / put down are explicit user choices; everything else is derived from progress events. */
function StatusActions({ item }: { item: LibraryBookDetailDto }) {
  const update = useUpdateLibraryBook(item.id);
  const btn = 'rounded-full px-3 py-1.5 text-sm text-muted hover:bg-ink/[0.05] hover:text-ink disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {(item.status === 'reading' || item.status === 'want_to_read') && (
        <>
          <button className={btn} disabled={update.isPending} onClick={() => update.mutate({ finished: true })}>
            Mark as finished
          </button>
          <button className={btn} disabled={update.isPending} onClick={() => update.mutate({ abandoned: true })}>
            Put it down
          </button>
        </>
      )}
      {/* 100% is "finished" by definition; only an explicit finish can be undone */}
      {item.status === 'finished' && item.progress.percent < 100 && (
        <button className={btn} disabled={update.isPending} onClick={() => update.mutate({ finished: false })}>
          Not finished after all
        </button>
      )}
      {item.status === 'abandoned' && (
        <button className={btn} disabled={update.isPending} onClick={() => update.mutate({ abandoned: false })}>
          Pick it back up
        </button>
      )}
      <RemoveFromLibrary item={item} />
      {update.isError && <ErrorState error={update.error} compact />}
    </div>
  );
}

/** Two-step, because it also deletes the reading history and stack memberships. */
function RemoveFromLibrary({ item }: { item: LibraryBookDetailDto }) {
  const remove = useRemoveFromLibrary();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-danger/10 hover:text-danger"
      >
        Remove from library
      </button>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">
        Remove “{item.book.title}”? Its reading history{item.stacks.length > 0 && ' and stack memberships'} go too.
      </span>
      <button
        onClick={() => remove.mutate(item.id, { onSuccess: () => navigate('/library', { replace: true }) })}
        disabled={remove.isPending}
        className="rounded-full bg-danger px-3 py-1.5 text-paper disabled:opacity-60"
      >
        {remove.isPending ? 'Removing…' : 'Remove'}
      </button>
      <button onClick={() => setConfirming(false)} className="px-2 py-1.5 text-muted hover:text-ink">
        Cancel
      </button>
      {remove.isError && <ErrorState error={remove.error} compact />}
    </motion.div>
  );
}

function StackChips({ item }: { item: LibraryBookDetailDto }) {
  const stacks = useStacks();
  const membership = useStackMembership();
  const inStack = new Set(item.stacks.map((s) => s.id));

  return (
    <QueryState
      query={stacks}
      loading={<Skeleton className="h-8 w-64 rounded-full" />}
      isEmpty={(list) => list.length === 0}
      empty={
        <p className="text-sm text-muted">
          No stacks yet.{' '}
          <Link to="/stacks" className="text-ink underline underline-offset-4">
            Create one
          </Link>
        </p>
      }
    >
      {(list) => (
        <div className="flex flex-wrap gap-2">
          {list.map((s) => {
            const member = inStack.has(s.id);
            const pending = membership.isPending && membership.variables.stackId === s.id;
            return (
              <motion.button
                key={s.id}
                layout
                whileTap={{ scale: 0.92 }}
                transition={spring.bouncy}
                disabled={pending}
                aria-pressed={member}
                onClick={() => membership.mutate({ stackId: s.id, libraryBookId: item.id, member: !member })}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors disabled:opacity-60',
                  member ? 'bg-ink text-paper' : 'text-muted ring-1 ring-ink/15 hover:text-ink hover:ring-ink/40',
                )}
              >
                {member ? <CheckIcon width={14} height={14} /> : <PlusIcon width={14} height={14} />}
                {s.name}
              </motion.button>
            );
          })}
          {membership.isError && <ErrorState error={membership.error} compact />}
        </div>
      )}
    </QueryState>
  );
}

const LATE_MS = 10 * 60_000;

function Activity({ events }: { events: ReadingEventDto[] }) {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return <p className="py-3 text-sm text-muted">No reading logged yet.</p>;
  const shown = showAll ? events : events.slice(0, 8);

  return (
    <>
      <ol>
        <AnimatePresence initial={false}>
          {shown.map((e) => {
            // Ordered by when you read it, not when it reached us; say so when they differ.
            const late = Date.parse(e.receivedAt) - Date.parse(e.occurredAt) > LATE_MS;
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-baseline gap-4 border-b border-ink/[0.06] py-3 text-sm">
                  <span className="w-12 font-display text-base tabular-nums">{formatPercent(e.percent)}</span>
                  <span className="flex-1 text-muted">
                    {SOURCE_LABEL[e.source]}
                    {e.page != null && ` · p. ${e.page}`}
                    {late && <span className="text-faint"> · arrived {timeAgo(e.receivedAt)}</span>}
                  </span>
                  <time dateTime={e.occurredAt} className="text-xs text-muted">
                    {timeAgo(e.occurredAt)}
                  </time>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {events.length > shown.length && (
        <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink">
          Show all {events.length}
        </button>
      )}
    </>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3 py-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

function BookSkeleton() {
  return (
    <div className="mt-16 grid gap-16 md:grid-cols-[auto_1fr]">
      <CoverSkeleton className="w-56 sm:w-64" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-10 h-2.5 w-full" />
      </div>
    </div>
  );
}
