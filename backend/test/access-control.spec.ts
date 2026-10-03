/**
 * The access-control guarantee: keys are checked for real, scopes are enforced, and one
 * user can never see or touch another's data (404, not 403, so ids don't leak). The last
 * test goes under the API: the database itself refuses a cross-user stack membership.
 */
import request from 'supertest';
import * as schema from '../src/db/schema';
import { as, createHarness, Fixture, Harness, KEYS, resetDb } from './harness';

let h: Harness;
let fx: Fixture;
let aliceBook: string;
let aliceStack: string;
let bobStack: string;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  fx = await resetDb(h.db);
  const [ub] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning();
  const [as1] = await h.db.insert(schema.stack).values({ userId: fx.alice, name: 'Alice stack' }).returning();
  const [bs] = await h.db.insert(schema.stack).values({ userId: fx.bob, name: 'Bob stack' }).returning();
  aliceBook = ub!.id;
  aliceStack = as1!.id;
  bobStack = bs!.id;
});

describe('API keys', () => {
  it('rejects a missing key with 401', async () => {
    const res = await request(h.app.getHttpServer()).get('/v1/library').expect(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects unknown and revoked keys with 401', async () => {
    await as(h.app, 'not-a-key').get('/v1/library').expect(401);
    const res = await as(h.app, KEYS.aliceRevoked).get('/v1/library').expect(401);
    expect(res.body.error.code).toBe('invalid_api_key');
  });

  it('keeps device keys to the ingest endpoint (403 elsewhere), and user keys off it', async () => {
    const device = as(h.app, KEYS.aliceDevice);
    await device.get('/v1/library').expect(403);
    await device.get('/v1/stacks').expect(403);
    await as(h.app, KEYS.alice).post('/v1/progress-events', {}).expect(403);
  });

  it('lets the health check through without a key', async () => {
    await request(h.app.getHttpServer()).get('/v1/health').expect(200);
  });
});

describe("another user's data", () => {
  it("is 404 on every route for Alice's book", async () => {
    const bob = as(h.app, KEYS.bob);
    await bob.get(`/v1/library/${aliceBook}`).expect(404);
    await bob.patch(`/v1/library/${aliceBook}`, { finished: true }).expect(404);
    await bob.post(`/v1/library/${aliceBook}/progress`, { percent: 10 }).expect(404);
    await bob.delete(`/v1/library/${aliceBook}`).expect(404);
  });

  it("is 404 on every route for Alice's stack", async () => {
    const bob = as(h.app, KEYS.bob);
    await bob.get(`/v1/stacks/${aliceStack}`).expect(404);
    await bob.patch(`/v1/stacks/${aliceStack}`, { name: 'mine now' }).expect(404);
    await bob.delete(`/v1/stacks/${aliceStack}`).expect(404);
  });

  it('never shows up in lists', async () => {
    const bob = as(h.app, KEYS.bob);
    expect((await bob.get('/v1/library').expect(200)).body).toEqual([]);
    const stacks = (await bob.get('/v1/stacks').expect(200)).body as { id: string }[];
    expect(stacks.map((s) => s.id)).toEqual([bobStack]);
  });

  it("can't be pushed to by someone else's device", async () => {
    // Alice's device key, Bob's book: same 404 as a book that doesn't exist.
    const [bobBook] = await h.db.insert(schema.userBook).values({ userId: fx.bob, bookId: fx.books.hailMary }).returning();
    await as(h.app, KEYS.aliceDevice)
      .post('/v1/progress-events', { libraryBookId: bobBook!.id, percent: 5, occurredAt: new Date().toISOString(), externalId: 'x' })
      .expect(404);
  });

  it("can't be put into your own stack: the API says 404 and the database refuses too", async () => {
    await as(h.app, KEYS.bob).put(`/v1/stacks/${bobStack}/books/${aliceBook}`).expect(404);

    // Bypass the API entirely: Bob's stack + Alice's library book violates the composite FK.
    const insert = h.db.insert(schema.stackBook).values({ userId: fx.bob, stackId: bobStack, userBookId: aliceBook, position: 1 });
    await expect(insert).rejects.toMatchObject({ cause: { code: '23503', constraint: 'stack_book_user_book_fk' } });
  });
});
