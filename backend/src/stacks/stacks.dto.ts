import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { LibraryBookDto, READING_STATUSES, type ReadingStatus } from '../library/library.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// ---------- requests ----------

/**
 * Optional fields accept null to clear them. Messages are phrased to follow the field
 * label in the UI ("Name must be 1–80 characters").
 */
export class CreateStackBody {
  @ApiProperty({ minLength: 1, maxLength: 80, example: 'Autumn sci-fi' })
  @Transform(trim)
  @IsString({ message: 'must be text' })
  @Length(1, 80, { message: 'must be 1–80 characters' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'must be text' })
  @MaxLength(500, { message: 'must be at most 500 characters' })
  description?: string | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 1, maximum: 500, description: 'How many books to finish' })
  @IsOptional()
  @IsInt({ message: 'must be a whole number between 1 and 500' })
  @Min(1, { message: 'must be a whole number between 1 and 500' })
  @Max(500, { message: 'must be a whole number between 1 and 500' })
  targetCount?: number | null;

  @ApiProperty({ type: String, format: 'date', nullable: true, required: false, example: '2026-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'must be a YYYY-MM-DD date' })
  dueOn?: string | null;
}

/** Same rules, every field optional. `name` may be omitted but not nulled. */
export class UpdateStackBody {
  @ApiProperty({ required: false, minLength: 1, maxLength: 80 })
  @ValidateIf((_, v) => v !== undefined)
  @Transform(trim)
  @IsString({ message: 'must be text' })
  @Length(1, 80, { message: 'must be 1–80 characters' })
  name?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'must be text' })
  @MaxLength(500, { message: 'must be at most 500 characters' })
  description?: string | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt({ message: 'must be a whole number between 1 and 500' })
  @Min(1, { message: 'must be a whole number between 1 and 500' })
  @Max(500, { message: 'must be a whole number between 1 and 500' })
  targetCount?: number | null;

  @ApiProperty({ type: String, format: 'date', nullable: true, required: false })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'must be a YYYY-MM-DD date' })
  dueOn?: string | null;
}

// ---------- responses ----------

export class StackPreviewBookDto {
  @ApiProperty({ format: 'uuid' }) libraryBookId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true }) pageCount!: number | null;
  @ApiProperty({ enum: READING_STATUSES }) status!: ReadingStatus;
}

export class StackSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number, nullable: true }) targetCount!: number | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dueOn!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() bookCount!: number;
  @ApiProperty() finishedCount!: number;
  @ApiProperty({ description: 'targetCount, or bookCount when there is no target' }) goal!: number;
  @ApiProperty({
    type: Boolean,
    nullable: true,
    description: 'null without a due date; otherwise finished/goal ≥ fraction of [created, due] elapsed',
  })
  onTrack!: boolean | null;
  @ApiProperty({ type: [StackPreviewBookDto], description: 'First 8 books in stack order' }) preview!: StackPreviewBookDto[];
}

export class StackDetailDto extends StackSummaryDto {
  @ApiProperty({ type: [LibraryBookDto], description: 'All books, in stack order' }) books!: LibraryBookDto[];
}
