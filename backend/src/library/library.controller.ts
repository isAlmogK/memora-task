import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Caller, CurrentCaller } from '../auth/auth.decorators';
import { ApiErrors } from '../common/api-docs';
import { uuidParam } from '../common/validation';
import {
  AddToLibraryBody,
  LibraryBookDetailDto,
  LibraryBookDto,
  ListLibraryQuery,
  LogProgressBody,
  UpdateLibraryBookBody,
} from './library.dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Your books, most recently active first' })
  @ApiOkResponse({ type: [LibraryBookDto] })
  @ApiErrors(400)
  list(@CurrentCaller() caller: Caller, @Query() query: ListLibraryQuery): Promise<LibraryBookDto[]> {
    return this.library.list(caller.userId, query.status);
  }

  @Post()
  @ApiOperation({ summary: 'Add a book to your library' })
  @ApiCreatedResponse({ type: LibraryBookDto })
  @ApiErrors(400, 404, 409)
  add(@CurrentCaller() caller: Caller, @Body() body: AddToLibraryBody): Promise<LibraryBookDto> {
    return this.library.add(caller.userId, body.olWorkKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One book with its recent reading events and the stacks it is in' })
  @ApiOkResponse({ type: LibraryBookDetailDto })
  @ApiErrors(400, 404)
  detail(@CurrentCaller() caller: Caller, @Param('id', uuidParam()) id: string): Promise<LibraryBookDetailDto> {
    return this.library.detail(caller.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mark finished / put down (or undo either)' })
  @ApiOkResponse({ type: LibraryBookDto })
  @ApiErrors(400, 404)
  update(
    @CurrentCaller() caller: Caller,
    @Param('id', uuidParam()) id: string,
    @Body() body: UpdateLibraryBookBody,
  ): Promise<LibraryBookDto> {
    return this.library.update(caller.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a book from your library (its progress and stack memberships go with it)' })
  @ApiNoContentResponse()
  @ApiErrors(400, 404)
  remove(@CurrentCaller() caller: Caller, @Param('id', uuidParam()) id: string): Promise<void> {
    return this.library.remove(caller.userId, id);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Log progress by hand: exactly one of percent or page' })
  @ApiCreatedResponse({ type: LibraryBookDetailDto })
  @ApiErrors(400, 404)
  logProgress(
    @CurrentCaller() caller: Caller,
    @Param('id', uuidParam()) id: string,
    @Body() body: LogProgressBody,
  ): Promise<LibraryBookDetailDto> {
    return this.library.logProgress(caller.userId, id, body);
  }
}
