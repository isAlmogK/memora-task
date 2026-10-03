import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useCreateStack } from '../api/queries';
import { AutoStacksGrid, YourStacksGrid } from '../components/StackRows';
import { StackForm } from '../components/StackForm';
import { PlusIcon } from '../components/icons';
import { fadeUp, spring } from '../motion/presets';

export function StacksPage() {
  const create = useCreateStack();
  const [params, setParams] = useSearchParams();
  // ?new=1 (from the "New stack" tile on Home) opens the form straight away.
  const [creating, setCreatingState] = useState(params.has('new'));

  function setCreating(open: boolean) {
    setCreatingState(open);
    if (open) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!open && params.has('new')) setParams({}, { replace: true });
  }

  function close() {
    setCreating(false);
    create.reset();
  }

  return (
    <div className="pt-8">
      <motion.div variants={fadeUp} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Stacks</h1>
          <p className="mt-2 text-muted">Named piles of books, with a goal and a deadline if you want one.</p>
        </div>
        {!creating && (
          <motion.button
            onClick={() => setCreating(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={spring.bouncy}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-paper"
          >
            <PlusIcon width={15} height={15} /> New stack
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {creating && (
          <div className="mt-8">
            <StackForm
              submitLabel="Create stack"
              pending={create.isPending}
              error={create.error}
              onSubmit={(body) => create.mutate(body, { onSuccess: close })}
              onCancel={close}
            />
          </div>
        )}
      </AnimatePresence>

      <motion.section variants={fadeUp} className="mt-10">
        <h2 className="mb-5 font-display text-2xl">Your stacks</h2>
        <YourStacksGrid onNew={() => setCreating(true)} />
      </motion.section>

      <motion.section variants={fadeUp} className="mt-14">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl">Collected for you</h2>
          <span className="text-sm text-muted">Sorted automatically as you read</span>
        </div>
        <AutoStacksGrid />
      </motion.section>
    </div>
  );
}
