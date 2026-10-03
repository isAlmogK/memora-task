import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Caller, CurrentCaller } from '../auth/auth.decorators';
import { ApiErrors } from '../common/api-docs';
import { uuidParam } from '../common/validation';
import { ListSyncRunsQuery, SyncRunDto } from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('sync-runs')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a Kindle sync (or get the one already in progress); poll it for status' })
  @ApiAcceptedResponse({ type: SyncRunDto })
  @ApiErrors()
  start(@CurrentCaller() caller: Caller): Promise<SyncRunDto> {
    return this.sync.start(caller.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Your sync runs, newest first' })
  @ApiOkResponse({ type: [SyncRunDto] })
  @ApiErrors(400)
  list(@CurrentCaller() caller: Caller, @Query() query: ListSyncRunsQuery): Promise<SyncRunDto[]> {
    return this.sync.list(caller.userId, query.limit);
  }

  @Get(':id')
  @ApiOkResponse({ type: SyncRunDto })
  @ApiErrors(400, 404)
  get(@CurrentCaller() caller: Caller, @Param('id', uuidParam()) id: string): Promise<SyncRunDto> {
    return this.sync.get(caller.userId, id);
  }
}
