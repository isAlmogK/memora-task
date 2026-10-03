import { motion } from 'motion/react';
import { useState } from 'react';
import type { ReadingStatsDto } from '../../api/types';
import { cx } from '../../lib/cx';

/**
 * Books finished this year by genre: magnitude comparison, so horizontal bars sorted
 * longest first, one hue, value at the tip. Genre names are text, never coloured.
 */
export function GenreBars({ data }: { data: ReadingStatsDto['genres'] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((g) => g.books));

  return (
    <ul className="space-y-3.5" onPointerLeave={() => setHover(null)}>
      {data.map((g, i) => (
        <li key={g.genre}>
          <button
            type="button"
            onPointerEnter={() => setHover(g.genre)}
            onFocus={() => setHover(g.genre)}
            onBlur={() => setHover(null)}
            aria-label={`${g.genre}: ${g.books} books, ${g.pages.toLocaleString('en')} pages`}
            className="grid w-full grid-cols-[8.5rem_1fr] items-center gap-3 text-left"
          >
            <span className="truncate text-sm">{g.genre}</span>
            <span className="flex items-center gap-2">
              <motion.span
                className={cx(
                  'block h-3.5 origin-left rounded-r-[4px] bg-accent transition-opacity',
                  hover && hover !== g.genre && 'opacity-50',
                )}
                style={{ width: `${(g.books / max) * 82}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.1 + i * 0.05 }}
              />
              <span className="shrink-0 text-xs tabular-nums text-muted">
                <span className="font-medium text-ink">{g.books}</span>
                {hover === g.genre && <span> · {g.pages.toLocaleString('en')} pages</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
