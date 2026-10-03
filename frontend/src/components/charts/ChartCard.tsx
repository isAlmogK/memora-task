import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * Frame for every chart: title, one-line subtitle, and a Chart/Table switch. The table
 * is the accessible view of the same numbers (and the home of every value the chart
 * doesn't label directly).
 */
export function ChartCard({ title, subtitle, table, children, className }: {
  title: string;
  subtitle?: string;
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={cx('glass rounded-3xl p-6', className)}>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div role="tablist" aria-label={`${title} view`} className="flex shrink-0 rounded-full bg-ink/[0.06] p-0.5 text-xs">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx('rounded-full px-2.5 py-1 capitalize transition-colors', view === v ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}
            >
              {v}
            </button>
          ))}
        </div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {view === 'chart' ? children : <DataTable {...table} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white/80 text-left text-xs text-muted backdrop-blur">
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={cx('py-2 font-medium', i > 0 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-t border-ink/[0.06]">
              {r.map((cell, i) => (
                <td key={i} className={cx('py-1.5', i > 0 && 'text-right')}>
                  {typeof cell === 'number' ? cell.toLocaleString('en') : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Hover/focus readout: the value leads, the label follows. */
export function Tooltip({ x, y, value, label }: { x: number | string; y: number; value: string; label: string }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      <span className="font-semibold">{value}</span>
      <span className="ml-1.5 text-paper/60">{label}</span>
    </motion.div>
  );
}
