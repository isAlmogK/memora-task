/**
 * One primary genre per book, from Open Library's free-form subjects. First matching rule
 * wins; the order matters (a sci-fi short-story collection is "Short stories"). It's a
 * heuristic: the seed snapshot pins the few titles it gets wrong.
 */
const RULES: [genre: string, pattern: RegExp][] = [
  ['Short stories', /short stories/i],
  ['Memoir', /biography|memoir|autobiography/i],
  ['Mystery & thriller', /detective|mystery|thriller|suspense|crime/i],
  ['Science fiction', /science fiction|space|dystopia|time travel/i],
  ['Fantasy', /fantasy|magic|mythology/i],
  ['Historical fiction', /historical fiction/i],
  ['Nonfiction', /history|science|psychology|anthropology|civilization/i],
];

export function genreOf(subjects: readonly string[]): string {
  // Nonfiction is judged on the whole book: a novel tagged "Fiction" and "History" is
  // still a novel (testing subjects one at a time called Ishiguro's novels nonfiction).
  // ("Nonfiction" contains "fiction"; Sapiens is tagged "graphic novels" for its comic edition)
  const fictional = subjects.some((s) => /(?<!non-?)fiction|(?<!graphic )novel/i.test(s));
  for (const [genre, pattern] of RULES) {
    if (genre === 'Nonfiction' && fictional) continue;
    if (subjects.some((s) => pattern.test(s))) return genre;
  }
  return 'Literary fiction';
}
