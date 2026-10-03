import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { genreOf } from './genre';

/** A work as we store it in the catalog (see the `book` table). */
export interface CatalogEntry {
  olWorkKey: string;
  title: string;
  authors: string[];
  coverId: number | null;
  pageCount: number | null;
  firstPublishedYear: number | null;
  genre: string;
}

interface SearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
  subject?: string[];
}

const BASE = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,subject';
const TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 300;

/**
 * Thin client for Open Library's search API (free, no key). The UI searches as you
 * type, so identical queries within 10 minutes are served from a small in-memory cache
 * instead of hitting a volunteer-run service again.
 */
@Injectable()
export class OpenLibraryClient {
  private readonly log = new Logger(OpenLibraryClient.name);
  private readonly cache = new Map<string, { at: number; entries: CatalogEntry[] }>();

  async search(rawQuery: string, limit: number): Promise<CatalogEntry[]> {
    const query = toPlainQuery(rawQuery);
    if (!query) return [];
    const cacheKey = `${limit}:${query.toLowerCase()}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.entries;

    const entries = await this.fetchDocs(new URLSearchParams({ q: query, fields: FIELDS, limit: String(limit) }));
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, { at: Date.now(), entries });
    if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value!); // oldest first
    return entries;
  }

  /** One work by key, or null if Open Library doesn't know it. */
  async getWork(olWorkKey: string): Promise<CatalogEntry | null> {
    const [entry] = await this.fetchDocs(new URLSearchParams({ q: `key:/works/${olWorkKey}`, fields: FIELDS, limit: '1' }));
    return entry?.olWorkKey === olWorkKey ? entry : null;
  }

  private async fetchDocs(params: URLSearchParams): Promise<CatalogEntry[]> {
    let body: { docs?: SearchDoc[] };
    try {
      const res = await fetch(`${BASE}?${params.toString()}`, {
        headers: { 'User-Agent': 'stacks-takehome/0.1 (reading tracker)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // 422 = "Invalid query": too short or only stopwords ("it", "the"). Typing passes
      // through those on the way to a real query; it means no results, not an outage.
      if (res.status === 422) return [];
      if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
      body = (await res.json()) as { docs?: SearchDoc[] };
    } catch (err) {
      this.log.warn(`search failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new ApiError(502, 'catalog_unavailable', 'Open Library didn’t answer. Try again in a moment.');
    }
    return (body.docs ?? []).flatMap(toEntry);
  }
}

/**
 * Open Library's q is Solr query syntax: "-dune" means NOT dune and answers 500, a stray
 * quote or bracket is a parse error. Users type titles, not queries, so syntax characters
 * become spaces.
 */
export function toPlainQuery(input: string): string {
  return input
    .replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drops docs we couldn't store (no work key or title); keeps at most two authors. */
function toEntry(doc: SearchDoc): CatalogEntry[] {
  const key = doc.key?.match(/^\/works\/(OL\d+W)$/)?.[1];
  if (!key || !doc.title) return [];
  return [
    {
      olWorkKey: key,
      title: doc.title,
      authors: [...new Set(doc.author_name ?? [])].slice(0, 2),
      coverId: doc.cover_i ?? null,
      pageCount: doc.number_of_pages_median && doc.number_of_pages_median > 0 ? doc.number_of_pages_median : null,
      firstPublishedYear: doc.first_publish_year ?? null,
      genre: genreOf(doc.subject ?? []),
    },
  ];
}
