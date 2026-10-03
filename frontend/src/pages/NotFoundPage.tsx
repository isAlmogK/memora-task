import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { fadeUp } from '../motion/presets';

/** Unknown routes, and resources the API answers 404 for (including other people's). */
export function NotFoundPage({ title = 'This page isn’t on the shelf', children }: { title?: string; children?: ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="initial" animate="enter" className="py-28 text-center">
      <motion.p
        aria-hidden
        className="font-display text-8xl text-faint"
        initial={{ rotate: -8, y: -30, opacity: 0 }}
        animate={{ rotate: 4, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 9 }}
      >
        404
      </motion.p>
      <h1 className="mt-6 font-display text-3xl">{title}</h1>
      {children && <div className="mt-2 text-muted">{children}</div>}
      <Link to="/" className="mt-8 inline-block rounded-full bg-ink px-5 py-2 text-sm text-paper">
        Back to reading
      </Link>
    </motion.div>
  );
}
