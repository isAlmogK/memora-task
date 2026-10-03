import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../lib/cx';

/** A small floating menu anchored to its parent (which should be `relative`). Closes on outside click or Esc. */
export function Popover({ open, onClose, children, className }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cx(
            'absolute z-30 w-56 origin-top-right rounded-2xl bg-white/95 p-1.5 text-sm shadow-[0_18px_50px_-12px_rgb(0_0_0/0.35)] ring-1 ring-ink/[0.06] backdrop-blur-xl',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-muted">{children}</p>;
}

export function MenuItem({ onClick, disabled, danger, children }: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-ink/[0.05]',
      )}
    >
      {children}
    </button>
  );
}
