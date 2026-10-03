import type { INestApplication } from '@nestjs/common';
import { ErrorFilter } from './common/error.filter';
import { validationPipe } from './common/validation';

/** Shared by main.ts and the integration tests, so tests exercise the real pipeline. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(validationPipe);
  app.useGlobalFilters(new ErrorFilter());
  return app;
}
