import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

const PAPER = ['#f7f4ee', '#efe6d3', '#e8a33d', '#1b1b1b', '#d9cfbd'];

/**
 * A small burst of paper scraps. Mount it (with a new `burstKey`) to fire once;
 * position it inside a `relative` parent, it bursts from the centre.
 */
export function Confetti({ burstKey, pieces = 26 }: { burstKey: string | number; pieces?: number }) {
  const reduce = useReducedMotion();
  const scraps = useMemo(() => {
    // Seeded from the key so render stays pure: same burst, same scraps.
    const rand = seededRandom(String(burstKey));
    return Array.from({ length: pieces }, (_, i) => {
      const angle = (Math.PI * 2 * i) / pieces + rand() * 0.4;
      const dist = 70 + rand() * 90;
      return {
        id: `${burstKey}-${i}`,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.7 - 30,
        rotate: rand() * 540 - 270,
        w: 5 + rand() * 6,
        h: 3 + rand() * 4,
        color: PAPER[i % PAPER.length],
      };
    });
  }, [burstKey, pieces]);
  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-visible">
      {scraps.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-[1px] shadow-sm"
          style={{ width: s.w, height: s.h, backgroundColor: s.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: s.x, y: [0, s.y, s.y + 80], opacity: [1, 1, 0], rotate: s.rotate }}
          transition={{ duration: 1.5, ease: 'easeOut', times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}

/** Small deterministic PRNG (FNV-1a seed → mulberry32). */
function seededRandom(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
