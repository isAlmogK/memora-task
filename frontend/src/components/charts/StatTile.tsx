import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { staggerItem } from '../../motion/presets';
import { CountUp } from '../CountUp';

/** label · value (counts up) · optional context line. */
export function StatTile({ label, value, format, unit, sub }: {
  label: string;
  value: number;
  format?: (n: number) => string;
  unit?: string;
  sub?: ReactNode;
}) {
  return (
    <motion.div variants={staggerItem} className="glass rounded-3xl p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight">
        <CountUp value={value} format={format ?? ((n) => Math.round(n).toLocaleString('en'))} />
        {unit && <span className="ml-1.5 text-base font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted">{sub}</p>}
    </motion.div>
  );
}
