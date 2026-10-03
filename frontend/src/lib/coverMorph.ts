import { useLocation } from 'react-router';

/**
 * A book can be on screen twice (Home shows it in the hero *and* the grid), and two
 * covers with the same `layoutId` confuse the morph. So each copy gets a scope, the
 * link carries that scope in router state, and the book page morphs from that copy.
 */
export type CoverScope = 'hero' | 'grid' | 'stack' | 'read';

export const coverLayoutId = (scope: CoverScope, libraryBookId: string) => `cover-${scope}-${libraryBookId}`;

/** Spread onto a `<Link>`: `<Link {...bookLink(id, 'grid')}>`. */
export const bookLink = (libraryBookId: string, scope: CoverScope) => ({
  to: `/books/${libraryBookId}`,
  state: { coverScope: scope },
});

export function useCoverScope(): CoverScope {
  const state = useLocation().state as { coverScope?: CoverScope } | null;
  return state?.coverScope ?? 'grid';
}
