import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useLogProgress } from '../api/queries';
import type { LibraryBookDto } from '../api/types';
import { cx } from '../lib/cx';
import { ErrorState } from './QueryState';
import { PlusIcon } from './icons';

/** Manual progress entry: percent slider, or an exact page when the book has a page count. */
export function ProgressUpdater({ item, className }: { item: LibraryBookDto; className?: string }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<'percent' | 'page'>(item.book.pageCount ? 'page' : 'percent');
  const pages = item.book.pageCount;
  const [value, setValue] = useState(() => (unit === 'page' ? (item.progress.page ?? 0) : Math.round(item.progress.percent)));
  const log = useLogProgress(item.id);
  const max = unit === 'page' && pages ? pages : 100;

  function submit(e: FormEvent) {
    e.preventDefault();
    log.mutate(unit === 'page' ? { page: value } : { percent: value }, { onSuccess: () => setOpen(false) });
  }

  function switchUnit(next: 'percent' | 'page') {
    if (!pages) return;
    setUnit(next);
    setValue(next === 'page' ? Math.round((value / 100) * pages) : Math.round((value / pages) * 100));
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button
            key="closed"
            type="button"
            onClick={() => {
              setValue(unit === 'page' ? (item.progress.page ?? 0) : Math.round(item.progress.percent));
              setOpen(true);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-sm hover:border-ink/40"
          >
            <PlusIcon width={15} height={15} /> Update progress
          </motion.button>
        ) : (
          <motion.form
            key="open"
            onSubmit={submit}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex max-w-md flex-col gap-3 glass rounded-2xl p-4"
          >
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={`progress-${item.id}`} className="font-medium">
                {unit === 'page' ? `Page ${value} of ${pages}` : `${value}%`}
              </label>
              {pages && (
                <div className="flex rounded-full bg-ink/[0.06] p-0.5 text-xs">
                  {(['page', 'percent'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => switchUnit(u)}
                      className={cx('rounded-full px-2.5 py-1', unit === u ? 'bg-paper shadow-sm' : 'text-muted')}
                    >
                      {u === 'page' ? 'Page' : '%'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              id={`progress-${item.id}`}
              type="range"
              min={0}
              max={max}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="accent-[var(--color-accent)]"
            />
            {log.isError && <ErrorState error={log.error} compact />}
            <div className="flex gap-2">
              <button type="submit" disabled={log.isPending} className="rounded-full bg-ink px-4 py-1.5 text-sm text-paper disabled:opacity-60">
                {log.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
