import { useEffect, useSyncExternalStore } from 'react';
import { coverPalette } from '../lib/coverPalette';
import { coverAt } from '../lib/coverSrc';

/** The colours behind the whole app. Pages tint it from the book that's in focus. */
const DEFAULT = ['hsl(28 90% 68%)', 'hsl(262 70% 74%)', 'hsl(196 80% 66%)'];

let palette = DEFAULT;
const listeners = new Set<() => void>();

function setPalette(next: string[]) {
  // Fewer than 3 colours (a near-monochrome cover): fill from the default.
  palette = [0, 1, 2].map((i) => next[i] ?? DEFAULT[i]!);
  listeners.forEach((l) => l());
}

export function useAmbientPalette(): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => palette,
  );
}

/** Tint the background from this cover. The last tint stays when the page unmounts. */
export function useAmbientFrom(coverUrl: string | null | undefined) {
  useEffect(() => {
    if (!coverUrl) return;
    let live = true;
    void coverPalette(coverAt(coverUrl, 'M')).then((colors) => {
      if (live && colors.length) setPalette(colors);
    });
    return () => {
      live = false;
    };
  }, [coverUrl]);
}
