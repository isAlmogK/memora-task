import { createContext } from 'react';

/** Provided by <SearchProvider> (SearchOverlay.tsx). */
export const SearchContext = createContext<{ open: (q?: string) => void; close: () => void }>({
  open: () => {},
  close: () => {},
});
