import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { CatalogService } from '../catalog/catalog.service';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { readingEvent, stack, stackBook, userBook, userBookProgress as ubp } from '../db/schema';
import { ProgressService } from '../progress/progress.service';
import type { LibraryBookDetailDto, LibraryBookDto, LogProgressBody, ReadingStatus, UpdateLibraryBookBody } from './library.dto';
import { byRecentActivity, selectLibraryRows, toLibraryBookDto } from './library.queries';

/** Every query filters by the caller's user id; someone else's book is simply "not found". */
@Injectable()
export class LibraryService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly catalog: CatalogService,
    private readonly progress: ProgressService,
  ) {}

  async list(userId: string, status?: ReadingStatus): Promise<LibraryBookDto[]> {
    const rows = await selectLibraryRows(this.db, and(eq(ubp.userId, userId), status && eq(ubp.status, status))).orderBy(
      byRecentActivity,
    );
    return rows.map(toLibraryBookDto);
  }

  async getOne(userId: string, id: string): Promise<LibraryBookDto> {
    const [row] = await selectLibraryRows(this.db, and(eq(ubp.userId, userId), eq(ubp.userBookId, id))).limit(1);
    if (!row) throw ApiError.notFound('Library book');
    return toLibraryBookDto(row);
  }

  async detail(userId: string, id: string): Promise<LibraryBookDetailDto> {
    const [base, events, stacks] = await Promise.all([
      this.getOne(userId, id),
      this.db
        .select()
        .from(readingEvent)
        .where(and(eq(readingEvent.userId, userId), eq(readingEvent.userBookId, id)))
        .orderBy(desc(readingEvent.occurredAt), desc(readingEvent.id))
        .limit(50),
      this.db
        .select({ id: stack.id, name: stack.name })
        .from(stackBook)
        .innerJoin(stack, eq(stack.id, stackBook.stackId))
        .where(and(eq(stackBook.userId, userId), eq(stackBook.userBookId, id)))
        .orderBy(asc(stack.name)),
    ]);
    return {
      ...base,
      events: events.map((e) => ({
        id: String(e.id),
        percent: e.percent,
        page: e.page,
        source: e.source,
        occurredAt: e.occurredAt.toISOString(),
        receivedAt: e.receivedAt.toISOString(),
      })),
      stacks,
    };
  }

  async add(userId: string, olWorkKey: string): Promise<LibraryBookDto> {
    const b = await this.catalog.ensureBook(olWorkKey);
    const [created] = await this.db
      .insert(userBook)
      .values({ userId, bookId: b.id })
      .onConflictDoNothing({ target: [userBook.userId, userBook.bookId] })
      .returning({ id: userBook.id });
    if (!created) throw new ApiError(409, 'already_in_library', 'This book is already in your library');
    return this.getOne(userId, created.id);
  }

  /** Finished / put down are the only stored choices; everything else is derived from events. */
  async update(userId: string, id: string, body: UpdateLibraryBookBody): Promise<LibraryBookDto> {
    if (body.finished === undefined && body.abandoned === undefined) {
      throw ApiError.validation({ finished: 'send finished and/or abandoned' });
    }
    const [updated] = await this.db
      .update(userBook)
      .set({
        // keep the original timestamp when it's already set
        ...(body.finished !== undefined && { finishedAt: body.finished ? sql`coalesce(${userBook.finishedAt}, now())` : null }),
        ...(body.abandoned !== undefined && { abandonedAt: body.abandoned ? sql`coalesce(${userBook.abandonedAt}, now())` : null }),
      })
      .where(and(eq(userBook.userId, userId), eq(userBook.id, id)))
      .returning({ id: userBook.id });
    if (!updated) throw ApiError.notFound('Library book');
    return this.getOne(userId, id);
  }

  /** Removes the book from the library; its events and stack memberships cascade with it. */
  async remove(userId: string, id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(userBook)
      .where(and(eq(userBook.userId, userId), eq(userBook.id, id)))
      .returning({ id: userBook.id });
    if (!deleted) throw ApiError.notFound('Library book');
  }

  async logProgress(userId: string, id: string, body: LogProgressBody): Promise<LibraryBookDetailDto> {
    await this.progress.record(userId, id, { source: 'manual', percent: body.percent, page: body.page });
    return this.detail(userId, id);
  }
}
