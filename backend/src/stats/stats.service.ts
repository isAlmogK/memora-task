import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Db, InjectDb } from '../db/db.module';
import type { ReadingStatsDto } from './stats.dto';

interface StatsRow extends Record<string, unknown> {
  year: number;
  books_this_year: number;
  books_all_time: number;
  pages_this_year: number;
  pages_all_time: number;
  pages_per_day_30d: string;
  genres: ReadingStatsDto['genres'];
  monthly: ReadingStatsDto['monthly'];
  daily: ReadingStatsDto['daily'];
  current_streak: number;
  longest_streak: number;
  fastest: ReadingStatsDto['fastestFinish'];
}

/**
 * The Read page in one query. Sessions run in UTC, so ::date and date_trunc are UTC days.
 *
 *   ev            each event's NEW ground: percent above the highest percent before it
 *                 (window over earlier events of the same book), never negative
 *   pages_by_day  that ground in pages, per UTC day (books without a page count can't count)
 *   fin           finished books from the progress view, with their first event time
 *   runs          gaps-and-islands over reading days: day - row_number() is constant
 *                 within a run of consecutive days
 */
@Injectable()
export class StatsService {
  constructor(@InjectDb() private readonly db: Db) {}

  async forUser(userId: string): Promise<ReadingStatsDto> {
    const { rows } = await this.db.execute<StatsRow>(sql`
      with ev as (
        select e.occurred_at, b.page_count,
          greatest(e.percent - coalesce(max(e.percent) over (
            partition by e.user_book_id order by e.occurred_at, e.id
            rows between unbounded preceding and 1 preceding), 0), 0) as gained
        from reading_event e
        join user_book ub on ub.id = e.user_book_id
        join book b on b.id = ub.book_id
        where e.user_id = ${userId}
      ),
      pages_by_day as (
        select occurred_at::date as day, sum(gained / 100.0 * page_count) as pages
        from ev
        where gained > 0 and page_count is not null
        group by 1
      ),
      fin as (
        select p.user_book_id, b.title, coalesce(b.genre, 'Other') as genre,
          coalesce(b.page_count, 0) as pages, p.finished_at,
          (select min(e.occurred_at) from reading_event e where e.user_book_id = p.user_book_id) as first_event_at
        from user_book_progress p
        join book b on b.id = p.book_id
        where p.user_id = ${userId} and p.status = 'finished'
      ),
      runs as (
        select max(day) as end_day, count(*) as len
        from (select day, day - (row_number() over (order by day))::int as grp from pages_by_day) d
        group by grp
      )
      select
        extract(year from current_date)::int as year,
        (select count(*) from fin where finished_at >= date_trunc('year', current_date))::int as books_this_year,
        (select count(*) from fin)::int as books_all_time,
        (select coalesce(round(sum(pages)), 0) from pages_by_day where day >= date_trunc('year', current_date))::int as pages_this_year,
        (select coalesce(round(sum(pages)), 0) from pages_by_day)::int as pages_all_time,
        (select round(coalesce(round(sum(pages)), 0) / 30.0, 1) from pages_by_day where day > current_date - 30) as pages_per_day_30d,
        (select coalesce(json_agg(g order by g.books desc, g.pages desc, g.genre), '[]')
           from (select genre, count(*)::int as books, sum(pages)::int as pages
                 from fin where finished_at >= date_trunc('year', current_date) group by genre) g) as genres,
        (select json_agg(m order by m.month)
           from (select to_char(mm, 'YYYY-MM') as month,
                   (select count(*) from fin where date_trunc('month', finished_at) = mm)::int as books,
                   (select coalesce(round(sum(pages)), 0) from pages_by_day where date_trunc('month', day) = mm)::int as pages
                 from generate_series(date_trunc('month', current_date) - interval '11 months',
                                      date_trunc('month', current_date), interval '1 month') mm) m) as monthly,
        (select json_agg(d order by d.day)
           from (select to_char(dd, 'YYYY-MM-DD') as day, coalesce(round(p.pages), 0)::int as pages
                 from generate_series(current_date - 181, current_date, interval '1 day') dd
                 left join pages_by_day p on p.day = dd::date) d) as daily,
        (select coalesce(max(len) filter (where end_day >= current_date - 1), 0) from runs)::int as current_streak,
        (select coalesce(max(len), 0) from runs)::int as longest_streak,
        (select row_to_json(f)
           from (select user_book_id as "libraryBookId", title,
                   greatest(1, ceil(extract(epoch from finished_at - first_event_at) / 86400))::int as days
                 from fin where first_event_at is not null
                 order by days, finished_at desc limit 1) f) as fastest
    `);
    const r = rows[0]!;
    return {
      year: r.year,
      booksFinished: { thisYear: r.books_this_year, allTime: r.books_all_time },
      pagesRead: { thisYear: r.pages_this_year, allTime: r.pages_all_time },
      genres: r.genres,
      monthly: r.monthly,
      daily: r.daily,
      pace: {
        pagesPerDay30d: Number(r.pages_per_day_30d),
        currentStreakDays: r.current_streak,
        longestStreakDays: r.longest_streak,
      },
      fastestFinish: r.fastest,
    };
  }
}
