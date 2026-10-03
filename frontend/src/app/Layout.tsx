import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router';
import { AmbientBackground } from '../components/AmbientBackground';
import { isMock } from '../api/client';
import { usePrefetchOnIntent } from '../api/queries';
import { MockPanel } from '../components/MockPanel';
import { SearchButton, SearchProvider } from '../components/SearchOverlay';
import { SyncButton } from '../components/SyncButton';
import { useFlyTarget } from '../components/fly';
import { SearchIcon } from '../components/icons';
import { cx } from '../lib/cx';
import { page } from '../motion/presets';

const NAV = [
  { to: '/', label: 'Reading', end: true, fly: 'library' },
  { to: '/stacks', label: 'Stacks', end: false, fly: 'stacks' },
] as const;

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  usePrefetchOnIntent();

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollTo, and React treats a returned value as cleanup.
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <SearchProvider>
    <div className="min-h-dvh">
      <AmbientBackground />
      <header className="sticky top-0 z-30 border-b border-white/50 bg-paper/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
          <NavLink to="/" className="font-display text-2xl font-semibold tracking-tight">
            stacks<span className="text-accent">.</span>
          </NavLink>
          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
            <SearchButton className="ml-2 flex items-center gap-2 rounded-full bg-white/50 py-1.5 pl-3 pr-1.5 text-muted ring-1 ring-ink/[0.08] transition-colors hover:text-ink">
              <SearchIcon width={15} height={15} /> Search
              <kbd className="hidden rounded-md bg-ink/[0.06] px-1.5 py-0.5 font-sans text-[0.7rem] sm:inline">⌘K</kbd>
            </SearchButton>
          </nav>
          <div className="ml-auto">
            <SyncButton />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={location.pathname} variants={page} initial="initial" animate="enter" exit="exit">
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      {isMock && <MockPanel />}
    </div>
    </SearchProvider>
  );
}

function NavItem({ to, label, end, fly }: { to: string; label: string; end: boolean; fly: string }) {
  const target = useFlyTarget(fly);
  return (
    <NavLink to={to} end={end} className="relative px-3 py-1.5">
      {({ isActive }) => (
        <motion.span {...target} className={cx('relative inline-block transition-colors', isActive ? 'text-ink' : 'text-muted hover:text-ink')}>
          {label}
          {isActive && <motion.span layoutId="nav-underline" className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-ink" />}
        </motion.span>
      )}
    </NavLink>
  );
}
