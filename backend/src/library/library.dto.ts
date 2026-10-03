import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const READING_STATUSES = ['want_to_read', 'reading', 'finished', 'abandoned'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];
export const PROGRESS_SOURCES = ['manual', 'device', 'kindle_sim'] as const;
export type ProgressSource = (typeof PROGRESS_SOURCES)[number];

// ---------- requests ----------

export class ListLibraryQuery {
  @ApiProperty({ enum: READING_STATUSES, required: false, description: 'Only books with this derived status' })
  @IsOptional()
  @IsIn(READING_STATUSES, { message: `must be one of ${READING_STATUSES.join(', ')}` })
  status?: ReadingStatus;
}

export class AddToLibraryBody {
  @ApiProperty({ example: 'OL5735363W', description: 'Open Library work key (from /v1/catalog/search)' })
  @IsString()
  @Matches(/^OL\d+W$/, { message: 'must be an Open Library work key like OL5735363W' })
  olWorkKey!: string;
}

/** Exactly one of `percent` or `page` (checked in the service: it's a cross-field rule). */
export class LogProgressBody {
  @ApiProperty({ required: false, minimum: 0, maximum: 100, example: 42.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'must be a number with at most 2 decimals' })
  @Min(0, { message: 'must be between 0 and 100' })
  @Max(100, { message: 'must be between 0 and 100' })
  percent?: number;

  @ApiProperty({ required: false, minimum: 0, example: 210 })
  @IsOptional()
  @IsInt({ message: 'must be a whole number' })
  @Min(0, { message: 'must be 0 or more' })
  page?: number;
}

export class UpdateLibraryBookBody {
  @ApiProperty({ required: false, description: 'true marks it finished now; false clears an explicit finish' })
  @IsOptional()
  @IsBoolean()
  finished?: boolean;

  @ApiProperty({ required: false, description: 'true puts it down; false picks it back up' })
  @IsOptional()
  @IsBoolean()
  abandoned?: boolean;
}

// ---------- responses (mirrors frontend/src/api/types.ts) ----------

export class BookDto {
  @ApiProperty({ example: 'OL5735363W' }) olWorkKey!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [String] }) authors!: string[];
  @ApiProperty({ type: String, nullable: true, example: 'https://covers.openlibrary.org/b/id/11200092-L.jpg' }) coverUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true }) pageCount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) firstPublishedYear!: number | null;
  @ApiProperty({ type: String, nullable: true, description: 'One primary genre mapped from Open Library subjects' }) genre!: string | null;
}

export class ProgressDto {
  @ApiProperty({ description: 'Canonical unit (e-readers report percent). 0 when nothing logged.' }) percent!: number;
  @ApiProperty({ type: Number, nullable: true }) page!: number | null;
  @ApiProperty({ enum: PROGRESS_SOURCES, nullable: true }) source!: ProgressSource | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) occurredAt!: string | null;
}

export class PaceDto {
  @ApiProperty({ type: Number, nullable: true, description: 'Percent gained over the trailing 14 days ÷ 14; null unless reading' })
  percentPerDay!: number | null;
  @ApiProperty({ type: Number, nullable: true }) pagesPerDay!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Projected finish; null when pace ≤ 0' }) eta!: string | null;
}

export class LibraryBookDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: BookDto }) book!: BookDto;
  @ApiProperty({ enum: READING_STATUSES }) status!: ReadingStatus;
  @ApiProperty({ format: 'date-time' }) addedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
  @ApiProperty({ type: ProgressDto }) progress!: ProgressDto;
  @ApiProperty({ type: PaceDto }) pace!: PaceDto;
}

export class ReadingEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() percent!: number;
  @ApiProperty({ type: Number, nullable: true }) page!: number | null;
  @ApiProperty({ enum: PROGRESS_SOURCES }) source!: ProgressSource;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
}

export class StackRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class LibraryBookDetailDto extends LibraryBookDto {
  @ApiProperty({ type: [ReadingEventDto], description: 'Newest first (by when you read, not when it arrived), max 50' })
  events!: ReadingEventDto[];
  @ApiProperty({ type: [StackRefDto] }) stacks!: StackRefDto[];
}
