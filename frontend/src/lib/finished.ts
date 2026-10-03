import type { LibraryBookDto, StackSummaryDto } from '../api/types';

/** Finished books, most recently finished first. */
export function byFinishedDesc(books: LibraryBookDto[]): LibraryBookDto[] {
  return [...books].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
}

/** Same shape StackFan takes for a real stack's preview. */
export function asFanPreview(books: LibraryBookDto[]): StackSummaryDto['preview'] {
  return books.map((b) => ({
    libraryBookId: b.id,
    title: b.book.title,
    coverUrl: b.book.coverUrl,
    pageCount: b.book.pageCount,
    status: b.status,
  }));
}
