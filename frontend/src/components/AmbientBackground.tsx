import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect, type CSSProperties } from 'react';
import { useAmbientPalette } from './ambient';

/** Position, size and how strongly each blob follows the cursor (parallax depth, px). */
const BLOBS = [
  { className: 'left-[-12vw] top-[-18vh] size-[58vw]', depth: 70 },
  { className: 'right-[-14vw] top-[8vh] size-[50vw]', depth: -50 },
  { className: 'bottom-[-24vh] left-[18vw] size-[54vw]', depth: 35 },
];

// Fine film grain so the gradients don't band and the page has some texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Soft colour blobs tinted from the book in focus, a light that follows the cursor, and
 * blobs that shift with it (parallax). Nothing animates on its own: measured, a
 * perpetual drift cost a third of the frame budget while scrolling (the header's backdrop
 * blur has to be recomputed every frame something moves beneath it). Now the background
 * only moves when you do, and only via transforms.
 */
export function AmbientBackground() {
  const colors = useAmbientPalette();
  const reduce = useReducedMotion();
  const x = useMotionValue(typeof window === 'undefined' ? 0 : window.innerWidth / 2);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 90, damping: 22 });
  const sy = useSpring(y, { stiffness: 90, damping: 22 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, x, y]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-paper">
      {BLOBS.map((b, i) => (
        <Blob key={i} className={b.className} color={colors[i]!} depth={reduce ? 0 : b.depth} sx={sx} sy={sy} />
      ))}
      {!reduce && (
        <motion.div
          className="absolute left-0 top-0 size-[1040px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.55),transparent_65%)] will-change-transform"
          style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
        />
      )}
      <div className="absolute inset-0 opacity-[0.09] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

function Blob({ className, color, depth, sx, sy }: {
  className: string;
  color: string;
  depth: number;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
}) {
  // Cursor offset from the viewport centre, -0.5..0.5, scaled by this blob's depth.
  const px = useTransform(sx, (v) => (v / window.innerWidth - 0.5) * depth);
  const py = useTransform(sy, (v) => (v < 0 ? 0 : (v / window.innerHeight - 0.5) * depth));
  return (
    <motion.div className={`absolute opacity-70 will-change-transform ${className}`} style={{ x: px, y: py }}>
      <div className="blob size-full rounded-full" style={{ '--blob': color } as CSSProperties} />
    </motion.div>
  );
}
