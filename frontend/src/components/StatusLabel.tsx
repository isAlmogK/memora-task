import type { ReadingStatus } from '../api/types';
import { cx } from '../lib/cx';
import { STATUS_LABEL } from '../lib/format';

const DOT: Record<ReadingStatus, string> = {
  reading: 'bg-accent',
  finished: 'bg-ink',
  want_to_read: 'border border-ink/40',
  abandoned: 'bg-faint',
};

export function StatusLabel({ status, className }: { status: ReadingStatus; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted', className)}>
      <span className={cx('size-1.5 rounded-full', DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}
