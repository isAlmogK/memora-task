import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { ErrorState } from './QueryState';

/** A destructive action that asks inline first: "Delete" → "Delete X? … [Delete] [Cancel]". */
export function ConfirmAction({ label, confirmLabel, question, pendingLabel, pending, error, onConfirm }: {
  label: string;
  /** The final button, e.g. "Remove" for a "Remove from library" action. */
  confirmLabel: string;
  question: ReactNode;
  pendingLabel: string;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-danger/10 hover:text-danger">
        {label}
      </button>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{question}</span>
      <button onClick={onConfirm} disabled={pending} className="rounded-full bg-danger px-3 py-1.5 text-paper disabled:opacity-60">
        {pending ? pendingLabel : confirmLabel}
      </button>
      <button onClick={() => setConfirming(false)} className="px-2 py-1.5 text-muted hover:text-ink">
        Cancel
      </button>
      {error != null && <ErrorState error={error} compact />}
    </motion.div>
  );
}
