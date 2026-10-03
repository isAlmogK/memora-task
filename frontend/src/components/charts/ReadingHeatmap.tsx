import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import type { ReadingStatsDto } from '../../api/types';
import { cx } from '../../lib/cx';
import { Tooltip } from './ChartCard';

/**
 * One amber hue, light → dark with pages read (validated as an ordinal ramp against the
 * page surface: monotone lightness, light end ≥ 2:1). Days with no reading use the
 * neutral track, not a ramp step.
 */
const RAMP = ['#e39a2c', '#c97d12', '#9c5f08', '#683e04'] as const;
const BANDS = [
  { min: 1, label: '1–19' },
  { min: 20, label: '20–39' },
  { min: 40, label: '40–69' },
  { min: 70, label: '70+' },
] as const;
const step = (pages: number) => (pages <= 0 ? -1 : BANDS.findLastIndex((b) => pages >= b.min));

const GAP = 3;
const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** One column per week (Mon at the top), one cell per day; cells scale to the card's width. */
export function ReadingHeatmap({ data }: { data: ReadingStatsDto['daily'] }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const offset = (asDate(data[0]!.day).getUTCDay() + 6) % 7; // Monday = 0
  const weeks = Math.ceil((data.length + offset) / 7);
  const cols = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => w * 7 + d - offset).map((i) => (i >= 0 && i < data.length ? i : null)),
  );

  return (
    <div ref={root} className="relative">
      <div className="flex w-full flex-col" onPointerLeave={() => setHover(null)}>
        {/* month labels where a new month starts */}
        <div className="mb-1.5 flex text-[0.68rem] text-muted" style={{ gap: GAP, paddingLeft: 26 }}>
          {cols.map((col, w) => {
            const first = col.find((i) => i !== null);
            const day = first != null ? data[first]!.day : null;
            const prev = w > 0 ? cols[w - 1]!.find((i) => i !== null) : null;
            const newMonth = day && (prev == null || data[prev]!.day.slice(0, 7) !== day.slice(0, 7));
            return (
              <span key={w} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                {newMonth ? monthFmt.format(asDate(day)) : ''}
              </span>
            );
          })}
        </div>
        <div className="flex" style={{ gap: GAP }}>
          <div className="grid w-[23px] shrink-0 grid-rows-7 text-[0.62rem] text-muted" style={{ gap: GAP }}>
            {['Mon', '', 'Wed', '', 'Fri', '', ''].map((l, i) => (
              <span key={i} className="flex items-center">
                {l}
              </span>
            ))}
          </div>
          {cols.map((col, w) => (
            <motion.div
              key={w}
              className="flex min-w-0 max-w-9 flex-1 flex-col"
              style={{ gap: GAP }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: w * 0.02, duration: 0.3 }}
            >
              {col.map((i, d) =>
                i === null ? (
                  <span key={d} className="aspect-square w-full" />
                ) : (
                  <button
                    key={d}
                    type="button"
                    aria-label={`${dayFmt.format(asDate(data[i]!.day))}: ${data[i]!.pages} pages`}
                    onPointerEnter={(e) => showAt(e.currentTarget, i)}
                    onFocus={(e) => showAt(e.currentTarget, i)}
                    onBlur={() => setHover(null)}
                    className={cx(
                      'aspect-square w-full rounded-[4px] transition-transform hover:scale-115',
                      step(data[i]!.pages) < 0 && 'bg-ink/[0.07]',
                    )}
                    style={{ backgroundColor: step(data[i]!.pages) >= 0 ? RAMP[step(data[i]!.pages)] : undefined }}
                  />
                ),
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-ink/[0.07]" /> No reading
        </span>
        {BANDS.map((b, i) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ backgroundColor: RAMP[i] }} /> {b.label} pages
          </span>
        ))}
      </div>

      {hover && (
        <Tooltip
          x={hover.x}
          y={hover.y}
          value={`${data[hover.i]!.pages} pages`}
          label={dayFmt.format(asDate(data[hover.i]!.day))}
        />
      )}
    </div>
  );

  function showAt(el: HTMLElement, i: number) {
    const box = root.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setHover({ i, x: r.left - box.left + r.width / 2, y: r.top - box.top });
  }
}
