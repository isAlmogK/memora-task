import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { StackSummaryDto } from '../api/types';
import { cx } from '../lib/cx';
import { formatDate } from '../lib/format';
import { spring } from '../motion/presets';
import { Confetti } from './Confetti';
import { useFlyTarget } from './fly';
import { ProgressBar } from './ProgressBar';
import { StackFan } from './StackFan';
import { useCompletionBurst } from './useCompletionBurst';

/** "3 of 6 read · on track · due Dec 31" — onTrack comes from the API, not computed here. */
export function StackMeta({ stack, className }: { stack: StackSummaryDto; className?: string }) {
  const complete = stack.goal > 0 && stack.finishedCount >= stack.goal;
  return (
    <p className={cx('flex flex-wrap items-center gap-x-1.5 text-sm text-muted', className)}>
      <span>
        <span className="font-medium tabular-nums text-ink">
          {stack.finishedCount}/{stack.goal}
        </span>{' '}
        read
      </span>
      {complete ? (
        <Badge tone="done">Done</Badge>
      ) : (
        stack.onTrack !== null && <Badge tone={stack.onTrack ? 'good' : 'bad'}>{stack.onTrack ? 'On track' : 'Behind'}</Badge>
      )}
      {stack.dueOn && !complete && <span>· due {formatDate(stack.dueOn)}</span>}
    </p>
  );
}

function Badge({ tone, children }: { tone: 'good' | 'bad' | 'done'; children: string }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide',
        tone === 'good' && 'bg-emerald-500/12 text-emerald-700',
        tone === 'bad' && 'bg-danger/12 text-danger',
        tone === 'done' && 'bg-accent/20 text-accent-deep',
      )}
    >
      {children}
    </span>
  );
}

/** A stack as a glass card with its books fanned out; the fan is a fly target for covers. */
export function StackCard({ stack, className }: { stack: StackSummaryDto; className?: string }) {
  const [hover, setHover] = useState(false);
  const target = useFlyTarget(`stack-${stack.id}`);
  const burst = useCompletionBurst(stack.finishedCount, stack.goal);
  const ratio = stack.goal > 0 ? (stack.finishedCount / stack.goal) * 100 : 0;

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -4 }}
      transition={spring.bouncy}
      className={cx('glass rounded-3xl', className)}
    >
      <Link to={`/stacks/${stack.id}`} className="flex flex-col gap-5 p-5">
        <motion.div {...target} className="relative flex justify-center pt-3">
          <StackFan books={stack.preview} bookCount={stack.bookCount} spread={hover} />
          {burst && <Confetti burstKey={burst} />}
        </motion.div>
        <div>
          <p className="font-display text-xl leading-tight">{stack.name}</p>
          {stack.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{stack.description}</p>}
          <StackMeta stack={stack} className="mt-1.5" />
          <ProgressBar value={ratio} label={`${stack.name}: ${Math.round(ratio)}% of goal`} className="mt-4" />
        </div>
      </Link>
    </motion.div>
  );
}
