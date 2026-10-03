import { eq, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/db.module';
import { book, userBookProgress as ubp } from '../db/schema';
import type { BookDto, LibraryBookDto } from './library.dto';

/** One library row = the progress view joined to the catalog. Shared by library and stacks. */
const columns = {
  id: ubp.userBookId,
  status: ubp.status,
  addedAt: ubp.addedAt,
  finishedAt: ubp.finishedAt,
  percent: ubp.percent,
  page: ubp.page,
  source: ubp.source,
  progressAt: ubp.progressAt,
  percentPerDay: ubp.percentPerDay,
  pagesPerDay: sql<number | null>`round(${ubp.percentPerDay} * ${book.pageCount} / 100.0, 2)`.mapWith(Number),
  eta: ubp.eta,
  olWorkKey: book.olWorkKey,
  title: book.title,
  authors: book.authors,
  coverId: book.coverId,
  pageCount: book.pageCount,
  firstPublishedYear: book.firstPublishedYear,
  genre: book.genre,
};

export function selectLibraryRows(db: Db, where: SQL | undefined) {
  return db.select(columns).from(ubp).innerJoin(book, eq(book.id, ubp.bookId)).where(where);
}

export type LibraryRow = Awaited<ReturnType<typeof selectLibraryRows>>[number];

/** Most recently active first: last progress, else when it was added. */
export const byRecentActivity = sql`coalesce(${ubp.progressAt}, ${ubp.addedAt}) desc, ${ubp.userBookId} desc`;

export const coverUrl = (coverId: number | null) =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;

export function toBookDto(b: Pick<LibraryRow, 'olWorkKey' | 'title' | 'authors' | 'coverId' | 'pageCount' | 'firstPublishedYear' | 'genre'>): BookDto {
  return {
    olWorkKey: b.olWorkKey,
    title: b.title,
    authors: b.authors,
    coverUrl: coverUrl(b.coverId),
    pageCount: b.pageCount,
    firstPublishedYear: b.firstPublishedYear,
    genre: b.genre,
  };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toLibraryBookDto(r: LibraryRow): LibraryBookDto {
  const reading = r.status === 'reading';
  return {
    id: r.id,
    book: toBookDto(r),
    status: r.status,
    addedAt: r.addedAt.toISOString(),
    finishedAt: iso(r.finishedAt),
    progress: { percent: r.percent, page: r.page, source: r.source, occurredAt: iso(r.progressAt) },
    pace: {
      percentPerDay: reading ? r.percentPerDay : null,
      pagesPerDay: reading && r.percentPerDay && r.percentPerDay > 0 ? r.pagesPerDay : null,
      eta: iso(r.eta),
    },
  };
}
