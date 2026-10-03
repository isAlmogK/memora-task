import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp } from '../motion/presets';

/** A page section that joins the route's stagger-in. */
export function Section({ title, action, children, className }: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section variants={fadeUp} className={className ?? 'mt-14'}>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        {action && <div className="text-sm text-muted">{action}</div>}
      </div>
      {children}
    </motion.section>
  );
}
