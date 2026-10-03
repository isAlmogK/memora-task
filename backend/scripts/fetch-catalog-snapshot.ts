// One-off: pulls metadata for the seed books from Open Library into a committed JSON
// snapshot, so `npm run db:seed` (and the frontend mock) never need the network.
//   npx tsx scripts/fetch-catalog-snapshot.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { genreOf } from '../src/catalog/genre';

const BOOKS: [title: string, author: string][] = [
  ['Project Hail Mary', 'Andy Weir'],
  ['The Martian', 'Andy Weir'],
  ['Dune', 'Frank Herbert'],
  ['Klara and the Sun', 'Kazuo Ishiguro'],
  ['Piranesi', 'Susanna Clarke'],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin'],
  ['Station Eleven', 'Emily St. John Mandel'],
  ['Sea of Tranquility', 'Emily St. John Mandel'],
  ['Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin'],
  ['Babel', 'R. F. Kuang'],
  ['The Remains of the Day', 'Kazuo Ishiguro'],
  ['Never Let Me Go', 'Kazuo Ishiguro'],
  ['Children of Time', 'Adrian Tchaikovsky'],
  ['A Memory Called Empire', 'Arkady Martine'],
  ['Exhalation', 'Ted Chiang'],
  ['Hyperion', 'Dan Simmons'],
  ['Orbital', 'Samantha Harvey'],
  ['Prophet Song', 'Paul Lynch'],
  ['Demon Copperhead', 'Barbara Kingsolver'],
  ['The Overstory', 'Richard Powers'],
  // finished earlier in the year: gives the stats page a real history
  ['The Night Circus', 'Erin Morgenstern'],
  ['Circe', 'Madeline Miller'],
  ['Educated', 'Tara Westover'],
  ['Sapiens', 'Yuval Noah Harari'],
  ['The Thursday Murder Club', 'Richard Osman'],
  ['Gone Girl', 'Gillian Flynn'],
  ['Recursion', 'Blake Crouch'],
  ['The Midnight Library', 'Matt Haig'],
  ['Lessons in Chemistry', 'Bonnie Garmus'],
  ['The Song of Achilles', 'Madeline Miller'],
  ['Dark Matter', 'Blake Crouch'],
  ['Born a Crime', 'Trevor Noah'],
];
// Open Library data is community-edited and edition-merged; these are the
// corrections found by eyeballing the first run (translators listed as authors,
// first_publish_year taken from an unrelated edition, etc.).
const OVERRIDES: Record<string, Partial<{ authors: string[]; firstPublishedYear: number; genre: string }>> = {
  Babel: { authors: ['R. F. Kuang'] },
  'Sea of Tranquility': { firstPublishedYear: 2022 },
  Exhalation: { firstPublishedYear: 2019 },
  // subjects mention "suspense"/"magic", which the rules read as the wrong genre
  'Project Hail Mary': { genre: 'Science fiction' },
  'The Martian': { genre: 'Science fiction' },
  'The Midnight Library': { genre: 'Literary fiction' },
};
const FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year';
interface Doc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
}

const OUT = resolve(__dirname, '../src/db/seed/openlibrary-snapshot.json');

async function main() {
  const books: object[] = [];
  for (const [title, author] of BOOKS) {
    const params = new URLSearchParams({ title, author, fields: FIELDS, limit: '1' });
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
      headers: { 'User-Agent': 'stacks-takehome/0.1 (seed snapshot)' },
    });
    const doc = ((await res.json()) as { docs?: Doc[] }).docs?.[0];
    if (!doc) {
      console.warn(`no match: ${title}`);
      continue;
    }
    const work = (await (await fetch(`https://openlibrary.org${doc.key}.json`)).json()) as { subjects?: string[] };
    books.push({
      olWorkKey: doc.key.split('/').pop(),
      genre: genreOf(work.subjects ?? []),
      title: doc.title,
      authors: [...new Set(doc.author_name ?? [author])].slice(0, 2),
      coverId: doc.cover_i ?? null,
      pageCount: doc.number_of_pages_median ?? null,
      firstPublishedYear: doc.first_publish_year ?? null,
      ...(OVERRIDES[title] ?? {}),
    });
    console.log(doc.title, '→', (books.at(-1) as { genre: string }).genre);
  }
  await writeFile(OUT, JSON.stringify(books, null, 2) + '\n');
  console.log(`wrote ${books.length} books`);
}

void main();
