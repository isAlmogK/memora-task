import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const openapi = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Stacks API').setVersion('1').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, openapi);

  await app.listen(config.port);
}

void bootstrap();
