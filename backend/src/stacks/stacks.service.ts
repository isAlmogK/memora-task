import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { ApiError } from '../common/api-error';
import { Db, InjectDb } from '../db/db.module';
import { stack, stackBook, userBook, userBookProgress as ubp } from '../db/schema';
import type { ReadingStatus } from '../library/library.dto';
import { coverUrl, selectLibraryRows, toLibraryBookDto } from '../library/library.queries';
import type { CreateStackBody, StackDetailDto, StackSummaryDto, UpdateStackBody } from './stacks.dto';

const PREVIEW_SIZE = 8;

interface SummaryRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  target_count: number | null;
  due_on: string | null;
  created_at: Date;
  book_count: number;
  finished_count: number;
  goal: number;
  on_track: boolean | null;
}

/** Postgres unique violation on the case-insensitive (user_id, lower(name)) index. */
function isNameTaken(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === '23505' && pg.constraint === 'stack_user_name_unique') return true;
  }
  return false;
}

@Injectable()
export class StacksService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(userId: string): Promise<StackSummaryDto[]> {
    return this.summaries(userId);
  }

  async detail(userId: string, id: string): Promise<StackDetailDto> {
    const [summary] = await this.summaries(userId, id);
    if (!summary) throw ApiError.notFound('Stack');
    const order = await this.db
      .select({ userBookId: stackBook.userBookId })
      .from(stackBook)
      .where(and(eq(stackBook.userId, userId), eq(stackBook.stackId, id)))
      .orderBy(asc(stackBook.position), asc(stackBook.addedAt));
    const ids = order.map((o) => o.userBookId);
    const rows = ids.length ? await selectLibraryRows(this.db, and(eq(ubp.userId, userId), inArray(ubp.userBookId, ids))) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return { ...summary, books: ids.flatMap((bid) => (byId.has(bid) ? [toLibraryBookDto(byId.get(bid)!)] : [])) };
  }

  async create(userId: string, body: CreateStackBody): Promise<StackSummaryDto> {
    const [created] = await this.write(body.name, () =>
      this.db
        .insert(stack)
        .values({
          userId,
          name: body.name,
          description: body.description || null,
          targetCount: body.targetCount ?? null,
          dueOn: body.dueOn ?? null,
        })
        .returning({ id: stack.id }),
    );
    return (await this.summaries(userId, created!.id))[0]!;
  }

  async update(userId: string, id: string, body: UpdateStackBody): Promise<StackSummaryDto> {
    const set = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.targetCount !== undefined && { targetCount: body.targetCount }),
      ...(body.dueOn !== undefined && { dueOn: body.dueOn }),
    };
    if (Object.keys(set).length > 0) {
      const [updated] = await this.write(body.name, () =>
        this.db
          .update(stack)
          .set(set)
          .where(and(eq(stack.userId, userId), eq(stack.id, id)))
          .returning({ id: stack.id }),
      );
      if (!updated) throw ApiError.notFound('Stack');
    }
    const [summary] = await this.summaries(userId, id);
    if (!summary) throw ApiError.notFound('Stack');
    return summary;
  }

  /** Deletes the stack only; its books stay in the library (stack_book rows cascade). */
  async remove(userId: string, id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(stack)
      .where(and(eq(stack.userId, userId), eq(stack.id, id)))
      .returning({ id: stack.id });
    if (!deleted) throw ApiError.notFound('Stack');
  }

  /** PUT semantics: adding a book that's already there is a no-op. */
  async addBook(userId: string, stackId: string, userBookId: string): Promise<StackDetailDto> {
    await this.assertOwned(userId, stackId, userBookId);
    await this.db
      .insert(stackBook)
      .values({
        userId,
        stackId,
        userBookId,
        position: sql`(select coalesce(max(${stackBook.position}), 0) + 1 from ${stackBook} where ${stackBook.stackId} = ${stackId})`,
      })
      .onConflictDoNothing({ target: [stackBook.stackId, stackBook.userBookId] });
    return this.detail(userId, stackId);
  }

  /** Idempotent: removing a book that isn't in the stack still returns the stack. */
  async removeBook(userId: string, stackId: string, userBookId: string): Promise<StackDetailDto> {
    await this.db
      .delete(stackBook)
      .where(and(eq(stackBook.userId, userId), eq(stackBook.stackId, stackId), eq(stackBook.userBookId, userBookId)));
    return this.detail(userId, stackId);
  }

  // ---------- internals ----------

  /** Clean 404s for the API. The composite FKs would reject a foreign book anyway; this just names the problem. */
  private async assertOwned(userId: string, stackId: string, userBookId: string): Promise<void> {
    const [[s], [ub]] = await Promise.all([
      this.db.select({ id: stack.id }).from(stack).where(and(eq(stack.userId, userId), eq(stack.id, stackId))).limit(1),
      this.db.select({ id: userBook.id }).from(userBook).where(and(eq(userBook.userId, userId), eq(userBook.id, userBookId))).limit(1),
    ]);
    if (!s) throw ApiError.notFound('Stack');
    if (!ub) throw ApiError.notFound('Library book');
  }

  private async write<T>(name: string | undefined, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (isNameTaken(err)) throw new ApiError(409, 'stack_name_taken', `You already have a stack called “${name}”`);
      throw err;
    }
  }

  /**
   * Counts, goal and on-track in one query. on_track: null without a due date; true once
   * the goal is met; otherwise finished/goal must keep up with the share of the
   * [created, due] window that has passed (whole UTC days).
   */
  private async summaries(userId: string, id?: string): Promise<StackSummaryDto[]> {
    const { rows } = await this.db.execute<SummaryRow>(sql`
      select c.id, c.name, c.description, c.target_count, c.created_at, c.book_count, c.finished_count,
        c.due_on::text as due_on, -- as text: node-postgres would turn a date into a local-midnight Date
        coalesce(c.target_count, c.book_count) as goal,
        case
          when c.due_on is null then null
          when coalesce(c.target_count, c.book_count) = 0 then false
          when c.finished_count >= coalesce(c.target_count, c.book_count) then true
          else c.finished_count::numeric / coalesce(c.target_count, c.book_count)
               >= least(greatest((current_date - c.created_at::date)::numeric
                                 / greatest(c.due_on - c.created_at::date, 1), 0), 1)
        end as on_track
      from (
        select s.id, s.name, s.description, s.target_count, s.due_on, s.created_at,
          count(sb.user_book_id)::int as book_count,
          (count(*) filter (where p.status = 'finished'))::int as finished_count
        from ${stack} s
        left join ${stackBook} sb on sb.stack_id = s.id
        left join ${ubp} p on p.user_book_id = sb.user_book_id
        where s.user_id = ${userId} ${id ? sql`and s.id = ${id}` : sql``}
        group by s.id
      ) c
      order by c.created_at desc, c.id desc
    `);
    if (rows.length === 0) return [];

    const previews = await this.previews(
      userId,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      targetCount: r.target_count,
      dueOn: r.due_on,
      createdAt: new Date(r.created_at).toISOString(),
      bookCount: r.book_count,
      finishedCount: r.finished_count,
      goal: r.goal,
      onTrack: r.on_track,
      preview: previews.get(r.id) ?? [],
    }));
  }

  /** First PREVIEW_SIZE books of each stack, in stack order (window function per stack). */
  private async previews(userId: string, stackIds: string[]) {
    const { rows } = await this.db.execute<{
      stack_id: string;
      user_book_id: string;
      title: string;
      cover_id: number | null;
      page_count: number | null;
      status: ReadingStatus;
    }>(sql`
      select sb.stack_id, sb.user_book_id, b.title, b.cover_id, b.page_count, p.status
      from (
        select stack_id, user_book_id,
          row_number() over (partition by stack_id order by position, added_at) as rn
        from stack_book
        where user_id = ${userId} and stack_id in ${stackIds}
      ) sb
      join user_book_progress p on p.user_book_id = sb.user_book_id
      join book b on b.id = p.book_id
      where sb.rn <= ${PREVIEW_SIZE}
      order by sb.stack_id, sb.rn
    `);
    const out = new Map<string, StackSummaryDto['preview']>();
    for (const r of rows) {
      const list = out.get(r.stack_id) ?? [];
      list.push({ libraryBookId: r.user_book_id, title: r.title, coverUrl: coverUrl(r.cover_id), pageCount: r.page_count, status: r.status });
      out.set(r.stack_id, list);
    }
    return out;
  }
}
