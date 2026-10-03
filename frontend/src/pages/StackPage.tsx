import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/errors';
import { useDeleteStack, useLibrary, useStack, useStackMembership, useUpdateStack } from '../api/queries';
import type { LibraryBookDto, ReadingStatus, StackDetailDto } from '../api/types';
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
import { ArrowIcon, CloseIcon, PlusIcon } from '../components/icons';
import { bookLink, coverLayoutId } from '../lib/coverMorph';
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
      <Link to="/stacks" className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <span className="transition-transform group-hover:-translate-x-0.5">
          <ArrowIcon dir="left" width={15} height={15} />
        </span>
        Stacks
      </Link>

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
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-danger/10 hover:text-danger">
        Delete
      </button>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Delete “{stack.name}”? The books stay in your library.</span>
      <button
        onClick={() => del.mutate(stack.id, { onSuccess: () => navigate('/stacks') })}
        disabled={del.isPending}
        className="rounded-full bg-danger px-3 py-1.5 text-paper disabled:opacity-60"
      >
        {del.isPending ? 'Deleting…' : 'Delete'}
      </button>
      <button onClick={() => setConfirming(false)} className="px-2 py-1.5 text-muted hover:text-ink">
        Cancel
      </button>
      {del.isError && <ErrorState error={del.error} compact />}
    </motion.div>
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
  const membership = useStackMembership();

  if (stack.books.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-ink/15 px-6 py-14 text-center">
        <p className="font-display text-2xl">This stack is empty</p>
        <p className="mt-1 text-sm text-muted">Add books from your library below, or search for new ones.</p>
      </div>
    );
  }
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
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={spring.morph}
                    >
                      <BoardTile
                        item={b}
                        removing={membership.isPending && membership.variables.libraryBookId === b.id}
                        onRemove={() => membership.mutate({ stackId: stack.id, libraryBookId: b.id, member: false })}
                        stackName={stack.name}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          );
        })}
        {membership.isError && <ErrorState error={membership.error} compact />}
      </div>
    </LayoutGroup>
  );
}

function BoardTile({ item, stackName, removing, onRemove }: {
  item: LibraryBookDto;
  stackName: string;
  removing: boolean;
  onRemove: () => void;
}) {
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
      <motion.button
        onClick={onRemove}
        disabled={removing}
        whileTap={{ scale: 0.85 }}
        aria-label={`Remove ${item.book.title} from ${stackName}`}
        title={`Remove from ${stackName}`}
        className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-paper opacity-0 shadow-md transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        <CloseIcon width={14} height={14} />
      </motion.button>
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
