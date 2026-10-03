import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';

/**
 * A number that ticks from its previous value to the new one. The text is driven by a
 * motion value, so the tick writes to the DOM directly instead of re-rendering React.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 0.9 }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const n = useMotionValue(reduce ? value : 0);
  const text = useTransform(n, format);

  useEffect(() => {
    if (reduce) {
      n.set(value);
      return;
    }
    const controls = animate(n, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, reduce, n]);

  // tabular figures so the width doesn't jitter while it counts
  return <motion.span className="tabular-nums">{text}</motion.span>;
}
