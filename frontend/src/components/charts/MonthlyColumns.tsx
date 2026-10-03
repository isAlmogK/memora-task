import { motion } from 'motion/react';
import { useState } from 'react';
import type { ReadingStatsDto } from '../../api/types';
import { cx } from '../../lib/cx';
import { Tooltip } from './ChartCard';

const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const asDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const PLOT_H = 160;

/**
 * Books finished per month: one series, so one colour (the progress amber) and no legend.
 * Labels only on the best month and the current one; the rest live in the tooltip/table.
 */
export function MonthlyColumns({ data }: { data: ReadingStatsDto['monthly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.books));
  const best = data.reduce((bi, d, i) => (d.books > data[bi]!.books ? i : bi), 0);
  const last = data.length - 1;

  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      <div className="flex items-end border-b border-ink/15" style={{ height: PLOT_H }}>
        {data.map((d, i) => {
          const h = (d.books / max) * (PLOT_H - 22);
          const labelled = d.books > 0 && (i === best || i === last);
          return (
            <button
              key={d.month}
              type="button"
              aria-label={`${monthLong.format(asDate(d.month))}: ${d.books} books, ${d.pages.toLocaleString('en')} pages`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group relative flex h-full flex-1 flex-col items-center justify-end outline-offset-0"
            >
              {labelled && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                  className="mb-1 text-xs font-medium text-ink"
                >
                  {d.books}
                </motion.span>
              )}
              <motion.span
                className={cx(
                  'block w-[min(24px,70%)] origin-bottom rounded-t-[4px] bg-accent transition-[filter]',
                  hover === i && 'brightness-110',
                  hover !== null && hover !== i && 'opacity-60',
                )}
                style={{ height: h }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22, delay: i * 0.035 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex">
        {data.map((d, i) => (
          <span key={d.month} className={cx('flex-1 text-center text-[0.68rem]', i === last ? 'font-medium text-ink' : 'text-muted')}>
            {monthName.format(asDate(d.month))}
          </span>
        ))}
      </div>
      {hover !== null && (
        <Tooltip
          x={`${((hover + 0.5) / data.length) * 100}%`}
          y={PLOT_H - ((data[hover]!.books / max) * (PLOT_H - 22)) - 4}
          value={`${data[hover]!.books} ${data[hover]!.books === 1 ? 'book' : 'books'}`}
          label={`${monthLong.format(asDate(data[hover]!.month))} · ${data[hover]!.pages.toLocaleString('en')} pages`}
        />
      )}
    </div>
  );
}
