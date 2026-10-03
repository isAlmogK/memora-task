import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Caller, CurrentCaller } from '../auth/auth.decorators';
import { ApiErrors } from '../common/api-docs';
import { uuidParam } from '../common/validation';
import { CreateStackBody, StackDetailDto, StackSummaryDto, UpdateStackBody } from './stacks.dto';
import { StacksService } from './stacks.service';

@ApiTags('stacks')
@Controller('stacks')
export class StacksController {
  constructor(private readonly stacks: StacksService) {}

  @Get()
  @ApiOperation({ summary: 'Your stacks with progress toward each goal, newest first' })
  @ApiOkResponse({ type: [StackSummaryDto] })
  @ApiErrors()
  list(@CurrentCaller() caller: Caller): Promise<StackSummaryDto[]> {
    return this.stacks.list(caller.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a stack (names are unique per user, case-insensitive)' })
  @ApiCreatedResponse({ type: StackSummaryDto })
  @ApiErrors(400, 409)
  create(@CurrentCaller() caller: Caller, @Body() body: CreateStackBody): Promise<StackSummaryDto> {
    return this.stacks.create(caller.userId, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: StackDetailDto })
  @ApiErrors(400, 404)
  detail(@CurrentCaller() caller: Caller, @Param('id', uuidParam()) id: string): Promise<StackDetailDto> {
    return this.stacks.detail(caller.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, re-describe, or change the target / due date (null clears)' })
  @ApiOkResponse({ type: StackSummaryDto })
  @ApiErrors(400, 404, 409)
  update(
    @CurrentCaller() caller: Caller,
    @Param('id', uuidParam()) id: string,
    @Body() body: UpdateStackBody,
  ): Promise<StackSummaryDto> {
    return this.stacks.update(caller.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a stack; its books stay in your library' })
  @ApiNoContentResponse()
  @ApiErrors(400, 404)
  remove(@CurrentCaller() caller: Caller, @Param('id', uuidParam()) id: string): Promise<void> {
    return this.stacks.remove(caller.userId, id);
  }

  @Put(':id/books/:libraryBookId')
  @ApiOperation({ summary: 'Put a library book in the stack (idempotent)' })
  @ApiOkResponse({ type: StackDetailDto })
  @ApiErrors(400, 404)
  addBook(
    @CurrentCaller() caller: Caller,
    @Param('id', uuidParam()) id: string,
    @Param('libraryBookId', uuidParam('libraryBookId')) libraryBookId: string,
  ): Promise<StackDetailDto> {
    return this.stacks.addBook(caller.userId, id, libraryBookId);
  }

  @Delete(':id/books/:libraryBookId')
  @ApiOperation({ summary: 'Take a book out of the stack (idempotent; the book stays in your library)' })
  @ApiOkResponse({ type: StackDetailDto })
  @ApiErrors(400, 404)
  removeBook(
    @CurrentCaller() caller: Caller,
    @Param('id', uuidParam()) id: string,
    @Param('libraryBookId', uuidParam('libraryBookId')) libraryBookId: string,
  ): Promise<StackDetailDto> {
    return this.stacks.removeBook(caller.userId, id, libraryBookId);
  }
}
