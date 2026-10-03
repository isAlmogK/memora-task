import { ApiProperty } from '@nestjs/swagger';

class YearAndAllTime {
  @ApiProperty() thisYear!: number;
  @ApiProperty() allTime!: number;
}

class GenreCount {
  @ApiProperty() genre!: string;
  @ApiProperty() books!: number;
  @ApiProperty({ description: 'Sum of page counts of those books' }) pages!: number;
}

class MonthCount {
  @ApiProperty({ example: '2026-09' }) month!: string;
  @ApiProperty({ description: 'Books finished that month' }) books!: number;
  @ApiProperty({ description: 'Pages read that month' }) pages!: number;
}

class DayCount {
  @ApiProperty({ example: '2026-09-30' }) day!: string;
  @ApiProperty() pages!: number;
}

class Pace {
  @ApiProperty({ description: 'Pages read in the last 30 days ÷ 30, one decimal' }) pagesPerDay30d!: number;
  @ApiProperty({ description: 'Consecutive reading days ending today (or yesterday)' }) currentStreakDays!: number;
  @ApiProperty() longestStreakDays!: number;
}

class FastestFinish {
  @ApiProperty({ format: 'uuid' }) libraryBookId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ description: 'Days from the first reading event to finished (at least 1)' }) days!: number;
}

/**
 * Everything on the Read page. Days are UTC calendar days. "Pages read" counts new ground
 * only: re-reading after jumping back isn't counted twice.
 */
export class ReadingStatsDto {
  @ApiProperty() year!: number;
  @ApiProperty({ type: YearAndAllTime }) booksFinished!: YearAndAllTime;
  @ApiProperty({ type: YearAndAllTime }) pagesRead!: YearAndAllTime;
  @ApiProperty({ type: [GenreCount], description: 'Books finished this year by primary genre, most first' }) genres!: GenreCount[];
  @ApiProperty({ type: [MonthCount], description: 'The last 12 calendar months, oldest first' }) monthly!: MonthCount[];
  @ApiProperty({ type: [DayCount], description: 'The last 182 days (26 weeks), oldest first' }) daily!: DayCount[];
  @ApiProperty({ type: Pace }) pace!: Pace;
  @ApiProperty({ type: FastestFinish, nullable: true }) fastestFinish!: FastestFinish | null;
}
