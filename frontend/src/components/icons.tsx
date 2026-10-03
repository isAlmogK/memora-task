import type { SVGProps } from 'react';

const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const SyncIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 21v-5h-5" />
  </svg>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const ArrowIcon = ({ dir = 'right', ...p }: SVGProps<SVGSVGElement> & { dir?: 'left' | 'right' }) => (
  <svg {...base} {...p} aria-hidden style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const AlertIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M12 8v5M12 16.5v.01" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
);
export const GripIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    {[6, 12, 18].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.1" fill="currentColor" />
        <circle cx="15" cy={y} r="1.1" fill="currentColor" />
      </g>
    ))}
  </svg>
);
export const ChevronIcon = ({ dir = 'down', ...p }: SVGProps<SVGSVGElement> & { dir?: 'up' | 'down' }) => (
  <svg {...base} {...p} aria-hidden style={{ transform: dir === 'up' ? 'rotate(180deg)' : undefined }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
