import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useState, type ReactNode } from 'react';
import { coverAt } from '../lib/coverSrc';
import { FlyContext, LANDED } from './fly';

/**
 * "Send this cover over there": a cover image flies in an arc from where you clicked
 * to any element marked `data-fly-target="<key>"`, which then bounces.
 */
interface Flight {
  id: number;
  src: string;
  from: DOMRect;
  to: DOMRect;
  target: string;
}


export function FlyProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const reduce = useReducedMotion();

  const fly = useCallback(
    (src: string | null, fromEl: Element, target: string) => {
      const toEl = document.querySelector(`[data-fly-target="${CSS.escape(target)}"]`);
      if (!toEl || !src || reduce) {
        window.dispatchEvent(new CustomEvent(LANDED, { detail: target }));
        return;
      }
      setFlights((f) => [...f, { id: Date.now(), src, from: fromEl.getBoundingClientRect(), to: toEl.getBoundingClientRect(), target }]);
    },
    [reduce],
  );

  function land(flight: Flight) {
    setFlights((f) => f.filter((x) => x.id !== flight.id));
    window.dispatchEvent(new CustomEvent(LANDED, { detail: flight.target }));
  }

  return (
    <FlyContext.Provider value={fly}>
      {children}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
        <AnimatePresence>
          {flights.map((f) => {
            const endX = f.to.left + f.to.width / 2 - f.from.width / 2;
            const endY = f.to.top + f.to.height / 2 - f.from.height / 2;
            const peakY = Math.min(f.from.top, f.to.top) - 120;
            return (
              <motion.img
                key={f.id}
                src={coverAt(f.src, 'M')} // the thumbnail size is already cached
                className="absolute rounded-[3px] object-cover shadow-xl"
                style={{ width: f.from.width, height: f.from.height, left: 0, top: 0 }}
                initial={{ x: f.from.left, y: f.from.top, scale: 1, rotate: 0 }}
                animate={{
                  x: [f.from.left, (f.from.left + endX) / 2, endX],
                  y: [f.from.top, peakY, endY],
                  scale: [1, 0.8, 0.22],
                  rotate: [0, -12, 8],
                }}
                transition={{ duration: 0.75, ease: [0.4, 0, 0.6, 1], times: [0, 0.45, 1] }}
                onAnimationComplete={() => land(f)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </FlyContext.Provider>
  );
}
