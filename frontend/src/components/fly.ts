import { useAnimationControls } from 'motion/react';
import { createContext, useContext, useEffect } from 'react';

/** Rendering lives in <FlyProvider> (FlyLayer.tsx); these are the hooks pages use. */
export const FlyContext = createContext<(src: string | null, from: Element, target: string) => void>(() => {});
export const LANDED = 'stacks:fly-landed';

export const useFly = () => useContext(FlyContext);

/** Spread on a target: `<motion.div {...useFlyTarget('library')}>` — bounces when something lands. */
export function useFlyTarget(key: string) {
  const controls = useAnimationControls();
  useEffect(() => {
    const onLand = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== key) return;
      void controls.start({ scale: [1, 1.18, 0.94, 1], transition: { duration: 0.5 } });
    };
    window.addEventListener(LANDED, onLand);
    return () => window.removeEventListener(LANDED, onLand);
  }, [key, controls]);
  return { 'data-fly-target': key, animate: controls };
}
