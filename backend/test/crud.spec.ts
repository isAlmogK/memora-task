/** Library and stack CRUD through the HTTP API: status codes, validation, cascades. */
import { as, createHarness, Harness, KEYS, resetDb } from './harness';

let h: Harness;
const alice = () => as(h.app, KEYS.alice);

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await resetDb(h.db);
});

describe('library', () => {
  it('adds a catalog book (201), refuses a duplicate (409) and an unknown work (404)', async () => {
    const res = await alice().post('/v1/library', { olWorkKey: 'OL893414W' }).expect(201);
    expect(res.body).toMatchObject({ status: 'want_to_read', book: { title: 'Dune', pageCount: 600 }, progress: { percent: 0 } });

    const dup = await alice().post('/v1/library', { olWorkKey: 'OL893414W' }).expect(409);
    expect(dup.body.error.code).toBe('already_in_library');

    await alice().post('/v1/library', { olWorkKey: 'OL999999999W' }).expect(404);
  });

  it('rejects garbage with 400 and field-level details', async () => {
    const res = await alice().post('/v1/library', { olWorkKey: 42, extra: true }).expect(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(Object.keys(res.body.error.details as object).sort()).toEqual(['extra', 'olWorkKey']);
    await alice().get('/v1/library/not-a-uuid').expect(400);
    await alice().get('/v1/library?status=nope').expect(400);
  });

  it('logs progress by page or percent (exactly one), converting pages to percent', async () => {
    const { body: book } = await alice().post('/v1/library', { olWorkKey: 'OL893414W' });
    const res = await alice().post(`/v1/library/${book.id}/progress`, { page: 150 }).expect(201);
    expect(res.body.progress).toMatchObject({ percent: 25, page: 150, source: 'manual' });
    expect(res.body.status).toBe('reading');
    expect(res.body.events).toHaveLength(1);

    await alice().post(`/v1/library/${book.id}/progress`, { page: 1, percent: 1 }).expect(400);
    await alice().post(`/v1/library/${book.id}/progress`, {}).expect(400);
    await alice().post(`/v1/library/${book.id}/progress`, { percent: 101 }).expect(400);
    await alice().post(`/v1/library/${book.id}/progress`, { page: 601 }).expect(400);
  });

  it('refuses a page for a book without a page count', async () => {
    const { body: book } = await alice().post('/v1/library', { olWorkKey: 'OL1W' });
    const res = await alice().post(`/v1/library/${book.id}/progress`, { page: 3 }).expect(400);
    expect(res.body.error.code).toBe('page_unsupported');
  });

  it('marks finished and puts down via PATCH, and filters by derived status', async () => {
    const { body: a } = await alice().post('/v1/library', { olWorkKey: 'OL893414W' });
    const { body: b } = await alice().post('/v1/library', { olWorkKey: 'OL21745884W' });
    await alice().patch(`/v1/library/${a.id}`, { finished: true }).expect(200);
    await alice().patch(`/v1/library/${b.id}`, { abandoned: true }).expect(200);
    await alice().patch(`/v1/library/${b.id}`, {}).expect(400);

    const finished = (await alice().get('/v1/library?status=finished')).body as { id: string }[];
    expect(finished.map((x) => x.id)).toEqual([a.id]);
    const down = (await alice().get('/v1/library?status=abandoned')).body as { id: string }[];
    expect(down.map((x) => x.id)).toEqual([b.id]);
  });

  it('deletes (204), then 404s, and the book leaves every stack', async () => {
    const { body: book } = await alice().post('/v1/library', { olWorkKey: 'OL893414W' });
    const { body: stack } = await alice().post('/v1/stacks', { name: 'Pile' });
    await alice().put(`/v1/stacks/${stack.id}/books/${book.id}`).expect(200);

    await alice().delete(`/v1/library/${book.id}`).expect(204);
    await alice().get(`/v1/library/${book.id}`).expect(404);
    await alice().delete(`/v1/library/${book.id}`).expect(404);
    expect((await alice().get(`/v1/stacks/${stack.id}`)).body.bookCount).toBe(0);
  });
});

describe('stacks', () => {
  it('creates with trimmed names, unique per user regardless of case', async () => {
    const res = await alice().post('/v1/stacks', { name: '  Booker winners ', targetCount: 4, dueOn: '2026-11-30' }).expect(201);
    expect(res.body).toMatchObject({ name: 'Booker winners', targetCount: 4, dueOn: '2026-11-30', bookCount: 0 });

    const dup = await alice().post('/v1/stacks', { name: 'booker WINNERS' }).expect(409);
    expect(dup.body.error.code).toBe('stack_name_taken');
    // a different user may use the same name
    await as(h.app, KEYS.bob).post('/v1/stacks', { name: 'Booker winners' }).expect(201);
  });

  it('validates every field with a message per field', async () => {
    const res = await alice().post('/v1/stacks', { name: '', targetCount: 0, dueOn: '31/12/2026' }).expect(400);
    expect(Object.keys(res.body.error.details as object).sort()).toEqual(['dueOn', 'name', 'targetCount']);
  });

  it('patches fields, null clears optional ones, name cannot be nulled', async () => {
    const { body: s } = await alice().post('/v1/stacks', { name: 'A', targetCount: 3, dueOn: '2027-01-01' });
    const res = await alice().patch(`/v1/stacks/${s.id}`, { targetCount: null, dueOn: null, description: 'x' }).expect(200);
    expect(res.body).toMatchObject({ targetCount: null, dueOn: null, description: 'x', onTrack: null });
    await alice().patch(`/v1/stacks/${s.id}`, { name: null }).expect(400);
  });

  it('keeps stack order, and add/remove are idempotent', async () => {
    const { body: s } = await alice().post('/v1/stacks', { name: 'Order' });
    const { body: a } = await alice().post('/v1/library', { olWorkKey: 'OL21745884W' });
    const { body: b } = await alice().post('/v1/library', { olWorkKey: 'OL893414W' });
    await alice().put(`/v1/stacks/${s.id}/books/${a.id}`).expect(200);
    await alice().put(`/v1/stacks/${s.id}/books/${b.id}`).expect(200);
    const again = await alice().put(`/v1/stacks/${s.id}/books/${a.id}`).expect(200);
    expect((again.body.books as { id: string }[]).map((x) => x.id)).toEqual([a.id, b.id]);

    await alice().delete(`/v1/stacks/${s.id}/books/${a.id}`).expect(200);
    const after = await alice().delete(`/v1/stacks/${s.id}/books/${a.id}`).expect(200);
    expect(after.body.bookCount).toBe(1);
  });

  it('deleting a stack keeps its books in the library', async () => {
    const { body: s } = await alice().post('/v1/stacks', { name: 'Gone' });
    const { body: book } = await alice().post('/v1/library', { olWorkKey: 'OL893414W' });
    await alice().put(`/v1/stacks/${s.id}/books/${book.id}`);
    await alice().delete(`/v1/stacks/${s.id}`).expect(204);
    await alice().get(`/v1/stacks/${s.id}`).expect(404);
    await alice().get(`/v1/library/${book.id}`).expect(200);
  });
});

describe('reordering and moving books', () => {
  const libraryIds = new Map<string, string>();
  beforeEach(() => libraryIds.clear());

  async function stackWith(name: string, keys: string[]) {
    const { body: s } = await alice().post('/v1/stacks', { name });
    const ids: string[] = [];
    for (const k of keys) {
      const res = await alice().post('/v1/library', { olWorkKey: k });
      if (res.status === 201) libraryIds.set(k, res.body.id as string); // 409: added by an earlier stack
      const id = libraryIds.get(k)!;
      await alice().put(`/v1/stacks/${s.id}/books/${id}`).expect(200);
      ids.push(id);
    }
    return { stackId: s.id as string, ids };
  }
  const order = (body: { books: { id: string }[] }) => body.books.map((b) => b.id);

  it('reorders when sent every book exactly once, and the order sticks', async () => {
    const { stackId, ids } = await stackWith('Pile', ['OL893414W', 'OL21745884W', 'OL1W']);
    const reversed = [...ids].reverse();
    const res = await alice().put(`/v1/stacks/${stackId}/order`).send({ libraryBookIds: reversed }).expect(200);
    expect(order(res.body)).toEqual(reversed);
    expect(order((await alice().get(`/v1/stacks/${stackId}`)).body)).toEqual(reversed);
    // the fan preview follows the new order too
    expect((res.body.preview as { libraryBookId: string }[]).map((p) => p.libraryBookId)).toEqual(reversed);
  });

  it('rejects a stale or partial order instead of half-applying it', async () => {
    const { stackId, ids } = await stackWith('Pile', ['OL893414W', 'OL21745884W']);
    for (const bad of [[ids[0]], [ids[0], ids[0]], [...ids, '00000000-0000-0000-0000-000000000000'], ['nope']]) {
      await alice().put(`/v1/stacks/${stackId}/order`).send({ libraryBookIds: bad }).expect(400);
    }
    expect(order((await alice().get(`/v1/stacks/${stackId}`)).body)).toEqual(ids);
  });

  it('moves a book to the end of another stack in one step', async () => {
    const a = await stackWith('From', ['OL893414W', 'OL21745884W']);
    const b = await stackWith('To', ['OL1W']);
    const res = await alice().post(`/v1/stacks/${a.stackId}/books/${a.ids[0]}/move`, { toStackId: b.stackId }).expect(200);
    expect(order(res.body.from)).toEqual([a.ids[1]]);
    expect(order(res.body.to)).toEqual([b.ids[0], a.ids[0]]);
  });

  it('moving into a stack that already has the book just takes it out of the source', async () => {
    const a = await stackWith('From', ['OL893414W']);
    const b = await stackWith('To', ['OL893414W']);
    const res = await alice().post(`/v1/stacks/${a.stackId}/books/${a.ids[0]}/move`, { toStackId: b.stackId }).expect(200);
    expect([res.body.from.bookCount, res.body.to.bookCount]).toEqual([0, 1]);
  });

  it('404s for a book not in the source stack or a stack that is not yours, and changes nothing', async () => {
    const a = await stackWith('From', ['OL893414W']);
    const b = await stackWith('To', []);
    const { body: bobStack } = await as(h.app, KEYS.bob).post('/v1/stacks', { name: 'Bob' });

    await alice().post(`/v1/stacks/${b.stackId}/books/${a.ids[0]}/move`, { toStackId: a.stackId }).expect(404);
    await alice().post(`/v1/stacks/${a.stackId}/books/${a.ids[0]}/move`, { toStackId: bobStack.id }).expect(404);
    await as(h.app, KEYS.bob).post(`/v1/stacks/${a.stackId}/books/${a.ids[0]}/move`, { toStackId: bobStack.id }).expect(404);
    await alice().post(`/v1/stacks/${a.stackId}/books/${a.ids[0]}/move`, { toStackId: a.stackId }).expect(400);

    expect((await alice().get(`/v1/stacks/${a.stackId}`)).body.bookCount).toBe(1);
  });
});
