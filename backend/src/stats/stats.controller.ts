import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Caller, CurrentCaller } from '../auth/auth.decorators';
import { ApiErrors } from '../common/api-docs';
import { ReadingStatsDto } from './stats.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Your reading in numbers: books and pages, genres, months, days, streaks' })
  @ApiOkResponse({ type: ReadingStatsDto })
  @ApiErrors()
  get(@CurrentCaller() caller: Caller): Promise<ReadingStatsDto> {
    return this.stats.forUser(caller.userId);
  }
}
