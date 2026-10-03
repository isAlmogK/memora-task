import { motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { useRemoveFromLibrary, useStackMembership, useStacks } from '../api/queries';
import type { LibraryBookDto } from '../api/types';
import { cx } from '../lib/cx';
import { useFly } from './fly';
import { CheckIcon, CloseIcon, MoreIcon, PlusIcon } from './icons';
import { MenuItem, MenuLabel, Popover } from './Popover';
import { ErrorState } from './QueryState';

/**
 * Hover menu on a library tile: put the book in a stack (the cover flies to the Stacks
 * tab), or remove it from the library (second click confirms; it deletes the history).
 * Render inside a `group relative` container.
 */
export function BookActionsMenu({ item }: { item: LibraryBookDto }) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const stacks = useStacks();
  const membership = useStackMembership();
  const remove = useRemoveFromLibrary();
  const fly = useFly();
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setConfirmRemove(false);
  }, []);

  function addTo(stackId: string) {
    const cover = anchor.current?.parentElement?.querySelector('img');
    membership.mutate(
      { stackId, libraryBookId: item.id, member: true },
      {
        onSuccess: () => {
          setAdded((s) => new Set(s).add(stackId));
          if (cover) fly(item.book.coverUrl, cover, 'stacks');
        },
      },
    );
  }

  const error = membership.error ?? remove.error;

  return (
    <div ref={anchor} className="absolute -right-2 -top-2 z-10">
      <motion.button
        onClick={(e) => {
          e.preventDefault(); // the tile is a link
          setOpen((o) => !o);
        }}
        whileTap={{ scale: 0.85 }}
        aria-label={`Actions for ${item.book.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          'grid size-8 place-items-center rounded-full bg-ink text-paper shadow-md transition-opacity focus-visible:opacity-100 group-hover:opacity-100',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        <MoreIcon width={16} height={16} />
      </motion.button>
      <Popover open={open} onClose={close} className="right-0 top-10">
        <MenuLabel>Add to stack</MenuLabel>
        {(stacks.data ?? []).length === 0 && <p className="px-2.5 py-2 text-muted">No stacks yet.</p>}
        {(stacks.data ?? []).map((s) => {
          const done = added.has(s.id);
          return (
            <MenuItem key={s.id} onClick={() => addTo(s.id)} disabled={done || (membership.isPending && membership.variables.stackId === s.id)}>
              {done ? <CheckIcon width={14} height={14} className="text-accent-deep" /> : <PlusIcon width={14} height={14} className="text-muted" />}
              <span className="truncate">{s.name}</span>
            </MenuItem>
          );
        })}
        <div className="my-1 h-px bg-ink/[0.06]" />
        <MenuItem danger disabled={remove.isPending} onClick={() => (confirmRemove ? remove.mutate(item.id) : setConfirmRemove(true))}>
          <CloseIcon width={14} height={14} />
          {remove.isPending ? 'Removing…' : confirmRemove ? 'Click again: history goes too' : 'Remove from library'}
        </MenuItem>
        {error && (
          <div className="px-2.5">
            <ErrorState error={error} compact />
          </div>
        )}
      </Popover>
    </div>
  );
}
