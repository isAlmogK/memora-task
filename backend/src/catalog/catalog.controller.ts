import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Caller, CurrentCaller } from '../auth/auth.decorators';
import { ApiErrorBody, ApiErrors } from '../common/api-docs';
import { CatalogBookDto, SearchCatalogQuery } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search Open Library by title or author; each hit says if it is already in your library' })
  @ApiOkResponse({ type: [CatalogBookDto] })
  @ApiErrors(400)
  @ApiResponse({ status: 502, description: 'Open Library is down or slow', type: ApiErrorBody })
  search(@CurrentCaller() caller: Caller, @Query() query: SearchCatalogQuery): Promise<CatalogBookDto[]> {
    return this.catalog.search(caller.userId, query.q, query.limit);
  }
}
