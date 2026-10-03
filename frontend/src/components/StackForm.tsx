import { motion } from 'motion/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../api/errors';
import type { CreateStackBody } from '../api/types';
import { cx } from '../lib/cx';
import { ErrorState } from './QueryState';

interface StackFormProps {
  initial?: Partial<CreateStackBody>;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (body: CreateStackBody) => void;
  onCancel: () => void;
}

/** Field-level messages from a 400 `validation_failed` body (`details: { field: message }`). */
function fieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.code === 'validation_failed' && error.details && typeof error.details === 'object') {
    return error.details as Record<string, string>;
  }
  return {};
}

/** Create / edit a stack. Validation is the API's job; this form just shows what it says. */
export function StackForm({ initial, submitLabel, pending, error, onSubmit, onCancel }: StackFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [target, setTarget] = useState(initial?.targetCount != null ? String(initial.targetCount) : '');
  const [dueOn, setDueOn] = useState(initial?.dueOn ?? '');
  const fields = fieldErrors(error);
  const hasFieldErrors = Object.keys(fields).length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      description: description.trim() || null,
      targetCount: target === '' ? null : Number(target),
      dueOn: dueOn || null,
    });
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="grid gap-4 glass rounded-3xl p-5 sm:grid-cols-2">
        <Field label="Name" error={fields.name} className="sm:col-span-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Autumn sci-fi"
            className={inputClass(fields.name)}
          />
        </Field>
        <Field label="Description" hint="optional" error={fields.description} className="sm:col-span-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass(fields.description)} />
        </Field>
        <Field label="Target" hint="books to finish, optional" error={fields.targetCount}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={inputClass(fields.targetCount)}
          />
        </Field>
        <Field label="Finish by" hint="optional" error={fields.dueOn}>
          <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClass(fields.dueOn)} />
        </Field>
        {error != null && !hasFieldErrors && <ErrorState error={error} compact />}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2 text-sm text-paper disabled:opacity-60">
            {pending ? 'Saving…' : submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function inputClass(error: string | undefined) {
  return cx(
    'w-full rounded-lg bg-paper px-3 py-2 text-sm outline-none ring-1 transition-shadow focus:ring-2',
    error ? 'ring-danger' : 'ring-ink/10 focus:ring-ink/40',
  );
}

function Field({ label, hint, error, className, children }: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx('flex flex-col gap-1.5 text-sm', className)}>
      <span className="font-medium">
        {label} {hint && <span className="font-normal text-muted">· {hint}</span>}
      </span>
      {children}
      {error && <span className="text-xs text-danger">{label} {error}</span>}
    </label>
  );
}
