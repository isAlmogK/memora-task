import { ApiError } from '../src/common/api-error';
import { OpenLibraryClient, toPlainQuery } from '../src/catalog/open-library.client';

/** The client's contract with a flaky upstream: what's "no results" and what's an outage. */
describe('OpenLibraryClient', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  const reply = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it('treats 422 (stopword-only or too-short query, e.g. "the") as no results', async () => {
    fetchMock.mockReturnValue(reply(422, { detail: [{ msg: 'Invalid query' }] }));
    await expect(new OpenLibraryClient().search('the', 20)).resolves.toEqual([]);
  });

  it('turns a 5xx or a network failure into 502 catalog_unavailable', async () => {
    fetchMock.mockReturnValueOnce(reply(500)).mockRejectedValueOnce(new TypeError('fetch failed'));
    const client = new OpenLibraryClient();
    await expect(client.search('dune', 20)).rejects.toMatchObject({ code: 'catalog_unavailable' });
    await expect(client.search('dune messiah', 20)).rejects.toBeInstanceOf(ApiError);
  });

  it('maps docs, drops unusable ones, and caches identical queries', async () => {
    fetchMock.mockReturnValue(
      reply(200, {
        docs: [
          { key: '/works/OL1W', title: 'Kept', author_name: ['A', 'A', 'B', 'C'], subject: ['Fantasy'], number_of_pages_median: 0 },
          { key: '/books/OL2M', title: 'An edition, not a work' },
          { key: '/works/OL3W' },
        ],
      }),
    );
    const client = new OpenLibraryClient();
    const first = await client.search('Kept', 20);
    expect(first).toEqual([
      { olWorkKey: 'OL1W', title: 'Kept', authors: ['A', 'B'], coverId: null, pageCount: null, firstPublishedYear: null, genre: 'Fantasy' },
    ]);
    await client.search('  kept ', 20);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('strips query syntax: users type titles, not Solr queries', async () => {
    expect(toPlainQuery('-dune')).toBe('dune'); // "NOT dune" → upstream 500
    expect(toPlainQuery('"dune (novel)" ')).toBe('dune novel');
    expect(toPlainQuery('sci-fi: the best!')).toBe('sci fi the best');
    expect(toPlainQuery("j.k. rowling's")).toBe("j.k. rowling's");

    fetchMock.mockReturnValue(reply(200, { docs: [] }));
    await expect(new OpenLibraryClient().search('!!', 20)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing left to search for
  });
});
