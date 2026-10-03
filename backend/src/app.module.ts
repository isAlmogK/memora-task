import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './auth/api-key.guard';
import { CatalogService } from './catalog/catalog.service';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { LibraryController } from './library/library.controller';
import { LibraryService } from './library/library.service';
import { ProgressController } from './progress/progress.controller';
import { ProgressService } from './progress/progress.service';
import { StacksController } from './stacks/stacks.controller';
import { StacksService } from './stacks/stacks.service';

@Module({
  imports: [DbModule],
  controllers: [HealthController, LibraryController, StacksController, ProgressController],
  providers: [
    // Every route requires an API key unless it's marked @Public().
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    CatalogService,
    LibraryService,
    ProgressService,
    StacksService,
  ],
})
export class AppModule {}
