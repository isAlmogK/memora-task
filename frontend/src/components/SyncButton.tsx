import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useLatestSyncRun, useStartSync, useSyncSideEffects } from '../api/queries';
import { cx } from '../lib/cx';
import { timeAgo } from '../lib/format';
import { spring } from '../motion/presets';
import { AlertIcon, CheckIcon, SyncIcon } from './icons';

/**
 * Starts a (simulated) Kindle sync job and shows its live status:
 * idle → queued (pulse) → running (spinning, counting events) → done / failed.
 */
export function SyncButton() {
  const latest = useLatestSyncRun();
  const start = useStartSync();
  const run = latest.data;
  useSyncSideEffects(run);

  // Hold the "done" state on screen briefly after a run we watched finishes.
  const [justFinished, setJustFinished] = useState(false);
  const prevStatus = useRef(run?.status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = run?.status;
    if ((was === 'queued' || was === 'running') && (run?.status === 'succeeded' || run?.status === 'failed')) {
      setJustFinished(true);
      const t = setTimeout(() => setJustFinished(false), 3500);
      return () => clearTimeout(t);
    }
  }, [run?.status]);

  const active = run?.status === 'queued' || run?.status === 'running';
  const failed = run?.status === 'failed' && justFinished;
  const succeeded = run?.status === 'succeeded' && justFinished;

  let label = 'Sync Kindle';
  if (start.isPending || run?.status === 'queued') label = 'Queued…';
  else if (run?.status === 'running') label = run.eventsIngested ? `Syncing · ${run.eventsIngested} new` : 'Syncing…';
  else if (succeeded) label = run.eventsIngested ? `${run.eventsIngested} updates` : 'Up to date';
  else if (failed) label = 'Sync failed';

  const caption = start.isError
    ? 'Couldn’t start sync'
    : failed
      ? run.error
      : run?.finishedAt && !active
        ? `synced ${timeAgo(run.finishedAt)}`
        : null;

  return (
    <div className="flex items-center gap-3">
      {caption && (
        <span className={cx('hidden max-w-56 truncate text-xs md:inline', failed || start.isError ? 'text-danger' : 'text-muted')} title={caption}>
          {caption}
        </span>
      )}
      <motion.button
        type="button"
        onClick={() => start.mutate()}
        disabled={active || start.isPending}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={spring.bouncy}
        className={cx(
          'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
          failed ? 'bg-danger text-paper' : 'bg-ink text-paper',
          'disabled:cursor-progress',
        )}
      >
        {/* the pulse ring while waiting in the queue */}
        {(run?.status === 'queued' || start.isPending) && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-accent"
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.span
          animate={run?.status === 'running' ? { rotate: 360 } : { rotate: 0 }}
          transition={run?.status === 'running' ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
          className="grid place-items-center"
        >
          {succeeded ? <CheckIcon /> : failed ? <AlertIcon /> : <SyncIcon />}
        </motion.span>
        <span aria-live="polite" className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              className="block whitespace-nowrap"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
    </div>
  );
}
