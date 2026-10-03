import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();

  const openapi = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Stacks API').setVersion('1').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, openapi);

  await app.listen(config.port);
}

void bootstrap();
