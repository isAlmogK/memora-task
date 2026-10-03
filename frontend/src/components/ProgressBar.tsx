import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { spring } from '../motion/presets';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  size?: 'thin' | 'thick';
  /** Stagger when several bars update together (seconds). */
  delay?: number;
  /** Optional marker (0–100), e.g. "where you should be by now" on a stack. */
  marker?: number | null;
  label: string;
  className?: string;
}

/**
 * Springs to its value. When the value goes *up* after first render (a sync landed,
 * you logged progress) a "+N%" pops out and floats away, Flash-score style.
 */
export function ProgressBar({ value, size = 'thin', delay = 0, marker, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const previous = useRef<number | null>(null);
  const [gains, setGains] = useState<{ id: number; delta: number }[]>([]);

  useEffect(() => {
    const prev = previous.current;
    previous.current = clamped;
    if (prev === null || clamped - prev < 0.5) return;
    const gain = { id: Date.now() + Math.random(), delta: clamped - prev };
    setGains((g) => [...g, gain]);
    const t = setTimeout(() => setGains((g) => g.filter((x) => x.id !== gain.id)), 1400);
    return () => clearTimeout(t);
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cx('relative', className)}
    >
      <div className={cx('relative overflow-hidden rounded-full bg-ink/[0.08]', size === 'thick' ? 'h-2.5' : 'h-1.5')}>
        <motion.div
          className="absolute inset-0 origin-left rounded-full bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: clamped / 100 }}
          transition={{ ...spring.smooth, delay }}
        />
      </div>
      {marker != null && (
        <div
          title="Where you'd need to be today to finish on time"
          className="absolute -top-1 h-[calc(100%+0.5rem)] w-px bg-ink/50"
          style={{ left: `${Math.min(100, Math.max(0, marker))}%` }}
        />
      )}
      <AnimatePresence>
        {gains.map((g) => (
          <motion.span
            key={g.id}
            aria-hidden
            className="pointer-events-none absolute -top-2 font-display text-sm font-semibold text-accent-deep"
            style={{ left: `${clamped}%` }}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -22, scale: 1.1 }}
            exit={{ opacity: 0, y: -38, scale: 0.9 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay }}
          >
            +{Math.round(g.delta)}%
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
