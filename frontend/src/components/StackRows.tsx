import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useLibrary, useStacks } from '../api/queries';
import { staggerItem, staggerList } from '../motion/presets';
import { AutoStackCard, type AutoStackKind } from './AutoStackCard';
import { PlusIcon } from './icons';
import { QueryState, Skeleton } from './QueryState';
import { StackCard } from './StackCard';

const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-4';

/**
 * Stacks you made. `limit` caps it for Home; the trailing "New stack" tile appears
 * whenever there's room in the row (or there are no stacks yet).
 */
export function YourStacksGrid({ limit, onNew }: { limit?: number; onNew?: () => void }) {
  const stacks = useStacks();
  return (
    <QueryState
      query={stacks}
      loading={
        <div className={GRID}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      }
    >
      {(list) => {
        const shown = limit ? list.slice(0, limit) : list;
        const roomForNew = !limit || shown.length < limit;
        return (
          <motion.ul variants={staggerList} initial="hidden" animate="show" className={GRID}>
            {shown.map((s) => (
              <motion.li key={s.id} variants={staggerItem} layout>
                <StackCard stack={s} className="h-full" />
              </motion.li>
            ))}
            {roomForNew && (
              <motion.li variants={staggerItem} layout>
                <NewStackTile onNew={onNew} empty={list.length === 0} />
              </motion.li>
            )}
          </motion.ul>
        );
      }}
    </QueryState>
  );
}

function NewStackTile({ onNew, empty }: { onNew?: () => void; empty: boolean }) {
  const body = (
    <>
      <span className="grid size-12 place-items-center rounded-full bg-ink/[0.06] transition-transform group-hover:scale-110">
        <PlusIcon />
      </span>
      <span className="font-medium text-ink">New stack</span>
      <span>{empty ? 'A reading challenge, a book club, a someday pile.' : 'Another pile, another goal.'}</span>
    </>
  );
  const cls =
    'group flex h-full min-h-72 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-sm text-muted transition-colors hover:border-ink/30';
  return onNew ? (
    <button type="button" onClick={onNew} className={cls}>
      {body}
    </button>
  ) : (
    <Link to="/stacks?new=1" className={cls}>
      {body}
    </Link>
  );
}

/** Library, Want to read, Read (and Put down when it has anything). */
export function AutoStacksGrid() {
  const kinds = useAutoStackKinds();
  return (
    <motion.ul variants={staggerList} initial="hidden" animate="show" className={GRID}>
      {kinds.map((k) => (
        <motion.li key={k} variants={staggerItem} layout>
          <AutoStackCard kind={k} className="h-full" />
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** "Put down" only earns a card when something is in it. */
function useAutoStackKinds(): AutoStackKind[] {
  const abandoned = useLibrary('abandoned');
  return abandoned.data?.length ? ['library', 'want_to_read', 'read', 'abandoned'] : ['library', 'want_to_read', 'read'];
}
