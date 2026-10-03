import type { LibraryBookDto } from '../api/types';
import { formatDate } from '../lib/format';
import { CountUp } from './CountUp';

/** "~22 pages/day · done by Oct 11" — both numbers come from the API (SQL), not the client. */
export function PaceLine({ item }: { item: LibraryBookDto }) {
  const { pace, status } = item;
  if (status !== 'reading') return null;
  if (!pace.percentPerDay || pace.percentPerDay <= 0) {
    return <p className="text-sm text-muted">No progress in the last two weeks</p>;
  }
  return (
    <p className="text-sm text-muted">
      ~
      {pace.pagesPerDay != null ? (
        <>
          <CountUp value={pace.pagesPerDay} /> pages/day
        </>
      ) : (
        <>
          <CountUp value={pace.percentPerDay} format={(n) => n.toFixed(1)} />% a day
        </>
      )}
      {pace.eta && (
        <>
          {' · '}done by <span className="text-ink">{formatDate(pace.eta)}</span>
        </>
      )}
    </p>
  );
}
