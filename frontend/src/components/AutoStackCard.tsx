import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useLibrary, useStats } from '../api/queries';
import type { LibraryBookDto, LibraryStatusFilter } from '../api/types';
import { cx } from '../lib/cx';
import { asFanPreview, byFinishedDesc } from '../lib/finished';
import { spring } from '../motion/presets';
import { CountUp } from './CountUp';
import { StackFan } from './StackFan';

export type AutoStackKind = 'library' | 'want_to_read' | 'read' | 'abandoned';

/**
 * Automatic stacks aren't stored: each one is the library filtered by derived status, so
 * they can't drift out of sync and can't be deleted. Dark cards, so they never look like
 * a stack you made.
 */
const AUTO: Record<AutoStackKind, { title: string; blurb: string; to: string; status: LibraryStatusFilter; glow: string; cta: string }> = {
  library: {
    title: 'Library',
    blurb: 'Every book you’ve added.',
    to: '/library',
    status: undefined,
    glow: 'bg-[#7b5cff]/45',
    cta: 'Browse everything →',
  },
  want_to_read: {
    title: 'Want to read',
    blurb: 'Added, not started yet.',
    to: '/library?status=want_to_read',
    status: 'want_to_read',
    glow: 'bg-sky-400/40',
    cta: 'Pick the next one →',
  },
  read: {
    title: 'Read',
    blurb: 'Every book you finish lands here.',
    to: '/read',
    status: 'finished',
    glow: 'bg-accent/45',
    cta: 'See your stats →',
  },
  abandoned: {
    title: 'Put down',
    blurb: 'Started, then set aside.',
    to: '/library?status=abandoned',
    status: 'abandoned',
    glow: 'bg-rose-400/35',
    cta: 'Give one another go →',
  },
};

const byAddedDesc = (books: LibraryBookDto[]) => [...books].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

export function AutoStackCard({ kind, className }: { kind: AutoStackKind; className?: string }) {
  const cfg = AUTO[kind];
  const [hover, setHover] = useState(false);
  const list = useLibrary(cfg.status);
  const books = kind === 'read' ? byFinishedDesc(list.data ?? []) : byAddedDesc(list.data ?? []);

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -4 }}
      transition={spring.bouncy}
      className={cx('relative overflow-hidden rounded-3xl bg-ink text-paper shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)]', className)}
    >
      <motion.div
        aria-hidden
        className={cx('absolute -right-16 -top-24 size-72 rounded-full blur-3xl', cfg.glow)}
        animate={{ scale: hover ? 1.25 : 1, opacity: hover ? 1 : 0.75 }}
        transition={{ duration: 0.6 }}
      />
      <Link to={cfg.to} className="relative flex h-full flex-col gap-5 p-5">
        <div className="flex justify-center pt-3">
          <StackFan books={asFanPreview(books.slice(0, 5))} bookCount={books.length} spread={hover} showFinished={false} />
        </div>
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <p className="font-display text-xl leading-tight">{cfg.title}</p>
            <span className="rounded-full bg-paper/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-paper/80">Auto</span>
          </div>
          <p className="mt-0.5 text-sm text-paper/60">{cfg.blurb}</p>
          <p className="mt-3 text-sm text-paper/70">{kind === 'read' ? <ReadLine /> : <CountLine books={books} kind={kind} />}</p>
          <p className="mt-4 text-xs font-medium text-paper/90">{cfg.cta}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="font-medium text-paper">{children}</span>;
}

function CountLine({ books, kind }: { books: LibraryBookDto[]; kind: AutoStackKind }) {
  if (kind === 'library') {
    const reading = books.filter((b) => b.status === 'reading').length;
    return (
      <>
        <Num>
          <CountUp value={books.length} />
        </Num>{' '}
        books · <Num>{reading}</Num> reading now
      </>
    );
  }
  return (
    <>
      <Num>
        <CountUp value={books.length} />
      </Num>{' '}
      {books.length === 1 ? 'book' : 'books'}
      {kind === 'want_to_read' && ' waiting'}
    </>
  );
}

function ReadLine() {
  const stats = useStats();
  return (
    <>
      <Num>
        <CountUp value={stats.data?.booksFinished.thisYear ?? 0} />
      </Num>{' '}
      books ·{' '}
      <Num>
        <CountUp value={stats.data?.pagesRead.thisYear ?? 0} format={(n) => Math.round(n).toLocaleString('en')} />
      </Num>{' '}
      pages{stats.data && ` in ${stats.data.year}`}
    </>
  );
}
