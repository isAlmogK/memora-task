import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { hashKey } from '../src/auth/api-key';
import { DB, type Db } from '../src/db/db.module';
import * as schema from '../src/db/schema';

export const KEYS = {
  alice: 'test-alice-user',
  aliceDevice: 'test-alice-device',
  aliceRevoked: 'test-alice-revoked',
  bob: 'test-bob-user',
};

export interface Harness {
  app: INestApplication<App>;
  db: Db;
  close: () => Promise<void>;
}

/** The real AppModule + the same pipes/filters as main.ts, against the test database. */
export async function createHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
  await app.init();
  return { app, db: app.get<Db>(DB), close: () => app.close() };
}

export interface Fixture {
  alice: string;
  bob: string;
  books: { dune: string; hailMary: string; noPages: string };
}

/** Wipes everything and inserts two users, their keys, and three catalog books. */
export async function resetDb(db: Db): Promise<Fixture> {
  await db.execute(sql`truncate app_user, book restart identity cascade`);
  const [alice, bob] = await db
    .insert(schema.appUser)
    .values([{ displayName: 'Alice' }, { displayName: 'Bob' }])
    .returning();
  await db.insert(schema.apiKey).values([
    { userId: alice!.id, keyHash: hashKey(KEYS.alice), scope: 'user', label: 'a' },
    { userId: alice!.id, keyHash: hashKey(KEYS.aliceDevice), scope: 'device', label: 'a-device' },
    { userId: alice!.id, keyHash: hashKey(KEYS.aliceRevoked), scope: 'user', label: 'a-old', revokedAt: new Date() },
    { userId: bob!.id, keyHash: hashKey(KEYS.bob), scope: 'user', label: 'b' },
  ]);
  const books = await db
    .insert(schema.book)
    .values([
      { olWorkKey: 'OL893414W', title: 'Dune', authors: ['Frank Herbert'], pageCount: 600, genre: 'Science fiction' },
      { olWorkKey: 'OL21745884W', title: 'Project Hail Mary', authors: ['Andy Weir'], pageCount: 500, genre: 'Science fiction' },
      { olWorkKey: 'OL1W', title: 'No Pages', authors: [], pageCount: null },
    ])
    .returning();
  return {
    alice: alice!.id,
    bob: bob!.id,
    books: { dune: books[0]!.id, hailMary: books[1]!.id, noPages: books[2]!.id },
  };
}

/** supertest with a bearer key already set. */
export function as(app: INestApplication<App>, key: string) {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${key}`);
  const server = app.getHttpServer();
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string, body?: object) => auth(request(server).post(url)).send(body),
    patch: (url: string, body?: object) => auth(request(server).patch(url)).send(body),
    put: (url: string) => auth(request(server).put(url)),
    delete: (url: string) => auth(request(server).delete(url)),
  };
}

export const DAY = 86_400_000;
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
