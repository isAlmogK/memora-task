import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowIcon } from './icons';

const CLASS = 'group inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink';

/** "← Stacks" to a fixed place, or (without `to`) back through history, falling back to Home. */
export function BackLink({ to, children = 'Back' }: { to?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const arrow = (
    <span className="transition-transform group-hover:-translate-x-0.5">
      <ArrowIcon dir="left" width={15} height={15} />
    </span>
  );
  if (to) {
    return (
      <Link to={to} className={CLASS}>
        {arrow}
        {children}
      </Link>
    );
  }
  // React Router keeps its own history index; > 0 means there's an in-app page to go back to.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  return (
    <button onClick={() => (canGoBack ? navigate(-1) : navigate('/'))} className={CLASS}>
      {arrow}
      {children}
    </button>
  );
}
