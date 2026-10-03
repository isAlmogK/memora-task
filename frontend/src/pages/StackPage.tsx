import { AnimatePresence, LayoutGroup, motion, Reorder } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/errors';
import {
  useDeleteStack,
  useLibrary,
  useMoveStackBook,
  useReorderStack,
  useStack,
  useStackMembership,
  useStacks,
  useUpdateStack,
} from '../api/queries';
import type { LibraryBookDto, ReadingStatus, StackDetailDto } from '../api/types';
import { BackLink } from '../components/BackLink';
import { ConfirmAction } from '../components/ConfirmAction';
import { Confetti } from '../components/Confetti';
import { Cover } from '../components/Cover';
import { useFly, useFlyTarget } from '../components/fly';
import { ProgressBar } from '../components/ProgressBar';
import { CoverSkeleton, ErrorState, QueryState, Skeleton } from '../components/QueryState';
import { StackMeta } from '../components/StackCard';
import { StackForm } from '../components/StackForm';
import { StackFan } from '../components/StackFan';
import { SearchButton } from '../components/SearchOverlay';
import { useCompletionBurst } from '../components/useCompletionBurst';
import { useAmbientFrom } from '../components/ambient';
import { CountUp } from '../components/CountUp';
import { ArrowIcon, CheckIcon, ChevronIcon, CloseIcon, GripIcon, PlusIcon } from '../components/icons';
import { MenuItem, MenuLabel, MenuTrigger, Popover } from '../components/Popover';
import { StatusLabel } from '../components/StatusLabel';
import { bookLink, coverLayoutId } from '../lib/coverMorph';
import { cx } from '../lib/cx';
import { authorsLine, formatDate, formatPercent } from '../lib/format';
import { spring } from '../motion/presets';
import { NotFoundPage } from './NotFoundPage';

export function StackPage() {
  const { id = '' } = useParams();
  const stack = useStack(id);

  if (stack.error instanceof ApiError && stack.error.status === 404) {
    return <NotFoundPage title="No stack here">It may have been deleted.</NotFoundPage>;
  }
  return (
    <QueryState query={stack} loading={<StackSkeleton />}>
      {(s) => <StackDetail stack={s} />}
    </QueryState>
  );
}

function StackDetail({ stack }: { stack: StackDetailDto }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateStack(stack.id);
  const target = useFlyTarget(`stack-${stack.id}`);
  const burst = useCompletionBurst(stack.finishedCount, stack.goal);
  const ratio = stack.goal > 0 ? (stack.finishedCount / stack.goal) * 100 : 0;
  useAmbientFrom(stack.preview[0]?.coverUrl);

  function closeEdit() {
    setEditing(false);
    update.reset();
  }

  return (
    <div className="pt-6">
      <BackLink to="/stacks">Stacks</BackLink>

      <div className="glass mt-6 grid items-center gap-8 rounded-[32px] p-6 sm:p-10 md:grid-cols-[auto_1fr] md:gap-14">
        <motion.div {...target} className="relative flex justify-center">
          <StackFan books={stack.preview} bookCount={stack.bookCount} size="lg" />
          {burst && <Confetti burstKey={burst} pieces={40} />}
        </motion.div>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <StackForm
                key="edit"
                initial={stack}
                submitLabel="Save"
                pending={update.isPending}
                error={update.error}
                onSubmit={(body) => update.mutate(body, { onSuccess: closeEdit })}
                onCancel={closeEdit}
              />
            ) : (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">{stack.name}</h1>
                {stack.description && <p className="mt-3 text-lg text-muted">{stack.description}</p>}
                <div className="mt-8 flex items-center gap-5">
                  <ProgressBar value={ratio} size="thick" label={`${stack.name}: ${formatPercent(ratio)} of goal`} className="flex-1" />
                  <span className="font-display text-3xl">
                    <CountUp value={ratio} format={formatPercent} />
                  </span>
                </div>
                <StackMeta stack={stack} className="mt-2" />
                <div className="mt-6 flex items-center gap-1">
                  <button onClick={() => setEditing(true)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-ink/[0.05] hover:text-ink">
                    Edit
                  </button>
                  <DeleteStack stack={stack} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-14">
        <StackBoard stack={stack} />
      </div>

      <section className="mt-14">
        <AddFromLibrary stack={stack} />
      </section>
    </div>
  );
}

function DeleteStack({ stack }: { stack: StackDetailDto }) {
  const del = useDeleteStack();
  const navigate = useNavigate();
  return (
    <ConfirmAction
      label="Delete"
      confirmLabel="Delete"
      question={<>Delete “{stack.name}”? The books stay in your library.</>}
      pendingLabel="Deleting…"
      pending={del.isPending}
      error={del.error}
      onConfirm={() => del.mutate(stack.id, { onSuccess: () => navigate('/stacks') })}
    />
  );
}

const GROUPS: { status: ReadingStatus; title: string }[] = [
  { status: 'reading', title: 'Reading now' },
  { status: 'want_to_read', title: 'Up next' },
  { status: 'finished', title: 'Done' },
  { status: 'abandoned', title: 'Put down' },
];

/**
 * The stack's books grouped by status. Tiles share a layoutId across groups, so when a
 * sync finishes a book it visibly moves from "Reading now" to "Done".
 */
function StackBoard({ stack }: { stack: StackDetailDto }) {
  const [arranging, setArranging] = useState(false);

  if (stack.books.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-ink/15 px-6 py-14 text-center">
        <p className="font-display text-2xl">This stack is empty</p>
        <p className="mt-1 text-sm text-muted">Add books from your library below, or search for new ones.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {arranging ? 'Drag books into the order you want; it saves as you go.' : `${stack.bookCount} ${stack.bookCount === 1 ? 'book' : 'books'}`}
        </p>
        {stack.books.length > 1 && (
          <button
            onClick={() => setArranging((a) => !a)}
            aria-pressed={arranging}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors',
              arranging ? 'bg-ink text-paper' : 'glass hover:bg-white/80',
            )}
          >
            {arranging ? <CheckIcon width={15} height={15} /> : <GripIcon width={15} height={15} />}
            {arranging ? 'Done' : 'Arrange'}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {arranging ? (
          <motion.div key="arrange" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {/* remount when the server's order changes under us (another tab, a move) */}
            <ArrangeList key={stack.books.map((b) => b.id).join()} stack={stack} />
          </motion.div>
        ) : (
          <motion.div key="board" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <StatusBoard stack={stack} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The stack's books grouped by status, each group in stack order. Tiles share a layoutId
 * across groups, so when a sync finishes a book it visibly moves from "Reading now" to "Done".
 */
function StatusBoard({ stack }: { stack: StackDetailDto }) {
  return (
    <LayoutGroup>
      <div className="space-y-12">
        {GROUPS.map(({ status, title }) => {
          const books = stack.books.filter((b) => b.status === status);
          if (books.length === 0) return null;
          return (
            <motion.section key={status} layout="position">
              <h2 className="mb-5 flex items-baseline gap-3">
                <span className="font-display text-2xl">{title}</span>
                <span className="text-sm tabular-nums text-muted">{books.length}</span>
              </h2>
              <ul className="grid grid-cols-3 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
                <AnimatePresence mode="popLayout">
                  {books.map((b) => (
                    <motion.li
                      key={b.id}
                      layoutId={`stack-tile-${b.id}`}
                      // tiles are transformed (own stacking context): lift the one whose menu is open
                      className="relative hover:z-20 focus-within:z-20"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={spring.morph}
                    >
                      <BoardTile item={b} stack={stack} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Drag to reorder (or use the arrows: same result, keyboard-friendly). Saves on drop. */
function ArrangeList({ stack }: { stack: StackDetailDto }) {
  const reorder = useReorderStack(stack.id);
  const [order, setOrder] = useState(() => stack.books.map((b) => b.id));
  // what to save on drop: updated by the reorder handler, read in onDragEnd
  const latest = useRef(order);
  const byId = new Map(stack.books.map((b) => [b.id, b]));
  const saved = stack.books.map((b) => b.id).join();

  function commit(next = latest.current) {
    if (next.join() !== saved) reorder.mutate(next);
  }

  function update(next: string[]) {
    latest.current = next;
    setOrder(next);
  }

  function nudge(index: number, by: -1 | 1) {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    update(next);
    commit(next);
  }

  return (
    <>
      <Reorder.Group axis="y" values={order} onReorder={update} className="space-y-2">
        {order.map((id, i) => {
          const b = byId.get(id);
          if (!b) return null;
          return (
            <Reorder.Item
              key={id}
              value={id}
              onDragEnd={() => commit()}
              whileDrag={{ scale: 1.02, boxShadow: '0 24px 50px -20px rgb(0 0 0 / 0.45)', zIndex: 10 }}
              className="glass relative flex cursor-grab touch-none select-none items-center gap-4 rounded-2xl p-3 active:cursor-grabbing"
            >
              <span className="text-muted">
                <GripIcon />
              </span>
              <span className="w-5 text-right text-sm tabular-nums text-muted">{i + 1}</span>
              <Cover book={b.book} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.book.title}</p>
                <p className="truncate text-sm text-muted">{authorsLine(b.book.authors)}</p>
              </div>
              <StatusLabel status={b.status} className="hidden sm:inline-flex" />
              <div className="flex flex-col">
                <button
                  onClick={() => nudge(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${b.book.title} up`}
                  className="rounded-md p-0.5 text-muted hover:bg-ink/[0.06] hover:text-ink disabled:opacity-25"
                >
                  <ChevronIcon dir="up" width={16} height={16} />
                </button>
                <button
                  onClick={() => nudge(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${b.book.title} down`}
                  className="rounded-md p-0.5 text-muted hover:bg-ink/[0.06] hover:text-ink disabled:opacity-25"
                >
                  <ChevronIcon width={16} height={16} />
                </button>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {reorder.isError && <ErrorState error={reorder.error} compact />}
    </>
  );
}

function BoardTile({ item, stack }: { item: LibraryBookDto; stack: StackDetailDto }) {
  return (
    <div className="group relative">
      <Link {...bookLink(item.id, 'stack')} className="block">
        <motion.div whileHover={{ y: -6 }} transition={spring.bouncy}>
          <Cover book={item.book} size="md" layoutId={coverLayoutId('stack', item.id)} className="w-full!" />
        </motion.div>
        <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{item.book.title}</p>
      </Link>
      {item.status === 'reading' ? (
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={item.progress.percent} label={`${item.book.title} progress`} className="flex-1" />
          <span className="text-xs tabular-nums text-muted">{formatPercent(item.progress.percent)}</span>
        </div>
      ) : item.status === 'finished' && item.finishedAt ? (
        <p className="mt-1 text-xs text-muted">Finished {formatDate(item.finishedAt)}</p>
      ) : (
        <p className="mt-1 truncate text-xs text-muted">{authorsLine(item.book.authors)}</p>
      )}
      <TileMenu item={item} stack={stack} />
    </div>
  );
}

/** Move to another stack, or take it out of this one. */
function TileMenu({ item, stack }: { item: LibraryBookDto; stack: StackDetailDto }) {
  const [open, setOpen] = useState(false);
  const stacks = useStacks();
  const move = useMoveStackBook();
  const membership = useStackMembership();
  const fly = useFly();
  const anchor = useRef<HTMLDivElement>(null);
  const others = (stacks.data ?? []).filter((s) => s.id !== stack.id);
  const busy = move.isPending || membership.isPending;
  const close = useCallback(() => setOpen(false), []);

  function moveTo(toStackId: string) {
    setOpen(false);
    // the cover leaves the tile toward the Stacks tab; the tile itself animates out
    const cover = anchor.current?.parentElement?.querySelector('img');
    if (cover) fly(item.book.coverUrl, cover, 'stacks');
    move.mutate({ from: stack.id, libraryBookId: item.id, to: toStackId });
  }

  return (
    <div ref={anchor} className="absolute -right-2 -top-2">
      <MenuTrigger label={`Actions for ${item.book.title}`} open={open} disabled={busy} onToggle={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={close} className="right-0 top-10">
        {others.length > 0 && (
          <>
            <MenuLabel>Move to</MenuLabel>
            {others.map((s) => (
              <MenuItem key={s.id} onClick={() => moveTo(s.id)}>
                <ArrowIcon width={14} height={14} className="text-muted" />
                <span className="truncate">{s.name}</span>
              </MenuItem>
            ))}
            <div className="my-1 h-px bg-ink/[0.06]" />
          </>
        )}
        <MenuItem
          danger
          onClick={() => {
            setOpen(false);
            membership.mutate({ stackId: stack.id, libraryBookId: item.id, member: false });
          }}
        >
          <CloseIcon width={14} height={14} />
          Remove from {stack.name}
        </MenuItem>
      </Popover>
      {(move.isError || membership.isError) && (
        <div className="absolute right-0 top-10 w-56 rounded-xl bg-white p-2 shadow-lg">
          <ErrorState error={move.error ?? membership.error} compact />
        </div>
      )}
    </div>
  );
}

/** Library books not yet in this stack; clicking one flies its cover onto the pile. */
function AddFromLibrary({ stack }: { stack: StackDetailDto }) {
  const [open, setOpen] = useState(false);
  const library = useLibrary();

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm hover:bg-white/70">
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={spring.bouncy} className="grid place-items-center">
            <PlusIcon width={15} height={15} />
          </motion.span>
          Add from your library
        </button>
        <SearchButton className="text-sm text-muted underline underline-offset-4 hover:text-ink">or find a new book</SearchButton>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="pt-6">
              <QueryState
                query={library}
                loading={
                  <div className="flex gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <CoverSkeleton key={i} className="w-20" />
                    ))}
                  </div>
                }
              >
                {(books) => <LibraryPicker stack={stack} books={books.filter((b) => !stack.books.some((x) => x.id === b.id))} />}
              </QueryState>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LibraryPicker({ stack, books }: { stack: StackDetailDto; books: LibraryBookDto[] }) {
  const membership = useStackMembership();
  const fly = useFly();

  if (books.length === 0) return <p className="text-sm text-muted">Every book in your library is already here.</p>;
  return (
    <>
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
        <AnimatePresence mode="popLayout">
          {books.map((b) => (
            <motion.button
              key={b.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              whileHover={{ y: -5 }}
              transition={spring.bouncy}
              disabled={membership.isPending}
              title={`Add ${b.book.title}`}
              onClick={(e) => {
                // Launch from the tile now: on success it leaves this list and its rect is gone.
                fly(b.book.coverUrl, e.currentTarget, `stack-${stack.id}`);
                membership.mutate({ stackId: stack.id, libraryBookId: b.id, member: true });
              }}
              className="text-left disabled:cursor-progress"
            >
              <Cover book={b.book} size="sm" className="w-full!" />
              <p className="mt-2 line-clamp-2 text-xs leading-snug">{b.book.title}</p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      {membership.isError && <ErrorState error={membership.error} compact />}
    </>
  );
}

function StackSkeleton() {
  return (
    <div className="mt-16 grid items-end gap-16 md:grid-cols-[auto_1fr]">
      <Skeleton className="h-56 w-60" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
