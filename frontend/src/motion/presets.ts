import type { Transition, Variants } from 'motion/react';

/**
 * All motion in one place so data components stay free of animation detail.
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">,
 * which turns transform/layout animation into plain fades.
 */
export const spring = {
  /** progress bars, counters: settles without wobble */
  smooth: { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 },
  /** buttons, stacks bouncing: a little overshoot, Flash-style */
  bouncy: { type: 'spring', stiffness: 420, damping: 14 },
  /** shared-element cover morphs */
  morph: { type: 'spring', stiffness: 260, damping: 30 },
  /** cursor-following tilt */
  tilt: { stiffness: 220, damping: 18, mass: 0.4 },
} satisfies Record<string, Transition | { stiffness: number; damping: number; mass: number }>;

/** Route change: a short horizontal page turn. */
export const page: Variants = {
  initial: { opacity: 0, x: 28 },
  enter: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1], when: 'beforeChildren', staggerChildren: 0.05 } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.18, ease: 'easeIn' } },
};

/** Lists that cascade in. Put `staggerList` on the parent and `staggerItem` on children. */
export const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

/** Hero carousel: the next book slides in from the side you're heading to. `custom` = 1 | -1. */
export const carousel: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 70 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -70, transition: { duration: 0.16, ease: 'easeIn' } }),
};
