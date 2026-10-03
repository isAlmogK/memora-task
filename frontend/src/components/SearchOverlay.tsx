import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAddToLibrary, useCatalogSearch, useStackMembership, useStacks } from '../api/queries';
import type { CatalogBookDto, StackSummaryDto } from '../api/types';
import { authorsLine } from '../lib/format';
import { cx } from '../lib/cx';
import { useDebounced } from '../lib/useDebounced';
import { spring, staggerItem, staggerList } from '../motion/presets';
import { Cover } from './Cover';
import { useFly, useFlyTarget } from './fly';
import { CoverSkeleton, ErrorState, QueryState, Skeleton } from './QueryState';
import { CheckIcon, PlusIcon, SearchIcon } from './icons';
import { SearchContext } from './search';

const SUGGESTIONS = ['Le Guin', 'Ishiguro', 'Dune', 'Andy Weir'];

/** Where "Add" puts a book: just the library, or the library *and* a stack. */
type Target = { kind: 'library' } | { kind: 'stack'; stack: StackSummaryDto };

/**
 * Search lives in an overlay that opens over any page (nav button, ⌘K or "/").
 * The query and chosen target survive closing, so reopening picks up where you were.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>({ kind: 'library' });

  const openSearch = useCallback((q?: string) => {
    if (q !== undefined) setText(q);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchContext.Provider value={{ open: openSearch, close }}>
      {children}
      <AnimatePresence>
        {open && <SearchDialog text={text} onText={setText} target={target} onTarget={setTarget} onClose={close} />}
      </AnimatePresence>
    </SearchContext.Provider>
  );
}

/** Anything that should open search (nav, empty states) renders this instead of a link. */
export function SearchButton({ className, children }: { className?: string; children: ReactNode }) {
  const { open } = useContext(SearchContext);
  return (
    <button type="button" onClick={() => open()} className={className}>
      {children}
    </button>
  );
}

function SearchDialog({ text, onText, target, onTarget, onClose }: {
  text: string;
  onText: (t: string) => void;
  target: Target;
  onTarget: (t: Target) => void;
  onClose: () => void;
}) {
  const term = useDebounced(text.trim(), 250);
  const results = useCatalogSearch(term);

  // Esc closes; the page behind doesn't scroll while the dialog is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-ink/35 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search books"
        initial={{ opacity: 0, y: -24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97, transition: { duration: 0.15 } }}
        transition={spring.morph}
        className="relative flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-paper/90 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.5)] ring-1 ring-white/70 backdrop-blur-2xl"
      >
        <label className="relative block shrink-0">
          <span className="sr-only">Search books</span>
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon width={26} height={26} />
          </span>
          <input
            autoFocus
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="Search by title or author"
            className="w-full bg-transparent py-6 pl-16 pr-20 font-display text-3xl outline-none placeholder:text-faint"
          />
          <span className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-3">
            {results.isFetching && (
              <motion.span
                aria-label="Searching"
                className="size-4 rounded-full border-2 border-ink/15 border-t-ink"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <button onClick={onClose} className="rounded-md px-1.5 py-0.5 text-xs text-muted ring-1 ring-ink/15 hover:text-ink">
              esc
            </button>
          </span>
        </label>

        <TargetPicker target={target} onChange={onTarget} />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink/[0.07] py-2">
          {term.length < 2 ? (
            <div className="px-6 py-8 text-center text-sm text-muted">
              Try{' '}
              {SUGGESTIONS.map((s, i) => (
                <span key={s}>
                  <button onClick={() => onText(s)} className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    {s}
                  </button>
                  {i < SUGGESTIONS.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          ) : (
            <QueryState
              query={results}
              loading={<ResultsSkeleton />}
              isEmpty={(books) => books.length === 0}
              empty={<p className="px-6 py-8 text-center text-sm text-muted">Nothing for “{term}”. Check the spelling, or try the author’s name.</p>}
            >
              {(books) => (
                <motion.ul key={term} variants={staggerList} initial="hidden" animate="show">
                  {books.map((b) => (
                    <motion.li key={b.olWorkKey} variants={staggerItem}>
                      <ResultRow book={b} target={target} />
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </QueryState>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TargetPicker({ target, onChange }: { target: Target; onChange: (t: Target) => void }) {
  const stacks = useStacks();
  const list = stacks.data ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-4 text-sm">
      <span className="mr-1 text-muted">Add to</span>
      <TargetChip active={target.kind === 'library'} onClick={() => onChange({ kind: 'library' })}>
        Library only
      </TargetChip>
      {list.map((s) => (
        <StackTargetChip
          key={s.id}
          stack={s}
          active={target.kind === 'stack' && target.stack.id === s.id}
          onClick={() => onChange({ kind: 'stack', stack: s })}
        />
      ))}
    </div>
  );
}

/** A stack chip is also where the cover lands, so it bounces on arrival. */
function StackTargetChip({ stack, active, onClick }: { stack: StackSummaryDto; active: boolean; onClick: () => void }) {
  const target = useFlyTarget(`stack-${stack.id}`);
  return (
    <motion.span {...target} className="inline-block">
      <TargetChip active={active} onClick={onClick}>
        {stack.name} <span className={cx('tabular-nums', active ? 'text-paper/60' : 'text-faint')}>{stack.bookCount}</span>
      </TargetChip>
    </motion.span>
  );
}

function TargetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'relative rounded-full px-3.5 py-1.5 transition-colors',
        active ? 'text-paper' : 'text-muted ring-1 ring-ink/10 hover:text-ink hover:ring-ink/30',
      )}
    >
      {active && <motion.span layoutId="search-target" transition={spring.bouncy} className="absolute inset-0 rounded-full bg-ink" />}
      <span className="relative">{children}</span>
    </button>
  );
}

function ResultRow({ book, target }: { book: CatalogBookDto; target: Target }) {
  const add = useAddToLibrary();
  const membership = useStackMembership();
  const fly = useFly();
  const coverRef = useRef<HTMLDivElement>(null);
  const { close } = useContext(SearchContext);
  const [addedTo, setAddedTo] = useState<string | null>(null);

  const pending = add.isPending || membership.isPending;
  const error = add.error ?? membership.error;
  const inLibrary = book.libraryBookId !== null;
  const flyTo = target.kind === 'stack' ? `stack-${target.stack.id}` : 'library';

  function launch() {
    if (coverRef.current) fly(book.coverUrl, coverRef.current, flyTo);
    setAddedTo(target.kind === 'stack' ? target.stack.name : 'Library');
  }

  function addToStack(libraryBookId: string, stackId: string) {
    membership.mutate({ stackId, libraryBookId, member: true }, { onSuccess: launch });
  }

  function onAdd() {
    if (book.libraryBookId && target.kind === 'stack') return addToStack(book.libraryBookId, target.stack.id);
    add.mutate(book.olWorkKey, {
      onSuccess: (lb) => (target.kind === 'stack' ? addToStack(lb.id, target.stack.id) : launch()),
    });
  }

  // Already in the library and no stack chosen: nothing to add, just link to it.
  const showAdd = !inLibrary || target.kind === 'stack';
  const done = !pending && addedTo === (target.kind === 'stack' ? target.stack.name : 'Library');

  return (
    <div className="flex items-center gap-5 px-5 py-3.5">
      <div ref={coverRef}>
        <Cover book={book} size="xs" className="w-14!" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-snug">{book.title}</p>
        <p className="mt-0.5 text-sm text-muted">
          {authorsLine(book.authors)}
          {book.firstPublishedYear && ` · ${book.firstPublishedYear}`}
          {book.pageCount && ` · ${book.pageCount} pages`}
        </p>
        {inLibrary && (
          <Link to={`/books/${book.libraryBookId}`} onClick={close} className="mt-1 inline-block text-xs uppercase tracking-[0.14em] text-accent-deep hover:underline">
            In your library →
          </Link>
        )}
        {error && <ErrorState error={error} compact />}
      </div>
      {showAdd && (
        <motion.button
          onClick={onAdd}
          disabled={pending}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={spring.bouncy}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-60"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={done ? 'done' : 'add'}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="grid place-items-center"
            >
              {done ? <CheckIcon width={15} height={15} /> : <PlusIcon width={15} height={15} />}
            </motion.span>
          </AnimatePresence>
          {pending
            ? 'Adding…'
            : done
              ? 'Added'
              : target.kind === 'stack'
                ? `Add to ${target.stack.name}`
                : 'Add'}
        </motion.button>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="divide-y divide-ink/[0.06]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-5 px-5 py-3.5">
          <CoverSkeleton className="w-14" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
