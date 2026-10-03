import { useCallback, useRef, useState } from 'react';
import { useRemoveFromLibrary, useStackMembership, useStacks } from '../api/queries';
import type { LibraryBookDto } from '../api/types';
import { useFly } from './fly';
import { CheckIcon, CloseIcon, PlusIcon } from './icons';
import { MenuItem, MenuLabel, MenuTrigger, Popover } from './Popover';
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
      <MenuTrigger label={`Actions for ${item.book.title}`} open={open} onToggle={() => setOpen((o) => !o)} />
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
