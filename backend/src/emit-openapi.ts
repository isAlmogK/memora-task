// Writes openapi.json for the frontend's type generator (npm run openapi).
// Compiled with tsc rather than run through tsx: Swagger reads the decorator metadata
// that only tsc emits.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createOpenApiDocument } from './openapi';

async function emit() {
  const app = configureApp(await NestFactory.create(AppModule, { logger: false }));
  const out = resolve(process.cwd(), 'openapi.json');
  writeFileSync(out, JSON.stringify(createOpenApiDocument(app), null, 2) + '\n');
  await app.close();
  console.log(`wrote ${out}`);
}

void emit();
