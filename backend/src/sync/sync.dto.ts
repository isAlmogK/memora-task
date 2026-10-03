import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PROGRESS_SOURCES, type ProgressSource } from '../library/library.dto';

export const SYNC_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export class ListSyncRunsQuery {
  @ApiProperty({ required: false, minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number between 1 and 50' })
  @Min(1, { message: 'must be a whole number between 1 and 50' })
  @Max(50, { message: 'must be a whole number between 1 and 50' })
  limit?: number;
}

export class SyncRunDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PROGRESS_SOURCES }) source!: ProgressSource;
  @ApiProperty({ enum: SYNC_STATUSES, description: 'queued → running → succeeded | failed' }) status!: SyncStatus;
  @ApiProperty({ description: 'Events recorded so far (counts up while running)' }) eventsIngested!: number;
  @ApiProperty({ type: String, nullable: true }) error!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) startedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
}
