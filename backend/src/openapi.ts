import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** One definition of the contract, served at /docs and emitted to openapi.json. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Stacks API')
      .setDescription(
        'Reading tracker. Every route needs `Authorization: Bearer <key>`. Errors are always `{ error: { code, message, details? } }`.',
      )
      .setVersion('1')
      .addBearerAuth()
      .build(),
  );
}
