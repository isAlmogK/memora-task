import { useContext, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { SearchContext } from '../components/search';

/** Search is an overlay now; `/search?q=…` links still work by opening it over Home. */
export function SearchRedirect() {
  const { open } = useContext(SearchContext);
  const [params] = useSearchParams();
  const q = params.get('q') ?? undefined;
  useEffect(() => {
    open(q);
  }, [open, q]);
  return <Navigate to="/" replace />;
}
