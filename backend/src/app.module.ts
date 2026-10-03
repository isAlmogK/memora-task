import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './auth/api-key.guard';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { OpenLibraryClient } from './catalog/open-library.client';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { LibraryController } from './library/library.controller';
import { LibraryService } from './library/library.service';
import { ProgressController } from './progress/progress.controller';
import { ProgressService } from './progress/progress.service';
import { StacksController } from './stacks/stacks.controller';
import { StatsController } from './stats/stats.controller';
import { PROGRESS_SOURCE } from './sync/progress-source';
import { SimulatedKindleSource } from './sync/simulated-kindle.source';
import { SyncController } from './sync/sync.controller';
import { SyncService } from './sync/sync.service';
import { SyncWorker } from './sync/sync.worker';
import { StatsService } from './stats/stats.service';
import { StacksService } from './stacks/stacks.service';

@Module({
  imports: [DbModule],
  controllers: [HealthController, CatalogController, LibraryController, StacksController, ProgressController, StatsController, SyncController],
  providers: [
    // Every route requires an API key unless it's marked @Public().
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    CatalogService,
    OpenLibraryClient,
    LibraryService,
    ProgressService,
    StacksService,
    StatsService,
    SyncService,
    SyncWorker,
    // swap this for a real adapter (KOReader, Kobo…) and nothing else changes
    { provide: PROGRESS_SOURCE, useClass: SimulatedKindleSource },
  ],
})
export class AppModule {}
