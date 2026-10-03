const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const short = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const shortWithYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

/** "just now", "2 min. ago", "yesterday", "3 days ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day');
  return formatDate(iso);
}

/** "Oct 11", or "Oct 11, 2027" when not this year. Accepts ISO timestamps and YYYY-MM-DD. */
export function formatDate(isoOrDay: string): string {
  const d = new Date(isoOrDay.length === 10 ? `${isoOrDay}T12:00:00` : isoOrDay);
  return (d.getFullYear() === new Date().getFullYear() ? short : shortWithYear).format(d);
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

export function authorsLine(authors: string[]): string {
  return authors.length ? authors.join(' & ') : 'Unknown author';
}

export const SOURCE_LABEL = {
  manual: 'Logged by hand',
  device: 'From your e-reader',
  kindle_sim: 'Kindle sync',
} as const;

export const STATUS_LABEL = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Put down',
} as const;
