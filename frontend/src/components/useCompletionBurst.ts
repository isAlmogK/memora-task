import { useEffect, useRef, useState } from 'react';

/**
 * Returns a burst key for one render cycle when a stack crosses its goal while on screen
 * (a sync or "mark finished" completed it). Never fires on first render.
 */
export function useCompletionBurst(finishedCount: number, goal: number): number | null {
  const prev = useRef<boolean | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const complete = goal > 0 && finishedCount >= goal;
  useEffect(() => {
    const was = prev.current;
    prev.current = complete;
    if (was !== false || !complete) return;
    setBurst(Date.now());
    const t = setTimeout(() => setBurst(null), 1600);
    return () => clearTimeout(t);
  }, [complete]);
  return burst;
}
