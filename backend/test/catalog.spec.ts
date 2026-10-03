/** Search + add against a fake Open Library: no network in tests. */
import { eq } from 'drizzle-orm';
import { ApiError } from '../src/common/api-error';
import { CatalogEntry, OpenLibraryClient } from '../src/catalog/open-library.client';
import * as schema from '../src/db/schema';
import { as, createHarness, Fixture, Harness, KEYS, resetDb } from './harness';

const entry = (olWorkKey: string, title: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  olWorkKey,
  title,
  authors: ['Someone'],
  coverId: 1,
  pageCount: 300,
  firstPublishedYear: 2000,
  genre: 'Fantasy',
  ...extra,
});

const fake = {
  search: jest.fn<Promise<CatalogEntry[]>, [string, number]>(),
  getWork: jest.fn<Promise<CatalogEntry | null>, [string]>(),
};

let h: Harness;
let fx: Fixture;
const alice = () => as(h.app, KEYS.alice);

beforeAll(async () => {
  h = await createHarness((b) => b.overrideProvider(OpenLibraryClient).useValue(fake));
});
afterAll(() => h.close());
beforeEach(async () => {
  fx = await resetDb(h.db);
  fake.search.mockReset();
  fake.getWork.mockReset();
});

describe('GET /v1/catalog/search', () => {
  it('returns hits in relevance order, flagged when already in your library', async () => {
    const [ub] = await h.db.insert(schema.userBook).values({ userId: fx.alice, bookId: fx.books.dune }).returning();
    fake.search.mockResolvedValue([entry('OL100W', 'New book'), entry('OL893414W', 'Dune (as Open Library says it)')]);

    const res = await alice().get('/v1/catalog/search?q=%20dune%20').expect(200);
    expect(fake.search).toHaveBeenCalledWith('dune', 20); // trimmed, default limit
    expect((res.body as { olWorkKey: string }[]).map((b) => b.olWorkKey)).toEqual(['OL100W', 'OL893414W']);
    expect(res.body[0]).toMatchObject({ title: 'New book', libraryBookId: null, coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg' });
    expect(res.body[1].libraryBookId).toBe(ub!.id);

    // Bob searches the same thing: Alice's library doesn't leak into his flags
    const bob = await as(h.app, KEYS.bob).get('/v1/catalog/search?q=dune').expect(200);
    expect(bob.body[1].libraryBookId).toBeNull();
  });

  it('caches hits in the catalog without overwriting rows it already has', async () => {
    fake.search.mockResolvedValue([entry('OL893414W', 'Overwritten?', { genre: 'Mystery & thriller' }), entry('OL100W', 'New')]);
    await alice().get('/v1/catalog/search?q=dune').expect(200);

    const [dune] = await h.db.select().from(schema.book).where(eq(schema.book.olWorkKey, 'OL893414W'));
    expect([dune!.title, dune!.genre]).toEqual(['Dune', 'Science fiction']);
    // ...and the new one can be added right away, without another Open Library call
    await alice().post('/v1/library', { olWorkKey: 'OL100W' }).expect(201);
    expect(fake.getWork).not.toHaveBeenCalled();
  });

  it('validates q and limit', async () => {
    await alice().get('/v1/catalog/search').expect(400);
    await alice().get('/v1/catalog/search?q=a').expect(400);
    await alice().get('/v1/catalog/search?q=dune&limit=0').expect(400);
    await alice().get('/v1/catalog/search?q=dune&limit=abc').expect(400);
    expect(fake.search).not.toHaveBeenCalled();
  });

  it('turns an Open Library outage into a 502 with the usual error body', async () => {
    fake.search.mockRejectedValue(new ApiError(502, 'catalog_unavailable', 'Open Library didn’t answer.'));
    const res = await alice().get('/v1/catalog/search?q=dune').expect(502);
    expect(res.body.error.code).toBe('catalog_unavailable');
  });
});

describe('adding a work that was never searched', () => {
  it('imports it from Open Library, or 404s if it does not exist', async () => {
    fake.getWork.mockImplementation((key) => Promise.resolve(key === 'OL27448W' ? entry('OL27448W', 'The Lord of the Rings') : null));
    const res = await alice().post('/v1/library', { olWorkKey: 'OL27448W' }).expect(201);
    expect(res.body.book.title).toBe('The Lord of the Rings');

    const missing = await alice().post('/v1/library', { olWorkKey: 'OL1234567W' }).expect(404);
    expect(missing.body.error.code).toBe('book_not_found');
  });
});
