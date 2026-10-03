import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { config } from './config';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();

  SwaggerModule.setup('docs', app, createOpenApiDocument(app));

  await app.listen(config.port);
}

void bootstrap();
