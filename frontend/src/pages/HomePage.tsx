import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLibrary } from '../api/queries';
import type { LibraryBookDto } from '../api/types';
import { CountUp } from '../components/CountUp';
import { Cover } from '../components/Cover';
import { PaceLine } from '../components/Pace';
import { ProgressBar } from '../components/ProgressBar';
import { ProgressUpdater } from '../components/ProgressUpdater';
import { CoverSkeleton, EmptyState, QueryState, Skeleton } from '../components/QueryState';
import { SearchButton } from '../components/SearchOverlay';
import { Section } from '../components/Section';
import { AutoStacksGrid, YourStacksGrid } from '../components/StackRows';
import { useAmbientFrom } from '../components/ambient';
import { ArrowIcon } from '../components/icons';
import { bookLink, coverLayoutId } from '../lib/coverMorph';
import { authorsLine, formatPercent, SOURCE_LABEL, timeAgo } from '../lib/format';
import { carousel, spring } from '../motion/presets';

export function HomePage() {
  return (
    <>
      <NowReading />
      <YourStacks />
      <AutoStacks />
    </>
  );
}

// ---------- Now reading: hero carousel ----------

function NowReading() {
  const reading = useLibrary('reading');
  return (
    <Section title="Now reading" className="mt-8">
      <QueryState
        query={reading}
        loading={<HeroSkeleton />}
        isEmpty={(books) => books.length === 0}
        empty={
          <EmptyState title="Nothing on the go">
            <SearchButton className="underline underline-offset-4">Find a book</SearchButton>{' '}
            or pick one from{' '}
            <Link to="/library?status=want_to_read" className="underline underline-offset-4">
              Want to read
            </Link>
            .
          </EmptyState>
        }
      >
        {(books) => <HeroCarousel books={books} />}
      </QueryState>
    </Section>
  );
}

function HeroCarousel({ books }: { books: LibraryBookDto[] }) {
  // Remember the book, not the position: a sync re-sorts the list by latest activity, and
  // the hero shouldn't swap books under you. If yours leaves "reading" (finished), show the first.
  const [[bookId, dir], setPage] = useState<[string | null, number]>([null, 1]);
  const found = books.findIndex((b) => b.id === bookId);
  const current = found >= 0 ? found : 0;
  const dragged = useRef(false);
  const book = books[current];
  useAmbientFrom(book?.book.coverUrl);
  if (!book) return null;

  function go(next: number) {
    const wrapped = (next + books.length) % books.length;
    setPage([books[wrapped]!.id, next > current ? 1 : -1]);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 || info.velocity.x < -400) go(current + 1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(current - 1);
  }

  return (
    <div>
      <div className="relative min-h-[26rem]">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.article
            key={book.id}
            custom={dir}
            variants={carousel}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-14"
          >
            <motion.div
              drag={books.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragStart={() => (dragged.current = true)}
              onDragEnd={onDragEnd}
              className="justify-self-center sm:justify-self-start"
            >
              <Link
                {...bookLink(book.id, 'hero')}
                draggable={false}
                aria-label={`Open ${book.book.title}`}
                // A swipe ends with a click on the cover; don't treat it as "open the book".
                onClickCapture={(e) => {
                  if (dragged.current) e.preventDefault();
                  dragged.current = false;
                }}
              >
                <Cover book={book.book} size="xl" tilt layoutId={coverLayoutId('hero', book.id)} />
              </Link>
            </motion.div>

            <div className="min-w-0">
              <Link {...bookLink(book.id, 'hero')} className="decoration-ink/20 underline-offset-8 hover:underline">
                <h3 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{book.book.title}</h3>
              </Link>
              <p className="mt-2 text-lg text-muted">{authorsLine(book.book.authors)}</p>

              <div className="mt-10 flex items-center gap-5">
                <ProgressBar value={book.progress.percent} size="thick" label={`${book.book.title} progress`} className="flex-1" />
                <span className="w-16 text-right font-display text-3xl">
                  <CountUp value={book.progress.percent} format={formatPercent} />
                </span>
              </div>
              <div className="mt-2 space-y-0.5">
                {book.progress.page != null && book.book.pageCount && (
                  <p className="text-sm text-muted">
                    Page {book.progress.page} of {book.book.pageCount}
                  </p>
                )}
                <PaceLine item={book} />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
                <ProgressUpdater key={book.id} item={book} />
                {book.progress.source && book.progress.occurredAt && (
                  <span className="text-xs text-muted">
                    {SOURCE_LABEL[book.progress.source]} · {timeAgo(book.progress.occurredAt)}
                  </span>
                )}
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      {books.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 sm:justify-start">
          <CarouselArrow dir="left" onClick={() => go(current - 1)} />
          <div className="flex gap-2">
            {books.map((b, i) => (
              <button
                key={b.id}
                onClick={() => go(i)}
                aria-label={`Show ${b.book.title}`}
                aria-current={i === current}
                className="grid size-4 place-items-center"
              >
                <motion.span
                  className="block rounded-full bg-ink"
                  animate={{ width: i === current ? 18 : 6, opacity: i === current ? 1 : 0.25 }}
                  transition={spring.bouncy}
                  style={{ height: 6 }}
                />
              </button>
            ))}
          </div>
          <CarouselArrow dir="right" onClick={() => go(current + 1)} />
        </div>
      )}
    </div>
  );
}

function CarouselArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: dir === 'left' ? -3 : 3 }}
      whileTap={{ scale: 0.88 }}
      transition={spring.bouncy}
      aria-label={dir === 'left' ? 'Previous book' : 'Next book'}
      className="grid size-9 place-items-center rounded-full text-muted hover:text-ink"
    >
      <ArrowIcon dir={dir} />
    </motion.button>
  );
}

function HeroSkeleton() {
  return (
    <div className="grid items-center gap-14 sm:grid-cols-[auto_1fr]">
      <CoverSkeleton className="w-56 sm:w-64" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-10 h-2.5 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

// ---------- Stacks: yours on top, automatic below ----------

function YourStacks() {
  return (
    <Section
      title="Your stacks"
      action={
        <Link to="/stacks" className="hover:text-ink">
          All stacks →
        </Link>
      }
    >
      <YourStacksGrid limit={4} />
    </Section>
  );
}

function AutoStacks() {
  return (
    <Section title="Collected for you" action="Sorted automatically as you read">
      <AutoStacksGrid />
    </Section>
  );
}
