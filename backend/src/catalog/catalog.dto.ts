import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Trim } from '../common/transforms';
import { BookDto } from '../library/library.dto';

export class SearchCatalogQuery {
  @ApiProperty({ minLength: 2, maxLength: 100, example: 'ishiguro', description: 'Title and/or author' })
  @Trim()
  @IsString({ message: 'is required' })
  @Length(2, 100, { message: 'must be 2–100 characters' })
  q!: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 40, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number between 1 and 40' })
  @Min(1, { message: 'must be a whole number between 1 and 40' })
  @Max(40, { message: 'must be a whole number between 1 and 40' })
  limit?: number;
}

export class CatalogBookDto extends BookDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Set when this book is already in your library' })
  libraryBookId!: string | null;
}
