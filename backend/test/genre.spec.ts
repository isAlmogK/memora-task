import { genreOf } from '../src/catalog/genre';

/** Open Library subjects are noisy; each case here is a real mistake the first rules made. */
describe('genreOf', () => {
  it.each([
    [['Fiction', 'History', 'Japan'], 'Literary fiction'], // was "Nonfiction": subjects tested one by one
    [['Non-Fiction', 'Civilization', 'Comics & graphic novels, adaptations'], 'Nonfiction'], // Sapiens
    [['Nonfiction', 'History'], 'Nonfiction'],
    [['Fiction, science fiction, general'], 'Science fiction'],
    [['Fiction, short stories (single author)', 'Science fiction'], 'Short stories'], // order matters
    [['Biography', 'Comedians'], 'Memoir'],
    [[], 'Literary fiction'],
  ])('%j → %s', (subjects, genre) => {
    expect(genreOf(subjects)).toBe(genre);
  });
});
