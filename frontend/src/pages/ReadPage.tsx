import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useLibrary, useStats } from '../api/queries';
import type { LibraryBookDto, ReadingStatsDto } from '../api/types';
import { BackLink } from '../components/BackLink';
import { useAmbientFrom } from '../components/ambient';
import { ChartCard } from '../components/charts/ChartCard';
import { GenreBars } from '../components/charts/GenreBars';
import { MonthlyColumns } from '../components/charts/MonthlyColumns';
import { ReadingHeatmap } from '../components/charts/ReadingHeatmap';
import { StatTile } from '../components/charts/StatTile';
import { CountUp } from '../components/CountUp';
import { Cover } from '../components/Cover';
import { CoverSkeleton, EmptyState, QueryState, Skeleton } from '../components/QueryState';
import { SearchButton } from '../components/SearchOverlay';
import { StackFan } from '../components/StackFan';
import { bookLink, coverLayoutId } from '../lib/coverMorph';
import { asFanPreview, byFinishedDesc } from '../lib/finished';
import { formatDate } from '../lib/format';
import { spring, staggerItem, staggerList } from '../motion/presets';

const monthLong = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The automatic "Read" stack: every finished book, plus what your reading adds up to. */
export function ReadPage() {
  const stats = useStats();
  const finished = useLibrary('finished');
  const books = byFinishedDesc(finished.data ?? []);
  useAmbientFrom(books[0]?.book.coverUrl);

  return (
    <div className="pt-6">
      <BackLink to="/stacks">Stacks</BackLink>

      <QueryState query={stats} loading={<ReadSkeleton />}>
        {(s) =>
          s.booksFinished.allTime === 0 ? (
            <EmptyState title="Nothing finished yet">
              Finished books collect here automatically, along with your stats.{' '}
              <SearchButton className="text-ink underline underline-offset-4">Find something to read</SearchButton>
            </EmptyState>
          ) : (
            <>
              <Hero stats={s} books={books} />
              <Kpis stats={s} />
              <Charts stats={s} />
              <Shelf books={books} />
            </>
          )
        }
      </QueryState>
    </div>
  );
}

function Hero({ stats, books }: { stats: ReadingStatsDto; books: LibraryBookDto[] }) {
  return (
    <section className="relative mt-6 grid items-center gap-8 overflow-hidden rounded-[32px] bg-ink p-8 text-paper sm:p-12 md:grid-cols-[1fr_auto]">
      <div aria-hidden className="absolute -left-24 -top-32 size-[28rem] rounded-full bg-accent/35 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 right-10 size-96 rounded-full bg-[#7b5cff]/25 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-5xl sm:text-6xl">Read</h1>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink">Auto</span>
        </div>
        <p className="mt-2 max-w-sm text-paper/60">Every book you finish lands here on its own. No adding, no sorting.</p>
        <p className="mt-10 text-7xl font-semibold tracking-tight sm:text-8xl">
          <CountUp value={stats.booksFinished.thisYear} duration={1.4} />
        </p>
        <p className="mt-1 text-paper/70">
          books finished in {stats.year} · <span className="text-paper">{stats.booksFinished.allTime}</span> all time
        </p>
      </div>
      <div className="relative flex justify-center">
        <StackFan books={asFanPreview(books.slice(0, 5))} bookCount={books.length} size="lg" showFinished={false} />
      </div>
    </section>
  );
}

function Kpis({ stats }: { stats: ReadingStatsDto }) {
  const { pace, fastestFinish } = stats;
  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label={`Pages read in ${stats.year}`}
        value={stats.pagesRead.thisYear}
        sub={`${stats.pagesRead.allTime.toLocaleString('en')} all time`}
      />
      <StatTile label="Pages a day" value={pace.pagesPerDay30d} format={(n) => n.toFixed(1)} sub="average over the last 30 days" />
      <StatTile
        label="Reading streak"
        value={pace.currentStreakDays}
        unit={pace.currentStreakDays === 1 ? 'day' : 'days'}
        sub={`longest: ${pace.longestStreakDays} days in a row`}
      />
      <StatTile
        label="Fastest finish"
        value={fastestFinish?.days ?? 0}
        unit={fastestFinish?.days === 1 ? 'day' : 'days'}
        sub={fastestFinish ? fastestFinish.title : 'nothing finished yet'}
      />
    </motion.div>
  );
}

function Charts({ stats }: { stats: ReadingStatsDto }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[3fr_2fr]">
      <ChartCard
        title="Books per month"
        subtitle="Finished, last 12 months"
        table={{
          columns: ['Month', 'Books', 'Pages read'],
          rows: stats.monthly.map((m) => [monthLong.format(new Date(`${m.month}-01T00:00:00Z`)), m.books, m.pages]),
        }}
      >
        <MonthlyColumns data={stats.monthly} />
      </ChartCard>
      <ChartCard
        title="By genre"
        subtitle={`Books finished in ${stats.year}`}
        table={{ columns: ['Genre', 'Books', 'Pages'], rows: stats.genres.map((g) => [g.genre, g.books, g.pages]) }}
      >
        {stats.genres.length ? <GenreBars data={stats.genres} /> : <p className="text-sm text-muted">Nothing finished this year yet.</p>}
      </ChartCard>
      <ChartCard
        title="Reading days"
        subtitle="Pages read per day, last 26 weeks"
        className="lg:col-span-2"
        table={{
          columns: ['Day', 'Pages'],
          rows: stats.daily.filter((d) => d.pages > 0).reverse().map((d) => [formatDate(d.day), d.pages]),
        }}
      >
        <ReadingHeatmap data={stats.daily} />
      </ChartCard>
    </div>
  );
}

function Shelf({ books }: { books: LibraryBookDto[] }) {
  return (
    <section className="mt-14">
      <h2 className="mb-6 flex items-baseline gap-3">
        <span className="font-display text-2xl">The shelf</span>
        <span className="text-sm tabular-nums text-muted">{books.length}</span>
      </h2>
      <motion.ul variants={staggerList} initial="hidden" animate="show" className="grid grid-cols-3 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {books.map((b) => (
          <motion.li key={b.id} variants={staggerItem}>
            <Link {...bookLink(b.id, 'read')} className="block">
              <motion.div whileHover={{ y: -6 }} transition={spring.bouncy}>
                <Cover book={b.book} size="md" layoutId={coverLayoutId('read', b.id)} className="w-full!" />
              </motion.div>
              <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{b.book.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {[b.book.genre, b.finishedAt && formatDate(b.finishedAt)].filter(Boolean).join(' · ')}
              </p>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function ReadSkeleton() {
  return (
    <div className="mt-6 space-y-5">
      <Skeleton className="h-80 rounded-[32px]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="flex gap-5">
        {[0, 1, 2, 3].map((i) => (
          <CoverSkeleton key={i} className="w-28" />
        ))}
      </div>
    </div>
  );
}
