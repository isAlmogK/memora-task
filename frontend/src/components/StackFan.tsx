import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import type { StackSummaryDto } from '../api/types';
import { cx } from '../lib/cx';
import { Cover } from './Cover';
import { CheckIcon } from './icons';

type FanBook = StackSummaryDto['preview'][number];

const SIZE = {
  sm: { card: 72, className: 'w-[72px]!' },
  lg: { card: 128, className: 'w-[128px]!' },
} as const;

const MAX_CARDS = 5;

/**
 * A stack as a hand of cards: covers fanned out from a common pivot, spreading wider
 * on hover. Finished books get a check. Card count shows what's in the stack; the
 * goal and progress are shown by the caller.
 */
export function StackFan({ books, bookCount, size = 'sm', spread, showFinished = true }: {
  books: FanBook[];
  bookCount: number;
  size?: keyof typeof SIZE;
  /** Controlled by the parent (e.g. hovering the whole card); otherwise spreads on its own hover. */
  spread?: boolean;
  /** Off for the Read stack, where every book is finished and the check says nothing. */
  showFinished?: boolean;
}) {
  const { card, className } = SIZE[size];
  const shown = books.slice(0, MAX_CARDS);
  const extra = bookCount - shown.length;
  const height = card * 1.5;
  const [hovered, setHovered] = useState(false);
  // Each card gets the state directly: variant inheritance skips the mount animation.
  const state = (spread ?? hovered) ? 'spread' : 'rest';

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative"
      style={{ width: card * 2.7, height: height + card * 0.3 }}
    >
      {shown.length === 0 && (
        <div
          className="absolute bottom-0 left-1/2 grid -translate-x-1/2 place-items-center rounded-md border-2 border-dashed border-ink/20 text-xs text-muted"
          style={{ width: card, height }}
        >
          Empty
        </div>
      )}
      <AnimatePresence>
        {shown.map((b, i) => {
          // -1 … 1 across the hand; a single card stands straight.
          const t = shown.length === 1 ? 0 : (i / (shown.length - 1)) * 2 - 1;
          return (
            <motion.div
              key={b.libraryBookId}
              custom={{ t, card }}
              variants={fan}
              initial={{ opacity: 0, y: -card * 0.6, rotate: t * 30 }}
              animate={state}
              exit={{ opacity: 0, y: -card * 0.4, transition: { duration: 0.2 } }}
              className="absolute bottom-0 left-1/2 origin-[50%_120%]"
              style={{ marginLeft: -card / 2, zIndex: i }}
            >
              <Cover book={{ title: b.title, authors: [], coverUrl: b.coverUrl }} size="xs" className={className} />
              {showFinished && b.status === 'finished' && (
                <span
                  className={cx(
                    'absolute grid place-items-center rounded-full bg-ink text-paper shadow-md',
                    size === 'sm' ? '-left-1.5 -top-1.5 size-5' : '-left-2 -top-2 size-7',
                  )}
                  title="Finished"
                >
                  <CheckIcon width={size === 'sm' ? 12 : 16} height={size === 'sm' ? 12 : 16} />
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {extra > 0 && (
        <span className="absolute right-0 top-0 rounded-full bg-ink px-2 py-0.5 text-xs font-medium tabular-nums text-paper shadow-md ring-1 ring-white/30">
          +{extra}
        </span>
      )}
    </motion.div>
  );
}

const fan: Variants = {
  rest: ({ t, card }: { t: number; card: number }) => ({
    opacity: 1,
    rotate: t * 11,
    x: t * card * 0.38,
    y: Math.abs(t) * card * 0.06,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  }),
  spread: ({ t, card }: { t: number; card: number }) => ({
    opacity: 1,
    rotate: t * 20,
    x: t * card * 0.72,
    y: Math.abs(t) * card * 0.12 - card * 0.06,
    transition: { type: 'spring', stiffness: 380, damping: 16 },
  }),
};
