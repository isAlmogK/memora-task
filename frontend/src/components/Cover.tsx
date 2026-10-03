import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useState, type PointerEvent } from 'react';
import type { BookDto } from '../api/types';
import { coverAt, isCached } from '../lib/coverSrc';
import { cx } from '../lib/cx';
import { spring } from '../motion/presets';

const SIZES = {
  xs: 'w-10',
  sm: 'w-20',
  md: 'w-28',
  lg: 'w-40',
  xl: 'w-56 sm:w-64',
} as const;

interface CoverProps {
  book: Pick<BookDto, 'title' | 'authors' | 'coverUrl'>;
  size?: keyof typeof SIZES;
  /** Shared-element id; the same id on two screens makes the cover fly between them. */
  layoutId?: string;
  /** 3D tilt that follows the cursor, with a light sheen. */
  tilt?: boolean;
  className?: string;
}

export function Cover({ book, size = 'md', layoutId, tilt = false, className }: CoverProps) {
  const reduce = useReducedMotion();
  const big = size === 'lg' || size === 'xl';
  const thumb = book.coverUrl ? coverAt(book.coverUrl, 'M') : null;
  const full = big && book.coverUrl ? coverAt(book.coverUrl, 'L') : null;
  // Already-cached images skip the fade, so a cover that morphs to a new page never blinks.
  const [thumbReady, setThumbReady] = useState(() => (thumb ? isCached(thumb) : false));
  const [fullReady, setFullReady] = useState(() => (full ? isCached(full) : false));
  const [failed, setFailed] = useState(false);

  // Pointer position inside the cover, -0.5..0.5 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring.tilt);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), spring.tilt);
  const sheenX = useTransform(px, [-0.5, 0.5], ['0%', '100%']);
  const sheenY = useTransform(py, [-0.5, 0.5], ['0%', '100%']);
  const sheen = useMotionTemplate`radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.38), transparent 55%)`;
  const tiltOn = tilt && !reduce;

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!tiltOn || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  const showImage = book.coverUrl && !failed;

  return (
    <div className={cx(SIZES[size], 'shrink-0 [perspective:900px]', className)}>
      <motion.div
        layoutId={layoutId}
        transition={spring.morph}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={tiltOn ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
        className="relative aspect-[2/3] overflow-hidden rounded-[3px] bg-paper-deep shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_24px_-12px_rgba(0,0,0,0.45)]"
      >
        {showImage ? (
          <>
            <img
              src={thumb!}
              alt={`Cover of ${book.title}`}
              loading={big ? 'eager' : 'lazy'}
              decoding="async"
              crossOrigin="anonymous" // same cache entry the ambient colour sampler reads
              draggable={false}
              onLoad={() => setThumbReady(true)}
              onError={() => setFailed(true)}
              className={cx('h-full w-full object-cover transition-opacity duration-300', thumbReady ? 'opacity-100' : 'opacity-0')}
            />
            {full && (
              <img
                src={full}
                alt=""
                aria-hidden
                fetchPriority={size === 'xl' ? 'high' : 'auto'}
                decoding="async"
                draggable={false}
                onLoad={() => setFullReady(true)}
                className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', fullReady ? 'opacity-100' : 'opacity-0')}
              />
            )}
          </>
        ) : (
          <TypographicCover title={book.title} author={book.authors[0]} />
        )}
        {/* spine crease, like a real paperback */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/20 via-white/10 to-transparent" />
        {tiltOn && <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: sheen }} />}
      </motion.div>
    </div>
  );
}

function TypographicCover({ title, author }: { title: string; author?: string }) {
  return (
    <div className="flex h-full flex-col justify-between p-[10%] text-ink">
      <span className="font-display text-[clamp(0.6rem,1.4vw,1.1rem)] leading-tight">{title}</span>
      {author && <span className="text-[0.6rem] uppercase tracking-widest text-muted">{author}</span>}
    </div>
  );
}
